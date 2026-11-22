import { useState, useEffect, useMemo } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#00208F';

const ESTADOS = {
  nuevo:        { label: 'Nuevo',         color: '#0369a1', bg: '#e0f2fe' },
  revisar:      { label: 'Revisar',       color: '#b45309', bg: '#fffbeb' },
  contactado:   { label: 'Contactado',    color: '#6d28d9', bg: '#f5f3ff' },
  respondio:    { label: 'Respondió',     color: '#047857', bg: '#d1fae5' },
  captado:      { label: 'Captado ✓',     color: '#065f46', bg: '#a7f3d0' },
  descartado:   { label: 'Descartado',    color: '#64748b', bg: '#f1f5f9' },
  no_contactar: { label: 'No contactar',  color: '#991b1b', bg: '#fee2e2' },
};

const FILTROS = [
  { id: 'por_contactar', label: 'Por contactar', f: a => ['nuevo', 'revisar'].includes(a.estado) },
  { id: 'en_curso', label: 'En curso', f: a => ['contactado', 'respondio'].includes(a.estado) },
  { id: 'captado', label: 'Captados', f: a => a.estado === 'captado' },
  { id: 'cerrado', label: 'Descartados', f: a => ['descartado', 'no_contactar'].includes(a.estado) },
  { id: 'todos', label: 'Todos', f: () => true },
];

const CANALES = [
  ['formulario_portal', 'Formulario del portal'],
  ['chat_portal', 'Chat del portal'],
  ['email', 'Email'],
  ['telefono', 'Teléfono'],
  ['otro', 'Otro'],
];

const eur = n => (n == null ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €');
const fecha = d => (d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const esReciente = a => Date.now() - new Date(a.primera_vez).getTime() < 48 * 3600e3;
const bajada = a => a.precio != null && a.precio_inicial != null && Number(a.precio) < Number(a.precio_inicial);

export default function Captacion({ user, users }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('por_contactar');
  const [muni, setMuni] = useState('');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [notas, setNotas] = useState('');
  const [nuevo, setNuevo] = useState({ canal: 'formulario_portal', resultado: '', oposicion: false, robinson: false });
  const [busy, setBusy] = useState(false);
  const isSocio = ['admin', 'socio'].includes(user?.role);

  const load = async () => {
    const { data, error } = await supabase.from('captacion_anuncios').select('*').order('primera_vez', { ascending: false }).limit(1000);
    if (error) alert('Error cargando captación: ' + error.message);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const sel = rows.find(r => r.id === selId);

  useEffect(() => {
    if (!sel) { setContactos([]); setPrecios([]); return; }
    setNotas(sel.notas || '');
    setNuevo({ canal: 'formulario_portal', resultado: '', oposicion: false, robinson: false });
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from('captacion_contactos').select('*').eq('anuncio_id', sel.id).order('fecha', { ascending: false }),
        supabase.from('captacion_precios').select('*').eq('anuncio_id', sel.id).order('visto_en', { ascending: false }),
      ]);
      setContactos(c.data || []);
      setPrecios(p.data || []);
    })();
  }, [selId]); // eslint-disable-line

  const municipios = useMemo(() => [...new Set(rows.map(r => r.municipio))].sort(), [rows]);

  const lista = useMemo(() => {
    const f = FILTROS.find(x => x.id === filtro).f;
    const t = q.trim().toLowerCase();
    return rows
      .filter(f)
      .filter(r => !muni || r.municipio === muni)
      .filter(r => !t || [r.titulo, r.zona, r.municipio, r.portal_id].join(' ').toLowerCase().includes(t));
  }, [rows, filtro, muni, q]);

  const counts = useMemo(() => Object.fromEntries(FILTROS.map(f => [f.id, rows.filter(f.f).length])), [rows]);

  const patch = async (changes) => {
    const { data, error } = await supabase.from('captacion_anuncios').update(changes).eq('id', sel.id).select().single();
    if (error) { alert('Error: ' + error.message); return null; }
    setRows(rs => rs.map(r => (r.id === data.id ? data : r)));
    return data;
  };

  const registrarContacto = async () => {
    if (!nuevo.resultado.trim() && !nuevo.oposicion) { alert('Anota el resultado del contacto'); return; }
    if (nuevo.canal === 'telefono' && !nuevo.robinson) {
      if (!window.confirm('Antes de llamar hay que consultar la Lista Robinson y tener documentado el interés legítimo. ¿Lo has hecho?')) return;
    }
    setBusy(true);
    const { data, error } = await supabase.from('captacion_contactos').insert({
      anuncio_id: sel.id,
      canal: nuevo.canal,
      resultado: nuevo.resultado.trim() || (nuevo.oposicion ? 'Se opone a recibir comunicaciones' : null),
      oposicion: nuevo.oposicion,
      robinson_consultada: nuevo.robinson,
      hecho_por: user?.name || null,
    }).select().single();
    if (error) { alert('Error: ' + error.message); setBusy(false); return; }
    setContactos(c => [data, ...c]);
    if (nuevo.oposicion) await patch({ estado: 'no_contactar' });
    else if (['nuevo', 'revisar'].includes(sel.estado)) await patch({ estado: 'contactado' });
    setNuevo({ canal: nuevo.canal, resultado: '', oposicion: false, robinson: false });
    setBusy(false);
  };

  if (!isSocio) return <div style={{ padding: 24, color: '#64748b' }}>Sección disponible solo para socios.</div>;

  const asignable = (users || []).filter(u => ['admin', 'socio'].includes(u.role));

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)', minHeight: 520 }}>
      {/* Lista */}
      <div style={{ flex: '1 1 52%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{ padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: filtro === f.id ? BRAND : '#eef0f6', color: filtro === f.id ? 'white' : '#334' }}>
              {f.label} <span style={{ opacity: .7 }}>{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="fi" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1 }} />
          <select className="fi" value={muni} onChange={e => setMuni(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos los municipios</option>
            {municipios.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, background: 'white' }}>
          {loading && <div style={{ padding: 20, color: '#64748b' }}>Cargando…</div>}
          {!loading && lista.length === 0 && <div style={{ padding: 20, color: '#64748b' }}>No hay anuncios en este filtro.</div>}
          {lista.map(a => {
            const e = ESTADOS[a.estado] || ESTADOS.nuevo;
            return (
              <div key={a.id} onClick={() => setSelId(a.id)}
                style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selId === a.id ? '#eef2ff' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{a.municipio}{a.zona ? ` · ${a.zona}` : ''}</div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: BRAND }}>{eur(a.precio)}</div>
                </div>
                <div style={{ fontSize: 12, color: '#475569', margin: '2px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo || '(sin título)'}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: e.bg, color: e.color }}>{e.label}</span>
                  {esReciente(a) && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>● reciente</span>}
                  {bajada(a) && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626' }}>↓ bajó de {eur(a.precio_inicial)}</span>}
                  <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>{a.portal} · {a.operacion} · {fecha(a.primera_vez)}</span>
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
                    style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8, background: BRAND, color: 'white', textDecoration: 'none' }}>Ver anuncio ↗</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detalle */}
      <div style={{ flex: '1 1 48%', overflowY: 'auto', minWidth: 0 }}>
        {!sel && <div style={{ color: '#64748b', padding: 20 }}>Selecciona un anuncio para ver el detalle.</div>}
        {sel && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{sel.municipio}{sel.zona ? ` · ${sel.zona}` : ''}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {[sel.tipo_inmueble, sel.m2 && `${sel.m2} m²`, sel.habitaciones && `${sel.habitaciones} hab.`].filter(Boolean).join(' · ') || sel.operacion}
                </div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: BRAND }}>{eur(sel.precio)}</div>
            </div>

            <a href={sel.url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', margin: '10px 0', padding: '8px 14px', borderRadius: 8, background: BRAND, color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Ver anuncio en {sel.portal} ↗
            </a>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>{sel.titulo}</div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <select className="fi" value={sel.estado} onChange={e => patch({ estado: e.target.value })} style={{ flex: 1, minWidth: 140 }}>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select className="fi" value={sel.asignado_a || ''} onChange={e => patch({ asignado_a: e.target.value || null })} style={{ flex: 1, minWidth: 140 }}>
                <option value="">Sin asignar</option>
                {asignable.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', marginBottom: 4 }}>Notas</div>
            <textarea className="fi" rows={3} value={notas} onChange={e => setNotas(e.target.value)}
              onBlur={() => notas !== (sel.notas || '') && patch({ notas: notas || null })} style={{ width: '100%', marginBottom: 14 }} />

            <div style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', marginBottom: 6 }}>Registrar contacto</div>
            <div style={{ background: '#F6F5F1', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 12, color: '#475569' }}>
              Contacta preferentemente por el formulario o chat del propio portal, identificando a queNECESITAS. Si llamas: consulta antes la Lista Robinson y ten documentado el interés legítimo. Si la persona se opone, marca la casilla y no se vuelve a contactar.
            </div>
            <select className="fi" value={nuevo.canal} onChange={e => setNuevo(n => ({ ...n, canal: e.target.value }))} style={{ width: '100%', marginBottom: 6 }}>
              {CANALES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <textarea className="fi" rows={2} placeholder="Resultado / qué se ha dicho" value={nuevo.resultado}
              onChange={e => setNuevo(n => ({ ...n, resultado: e.target.value }))} style={{ width: '100%', marginBottom: 6 }} />
            <label style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 4 }}>
              <input type="checkbox" checked={nuevo.robinson} onChange={e => setNuevo(n => ({ ...n, robinson: e.target.checked }))} /> Lista Robinson consultada
            </label>
            <label style={{ display: 'flex', gap: 6, fontSize: 12, marginBottom: 8, color: '#991b1b' }}>
              <input type="checkbox" checked={nuevo.oposicion} onChange={e => setNuevo(n => ({ ...n, oposicion: e.target.checked }))} /> Se opone a recibir comunicaciones (pasa a "No contactar")
            </label>
            <button className="btn-p" disabled={busy} onClick={registrarContacto}>Guardar contacto</button>

            {contactos.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', marginBottom: 4 }}>Historial de contactos</div>
                {contactos.map(c => (
                  <div key={c.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <b>{fecha(c.fecha)}</b> · {CANALES.find(x => x[0] === c.canal)?.[1] || c.canal}{c.hecho_por ? ` · ${c.hecho_por}` : ''}
                    {c.oposicion && <span style={{ color: '#991b1b', fontWeight: 700 }}> · OPOSICIÓN</span>}
                    <div style={{ color: '#475569' }}>{c.resultado}</div>
                  </div>
                ))}
              </div>
            )}

            {precios.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', marginBottom: 4 }}>Evolución del precio</div>
                {precios.map(p => (
                  <div key={p.id} style={{ fontSize: 12, color: '#475569' }}>{fecha(p.visto_en)} — {eur(p.precio)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
