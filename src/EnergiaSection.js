import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#002292';

const ESTADOS_ENERGIA = {
  factura_recibida:   { label:'Factura recibida',    color:'#f59e0b', bg:'#fffbeb' },
  enviada_partner:    { label:'Enviada al partner',   color:'#3b82f6', bg:'#eff6ff' },
  opciones_recibidas: { label:'Opciones recibidas',   color:'#8b5cf6', bg:'#f5f3ff' },
  seleccionada:       { label:'Seleccionada',         color:'#06b6d4', bg:'#ecfeff' },
  docs_solicitados:   { label:'Docs solicitados',     color:'#f97316', bg:'#fff7ed' },
  contratado:         { label:'Contratado ✓',         color:'#10b981', bg:'#d1fae5' },
  seguimiento:        { label:'Seguimiento',          color:'#059669', bg:'#d1fae5' },
};

const TARIFAS = ['2.0TD','3.0TD','6.1TD','otro'];

const DOCS_CHECKLIST = [
  'DNI/NIE del titular',
  'IBAN bancario',
  'Autorización cambio de comercializadora',
  'Última factura (si no se aportó antes)',
];

const EMPTY_OPCION = { comercializadora:'', precio_kwh:'', ahorro_estimado:'', notas:'', seleccionada:false };

const EMPTY_FORM = {
  contact_id:'', cups:'', tarifa_actual:'2.0TD', comercializadora_actual:'',
  consumo_anual_kwh:'', importe_factura_eur:'', fecha_factura:'',
  comercial_id:'', notas:'',
};

function isAdminSocio(u) { return ['admin','socio'].includes(u.role); }
function genId() { return crypto.randomUUID(); }
function today() { return new Date().toISOString().split('T')[0]; }

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(v));
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  d.setHours(0,0,0,0); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

function renewalBadge(dateStr) {
  const dias = daysUntil(dateStr);
  if (dias === null) return null;
  if (dias < 0) return { label:`⚠️ Vencido hace ${Math.abs(dias)} días`, color:'#dc2626', bg:'#fee2e2' };
  if (dias < 90) return { label:`⚠️ Renovación en ${dias} días`, color:'#dc2626', bg:'#fee2e2' };
  if (dias < 180) return { label:`Revisar en ${dias} días`, color:'#d97706', bg:'#fef3c7' };
  return null;
}

function selSt() {
  return { padding:'7px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, color:'#374151', background:'white', cursor:'pointer' };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function EnergiaSection({ user, users, contacts }) {
  const [procesos, setProcesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ estado:'', comercial:'' });

  const admin = isAdminSocio(user);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('energia_procesos')
      .select('*, contacts(name, phone), users(name)')
      .order('created_at', { ascending:false });
    if (error) console.log('[energia_procesos] error:', error);
    setProcesos(data || []);
    setLoading(false);
  };

  const handleSaved = (rec) => {
    setProcesos(ps => {
      const idx = ps.findIndex(p => p.id === rec.id);
      return idx >= 0 ? ps.map(p => p.id === rec.id ? rec : p) : [rec, ...ps];
    });
    setSelectedId(rec.id);
  };

  const handleDeleted = (id) => {
    setProcesos(ps => ps.filter(p => p.id !== id));
    setSelectedId(null);
  };

  const visibles = admin ? procesos : procesos.filter(p => p.comercial_id === user.id);

  const filtered = visibles.filter(p => {
    if (filters.estado && p.estado !== filters.estado) return false;
    if (filters.comercial && p.comercial_id !== filters.comercial) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [p.contacts?.name, p.comercializadora_actual].filter(Boolean).some(v => v.toLowerCase().includes(q));
      if (!hay) return false;
    }
    return true;
  });

  const total = visibles.length;
  const contratados = visibles.filter(p => p.estado === 'contratado').length;
  const enSeguimiento = visibles.filter(p => p.estado === 'seguimiento').length;
  const proximasRenovaciones = visibles.filter(p => {
    if (!['contratado','seguimiento'].includes(p.estado)) return false;
    const dias = daysUntil(p.fecha_vencimiento);
    return dias !== null && dias < 90;
  }).length;

  const selected = procesos.find(p => p.id === selectedId) || null;

  if (selected) {
    return (
      <FichaProceso proceso={selected} user={user} users={users} contacts={contacts} admin={admin}
        onBack={() => setSelectedId(null)} onSaved={handleSaved} onDeleted={handleDeleted} />
    );
  }

  if (selectedId === 'new') {
    return (
      <FichaProceso proceso={null} user={user} users={users} contacts={contacts} admin={admin}
        onBack={() => setSelectedId(null)} onSaved={handleSaved} onDeleted={handleDeleted} />
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:BRAND }}>⚡ Energía</h1>
          <p style={{ color:'#9ca3af', fontSize:13 }}>{filtered.length} procesos</p>
        </div>
        <button className="btn-p" onClick={() => setSelectedId('new')}>+ Nuevo proceso</button>
      </div>

      {/* Métricas rápidas */}
      <div className="stats-grid">
        {[
          { l:'Total procesos', v:total, i:'⚡', c:BRAND },
          { l:'Contratados', v:contratados, i:'✅', c:'#10b981' },
          { l:'En seguimiento', v:enSeguimiento, i:'🔔', c:'#059669' },
          { l:'Próximas renovaciones', v:proximasRenovaciones, i:'⚠️', c:'#d97706' },
        ].map(s => (
          <div key={s.l} className="sc" style={{ borderLeftColor:s.c }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{s.i}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.c, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.v}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Buscador y filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input className="fi" placeholder="Buscar por cliente o comercializadora..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:280 }} />
        <select value={filters.estado} onChange={e => setFilters(f=>({...f,estado:e.target.value}))} style={selSt()}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_ENERGIA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {admin && (
          <select value={filters.comercial} onChange={e => setFilters(f=>({...f,comercial:e.target.value}))} style={selSt()}>
            <option value="">Todos los comerciales</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        {(search||filters.estado||filters.comercial) && (
          <button onClick={() => { setSearch(''); setFilters({estado:'',comercial:''}); }}
            style={{ ...selSt(), color:'#dc2626', borderColor:'#fee2e2', background:'#fef2f2' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color:'#9ca3af', fontSize:13 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
          {visibles.length === 0 ? 'No hay procesos. Añade el primero.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Cliente','Comercializadora actual','Importe factura','Estado','Comercializadora nueva','Fecha vencimiento','Comercial',''].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const estado = ESTADOS_ENERGIA[p.estado] || ESTADOS_ENERGIA.factura_recibida;
                  const com = users.find(u => u.id === p.comercial_id);
                  const dias = daysUntil(p.fecha_vencimiento);
                  const venceProximo = p.estado === 'contratado' || p.estado === 'seguimiento' ? (dias !== null && dias < 90) : false;
                  return (
                    <tr key={p.id} className="tr" style={{ borderTop:'1px solid #f0f3fb', cursor:'pointer' }} onClick={() => setSelectedId(p.id)}>
                      <td style={{ padding:'9px 13px', fontSize:13, fontWeight:700, color:BRAND }}>{p.contacts?.name || 'Sin cliente'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{p.comercializadora_actual || '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(p.importe_factura_eur)}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:estado.bg, color:estado.color }}>{estado.label}</span>
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{p.estado === 'contratado' || p.estado === 'seguimiento' ? (p.comercializadora_nueva || '—') : '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, whiteSpace:'nowrap', color: venceProximo ? '#dc2626' : '#374151', fontWeight: venceProximo ? 700 : 400 }}>
                        {(p.estado === 'contratado' || p.estado === 'seguimiento') ? (p.fecha_vencimiento || '—') : '—'}
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{com?.name || '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          <button className="btn-g" style={{ padding:'5px 9px' }} onClick={() => setSelectedId(p.id)}>📂 Abrir</button>
                          {admin && (
                            <button onClick={() => quickDelete(p)}
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
    </div>
  );

  async function quickDelete(p) {
    if (!window.confirm(`¿Eliminar el proceso de "${p.contacts?.name || 'este cliente'}"? No se puede deshacer.`)) return;
    const { error } = await supabase.from('energia_procesos').delete().eq('id', p.id);
    if (error) { alert(`Error: ${error.message}`); return; }
    handleDeleted(p.id);
  }
}

// ─── Ficha de proceso (4 pestañas) ───────────────────────────────────────────

function FichaProceso({ proceso, user, users, contacts, admin, onBack, onSaved, onDeleted }) {
  const isNew = !proceso;
  const [tab, setTab] = useState('factura');
  const [proc, setProc] = useState(proceso);
  const canEdit = isNew || admin || proc?.comercial_id === user.id;

  const handleSaved = (rec) => { setProc(rec); onSaved(rec); if (isNew) setTab('factura'); };

  const TABS = [
    { id:'factura',      label:'📄 Factura' },
    { id:'opciones',     label:'📊 Opciones del partner', disabled: isNew },
    { id:'docs',         label:'📋 Documentación',        disabled: isNew },
    { id:'seguimiento',  label:'🔔 Seguimiento',          disabled: isNew || !['contratado','seguimiento'].includes(proc?.estado) },
  ];

  const estado = proc ? (ESTADOS_ENERGIA[proc.estado] || ESTADOS_ENERGIA.factura_recibida) : null;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={onBack}
          style={{ background:'none', border:'1.5px solid #dde2f0', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
          ← Volver
        </button>
        <div style={{ flex:1, minWidth:200 }}>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:800, color:BRAND }}>
            {isNew ? 'Nuevo proceso' : (proc.contacts?.name || 'Ficha de proceso')}
          </h1>
          {proc && (
            <p style={{ fontSize:12, color:'#9ca3af' }}>
              {proc.comercializadora_actual || 'Sin comercializadora actual'}
              {estado && <span style={{ marginLeft:8, padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:estado.bg, color:estado.color }}>{estado.label}</span>}
            </p>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div className="tabs-scroll" style={{ display:'flex', gap:8, marginBottom:22, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab===t.id?'on':''}`}
            disabled={t.disabled}
            onClick={() => !t.disabled && setTab(t.id)}
            style={t.disabled ? { opacity:0.45, cursor:'not-allowed' } : undefined}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'factura' && (
        <TabFactura proceso={proc} isNew={isNew} user={user} users={users} contacts={contacts} admin={admin} canEdit={canEdit}
          onSaved={handleSaved} onDeleted={onDeleted} />
      )}
      {tab === 'opciones' && proc && (
        <TabOpciones proceso={proc} canEdit={canEdit} onSaved={handleSaved} />
      )}
      {tab === 'docs' && proc && (
        <TabDocs proceso={proc} canEdit={canEdit} onSaved={handleSaved} />
      )}
      {tab === 'seguimiento' && proc && ['contratado','seguimiento'].includes(proc.estado) && (
        <TabSeguimiento proceso={proc} canEdit={canEdit} onSaved={handleSaved} />
      )}
    </div>
  );
}

// ─── Tab 1: Factura ───────────────────────────────────────────────────────────

function TabFactura({ proceso, isNew, user, users, contacts, admin, canEdit, onSaved, onDeleted }) {
  const initForm = () => proceso ? {
    contact_id: proceso.contact_id||'', cups: proceso.cups||'', tarifa_actual: proceso.tarifa_actual||'2.0TD',
    comercializadora_actual: proceso.comercializadora_actual||'', consumo_anual_kwh: proceso.consumo_anual_kwh ?? '',
    importe_factura_eur: proceso.importe_factura_eur ?? '', fecha_factura: proceso.fecha_factura||'',
    comercial_id: proceso.comercial_id||'', notas: proceso.notas||'',
  } : { ...EMPTY_FORM, comercial_id: user.id };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cSearch, setCSearch] = useState('');
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const basePayload = () => ({
    contact_id: form.contact_id || null, cups: form.cups || null, tarifa_actual: form.tarifa_actual || null,
    comercializadora_actual: form.comercializadora_actual || null,
    consumo_anual_kwh: numOrNull(form.consumo_anual_kwh), importe_factura_eur: numOrNull(form.importe_factura_eur),
    fecha_factura: form.fecha_factura || null, comercial_id: form.comercial_id || null, notas: form.notas || null,
  });

  const handleSave = async (extra = {}, busySetter = setSaving) => {
    busySetter(true);
    try {
      const payload = { ...basePayload(), ...extra };
      let rec;
      if (isNew) {
        const { data, error } = await supabase.from('energia_procesos')
          .insert({ id: genId(), ...payload, estado: payload.estado || 'factura_recibida', created_at: new Date().toISOString() })
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = data;
      } else {
        const { data, error } = await supabase.from('energia_procesos')
          .update(payload).eq('id', proceso.id)
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = data;
      }
      onSaved(rec);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      busySetter(false);
    }
  };

  const handleEnviarPartner = () => handleSave({ estado:'enviada_partner', fecha_envio_partner: today() }, setSending);

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este proceso? No se puede deshacer.')) return;
    setDeleting(true);
    const { error } = await supabase.from('energia_procesos').delete().eq('id', proceso.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(proceso.id);
  };

  const selCon = contacts.find(c => c.id === form.contact_id);
  const filtCon = cSearch ? contacts.filter(c => c.name?.toLowerCase().includes(cSearch.toLowerCase())).slice(0,15) : [];

  return (
    <div>
      <Sec title="Cliente">
        <div style={{ position:'relative' }}>
          <FL>Cliente</FL>
          {selCon ? (
            <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, maxWidth:400 }}>
              <span style={{ flex:1, fontSize:13, fontWeight:600, color:BRAND }}>{selCon.name}</span>
              <button onClick={() => { set('contact_id',''); setCSearch(''); }} style={{ fontSize:12, color:'#dc2626', border:'none', background:'none', cursor:'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ maxWidth:400 }}>
              <input className="fi" placeholder="Buscar contacto..." value={cSearch} onChange={e => setCSearch(e.target.value)} />
              {filtCon.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, maxWidth:400, background:'white', border:'1.5px solid #dde2f0', borderRadius:8, zIndex:200, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,.12)' }}>
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
            </div>
          )}
        </div>
      </Sec>

      <Sec title="Factura actual">
        <Grid2>
          <div><FL>CUPS</FL><input className="fi" value={form.cups} onChange={e => set('cups', e.target.value)} placeholder="ES0031..." /></div>
          <div>
            <FL>Tarifa actual</FL>
            <select className="fi" value={form.tarifa_actual} onChange={e => set('tarifa_actual', e.target.value)}>
              {TARIFAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div><FL>Comercializadora actual</FL><input className="fi" value={form.comercializadora_actual} onChange={e => set('comercializadora_actual', e.target.value)} /></div>
          <div><FL>Consumo anual (kWh)</FL><input className="fi" type="number" value={form.consumo_anual_kwh} onChange={e => set('consumo_anual_kwh', e.target.value)} /></div>
          <div><FL>Importe última factura (€)</FL><input className="fi" type="number" value={form.importe_factura_eur} onChange={e => set('importe_factura_eur', e.target.value)} /></div>
          <div><FL>Fecha factura</FL><input className="fi" type="date" value={form.fecha_factura} onChange={e => set('fecha_factura', e.target.value)} /></div>
          <div>
            <FL>Comercial asignado</FL>
            <select className="fi" value={form.comercial_id} onChange={e => set('comercial_id', e.target.value)}>
              <option value="">Seleccionar...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </Grid2>
        <div style={{ marginTop:12 }}>
          <FL>Notas generales</FL>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={4}
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:90, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
        </div>
      </Sec>

      {!canEdit ? (
        <p style={{ fontSize:12, color:'#9ca3af' }}>No tienes permiso para editar este proceso.</p>
      ) : (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8, flexWrap:'wrap', gap:10 }}>
          <div>
            {!isNew && admin && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar proceso'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn-g" onClick={() => handleSave()} disabled={saving}>{saving ? 'Guardando...' : (isNew ? '💾 Crear proceso' : '💾 Guardar')}</button>
            {!isNew && (
              <button className="btn-p" onClick={handleEnviarPartner} disabled={sending}>
                {sending ? 'Enviando...' : '📤 Marcar como enviada al partner'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Opciones del partner ─────────────────────────────────────────────

function TabOpciones({ proceso, canEdit, onSaved }) {
  const [rows, setRows] = useState(() => Array.isArray(proceso.opciones_partner) ? proceso.opciones_partner.map(o => ({ ...EMPTY_OPCION, ...o })) : []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(Array.isArray(proceso.opciones_partner) ? proceso.opciones_partner.map(o => ({ ...EMPTY_OPCION, ...o })) : []);
  }, [proceso.id]); // eslint-disable-line

  const addRow = () => setRows(r => [...r, { ...EMPTY_OPCION }]);
  const removeRow = (idx) => setRows(r => r.filter((_,i) => i !== idx));
  const updateRow = (idx, field, val) => setRows(r => r.map((row,i) => i === idx ? { ...row, [field]: val } : row));
  const selectRow = (idx) => setRows(r => r.map((row,i) => ({ ...row, seleccionada: i === idx })));

  const handleSave = async () => {
    setSaving(true);
    try {
      const selected = rows.find(r => r.seleccionada);
      const payload = {
        opciones_partner: rows,
        opcion_seleccionada: selected ? selected.comercializadora : proceso.opcion_seleccionada,
        estado: selected ? 'seleccionada' : (proceso.estado === 'enviada_partner' && rows.length > 0 ? 'opciones_recibidas' : proceso.estado),
      };
      const { data, error } = await supabase.from('energia_procesos').update(payload).eq('id', proceso.id)
        .select('*, contacts(name, phone), users(name)').single();
      if (error) throw error;
      onSaved(data);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Sec title="Envío al partner">
        <p style={{ fontSize:12, color:'#6b7280' }}>
          {proceso.fecha_envio_partner ? `Enviada al partner el ${proceso.fecha_envio_partner}` : 'Todavía no se ha registrado el envío al partner.'}
        </p>
      </Sec>

      <Sec title="Opciones recibidas">
        {rows.length === 0 ? (
          <p style={{ fontSize:13, color:'#9ca3af', marginBottom:14 }}>Sin opciones registradas todavía.</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
            {rows.map((row, idx) => (
              <div key={idx} className="card" style={{ padding:14, border: row.seleccionada ? '2px solid #06b6d4' : '1.5px solid #e8ecf8' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10 }}>
                  <div><FL>Comercializadora</FL><input className="fi" value={row.comercializadora} disabled={!canEdit} onChange={e => updateRow(idx,'comercializadora',e.target.value)} /></div>
                  <div><FL>Precio kWh (€)</FL><input className="fi" type="number" step="0.0001" value={row.precio_kwh} disabled={!canEdit} onChange={e => updateRow(idx,'precio_kwh',e.target.value)} /></div>
                  <div><FL>Ahorro estimado anual (€)</FL><input className="fi" type="number" value={row.ahorro_estimado} disabled={!canEdit} onChange={e => updateRow(idx,'ahorro_estimado',e.target.value)} /></div>
                  <div style={{ gridColumn:'1/-1' }}><FL>Notas</FL><input className="fi" value={row.notas} disabled={!canEdit} onChange={e => updateRow(idx,'notas',e.target.value)} /></div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight: row.seleccionada ? 700 : 500, color: row.seleccionada ? '#06b6d4' : '#374151', cursor: canEdit ? 'pointer' : 'default' }}>
                    <input type="radio" name="opcion-sel" checked={row.seleccionada} disabled={!canEdit} onChange={() => selectRow(idx)}
                      style={{ width:15, height:15, accentColor:'#06b6d4', cursor: canEdit ? 'pointer' : 'default' }} />
                    Seleccionar esta opción
                  </label>
                  {canEdit && <button onClick={() => removeRow(idx)} style={{ background:'none', border:'none', color:'#dc2626', fontSize:12, cursor:'pointer' }}>✕ Quitar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {canEdit && <button className="btn-g" onClick={addRow}>+ Añadir opción</button>}
      </Sec>

      {canEdit && (
        <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
          <button className="btn-p" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar opciones'}</button>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Documentación y contratación ─────────────────────────────────────

function TabDocs({ proceso, canEdit, onSaved }) {
  const [checked, setChecked] = useState(() => DOCS_CHECKLIST.map(() => false));
  const [form, setForm] = useState({
    fecha_contrato: proceso.fecha_contrato||'', comercializadora_nueva: proceso.comercializadora_nueva||'',
    precio_kwh_nuevo: proceso.precio_kwh_nuevo ?? '', fecha_vencimiento: proceso.fecha_vencimiento||'',
  });
  const [savingDocs, setSavingDocs] = useState(false);
  const [savingContrato, setSavingContrato] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;
  const toggleDoc = (idx) => setChecked(c => c.map((v,i) => i===idx ? !v : v));

  const handleMarcarDocsCompletados = async () => {
    setSavingDocs(true);
    try {
      const { data, error } = await supabase.from('energia_procesos').update({ estado:'docs_solicitados' }).eq('id', proceso.id)
        .select('*, contacts(name, phone), users(name)').single();
      if (error) throw error;
      onSaved(data);
    } catch (e) { alert(`Error: ${e.message}`); } finally { setSavingDocs(false); }
  };

  const handleGuardarContratacion = async (extra = {}) => {
    setSavingContrato(true);
    try {
      const payload = {
        fecha_contrato: form.fecha_contrato || null, comercializadora_nueva: form.comercializadora_nueva || null,
        precio_kwh_nuevo: numOrNull(form.precio_kwh_nuevo), fecha_vencimiento: form.fecha_vencimiento || null,
        ...extra,
      };
      const { data, error } = await supabase.from('energia_procesos').update(payload).eq('id', proceso.id)
        .select('*, contacts(name, phone), users(name)').single();
      if (error) throw error;
      onSaved(data);
    } catch (e) { alert(`Error: ${e.message}`); } finally { setSavingContrato(false); }
  };

  const allChecked = checked.every(Boolean);

  return (
    <div>
      <Sec title="Opción seleccionada">
        {proceso.opcion_seleccionada ? (
          <span className="tag" style={{ background:'#ecfeff', color:'#06b6d4', fontSize:13, padding:'5px 14px' }}>{proceso.opcion_seleccionada}</span>
        ) : (
          <p style={{ fontSize:13, color:'#9ca3af' }}>Todavía no se ha seleccionado ninguna oferta.</p>
        )}
      </Sec>

      <Sec title="Documentación solicitada">
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {DOCS_CHECKLIST.map((doc, idx) => (
            <label key={doc} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, cursor: canEdit ? 'pointer' : 'default', fontWeight: checked[idx] ? 700 : 400, color: checked[idx] ? BRAND : '#374151' }}>
              <input type="checkbox" checked={checked[idx]} disabled={!canEdit} onChange={() => toggleDoc(idx)}
                style={{ width:16, height:16, accentColor:BRAND, cursor: canEdit ? 'pointer' : 'default' }} />
              {checked[idx] ? '☑' : '☐'} {doc}
            </label>
          ))}
        </div>
        {canEdit && (
          <button className="btn-g" onClick={handleMarcarDocsCompletados} disabled={savingDocs || !allChecked}
            title={!allChecked ? 'Marca los 4 documentos para continuar' : undefined}>
            {savingDocs ? 'Guardando...' : '☑ Marcar docs completados'}
          </button>
        )}
      </Sec>

      <Sec title="Contratación">
        <Grid2>
          <div><FL>Fecha contrato</FL><input className="fi" type="date" value={form.fecha_contrato} disabled={!canEdit} onChange={e => set('fecha_contrato', e.target.value)} /></div>
          <div><FL>Comercializadora nueva</FL><input className="fi" value={form.comercializadora_nueva} disabled={!canEdit} onChange={e => set('comercializadora_nueva', e.target.value)} /></div>
          <div><FL>Precio kWh nuevo (€)</FL><input className="fi" type="number" step="0.0001" value={form.precio_kwh_nuevo} disabled={!canEdit} onChange={e => set('precio_kwh_nuevo', e.target.value)} /></div>
          <div><FL>Fecha vencimiento contrato</FL><input className="fi" type="date" value={form.fecha_vencimiento} disabled={!canEdit} onChange={e => set('fecha_vencimiento', e.target.value)} /></div>
        </Grid2>
        {canEdit && (
          <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:16, borderTop:'1px solid #e8ecf8', flexWrap:'wrap' }}>
            <button className="btn-g" onClick={() => handleGuardarContratacion()} disabled={savingContrato}>{savingContrato ? 'Guardando...' : '💾 Guardar contratación'}</button>
            <button className="btn-p" onClick={() => handleGuardarContratacion({ estado:'contratado' })} disabled={savingContrato}>
              {savingContrato ? 'Guardando...' : '✓ Marcar como contratado'}
            </button>
          </div>
        )}
      </Sec>
    </div>
  );
}

// ─── Tab 4: Seguimiento ──────────────────────────────────────────────────────

function TabSeguimiento({ proceso, canEdit, onSaved }) {
  const [form, setForm] = useState({ ahorro_real_eur: proceso.ahorro_real_eur ?? '', notas: proceso.notas || '' });
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const alerta = renewalBadge(proceso.fecha_vencimiento);

  const handleSave = async (extra = {}, busySetter = setSaving) => {
    busySetter(true);
    try {
      const payload = { ahorro_real_eur: numOrNull(form.ahorro_real_eur), notas: form.notas || null, ...extra };
      const { data, error } = await supabase.from('energia_procesos').update(payload).eq('id', proceso.id)
        .select('*, contacts(name, phone), users(name)').single();
      if (error) throw error;
      onSaved(data);
    } catch (e) { alert(`Error: ${e.message}`); } finally { busySetter(false); }
  };

  return (
    <div>
      <Sec title="Vencimiento">
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <div><FL>Fecha vencimiento</FL><p style={{ fontSize:14, fontWeight:700, color:'#1e2a4a' }}>{proceso.fecha_vencimiento || '—'}</p></div>
          {alerta && <span className="tag" style={{ background:alerta.bg, color:alerta.color, fontSize:12, padding:'5px 12px', fontWeight:800 }}>{alerta.label}</span>}
        </div>
      </Sec>

      <Sec title="Seguimiento">
        <Grid2>
          <div><FL>Ahorro real (€)</FL><input className="fi" type="number" value={form.ahorro_real_eur} disabled={!canEdit} onChange={e => set('ahorro_real_eur', e.target.value)} /></div>
        </Grid2>
        <div style={{ marginTop:12 }}>
          <FL>Notas de seguimiento</FL>
          <textarea value={form.notas} disabled={!canEdit} onChange={e => set('notas', e.target.value)} rows={4}
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:90, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
        </div>
        {canEdit && (
          <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:16, borderTop:'1px solid #e8ecf8', flexWrap:'wrap' }}>
            <button className="btn-g" onClick={() => handleSave()} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar'}</button>
            {proceso.estado !== 'seguimiento' && (
              <button className="btn-p" onClick={() => handleSave({ estado:'seguimiento' }, setActivating)} disabled={activating}>
                {activating ? 'Activando...' : '🔔 Activar seguimiento'}
              </button>
            )}
          </div>
        )}
      </Sec>
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
