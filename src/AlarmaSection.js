import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#002292';

const PROVEEDORES_ALARMA = {
  prosegur: {
    label: "Movistar Prosegur", color: "#1e40af", bg: "#eff6ff", icon: "📡",
    comision: 250,
    promo: "SuperCámara Inteligente GRATIS hasta 31/08/2026",
    packs_hogar: [
      { id:"presense_equipo",    nombre:"PreSense Equipo completo",          instalacion:99, cuota:48.90 },
      { id:"presense_shocks",    nombre:"PreSense + Shocksensors (2-6)",     instalacion:99, cuota:48.90 },
      { id:"presense_zero",      nombre:"PreSense Zerovision Anti-ocupación",instalacion:99, cuota:48.90 },
      { id:"presense_camara",    nombre:"PreSense Videovigilancia Interior", instalacion:99, cuota:48.90 },
    ],
    packs_negocio: [
      { id:"presense_neg",       nombre:"PreSense Negocio",                  instalacion:99, cuota:48.90 },
      { id:"presense_neg_blind", nombre:"PreSense Negocio + Blindaje",       instalacion:99, cuota:48.90 },
      { id:"presense_neg_zero",  nombre:"PreSense Negocio Zerovision",       instalacion:99, cuota:48.90 },
    ],
  },
  verisure: {
    label: "Verisure", color: "#dc2626", bg: "#fef2f2", icon: "🛡️",
    comision_renove: 200,
    comision_otros: 300,
    promo_agosto: "SUPER PROMO: 24,90€/mes durante 12 meses (hasta 31/08/2026)",
    promo_renove: "RENOVE: 6 meses a 29,90€. Cuota reducida: 43,50€ hogar / 42,00€ negocio",
    packs_hogar: [
      { id:"presense_res",       nombre:"PreSense Residencial",              instalacion:99,  cuota:49.80 },
      { id:"presense_smartlock", nombre:"PreSense Smartlock",                instalacion:198, cuota:49.80 },
    ],
    packs_negocio: [
      { id:"presense_neg_v",     nombre:"PreSense Negocio",                  instalacion:99, cuota:46.80 },
    ],
  },
  segurma: {
    label: "Segurma", color: "#ea580c", bg: "#fff7ed", icon: "🔒",
    comision_simple: 150,
    comision_otros: 300,
    nota: "Permanencia 24m hogar / 36m negocio. Alarma Simple no acumula promociones.",
    packs_hogar: [
      { id:"tranq_hogar",        nombre:"Tranquilidad Hogar",                instalacion:0, cuota:29.90, permanencia:24 },
      { id:"tranq_bateria",      nombre:"Tranquilidad + Batería Externa",    instalacion:0, cuota:76.46, permanencia:24 },
    ],
    packs_negocio: [
      { id:"tranq_neg",          nombre:"Tranquilidad Negocio",              instalacion:0, cuota:29.90, permanencia:36 },
    ],
  },
};

const PROVEEDOR_KEYS = Object.keys(PROVEEDORES_ALARMA);

const ESTADOS_ALARMA = {
  prospecto: { label:'Prospecto',   color:'#6b7280', bg:'#f3f4f6' },
  contacto:  { label:'Contacto',    color:'#2563eb', bg:'#dbeafe' },
  visita:    { label:'Visita',      color:'#7c3aed', bg:'#f5f3ff' },
  propuesta: { label:'Propuesta',   color:'#0891b2', bg:'#ecfeff' },
  contrato:  { label:'Contrato',    color:'#d97706', bg:'#fef3c7' },
  instalado: { label:'Instalado ✓', color:'#059669', bg:'#d1fae5' },
  perdido:   { label:'Perdido ✗',   color:'#dc2626', bg:'#fee2e2' },
};

const EMPTY_FORM = {
  contact_id:'', proveedor:'', tipo_cliente:'hogar', es_renove:false,
  pack:'', extras:'', instalacion_eur:'', cuota_eur:'', permanencia_m:'', promo_activa:'',
  estado:'prospecto', fecha_contrato:'', fecha_instalacion:'',
  comision_cobrada:'', notas:'', comercial_id:'',
};

function isAdminSocio(u) { return ['admin','socio'].includes(u.role); }
function genId() { return crypto.randomUUID(); }

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(v));
}

function getPacksFor(proveedorKey, tipoCliente) {
  const prov = PROVEEDORES_ALARMA[proveedorKey];
  if (!prov) return [];
  return (tipoCliente === 'negocio' ? prov.packs_negocio : prov.packs_hogar) || [];
}
function findPack(proveedorKey, tipoCliente, packId) {
  return getPacksFor(proveedorKey, tipoCliente).find(p => p.id === packId) || null;
}
function calcComisionEsperada(proveedorKey, packId, esRenove) {
  const prov = PROVEEDORES_ALARMA[proveedorKey];
  if (!prov) return null;
  if (proveedorKey === 'prosegur') return prov.comision;
  if (proveedorKey === 'verisure') return esRenove ? prov.comision_renove : prov.comision_otros;
  if (proveedorKey === 'segurma') return (packId === 'tranq_hogar' || packId === 'tranq_neg') ? prov.comision_simple : prov.comision_otros;
  return null;
}
function getPromoText(proveedorKey, esRenove) {
  const prov = PROVEEDORES_ALARMA[proveedorKey];
  if (!prov) return '';
  if (proveedorKey === 'prosegur') return prov.promo || '';
  if (proveedorKey === 'verisure') return esRenove ? (prov.promo_renove||'') : (prov.promo_agosto||'');
  if (proveedorKey === 'segurma') return prov.nota || '';
  return '';
}
function isSameMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function selSt() {
  return { padding:'7px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, color:'#374151', background:'white', cursor:'pointer' };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function AlarmaSection({ user, users, contacts }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null=cerrado, 'new'=crear, obj=editar
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ proveedor:'', tipo_cliente:'', estado:'' });

  const admin = isAdminSocio(user);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('alarm_contracts')
      .select('*, contacts(name, phone), users(name)')
      .order('created_at', { ascending:false });
    if (error) console.log('[alarm_contracts] error:', error);
    setContracts(data || []);
    setLoading(false);
  };

  const handleSaved = (rec) => {
    setContracts(cs => {
      const idx = cs.findIndex(c => c.id === rec.id);
      return idx >= 0 ? cs.map(c => c.id === rec.id ? rec : c) : [rec, ...cs];
    });
    setModal(null);
  };

  const handleDeleted = (id) => {
    setContracts(cs => cs.filter(c => c.id !== id));
    setModal(null);
  };

  const visibles = admin ? contracts : contracts.filter(c => c.comercial_id === user.id);

  const filtered = visibles.filter(c => {
    if (filters.proveedor && c.proveedor !== filters.proveedor) return false;
    if (filters.tipo_cliente && c.tipo_cliente !== filters.tipo_cliente) return false;
    if (filters.estado && c.estado !== filters.estado) return false;
    if (search) {
      const nombre = c.contacts?.name || '';
      if (!nombre.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const total = visibles.length;
  const instalados = visibles.filter(c => c.estado === 'instalado').length;
  const enProceso = visibles.filter(c => !['instalado','perdido'].includes(c.estado)).length;
  const comisionesMes = visibles.filter(c => isSameMonth(c.fecha_contrato)).reduce((s,c) => s + (Number(c.comision_esperada)||0), 0);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:BRAND }}>🔐 Alarmas</h1>
          <p style={{ color:'#9ca3af', fontSize:13 }}>{filtered.length} contratos</p>
        </div>
        <button className="btn-p" onClick={() => setModal('new')}>+ Nuevo contrato</button>
      </div>

      {/* Métricas rápidas */}
      <div className="stats-grid">
        {[
          { l:'Total contratos', v:total, i:'🔐', c:BRAND },
          { l:'Instalados', v:instalados, i:'✅', c:'#059669' },
          { l:'En proceso', v:enProceso, i:'🔄', c:'#d97706' },
          ...(admin ? [{ l:'Comisiones mes', v:fmt(comisionesMes), i:'💶', c:'#7c3aed' }] : []),
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
        <input className="fi" placeholder="Buscar por cliente..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:240 }} />
        <select value={filters.proveedor} onChange={e => setFilters(f=>({...f,proveedor:e.target.value}))} style={selSt()}>
          <option value="">Todos los proveedores</option>
          {PROVEEDOR_KEYS.map(k => <option key={k} value={k}>{PROVEEDORES_ALARMA[k].label}</option>)}
        </select>
        <select value={filters.tipo_cliente} onChange={e => setFilters(f=>({...f,tipo_cliente:e.target.value}))} style={selSt()}>
          <option value="">Hogar y negocio</option>
          <option value="hogar">Hogar</option>
          <option value="negocio">Negocio</option>
        </select>
        <select value={filters.estado} onChange={e => setFilters(f=>({...f,estado:e.target.value}))} style={selSt()}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_ALARMA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(search||filters.proveedor||filters.tipo_cliente||filters.estado) && (
          <button onClick={() => { setSearch(''); setFilters({proveedor:'',tipo_cliente:'',estado:''}); }}
            style={{ ...selSt(), color:'#dc2626', borderColor:'#fee2e2', background:'#fef2f2' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color:'#9ca3af', fontSize:13 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
          {visibles.length === 0 ? 'No hay contratos. Añade el primero.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Cliente','Proveedor','Tipo','Pack','Cuota €/mes','Estado', ...(admin?['Comisión esperada']:[]), 'Fecha contrato','Fecha instalación',''].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const prov = PROVEEDORES_ALARMA[c.proveedor];
                  const pack = findPack(c.proveedor, c.tipo_cliente, c.pack);
                  const estado = ESTADOS_ALARMA[c.estado] || ESTADOS_ALARMA.prospecto;
                  const canEdit = admin || c.comercial_id === user.id;
                  return (
                    <tr key={c.id} className="tr" style={{ borderTop:'1px solid #f0f3fb' }}>
                      <td style={{ padding:'9px 13px' }}>
                        <button onClick={() => setModal(c)} style={{ fontSize:13, fontWeight:700, color:BRAND, background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}>
                          {c.contacts?.name || 'Sin cliente'}
                        </button>
                        {c.contacts?.phone && <div style={{ fontSize:11, color:'#9ca3af' }}>{c.contacts.phone}</div>}
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        {prov && <span className="tag" style={{ background:prov.bg, color:prov.color }}>{prov.icon} {prov.label}</span>}
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', textTransform:'capitalize' }}>{c.tipo_cliente}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{pack?.nombre || c.pack || '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(c.cuota_eur)}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:estado.bg, color:estado.color }}>{estado.label}</span>
                      </td>
                      {admin && <td style={{ padding:'9px 13px', fontSize:12, color:'#059669', fontWeight:700, whiteSpace:'nowrap' }}>{fmt(c.comision_esperada)}</td>}
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{c.fecha_contrato || '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{c.fecha_instalacion || '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          {canEdit && <button className="btn-g" style={{ padding:'5px 9px' }} onClick={() => setModal(c)}>✏️</button>}
                          {admin && (
                            <button onClick={() => quickDelete(c)}
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
        <ContratoModal
          contract={modal === 'new' ? null : modal}
          user={user} users={users} contacts={contacts} admin={admin}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );

  async function quickDelete(contract) {
    if (!window.confirm(`¿Eliminar el contrato de "${contract.contacts?.name || 'este cliente'}"? No se puede deshacer.`)) return;
    const { error } = await supabase.from('alarm_contracts').delete().eq('id', contract.id);
    if (error) { alert(`Error: ${error.message}`); return; }
    handleDeleted(contract.id);
  }
}

// ─── Modal Nuevo / Editar ────────────────────────────────────────────────────

function ContratoModal({ contract, user, users, contacts, admin, onClose, onSaved, onDeleted }) {
  const isNew = !contract;
  const canEdit = isNew || admin || contract.comercial_id === user.id;

  const initForm = () => contract ? {
    contact_id: contract.contact_id||'', proveedor: contract.proveedor||'', tipo_cliente: contract.tipo_cliente||'hogar',
    es_renove: contract.es_renove||false, pack: contract.pack||'', extras: contract.extras||'',
    instalacion_eur: contract.instalacion_eur ?? '', cuota_eur: contract.cuota_eur ?? '',
    permanencia_m: contract.permanencia_m ?? '', promo_activa: contract.promo_activa||'',
    estado: contract.estado||'prospecto', fecha_contrato: contract.fecha_contrato||'', fecha_instalacion: contract.fecha_instalacion||'',
    comision_cobrada: contract.comision_cobrada ?? '', notas: contract.notas||'', comercial_id: contract.comercial_id||'',
  } : { ...EMPTY_FORM, comercial_id: user.id };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cSearch, setCSearch] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const packsDisponibles = getPacksFor(form.proveedor, form.tipo_cliente);
  const packSeleccionado = findPack(form.proveedor, form.tipo_cliente, form.pack);
  const comisionEstimada = form.proveedor ? calcComisionEsperada(form.proveedor, form.pack, form.es_renove) : null;
  const promoProveedor = form.proveedor ? getPromoText(form.proveedor, form.es_renove) : '';
  const prov = PROVEEDORES_ALARMA[form.proveedor];

  const selectProveedor = (key) => {
    setForm(f => ({
      ...f, proveedor: key, es_renove: key === 'verisure' ? f.es_renove : false,
      pack: '', instalacion_eur: '', cuota_eur: '', permanencia_m: '',
      promo_activa: getPromoText(key, key === 'verisure' ? f.es_renove : false),
    }));
  };

  const toggleRenove = () => {
    setForm(f => {
      const esRenove = !f.es_renove;
      return { ...f, es_renove: esRenove, promo_activa: getPromoText(f.proveedor, esRenove) };
    });
  };

  const selectPack = (packId) => {
    const p = findPack(form.proveedor, form.tipo_cliente, packId);
    setForm(f => ({
      ...f, pack: packId,
      instalacion_eur: p ? p.instalacion : f.instalacion_eur,
      cuota_eur: p ? p.cuota : f.cuota_eur,
      permanencia_m: p && p.permanencia !== undefined ? p.permanencia : f.permanencia_m,
    }));
  };

  const selectTipoCliente = (tipo) => {
    setForm(f => ({ ...f, tipo_cliente: tipo, pack:'', instalacion_eur:'', cuota_eur:'', permanencia_m:'' }));
  };

  const handleSave = async () => {
    if (!form.proveedor) { alert('Selecciona un proveedor'); return; }
    setSaving(true);
    try {
      const payload = {
        contact_id: form.contact_id || null,
        proveedor: form.proveedor,
        tipo_cliente: form.tipo_cliente,
        pack: form.pack || null,
        es_renove: form.proveedor === 'verisure' ? !!form.es_renove : false,
        extras: form.extras || null,
        instalacion_eur: numOrNull(form.instalacion_eur),
        cuota_eur: numOrNull(form.cuota_eur),
        permanencia_m: numOrNull(form.permanencia_m),
        promo_activa: form.promo_activa || null,
        comision_esperada: calcComisionEsperada(form.proveedor, form.pack, form.es_renove),
        estado: form.estado,
        fecha_contrato: form.fecha_contrato || null,
        fecha_instalacion: form.fecha_instalacion || null,
        notas: form.notas || null,
        comercial_id: form.comercial_id || null,
      };
      if (admin) payload.comision_cobrada = numOrNull(form.comision_cobrada);

      let rec;
      if (isNew) {
        const { data: d, error } = await supabase.from('alarm_contracts')
          .insert({ id: genId(), ...payload, created_at: new Date().toISOString() })
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = d;
      } else {
        const { data: d, error } = await supabase.from('alarm_contracts')
          .update(payload).eq('id', contract.id)
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
    if (!window.confirm('¿Eliminar este contrato? No se puede deshacer.')) return;
    setDeleting(true);
    const { error } = await supabase.from('alarm_contracts').delete().eq('id', contract.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(contract.id);
  };

  const selCon = contacts.find(c => c.id === form.contact_id);
  const filtCon = cSearch ? contacts.filter(c => c.name?.toLowerCase().includes(cSearch.toLowerCase())).slice(0,15) : [];

  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo mo-lg">
        <h2 style={{ fontSize:17, fontWeight:800, color:BRAND, marginBottom:18 }}>
          {isNew ? 'Nuevo contrato' : `Contrato · ${contract.contacts?.name || 'Cliente'}`}
        </h2>

        <Sec title="1. Cliente y proveedor">
          <div style={{ marginBottom:14, position:'relative' }}>
            <FL>Cliente</FL>
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

          <FL>Proveedor</FL>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
            {PROVEEDOR_KEYS.map(key => {
              const p = PROVEEDORES_ALARMA[key];
              const on = form.proveedor === key;
              return (
                <button key={key} onClick={() => selectProveedor(key)}
                  style={{
                    padding:'14px 12px', borderRadius:12, cursor:'pointer', textAlign:'center',
                    border: on ? `2px solid ${p.color}` : '2px solid #e8ecf8',
                    background: on ? p.bg : 'white',
                    transition:'all .15s',
                  }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>{p.icon}</div>
                  <div style={{ fontSize:13, fontWeight:800, color: on ? p.color : '#374151' }}>{p.label}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display:'flex', gap:20, flexWrap:'wrap', alignItems:'center' }}>
            <div>
              <FL>Tipo cliente</FL>
              <div style={{ display:'flex', gap:6 }}>
                {['hogar','negocio'].map(t => (
                  <button key={t} onClick={() => selectTipoCliente(t)}
                    style={{
                      padding:'7px 18px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, textTransform:'capitalize',
                      border: form.tipo_cliente===t ? `1.5px solid ${BRAND}` : '1.5px solid #dde2f0',
                      background: form.tipo_cliente===t ? BRAND : 'white',
                      color: form.tipo_cliente===t ? 'white' : '#374151',
                    }}>{t}</button>
                ))}
              </div>
            </div>

            {form.proveedor === 'verisure' && (
              <div>
                <FL>¿Es Renove?</FL>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button onClick={toggleRenove}
                    style={{
                      padding:'7px 18px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700,
                      border: form.es_renove ? '1.5px solid #059669' : '1.5px solid #dde2f0',
                      background: form.es_renove ? '#d1fae5' : 'white',
                      color: form.es_renove ? '#059669' : '#374151',
                    }}>{form.es_renove ? '✓ Renove' : 'No es Renove'}</button>
                  {form.es_renove && <span className="tag" style={{ background:'#d1fae5', color:'#059669', fontWeight:800 }}>Comisión 200€</span>}
                </div>
              </div>
            )}
          </div>
        </Sec>

        {form.proveedor && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:20, alignItems:'start' }} className="form-grid">
            <div>
              <Sec title="2. Configuración">
                <Grid2>
                  <div style={{ gridColumn:'1/-1' }}>
                    <FL>Pack</FL>
                    <select className="fi" value={form.pack} onChange={e => selectPack(e.target.value)}>
                      <option value="">Seleccionar pack...</option>
                      {packsDisponibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <FL>Extras</FL>
                    <textarea value={form.extras} onChange={e => set('extras', e.target.value)} rows={2}
                      placeholder="2 Shocksensors adicionales, Cámara exterior..."
                      style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:56, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
                  </div>
                  <div><FL>Instalación (€)</FL><input className="fi" type="number" value={form.instalacion_eur} onChange={e => set('instalacion_eur', e.target.value)} /></div>
                  <div><FL>Cuota (€/mes)</FL><input className="fi" type="number" value={form.cuota_eur} onChange={e => set('cuota_eur', e.target.value)} /></div>
                  <div><FL>Permanencia (meses)</FL><input className="fi" type="number" value={form.permanencia_m} onChange={e => set('permanencia_m', e.target.value)} /></div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <FL>Promo activa</FL>
                    <input className="fi" value={form.promo_activa} onChange={e => set('promo_activa', e.target.value)} placeholder="Promoción aplicada a este contrato" />
                  </div>
                </Grid2>
              </Sec>
            </div>

            {/* Panel lateral informativo */}
            <div style={{ background:'#f8f9fd', borderRadius:12, padding:16, position:'sticky', top:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Resumen</div>
              {prov && (
                <div style={{ marginBottom:12 }}>
                  <span className="tag" style={{ background:prov.bg, color:prov.color }}>{prov.icon} {prov.label}</span>
                </div>
              )}
              <div style={{ background:'#d1fae5', borderRadius:10, padding:'12px 14px', marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:'.5px' }}>Comisión estimada</div>
                <div style={{ fontSize:24, fontWeight:800, color:'#059669', fontFamily:"'Barlow Condensed',sans-serif" }}>
                  {comisionEstimada !== null ? fmt(comisionEstimada) : '—'}
                </div>
              </div>
              {packSeleccionado && (
                <div style={{ fontSize:12, color:'#374151', marginBottom:12 }}>
                  <strong>{packSeleccionado.nombre}</strong><br/>
                  Instalación {fmt(packSeleccionado.instalacion)} · Cuota {fmt(packSeleccionado.cuota)}/mes
                </div>
              )}
              {promoProveedor && (
                <div style={{ background:'#fffbeb', borderRadius:8, padding:'10px 12px', fontSize:11, color:'#92400e', lineHeight:1.5 }}>
                  🎁 {promoProveedor}
                </div>
              )}
            </div>
          </div>
        )}

        <Sec title="3. Proceso">
          <Grid2>
            <div>
              <FL>Estado</FL>
              <select className="fi" value={form.estado} onChange={e => set('estado',e.target.value)}>
                {Object.entries(ESTADOS_ALARMA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <FL>Comercial asignado</FL>
              <select className="fi" value={form.comercial_id} onChange={e => set('comercial_id',e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div><FL>Fecha contrato</FL><input className="fi" type="date" value={form.fecha_contrato} onChange={e => set('fecha_contrato',e.target.value)} /></div>
            <div><FL>Fecha instalación</FL><input className="fi" type="date" value={form.fecha_instalacion} onChange={e => set('fecha_instalacion',e.target.value)} /></div>
            {admin && (
              <div><FL>Comisión cobrada (€)</FL><input className="fi" type="number" value={form.comision_cobrada} onChange={e => set('comision_cobrada',e.target.value)} /></div>
            )}
          </Grid2>
          <div style={{ marginTop:12 }}>
            <FL>Notas</FL>
            <textarea value={form.notas} onChange={e => set('notas',e.target.value)}
              placeholder="Notas internas sobre el contrato, negociación, condiciones..." rows={4}
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:90, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
          </div>
        </Sec>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
          <div>
            {!isNew && admin && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-g" onClick={onClose}>Cancelar</button>
            {canEdit && (
              <button className="btn-p" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : '✓ Guardar'}
              </button>
            )}
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
