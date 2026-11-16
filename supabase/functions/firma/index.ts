// Edge Function «firma» · Qué necesitas hoy
// Firma electrónica con verificación por email (código), DNI previo y firma manuscrita.
import { createClient } from "jsr:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MAIL_URL = Deno.env.get("FIRMA_MAIL_URL") ?? "https://n8n.gespronet.cloud/webhook/quenecesitas-firma-email";
const MAIL_SECRET = Deno.env.get("FIRMA_MAIL_SECRET") ?? "adaf519ec1b23107011d7caee05517adbbf31f707212b8e3";
const BASE = Deno.env.get("FIRMA_BASE_URL") ?? "https://crm.quenecesitashoy.com/?firmar=";
const AVISO = "anovo@quenecesitashoy.es";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const TABLA: Record<string, string> = { mandato: "mandatos", arras: "contratos_arras" };
// Orden de las cajas de firma en cada plantilla
const CAJAS: Record<string, string[]> = { mandato: ["agencia", "propiedad"], arras: ["vendedor", "comprador", "agencia"] };
const NOMBRE_DOC: Record<string, string> = { mandato: "mandato de venta", arras: "contrato de arras" };

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const err = (m: string, s = 400) => json({ error: m }, s);
const sha256 = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, "0")).join("");
const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join("");
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const normDni = (s: string) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
const fechaHora = (d: string | Date) => new Date(d).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const maskEmail = (e: string) => { const [u, d] = e.split("@"); return (u.length <= 2 ? u[0] + "•" : u.slice(0, 2) + "•".repeat(Math.max(2, u.length - 2))) + "@" + d; };

async function mail(to: string, subject: string, cuerpo: string) {
  const html = `<div style="background:#F6F5F1;padding:32px 16px;font-family:Arial,sans-serif;color:#0B1233">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E4E2DA;border-radius:20px 20px 20px 0;padding:32px">
  <div style="font-family:monospace;font-size:11px;letter-spacing:.08em;color:#00208F;margin-bottom:8px">QUÉ NECESITAS HOY · FIRMA ELECTRÓNICA</div>
  ${cuerpo}
  <p style="font-size:12px;color:#5B6178;margin-top:28px;border-top:1px solid #E4E2DA;padding-top:14px">Gespronet Axencia de Marketing e Deseño, S.L. · Rúa do Souto, 1 · Oleiros · quenecesitashoy.es</p></div></div>`;
  const r = await fetch(MAIL_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-firma-secret": MAIL_SECRET }, body: JSON.stringify({ to, subject, html }) });
  if (!r.ok) throw new Error("No se pudo enviar el email (" + r.status + ")");
}
const boton = (url: string, txt: string) => `<p style="margin:24px 0"><a href="${url}" style="background:#00208F;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:14px 14px 14px 0;display:inline-block">${txt}</a></p>`;

async function evento(id: string, tipo: string, req: Request, extra: Record<string, unknown> = {}) {
  const { data } = await sb.from("firma_solicitudes").select("evidencias").eq("id", id).single();
  const ev = [...(data?.evidencias ?? []), { tipo, fecha: new Date().toISOString(), ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "", ua: req.headers.get("user-agent") ?? "", ...extra }];
  await sb.from("firma_solicitudes").update({ evidencias: ev }).eq("id", id);
}

async function getDoc(tipo: string, id: string) {
  const { data } = await sb.from(TABLA[tipo]).select("*").eq("id", id).single();
  return data;
}

async function solicitudPorToken(token: string) {
  if (!token || token.length < 20) return null;
  const { data } = await sb.from("firma_solicitudes").select("*").eq("token", token).single();
  return data;
}

// Compone el documento con las firmas ya realizadas + hoja de auditoría
async function componer(tipo: string, docId: string) {
  const doc = await getDoc(tipo, docId);
  const { data: sols } = await sb.from("firma_solicitudes").select("*").eq("doc_tipo", tipo).eq("doc_id", docId).neq("estado", "anulado").order("created_at");
  let html: string = doc.html;
  const firmadas = (sols ?? []).filter(s => s.estado === "firmado");
  const todas = (sols ?? []).length > 0 && firmadas.length === (sols ?? []).length;
  const orden = CAJAS[tipo];
  let i = -1;
  html = html.replace(/<div class="esp"><\/div>/g, (m) => {
    i++;
    const rol = orden[i];
    if (rol === "agencia") {
      if (!todas) return m;
      const ag = doc.datos?.agente?.nombre ?? "Qué necesitas hoy";
      return `<div class="esp" style="display:flex;flex-direction:column;justify-content:center;font-size:8pt;color:#00208F;line-height:1.4"><b style="font-family:Poppins,sans-serif;font-size:10pt">✓ Firmado electrónicamente</b><span>${esc(ag)} · por Qué necesitas hoy</span><span>${esc(fechaHora(firmadas[firmadas.length - 1].firmado_at))}</span></div>`;
    }
    const s = firmadas.find(x => x.rol === rol);
    if (!s) return m;
    return `<div class="esp" style="display:flex;flex-direction:column;justify-content:flex-end"><img src="${s.firma_png}" alt="Firma" style="max-height:20mm;max-width:100%;object-fit:contain;object-position:left bottom"><span style="font-size:6.5pt;color:#5B6178;font-family:'JetBrains Mono',monospace;letter-spacing:.04em">FIRMADO ELECTRÓNICAMENTE · ${esc(fechaHora(s.firmado_at))}</span></div>`;
  });
  if (firmadas.length) {
    const filas = firmadas.map(s => `
      <div class="caja" style="margin-bottom:4mm;break-inside:avoid">
        <span class="lbl" style="color:#00208F">${esc(s.rol)}</span>
        <b style="display:block;font-size:10.5pt;margin:1mm 0">${esc(s.firmante_nombre)}</b>
        <div class="grid3" style="font-size:8.5pt">
          <div class="campo"><span class="lbl">Email verificado</span><span>${esc(s.firmante_email)}</span></div>
          <div class="campo"><span class="lbl">DNI/NIE declarado</span><span>${esc(s.dni_numero)}</span></div>
          <div class="campo"><span class="lbl">Firmado</span><span>${esc(fechaHora(s.firmado_at))}</span></div>
          <div class="campo"><span class="lbl">IP</span><span>${esc(s.ip)}</span></div>
          <div class="campo" style="grid-column:span 2"><span class="lbl">Dispositivo</span><span style="font-size:7.5pt">${esc((s.user_agent ?? "").slice(0, 140))}</span></div>
        </div>
        <p style="font-size:8pt;margin-top:2mm">Proceso: enlace personal enviado por email (${esc(fechaHora(s.created_at))}) · código de verificación por email validado (${esc(fechaHora(s.verificado_at))}) · documento de identidad aportado (${esc(fechaHora(s.dni_at))}) · aceptación expresa del documento y firma manuscrita digital (${esc(fechaHora(s.firmado_at))}).</p>
      </div>`).join("");
    const audit = `
<div style="break-before:page;padding-top:4mm">
  <div class="eyebrow"><span class="dot"></span>Hoja de evidencias</div>
  <h1 style="font-size:20pt">Registro de firma electrónica</h1>
  <p style="margin-bottom:5mm">Documento <span class="v">${esc(doc.referencia)}</span>. Huella digital SHA-256 del documento original firmado:</p>
  <p style="font-family:'JetBrains Mono',monospace;font-size:8pt;word-break:break-all;color:#00208F;margin-bottom:6mm">${esc(sols?.[0]?.doc_hash ?? "")}</p>
  ${filas}
  <p class="nota">Firma electrónica conforme al Reglamento (UE) 910/2014 (eIDAS) y a la Ley 6/2020. Las evidencias (registros, copia del documento de identidad y firma) se custodian por Gespronet Axencia de Marketing e Deseño, S.L.</p>
</div>`;
    html = html.replace(/(\n?<\/td><\/tr><\/tbody><\/table>)(?![\s\S]*<\/tbody><\/table>)/, audit + "$1");
  }
  return { html, todas, doc, sols: sols ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch { return err("Petición no válida"); }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  try {
    switch (b.action) {
      // ───────── Desde el CRM ─────────
      case "crear": {
        const tipo = b.doc_tipo; if (!TABLA[tipo]) return err("Tipo no válido");
        const doc = await getDoc(tipo, b.doc_id); if (!doc) return err("Documento no encontrado", 404);
        if (doc.firmado_at) return err("Este documento ya está firmado");
        const hash = await sha256(doc.html);
        const out = [];
        for (const f of (b.firmantes ?? [])) {
          if (!f.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return err(`Email no válido para ${f.nombre || f.rol}`);
          await sb.from("firma_solicitudes").update({ estado: "anulado" }).eq("doc_tipo", tipo).eq("doc_id", b.doc_id).eq("rol", f.rol).neq("estado", "firmado");
          const token = tok();
          const { data: s, error } = await sb.from("firma_solicitudes").insert({
            token, doc_tipo: tipo, doc_id: b.doc_id, property_id: doc.property_id, rol: f.rol,
            firmante_nombre: f.nombre, firmante_email: f.email.trim().toLowerCase(), firmante_dni: f.dni, doc_hash: hash, creado_por: b.creado_por,
          }).select().single();
          if (error) throw error;
          await mail(s.firmante_email, `Documento para firmar · ${NOMBRE_DOC[tipo]} ${doc.referencia}`,
            `<h2 style="font-family:Arial;margin:0 0 12px">Hola, ${esc(f.nombre?.split(" ")[0] || "")}</h2>
             <p>Qué necesitas hoy te envía el <b>${NOMBRE_DOC[tipo]} ${esc(doc.referencia)}</b> para que lo revises y lo firmes desde el móvil o el ordenador.</p>
             <p>Son tres pasos rápidos: verificar tu email con un código, subir una foto de tu DNI y firmar.</p>
             ${boton(BASE + token, "Revisar y firmar")}
             <p style="font-size:13px;color:#5B6178">El enlace es personal y caduca en 14 días. Si no esperabas este documento, ignora este mensaje.</p>`);
          await evento(s.id, "invitacion_enviada", req, { email: s.firmante_email });
          out.push({ rol: s.rol, token: s.token, email: s.firmante_email });
        }
        return json({ ok: true, firmantes: out });
      }
      case "estado_doc": {
        const { data } = await sb.from("firma_solicitudes").select("token,rol,firmante_nombre,firmante_email,estado,created_at,verificado_at,dni_at,firmado_at,expira_at,dni_numero").eq("doc_tipo", b.doc_tipo).eq("doc_id", b.doc_id).neq("estado", "anulado").order("created_at");
        const doc = await getDoc(b.doc_tipo, b.doc_id);
        return json({ solicitudes: data ?? [], firmado_at: doc?.firmado_at ?? null, html_firmado: doc?.html_firmado ?? null });
      }
      case "reenviar": {
        const s = await solicitudPorToken(b.token); if (!s) return err("No encontrado", 404);
        const doc = await getDoc(s.doc_tipo, s.doc_id);
        await sb.from("firma_solicitudes").update({ expira_at: new Date(Date.now() + 14 * 864e5).toISOString() }).eq("id", s.id);
        await mail(s.firmante_email, `Recordatorio · ${NOMBRE_DOC[s.doc_tipo]} ${doc.referencia} pendiente de firma`,
          `<p>Te recordamos que tienes pendiente de firma el <b>${NOMBRE_DOC[s.doc_tipo]} ${esc(doc.referencia)}</b>.</p>${boton(BASE + s.token, "Revisar y firmar")}`);
        await evento(s.id, "recordatorio_enviado", req);
        return json({ ok: true });
      }
      case "anular": {
        const s = await solicitudPorToken(b.token); if (!s) return err("No encontrado", 404);
        if (s.estado === "firmado") return err("Ya está firmado");
        await sb.from("firma_solicitudes").update({ estado: "anulado" }).eq("id", s.id);
        return json({ ok: true });
      }
      case "dni_urls": {
        const s = await solicitudPorToken(b.token); if (!s) return err("No encontrado", 404);
        const urls: Record<string, string> = {};
        for (const k of ["dni_anverso", "dni_reverso"]) if (s[k]) { const { data } = await sb.storage.from("firmas").createSignedUrl(s[k], 300); urls[k] = data?.signedUrl ?? ""; }
        return json(urls);
      }

      // ───────── Página pública del firmante ─────────
      case "publico": {
        const s = await solicitudPorToken(b.token); if (!s || s.estado === "anulado") return err("Este enlace no es válido o ha sido anulado.", 404);
        const { html, todas, doc } = await componer(s.doc_tipo, s.doc_id);
        const caducado = s.estado !== "firmado" && new Date(s.expira_at) < new Date();
        if (s.estado === "enviado" && !(s.evidencias ?? []).some((e: any) => e.tipo === "documento_abierto")) await evento(s.id, "documento_abierto", req);
        return json({
          estado: caducado ? "caducado" : s.estado, rol: s.rol, nombre: s.firmante_nombre, email: maskEmail(s.firmante_email),
          referencia: doc.referencia, tipo: NOMBRE_DOC[s.doc_tipo], html: s.estado === "firmado" && todas ? (doc.html_firmado ?? html) : html, completo: todas,
        });
      }
      case "enviar_codigo": {
        const s = await solicitudPorToken(b.token); if (!s || s.estado === "anulado") return err("Enlace no válido", 404);
        if (new Date(s.expira_at) < new Date()) return err("El enlace ha caducado. Pide uno nuevo a Qué necesitas hoy.");
        if ((s.otp_enviados ?? 0) >= 6) return err("Has pedido demasiados códigos. Contacta con Qué necesitas hoy.");
        const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        await sb.from("firma_solicitudes").update({ otp_hash: await sha256(s.token + codigo), otp_expira: new Date(Date.now() + 10 * 60000).toISOString(), otp_intentos: 0, otp_enviados: (s.otp_enviados ?? 0) + 1 }).eq("id", s.id);
        await mail(s.firmante_email, `Tu código de verificación: ${codigo}`,
          `<p>Tu código para firmar el documento es:</p><p style="font-family:monospace;font-size:34px;font-weight:bold;letter-spacing:.2em;color:#00208F;margin:16px 0">${codigo}</p><p style="font-size:13px;color:#5B6178">Caduca en 10 minutos. No lo compartas con nadie.</p>`);
        await evento(s.id, "codigo_enviado", req);
        return json({ ok: true, email: maskEmail(s.firmante_email) });
      }
      case "verificar": {
        const s = await solicitudPorToken(b.token); if (!s || s.estado === "anulado") return err("Enlace no válido", 404);
        if (!s.otp_hash || new Date(s.otp_expira) < new Date()) return err("El código ha caducado. Pide uno nuevo.");
        if ((s.otp_intentos ?? 0) >= 5) return err("Demasiados intentos. Pide un código nuevo.");
        const ok = (await sha256(s.token + String(b.codigo ?? "").trim())) === s.otp_hash;
        if (!ok) { await sb.from("firma_solicitudes").update({ otp_intentos: (s.otp_intentos ?? 0) + 1 }).eq("id", s.id); return err("Código incorrecto."); }
        await sb.from("firma_solicitudes").update({ otp_hash: null, estado: s.estado === "enviado" ? "email_verificado" : s.estado, verificado_at: new Date().toISOString() }).eq("id", s.id);
        await evento(s.id, "email_verificado", req);
        return json({ ok: true });
      }
      case "dni": {
        const s = await solicitudPorToken(b.token); if (!s || s.estado === "anulado") return err("Enlace no válido", 404);
        if (!s.verificado_at) return err("Primero verifica tu email.");
        if (s.estado === "firmado") return err("El documento ya está firmado.");
        const num = normDni(b.numero);
        if (!/^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[A-Z][0-9]{7}[0-9A-Z])$/.test(num)) return err("El número de DNI/NIE no tiene un formato válido.");
        if (s.firmante_dni && normDni(s.firmante_dni) && normDni(s.firmante_dni) !== num) return err("El DNI/NIE no coincide con el que figura en el documento. Revisa el número o contacta con Qué necesitas hoy.");
        const sube = async (dataUrl: string, nombre: string) => {
          const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || ""); if (!m) throw new Error("Imagen no válida");
          const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
          if (bytes.length > 6_000_000) throw new Error("Imagen demasiado grande");
          const path = `${s.id}/${nombre}.${m[1].split("/")[1]}`;
          const { error } = await sb.storage.from("firmas").upload(path, bytes, { contentType: m[1], upsert: true }); if (error) throw error;
          return path;
        };
        const anverso = await sube(b.anverso, "dni-anverso"); const reverso = await sube(b.reverso, "dni-reverso");
        await sb.from("firma_solicitudes").update({ dni_numero: num, dni_anverso: anverso, dni_reverso: reverso, dni_at: new Date().toISOString(), estado: "dni_subido" }).eq("id", s.id);
        await evento(s.id, "dni_aportado", req, { dni: num });
        return json({ ok: true });
      }
      case "firmar": {
        const s = await solicitudPorToken(b.token); if (!s || s.estado === "anulado") return err("Enlace no válido", 404);
        if (s.estado === "firmado") return err("El documento ya está firmado.");
        if (!s.verificado_at || !s.dni_at) return err("Faltan pasos previos.");
        if (b.acepto !== true) return err("Debes aceptar el documento.");
        if (!/^data:image\/png;base64,/.test(b.firma || "") || b.firma.length < 2000) return err("La firma está vacía.");
        if (b.firma.length > 600000) return err("Firma demasiado grande.");
        const doc = await getDoc(s.doc_tipo, s.doc_id);
        if ((await sha256(doc.html)) !== s.doc_hash) return err("El documento ha cambiado desde el envío. Contacta con Qué necesitas hoy.");
        await sb.from("firma_solicitudes").update({ estado: "firmado", firma_png: b.firma, firmado_at: new Date().toISOString(), ip, user_agent: ua }).eq("id", s.id);
        await evento(s.id, "documento_firmado", req, { hash: s.doc_hash });
        const r = await componer(s.doc_tipo, s.doc_id);
        if (r.todas) {
          const h = await sha256(r.html);
          await sb.from(TABLA[s.doc_tipo]).update({ firmado_at: new Date().toISOString(), html_firmado: r.html, hash_firmado: h }).eq("id", s.doc_id);
          for (const x of r.sols) {
            await mail(x.firmante_email, `Documento firmado · ${NOMBRE_DOC[s.doc_tipo]} ${doc.referencia}`,
              `<p>El <b>${NOMBRE_DOC[s.doc_tipo]} ${esc(doc.referencia)}</b> ya está firmado por todas las partes.</p><p>Puedes verlo y descargar tu copia en PDF aquí:</p>${boton(BASE + x.token, "Ver documento firmado")}<p style="font-size:12px;color:#5B6178">Huella SHA-256: ${h}</p>`).catch(() => {});
          }
          await mail(AVISO, `✓ Firmado · ${NOMBRE_DOC[s.doc_tipo]} ${doc.referencia}`, `<p>Todas las partes han firmado el <b>${NOMBRE_DOC[s.doc_tipo]} ${esc(doc.referencia)}</b>.</p>`).catch(() => {});
        } else {
          await mail(AVISO, `Firma parcial · ${NOMBRE_DOC[s.doc_tipo]} ${doc.referencia}`, `<p>${esc(s.firmante_nombre)} (${esc(s.rol)}) ha firmado. Faltan otras partes.</p>`).catch(() => {});
        }
        return json({ ok: true, completo: r.todas });
      }
      default: return err("Acción no válida");
    }
  } catch (e) {
    console.error(e);
    return err(e instanceof Error ? e.message : "Error inesperado", 500);
  }
});
