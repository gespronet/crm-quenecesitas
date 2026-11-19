import { useState, useEffect, useMemo } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#00208F';
const n2 = v => Math.round((Number(v) || 0) * 100) / 100;
const eur = v => (Number(v) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fd = d => d ? d.split('-').reverse().join('/') : '';
const hoyISO = () => new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const trimDe = f => Math.floor((Number(f.slice(5, 7)) - 1) / 3) + 1;
const rangoTrim = (anio, t) => [`${anio}-${String((t - 1) * 3 + 1).padStart(2, '0')}-01`, new Date(Date.UTC(anio, t * 3, 0)).toISOString().slice(0, 10)];

export const inp = { padding: '7px 9px', border: '1px solid #dde1ea', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', width: '100%' };
const lbl = { fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 3 };
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#64748b', fontWeight: 700, background: '#f8fafc', position: 'sticky', top: 0 };
const td = { padding: '6px 10px', borderTop: '1px solid #f1f5f9', fontSize: 13 };
const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const Card = ({ children, style }) => <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 16, ...style }}>{children}</div>;
const Btn = ({ children, onClick, kind = 'sec', disabled, title, small }) => (
  <button title={title} disabled={disabled} onClick={onClick} style={{ padding: small ? '5px 9px' : '8px 14px', borderRadius: 9, border: 'none', cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: small ? 12 : 13, opacity: disabled ? .5 : 1, whiteSpace: 'nowrap',
    background: kind === 'pri' ? BRAND : kind === 'ok' ? '#10b981' : kind === 'del' ? '#fee2e2' : '#eef0f6', color: kind === 'pri' || kind === 'ok' ? 'white' : kind === 'del' ? '#991b1b' : '#334' }}>{children}</button>
);
const Modal = ({ children, onClose, width = 900 }) => (
  <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,51,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 12px', overflowY: 'auto' }}>
    <Card style={{ width: `min(${width}px,100%)` }}>{children}</Card>
  </div>
);
const Badge = ({ c, bg, children }) => <span style={{ fontSize: 11, fontWeight: 700, color: c, background: bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{children}</span>;
const descargarCSV = (nombre, filas) => {
  const csv = '﻿' + filas.map(r => r.map(c => {
    const s = c == null ? '' : typeof c === 'number' ? c.toFixed(2).replace('.', ',') : String(c);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre; a.click();
};
const rpc = async (fn, args) => { const { data, error } = await supabase.rpc(fn, args); if (error) { alert(error.message); return { ok: false }; } return { ok: true, data }; };

export function useEmpresa() {
  const [emp, setEmp] = useState(null);
  const cargar = async () => { const { data } = await supabase.from('cont_empresa').select('*').eq('id', 1).maybeSingle(); setEmp(data); };
  useEffect(() => { cargar(); }, []);
  return [emp, cargar];
}

// ═════════════════════════ EMPRESA ═════════════════════════
export function Empresa({ cuentas }) {
  const [emp, cargar] = useEmpresa();
  const [f, setF] = useState(null); const [ok, setOk] = useState(false);
  useEffect(() => { if (emp) setF(emp); }, [emp]);
  if (!f) return <Card>Cargando…</Card>;
  const guardar = async () => {
    const { id, updated_at, ...rest } = f;
    const { error } = await supabase.from('cont_empresa').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) alert(error.message); else { setOk(true); cargar(); setTimeout(() => setOk(false), 2000); }
  };
  const C = ({ k, l, full }) => <div style={{ gridColumn: full ? '1/-1' : undefined }}><label style={lbl}>{l}</label><input style={inp} value={f[k] || ''} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} /></div>;
  return (
    <Card style={{ maxWidth: 760 }}>
      <h3 style={{ margin: '0 0 4px', color: BRAND }}>Datos de la sociedad</h3>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>Aparecen en las facturas emitidas. Sin NIF no se pueden emitir facturas.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {C({ k: 'razon_social', l: 'Razón social', full: true })}{C({ k: 'nif', l: 'NIF' })}{C({ k: 'registro_mercantil', l: 'Datos registrales (Tomo, Folio, Hoja…)' })}
        {C({ k: 'direccion', l: 'Dirección', full: true })}{C({ k: 'cp', l: 'Código postal' })}{C({ k: 'localidad', l: 'Localidad' })}
        {C({ k: 'provincia', l: 'Provincia' })}{C({ k: 'email', l: 'Email' })}{C({ k: 'telefono', l: 'Teléfono' })}{C({ k: 'iban', l: 'IBAN (para cobros)' })}
        <div><label style={lbl}>Cuenta de banco por defecto</label>
          <select style={inp} value={f.cuenta_banco || ''} onChange={e => setF(x => ({ ...x, cuenta_banco: e.target.value }))}>
            {cuentas.filter(c => c.imputable && /^57/.test(c.codigo)).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
          </select></div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}><Btn kind="pri" onClick={guardar}>Guardar</Btn>{ok && <span style={{ color: '#059669', fontWeight: 700 }}>✓ Guardado</span>}</div>
    </Card>
  );
}

// ═════════════════════════ FACTURA HTML ═════════════════════════
export function facturaHTML(f, emp, original) {
  const tit = f.tipo === 'R1' ? 'Factura rectificativa' : f.tipo === 'F2' ? 'Factura simplificada' : 'Factura';
  const lineas = (f.lineas || []).map(l => {
    const imp = n2((Number(l.cantidad) || 1) * Number(l.precio));
    return `<tr><td>${esc(l.concepto)}</td><td class="r">${eur(l.cantidad || 1)}</td><td class="r">${eur(l.precio)}</td><td class="r">${l.iva_pct}%</td><td class="r">${eur(imp)}</td></tr>`;
  }).join('');
  const des = (f.desglose || []).map(d => `<tr><td>Base imponible al ${d.iva_pct}%</td><td class="r">${eur(d.base)} €</td></tr><tr><td>IVA ${d.iva_pct}%</td><td class="r">${eur(d.cuota)} €</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(f.num_factura)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:16mm 16mm 18mm}*{box-sizing:border-box}body{font-family:'DM Sans',Arial,sans-serif;font-size:10pt;color:#0B1233;margin:0}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1.5pt solid #00208F;padding-bottom:5mm;margin-bottom:6mm}
.marca{font-family:Poppins,sans-serif;font-weight:700;font-size:16pt;color:#00208F;letter-spacing:-.03em}.marca i{display:inline-block;width:3mm;height:3mm;background:#FFB81C;border-radius:50% 50% 50% 0;margin-right:2mm}
h1{font-family:Poppins,sans-serif;font-size:20pt;margin:0;text-align:right}.mono{font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:.06em;color:#5B6178;text-transform:uppercase}
.partes{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-bottom:7mm}.caja{border:.75pt solid #C9CBD3;border-radius:4mm 4mm 4mm 0;padding:4mm}.caja b{font-size:11pt}
table{width:100%;border-collapse:collapse}th{font-family:'JetBrains Mono',monospace;font-size:7.5pt;text-transform:uppercase;color:#5B6178;text-align:left;border-bottom:1pt solid #0B1233;padding:2mm}
td{padding:2.2mm 2mm;border-bottom:.5pt solid #E4E2DA;vertical-align:top}.r{text-align:right;white-space:nowrap}
.tot{width:85mm;margin:6mm 0 0 auto}.tot td{border:none;padding:1.4mm 2mm}.tot .g td{font-family:Poppins,sans-serif;font-weight:700;font-size:13pt;color:#00208F;border-top:1.5pt solid #00208F;padding-top:3mm}
.pie{margin-top:10mm;font-size:8pt;color:#5B6178;line-height:1.5}.huella{font-family:'JetBrains Mono',monospace;font-size:6.5pt;color:#8a8fa3;word-break:break-all;margin-top:6mm}
</style></head><body>
<div class="top"><div><div class="marca"><i></i>quenecesitas</div><div style="margin-top:3mm;line-height:1.5"><b>${esc(emp.razon_social)}</b><br>NIF ${esc(emp.nif)}<br>${esc(emp.direccion)}<br>${esc([emp.cp, emp.localidad].filter(Boolean).join(' '))}${emp.provincia ? ' (' + esc(emp.provincia) + ')' : ''}<br>${esc(emp.email || '')}${emp.telefono ? ' · ' + esc(emp.telefono) : ''}</div></div>
<div style="text-align:right"><h1>${tit}</h1><div class="mono" style="margin-top:2mm">Nº</div><div style="font-family:Poppins;font-weight:700;font-size:13pt">${esc(f.num_factura)}</div>
<div class="mono" style="margin-top:2mm">Fecha de expedición</div><div>${fd(f.fecha)}</div>${f.fecha_operacion && f.fecha_operacion !== f.fecha ? `<div class="mono" style="margin-top:2mm">Fecha de operación</div><div>${fd(f.fecha_operacion)}</div>` : ''}</div></div>
<div class="partes"><div class="caja"><div class="mono">Cliente</div><b>${esc(f.cliente_nombre)}</b><br>${f.cliente_nif ? 'NIF ' + esc(f.cliente_nif) + '<br>' : ''}${esc(f.cliente_direccion || '').replace(/\n/g, '<br>')}</div>
<div class="caja"><div class="mono">Forma de pago</div>${esc(f.forma_pago || 'Transferencia bancaria')}${emp.iban ? '<br>IBAN ' + esc(emp.iban) : ''}${f.tipo === 'R1' && original ? `<div class="mono" style="margin-top:3mm">Rectifica a</div>Factura ${esc(original.num_factura)} de ${fd(original.fecha)}<br><i>${esc(f.motivo_rectificacion || '')}</i>` : ''}</div></div>
<table><thead><tr><th>Concepto</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">IVA</th><th class="r">Importe</th></tr></thead><tbody>${lineas}</tbody></table>
<table class="tot"><tbody>${des}${Number(f.cuota_irpf) ? `<tr><td>Retención IRPF ${f.irpf_pct}%</td><td class="r">−${eur(f.cuota_irpf)} €</td></tr>` : ''}<tr class="g"><td>Total factura</td><td class="r">${eur(f.total)} €</td></tr></tbody></table>
${f.observaciones ? `<div class="pie"><b>Observaciones:</b> ${esc(f.observaciones)}</div>` : ''}
<div class="pie">${esc(emp.razon_social)}${emp.registro_mercantil ? ' · ' + esc(emp.registro_mercantil) : ''}. Los datos personales se tratan para la gestión de la relación comercial (RGPD). Derechos en ${esc(emp.email || '')}.</div>
<div class="huella">Huella del registro: ${esc(f.huella)}</div>
</body></html>`;
}
const imprimirHTML = (html, autoPrint = true) => {
  const w = window.open('', '_blank'); if (!w) return alert('Permite las ventanas emergentes');
  w.document.open(); w.document.write(html); w.document.close(); if (autoPrint) setTimeout(() => { w.focus(); w.print(); }, 900);
};

// ═════════════════════════ FACTURAS EMITIDAS ═════════════════════════
function NuevaFactura({ onClose, onSaved, cuentas, rectifica, emp }) {
  const [f, setF] = useState(() => rectifica ? {
    tipo: 'R1', fecha: hoyISO(), cliente_nombre: rectifica.cliente_nombre, cliente_nif: rectifica.cliente_nif || '', cliente_direccion: rectifica.cliente_direccion || '',
    cuenta_ingreso: rectifica.cuenta_ingreso, irpf_pct: rectifica.irpf_pct || 0, forma_pago: rectifica.forma_pago || '', observaciones: '',
    motivo_rectificacion: 'Anulación total de la factura', lineas: rectifica.lineas.map(l => ({ ...l, cantidad: -(Number(l.cantidad) || 1) })),
  } : { tipo: 'F1', fecha: hoyISO(), fecha_operacion: '', cliente_nombre: '', cliente_nif: '', cliente_direccion: '', cuenta_ingreso: '7540000', irpf_pct: 0, forma_pago: 'Transferencia bancaria', observaciones: '', lineas: [{ concepto: '', cantidad: 1, precio: '', iva_pct: 21 }] });
  const [busy, setBusy] = useState(false);
  const clientes = cuentas.filter(c => c.imputable && c.codigo.startsWith('430') && c.codigo !== '4300000');
  const setL = (i, k, v) => setF(x => ({ ...x, lineas: x.lineas.map((l, j) => j === i ? { ...l, [k]: v } : l) }));
  const calc = useMemo(() => {
    const g = {}; f.lineas.forEach(l => { const b = n2((Number(String(l.cantidad).replace(',', '.')) || 0) * (Number(String(l.precio).replace(',', '.')) || 0)); g[l.iva_pct] = n2((g[l.iva_pct] || 0) + b); });
    const des = Object.entries(g).map(([p, b]) => ({ p: Number(p), b, c: n2(b * p / 100) }));
    const base = n2(des.reduce((s, d) => s + d.b, 0)), cuota = n2(des.reduce((s, d) => s + d.c, 0)), irpf = n2(base * (Number(f.irpf_pct) || 0) / 100);
    return { des, base, cuota, irpf, total: n2(base + cuota - irpf) };
  }, [f]);
  const elegirCliente = cod => { const c = cuentas.find(x => x.codigo === cod); if (c) setF(x => ({ ...x, cliente_nombre: c.nombre, cliente_nif: c.nif || '', cliente_cuenta: c.codigo })); };
  const emitir = async () => {
    if (!window.confirm(`¿Emitir la factura por ${eur(calc.total)} €?\n\nUna vez emitida no se puede modificar ni borrar: solo rectificar.`)) return;
    setBusy(true);
    const p = { ...f, rectifica_id: rectifica?.id, lineas: f.lineas.filter(l => l.concepto && Number(String(l.precio).replace(',', '.'))).map(l => ({ concepto: l.concepto, cantidad: Number(String(l.cantidad).replace(',', '.')) || 1, precio: Number(String(l.precio).replace(',', '.')), iva_pct: Number(l.iva_pct) })) };
    const r = await rpc('cont_emitir_factura', { p }); setBusy(false);
    if (r.ok) onSaved(r.data);
  };
  return (
    <Modal onClose={onClose} width={980}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, color: BRAND }}>{rectifica ? `Rectificativa de ${rectifica.num_factura}` : 'Nueva factura'}</h2>
      {!emp?.nif && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 10, fontWeight: 700 }}>Falta el NIF de la sociedad: complétalo en la pestaña Empresa.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {!rectifica && <div><label style={lbl}>Tipo</label><select style={inp} value={f.tipo} onChange={e => setF(x => ({ ...x, tipo: e.target.value }))}><option value="F1">Factura completa</option><option value="F2">Simplificada (ticket)</option></select></div>}
        <div><label style={lbl}>Fecha expedición</label><input type="date" style={inp} value={f.fecha} onChange={e => setF(x => ({ ...x, fecha: e.target.value }))} /></div>
        <div><label style={lbl}>Fecha operación (si distinta)</label><input type="date" style={inp} value={f.fecha_operacion || ''} onChange={e => setF(x => ({ ...x, fecha_operacion: e.target.value }))} /></div>
        <div><label style={lbl}>Cuenta de ingreso</label><select style={inp} value={f.cuenta_ingreso} onChange={e => setF(x => ({ ...x, cuenta_ingreso: e.target.value }))}>
          {cuentas.filter(c => c.imputable && /^7[05]/.test(c.codigo)).map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}</select></div>
        {!rectifica && clientes.length > 0 && <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Cliente existente</label><select style={inp} value={f.cliente_cuenta || ''} onChange={e => elegirCliente(e.target.value)}>
          <option value="">— Nuevo cliente —</option>{clientes.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}{c.nif ? ' · ' + c.nif : ''}</option>)}</select></div>}
        <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Cliente (razón social) *</label><input style={inp} value={f.cliente_nombre} onChange={e => setF(x => ({ ...x, cliente_nombre: e.target.value, cliente_cuenta: '' }))} /></div>
        <div><label style={lbl}>NIF cliente {f.tipo !== 'F2' && '*'}</label><input style={inp} value={f.cliente_nif} onChange={e => setF(x => ({ ...x, cliente_nif: e.target.value.toUpperCase() }))} /></div>
        <div><label style={lbl}>Forma de pago</label><input style={inp} value={f.forma_pago} onChange={e => setF(x => ({ ...x, forma_pago: e.target.value }))} /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Dirección cliente</label><input style={inp} value={f.cliente_direccion} onChange={e => setF(x => ({ ...x, cliente_direccion: e.target.value }))} /></div>
        {rectifica && <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Motivo de la rectificación *</label><input style={inp} value={f.motivo_rectificacion} onChange={e => setF(x => ({ ...x, motivo_rectificacion: e.target.value }))} /></div>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead><tr><th style={th}>Concepto</th><th style={{ ...th, width: 90 }}>Cantidad</th><th style={{ ...th, width: 120 }}>Precio</th><th style={{ ...th, width: 90 }}>IVA</th><th style={{ ...th, width: 110, textAlign: 'right' }}>Importe</th><th style={{ ...th, width: 30 }} /></tr></thead>
        <tbody>{f.lineas.map((l, i) => <tr key={i}>
          <td style={td}><input style={inp} value={l.concepto} onChange={e => setL(i, 'concepto', e.target.value)} placeholder="Comisiones energía · octubre 2026" /></td>
          <td style={td}><input style={{ ...inp, textAlign: 'right' }} value={l.cantidad} onChange={e => setL(i, 'cantidad', e.target.value)} /></td>
          <td style={td}><input style={{ ...inp, textAlign: 'right' }} value={l.precio} onChange={e => setL(i, 'precio', e.target.value)} /></td>
          <td style={td}><select style={inp} value={l.iva_pct} onChange={e => setL(i, 'iva_pct', Number(e.target.value))}>{[21, 10, 4, 0].map(p => <option key={p} value={p}>{p}%</option>)}</select></td>
          <td style={num}>{eur((Number(String(l.cantidad).replace(',', '.')) || 0) * (Number(String(l.precio).replace(',', '.')) || 0))}</td>
          <td style={td}>{f.lineas.length > 1 && <button onClick={() => setF(x => ({ ...x, lineas: x.lineas.filter((_, j) => j !== i) }))} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>}</td>
        </tr>)}</tbody>
      </table>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Btn onClick={() => setF(x => ({ ...x, lineas: [...x.lineas, { concepto: '', cantidad: 1, precio: '', iva_pct: 21 }] }))}>+ Línea</Btn>
          <div style={{ marginTop: 10 }}><label style={lbl}>Observaciones</label><textarea rows={2} style={inp} value={f.observaciones} onChange={e => setF(x => ({ ...x, observaciones: e.target.value }))} /></div>
          <div style={{ marginTop: 8, maxWidth: 200 }}><label style={lbl}>Retención IRPF que nos practican (%)</label><input style={inp} value={f.irpf_pct} onChange={e => setF(x => ({ ...x, irpf_pct: e.target.value }))} /></div>
        </div>
        <table style={{ width: 300 }}><tbody>
          {calc.des.map(d => <tr key={d.p}><td style={td}>Base {d.p}% / IVA</td><td style={num}>{eur(d.b)} / {eur(d.c)}</td></tr>)}
          {calc.irpf !== 0 && <tr><td style={td}>Retención IRPF</td><td style={num}>−{eur(calc.irpf)}</td></tr>}
          <tr><td style={{ ...td, fontWeight: 800, fontSize: 15 }}>TOTAL</td><td style={{ ...num, fontWeight: 800, fontSize: 15, color: BRAND }}>{eur(calc.total)} €</td></tr>
        </tbody></table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn kind="pri" disabled={busy || !emp?.nif || !f.cliente_nombre || calc.base === 0} onClick={emitir}>{busy ? 'Emitiendo…' : 'Emitir factura'}</Btn>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>Al emitir se asigna el número correlativo, se calcula la huella encadenada y se genera el asiento (cliente a ingreso + IVA repercutido).</p>
    </Modal>
  );
}

export function FacturasEmitidas({ ejercicio, cuentas, recargar }) {
  const [emp] = useEmpresa();
  const [rows, setRows] = useState([]); const [nueva, setNueva] = useState(null); const [q, setQ] = useState('');
  const cargar = async () => {
    const { data, error } = await supabase.from('cont_facturas_emitidas').select('*').gte('fecha', ejercicio.inicio).lte('fecha', ejercicio.fin).order('serie').order('numero');
    if (error) alert(error.message); setRows(data || []);
  };
  useEffect(() => { cargar(); }, [ejercicio.anio]); // eslint-disable-line
  const cobrar = async f => {
    const fecha = window.prompt(`Fecha de cobro de ${f.num_factura} (AAAA-MM-DD)`, hoyISO()); if (!fecha) return;
    if ((await rpc('cont_cobrar_factura', { p_id: f.id, p_fecha: fecha })).ok) { cargar(); recargar(); }
  };
  const ver = f => imprimirHTML(facturaHTML(f, emp || {}, rows.find(r => r.id === f.rectifica_id)), false);
  const pdf = f => imprimirHTML(facturaHTML(f, emp || {}, rows.find(r => r.id === f.rectifica_id)), true);
  const lista = rows.filter(r => !q || (r.num_factura + r.cliente_nombre + (r.cliente_nif || '')).toLowerCase().includes(q.toLowerCase()));
  const T = lista.reduce((t, r) => ({ b: t.b + Number(r.base), c: t.c + Number(r.cuota_iva), t: t.t + Number(r.total) }), { b: 0, c: 0, t: 0 });
  const pend = rows.filter(r => r.estado === 'emitida' && Number(r.total) > 0).reduce((s, r) => s + Number(r.total), 0);
  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {!ejercicio.cerrado && <Btn kind="pri" onClick={() => setNueva({})}>+ Nueva factura</Btn>}
        <input style={{ ...inp, width: 240 }} placeholder="Buscar nº, cliente, NIF…" value={q} onChange={e => setQ(e.target.value)} />
        <span style={{ fontSize: 13, color: '#64748b' }}>Pendiente de cobro: <b style={{ color: '#b45309' }}>{eur(pend)} €</b></span>
        <div style={{ marginLeft: 'auto' }}><Btn onClick={() => descargarCSV(`facturas_emitidas_${ejercicio.anio}.csv`, [['Nº', 'Fecha', 'Cliente', 'NIF', 'Base', 'IVA', 'IRPF', 'Total', 'Estado'], ...lista.map(r => [r.num_factura, fd(r.fecha), r.cliente_nombre, r.cliente_nif, Number(r.base), Number(r.cuota_iva), Number(r.cuota_irpf), Number(r.total), r.estado])])}>⬇ Excel</Btn></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Nº</th><th style={th}>Fecha</th><th style={th}>Cliente</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>IVA</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}>Estado</th><th style={th} /></tr></thead>
        <tbody>{lista.map(r => <tr key={r.id}>
          <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{r.num_factura}</td><td style={td}>{fd(r.fecha)}</td>
          <td style={td}>{r.cliente_nombre}<div style={{ fontSize: 11, color: '#94a3b8' }}>{r.cliente_nif}</div></td>
          <td style={num}>{eur(r.base)}</td><td style={num}>{eur(r.cuota_iva)}</td><td style={{ ...num, fontWeight: 700 }}>{eur(r.total)}</td>
          <td style={td}>{r.estado === 'cobrada' ? <Badge c="#065f46" bg="#d1fae5">Cobrada {fd(r.fecha_cobro)}</Badge> : r.estado === 'rectificada' ? <Badge c="#7f1d1d" bg="#fee2e2">Rectificada</Badge> : r.tipo === 'R1' ? <Badge c="#5b21b6" bg="#ede9fe">Rectificativa</Badge> : <Badge c="#92400e" bg="#fef3c7">Pendiente</Badge>}</td>
          <td style={{ ...td, whiteSpace: 'nowrap' }}>
            <Btn small onClick={() => ver(r)}>👁</Btn> <Btn small onClick={() => pdf(r)}>PDF</Btn>{' '}
            {r.estado === 'emitida' && Number(r.total) > 0 && <><Btn small kind="ok" onClick={() => cobrar(r)}>Cobrar</Btn>{' '}</>}
            {r.tipo !== 'R1' && r.estado !== 'rectificada' && !ejercicio.cerrado && <Btn small kind="del" onClick={() => setNueva({ rectifica: r })}>Rectificar</Btn>}
          </td></tr>)}
          {lista.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin facturas emitidas en {ejercicio.anio}</td></tr>}
          <tr><td colSpan={3} style={{ ...td, fontWeight: 800, textAlign: 'right' }}>Totales</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.b)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.c)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.t)}</td><td colSpan={2} style={td} /></tr>
        </tbody>
      </table>
      {nueva && <NuevaFactura emp={emp} cuentas={cuentas} rectifica={nueva.rectifica} onClose={() => setNueva(null)} onSaved={() => { setNueva(null); cargar(); recargar(); }} />}
    </Card>
  );
}

// ═════════════════════════ FACTURAS RECIBIDAS ═════════════════════════
function NuevaRecibida({ onClose, onSaved, cuentas }) {
  const [f, setF] = useState({ fecha: hoyISO(), fecha_recepcion: hoyISO(), proveedor_nombre: '', proveedor_nif: '', num_factura: '', concepto: '', cuenta_gasto: '6290000', irpf_pct: 0, desglose: [{ iva_pct: 21, base: '' }] });
  const [busy, setBusy] = useState(false); const [subiendo, setSubiendo] = useState(false);
  const provs = cuentas.filter(c => c.imputable && /^(400|410|523)/.test(c.codigo) && !c.codigo.endsWith('0000'));
  const gastos = cuentas.filter(c => c.imputable && /^(6|2)/.test(c.codigo));
  const base = n2(f.desglose.reduce((s, d) => s + (Number(String(d.base).replace(',', '.')) || 0), 0));
  const cuota = n2(f.desglose.reduce((s, d) => s + n2((Number(String(d.base).replace(',', '.')) || 0) * d.iva_pct / 100), 0));
  const irpf = n2(base * (Number(f.irpf_pct) || 0) / 100);
  const subir = async file => {
    setSubiendo(true);
    const path = `contabilidad/recibidas/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await supabase.storage.from('crm_documentos').upload(path, file);
    setSubiendo(false);
    if (error) return alert('Error subiendo: ' + error.message);
    setF(x => ({ ...x, adjunto_url: path }));
  };
  const guardar = async () => {
    setBusy(true);
    const r = await rpc('cont_registrar_recibida', { p: { ...f, desglose: f.desglose.map(d => ({ iva_pct: d.iva_pct, base: Number(String(d.base).replace(',', '.')) || 0 })) } });
    setBusy(false); if (r.ok) onSaved();
  };
  return (
    <Modal onClose={onClose} width={820}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, color: BRAND }}>Registrar factura recibida / gasto</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {provs.length > 0 && <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Proveedor existente</label><select style={inp} value={f.proveedor_cuenta || ''} onChange={e => { const c = cuentas.find(x => x.codigo === e.target.value); setF(x => ({ ...x, proveedor_cuenta: e.target.value, proveedor_nombre: c?.nombre || '', proveedor_nif: c?.nif || '' })); }}>
          <option value="">— Nuevo proveedor —</option>{provs.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}{c.nif ? ' · ' + c.nif : ''}</option>)}</select></div>}
        <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Proveedor *</label><input style={inp} value={f.proveedor_nombre} onChange={e => setF(x => ({ ...x, proveedor_nombre: e.target.value, proveedor_cuenta: '' }))} /></div>
        <div><label style={lbl}>NIF</label><input style={inp} value={f.proveedor_nif} onChange={e => setF(x => ({ ...x, proveedor_nif: e.target.value.toUpperCase() }))} /></div>
        <div><label style={lbl}>Nº factura proveedor *</label><input style={inp} value={f.num_factura} onChange={e => setF(x => ({ ...x, num_factura: e.target.value }))} /></div>
        <div><label style={lbl}>Fecha factura</label><input type="date" style={inp} value={f.fecha} onChange={e => setF(x => ({ ...x, fecha: e.target.value }))} /></div>
        <div><label style={lbl}>Fecha recepción</label><input type="date" style={inp} value={f.fecha_recepcion} onChange={e => setF(x => ({ ...x, fecha_recepcion: e.target.value }))} /></div>
        <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Cuenta de gasto / inmovilizado</label><select style={inp} value={f.cuenta_gasto} onChange={e => setF(x => ({ ...x, cuenta_gasto: e.target.value }))}>
          {gastos.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}</select></div>
        <div><label style={lbl}>Retención IRPF (%)</label><input style={inp} value={f.irpf_pct} onChange={e => setF(x => ({ ...x, irpf_pct: e.target.value }))} placeholder="15 si es profesional" /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Concepto</label><input style={inp} value={f.concepto} onChange={e => setF(x => ({ ...x, concepto: e.target.value }))} /></div>
      </div>
      <div style={{ marginTop: 12 }}>
        {f.desglose.map((d, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 100px 140px 30px', gap: 8, marginBottom: 6, alignItems: 'end' }}>
          <div><label style={lbl}>Base imponible</label><input style={{ ...inp, textAlign: 'right' }} value={d.base} onChange={e => setF(x => ({ ...x, desglose: x.desglose.map((y, j) => j === i ? { ...y, base: e.target.value } : y) }))} /></div>
          <div><label style={lbl}>IVA</label><select style={inp} value={d.iva_pct} onChange={e => setF(x => ({ ...x, desglose: x.desglose.map((y, j) => j === i ? { ...y, iva_pct: Number(e.target.value) } : y) }))}>{[21, 10, 4, 0].map(p => <option key={p} value={p}>{p}%</option>)}</select></div>
          <div style={{ fontSize: 13, paddingBottom: 8 }}>Cuota: <b>{eur((Number(String(d.base).replace(',', '.')) || 0) * d.iva_pct / 100)}</b></div>
          {f.desglose.length > 1 ? <button onClick={() => setF(x => ({ ...x, desglose: x.desglose.filter((_, j) => j !== i) }))} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, paddingBottom: 8 }}>×</button> : <span />}
        </div>)}
        <Btn small onClick={() => setF(x => ({ ...x, desglose: [...x.desglose, { iva_pct: 10, base: '' }] }))}>+ Otro tipo de IVA</Btn>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ ...lbl, margin: 0, cursor: 'pointer', background: '#eef0f6', padding: '8px 12px', borderRadius: 9 }}>
          📎 {subiendo ? 'Subiendo…' : f.adjunto_url ? 'Adjunto ✓' : 'Adjuntar PDF / foto'}
          <input type="file" accept="application/pdf,image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && subir(e.target.files[0])} />
        </label>
        <div style={{ marginLeft: 'auto', fontSize: 14 }}>Base {eur(base)} + IVA {eur(cuota)}{irpf ? ` − IRPF ${eur(irpf)}` : ''} = <b style={{ color: BRAND, fontSize: 16 }}>{eur(base + cuota - irpf)} €</b></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <Btn onClick={onClose}>Cancelar</Btn><Btn kind="pri" disabled={busy || !f.proveedor_nombre || !f.num_factura || !base} onClick={guardar}>{busy ? 'Guardando…' : 'Registrar'}</Btn>
      </div>
    </Modal>
  );
}

export function FacturasRecibidas({ ejercicio, cuentas, recargar }) {
  const [rows, setRows] = useState([]); const [nueva, setNueva] = useState(false); const [q, setQ] = useState('');
  const cargar = async () => {
    const { data, error } = await supabase.from('cont_facturas_recibidas').select('*').eq('ejercicio', ejercicio.anio).order('registro');
    if (error) alert(error.message); setRows(data || []);
  };
  useEffect(() => { cargar(); }, [ejercicio.anio]); // eslint-disable-line
  const pagar = async f => {
    const fecha = window.prompt(`Fecha de pago de ${f.num_factura} (AAAA-MM-DD)`, hoyISO()); if (!fecha) return;
    if ((await rpc('cont_pagar_recibida', { p_id: f.id, p_fecha: fecha })).ok) { cargar(); recargar(); }
  };
  const borrar = async f => { if (!window.confirm('¿Borrar este registro y su asiento? Solo es posible si es el último asiento.')) return; if ((await rpc('cont_borrar_recibida', { p_id: f.id })).ok) { cargar(); recargar(); } };
  const verAdj = async f => { const { data, error } = await supabase.storage.from('crm_documentos').createSignedUrl(f.adjunto_url, 300); if (error) alert(error.message); else window.open(data.signedUrl, '_blank'); };
  const lista = rows.filter(r => !q || (r.num_factura + r.proveedor_nombre + (r.proveedor_nif || '') + (r.concepto || '')).toLowerCase().includes(q.toLowerCase()));
  const T = lista.reduce((t, r) => ({ b: t.b + Number(r.base), c: t.c + Number(r.cuota_iva), i: t.i + Number(r.cuota_irpf), t: t.t + Number(r.total) }), { b: 0, c: 0, i: 0, t: 0 });
  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {!ejercicio.cerrado && <Btn kind="pri" onClick={() => setNueva(true)}>+ Registrar factura / gasto</Btn>}
        <input style={{ ...inp, width: 240 }} placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
        <div style={{ marginLeft: 'auto' }}><Btn onClick={() => descargarCSV(`facturas_recibidas_${ejercicio.anio}.csv`, [['Reg.', 'Fecha', 'Proveedor', 'NIF', 'Nº factura', 'Cuenta', 'Base', 'IVA', 'IRPF', 'Total', 'Pagada'], ...lista.map(r => [r.registro, fd(r.fecha), r.proveedor_nombre, r.proveedor_nif, r.num_factura, r.cuenta_gasto, Number(r.base), Number(r.cuota_iva), Number(r.cuota_irpf), Number(r.total), r.pagada ? fd(r.fecha_pago) : 'No'])])}>⬇ Excel</Btn></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Reg.</th><th style={th}>Fecha</th><th style={th}>Proveedor</th><th style={th}>Nº fra.</th><th style={{ ...th, textAlign: 'right' }}>Base</th><th style={{ ...th, textAlign: 'right' }}>IVA</th><th style={{ ...th, textAlign: 'right' }}>IRPF</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}>Estado</th><th style={th} /></tr></thead>
        <tbody>{lista.map(r => <tr key={r.id}>
          <td style={{ ...td, fontWeight: 700 }}>{r.registro}</td><td style={td}>{fd(r.fecha)}</td>
          <td style={td}>{r.proveedor_nombre}<div style={{ fontSize: 11, color: '#94a3b8' }}>{r.cuenta_gasto} · {r.concepto}</div></td><td style={td}>{r.num_factura}</td>
          <td style={num}>{eur(r.base)}</td><td style={num}>{eur(r.cuota_iva)}</td><td style={num}>{Number(r.cuota_irpf) ? eur(r.cuota_irpf) : ''}</td><td style={{ ...num, fontWeight: 700 }}>{eur(r.total)}</td>
          <td style={td}>{r.pagada ? <Badge c="#065f46" bg="#d1fae5">Pagada {fd(r.fecha_pago)}</Badge> : <Badge c="#92400e" bg="#fef3c7">Pendiente</Badge>}</td>
          <td style={{ ...td, whiteSpace: 'nowrap' }}>
            {r.adjunto_url && <><Btn small onClick={() => verAdj(r)}>📎</Btn>{' '}</>}
            {!r.pagada && <><Btn small kind="ok" onClick={() => pagar(r)}>Pagar</Btn>{' '}</>}
            {!r.pagada && !ejercicio.cerrado && <Btn small kind="del" onClick={() => borrar(r)}>🗑</Btn>}
          </td></tr>)}
          {lista.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin facturas recibidas en {ejercicio.anio}</td></tr>}
          <tr><td colSpan={4} style={{ ...td, fontWeight: 800, textAlign: 'right' }}>Totales</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.b)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.c)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.i)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.t)}</td><td colSpan={2} style={td} /></tr>
        </tbody>
      </table>
      {nueva && <NuevaRecibida cuentas={cuentas} onClose={() => setNueva(false)} onSaved={() => { setNueva(false); cargar(); recargar(); }} />}
    </Card>
  );
}

// ═════════════════════════ IVA E IMPUESTOS ═════════════════════════
export function Impuestos({ ejercicio, asientos }) {
  const [em, setEm] = useState([]); const [re, setRe] = useState([]);
  const [per, setPer] = useState(() => { const y = new Date().getFullYear(); return y === ejercicio.anio ? trimDe(hoyISO()) : 1; });
  const [vista, setVista] = useState('303');
  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from('cont_facturas_emitidas').select('*').gte('fecha', ejercicio.inicio).lte('fecha', ejercicio.fin).order('fecha'),
        supabase.from('cont_facturas_recibidas').select('*').eq('ejercicio', ejercicio.anio).order('registro'),
      ]);
      setEm(a.data || []); setRe(b.data || []);
    })();
  }, [ejercicio.anio]); // eslint-disable-line
  const [desde, hasta] = per === 0 ? [ejercicio.inicio, ejercicio.fin] : rangoTrim(ejercicio.anio, per);
  const emP = em.filter(f => f.fecha >= desde && f.fecha <= hasta);
  const reP = re.filter(f => f.fecha >= desde && f.fecha <= hasta);
  const sumT = (fs, pct) => fs.reduce((t, f) => { (f.desglose || []).filter(d => Number(d.iva_pct) === pct).forEach(d => { t.b += Number(d.base); t.c += Number(d.cuota); }); return t; }, { b: 0, c: 0 });
  const dev = { 4: sumT(emP, 4), 10: sumT(emP, 10), 21: sumT(emP, 21) };
  const totDev = n2(dev[4].c + dev[10].c + dev[21].c);
  const corr = reP.filter(f => !f.bien_inversion), inv = reP.filter(f => f.bien_inversion);
  const ded = { b: n2(corr.reduce((s, f) => s + Number(f.base), 0)), c: n2(corr.reduce((s, f) => s + Number(f.cuota_iva), 0)) };
  const dedI = { b: n2(inv.reduce((s, f) => s + Number(f.base), 0)), c: n2(inv.reduce((s, f) => s + Number(f.cuota_iva), 0)) };
  const totDed = n2(ded.c + dedI.c), res = n2(totDev - totDed);
  const ret = reP.filter(f => Number(f.cuota_irpf));
  const perc = new Set(ret.map(f => f.proveedor_nif || f.proveedor_nombre));
  const regIva = asientos.filter(a => a.origen === 'reg_iva').map(a => Number(a.origen_id));
  const regularizar = async () => { if ((await rpc('cont_regularizar_iva', { p_anio: ejercicio.anio, p_trim: per })).ok) window.location.reload(); };
  const deshacer = async () => { if (window.confirm('¿Deshacer la regularización de IVA del trimestre?') && (await rpc('cont_deshacer_reg_iva', { p_anio: ejercicio.anio, p_trim: per })).ok) window.location.reload(); };
  // 347: anual > 3.005,06 €
  const m347 = useMemo(() => {
    const m = {};
    em.forEach(f => { const k = 'C|' + (f.cliente_nif || f.cliente_nombre); m[k] = m[k] || { tipo: 'Cliente (B)', nombre: f.cliente_nombre, nif: f.cliente_nif, t: 0, q: [0, 0, 0, 0] }; m[k].t += Number(f.base) + Number(f.cuota_iva); m[k].q[trimDe(f.fecha) - 1] += Number(f.base) + Number(f.cuota_iva); });
    re.forEach(f => { const k = 'P|' + (f.proveedor_nif || f.proveedor_nombre); m[k] = m[k] || { tipo: 'Proveedor (A)', nombre: f.proveedor_nombre, nif: f.proveedor_nif, t: 0, q: [0, 0, 0, 0] }; m[k].t += Number(f.base) + Number(f.cuota_iva); m[k].q[trimDe(f.fecha) - 1] += Number(f.base) + Number(f.cuota_iva); });
    return Object.values(m).filter(x => x.t > 3005.06).sort((a, b) => b.t - a.t);
  }, [em, re]);
  const Cas = ({ n, t, v, b }) => <tr><td style={{ ...td, width: 50, fontFamily: 'monospace', color: '#64748b' }}>[{n}]</td><td style={{ ...td, fontWeight: b ? 800 : 400 }}>{t}</td><td style={{ ...num, fontWeight: b ? 800 : 600 }}>{eur(v)}</td></tr>;
  const LIBROS = (
    <>
      <h4 style={{ margin: '0 0 6px' }}>Libro registro de facturas expedidas</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead><tr>{['Nº', 'Fecha exp.', 'Destinatario', 'NIF', 'Base', '% IVA', 'Cuota', 'Total'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{emP.flatMap(f => (f.desglose || []).map((d, i) => <tr key={f.id + i}><td style={td}>{i === 0 ? f.num_factura : ''}</td><td style={td}>{i === 0 ? fd(f.fecha) : ''}</td><td style={td}>{i === 0 ? f.cliente_nombre : ''}</td><td style={td}>{i === 0 ? f.cliente_nif : ''}</td><td style={num}>{eur(d.base)}</td><td style={num}>{d.iva_pct}%</td><td style={num}>{eur(d.cuota)}</td><td style={num}>{i === 0 ? eur(f.total) : ''}</td></tr>))}</tbody>
      </table>
      <h4 style={{ margin: '0 0 6px' }}>Libro registro de facturas recibidas</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Reg.', 'Fecha', 'Proveedor', 'NIF', 'Nº fra.', 'Base', '% IVA', 'Cuota deducible', 'Total'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{reP.flatMap(f => (f.desglose || []).map((d, i) => <tr key={f.id + i}><td style={td}>{i === 0 ? f.registro : ''}</td><td style={td}>{i === 0 ? fd(f.fecha) : ''}</td><td style={td}>{i === 0 ? f.proveedor_nombre : ''}</td><td style={td}>{i === 0 ? f.proveedor_nif : ''}</td><td style={td}>{i === 0 ? f.num_factura : ''}</td><td style={num}>{eur(d.base)}</td><td style={num}>{d.iva_pct}%</td><td style={num}>{eur(d.cuota)}</td><td style={num}>{i === 0 ? eur(f.total) : ''}</td></tr>))}</tbody>
      </table>
    </>
  );
  const exportLibros = () => descargarCSV(`libros_IVA_${ejercicio.anio}_${per ? per + 'T' : 'anual'}.csv`, [
    ['EXPEDIDAS'], ['Nº', 'Fecha', 'Destinatario', 'NIF', 'Base', '% IVA', 'Cuota', 'Total'],
    ...emP.flatMap(f => f.desglose.map(d => [f.num_factura, fd(f.fecha), f.cliente_nombre, f.cliente_nif, Number(d.base), d.iva_pct, Number(d.cuota), Number(f.total)])),
    [], ['RECIBIDAS'], ['Reg.', 'Fecha', 'Proveedor', 'NIF', 'Nº fra.', 'Base', '% IVA', 'Cuota', 'Total'],
    ...reP.flatMap(f => f.desglose.map(d => [f.registro, fd(f.fecha), f.proveedor_nombre, f.proveedor_nif, f.num_factura, Number(d.base), d.iva_pct, Number(d.cuota), Number(f.total)])),
  ]);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[1, 2, 3, 4].map(t => <Btn key={t} kind={per === t ? 'pri' : 'sec'} onClick={() => setPer(t)}>{t}T{regIva.includes(t) ? ' ✓' : ''}</Btn>)}
        <Btn kind={per === 0 ? 'pri' : 'sec'} onClick={() => setPer(0)}>Anual</Btn>
        <span style={{ width: 16 }} />
        {[['303', per ? 'IVA trimestral (303)' : 'Resumen anual IVA (390)'], ['111', 'Retenciones (111/190)'], ['libros', 'Libros registro'], ['347', 'Operaciones con terceros (347)']].map(([k, l]) => <Btn key={k} kind={vista === k ? 'pri' : 'sec'} onClick={() => setVista(k)}>{l}</Btn>)}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}><Btn onClick={exportLibros}>⬇ Libros Excel</Btn><Btn onClick={() => window.print()}>🖨 PDF</Btn></div>
      </div>
      <div className="only-print" style={{ fontWeight: 800, fontSize: 16 }}>{vista === 'libros' ? 'Libros registro de IVA' : vista === '111' ? 'Retenciones' : vista === '347' ? 'Operaciones con terceros' : per ? 'IVA trimestral' : 'Resumen anual IVA'} · {ejercicio.anio} {per ? per + 'T' : ''} ({fd(desde)} – {fd(hasta)})</div>
      {vista === '303' && <Card style={{ maxWidth: 760 }}>
        <h3 style={{ margin: '0 0 4px', color: BRAND }}>{per ? `Modelo 303 · ${per}T ${ejercicio.anio}` : `Resumen anual IVA (390) · ${ejercicio.anio}`}</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>Calculado desde las facturas registradas. Comprueba las casillas en el formulario de la AEAT antes de presentar.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          <tr><td colSpan={3} style={{ ...td, fontWeight: 800, background: '#f8fafc' }}>IVA devengado · Régimen general</td></tr>
          <Cas n="01" t="Base imponible 4%" v={dev[4].b} /><Cas n="03" t="Cuota 4%" v={dev[4].c} />
          <Cas n="04" t="Base imponible 10%" v={dev[10].b} /><Cas n="06" t="Cuota 10%" v={dev[10].c} />
          <Cas n="07" t="Base imponible 21%" v={dev[21].b} /><Cas n="09" t="Cuota 21%" v={dev[21].c} />
          <Cas n="27" t="Total cuota devengada" v={totDev} b />
          <tr><td colSpan={3} style={{ ...td, fontWeight: 800, background: '#f8fafc' }}>IVA deducible</td></tr>
          <Cas n="28" t="Operaciones interiores corrientes · base" v={ded.b} /><Cas n="29" t="Operaciones interiores corrientes · cuota" v={ded.c} />
          <Cas n="30" t="Bienes de inversión · base" v={dedI.b} /><Cas n="31" t="Bienes de inversión · cuota" v={dedI.c} />
          <Cas n="45" t="Total a deducir" v={totDed} b />
          <Cas n="46" t="Resultado régimen general (27 − 45)" v={res} b />
          <tr><td colSpan={3} style={{ ...td, padding: 14, textAlign: 'center', fontSize: 16, fontWeight: 800, color: res > 0 ? '#b91c1c' : '#059669' }}>
            {res > 0 ? `A ingresar: ${eur(res)} €` : res < 0 ? (per === 4 || per === 0 ? `A compensar o devolver: ${eur(-res)} €` : `A compensar en próximos periodos: ${eur(-res)} €`) : 'Sin actividad / resultado cero'}
          </td></tr>
        </tbody></table>
        {per > 0 && !ejercicio.cerrado && <div className="no-print" style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          {regIva.includes(per) ? <><span style={{ color: '#059669', fontWeight: 700 }}>✓ Regularización contable hecha</span><Btn small kind="del" onClick={deshacer}>Deshacer</Btn></> :
            <Btn kind="pri" onClick={regularizar}>Contabilizar regularización de IVA del {per}T</Btn>}
          <span style={{ fontSize: 12, color: '#64748b' }}>Lleva 472/477 a 4750 (a ingresar) o 4700 (a compensar).</span>
        </div>}
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>Plazo: del 1 al 20 de abril, julio y octubre, y del 1 al 30 de enero para el 4T (con el 390).</p>
      </Card>}
      {vista === '111' && <Card style={{ maxWidth: 760 }}>
        <h3 style={{ margin: '0 0 10px', color: BRAND }}>Retenciones practicadas · {per ? `Modelo 111 · ${per}T` : 'Resumen anual (190)'}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          <tr><td colSpan={3} style={{ ...td, fontWeight: 800, background: '#f8fafc' }}>Rendimientos de actividades económicas (profesionales)</td></tr>
          <Cas n="07" t="Nº de perceptores" v={perc.size} /><Cas n="08" t="Importe de las percepciones" v={n2(ret.reduce((s, f) => s + Number(f.base), 0))} />
          <Cas n="09" t="Importe de las retenciones" v={n2(ret.reduce((s, f) => s + Number(f.cuota_irpf), 0))} />
          <Cas n="28" t="Total a ingresar" v={n2(ret.reduce((s, f) => s + Number(f.cuota_irpf), 0))} b />
        </tbody></table>
        {ret.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}><thead><tr>{['Fecha', 'Perceptor', 'NIF', 'Base', '%', 'Retención'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{ret.map(f => <tr key={f.id}><td style={td}>{fd(f.fecha)}</td><td style={td}>{f.proveedor_nombre}</td><td style={td}>{f.proveedor_nif}</td><td style={num}>{eur(f.base)}</td><td style={num}>{f.irpf_pct}%</td><td style={num}>{eur(f.cuota_irpf)}</td></tr>)}</tbody></table>}
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>Si no hay retenciones en el trimestre, no hace falta presentar el 111. Nóminas y alquileres (115) se añadirán cuando los haya.</p>
      </Card>}
      {vista === 'libros' && <Card>{LIBROS}</Card>}
      {vista === '347' && <Card>
        <h3 style={{ margin: '0 0 4px', color: BRAND }}>Declaración anual de operaciones con terceros (347) · {ejercicio.anio}</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>Clientes y proveedores con operaciones superiores a 3.005,06 € (IVA incluido) en el año. Se presenta en febrero.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Clave', 'Nombre', 'NIF', '1T', '2T', '3T', '4T', 'Total anual'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{m347.map((x, i) => <tr key={i}><td style={td}>{x.tipo}</td><td style={td}>{x.nombre}</td><td style={td}>{x.nif || <span style={{ color: '#dc2626' }}>Falta NIF</span>}</td>{x.q.map((v, j) => <td key={j} style={num}>{eur(v)}</td>)}<td style={{ ...num, fontWeight: 800 }}>{eur(x.t)}</td></tr>)}
            {m347.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 20 }}>Nadie supera el límite este año</td></tr>}</tbody></table>
      </Card>}
    </div>
  );
}

// ═════════════════════════ INMOVILIZADO ═════════════════════════
const TABLAS = [['Equipos informáticos', '217', 25], ['Aplicaciones informáticas', '206', 33], ['Mobiliario', '216', 10], ['Otras instalaciones', '215', 10], ['Elementos de transporte', '218', 16], ['Construcciones', '211', 3]];
export function Inmovilizado({ ejercicio, cuentas, recargar }) {
  const [rows, setRows] = useState([]); const [amort, setAmort] = useState([]); const [form, setForm] = useState(null);
  const cargar = async () => {
    const [a, b] = await Promise.all([supabase.from('cont_inmovilizado').select('*').order('fecha_alta'), supabase.from('cont_amortizaciones').select('*')]);
    setRows(a.data || []); setAmort(b.data || []);
  };
  useEffect(() => { cargar(); }, []);
  const acum = id => n2(amort.filter(x => x.inmovilizado_id === id && x.ejercicio <= ejercicio.anio).reduce((s, x) => s + Number(x.importe), 0));
  const ensure = async (cod, nombre) => { if (!cuentas.some(c => c.codigo === cod)) await supabase.from('cont_cuentas').insert({ codigo: cod, nombre, imputable: true }); };
  const guardar = async () => {
    const t = TABLAS.find(x => x[1] === form.grupo);
    const ca = form.grupo + '0000', cm = (form.grupo.startsWith('20') ? '280' : '281') + form.grupo.slice(1) + '000', cg = form.grupo.startsWith('20') ? '6800000' : '6810000';
    await ensure(ca, t[0]); await ensure(cm, 'Amort. acum. ' + t[0].toLowerCase()); await ensure(cg, form.grupo.startsWith('20') ? 'Amortización del inmovilizado intangible' : 'Amortización del inmovilizado material');
    const { error } = await supabase.from('cont_inmovilizado').insert({ descripcion: form.descripcion, cuenta_activo: ca, cuenta_amort: cm, cuenta_gasto: cg, fecha_alta: form.fecha_alta, valor: Number(String(form.valor).replace(',', '.')), pct_anual: Number(form.pct), valor_residual: 0 });
    if (error) return alert(error.message);
    setForm(null); cargar(); recargar();
  };
  const hecho = amort.some(x => x.ejercicio === ejercicio.anio);
  const amortizar = async () => { if ((await rpc('cont_amortizar', { p_anio: ejercicio.anio })).ok) { cargar(); recargar(); } };
  const deshacer = async () => { if (window.confirm('¿Borrar el asiento de amortización del ejercicio?') && (await rpc('cont_deshacer_amortizacion', { p_anio: ejercicio.anio })).ok) { cargar(); recargar(); } };
  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn kind="pri" onClick={() => setForm({ descripcion: '', grupo: '217', fecha_alta: hoyISO(), valor: '', pct: 25 })}>+ Alta de bien</Btn>
        {!ejercicio.cerrado && (hecho ? <><span style={{ color: '#059669', fontWeight: 700 }}>✓ Amortización {ejercicio.anio} contabilizada</span><Btn small kind="del" onClick={deshacer}>Deshacer</Btn></> : <Btn kind="ok" onClick={amortizar} disabled={!rows.length}>Contabilizar amortización {ejercicio.anio}</Btn>)}
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>Registra la compra como factura recibida en la cuenta 2xx y da aquí de alta el bien para calcular su amortización (prorrateada por días el primer año).</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Bien', 'Cuenta', 'Alta', 'Valor', '% anual', 'Amort. acumulada', 'Valor neto'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}><td style={td}>{r.descripcion}</td><td style={{ ...td, fontFamily: 'monospace' }}>{r.cuenta_activo}</td><td style={td}>{fd(r.fecha_alta)}</td>
          <td style={num}>{eur(r.valor)}</td><td style={num}>{r.pct_anual}%</td><td style={num}>{eur(acum(r.id))}</td><td style={{ ...num, fontWeight: 700 }}>{eur(Number(r.valor) - acum(r.id))}</td></tr>)}
          {rows.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 20 }}>Sin bienes de inversión</td></tr>}</tbody>
      </table>
      {form && <Modal onClose={() => setForm(null)} width={560}>
        <h3 style={{ margin: '0 0 12px', color: BRAND }}>Alta de inmovilizado</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Descripción</label><input style={inp} value={form.descripcion} onChange={e => setForm(x => ({ ...x, descripcion: e.target.value }))} placeholder="Portátil MacBook" /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Tipo (coeficiente máximo tablas IS)</label><select style={inp} value={form.grupo} onChange={e => { const t = TABLAS.find(x => x[1] === e.target.value); setForm(x => ({ ...x, grupo: t[1], pct: t[2] })); }}>
            {TABLAS.map(t => <option key={t[1]} value={t[1]}>{t[1]} · {t[0]} (máx. {t[2]}%)</option>)}</select></div>
          <div><label style={lbl}>Fecha de puesta en funcionamiento</label><input type="date" style={inp} value={form.fecha_alta} onChange={e => setForm(x => ({ ...x, fecha_alta: e.target.value }))} /></div>
          <div><label style={lbl}>Valor de adquisición (sin IVA)</label><input style={inp} value={form.valor} onChange={e => setForm(x => ({ ...x, valor: e.target.value }))} /></div>
          <div><label style={lbl}>% amortización anual</label><input style={inp} value={form.pct} onChange={e => setForm(x => ({ ...x, pct: e.target.value }))} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}><Btn onClick={() => setForm(null)}>Cancelar</Btn><Btn kind="pri" disabled={!form.descripcion || !form.valor} onClick={guardar}>Dar de alta</Btn></div>
      </Modal>}
    </Card>
  );
}

// ═════════════════════════ ASISTENTE DE CIERRE ═════════════════════════
export function Cierre({ ejercicio, asientos, recargar }) {
  const tiene = (pred) => asientos.some(pred);
  const ivaHechos = [1, 2, 3, 4].map(t => tiene(a => a.origen === 'reg_iva' && Number(a.origen_id) === t));
  const amortHecha = tiene(a => a.origen === 'amort');
  const regHecha = tiene(a => a.tipo === 'regularizacion');
  const cierreHecho = tiene(a => a.tipo === 'cierre');
  const resultado = n2(-asientos.filter(a => a.tipo !== 'regularizacion' && a.tipo !== 'cierre').reduce((s, a) => s + a.lineas.filter(l => /^[67]/.test(l.cuenta)).reduce((x, l) => x + l.debe - l.haber, 0), 0));
  const go = async (fn, args, msg) => { if (msg && !window.confirm(msg)) return; if ((await rpc(fn, args)).ok) recargar(); };
  const Paso = ({ n, t, d, hecho, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12, padding: '14px 0', borderTop: '1px solid #f1f5f9', alignItems: 'center' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50% 50% 50% 0', background: hecho ? '#10b981' : '#eef0f6', color: hecho ? 'white' : '#334', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{hecho ? '✓' : n}</div>
      <div><div style={{ fontWeight: 800 }}>{t}</div><div style={{ fontSize: 12, color: '#64748b' }}>{d}</div></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
  return (
    <Card style={{ maxWidth: 900 }}>
      <h3 style={{ margin: '0 0 4px', color: BRAND }}>Cierre del ejercicio {ejercicio.anio}</h3>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px' }}>Resultado provisional antes de impuestos: <b style={{ color: resultado >= 0 ? '#059669' : '#b91c1c' }}>{eur(resultado)} €</b>{resultado > 0 && <> · Reserva legal mínima (20%, capital &lt; 3.000 €): <b>{eur(resultado * .2)} €</b></>}</p>
      <Paso n={1} t="Regularización de IVA de cada trimestre" d="Se hace desde la pestaña Impuestos, trimestre a trimestre." hecho={ivaHechos.every(Boolean)}>
        {ivaHechos.map((h, i) => <span key={i} style={{ fontSize: 12, fontWeight: 700, color: h ? '#059669' : '#94a3b8' }}>{i + 1}T{h ? '✓' : '·'}</span>)}
      </Paso>
      <Paso n={2} t="Amortizaciones" d="Se calculan con los bienes de la pestaña Inmovilizado." hecho={amortHecha}>
        {!ejercicio.cerrado && !amortHecha && <Btn small onClick={() => go('cont_amortizar', { p_anio: ejercicio.anio })}>Contabilizar</Btn>}
        {!ejercicio.cerrado && amortHecha && <Btn small kind="del" onClick={() => go('cont_deshacer_amortizacion', { p_anio: ejercicio.anio }, '¿Deshacer amortización?')}>Deshacer</Btn>}
      </Paso>
      <Paso n={3} t="Impuesto de Sociedades" d="Introduce el gasto por impuesto (6300000 a 4752000) con un asiento manual una vez calculado. Las pymes de nueva creación tributan al 15% los dos primeros ejercicios con base positiva." hecho={tiene(a => a.lineas.some(l => l.cuenta.startsWith('630')))} />
      <Paso n={4} t="Regularización de resultados" d="Salda todas las cuentas de los grupos 6 y 7 contra la 129 (Resultado del ejercicio)." hecho={regHecha}>
        {!ejercicio.cerrado && !regHecha && <Btn small kind="pri" onClick={() => go('cont_regularizar_resultados', { p_anio: ejercicio.anio }, 'Se creará el asiento de regularización a 31/12. ¿Continuar?')}>Regularizar</Btn>}
        {!ejercicio.cerrado && regHecha && !cierreHecho && <Btn small kind="del" onClick={() => go('cont_deshacer_regularizacion', { p_anio: ejercicio.anio }, '¿Deshacer la regularización?')}>Deshacer</Btn>}
      </Paso>
      <Paso n={5} t={`Cierre y apertura de ${ejercicio.anio + 1}`} d="Crea el asiento de cierre, bloquea el ejercicio y genera el asiento de apertura del siguiente." hecho={cierreHecho}>
        {!cierreHecho && <Btn small kind="pri" disabled={!regHecha} onClick={() => go('cont_cerrar_y_abrir', { p_anio: ejercicio.anio }, `Se cerrará ${ejercicio.anio} y ya no se podrán modificar asientos. ¿Continuar?`)}>Cerrar ejercicio</Btn>}
        {cierreHecho && <Btn small kind="del" onClick={() => go('cont_deshacer_cierre', { p_anio: ejercicio.anio }, `Se borrarán el asiento de cierre y la apertura de ${ejercicio.anio + 1} y se reabrirá el ejercicio. ¿Continuar?`)}>Reabrir</Btn>}
      </Paso>
      <Paso n={6} t="Legalización de libros y depósito de cuentas" d="Exporta en PDF el Diario y el Balance/PyG. Legalización en el Registro Mercantil (Legalia2) en los 4 meses siguientes al cierre; aplicación del resultado en la junta antes del 30/06 y depósito (D2) en el mes siguiente." />
    </Card>
  );
}
