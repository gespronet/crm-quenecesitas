// Edge Function: extract-invoice
// Recibe { bucket, path } de un archivo ya subido a Storage (bucket privado energia-facturas),
// lo lee con la sesión del usuario, extrae los datos con Claude y devuelve datos + avisos.
// NO escribe en tablas: la pantalla de revisión del CRM guarda tras validar la persona.
//
// Secretos necesarios:  ANTHROPIC_API_KEY   (obligatorio)
//                       EXTRACT_MODEL       (opcional, por defecto claude-sonnet-5-5)
// Despliegue: verify_jwt = true

import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { SCHEMA, SYSTEM_PROMPT, TOOL_NAME } from "./schema.ts";
import { cups20, validar } from "./checks.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_BYTES = 10 * 1024 * 1024;
const BUCKET_OK = "energia-facturas";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Falta el secreto ANTHROPIC_API_KEY" }, 500);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sin sesión" }, 401);

    // Cliente con la sesión del usuario: Storage y RLS se aplican como a él.
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: ok, error: eAuth } = await sb.rpc("is_crm_user");
    if (eAuth || ok !== true) return json({ error: "No autorizado" }, 403);

    const { bucket, path } = await req.json();
    if (bucket !== BUCKET_OK || typeof path !== "string" || path.includes("..")) {
      return json({ error: "Archivo no válido" }, 400);
    }

    const { data: blob, error: eDl } = await sb.storage.from(bucket).download(path);
    if (eDl || !blob) return json({ error: "No se pudo leer el archivo" }, 404);
    if (blob.size > MAX_BYTES) return json({ error: "Archivo demasiado grande (máx. 10 MB)" }, 413);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mime = blob.type || (path.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const b64 = encodeBase64(bytes);
    const bloque = mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: mime, data: b64 } };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("EXTRACT_MODEL") ?? "claude-sonnet-5-5",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        tools: [{ name: TOOL_NAME, description: "Registra los datos de la factura", input_schema: SCHEMA }],
        tool_choice: { type: "tool", name: TOOL_NAME },
        messages: [{
          role: "user",
          content: [bloque, { type: "text", text: "Extrae los datos de esta factura de electricidad." }],
        }],
      }),
    });
    if (!r.ok) {
      console.error("anthropic", r.status, await r.text());
      return json({ error: "Falló la lectura de la factura. Reintenta en un momento." }, 502);
    }
    const resp = await r.json();
    const uso = resp.content?.find((c: { type: string }) => c.type === "tool_use");
    if (!uso) return json({ error: "No se obtuvo ningún dato de la factura" }, 502);

    const { avisos, datos } = validar(uso.input);

    // Cruce con lo que ya existe (solo lectura, bajo RLS del usuario).
    let existente: Record<string, unknown> = {};
    const cups = datos.suministro?.cups as string | null;
    if (cups) {
      const c20 = cups20(cups);
      const { data: sums } = await sb.from("energia_cups").select("id, codigo_cups, contact_id")
        .ilike("codigo_cups", `${c20}%`).limit(5);
      existente.suministros = sums ?? [];
      if (sums?.length && datos.factura?.numero) {
        const { data: dup } = await sb.from("energia_facturas").select("id")
          .in("cups_id", sums.map((s) => s.id)).eq("numero_factura", datos.factura.numero).limit(1);
        if (dup?.length) {
          avisos.push({ nivel: "error", campo: "factura", mensaje: "Esta factura ya está cargada" });
          existente.factura_duplicada = dup[0].id;
        }
      }
    }
    return json({ datos, avisos, existente, uso: resp.usage });
  } catch (e) {
    console.error(e);
    return json({ error: "Error interno" }, 500);
  }
});
