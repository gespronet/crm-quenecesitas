import { useState, useEffect, useMemo } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#00208F';
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const ESTADOS = {
  pendiente:      { label: 'Pendiente',        color: '#64748b', bg: '#f1f5f9' },
  no_contesta:    { label: 'No contesta',      color: '#f59e0b', bg: '#fffbeb' },
  volver_llamar:  { label: 'Volver a llamar',  color: '#3b82f6', bg: '#eff6ff' },
  interesado:     { label: 'Interesado',       color: '#8b5cf6', bg: '#f5f3ff' },
  no_interesado:  { label: 'No interesado',    color: '#dc2626', bg: '#fee2e2' },
  no_llamar:      { label: 'No llamar',        color: '#7f1d1d', bg: '#fee2e2' },
  sin_telefono:   { label: 'Sin teléfono',     color: '#94a3b8', bg: '#f8fafc' },
  convertido:     { label: 'Prospecto ✓',      color: '#10b981', bg: '#d1fae5' },
};

const FILTROS = [
  { id: 'llamar', label: 'Por llamar', f: l => ['pendiente', 'no_contesta'].includes(l.estado) },
  { id: 'agenda', label: 'Volver a llamar', f: l => l.estado === 'volver_llamar' },
  { id: 'interesado', label: 'Interesados', f: l => l.estado === 'interesado' },
  { id: 'convertido', label: 'Prospectos', f: l => l.estado === 'convertido' },
  { id: 'descartado', label: 'Descartados', f: l => ['no_interesado', 'no_llamar', 'sin_telefono'].includes(l.estado) },
  { id: 'todos', label: 'Todos', f: () => true },
];

const fmt = d => d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

function Guion({ ll, user }) {
  const [tab, setTab] = useState('luz');
  const emp = ll?.empresa || '[empresa]';
  const quien = ll?.persona_contacto || 'la persona que lleva los gastos / gerencia';
  const yo = user?.name?.split(' ')[0] || '[tu nombre]';
  const esCamping = ll?.sector === 'camping';
  const P = ({ t, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>{t}</div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: '#1f2937' }}>{children}</div>
    </div>
  );
  const Q = ({ children }) => <div style={{ background: '#F6F5F1', borderLeft: `3px solid #FFB81C`, padding: '6px 10px', borderRadius: 6, margin: '4px 0' }}>{children}</div>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[['luz', '💡 Luz'], ['gas', '🔥 Gas'], ['obj', '🛡️ Objeciones']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: tab === k ? BRAND : '#eef0f6', color: tab === k ? 'white' : '#334' }}>{l}</button>
        ))}
      </div>
      {tab !== 'obj' && <>
        <P t="1 · Apertura (filtro recepción)">
          <Q>"Buenos días, soy {yo}, de queNECESITAS. Os enviamos ayer un correo sobre la factura de la {tab === 'luz' ? 'luz' : 'luz y el gas'} de {emp}. ¿Me puede pasar con {quien}?"</Q>
          {ll?.aperturas > 0 && <div style={{ fontSize: 12, color: '#059669' }}>✓ Abrió el email {ll.aperturas} {ll.aperturas === 1 ? 'vez' : 'veces'} — menciónalo: "vi que le echasteis un vistazo".</div>}
        </P>
        <P t="2 · Gancho (decisor)">
          <Q>"Le llamo porque {esCamping ? 'en campings' : 'en clínicas dentales'} estamos viendo {tab === 'luz' ? 'facturas de luz con potencias mal contratadas y excesos de reactiva' : 'contratos de gas con término fijo y precio por kWh muy por encima de mercado'}. Revisamos la factura gratis y sin compromiso, y si no hay ahorro se lo decimos igual."</Q>
        </P>
        <P t="3 · Cualificar (anota a la izquierda)">
          {tab === 'luz' ? <>
            • ¿Con qué comercializadora están ahora?<br />• ¿Cuánto pagan al mes, más o menos?<br />• ¿Tienen tarifa 2.0 o 3.0 (más de 15 kW)?<br />• ¿Cuándo revisaron el contrato por última vez? ¿Tienen permanencia?
          </> : <>
            • ¿Usan gas? (calefacción, agua caliente{esCamping ? ', duchas, restaurante' : ', autoclave'})<br />• ¿Gas natural o propano/GLP?<br />• ¿Comercializadora y gasto aproximado?<br />• ¿Contrato fijo o indexado?
          </>}
        </P>
        <P t="4 · Petición clave → la factura">
          <Q>"Lo más fácil: me manda una foto o PDF de la última factura de {tab === 'luz' ? 'luz' : 'gas'} a <b>{user?.email || 'nuestro email'}</b> o por WhatsApp, y en 48 h le paso un estudio comparativo con el ahorro real."</Q>
        </P>
        <P t="5 · Cierre">
          <Q>"Perfecto. ¿A qué email o WhatsApp se lo envío? … ¿Y si el {new Date(Date.now() + 2 * 864e5).toLocaleDateString('es-ES', { weekday: 'long' })} le llamo para comentarle el estudio, mejor mañana o tarde?"</Q>
          <div style={{ fontSize: 12, color: '#64748b' }}>Si acepta → botón <b>Pasar a prospecto</b> (crea contacto + tarea "Conseguir factura").</div>
        </P>
      </>}
      {tab === 'obj' && <>
        <P t='"Ya estamos bien / no nos interesa"'><Q>"Lo entiendo. Precisamente por eso: si ya están bien, el estudio se lo confirma en 2 días y se quedan tranquilos. Solo necesito una factura."</Q></P>
        <P t='"Mándamelo por email"'><Q>"Claro, ya lo tienen del día 17. Lo que necesito es lo contrario: que me mande usted la factura y le devuelvo el ahorro concreto. ¿A qué email se la pido?"</Q></P>
        <P t='"Tenemos permanencia"'><Q>"Lo miramos en la factura: muchas veces la penalización es menor que el ahorro, o le preparamos el cambio para la fecha de fin."</Q></P>
        <P t='"No tengo tiempo"'><Q>"Son 30 segundos: foto de la factura al WhatsApp. ¿Le llamo en otro momento mejor? ¿Qué día?"</Q> → <i>Volver a llamar</i> con fecha.</P>
        <P t='"Lo lleva la gestoría / el socio"'><Q>"¿Me da el nombre y cuándo puedo localizarle?"</Q> → anota en Persona contacto.</P>
        <P t='"¿Cuánto cuesta?"'><Q>"Nada. Nos paga la comercializadora si cambian. Usted no paga el estudio ni el cambio."</Q></P>
      </>}
    </div>
  );
}

export default function Llamadas({ user, users, onReload }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('llamar');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [form, setForm] = useState({});
  const [comentario, setComentario] = useState('');
  const [fechaVuelta, setFechaVuelta] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = ['admin', 'socio'].includes(user?.role);

  const load = async () => {
    const { data, error } = await supabase.from('llamadas').select('*').order('aperturas', { ascending: false }).order('orden');
    if (error) alert('Error cargando llamadas: ' + error.message);
    setRows(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sel = rows.find(r => r.id === selId);
  useEffect(() => { if (sel) { setForm({ ...sel }); setComentario(''); setFechaVuelta(''); } }, [selId]); // eslint-disable-line

  const lista = useMemo(() => {
    const f = FILTROS.find(x => x.id === filtro).f;
    const t = q.trim().toLowerCase();
    let l = rows.filter(f).filter(r => !t || [r.empresa, r.localidad, r.telefono, r.email, r.persona_contacto].join(' ').toLowerCase().includes(t));
    if (filtro === 'agenda') l = [...l].sort((a, b) => (a.proxima_llamada || '').localeCompare(b.proxima_llamada || ''));
    return l;
  }, [rows, filtro, q]);

  const counts = useMemo(() => Object.fromEntries(FILTROS.map(f => [f.id, rows.filter(f.f).length])), [rows]);
  const hoy = new Date().toISOString();
  const vencidas = rows.filter(r => r.estado === 'volver_llamar' && r.proxima_llamada && r.proxima_llamada <= hoy).length;

  const patch = async (changes) => {
    const { data, error } = await supabase.from('llamadas').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', sel.id).select().single();
    if (error) { alert('Error: ' + error.message); return null; }
    setRows(rs => rs.map(r => r.id === data.id ? data : r)); setForm({ ...data });
    return data;
  };

  const campos = () => ({
    persona_contacto: form.persona_contacto || null, cargo: form.cargo || null, telefono: form.telefono || null, telefono2: form.telefono2 || null,
    email: form.email || null, suministros: form.suministros || [], comercializadora_actual: form.comercializadora_actual || null,
    gasto_mensual: form.gasto_mensual === '' || form.gasto_mensual == null ? null : Number(form.gasto_mensual),
  });

  const registrar = async (estado, extra = {}) => {
    if (estado === 'volver_llamar' && !fechaVuelta) { alert('Indica fecha y hora para volver a llamar'); return; }
    setBusy(true);
    const entrada = { at: new Date().toISOString(), por: user?.name, resultado: estado, comentario: comentario.trim() || null, ...(estado === 'volver_llamar' ? { proxima: fechaVuelta } : {}) };
    const esLlamada = estado !== 'guardar';
    const d = await patch({
      ...campos(),
      ...(esLlamada ? {
        estado, intentos: (sel.intentos || 0) + 1, ultima_llamada_at: entrada.at,
        proxima_llamada: estado === 'volver_llamar' ? new Date(fechaVuelta).toISOString() : null,
        asignado_a: sel.asignado_a || user?.id,
      } : {}),
      historial: (esLlamada || comentario.trim()) ? [...(sel.historial || []), { ...entrada, resultado: esLlamada ? estado : 'nota' }] : sel.historial,
      ...extra,
    });
    setBusy(false);
    if (d && esLlamada && estado !== 'interesado') {
      // saltar a la siguiente de la lista
      const idx = lista.findIndex(r => r.id === d.id);
      const next = lista.slice(idx + 1).find(r => FILTROS.find(x => x.id === filtro).f(r) && r.id !== d.id);
      if (next) setSelId(next.id);
    }
  };

  const convertir = async () => {
    if (!window.confirm(`¿Pasar ${sel.empresa} a prospecto?\nSe crea el contacto y una tarea para conseguir la factura.`)) return;
    setBusy(true);
    const c = campos();
    const sum = (c.suministros.length ? c.suministros : ['luz']).join(' y ');
    const hist = [...(sel.historial || []), ...(comentario.trim() ? [{ at: new Date().toISOString(), por: user?.name, resultado: 'nota', comentario: comentario.trim() }] : [])];
    const notas = [`Campaña: ${sel.campana}`, c.comercializadora_actual && `Comercializadora: ${c.comercializadora_actual}`, c.gasto_mensual && `Gasto aprox.: ${c.gasto_mensual} €/mes`, `Suministros: ${sum}`, '— Llamadas —',
      ...hist.map(h => `${fmt(h.at)} ${h.por || ''}: ${ESTADOS[h.resultado]?.label || h.resultado}${h.comentario ? ' · ' + h.comentario : ''}`)].filter(Boolean).join('\n');
    const comercial = sel.asignado_a || user?.id;
    const contactId = gid();
    const { error: e1 } = await supabase.from('contacts').insert({
      id: contactId, name: c.persona_contacto || sel.empresa, empresa: sel.empresa, empresa_razon_social: sel.empresa, phone: c.telefono, email: c.email,
      empresa_telefono: c.telefono, empresa_email: c.email, cargo: c.cargo, localidad: sel.localidad, tipo: 'prospecto', tipo_cliente: 'empresa',
      linea: ['energia'], origen: 'Campaña llamadas', comercial_id: comercial, notas, created_at: new Date().toISOString().slice(0, 10),
    });
    if (e1) { setBusy(false); alert('Error creando contacto: ' + e1.message); return; }
    const venc = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    const { error: e2 } = await supabase.from('tasks').insert({
      id: gid(), titulo: `Conseguir factura de ${sum} · ${sel.empresa}`, contact_id: contactId, comercial_id: comercial, fecha: venc, completada: false, prioridad: 'alta',
      notas: `Tel: ${c.telefono || '-'} · Email: ${c.email || '-'}${comentario.trim() ? '\n' + comentario.trim() : ''}`,
    });
    if (e2) alert('Contacto creado, pero falló la tarea: ' + e2.message);
    await patch({ ...c, estado: 'convertido', contact_id: contactId, historial: [...hist, { at: new Date().toISOString(), por: user?.name, resultado: 'convertido' }], asignado_a: comercial });
    setBusy(false);
    onReload && onReload();
  };

  const toggleSum = s => setForm(f => ({ ...f, suministros: (f.suministros || []).includes(s) ? f.suministros.filter(x => x !== s) : [...(f.suministros || []), s] }));
  const Badge = ({ e }) => { const s = ESTADOS[e] || ESTADOS.pendiente; return <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{s.label}</span>; };
  const inp = { width: '100%', padding: '7px 9px', border: '1px solid #dde1ea', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' };
  const lbl = { fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 3 };
  const Btn = ({ c, bg, onClick, children, dis }) => <button disabled={busy || dis} onClick={onClick} style={{ padding: '9px 6px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: c, background: bg, opacity: busy ? .6 : 1 }}>{children}</button>;

  if (loading) return <div style={{ padding: 30 }}>Cargando llamadas…</div>;

  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: BRAND, margin: 0 }}>📞 Llamadas</h1>
        <span style={{ fontSize: 13, color: '#64748b' }}>{rows[0]?.campana} · {rows.length} contactos · {counts.convertido} prospectos</span>
        {vencidas > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '3px 10px', borderRadius: 20 }}>⏰ {vencidas} rellamadas pendientes hoy</span>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTROS.map(f => <button key={f.id} onClick={() => setFiltro(f.id)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: filtro === f.id ? BRAND : '#eef0f6', color: filtro === f.id ? 'white' : '#334' }}>{f.label} <span style={{ opacity: .7 }}>{counts[f.id]}</span></button>)}
        <input placeholder="Buscar empresa, localidad, teléfono…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, width: 240, marginLeft: 'auto' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr) minmax(280px,.9fr)', gap: 14, alignItems: 'start' }} className="llam-grid">
        {/* LISTA */}
        <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <div style={{ maxHeight: 'calc(100vh - 210px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                {['Empresa', 'Teléfono', '📧', 'Estado'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#64748b', fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lista.map(r => (
                  <tr key={r.id} onClick={() => setSelId(r.id)} style={{ cursor: 'pointer', background: r.id === selId ? '#eef2ff' : 'white', borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 700, color: '#0B1233' }}>{r.empresa}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.localidad}{r.intentos ? ` · ${r.intentos} intento${r.intentos > 1 ? 's' : ''}` : ''}{r.proxima_llamada ? ` · ⏰ ${fmt(r.proxima_llamada)}` : ''}</div>
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{r.telefono || '—'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 12 }} title={r.estado_email}>{r.estado_email === 'Abierto' ? `👁 ${r.aperturas}` : r.estado_email === 'Rebotado' ? '⚠️' : r.estado_email === 'Baja' ? '🚫' : '·'}</td>
                    <td style={{ padding: '8px 10px' }}><Badge e={r.estado} /></td>
                  </tr>
                ))}
                {lista.length === 0 && <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Nada en esta vista 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* FICHA */}
        <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 16, position: 'sticky', top: 10 }}>
          {!sel ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>← Elige un contacto para empezar a llamar</div> : <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0B1233' }}>{sel.empresa}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{sel.localidad} · {sel.sector === 'camping' ? 'Camping' : 'Clínica dental'} · email {sel.estado_email?.toLowerCase()}{sel.aperturas ? ` (${sel.aperturas})` : ''}</div>
              </div>
              <Badge e={sel.estado} />
            </div>
            <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
              {form.telefono && <a href={`tel:${form.telefono}`} style={{ flex: 1, textAlign: 'center', background: '#10b981', color: 'white', padding: '10px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' }}>📞 {form.telefono}</a>}
              {form.telefono2 && <a href={`tel:${form.telefono2}`} style={{ flex: 1, textAlign: 'center', background: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>📞 {form.telefono2}</a>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><label style={lbl}>Persona de contacto</label><input style={inp} value={form.persona_contacto || ''} onChange={e => setForm(f => ({ ...f, persona_contacto: e.target.value }))} /></div>
              <div><label style={lbl}>Cargo</label><input style={inp} value={form.cargo || ''} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} /></div>
              <div><label style={lbl}>Teléfono</label><input style={inp} value={form.telefono || ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} /></div>
              <div><label style={lbl}>Teléfono 2 / móvil</label><input style={inp} value={form.telefono2 || ''} onChange={e => setForm(f => ({ ...f, telefono2: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Email</label><input style={inp} value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label style={lbl}>Suministros</label>
                <div style={{ display: 'flex', gap: 6 }}>{[['luz', '💡 Luz'], ['gas', '🔥 Gas']].map(([k, l]) => <button key={k} onClick={() => toggleSum(k)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: '1px solid #dde1ea', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: (form.suministros || []).includes(k) ? '#FFB81C' : 'white' }}>{l}</button>)}</div>
              </div>
              <div><label style={lbl}>Gasto €/mes aprox.</label><input type="number" style={inp} value={form.gasto_mensual ?? ''} onChange={e => setForm(f => ({ ...f, gasto_mensual: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Comercializadora actual</label><input style={inp} list="comercializadoras" value={form.comercializadora_actual || ''} onChange={e => setForm(f => ({ ...f, comercializadora_actual: e.target.value }))} />
                <datalist id="comercializadoras">{['Iberdrola', 'Endesa', 'Naturgy', 'Repsol', 'TotalEnergies', 'EDP', 'Holaluz', 'Octopus', 'Audax', 'Factor Energía', 'Gesternova', 'Nexus', 'Plenitude'].map(x => <option key={x} value={x} />)}</datalist></div>
            </div>
            <div style={{ marginTop: 10 }}><label style={lbl}>Comentario de esta llamada</label>
              <textarea rows={3} style={inp} value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Qué te han dicho, con quién hablaste…" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 10 }}>
              <Btn c="#92400e" bg="#fef3c7" onClick={() => registrar('no_contesta')}>📵 No contesta</Btn>
              <Btn c="#5b21b6" bg="#ede9fe" onClick={() => registrar('interesado')}>👍 Interesado</Btn>
              <Btn c="#991b1b" bg="#fee2e2" onClick={() => registrar('no_interesado')}>👎 No interesa</Btn>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input type="datetime-local" style={{ ...inp, flex: 1 }} value={fechaVuelta} onChange={e => setFechaVuelta(e.target.value)} />
              <Btn c="#1e40af" bg="#dbeafe" onClick={() => registrar('volver_llamar')}>⏰ Volver a llamar</Btn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 6, marginTop: 6 }}>
              <Btn c="#334" bg="#eef0f6" onClick={() => registrar('guardar')}>💾 Guardar</Btn>
              <Btn c="#7f1d1d" bg="#fecaca" onClick={() => window.confirm('¿Marcar como NO LLAMAR (pidió que no le contactemos)?') && registrar('no_llamar')}>🚫 No llamar</Btn>
              <Btn c="white" bg={sel.estado === 'convertido' ? '#94a3b8' : '#10b981'} dis={sel.estado === 'convertido'} onClick={convertir}>{sel.estado === 'convertido' ? '✓ Ya es prospecto' : '🚀 Pasar a prospecto'}</Btn>
            </div>
            {(sel.historial || []).length > 0 && <div style={{ marginTop: 14 }}>
              <div style={lbl}>Historial</div>
              {[...sel.historial].reverse().map((h, i) => <div key={i} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid #f1f5f9' }}>
                <b>{fmt(h.at)}</b> · {h.por} · <span style={{ color: ESTADOS[h.resultado]?.color }}>{ESTADOS[h.resultado]?.label || (h.resultado === 'nota' ? 'Nota' : h.resultado)}</span>
                {h.proxima && <> → {fmt(h.proxima)}</>}{h.comentario && <div style={{ color: '#334' }}>{h.comentario}</div>}
              </div>)}
            </div>}
            {isAdmin && users?.length > 0 && <div style={{ marginTop: 12 }}><label style={lbl}>Asignado a</label>
              <select style={inp} value={sel.asignado_a || ''} onChange={e => patch({ asignado_a: e.target.value || null })}>
                <option value="">Sin asignar</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>}
          </>}
        </div>

        {/* GUION */}
        <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 16, position: 'sticky', top: 10, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', borderTop: '4px solid #FFB81C' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND, marginBottom: 10 }}>🎯 Guion · conseguir la factura</div>
          <Guion ll={sel ? { ...sel, ...form } : null} user={user} />
        </div>
      </div>
      <style>{`@media (max-width: 1100px){ .llam-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
