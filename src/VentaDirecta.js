import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#002292';

const TIPOS_ACTIVO = [
  { key:'piso',   label:'Piso',   icon:'🏠' },
  { key:'local',  label:'Local',  icon:'🏪' },
  { key:'nave',   label:'Nave',   icon:'🏭' },
  { key:'suelo',  label:'Suelo',  icon:'🌿' },
  { key:'garaje', label:'Garaje', icon:'🚗' },
  { key:'chalet', label:'Chalet', icon:'🏡' },
  { key:'otro',   label:'Otro',   icon:'📦' },
];

const ORIGENES = [
  { key:'banco',          label:'Banco',          color:'#1d4ed8', bg:'#eff6ff' },
  { key:'fondo',          label:'Fondo',          color:'#7c3aed', bg:'#f5f3ff' },
  { key:'promotor',       label:'Promotor',       color:'#0891b2', bg:'#ecfeff' },
  { key:'particular',     label:'Particular',     color:'#059669', bg:'#ecfdf5' },
  { key:'administración', label:'Administración', color:'#d97706', bg:'#fffbeb' },
];

const ESTADOS_VD = {
  identificado:      { label:'Identificado',    color:'#6b7280', bg:'#f3f4f6' },
  'análisis':        { label:'Análisis',        color:'#2563eb', bg:'#dbeafe' },
  propuesta:         { label:'Propuesta',       color:'#7c3aed', bg:'#f5f3ff' },
  'negociación':     { label:'Negociación',     color:'#d97706', bg:'#fef3c7' },
  docs_solicitados:  { label:'Docs solicitados',color:'#0891b2', bg:'#ecfeff' },
  cerrado:           { label:'Cerrado ✓',       color:'#059669', bg:'#d1fae5' },
  perdido:           { label:'Perdido ✗',       color:'#dc2626', bg:'#fee2e2' },
};

const EMPTY_FORM = {
  referencia:'', nombre:'', tipo_activo:'', origen:'', entidad:'',
  localidad:'', provincia:'', superficie_m2:'',
  precio_entidad:'', precio_mercado:'',
  estado:'identificado', contact_id:'', comercial_id:'', notas:'',
};

function isAdminSocio(u) { return ['admin','socio'].includes(u.role); }

function fmt(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v));
}

function calcMargen(precioEntidad, precioMercado) {
  const pe = Number(precioEntidad), pm = Number(precioMercado);
  if (!pe || pe <= 0 || !pm) return null;
  return (pm / pe - 1) * 100;
}

function margenColor(m) {
  if (m === null || m === undefined) return { color:'#6b7280', bg:'#f3f4f6' };
  if (m > 20) return { color:'#059669', bg:'#d1fae5' };
  if (m >= 5) return { color:'#d97706', bg:'#fef3c7' };
  return { color:'#dc2626', bg:'#fee2e2' };
}

function selSt() {
  return { padding:'7px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, color:'#374151', background:'white', cursor:'pointer' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VentaDirecta({ user, users, contacts }) {
  const [activos, setActivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null=cerrado, 'new'=crear, obj=editar
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ tipo:'', origen:'', estado:'', provincia:'' });

  const admin = isAdminSocio(user);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('venta_directa')
      .select('*, contacts(name, phone), users(name)')
      .order('created_at', { ascending:false });
    if (error) console.log('[venta_directa] error:', error);
    setActivos(data || []);
    setLoading(false);
  };

  const handleSaved = (rec) => {
    setActivos(as => {
      const idx = as.findIndex(a => a.id === rec.id);
      return idx >= 0 ? as.map(a => a.id === rec.id ? rec : a) : [rec, ...as];
    });
    setModal(null);
  };

  const handleDeleted = (id) => {
    setActivos(as => as.filter(a => a.id !== id));
    setModal(null);
  };

  const visibles = admin ? activos : activos.filter(a => a.comercial_id === user.id);

  const provincias = [...new Set(visibles.map(a => a.provincia).filter(Boolean))].sort();

  const filtered = visibles.filter(a => {
    if (filters.tipo && a.tipo_activo !== filters.tipo) return false;
    if (filters.origen && a.origen !== filters.origen) return false;
    if (filters.estado && a.estado !== filters.estado) return false;
    if (filters.provincia && a.provincia !== filters.provincia) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [a.nombre, a.referencia, a.localidad].filter(Boolean).some(v => v.toLowerCase().includes(q));
      if (!hay) return false;
    }
    return true;
  });

  const total = visibles.length;
  const enAnalisis = visibles.filter(a => ['análisis','propuesta','negociación'].includes(a.estado)).length;
  const cerrados = visibles.filter(a => a.estado === 'cerrado').length;
  const margenes = visibles.map(a => a.margen_pct).filter(v => v !== null && v !== undefined);
  const margenMedio = margenes.length ? margenes.reduce((s,v) => s+Number(v), 0) / margenes.length : null;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:BRAND }}>🏷️ Venta Directa</h1>
          <p style={{ color:'#9ca3af', fontSize:13 }}>{filtered.length} activos</p>
        </div>
        <button className="btn-p" onClick={() => setModal('new')}>+ Nuevo activo</button>
      </div>

      {/* Métricas rápidas */}
      <div className="stats-grid">
        {[
          { l:'Total activos', v:total, i:'🏷️', c:BRAND },
          { l:'En análisis', v:enAnalisis, i:'🔎', c:'#d97706' },
          { l:'Cerrados', v:cerrados, i:'✅', c:'#059669' },
          { l:'Margen medio %', v: margenMedio !== null ? `${margenMedio.toFixed(1)}%` : '—', i:'📈', c: margenColor(margenMedio).color },
        ].map(s => (
          <div key={s.l} className="sc" style={{ borderLeftColor:s.c }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{s.i}</div>
            <div style={{ fontSize:24, fontWeight:800, color:s.c, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.v}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Buscador y filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input className="fi" placeholder="Buscar por nombre, referencia, localidad..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:280 }} />
        <select value={filters.tipo} onChange={e => setFilters(f=>({...f,tipo:e.target.value}))} style={selSt()}>
          <option value="">Todos los tipos</option>
          {TIPOS_ACTIVO.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
        <select value={filters.origen} onChange={e => setFilters(f=>({...f,origen:e.target.value}))} style={selSt()}>
          <option value="">Todos los orígenes</option>
          {ORIGENES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <select value={filters.estado} onChange={e => setFilters(f=>({...f,estado:e.target.value}))} style={selSt()}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_VD).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.provincia} onChange={e => setFilters(f=>({...f,provincia:e.target.value}))} style={selSt()}>
          <option value="">Todas las provincias</option>
          {provincias.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(search||filters.tipo||filters.origen||filters.estado||filters.provincia) && (
          <button onClick={() => { setSearch(''); setFilters({tipo:'',origen:'',estado:'',provincia:''}); }}
            style={{ ...selSt(), color:'#dc2626', borderColor:'#fee2e2', background:'#fef2f2' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color:'#9ca3af', fontSize:13 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
          {visibles.length === 0 ? 'No hay activos. Añade el primero.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Referencia','Nombre','Tipo','Origen','Localidad','Precio entidad','Precio mercado','Margen','Estado',''].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const tipo = TIPOS_ACTIVO.find(t => t.key === a.tipo_activo);
                  const origen = ORIGENES.find(o => o.key === a.origen);
                  const estado = ESTADOS_VD[a.estado] || ESTADOS_VD.identificado;
                  const mc = margenColor(a.margen_pct);
                  return (
                    <tr key={a.id} className="tr" style={{ borderTop:'1px solid #f0f3fb' }}>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>{a.referencia || '—'}</td>
                      <td style={{ padding:'9px 13px' }}>
                        <button onClick={() => setModal(a)} style={{ fontSize:13, fontWeight:700, color:BRAND, background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}>
                          {a.nombre}
                        </button>
                        {a.entidad && <div style={{ fontSize:11, color:'#9ca3af' }}>{a.entidad}</div>}
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        {tipo && <span className="tag" style={{ background:'#f0f3fc', color:BRAND }}>{tipo.icon} {tipo.label}</span>}
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        {origen && <span className="tag" style={{ background:origen.bg, color:origen.color }}>{origen.label}</span>}
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>
                        {[a.localidad, a.provincia].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.precio_entidad)}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.precio_mercado)}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:mc.bg, color:mc.color, fontWeight:800 }}>
                          {a.margen_pct !== null && a.margen_pct !== undefined ? `${Number(a.margen_pct).toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:estado.bg, color:estado.color }}>{estado.label}</span>
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          <button className="btn-g" style={{ padding:'5px 9px' }} onClick={() => setModal(a)}>✏️</button>
                          {admin && (
                            <button onClick={() => quickDelete(a)}
                              style={{ padding:'5px 9px', borderRadius:7, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                              🗑
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal !== null && (
        <ActivoModal
          activo={modal === 'new' ? null : modal}
          user={user} users={users} contacts={contacts} isAdmin={admin}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );

  async function quickDelete(activo) {
    if (!window.confirm(`¿Eliminar "${activo.nombre}"? No se puede deshacer.`)) return;
    const { error } = await supabase.from('venta_directa').delete().eq('id', activo.id);
    if (error) { alert(`Error: ${error.message}`); return; }
    handleDeleted(activo.id);
  }
}

// ─── Modal Nuevo / Editar ───────────────────────────────────────────────────────

function ActivoModal({ activo, user, users, contacts, isAdmin, onClose, onSaved, onDeleted }) {
  const isNew = !activo;
  const initForm = () => activo ? {
    referencia: activo.referencia||'', nombre: activo.nombre||'',
    tipo_activo: activo.tipo_activo||'', origen: activo.origen||'', entidad: activo.entidad||'',
    localidad: activo.localidad||'', provincia: activo.provincia||'',
    superficie_m2: activo.superficie_m2||'',
    precio_entidad: activo.precio_entidad||'', precio_mercado: activo.precio_mercado||'',
    estado: activo.estado||'identificado', contact_id: activo.contact_id||'',
    comercial_id: activo.comercial_id||'', notas: activo.notas||'',
  } : { ...EMPTY_FORM, comercial_id: user.id };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cSearch, setCSearch] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;
  const margenLive = calcMargen(form.precio_entidad, form.precio_mercado);
  const mc = margenColor(margenLive);

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre del activo es obligatorio'); return; }
    setSaving(true);
    try {
      const margen = calcMargen(form.precio_entidad, form.precio_mercado);
      const payload = {
        referencia: form.referencia || null,
        nombre: form.nombre,
        tipo_activo: form.tipo_activo || null,
        origen: form.origen || null,
        entidad: form.entidad || null,
        localidad: form.localidad || null,
        provincia: form.provincia || null,
        superficie_m2: numOrNull(form.superficie_m2),
        precio_entidad: numOrNull(form.precio_entidad),
        precio_mercado: numOrNull(form.precio_mercado),
        margen_pct: margen !== null ? Number(margen.toFixed(1)) : null,
        estado: form.estado,
        contact_id: form.contact_id || null,
        comercial_id: form.comercial_id || null,
        notas: form.notas || null,
      };
      let rec;
      if (isNew) {
        const id = crypto.randomUUID();
        const { data: d, error } = await supabase.from('venta_directa')
          .insert({ id, ...payload, created_at: new Date().toISOString() })
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = d;
      } else {
        const { data: d, error } = await supabase.from('venta_directa')
          .update(payload).eq('id', activo.id)
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = d;
      }
      onSaved(rec);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este activo? No se puede deshacer.')) return;
    setDeleting(true);
    const { error } = await supabase.from('venta_directa').delete().eq('id', activo.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(activo.id);
  };

  const selCon = contacts.find(c => c.id === form.contact_id);
  const filtCon = cSearch ? contacts.filter(c => c.name?.toLowerCase().includes(cSearch.toLowerCase())).slice(0,15) : [];

  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo mo-lg">
        <h2 style={{ fontSize:17, fontWeight:800, color:BRAND, marginBottom:18 }}>
          {isNew ? 'Nuevo activo' : activo.nombre}
        </h2>

        <Sec title="Identificación">
          <Grid2>
            <div><FL>Referencia</FL><input className="fi" value={form.referencia} onChange={e => set('referencia',e.target.value)} placeholder="Ej: VD-001" /></div>
            <div>
              <FL>Tipo de activo</FL>
              <select className="fi" value={form.tipo_activo} onChange={e => set('tipo_activo',e.target.value)}>
                <option value="">Seleccionar...</option>
                {TIPOS_ACTIVO.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <FL>Nombre del activo *</FL>
              <input className="fi" value={form.nombre} onChange={e => set('nombre',e.target.value)} placeholder="Ej: Piso banco - Edificio Sol" />
            </div>
            <div>
              <FL>Origen</FL>
              <select className="fi" value={form.origen} onChange={e => set('origen',e.target.value)}>
                <option value="">Seleccionar...</option>
                {ORIGENES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <div><FL>Entidad</FL><input className="fi" value={form.entidad} onChange={e => set('entidad',e.target.value)} placeholder="Nombre del banco/fondo/promotor" /></div>
          </Grid2>
        </Sec>

        <Sec title="Ubicación">
          <Grid2>
            <div><FL>Localidad</FL><input className="fi" value={form.localidad} onChange={e => set('localidad',e.target.value)} placeholder="Localidad" /></div>
            <div><FL>Provincia</FL><input className="fi" value={form.provincia} onChange={e => set('provincia',e.target.value)} placeholder="Provincia" /></div>
            <div><FL>Superficie (m²)</FL><input className="fi" type="number" value={form.superficie_m2} onChange={e => set('superficie_m2',e.target.value)} placeholder="0" /></div>
          </Grid2>
        </Sec>

        <Sec title="Económico">
          <Grid2>
            <div><FL>Precio entidad (€)</FL><input className="fi" type="number" value={form.precio_entidad} onChange={e => set('precio_entidad',e.target.value)} placeholder="0" /></div>
            <div><FL>Precio mercado (€)</FL><input className="fi" type="number" value={form.precio_mercado} onChange={e => set('precio_mercado',e.target.value)} placeholder="0" /></div>
          </Grid2>
          <div style={{ marginTop:14, padding:'14px 16px', borderRadius:10, background:mc.bg, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, fontWeight:700, color:mc.color, textTransform:'uppercase', letterSpacing:'.5px' }}>Margen sobre precio de entidad</span>
            <span style={{ fontSize:26, fontWeight:800, color:mc.color, fontFamily:"'Barlow Condensed',sans-serif" }}>
              {margenLive !== null ? `${margenLive.toFixed(1)}%` : '—'}
            </span>
          </div>
        </Sec>

        <Sec title="Gestión">
          <Grid2>
            <div>
              <FL>Estado</FL>
              <select className="fi" value={form.estado} onChange={e => set('estado',e.target.value)}>
                {Object.entries(ESTADOS_VD).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <FL>Comercial asignado</FL>
              <select className="fi" value={form.comercial_id} onChange={e => set('comercial_id',e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'1/-1', position:'relative' }}>
              <FL>Contacto vinculado (comprador/inversor)</FL>
              {selCon ? (
                <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8 }}>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color:BRAND }}>{selCon.name}</span>
                  <button onClick={() => { set('contact_id',''); setCSearch(''); }} style={{ fontSize:12, color:'#dc2626', border:'none', background:'none', cursor:'pointer' }}>✕</button>
                </div>
              ) : (
                <>
                  <input className="fi" placeholder="Buscar contacto..." value={cSearch} onChange={e => setCSearch(e.target.value)} />
                  {filtCon.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1.5px solid #dde2f0', borderRadius:8, zIndex:200, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,.12)' }}>
                      {filtCon.map(c => (
                        <div key={c.id} onClick={() => { set('contact_id',c.id); setCSearch(''); }}
                          style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', borderBottom:'1px solid #f0f3fb' }}
                          onMouseEnter={e => e.currentTarget.style.background='#f0f3fb'}
                          onMouseLeave={e => e.currentTarget.style.background=''}>
                          {c.name}{c.phone ? ` · ${c.phone}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Grid2>
          <div style={{ marginTop:12 }}>
            <FL>Notas</FL>
            <textarea value={form.notas} onChange={e => set('notas',e.target.value)}
              placeholder="Notas internas sobre el activo, negociación, condiciones..." rows={5}
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:100, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
          </div>
        </Sec>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
          <div>
            {!isNew && isAdmin && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-g" onClick={onClose}>Cancelar</button>
            <button className="btn-p" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : '✓ Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Sec({ title, children }) {
  return (
    <div style={{ marginBottom:24 }}>
      <h3 style={{ fontSize:11, fontWeight:800, color:BRAND, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #e8ecf8' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Grid2({ children }) {
  return <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>;
}

function FL({ children }) {
  return <label style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'.5px' }}>{children}</label>;
}
