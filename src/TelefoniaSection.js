import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#002292';

// ─── Datos de tarifas y comisiones (LOWI) ────────────────────────────────────

const TARIFAS_LOWI = {
  convergente_fit: [
    [300, 50, 20],  [300, 100, 23],  [300, 150, 25],  [300, 300, 27],
    [600, 50, 23],  [600, 100, 26],  [600, 150, 28],  [600, 300, 30],
    [1000, 50, 25], [1000, 100, 28], [1000, 150, 30], [1000, 300, 32],
  ],
  solo_movil: [
    [50, 8], [100, 10], [150, 15], [300, 20],
  ],
  lineas_adicionales: [
    [5, 4], [50, 5], [100, 8], [150, 10], [300, 12],
  ],
  privada: [
    { nombre:"Privada 300Mb + 25GB", fibra:300, gb:25, precio:25 },
    { nombre:"Privada 600Mb + 40GB", fibra:600, gb:40, precio:28 },
  ],
};

const COMISIONES_LOWI = {
  convergente_porta: [
    [300, 50, 64.30],  [300, 100, 79.60],  [300, 150, 83.20],  [300, 300, 98.50],
    [600, 50, 74.30],  [600, 100, 89.60],  [600, 150, 93.20],  [600, 300, 108.50],
    [1000, 50, 84.30], [1000, 100, 99.60], [1000, 150, 103.20],[1000, 300, 118.50],
  ],
  convergente_alta: [
    [300, 50, 45.40],  [300, 100, 56.20],  [300, 150, 58.90],  [300, 300, 68.80],
    [600, 50, 55.40],  [600, 100, 66.20],  [600, 150, 68.90],  [600, 300, 78.80],
    [1000, 50, 65.40], [1000, 100, 76.20], [1000, 150, 78.90], [1000, 300, 88.80],
  ],
  solo_movil_porta:  [[50, 27.00], [100, 36.00], [150, 54.00], [300, 72.00]],
  solo_movil_alta:   [[50, 10.35], [100, 11.70], [150, 19.80], [300, 27.90]],
  segundas_porta:    [[5, 8.10],  [50, 23.40], [100, 26.55], [150, 29.70], [300, 35.10]],
  segundas_alta:     [[5, 3.60],  [50, 11.70], [100, 12.15], [150, 12.60], [300, 13.50]],
  solo_fibra_fit:    { 600: 37.50, 1000: 45.00 },
  acelerador_junio:  40,
};

function getComision(tipo_contrato, fibra_mb, movil_gb, tipo_alta) {
  const esPorta = tipo_alta === 'portabilidad';
  if (tipo_contrato === 'convergente') {
    const tabla = esPorta ? COMISIONES_LOWI.convergente_porta : COMISIONES_LOWI.convergente_alta;
    const fila = tabla.find(r => r[0] === fibra_mb && r[1] === movil_gb);
    return fila ? fila[2] : null;
  }
  if (tipo_contrato === 'solo_movil') {
    const tabla = esPorta ? COMISIONES_LOWI.solo_movil_porta : COMISIONES_LOWI.solo_movil_alta;
    const fila = tabla.find(r => r[0] === movil_gb);
    return fila ? fila[1] : null;
  }
  if (tipo_contrato === 'solo_fibra') {
    return COMISIONES_LOWI.solo_fibra_fit[fibra_mb] || null;
  }
  if (tipo_contrato === 'linea_adicional') {
    const tabla = esPorta ? COMISIONES_LOWI.segundas_porta : COMISIONES_LOWI.segundas_alta;
    const fila = tabla.find(r => r[0] === movil_gb);
    return fila ? fila[1] : null;
  }
  return null;
}

const STREAMING_EXTRAS = {
  prime:   { label:'Amazon Prime', precio:4 },
  disney:  { label:'Disney+',      precio:5 },
  netflix: { label:'Netflix',      precio:6 },
};

const OPERADORES = {
  lowi:     { label:'LOWI',     color:'#1e3a8a', bg:'#eff6ff', icon:'📶' },
  vodafone: { label:'Vodafone', color:'#dc2626', bg:'#fef2f2', icon:'📡' },
};

const TIPOS_CONTRATO = [
  { id:'convergente',     label:'Convergente' },
  { id:'solo_movil',      label:'Solo Móvil' },
  { id:'solo_fibra',      label:'Solo Fibra' },
  { id:'linea_adicional', label:'Línea Adicional' },
];

const TIPOS_ALTA = [
  { id:'portabilidad',    label:'Portabilidad' },
  { id:'alta_nueva',      label:'Alta Nueva' },
  { id:'desde_vodafone',  label:'Desde Vodafone' },
];

const ESTADOS_TELEFONIA = {
  prospecto:        { label:'Prospecto',        color:'#6b7280', bg:'#f3f4f6' },
  documentacion:    { label:'Documentación',    color:'#2563eb', bg:'#dbeafe' },
  enviado_operador: { label:'Enviado operador', color:'#7c3aed', bg:'#f5f3ff' },
  en_tramite:       { label:'En trámite',       color:'#d97706', bg:'#fef3c7' },
  activo:           { label:'Activo ✓',         color:'#059669', bg:'#d1fae5' },
  incidencia:       { label:'Incidencia ⚠️',     color:'#f97316', bg:'#fff7ed' },
  baja:             { label:'Baja ✗',           color:'#dc2626', bg:'#fee2e2' },
};

const EMPTY_FORM = {
  contact_id:'', operador:'', tipo_cliente:'particular',
  tipo_contrato:'convergente', fibra_mb:'', movil_gb:'', huella:'fit', tarifa_privada:false,
  precio_mes:'', lineas_adicionales:[], streaming:[],
  tipo_alta:'alta_nueva', num_principal:'', operador_donante:'', procedencia:'contrato', icc_prepago:'',
  titular_nombre:'', titular_apellidos:'', dni_nie:'', fecha_nacimiento:'', titular_cuenta:'', iban:'',
  dni_recibido:false, iban_recibido:false, escrituras_recibidas:false, recibo_autonomo_recibido:false, dni_administrador_recibido:false,
  estado:'prospecto', fecha_solicitud:'', fecha_activacion:'', fecha_vencimiento:'',
  comision_cobrada:'', notas:'', comercial_id:'',
};

function isAdminSocio(u) { return ['admin','socio'].includes(u.role); }
function genId() { return crypto.randomUUID(); }

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Number(v));
}

function isSameMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isValidIBAN(iban) {
  if (!iban) return true; // opcional, no bloquea si está vacío
  return /^ES\d{22}$/.test(String(iban).replace(/\s/g,'').toUpperCase());
}

function calcClawback(fechaActivacion) {
  if (!fechaActivacion) return false;
  return (new Date() - new Date(fechaActivacion)) / (1000*60*60*24) < 180;
}
function clawbackVenceFecha(fechaActivacion) {
  const d = new Date(fechaActivacion);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 180);
  return d.toISOString().split('T')[0];
}

function precioBase(form) {
  if (form.tipo_contrato === 'convergente') {
    if (form.tarifa_privada) {
      const opt = TARIFAS_LOWI.privada.find(p => p.fibra === form.fibra_mb && p.gb === form.movil_gb);
      return opt ? opt.precio : null;
    }
    const fila = TARIFAS_LOWI.convergente_fit.find(r => r[0] === form.fibra_mb && r[1] === form.movil_gb);
    if (!fila) return null;
    return fila[2] + (form.huella === 'no_fit' ? 10 : 0);
  }
  if (form.tipo_contrato === 'solo_movil') {
    const fila = TARIFAS_LOWI.solo_movil.find(r => r[0] === form.movil_gb);
    return fila ? fila[1] : null;
  }
  if (form.tipo_contrato === 'linea_adicional') {
    const fila = TARIFAS_LOWI.lineas_adicionales.find(r => r[0] === form.movil_gb);
    return fila ? fila[1] : null;
  }
  return null; // solo_fibra: sin tabla, precio manual
}
function precioLineaAdicional(gb) {
  const fila = TARIFAS_LOWI.lineas_adicionales.find(r => r[0] === gb);
  return fila ? fila[1] : null;
}
function calcStreamingTotal(streaming) {
  return (streaming||[]).reduce((s,k) => s + (STREAMING_EXTRAS[k]?.precio || 0), 0);
}
function calcPrecioMes(form) {
  const base = precioBase(form);
  if (base === null) return null;
  const streamingTotal = form.tipo_contrato === 'convergente' ? calcStreamingTotal(form.streaming) : 0;
  return Number((base + streamingTotal).toFixed(2));
}
function calcComisionBase(form) {
  return getComision(form.tipo_contrato, form.fibra_mb, form.movil_gb, form.tipo_alta);
}
function isJunio() { return new Date().getMonth() + 1 === 6; }
function calcAceleradorJunio(form) {
  return (isJunio() && form.tipo_contrato === 'convergente') ? COMISIONES_LOWI.acelerador_junio : 0;
}
function calcComisionTotal(form) {
  const base = calcComisionBase(form);
  if (base === null) return null;
  return Number((base + calcAceleradorJunio(form)).toFixed(2));
}

function resumenTarifa(c) {
  if (c.tipo_contrato === 'convergente') return `Fibra ${c.fibra_mb||'—'}Mb + ${c.movil_gb||'—'}GB`;
  if (c.tipo_contrato === 'solo_movil') return `Solo Móvil ${c.movil_gb||'—'}GB`;
  if (c.tipo_contrato === 'solo_fibra') return `Solo Fibra ${c.fibra_mb||'—'}Mb`;
  if (c.tipo_contrato === 'linea_adicional') return `Línea adicional ${c.movil_gb||'—'}GB`;
  return '—';
}

function getChecklist(operador, tipoCliente) {
  if (operador === 'vodafone' && tipoCliente === 'empresa') return [
    { key:'dni_recibido', label:'CIF empresa' },
    { key:'dni_administrador_recibido', label:'DNI del administrador' },
    { key:'escrituras_recibidas', label:'Escrituras' },
    { key:'iban_recibido', label:'Recibo bancario de empresa' },
  ];
  if (operador === 'vodafone' && tipoCliente === 'autonomo') return [
    { key:'dni_recibido', label:'DNI/NIE ambas caras' },
    { key:'recibo_autonomo_recibido', label:'Recibo de autónomo' },
    { key:'iban_recibido', label:'IBAN confirmado' },
  ];
  return [
    { key:'dni_recibido', label:'DNI/NIE ambas caras' },
    { key:'iban_recibido', label:'IBAN confirmado' },
  ];
}

function selSt() {
  return { padding:'7px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, color:'#374151', background:'white', cursor:'pointer' };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function TelefoniaSection({ user, users, contacts }) {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ operador:'', tipo_contrato:'', estado:'' });

  const admin = isAdminSocio(user);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('telefonia_contratos')
      .select('*, contacts(name, phone), users(name)')
      .order('created_at', { ascending:false });
    if (error) console.log('[telefonia_contratos] error:', error);
    setContratos(data || []);
    setLoading(false);
  };

  const handleSaved = (rec) => {
    setContratos(cs => {
      const idx = cs.findIndex(c => c.id === rec.id);
      return idx >= 0 ? cs.map(c => c.id === rec.id ? rec : c) : [rec, ...cs];
    });
    setSelectedId(null);
  };

  const handleDeleted = (id) => {
    setContratos(cs => cs.filter(c => c.id !== id));
    setSelectedId(null);
  };

  const visibles = admin ? contratos : contratos.filter(c => c.comercial_id === user.id);

  const filtered = visibles.filter(c => {
    if (filters.operador && c.operador !== filters.operador) return false;
    if (filters.tipo_contrato && c.tipo_contrato !== filters.tipo_contrato) return false;
    if (filters.estado && c.estado !== filters.estado) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [c.contacts?.name, c.num_principal].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      if (!hay) return false;
    }
    return true;
  });

  const total = visibles.length;
  const activos = visibles.filter(c => c.estado === 'activo').length;
  const mrrTotal = visibles.filter(c => c.estado === 'activo').reduce((s,c) => s + (Number(c.precio_mes)||0), 0);
  const comisionesMes = visibles.filter(c => isSameMonth(c.fecha_activacion)).reduce((s,c) => s + (Number(c.comision_estimada)||0), 0);
  const enClawback = visibles.filter(c => c.clawback_riesgo).length;

  const selected = selectedId && selectedId !== 'new' ? contratos.find(c => c.id === selectedId) : null;

  if (selected || selectedId === 'new') {
    return (
      <FichaContrato contract={selected} user={user} users={users} contacts={contacts} admin={admin}
        onBack={() => setSelectedId(null)} onSaved={handleSaved} onDeleted={handleDeleted} />
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:BRAND }}>📱 Telefonía</h1>
          <p style={{ color:'#9ca3af', fontSize:13 }}>{filtered.length} contratos</p>
        </div>
        <button className="btn-p" onClick={() => setSelectedId('new')}>+ Nuevo contrato</button>
      </div>

      {admin && (
        <div className="stats-grid">
          {[
            { l:'Total contratos', v:total, i:'📱', c:BRAND },
            { l:'Activos', v:activos, i:'✅', c:'#059669' },
            { l:'MRR total', v:fmt(mrrTotal), i:'💶', c:'#7c3aed' },
            { l:'Comisiones mes', v:fmt(comisionesMes), i:'💰', c:'#2563eb' },
            { l:'⚠️ En clawback', v:enClawback, i:'⚠️', c:'#dc2626' },
          ].map(s => (
            <div key={s.l} className="sc" style={{ borderLeftColor:s.c }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{s.i}</div>
              <div style={{ fontSize:20, fontWeight:800, color:s.c, fontFamily:"'Barlow Condensed',sans-serif" }}>{s.v}</div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <input className="fi" placeholder="Buscar por cliente o número..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:260 }} />
        <select value={filters.operador} onChange={e => setFilters(f=>({...f,operador:e.target.value}))} style={selSt()}>
          <option value="">Todos los operadores</option>
          {Object.entries(OPERADORES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.tipo_contrato} onChange={e => setFilters(f=>({...f,tipo_contrato:e.target.value}))} style={selSt()}>
          <option value="">Todos los tipos</option>
          {TIPOS_CONTRATO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={filters.estado} onChange={e => setFilters(f=>({...f,estado:e.target.value}))} style={selSt()}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS_TELEFONIA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(search||filters.operador||filters.tipo_contrato||filters.estado) && (
          <button onClick={() => { setSearch(''); setFilters({operador:'',tipo_contrato:'',estado:''}); }}
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
                  {['Cliente','Operador','Tipo','Tarifa','Precio €/mes','Estado', ...(admin?['Comisión €','⚠️']:[]), 'Fecha activación',''].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const op = OPERADORES[c.operador];
                  const estado = ESTADOS_TELEFONIA[c.estado] || ESTADOS_TELEFONIA.prospecto;
                  const tipoLabel = TIPOS_CONTRATO.find(t => t.id === c.tipo_contrato)?.label || c.tipo_contrato;
                  const canEdit = admin || c.comercial_id === user.id;
                  return (
                    <tr key={c.id} className="tr" style={{ borderTop:'1px solid #f0f3fb', cursor:'pointer' }} onClick={() => setSelectedId(c.id)}>
                      <td style={{ padding:'9px 13px', fontSize:13, fontWeight:700, color:BRAND }}>{c.contacts?.name || 'Sin cliente'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        {op && <span className="tag" style={{ background:op.bg, color:op.color }}>{op.icon} {op.label}</span>}
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{tipoLabel}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{resumenTarifa(c)}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(c.precio_mes)}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:estado.bg, color:estado.color }}>{estado.label}</span>
                      </td>
                      {admin && <td style={{ padding:'9px 13px', fontSize:12, color:'#059669', fontWeight:700, whiteSpace:'nowrap' }}>{fmt(c.comision_estimada)}</td>}
                      {admin && <td style={{ padding:'9px 13px', textAlign:'center' }}>{c.clawback_riesgo ? '⚠️' : ''}</td>}
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{c.fecha_activacion || '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          {canEdit && <button className="btn-g" style={{ padding:'5px 9px' }} onClick={() => setSelectedId(c.id)}>✏️</button>}
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
    </div>
  );

  async function quickDelete(c) {
    if (!window.confirm(`¿Eliminar el contrato de "${c.contacts?.name || 'este cliente'}"? No se puede deshacer.`)) return;
    const { error } = await supabase.from('telefonia_contratos').delete().eq('id', c.id);
    if (error) { alert(`Error: ${error.message}`); return; }
    handleDeleted(c.id);
  }
}

// ─── Ficha / wizard de contrato (3 pasos) ────────────────────────────────────

function FichaContrato({ contract, user, users, contacts, admin, onBack, onSaved, onDeleted }) {
  const isNew = !contract;
  const canEdit = isNew || admin || contract.comercial_id === user.id;
  const [step, setStep] = useState('cliente');

  const initForm = () => contract ? {
    contact_id: contract.contact_id||'', operador: contract.operador||'', tipo_cliente: contract.tipo_cliente||'particular',
    tipo_contrato: contract.tipo_contrato||'convergente', fibra_mb: contract.fibra_mb||'', movil_gb: contract.movil_gb||'',
    huella: contract.huella||'fit', tarifa_privada: contract.tarifa_privada||false, precio_mes: contract.precio_mes ?? '',
    lineas_adicionales: Array.isArray(contract.lineas_adicionales) ? contract.lineas_adicionales : [],
    streaming: Array.isArray(contract.streaming) ? contract.streaming : [],
    tipo_alta: contract.tipo_alta||'alta_nueva', num_principal: contract.num_principal||'', operador_donante: contract.operador_donante||'',
    procedencia: contract.procedencia||'contrato', icc_prepago: contract.icc_prepago||'',
    titular_nombre: contract.titular_nombre||'', titular_apellidos: contract.titular_apellidos||'', dni_nie: contract.dni_nie||'',
    fecha_nacimiento: contract.fecha_nacimiento||'', titular_cuenta: contract.titular_cuenta||'', iban: contract.iban||'',
    dni_recibido: contract.dni_recibido||false, iban_recibido: contract.iban_recibido||false,
    escrituras_recibidas: contract.escrituras_recibidas||false, recibo_autonomo_recibido: contract.recibo_autonomo_recibido||false,
    dni_administrador_recibido: contract.dni_administrador_recibido||false,
    estado: contract.estado||'prospecto', fecha_solicitud: contract.fecha_solicitud||'', fecha_activacion: contract.fecha_activacion||'',
    fecha_vencimiento: contract.fecha_vencimiento||'', comision_cobrada: contract.comision_cobrada ?? '',
    notas: contract.notas||'', comercial_id: contract.comercial_id||'',
  } : { ...EMPTY_FORM, comercial_id: user.id };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cSearch, setCSearch] = useState('');
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const applyPrecio = (patch) => {
    setForm(f => {
      const merged = { ...f, ...patch };
      const auto = calcPrecioMes(merged);
      return { ...merged, precio_mes: auto !== null ? auto : merged.precio_mes };
    });
  };

  const selectOperador = (op) => setForm(f => ({
    ...f, operador: op, tipo_cliente: (op === 'lowi' && f.tipo_cliente !== 'particular') ? 'particular' : f.tipo_cliente,
  }));

  const selectTipoContrato = (tc) => setForm(f => ({
    ...f, tipo_contrato: tc, fibra_mb:'', movil_gb:'', precio_mes:'', huella:'fit', tarifa_privada:false,
    streaming: tc === 'convergente' ? f.streaming : [],
    lineas_adicionales: tc === 'convergente' ? f.lineas_adicionales : [],
  }));

  const toggleStreaming = (key) => {
    const has = form.streaming.includes(key);
    applyPrecio({ streaming: has ? form.streaming.filter(k => k !== key) : [...form.streaming, key] });
  };

  const addLinea = () => setForm(f => ({ ...f, lineas_adicionales:[...f.lineas_adicionales, { gb:5, precio:precioLineaAdicional(5) }] }));
  const updateLineaGb = (idx, gb) => setForm(f => ({ ...f, lineas_adicionales: f.lineas_adicionales.map((l,i) => i===idx ? { gb:Number(gb), precio:precioLineaAdicional(Number(gb)) } : l) }));
  const removeLinea = (idx) => setForm(f => ({ ...f, lineas_adicionales: f.lineas_adicionales.filter((_,i) => i!==idx) }));

  const comisionBase = calcComisionBase(form);
  const acelerador = calcAceleradorJunio(form);
  const comisionTotal = calcComisionTotal(form);
  const clawback = calcClawback(form.fecha_activacion);
  const checklist = getChecklist(form.operador, form.tipo_cliente);
  const ibanOk = isValidIBAN(form.iban);

  const handleSave = async () => {
    if (!form.operador) { alert('Selecciona un operador'); return; }
    setSaving(true);
    try {
      const payload = {
        contact_id: form.contact_id || null, operador: form.operador, tipo_cliente: form.tipo_cliente,
        tipo_contrato: form.tipo_contrato, fibra_mb: numOrNull(form.fibra_mb), movil_gb: numOrNull(form.movil_gb),
        huella: form.huella || null, tarifa_privada: !!form.tarifa_privada, precio_mes: numOrNull(form.precio_mes),
        lineas_adicionales: form.lineas_adicionales, streaming: form.streaming,
        tipo_alta: form.tipo_alta, num_principal: form.num_principal || null,
        operador_donante: form.tipo_alta === 'portabilidad' ? (form.operador_donante || null) : null,
        procedencia: form.tipo_alta === 'portabilidad' ? form.procedencia : null,
        icc_prepago: (form.tipo_alta === 'portabilidad' && form.procedencia === 'prepago') ? (form.icc_prepago || null) : null,
        titular_nombre: form.titular_nombre || null, titular_apellidos: form.titular_apellidos || null,
        dni_nie: form.dni_nie || null, fecha_nacimiento: form.fecha_nacimiento || null,
        titular_cuenta: form.titular_cuenta || null, iban: form.iban || null,
        dni_recibido: !!form.dni_recibido, iban_recibido: !!form.iban_recibido,
        escrituras_recibidas: !!form.escrituras_recibidas, recibo_autonomo_recibido: !!form.recibo_autonomo_recibido,
        dni_administrador_recibido: !!form.dni_administrador_recibido,
        estado: form.estado, fecha_solicitud: form.fecha_solicitud || null, fecha_activacion: form.fecha_activacion || null,
        fecha_vencimiento: form.fecha_vencimiento || null,
        comision_estimada: comisionTotal, clawback_riesgo: clawback,
        notas: form.notas || null, comercial_id: form.comercial_id || null,
      };
      if (admin) payload.comision_cobrada = numOrNull(form.comision_cobrada);

      let rec;
      if (isNew) {
        const { data, error } = await supabase.from('telefonia_contratos')
          .insert({ id: genId(), ...payload, created_at: new Date().toISOString() })
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = data;
      } else {
        const { data, error } = await supabase.from('telefonia_contratos')
          .update(payload).eq('id', contract.id)
          .select('*, contacts(name, phone), users(name)').single();
        if (error) throw error;
        rec = data;
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
    const { error } = await supabase.from('telefonia_contratos').delete().eq('id', contract.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(contract.id);
  };

  const selCon = contacts.find(c => c.id === form.contact_id);
  const filtCon = cSearch ? contacts.filter(c => c.name?.toLowerCase().includes(cSearch.toLowerCase())).slice(0,15) : [];

  const STEPS = [
    { id:'cliente', label:'1. Cliente y operador' },
    { id:'tarifa',  label:'2. Tarifa' },
    { id:'docs',    label:'3. Documentación' },
  ];

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={onBack}
          style={{ background:'none', border:'1.5px solid #dde2f0', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
          ← Volver
        </button>
        <div style={{ flex:1, minWidth:200 }}>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:800, color:BRAND }}>
            {isNew ? 'Nuevo contrato' : (contract.contacts?.name || 'Ficha de contrato')}
          </h1>
          {!isNew && (
            <p style={{ fontSize:12, color:'#9ca3af' }}>
              <span style={{ padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:(ESTADOS_TELEFONIA[contract.estado]||{}).bg, color:(ESTADOS_TELEFONIA[contract.estado]||{}).color }}>
                {(ESTADOS_TELEFONIA[contract.estado]||{}).label}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="tabs-scroll" style={{ display:'flex', gap:8, marginBottom:22, flexWrap:'wrap' }}>
        {STEPS.map(s => (
          <button key={s.id} className={`tab ${step===s.id?'on':''}`} onClick={() => setStep(s.id)}>{s.label}</button>
        ))}
      </div>

      {step === 'cliente' && (
        <Sec title="Cliente y operador">
          <div style={{ position:'relative', marginBottom:16, maxWidth:400 }}>
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

          <FL>Operador</FL>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:18 }}>
            {Object.entries(OPERADORES).map(([key,op]) => {
              const on = form.operador === key;
              return (
                <button key={key} onClick={() => selectOperador(key)}
                  style={{
                    padding:'16px 12px', borderRadius:12, cursor:'pointer', textAlign:'center',
                    border: on ? `2px solid ${op.color}` : '2px solid #e8ecf8',
                    background: on ? op.bg : 'white',
                  }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>{op.icon}</div>
                  <div style={{ fontSize:14, fontWeight:800, color: on ? op.color : '#374151' }}>{op.label}</div>
                </button>
              );
            })}
          </div>

          <FL>Tipo de cliente</FL>
          <div style={{ display:'flex', gap:6 }}>
            {[
              { id:'particular', label:'Particular' },
              { id:'empresa', label:'Empresa', vodafoneOnly:true },
              { id:'autonomo', label:'Autónomo', vodafoneOnly:true },
            ].map(tc => {
              const disabled = tc.vodafoneOnly && form.operador !== 'vodafone';
              const on = form.tipo_cliente === tc.id;
              return (
                <button key={tc.id} disabled={disabled} onClick={() => set('tipo_cliente', tc.id)}
                  title={disabled ? 'Solo disponible con Vodafone' : undefined}
                  style={{
                    padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:700,
                    border: on ? `1.5px solid ${BRAND}` : '1.5px solid #dde2f0',
                    background: on ? BRAND : disabled ? '#f3f4f6' : 'white',
                    color: on ? 'white' : disabled ? '#c0c8e0' : '#374151',
                    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
                  }}>{tc.label}</button>
              );
            })}
          </div>
        </Sec>
      )}

      {step === 'tarifa' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:20, alignItems:'start' }} className="form-grid">
          <div>
            <Sec title="Tipo de contrato">
              <div className="tabs-scroll" style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
                {TIPOS_CONTRATO.map(t => (
                  <button key={t.id} className={`tab ${form.tipo_contrato===t.id?'on':''}`} onClick={() => selectTipoContrato(t.id)}>{t.label}</button>
                ))}
              </div>

              {form.tipo_contrato === 'convergente' && (
                <>
                  <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginBottom:14 }}>
                    <div>
                      <FL>Huella</FL>
                      <div style={{ display:'flex', gap:6 }}>
                        {['fit','no_fit'].map(h => (
                          <button key={h} onClick={() => applyPrecio({ huella:h })}
                            style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                              border: form.huella===h ? '1.5px solid #059669' : '1.5px solid #dde2f0',
                              background: form.huella===h ? '#d1fae5' : 'white', color: form.huella===h ? '#059669' : '#374151' }}>
                            {h==='fit' ? 'Fit' : 'No Fit'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FL>¿Tarifa privada?</FL>
                      <button onClick={() => applyPrecio({ tarifa_privada: !form.tarifa_privada, fibra_mb:'', movil_gb:'' })}
                        style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                          border: form.tarifa_privada ? '1.5px solid #7c3aed' : '1.5px solid #dde2f0',
                          background: form.tarifa_privada ? '#f5f3ff' : 'white', color: form.tarifa_privada ? '#7c3aed' : '#374151' }}>
                        {form.tarifa_privada ? '✓ Privada' : 'Tarifa estándar'}
                      </button>
                    </div>
                  </div>

                  {form.tarifa_privada ? (
                    <div style={{ maxWidth:320, marginBottom:14 }}>
                      <FL>Tarifa privada</FL>
                      <select className="fi" value={form.fibra_mb && form.movil_gb ? `${form.fibra_mb}-${form.movil_gb}` : ''}
                        onChange={e => {
                          const opt = TARIFAS_LOWI.privada.find(p => `${p.fibra}-${p.gb}` === e.target.value);
                          if (opt) applyPrecio({ fibra_mb:opt.fibra, movil_gb:opt.gb });
                        }}>
                        <option value="">Seleccionar...</option>
                        {TARIFAS_LOWI.privada.map(p => <option key={p.nombre} value={`${p.fibra}-${p.gb}`}>{p.nombre}</option>)}
                      </select>
                    </div>
                  ) : (
                    <Grid2>
                      <div>
                        <FL>Fibra</FL>
                        <select className="fi" value={form.fibra_mb} onChange={e => applyPrecio({ fibra_mb:Number(e.target.value) })}>
                          <option value="">Seleccionar...</option>
                          {[300,600,1000].map(v => <option key={v} value={v}>{v}Mb</option>)}
                        </select>
                      </div>
                      <div>
                        <FL>Móvil</FL>
                        <select className="fi" value={form.movil_gb} onChange={e => applyPrecio({ movil_gb:Number(e.target.value) })}>
                          <option value="">Seleccionar...</option>
                          {[50,100,150,300].map(v => <option key={v} value={v}>{v}GB</option>)}
                        </select>
                      </div>
                    </Grid2>
                  )}

                  <div style={{ marginTop:14, marginBottom:14 }}>
                    <FL>Extras streaming</FL>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 24px' }}>
                      {Object.entries(STREAMING_EXTRAS).map(([key,ex]) => (
                        <label key={key} style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', fontWeight: form.streaming.includes(key) ? 700 : 400, color: form.streaming.includes(key) ? BRAND : '#374151' }}>
                          <input type="checkbox" checked={form.streaming.includes(key)} onChange={() => toggleStreaming(key)}
                            style={{ width:15, height:15, accentColor:BRAND, cursor:'pointer' }} />
                          {ex.label} (+{ex.precio}€/mes)
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom:6 }}>
                    <FL>Líneas adicionales</FL>
                    {form.lineas_adicionales.map((l, idx) => (
                      <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                        <select className="fi" style={{ maxWidth:140 }} value={l.gb} onChange={e => updateLineaGb(idx, e.target.value)}>
                          {[5,50,100,150,300].map(v => <option key={v} value={v}>{v}GB</option>)}
                        </select>
                        <span style={{ fontSize:12, color:'#374151', fontWeight:600 }}>{fmt(l.precio)}/mes</span>
                        <button onClick={() => removeLinea(idx)} style={{ background:'none', border:'none', color:'#dc2626', fontSize:12, cursor:'pointer' }}>✕ Quitar</button>
                      </div>
                    ))}
                    <button className="btn-g" onClick={addLinea}>+ Añadir línea</button>
                  </div>
                </>
              )}

              {form.tipo_contrato === 'solo_movil' && (
                <div style={{ maxWidth:200 }}>
                  <FL>GB</FL>
                  <select className="fi" value={form.movil_gb} onChange={e => applyPrecio({ movil_gb:Number(e.target.value) })}>
                    <option value="">Seleccionar...</option>
                    {[50,100,150,300].map(v => <option key={v} value={v}>{v}GB</option>)}
                  </select>
                </div>
              )}

              {form.tipo_contrato === 'solo_fibra' && (
                <Grid2>
                  <div>
                    <FL>Velocidad</FL>
                    <select className="fi" value={form.fibra_mb} onChange={e => applyPrecio({ fibra_mb:Number(e.target.value) })}>
                      <option value="">Seleccionar...</option>
                      {[600,1000].map(v => <option key={v} value={v}>{v}Mb</option>)}
                    </select>
                  </div>
                  <div>
                    <FL>Huella</FL>
                    <div style={{ display:'flex', gap:6 }}>
                      {['fit','no_fit'].map(h => (
                        <button key={h} onClick={() => set('huella', h)}
                          style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                            border: form.huella===h ? '1.5px solid #059669' : '1.5px solid #dde2f0',
                            background: form.huella===h ? '#d1fae5' : 'white', color: form.huella===h ? '#059669' : '#374151' }}>
                          {h==='fit' ? 'Fit' : 'No Fit'}
                        </button>
                      ))}
                    </div>
                  </div>
                </Grid2>
              )}

              {form.tipo_contrato === 'linea_adicional' && (
                <div style={{ maxWidth:200 }}>
                  <FL>GB</FL>
                  <select className="fi" value={form.movil_gb} onChange={e => applyPrecio({ movil_gb:Number(e.target.value) })}>
                    <option value="">Seleccionar...</option>
                    {[5,50,100,150,300].map(v => <option key={v} value={v}>{v}GB</option>)}
                  </select>
                </div>
              )}

              <div style={{ maxWidth:200, marginTop:16 }}>
                <FL>Precio mes (€)</FL>
                <input className="fi" type="number" value={form.precio_mes} onChange={e => set('precio_mes', e.target.value)} />
              </div>
            </Sec>

            <Sec title="Tipo de alta">
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
                {TIPOS_ALTA.map(t => (
                  <button key={t.id} onClick={() => set('tipo_alta', t.id)}
                    style={{ padding:'7px 16px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                      border: form.tipo_alta===t.id ? `1.5px solid ${BRAND}` : '1.5px solid #dde2f0',
                      background: form.tipo_alta===t.id ? BRAND : 'white', color: form.tipo_alta===t.id ? 'white' : '#374151' }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {form.tipo_alta === 'portabilidad' && (
                <Grid2>
                  <div><FL>Número a portar</FL><input className="fi" type="tel" value={form.num_principal} onChange={e => set('num_principal', e.target.value)} placeholder="6XXXXXXXX" /></div>
                  <div><FL>Operador donante</FL><input className="fi" value={form.operador_donante} onChange={e => set('operador_donante', e.target.value)} /></div>
                  <div>
                    <FL>Procedencia</FL>
                    <select className="fi" value={form.procedencia} onChange={e => set('procedencia', e.target.value)}>
                      <option value="contrato">Contrato</option>
                      <option value="prepago">Prepago</option>
                    </select>
                  </div>
                  {form.procedencia === 'prepago' && (
                    <div><FL>ICC de SIM actual</FL><input className="fi" value={form.icc_prepago} onChange={e => set('icc_prepago', e.target.value)} /></div>
                  )}
                </Grid2>
              )}
              {form.tipo_alta !== 'portabilidad' && (
                <div style={{ maxWidth:300 }}>
                  <FL>Número principal</FL>
                  <input className="fi" type="tel" value={form.num_principal} onChange={e => set('num_principal', e.target.value)} placeholder="6XXXXXXXX" />
                </div>
              )}
            </Sec>
          </div>

          {/* Panel comisión */}
          <div style={{ background:'#f8f9fd', borderRadius:12, padding:16, position:'sticky', top:0 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Comisión</div>
            <div style={{ background:'#d1fae5', borderRadius:10, padding:'12px 14px', marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:'.5px' }}>Comisión estimada</div>
              <div style={{ fontSize:22, fontWeight:800, color:'#059669', fontFamily:"'Barlow Condensed',sans-serif" }}>
                {comisionBase !== null ? fmt(comisionBase) : '—'}
              </div>
            </div>
            {acelerador > 0 && (
              <div style={{ background:'#fff7ed', borderRadius:10, padding:'10px 14px', marginBottom:10, fontSize:12, fontWeight:800, color:'#f97316' }}>
                +{fmt(acelerador)} Acelerador Junio
              </div>
            )}
            {acelerador > 0 && comisionTotal !== null && (
              <div style={{ fontSize:12, color:'#374151' }}>Total: <strong>{fmt(comisionTotal)}</strong></div>
            )}
            <div style={{ fontSize:12, color:'#374151', marginTop:12 }}>
              Precio mes: <strong>{form.precio_mes !== '' ? fmt(form.precio_mes) : '—'}</strong>
            </div>
          </div>
        </div>
      )}

      {step === 'docs' && (
        <>
          <Sec title="Datos del titular">
            <Grid2>
              <div><FL>Nombre</FL><input className="fi" value={form.titular_nombre} onChange={e => set('titular_nombre', e.target.value)} /></div>
              <div><FL>Apellidos</FL><input className="fi" value={form.titular_apellidos} onChange={e => set('titular_apellidos', e.target.value)} /></div>
              <div><FL>DNI/NIE</FL><input className="fi" value={form.dni_nie} onChange={e => set('dni_nie', e.target.value)} /></div>
              <div><FL>Fecha de nacimiento</FL><input className="fi" type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} /></div>
              <div><FL>Titular cuenta bancaria</FL><input className="fi" value={form.titular_cuenta} onChange={e => set('titular_cuenta', e.target.value)} /></div>
              <div>
                <FL>IBAN</FL>
                <input className="fi" value={form.iban} onChange={e => set('iban', e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000"
                  style={!ibanOk ? { borderColor:'#dc2626' } : undefined} />
                {!ibanOk && <p style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>Formato inválido. Debe empezar por ES seguido de 22 dígitos.</p>}
              </div>
            </Grid2>
          </Sec>

          <Sec title={`Documentación (${OPERADORES[form.operador]?.label || 'operador'} · ${form.tipo_cliente})`}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {checklist.map(doc => (
                <label key={doc.key} style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, cursor:'pointer', fontWeight: form[doc.key] ? 700 : 400, color: form[doc.key] ? BRAND : '#374151' }}>
                  <input type="checkbox" checked={!!form[doc.key]} onChange={e => set(doc.key, e.target.checked)}
                    style={{ width:16, height:16, accentColor:BRAND, cursor:'pointer' }} />
                  {form[doc.key] ? '☑' : '☐'} {doc.label}
                </label>
              ))}
            </div>
          </Sec>

          <Sec title="Estado y fechas">
            <Grid2>
              <div>
                <FL>Estado del contrato</FL>
                <select className="fi" value={form.estado} onChange={e => set('estado', e.target.value)}>
                  {Object.entries(ESTADOS_TELEFONIA).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <FL>Comercial asignado</FL>
                <select className="fi" value={form.comercial_id} onChange={e => set('comercial_id', e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div><FL>Fecha solicitud</FL><input className="fi" type="date" value={form.fecha_solicitud} onChange={e => set('fecha_solicitud', e.target.value)} /></div>
              <div><FL>Fecha activación</FL><input className="fi" type="date" value={form.fecha_activacion} onChange={e => set('fecha_activacion', e.target.value)} /></div>
              <div><FL>Fecha vencimiento</FL><input className="fi" type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} /></div>
            </Grid2>

            {admin && clawback && form.fecha_activacion && (
              <div style={{ marginTop:14, padding:'10px 14px', borderRadius:10, background:'#fff7ed', color:'#f97316', fontSize:12, fontWeight:800 }}>
                ⚠️ Clawback activo - vence {clawbackVenceFecha(form.fecha_activacion)}
              </div>
            )}
          </Sec>

          {admin && (
            <Sec title="Comisión">
              <Grid2>
                <div><FL>Comisión estimada</FL><p style={{ fontSize:16, fontWeight:800, color:'#059669' }}>{comisionTotal !== null ? fmt(comisionTotal) : '—'}</p></div>
                <div><FL>Comisión cobrada (€)</FL><input className="fi" type="number" value={form.comision_cobrada} onChange={e => set('comision_cobrada', e.target.value)} /></div>
              </Grid2>
            </Sec>
          )}

          <Sec title="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={4}
              placeholder="Notas internas sobre el contrato..."
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:90, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
          </Sec>
        </>
      )}

      {canEdit && (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8, flexWrap:'wrap', gap:10 }}>
          <div>
            {!isNew && admin && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar contrato'}
              </button>
            )}
          </div>
          <button className="btn-p" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar contrato'}</button>
        </div>
      )}
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
