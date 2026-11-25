// Validaciones deterministas sobre lo que devuelve el modelo. No dependen de Deno.

const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizaCups(c: string | null | undefined): string | null {
  if (!c) return null;
  const s = c.toUpperCase().replace(/[\s-]/g, "");
  return /^ES\d{16}[A-Z]{2}(\d[FPCRXYZ])?$/.test(s) ? s : null;
}

/** Comprueba las dos letras de control del CUPS (ES + 16 dígitos + 2 letras). */
export function cupsValido(c: string | null | undefined): boolean {
  const s = normalizaCups(c);
  if (!s) return false;
  const d = BigInt(s.slice(2, 18));
  const r = Number(d % 529n);
  return LETRAS[Math.floor(r / 23)] + LETRAS[r % 23] === s.slice(18, 20);
}

export const cups20 = (c: string) => normalizaCups(c)!.slice(0, 20);

export type Aviso = { nivel: "error" | "aviso"; campo: string; mensaje: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const dias = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;

// deno-lint-ignore no-explicit-any
export function validar(x: any): { avisos: Aviso[]; datos: any } {
  const avisos: Aviso[] = [];
  const add = (nivel: Aviso["nivel"], campo: string, mensaje: string) =>
    avisos.push({ nivel, campo, mensaje });

  // 1) CUPS
  const cups = normalizaCups(x.suministro?.cups);
  if (!cups) add("error", "cups", "CUPS no encontrado o con formato incorrecto");
  else if (!cupsValido(cups)) add("error", "cups", "Las letras de control del CUPS no cuadran: revisar la lectura");
  if (x.suministro) x.suministro.cups = cups;

  // 2) Tarifa y periodos de potencia
  const pot = x.suministro?.potencias_kw ?? {};
  if (x.suministro?.tarifa_acceso === "2.0TD") {
    // Algunas comercializadoras etiquetan el valle como P3
    if (pot.p2 == null && pot.p3 != null && pot.p4 == null) {
      pot.p2 = pot.p3;
      pot.p3 = null;
      add("aviso", "potencias", "Potencia de valle venía como P3; normalizada a P2");
    }
    if (pot.p1 == null) add("error", "potencias", "Falta la potencia contratada P1");
  } else if (x.suministro?.tarifa_acceso) {
    const n = ["p1", "p2", "p3", "p4", "p5", "p6"].filter((k) => pot[k] != null).length;
    if (n < 6 && x.suministro.tarifa_acceso === "3.0TD") {
      add("aviso", "potencias", `3.0TD con ${n} de 6 periodos de potencia leídos`);
    }
  } else add("error", "tarifa", "No se ha podido identificar la tarifa de acceso");

  // 3) Aritmética
  const f = x.factura ?? {};
  const lineas: any[] = x.lineas ?? [];
  const sumaLineas = r2(lineas.reduce((s, l) => s + (Number(l.importe) || 0), 0));
  if (f.base_imponible != null && lineas.length) {
    const dif = Math.abs(sumaLineas - f.base_imponible);
    if (dif > 0.05) {
      add("error", "lineas", `Las líneas suman ${sumaLineas} € y la base imponible es ${f.base_imponible} €`);
    }
  }
  if (f.base_imponible != null && f.total != null) {
    const iva = f.iva_importe ?? (f.iva_pct != null ? f.base_imponible * f.iva_pct / 100 : null);
    if (iva != null && Math.abs(f.base_imponible + iva - f.total) > 0.05) {
      add("error", "total", `Base ${f.base_imponible} + IVA ${r2(iva)} no da el total ${f.total}`);
    }
  }

  // 4) Días del periodo
  if (f.periodo_inicio && f.periodo_fin) {
    const d = dias(f.periodo_inicio, f.periodo_fin);
    if (d < 1 || d > 70) add("aviso", "periodo", `Periodo de ${d} días: raro`);
    if (f.dias == null) f.dias = d;
    else if (Math.abs(f.dias - d) > 1) add("aviso", "periodo", `Dice ${f.dias} días pero las fechas dan ${d}`);
  }

  // 5) Importe recurrente (sin cargos puntuales ni IVA)
  const recurrente = r2(
    lineas.filter((l) => l.recurrente !== false).reduce((s, l) => s + (Number(l.importe) || 0), 0),
  );
  const puntual = r2(sumaLineas - recurrente);
  if (puntual > 0) add("aviso", "lineas", `Hay ${puntual} € de cargos de un solo pago; no cuentan para comparar ahorro`);

  // 6) Contrato / vencimiento
  const c = x.contrato ?? {};
  if (c.fecha_fin && c.sin_penalizacion_hasta) {
    add("aviso", "contrato", "Aparecen fecha final y «sin penalización hasta»; confirmar cuál manda");
  }
  if (!c.fecha_fin && !c.sin_penalizacion_hasta) {
    add("aviso", "contrato", "La factura no indica vencimiento: pedirlo al cliente o marcar como desconocido");
  }

  // 7) Confianza
  if (typeof x.confianza === "number" && x.confianza < 0.7) {
    add("aviso", "confianza", "Lectura poco fiable: revisar todos los campos");
  }
  for (const d of x.dudas ?? []) add("aviso", "duda", String(d));

  return {
    avisos,
    datos: { ...x, _calculo: { suma_lineas: sumaLineas, importe_recurrente: recurrente, importe_puntual: puntual } },
  };
}
