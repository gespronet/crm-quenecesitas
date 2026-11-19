import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#00208F';
const n2 = v => Math.round((Number(v) || 0) * 100) / 100;
const eur = v => (Number(v) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fd = d => d ? d.split('-').reverse().join('/') : '';
const hoyISO = () => new Date().toISOString().slice(0, 10);
const descargarCSV = (nombre, filas) => {
  const csv = '﻿' + filas.map(r => r.map(c => {
    const s = c == null ? '' : typeof c === 'number' ? c.toFixed(2).replace('.', ',') : String(c);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = nombre; a.click();
};

// ── Estructura simplificada de cuentas anuales PYME ────────────────────────
const PYG = [
  { k: '1', t: '1. Importe neto de la cifra de negocios', p: ['70'], s: -1 },
  { k: '4', t: '4. Aprovisionamientos', p: ['60', '61'], s: -1 },
  { k: '5', t: '5. Otros ingresos de explotación', p: ['74', '75'], s: -1 },
  { k: '6', t: '6. Gastos de personal', p: ['64'], s: -1 },
  { k: '7', t: '7. Otros gastos de explotación', p: ['62', '631', '634', '636', '639', '65', '694', '695', '794', '7954'], s: -1 },
  { k: '8', t: '8. Amortización del inmovilizado', p: ['68'], s: -1 },
  { k: '11', t: '11. Deterioro y resultado por enajenaciones del inmovilizado', p: ['670', '671', '672', '690', '691', '692', '770', '771', '772', '790', '791', '792'], s: -1 },
  { k: '12', t: '12. Otros resultados', p: ['678', '778'], s: -1 },
  { k: 'A', t: 'A) RESULTADO DE EXPLOTACIÓN', sum: ['1', '4', '5', '6', '7', '8', '11', '12'], b: true },
  { k: '13', t: '13. Ingresos financieros', p: ['76'], s: -1 },
  { k: '14', t: '14. Gastos financieros', p: ['66'], s: -1 },
  { k: 'B', t: 'B) RESULTADO FINANCIERO', sum: ['13', '14'], b: true },
  { k: 'C', t: 'C) RESULTADO ANTES DE IMPUESTOS', sum: ['A', 'B'], b: true },
  { k: '19', t: '19. Impuestos sobre beneficios', p: ['630', '633', '638'], s: -1 },
  { k: 'D', t: 'D) RESULTADO DEL EJERCICIO', sum: ['C', '19'], b: true },
];
const claseDe = c => c[0];
const empieza = (c, ps) => ps.some(p => c.startsWith(p));

function calcPyG(saldos) {
  const v = {};
  PYG.forEach(l => {
    if (l.sum) v[l.k] = n2(l.sum.reduce((a, k) => a + (v[k] || 0), 0));
    else v[l.k] = n2(Object.entries(saldos).filter(([c]) => ['6', '7'].includes(claseDe(c)) && empieza(c, l.p)).reduce((a, [, s]) => a + s * l.s, 0));
  });
  return v;
}

function calcBalance(saldos, resultado) {
  const A = { anc: [], ac: [] }, P = { pn: [], pnc: [], pc: [] };
  Object.entries(saldos).forEach(([c, s]) => {
    if (!s || ['6', '7', '8', '9'].includes(claseDe(c))) return;
    if (c.startsWith('129')) return; // se presenta con el resultado
    const fila = { c, s };
    if (claseDe(c) === '1') {
      if (empieza(c, ['10', '11', '12', '13'])) P.pn.push({ c, s: -s }); else P.pnc.push({ c, s: -s });
    } else if (claseDe(c) === '2') A.anc.push(fila);
    else if (claseDe(c) === '3') A.ac.push(fila);
    else if (s > 0) A.ac.push(fila); // 4 y 5 deudores
    else P.pc.push({ c, s: -s });
  });
  const tot = arr => n2(arr.reduce((a, x) => a + x.s, 0));
  const r129 = n2(-(saldos['1290000'] || 0) - 0) + 0;
  const res = n2(resultado + r129);
  return { A, P, tANC: tot(A.anc), tAC: tot(A.ac), tPN: n2(tot(P.pn) + res), tPNC: tot(P.pnc), tPC: tot(P.pc), res };
}

// ── Componentes UI ────────────────────────────────────────────────────────
const inp = { padding: '7px 9px', border: '1px solid #dde1ea', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', width: '100%' };
const th = { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#64748b', fontWeight: 700, background: '#f8fafc', position: 'sticky', top: 0 };
const td = { padding: '6px 10px', borderTop: '1px solid #f1f5f9', fontSize: 13 };
const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const Card = ({ children, style }) => <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 16, ...style }}>{children}</div>;
const Btn = ({ children, onClick, kind = 'sec', disabled, title }) => (
  <button title={title} disabled={disabled} onClick={onClick} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, opacity: disabled ? .5 : 1,
    background: kind === 'pri' ? BRAND : kind === 'ok' ? '#10b981' : kind === 'del' ? '#fee2e2' : '#eef0f6', color: kind === 'pri' || kind === 'ok' ? 'white' : kind === 'del' ? '#991b1b' : '#334' }}>{children}</button>
);

function CuentaInput({ value, onChange, cuentas, autoFocus, onEnter }) {
  const [q, setQ] = useState(value || '');
  const [open, setOpen] = useState(false);
  useEffect(() => setQ(value || ''), [value]);
  const imput = cuentas.filter(c => c.imputable && c.activa);
  const ops = useMemo(() => {
    const t = q.trim().toLowerCase(); if (!t) return imput.slice(0, 12);
    // atajo tipo "572.1" → 5720001
    return imput.filter(c => c.codigo.startsWith(t) || c.nombre.toLowerCase().includes(t)).slice(0, 12);
  }, [q, imput]);
  const expand = t => {
    const m = t.match(/^(\d+)\.(\d+)$/); if (!m) return t;
    return m[1] + '0'.repeat(Math.max(0, 7 - m[1].length - m[2].length)) + m[2];
  };
  const elegir = c => { setQ(c.codigo); onChange(c.codigo); setOpen(false); };
  const nombre = cuentas.find(c => c.codigo === value)?.nombre;
  return (
    <div style={{ position: 'relative' }}>
      <input autoFocus={autoFocus} style={{ ...inp, fontFamily: 'monospace' }} value={q} placeholder="572.1 o nombre"
        onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            const ex = expand(q.trim()); const exact = imput.find(c => c.codigo === ex);
            if (exact) { elegir(exact); } else if (ops[0] && open && e.key === 'Enter') { elegir(ops[0]); }
            if (e.key === 'Enter') { e.preventDefault(); onEnter && onEnter(); }
          }
        }} />
      {nombre && !open && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</div>}
      {open && ops.length > 0 && <div style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, minWidth: 320, background: 'white', border: '1px solid #dde1ea', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,.12)', maxHeight: 260, overflowY: 'auto' }}>
        {ops.map(c => <div key={c.codigo} onMouseDown={() => elegir(c)} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 13 }} onMouseEnter={e => e.currentTarget.style.background = '#eef2ff'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
          <b style={{ fontFamily: 'monospace' }}>{c.codigo}</b> · {c.nombre}</div>)}
      </div>}
    </div>
  );
}

function EditorAsiento({ asiento, cuentas, ejercicio, onClose, onSaved, cerrado }) {
  const nuevo = !asiento?.id;
  const [fecha, setFecha] = useState(asiento?.fecha || (hoyISO() <= ejercicio.fin && hoyISO() >= ejercicio.inicio ? hoyISO() : ejercicio.fin));
  const [concepto, setConcepto] = useState(asiento?.concepto || '');
  const [lineas, setLineas] = useState(asiento?.lineas?.length ? asiento.lineas.map(l => ({ ...l, debe: l.debe || '', haber: l.haber || '' })) : [{ cuenta: '', debe: '', haber: '', concepto: '' }, { cuenta: '', debe: '', haber: '', concepto: '' }]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const td_ = n2(lineas.reduce((a, l) => a + (Number(String(l.debe).replace(',', '.')) || 0), 0));
  const th_ = n2(lineas.reduce((a, l) => a + (Number(String(l.haber).replace(',', '.')) || 0), 0));
  const dif = n2(td_ - th_);
  const set = (i, k, v) => setLineas(ls => ls.map((l, j) => j === i ? { ...l, [k]: v, ...(k === 'debe' && v ? { haber: '' } : {}), ...(k === 'haber' && v ? { debe: '' } : {}) } : l));
  const add = () => setLineas(ls => {
    const nl = { cuenta: '', debe: dif < 0 ? String(-dif) : '', haber: dif > 0 ? String(dif) : '', concepto: '' };
    return [...ls, nl];
  });
  const guardar = async () => {
    setErr('');
    const ls = lineas.filter(l => l.cuenta && (Number(String(l.debe).replace(',', '.')) || Number(String(l.haber).replace(',', '.'))))
      .map(l => ({ cuenta: l.cuenta, debe: n2(String(l.debe).replace(',', '.')), haber: n2(String(l.haber).replace(',', '.')), concepto: l.concepto }));
    if (dif !== 0) return setErr(`Descuadre de ${eur(dif)} €`);
    setBusy(true);
    const { error } = await supabase.rpc('cont_guardar_asiento', { p: { id: asiento?.id || null, fecha, concepto, lineas: ls } });
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  };
  useEffect(() => {
    const h = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') guardar(); if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,51,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 12px', overflowY: 'auto' }}>
      <Card style={{ width: 'min(960px,100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: BRAND }}>{nuevo ? 'Nuevo asiento' : `Asiento nº ${asiento.numero}`}</h2>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Ctrl+Enter guarda · Esc cierra · "572.1" = 5720001</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Fecha</label><input type="date" style={inp} value={fecha} min={ejercicio.inicio} max={ejercicio.fin} onChange={e => setFecha(e.target.value)} disabled={cerrado} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>Concepto</label><input autoFocus={nuevo} style={inp} value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej.: Factura 2027/001 Energy Tricolor" disabled={cerrado} /></div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...th, width: 260 }}>Cuenta</th><th style={th}>Concepto línea</th><th style={{ ...th, width: 120, textAlign: 'right' }}>Debe</th><th style={{ ...th, width: 120, textAlign: 'right' }}>Haber</th><th style={{ ...th, width: 30 }}></th></tr></thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td style={{ ...td, verticalAlign: 'top' }}><CuentaInput value={l.cuenta} cuentas={cuentas} onChange={v => set(i, 'cuenta', v)} /></td>
                <td style={{ ...td, verticalAlign: 'top' }}><input style={inp} value={l.concepto || ''} placeholder={concepto} onChange={e => set(i, 'concepto', e.target.value)} /></td>
                <td style={{ ...td, verticalAlign: 'top' }}><input style={{ ...inp, textAlign: 'right' }} inputMode="decimal" value={l.debe} onChange={e => set(i, 'debe', e.target.value)} /></td>
                <td style={{ ...td, verticalAlign: 'top' }}><input style={{ ...inp, textAlign: 'right' }} inputMode="decimal" value={l.haber} onChange={e => set(i, 'haber', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Tab' && !e.shiftKey && i === lineas.length - 1 && dif !== 0) { add(); } }} /></td>
                <td style={{ ...td, verticalAlign: 'top' }}>{lineas.length > 2 && <button onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>×</button>}</td>
              </tr>
            ))}
            <tr><td style={td}><Btn onClick={add}>+ Línea</Btn></td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>Totales</td>
              <td style={{ ...num, fontWeight: 800 }}>{eur(td_)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(th_)}</td><td style={td}></td></tr>
          </tbody>
        </table>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontWeight: 800, color: dif === 0 && td_ > 0 ? '#059669' : '#dc2626' }}>{dif === 0 && td_ > 0 ? '✓ Cuadrado' : `Descuadre: ${eur(dif)} €`}</span>
          {err && <span style={{ color: '#dc2626', fontSize: 13 }}>{err}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Btn onClick={onClose}>Cancelar</Btn>
            {!cerrado && <Btn kind="pri" disabled={busy || dif !== 0 || td_ === 0} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar asiento'}</Btn>}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Pestañas ──────────────────────────────────────────────────────────────
function Diario({ asientos, cuentas, ejercicio, onEdit, onNew, recargar, nombreCta }) {
  const [q, setQ] = useState('');
  const lista = asientos.filter(a => !q || (a.concepto + ' ' + a.numero + ' ' + a.lineas.map(l => l.cuenta + ' ' + (l.concepto || '')).join(' ')).toLowerCase().includes(q.toLowerCase()));
  const borrar = async a => {
    if (!window.confirm(`¿Borrar el asiento nº ${a.numero}?`)) return;
    const { error } = await supabase.rpc('cont_borrar_asiento', { p_id: a.id }); if (error) alert(error.message); else recargar();
  };
  const contra = async a => {
    if (!window.confirm(`¿Crear contraasiento que anule el nº ${a.numero}?`)) return;
    const { error } = await supabase.rpc('cont_guardar_asiento', { p: { fecha: hoyISO() > ejercicio.fin ? ejercicio.fin : hoyISO() < ejercicio.inicio ? ejercicio.inicio : hoyISO(), concepto: `Anulación asiento nº ${a.numero}: ${a.concepto}`, lineas: a.lineas.map(l => ({ cuenta: l.cuenta, debe: l.haber, haber: l.debe, concepto: l.concepto })) } });
    if (error) alert(error.message); else recargar();
  };
  const duplicar = a => onEdit({ concepto: a.concepto, lineas: a.lineas.map(l => ({ cuenta: l.cuenta, debe: l.debe, haber: l.haber, concepto: l.concepto })) });
  const exportar = () => descargarCSV(`libro_diario_${ejercicio.anio}.csv`, [['Asiento', 'Fecha', 'Cuenta', 'Nombre cuenta', 'Concepto', 'Debe', 'Haber'],
    ...asientos.flatMap(a => a.lineas.map(l => [a.numero, fd(a.fecha), l.cuenta, nombreCta(l.cuenta), l.concepto || a.concepto, l.debe || null, l.haber || null]))]);
  const tD = n2(asientos.reduce((s, a) => s + a.lineas.reduce((x, l) => x + l.debe, 0), 0));
  return (
    <Card>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {!ejercicio.cerrado && <Btn kind="pri" onClick={onNew}>+ Nuevo asiento (N)</Btn>}
        <input style={{ ...inp, width: 260 }} placeholder="Buscar concepto, cuenta, nº…" value={q} onChange={e => setQ(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><Btn onClick={exportar}>⬇ Excel</Btn><Btn onClick={() => window.print()}>🖨 PDF</Btn></div>
      </div>
      <PrintHead titulo={`Libro Diario · Ejercicio ${ejercicio.anio}`} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...th, width: 50 }}>Nº</th><th style={{ ...th, width: 85 }}>Fecha</th><th style={{ ...th, width: 90 }}>Cuenta</th><th style={th}>Concepto</th><th style={{ ...th, textAlign: 'right', width: 110 }}>Debe</th><th style={{ ...th, textAlign: 'right', width: 110 }}>Haber</th><th className="no-print" style={{ ...th, width: 120 }}></th></tr></thead>
        <tbody>
          {lista.map(a => a.lineas.map((l, i) => (
            <tr key={a.id + i} style={{ background: i === 0 ? '#fcfcfd' : 'white' }}>
              <td style={{ ...td, fontWeight: 800, borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop }}>{i === 0 ? a.numero : ''}</td>
              <td style={{ ...td, borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop }}>{i === 0 ? fd(a.fecha) : ''}</td>
              <td style={{ ...td, fontFamily: 'monospace', borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop }} title={nombreCta(l.cuenta)}>{l.cuenta}</td>
              <td style={{ ...td, borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop }}>{i === 0 && <b>{a.concepto}{a.tipo !== 'normal' ? ` [${a.tipo}]` : ''}<br /></b>}<span style={{ color: '#64748b', fontSize: 12 }}>{nombreCta(l.cuenta)}{l.concepto ? ' · ' + l.concepto : ''}</span></td>
              <td style={{ ...num, borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop }}>{l.debe ? eur(l.debe) : ''}</td>
              <td style={{ ...num, borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop }}>{l.haber ? eur(l.haber) : ''}</td>
              <td className="no-print" style={{ ...td, borderTop: i === 0 ? '2px solid #e2e8f0' : td.borderTop, whiteSpace: 'nowrap' }}>{i === 0 && <>
                <button title="Editar" onClick={() => onEdit(a)} style={ib}>✏️</button>
                <button title="Duplicar" onClick={() => duplicar(a)} style={ib}>⧉</button>
                {!ejercicio.cerrado && <button title="Contraasiento" onClick={() => contra(a)} style={ib}>↩︎</button>}
                {!ejercicio.cerrado && <button title="Borrar (solo el último)" onClick={() => borrar(a)} style={ib}>🗑</button>}
              </>}</td>
            </tr>
          )))}
          {lista.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 30 }}>Sin asientos en este ejercicio</td></tr>}
          <tr><td colSpan={4} style={{ ...td, fontWeight: 800, textAlign: 'right' }}>Total ejercicio ({asientos.length} asientos)</td><td style={{ ...num, fontWeight: 800 }}>{eur(tD)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(tD)}</td><td className="no-print" /></tr>
        </tbody>
      </table>
    </Card>
  );
}
const ib = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' };

function Mayor({ asientos, cuentas, ejercicio, nombreCta, cuentaIni }) {
  const [cta, setCta] = useState(cuentaIni || '');
  const [desde, setDesde] = useState(ejercicio.inicio); const [hasta, setHasta] = useState(ejercicio.fin);
  useEffect(() => { if (cuentaIni) setCta(cuentaIni); }, [cuentaIni]);
  useEffect(() => { setDesde(ejercicio.inicio); setHasta(ejercicio.fin); }, [ejercicio.anio]); // eslint-disable-line
  const movs = useMemo(() => {
    if (!cta) return { previo: 0, filas: [] };
    let previo = 0; const filas = [];
    asientos.forEach(a => a.lineas.forEach(l => {
      if (!l.cuenta.startsWith(cta)) return;
      if (a.fecha < desde) previo += l.debe - l.haber;
      else if (a.fecha <= hasta) filas.push({ a, l });
    }));
    let s = previo; filas.forEach(f => { s += f.l.debe - f.l.haber; f.saldo = n2(s); });
    return { previo: n2(previo), filas };
  }, [asientos, cta, desde, hasta]);
  const tD = n2(movs.filas.reduce((s, f) => s + f.l.debe, 0)), tH = n2(movs.filas.reduce((s, f) => s + f.l.haber, 0));
  const exportar = () => descargarCSV(`mayor_${cta}_${ejercicio.anio}.csv`, [['Fecha', 'Asiento', 'Cuenta', 'Concepto', 'Debe', 'Haber', 'Saldo'], ['', '', '', 'Saldo anterior', null, null, movs.previo],
    ...movs.filas.map(f => [fd(f.a.fecha), f.a.numero, f.l.cuenta, f.l.concepto || f.a.concepto, f.l.debe || null, f.l.haber || null, f.saldo])]);
  return (
    <Card>
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,320px) 150px 150px 1fr', gap: 8, marginBottom: 12, alignItems: 'start' }}>
        <div><CuentaInput value={cta} cuentas={cuentas.map(c => ({ ...c, imputable: true }))} onChange={setCta} /></div>
        <input type="date" style={inp} value={desde} onChange={e => setDesde(e.target.value)} />
        <input type="date" style={inp} value={hasta} onChange={e => setHasta(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><Btn onClick={exportar} disabled={!cta}>⬇ Excel</Btn><Btn onClick={() => window.print()} disabled={!cta}>🖨 PDF</Btn></div>
      </div>
      {!cta ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 30 }}>Elige una cuenta (también vale un grupo: "57", "430"…)</div> : <>
        <PrintHead titulo={`Libro Mayor · ${cta} ${nombreCta(cta)} · ${fd(desde)} a ${fd(hasta)}`} />
        <h3 className="no-print" style={{ margin: '0 0 8px', fontSize: 15 }}><span style={{ fontFamily: 'monospace' }}>{cta}</span> · {nombreCta(cta)}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...th, width: 85 }}>Fecha</th><th style={{ ...th, width: 50 }}>Nº</th><th style={{ ...th, width: 90 }}>Cuenta</th><th style={th}>Concepto</th><th style={{ ...th, textAlign: 'right' }}>Debe</th><th style={{ ...th, textAlign: 'right' }}>Haber</th><th style={{ ...th, textAlign: 'right' }}>Saldo</th></tr></thead>
          <tbody>
            <tr><td style={td} colSpan={6}><i>Saldo anterior</i></td><td style={num}>{eur(movs.previo)}</td></tr>
            {movs.filas.map((f, i) => <tr key={i}><td style={td}>{fd(f.a.fecha)}</td><td style={td}>{f.a.numero}</td><td style={{ ...td, fontFamily: 'monospace' }}>{f.l.cuenta}</td><td style={td}>{f.l.concepto || f.a.concepto}</td>
              <td style={num}>{f.l.debe ? eur(f.l.debe) : ''}</td><td style={num}>{f.l.haber ? eur(f.l.haber) : ''}</td><td style={{ ...num, fontWeight: 700, color: f.saldo < 0 ? '#b91c1c' : '#0B1233' }}>{eur(f.saldo)}</td></tr>)}
            <tr><td colSpan={4} style={{ ...td, fontWeight: 800, textAlign: 'right' }}>Totales periodo</td><td style={{ ...num, fontWeight: 800 }}>{eur(tD)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(tH)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(n2(movs.previo + tD - tH))}</td></tr>
          </tbody>
        </table>
      </>}
    </Card>
  );
}

function SumasSaldos({ asientos, cuentas, ejercicio, nombreCta, irMayor }) {
  const [nivel, setNivel] = useState(7);
  const [hasta, setHasta] = useState(ejercicio.fin);
  useEffect(() => setHasta(ejercicio.fin), [ejercicio.anio]); // eslint-disable-line
  const filas = useMemo(() => {
    const m = {};
    asientos.filter(a => a.fecha <= hasta).forEach(a => a.lineas.forEach(l => {
      const k = nivel === 7 ? l.cuenta : l.cuenta.slice(0, nivel);
      m[k] = m[k] || { d: 0, h: 0 }; m[k].d += l.debe; m[k].h += l.haber;
    }));
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([c, v]) => ({ c, d: n2(v.d), h: n2(v.h), s: n2(v.d - v.h) }));
  }, [asientos, nivel, hasta]);
  const T = filas.reduce((t, f) => ({ d: t.d + f.d, h: t.h + f.h, sd: t.sd + (f.s > 0 ? f.s : 0), sa: t.sa + (f.s < 0 ? -f.s : 0) }), { d: 0, h: 0, sd: 0, sa: 0 });
  const exportar = () => descargarCSV(`sumas_saldos_${ejercicio.anio}.csv`, [['Cuenta', 'Nombre', 'Sumas Debe', 'Sumas Haber', 'Saldo Deudor', 'Saldo Acreedor'], ...filas.map(f => [f.c, nombreCta(f.c), f.d, f.h, f.s > 0 ? f.s : null, f.s < 0 ? -f.s : null])]);
  return (
    <Card>
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Nivel:</span>
        {[[1, 'Grupo'], [2, 'Subgrupo'], [3, '3 díg.'], [4, '4 díg.'], [7, 'Subcuenta']].map(([n, l]) => <Btn key={n} kind={nivel === n ? 'pri' : 'sec'} onClick={() => setNivel(n)}>{l}</Btn>)}
        <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 8 }}>Hasta:</span><input type="date" style={{ ...inp, width: 150 }} value={hasta} onChange={e => setHasta(e.target.value)} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><Btn onClick={exportar}>⬇ Excel</Btn><Btn onClick={() => window.print()}>🖨 PDF</Btn></div>
      </div>
      <PrintHead titulo={`Balance de Sumas y Saldos · a ${fd(hasta)}`} />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={{ ...th, width: 90 }}>Cuenta</th><th style={th}>Nombre</th><th style={{ ...th, textAlign: 'right' }}>Sumas Debe</th><th style={{ ...th, textAlign: 'right' }}>Sumas Haber</th><th style={{ ...th, textAlign: 'right' }}>Saldo Deudor</th><th style={{ ...th, textAlign: 'right' }}>Saldo Acreedor</th></tr></thead>
        <tbody>
          {filas.map(f => <tr key={f.c} onClick={() => irMayor(f.c)} style={{ cursor: 'pointer' }}><td style={{ ...td, fontFamily: 'monospace' }}>{f.c}</td><td style={td}>{nombreCta(f.c)}</td>
            <td style={num}>{eur(f.d)}</td><td style={num}>{eur(f.h)}</td><td style={num}>{f.s > 0 ? eur(f.s) : ''}</td><td style={num}>{f.s < 0 ? eur(-f.s) : ''}</td></tr>)}
          <tr><td colSpan={2} style={{ ...td, fontWeight: 800, textAlign: 'right' }}>TOTALES</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.d)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.h)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.sd)}</td><td style={{ ...num, fontWeight: 800 }}>{eur(T.sa)}</td></tr>
        </tbody>
      </table>
      {n2(T.d) !== n2(T.h) && <div style={{ color: '#dc2626', fontWeight: 700, marginTop: 8 }}>⚠ Las sumas no cuadran: revisar</div>}
    </Card>
  );
}

function CuentasAnuales({ asientos, ejercicio, nombreCta }) {
  const saldos = useMemo(() => {
    const m = {}; asientos.filter(a => a.tipo !== 'cierre').forEach(a => a.lineas.forEach(l => { m[l.cuenta] = n2((m[l.cuenta] || 0) + l.debe - l.haber); })); return m;
  }, [asientos]);
  const saldosPyG = useMemo(() => {
    const m = {}; asientos.filter(a => !['cierre', 'regularizacion'].includes(a.tipo)).forEach(a => a.lineas.forEach(l => { m[l.cuenta] = n2((m[l.cuenta] || 0) + l.debe - l.haber); })); return m;
  }, [asientos]);
  const pyg = calcPyG(saldosPyG);
  // si ya se regularizó, los saldos de 6/7 están a cero y el resultado está en 129
  const regularizado = asientos.some(a => a.tipo === 'regularizacion');
  const bal = calcBalance(saldos, regularizado ? 0 : pyg.D);
  const Fila = ({ t, v, b, ind }) => <tr><td style={{ ...td, fontWeight: b ? 800 : 400, paddingLeft: ind ? 26 : 10 }}>{t}</td><td style={{ ...num, fontWeight: b ? 800 : 400 }}>{eur(v)}</td></tr>;
  const Grupo = ({ arr, signo = 1 }) => arr.sort((a, b) => a.c.localeCompare(b.c)).map(x => <Fila key={x.c} ind t={<><span style={{ fontFamily: 'monospace', color: '#64748b' }}>{x.c}</span> {nombreCta(x.c)}</>} v={x.s * signo} />);
  const tA = n2(bal.tANC + bal.tAC), tP = n2(bal.tPN + bal.tPNC + bal.tPC);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 14 }}>
      <div className="no-print" style={{ gridColumn: '1/-1', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '6px 10px', borderRadius: 8 }}>Borrador de trabajo con estructura PYME. Para el depósito, trasladar a D2 y revisar clasificación.</span>
        <div style={{ marginLeft: 'auto' }}><Btn onClick={() => window.print()}>🖨 PDF</Btn></div>
      </div>
      <PrintHead titulo={`Cuentas anuales (borrador) · Ejercicio ${ejercicio.anio}`} />
      <Card>
        <h3 style={{ margin: '0 0 8px', color: BRAND }}>Cuenta de Pérdidas y Ganancias</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          {PYG.map(l => (l.b || pyg[l.k] !== 0) && <Fila key={l.k} t={l.t} v={pyg[l.k]} b={l.b} />)}
        </tbody></table>
      </Card>
      <Card>
        <h3 style={{ margin: '0 0 8px', color: BRAND }}>Balance</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
          <Fila t="A) ACTIVO NO CORRIENTE" v={bal.tANC} b /><Grupo arr={bal.A.anc} />
          <Fila t="B) ACTIVO CORRIENTE" v={bal.tAC} b /><Grupo arr={bal.A.ac} />
          <Fila t="TOTAL ACTIVO (A+B)" v={tA} b />
          <tr><td colSpan={2} style={{ height: 10 }} /></tr>
          <Fila t="A) PATRIMONIO NETO" v={bal.tPN} b /><Grupo arr={bal.P.pn} />
          <Fila ind t={<><span style={{ fontFamily: 'monospace', color: '#64748b' }}>129</span> Resultado del ejercicio</>} v={bal.res} />
          <Fila t="B) PASIVO NO CORRIENTE" v={bal.tPNC} b /><Grupo arr={bal.P.pnc} />
          <Fila t="C) PASIVO CORRIENTE" v={bal.tPC} b /><Grupo arr={bal.P.pc} />
          <Fila t="TOTAL PATRIMONIO NETO Y PASIVO (A+B+C)" v={tP} b />
        </tbody></table>
        <div style={{ marginTop: 8, fontWeight: 700, color: tA === tP ? '#059669' : '#dc2626' }}>{tA === tP ? '✓ Activo = Patrimonio neto + Pasivo' : `⚠ Diferencia ${eur(tA - tP)}`}</div>
      </Card>
    </div>
  );
}

function PlanCuentas({ cuentas, recargar, irMayor, saldoDe }) {
  const [q, setQ] = useState(''); const [soloImp, setSoloImp] = useState(false);
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', nif: '' });
  const lista = cuentas.filter(c => (!soloImp || c.imputable) && (!q || c.codigo.startsWith(q) || c.nombre.toLowerCase().includes(q.toLowerCase())));
  const crear = async () => {
    const cod = nueva.codigo.trim();
    if (!/^\d{7}$/.test(cod)) return alert('Las subcuentas tienen 7 dígitos (p. ej. 4300001)');
    if (!cuentas.some(c => !c.imputable && cod.startsWith(c.codigo) && c.codigo.length >= 3)) return alert('No existe la cuenta de 3 dígitos padre en el plan');
    const { error } = await supabase.from('cont_cuentas').insert({ codigo: cod, nombre: nueva.nombre.trim(), nif: nueva.nif.trim() || null, imputable: true });
    if (error) return alert(error.message);
    setNueva({ codigo: '', nombre: '', nif: '' }); recargar();
  };
  const siguiente = pref => {
    const usadas = cuentas.filter(c => c.codigo.length === 7 && c.codigo.startsWith(pref)).map(c => Number(c.codigo));
    const n = usadas.length ? Math.max(...usadas) + 1 : Number(pref.padEnd(7, '0')) + 1; return String(n);
  };
  const toggle = async c => { const { error } = await supabase.from('cont_cuentas').update({ activa: !c.activa }).eq('codigo', c.codigo); if (error) alert(error.message); else recargar(); };
  return (
    <Card>
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 140px auto', gap: 8, marginBottom: 6, background: '#f8fafc', padding: 10, borderRadius: 10 }}>
        <input style={{ ...inp, fontFamily: 'monospace' }} placeholder="4300001" value={nueva.codigo} onChange={e => setNueva(n => ({ ...n, codigo: e.target.value.replace(/\D/g, '').slice(0, 7) }))} />
        <input style={inp} placeholder="Nombre (cliente, proveedor, banco…)" value={nueva.nombre} onChange={e => setNueva(n => ({ ...n, nombre: e.target.value }))} />
        <input style={inp} placeholder="NIF (opcional)" value={nueva.nif} onChange={e => setNueva(n => ({ ...n, nif: e.target.value }))} />
        <Btn kind="pri" disabled={!nueva.codigo || !nueva.nombre} onClick={crear}>+ Subcuenta</Btn>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ color: '#64748b', alignSelf: 'center' }}>Siguiente libre:</span>
        {[['430', 'Cliente'], ['410', 'Acreedor'], ['400', 'Proveedor'], ['572', 'Banco'], ['551', 'C/c socio'], ['705', 'Ingreso servicios']].map(([p, l]) =>
          <Btn key={p} onClick={() => setNueva(n => ({ ...n, codigo: siguiente(p) }))}>{l} {siguiente(p)}</Btn>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input style={{ ...inp, width: 260 }} placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={soloImp} onChange={e => setSoloImp(e.target.checked)} /> Solo subcuentas</label>
      </div>
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...th, width: 100 }}>Código</th><th style={th}>Nombre</th><th style={{ ...th, width: 110 }}>NIF</th><th style={{ ...th, textAlign: 'right', width: 120 }}>Saldo</th><th style={{ ...th, width: 80 }}></th></tr></thead>
          <tbody>{lista.map(c => {
            const s = saldoDe(c.codigo);
            return <tr key={c.codigo} style={{ opacity: c.activa ? 1 : .45 }}>
              <td style={{ ...td, fontFamily: 'monospace', fontWeight: c.codigo.length <= 3 ? 800 : 400, paddingLeft: 10 + (c.imputable ? 20 : (c.codigo.length - 1) * 6) }}>{c.codigo}</td>
              <td style={{ ...td, fontWeight: c.codigo.length === 1 ? 800 : c.imputable ? 400 : 600 }}>{c.nombre}</td>
              <td style={td}>{c.nif || ''}</td>
              <td style={{ ...num, cursor: 'pointer', color: s < 0 ? '#b91c1c' : '#0B1233' }} onClick={() => irMayor(c.codigo)}>{s ? eur(s) : ''}</td>
              <td style={td}>{c.imputable && <button style={ib} title={c.activa ? 'Desactivar' : 'Activar'} onClick={() => toggle(c)}>{c.activa ? '⏸' : '▶︎'}</button>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Ejercicios({ ejercicios, recargar, asientosPorEj }) {
  const [anio, setAnio] = useState(new Date().getFullYear() + 1);
  const crear = async () => { const { error } = await supabase.rpc('cont_crear_ejercicio', { p_anio: Number(anio) }); if (error) alert(error.message); else recargar(); };
  const cerrar = async (e, v) => {
    if (!window.confirm(v ? `¿Cerrar el ejercicio ${e.anio}? No se podrán crear ni modificar asientos.` : `¿Reabrir ${e.anio}?`)) return;
    const { error } = await supabase.rpc('cont_cerrar_ejercicio', { p_anio: e.anio, p_cerrar: v }); if (error) alert(error.message); else recargar();
  };
  const renum = async e => {
    if (!window.confirm(`¿Renumerar los asientos de ${e.anio} por orden de fecha? (apertura primero, regularización y cierre al final)`)) return;
    const { error } = await supabase.rpc('cont_renumerar', { p_ej: e.anio }); if (error) alert(error.message); else recargar();
  };
  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input type="number" style={{ ...inp, width: 120 }} value={anio} onChange={e => setAnio(e.target.value)} /><Btn kind="pri" onClick={crear}>+ Crear ejercicio</Btn>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Ejercicio</th><th style={th}>Periodo</th><th style={th}>Asientos</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
        <tbody>{ejercicios.map(e => <tr key={e.anio}>
          <td style={{ ...td, fontWeight: 800 }}>{e.anio}</td><td style={td}>{fd(e.inicio)} – {fd(e.fin)}</td><td style={td}>{asientosPorEj[e.anio] || 0}</td>
          <td style={td}>{e.cerrado ? <span style={{ color: '#991b1b', fontWeight: 700 }}>🔒 Cerrado</span> : <span style={{ color: '#059669', fontWeight: 700 }}>Abierto</span>}</td>
          <td style={{ ...td, display: 'flex', gap: 6 }}>
            {!e.cerrado && <Btn onClick={() => renum(e)}>Renumerar</Btn>}
            <Btn kind={e.cerrado ? 'sec' : 'del'} onClick={() => cerrar(e, !e.cerrado)}>{e.cerrado ? 'Reabrir' : 'Cerrar'}</Btn>
          </td></tr>)}</tbody>
      </table>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>Próximamente aquí: asistente de regularización de IVA, amortizaciones, regularización de resultados (129), asiento de cierre y apertura automática del ejercicio siguiente.</p>
    </Card>
  );
}

function PrintHead({ titulo }) {
  return <div className="only-print" style={{ marginBottom: 10 }}><div style={{ fontSize: 16, fontWeight: 800 }}>{titulo}</div><div style={{ fontSize: 11, color: '#555' }}>Generado el {new Date().toLocaleString('es-ES')}</div></div>;
}

// ── Principal ─────────────────────────────────────────────────────────────
export default function Contabilidad({ user }) {
  const autorizado = ['admin', 'socio'].includes(user?.role);
  const [tab, setTab] = useState('diario');
  const [cuentas, setCuentas] = useState([]);
  const [ejercicios, setEjercicios] = useState([]);
  const [anio, setAnio] = useState(null);
  const [asientos, setAsientos] = useState([]);
  const [conteo, setConteo] = useState({});
  const [editor, setEditor] = useState(null);
  const [ctaMayor, setCtaMayor] = useState('');
  const [loading, setLoading] = useState(true);
  const tabRef = useRef(tab); tabRef.current = tab;

  const cargarBase = async () => {
    const [c, e, n] = await Promise.all([
      supabase.from('cont_cuentas').select('*').order('codigo'),
      supabase.from('cont_ejercicios').select('*').order('anio'),
      supabase.from('cont_asientos').select('ejercicio'),
    ]);
    if (c.error) { alert('Error: ' + c.error.message); return; }
    setCuentas(c.data || []); setEjercicios(e.data || []);
    const cnt = {}; (n.data || []).forEach(r => { cnt[r.ejercicio] = (cnt[r.ejercicio] || 0) + 1; }); setConteo(cnt);
    if (!anio && e.data?.length) {
      const y = new Date().getFullYear(); setAnio((e.data.find(x => x.anio === y) || e.data[e.data.length - 1]).anio);
    }
  };
  const cargarAsientos = async () => {
    if (!anio) return;
    const { data, error } = await supabase.from('cont_asientos').select('*, cont_apuntes(*)').eq('ejercicio', anio).order('numero');
    if (error) { alert(error.message); return; }
    setAsientos((data || []).map(a => ({ ...a, lineas: (a.cont_apuntes || []).sort((x, y) => x.linea - y.linea).map(l => ({ ...l, debe: Number(l.debe), haber: Number(l.haber) })) })));
    setLoading(false);
  };
  useEffect(() => { if (autorizado) cargarBase(); }, []); // eslint-disable-line
  useEffect(() => { cargarAsientos(); }, [anio]); // eslint-disable-line
  const recargar = () => { cargarBase(); cargarAsientos(); };

  useEffect(() => {
    const h = e => { if (e.key === 'n' && !editor && tabRef.current === 'diario' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); setEditor({}); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [editor]);

  const mapNombre = useMemo(() => Object.fromEntries(cuentas.map(c => [c.codigo, c.nombre])), [cuentas]);
  const nombreCta = c => mapNombre[c] || mapNombre[c?.slice(0, 4)] || mapNombre[c?.slice(0, 3)] || mapNombre[c?.slice(0, 2)] || mapNombre[c?.slice(0, 1)] || '';
  const saldos = useMemo(() => { const m = {}; asientos.forEach(a => a.lineas.forEach(l => { m[l.cuenta] = (m[l.cuenta] || 0) + l.debe - l.haber; })); return m; }, [asientos]);
  const saldoDe = cod => n2(Object.entries(saldos).filter(([c]) => c.startsWith(cod)).reduce((s, [, v]) => s + v, 0));
  const ej = ejercicios.find(e => e.anio === anio);

  if (!autorizado) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>🔒 Área reservada a los socios.</div>;
  if (!ej) return <div style={{ padding: 30 }}>{loading ? 'Cargando contabilidad…' : 'Crea un ejercicio para empezar.'}</div>;

  const kpi = [
    ['Tesorería (57)', saldoDe('57')], ['Clientes (43)', saldoDe('43')], ['Acreedores/Prov. (40-41)', -(saldoDe('40') + saldoDe('41'))],
    ['IVA a liquidar (477−472)', -(saldoDe('477') + saldoDe('472'))], ['Resultado (7−6)', -(saldoDe('6') + saldoDe('7'))],
  ];
  const TABS = [['diario', '📒 Diario'], ['mayor', '📖 Mayor'], ['sumas', '⚖️ Sumas y saldos'], ['anuales', '📊 Balance y PyG'], ['plan', '🗂 Plan de cuentas'], ['ejercicios', '📅 Ejercicios']];
  return (
    <div style={{ padding: '18px 20px' }} className="contab">
      <style>{`.only-print{display:none} @media print{ .no-print, nav, aside, header, .sidebar{display:none !important} .only-print{display:block} .contab{padding:0 !important} .contab *{box-shadow:none !important} body{background:white !important} }`}</style>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: BRAND, margin: 0 }}>🧾 Contabilidad</h1>
        <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ ...inp, width: 130, fontWeight: 700 }}>
          {ejercicios.map(e => <option key={e.anio} value={e.anio}>Ejercicio {e.anio}{e.cerrado ? ' 🔒' : ''}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#64748b' }}>PGC PYMES · {asientos.length} asientos</span>
      </div>
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 14 }}>
        {kpi.map(([l, v]) => <Card key={l} style={{ padding: 12 }}><div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{l}</div><div style={{ fontSize: 19, fontWeight: 800, color: v < 0 ? '#b91c1c' : '#0B1233' }}>{eur(v)} €</div></Card>)}
      </div>
      <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === k ? BRAND : '#eef0f6', color: tab === k ? 'white' : '#334' }}>{l}</button>)}
      </div>
      {tab === 'diario' && <Diario asientos={asientos} cuentas={cuentas} ejercicio={ej} onEdit={a => setEditor(a)} onNew={() => setEditor({})} recargar={recargar} nombreCta={nombreCta} />}
      {tab === 'mayor' && <Mayor asientos={asientos} cuentas={cuentas} ejercicio={ej} nombreCta={nombreCta} cuentaIni={ctaMayor} />}
      {tab === 'sumas' && <SumasSaldos asientos={asientos} cuentas={cuentas} ejercicio={ej} nombreCta={nombreCta} irMayor={c => { setCtaMayor(c); setTab('mayor'); }} />}
      {tab === 'anuales' && <CuentasAnuales asientos={asientos} ejercicio={ej} nombreCta={nombreCta} />}
      {tab === 'plan' && <PlanCuentas cuentas={cuentas} recargar={cargarBase} saldoDe={saldoDe} irMayor={c => { setCtaMayor(c); setTab('mayor'); }} />}
      {tab === 'ejercicios' && <Ejercicios ejercicios={ejercicios} recargar={recargar} asientosPorEj={conteo} />}
      {editor && <EditorAsiento asiento={editor} cuentas={cuentas} ejercicio={ej} cerrado={ej.cerrado} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); cargarAsientos(); cargarBase(); }} />}
    </div>
  );
}
