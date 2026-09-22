import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#002292';

const INVESTOR_TIPOS = {
  particular:    { label:'Particular',    color:'#059669', bg:'#ecfdf5' },
  family_office: { label:'Family Office', color:'#7c3aed', bg:'#f5f3ff' },
  fondo:         { label:'Fondo',         color:'#1d4ed8', bg:'#eff6ff' },
  socimi:        { label:'SOCIMI',        color:'#d97706', bg:'#fffbeb' },
};

const INVESTOR_ESTADOS = {
  activo:    { label:'Activo',    color:'#059669', bg:'#d1fae5' },
  inactivo:  { label:'Inactivo',  color:'#6b7280', bg:'#f3f4f6' },
  potencial: { label:'Potencial', color:'#d97706', bg:'#fef3c7' },
};

const GEOGRAFIAS = ['Galicia','Asturias','Cantabria','Norte España','Nacional','Internacional'];
const TIPOS_ACTIVO_INTERES = ['Vivienda','Local','Suelo','Cartera NPL','Subasta judicial'];

const PORTFOLIO_ESTADOS = {
  identificado:     { label:'Identificado',   color:'#6b7280', bg:'#f3f4f6' },
  'análisis':       { label:'Análisis',       color:'#2563eb', bg:'#dbeafe' },
  oferta_enviada:   { label:'Oferta enviada', color:'#7c3aed', bg:'#f5f3ff' },
  'negociación':    { label:'Negociación',    color:'#d97706', bg:'#fef3c7' },
  cerrado:          { label:'Cerrado ✓',      color:'#059669', bg:'#d1fae5' },
  descartado:       { label:'Descartado ✗',   color:'#dc2626', bg:'#fee2e2' },
};

const TIPOLOGIAS = ['Piso','Local','Chalet','Nave','Suelo','Garaje','Otro'];
const ESTADO_PROCESAL_OPTS = ['desconocido','sin carga','judicial','extrajudicial'];
const ESTADO_REGISTRAL_OPTS = ['desconocido','limpio','con cargas','hipoteca vigente'];

const EMPTY_INVESTOR = {
  nombre:'', tipo:'particular', email:'', telefono:'',
  ticket_min:'', ticket_max:'', geografia:[], tipo_activo_interes:[],
  estado:'potencial', comercial_id:'', notas:'',
};

const EMPTY_PORTFOLIO = { nombre:'', banco_origen:'', estado:'identificado', fecha_limite:'', notas:'' };

const EMPTY_ACTIVO = {
  num_activo:'', ref_interna:'', provincia:'', ayuntamiento:'', direccion:'', codigo_postal:'', ref_catastral:'',
  tipologia:'Piso', superficie_m2:'', superficie_construida_m2:'',
  ob:'', valor_mercado:'', estado_procesal:'desconocido', estado_registral:'desconocido',
  nota_manual:'', destacado:false, notas:'',
};

function isAdminSocio(u) { return ['admin','socio'].includes(u.role); }
function genId() { return crypto.randomUUID(); }

function fmt(v) {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v));
}
function fmtNum(v, suf='') {
  if (v === null || v === undefined || v === '') return '—';
  return new Intl.NumberFormat('es-ES').format(Number(v)) + suf;
}

// Normaliza un campo array de Supabase (text[] puede volver como array o como "{a,b}")
const parseArr = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') {
    if (v.startsWith('{')) return v.slice(1,-1).split(',').map(s=>s.trim()).filter(Boolean);
    return [v];
  }
  return [];
};

function calcLtv(ob, vm) {
  const o = Number(ob), m = Number(vm);
  if (!o || !m) return null;
  return Number(((o/m)*100).toFixed(1));
}
function calcNotaOportunidad(ltv) {
  if (ltv === null || ltv === undefined || isNaN(ltv)) return null;
  if (ltv <= 50) return 8;
  if (ltv <= 75) return 6;
  if (ltv <= 100) return 4;
  if (ltv <= 150) return 2;
  return 1;
}
function notaEfectiva(a) {
  if (a.nota_manual !== null && a.nota_manual !== undefined && a.nota_manual !== '') return Number(a.nota_manual);
  return a.nota_oportunidad !== null && a.nota_oportunidad !== undefined ? Number(a.nota_oportunidad) : null;
}
function notaBadge(nota) {
  if (nota === null || nota === undefined) return { label:'—', color:'#6b7280', bg:'#f3f4f6' };
  if (nota >= 7) return { label:'Alta oportunidad', color:'#059669', bg:'#dcfce7' };
  if (nota >= 4) return { label:'Interesante', color:'#d97706', bg:'#fef9c3' };
  return { label:'Riesgo', color:'#dc2626', bg:'#fee2e2' };
}
function semaforoIcon(nota) {
  if (nota === null || nota === undefined) return '⚪';
  if (nota >= 7) return '🟢';
  if (nota >= 4) return '🟡';
  return '🔴';
}

function portfolioMetrics(p) {
  const activos = p.npl_activos || [];
  const n = activos.length;
  const deudaTotal = activos.reduce((s,a) => s + (Number(a.ob)||0), 0);
  const vmTotal = activos.reduce((s,a) => s + (Number(a.valor_mercado)||0), 0);
  const ltvs = activos.map(a => a.ltv).filter(v => v !== null && v !== undefined);
  const ltvMedio = ltvs.length ? ltvs.reduce((s,v) => s+Number(v), 0) / ltvs.length : null;
  return { n, deudaTotal, vmTotal, ltvMedio };
}
function distribucionTipologias(activos) {
  const counts = {};
  activos.forEach(a => { const t = a.tipologia || 'Otro'; counts[t] = (counts[t]||0) + 1; });
  const entries = Object.entries(counts);
  if (!entries.length) return '—';
  return entries.map(([t,c]) => `${t} x${c}`).join(' · ');
}
function semaforoCounts(activos) {
  let verde=0, amarillo=0, rojo=0;
  activos.forEach(a => {
    const icon = semaforoIcon(notaEfectiva(a));
    if (icon==='🟢') verde++; else if (icon==='🟡') amarillo++; else if (icon==='🔴') rojo++;
  });
  return { verde, amarillo, rojo };
}

// ─── Parser del informe enriquecido ─────────────────────────────────────────

function parseMoneyOrNum(str) {
  if (str === undefined || str === null) return null;
  const cleaned = String(str).replace(/[€\s]/g,'').replace(/,/g,'');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseInformeNPL(text) {
  if (!text || !text.trim()) return [];
  const chunks = text.split(/ACTIVO\s*Nº/i).slice(1);
  return chunks.map(chunk => {
    const get = (re) => { const m = chunk.match(re); return m ? m[1].trim() : ''; };
    const num_activo = get(/^\s*(\d+)/);
    const ref_interna = get(/Referencia interna:\s*([^\n\r]+)/i);
    const provAyto = get(/Provincia\/Ayto:\s*([^\n\r]+)/i);
    const provParts = provAyto.split('/').map(s => s.trim());
    const provincia = provParts[0] || '';
    const ayuntamiento = provParts[1] || '';
    const direccion = get(/Dirección\s*\(Catastro\):\s*([^\n\r]+)/i);
    const codigo_postal = get(/Código Postal:\s*([^\n\r]+)/i);
    const ref_catastral = get(/Ref\.?\s*Catastral:\s*([^\n\r]+)/i);
    const tipologiaRaw = get(/Tipología\s*\(Excel\):\s*([^\n\r]+)/i);
    const supRaw = get(/Superficie\s*\(Catastro\):\s*([^\n\r]+)/i).replace(/m2|m²/gi,'').trim();
    const obRaw = get(/Deuda viva\s*\(OB\):\s*([^\n\r]+)/i).replace(/€/g,'').trim();
    const vmRaw = get(/Valor Mercado Estimado:\s*([^\n\r]+)/i).replace(/€/g,'').trim();
    const superficie_m2 = parseMoneyOrNum(supRaw);
    const ob = parseMoneyOrNum(obRaw);
    const valor_mercado = parseMoneyOrNum(vmRaw);
    const ltv = calcLtv(ob, valor_mercado);
    const nota_oportunidad = calcNotaOportunidad(ltv);
    return {
      num_activo, ref_interna, provincia, ayuntamiento, direccion, codigo_postal, ref_catastral,
      tipologia: TIPOLOGIAS.includes(tipologiaRaw) ? tipologiaRaw : (tipologiaRaw || 'Otro'),
      superficie_m2, superficie_construida_m2: null,
      ob, valor_mercado, ltv, nota_oportunidad,
      estado_procesal: 'desconocido', estado_registral: 'desconocido',
      destacado: false, nota_manual: null, notas: '',
    };
  }).filter(a => a.ref_interna || a.direccion || a.ob !== null);
}

function selSt() {
  return { padding:'7px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, color:'#374151', background:'white', cursor:'pointer' };
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function NPL({ user, users }) {
  const [tab, setTab] = useState('inversores');
  const [investors, setInvestors] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

  const admin = isAdminSocio(user);

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const [invRes, portRes] = await Promise.all([
      supabase.from('npl_investors').select('*').order('nombre'),
      supabase.from('npl_portfolios').select('*, npl_activos(*)').order('created_at', { ascending:false }),
    ]);
    if (invRes.error) console.log('[npl_investors] error:', invRes.error);
    if (portRes.error) console.log('[npl_portfolios] error:', portRes.error);
    setInvestors((invRes.data||[]).map(i => ({ ...i, geografia: parseArr(i.geografia), tipo_activo_interes: parseArr(i.tipo_activo_interes) })));
    setPortfolios((portRes.data||[]).map(p => ({ ...p, npl_activos: p.npl_activos||[] })));
    setLoading(false);
  };

  // ── Handlers Inversores ──
  const onInvestorSaved = (rec) => {
    const norm = { ...rec, geografia: parseArr(rec.geografia), tipo_activo_interes: parseArr(rec.tipo_activo_interes) };
    setInvestors(list => {
      const idx = list.findIndex(i => i.id === norm.id);
      return idx >= 0 ? list.map(i => i.id === norm.id ? norm : i) : [...list, norm].sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
    });
  };
  const onInvestorDeleted = (id) => setInvestors(list => list.filter(i => i.id !== id));

  // ── Handlers Carteras / Activos ──
  const onPortfolioCreated = (rec) => setPortfolios(ps => [{ ...rec, npl_activos:[] }, ...ps]);
  const onPortfolioUpdated = (rec) => setPortfolios(ps => ps.map(p => p.id === rec.id ? { ...p, ...rec } : p));
  const onPortfolioDeleted = (id) => { setPortfolios(ps => ps.filter(p => p.id !== id)); setSelectedPortfolioId(null); };
  const onActivosImported = (portfolioId, activos) => setPortfolios(ps => ps.map(p => p.id === portfolioId ? { ...p, npl_activos:[...p.npl_activos, ...activos] } : p));
  const onActivoSaved = (portfolioId, rec) => setPortfolios(ps => ps.map(p => {
    if (p.id !== portfolioId) return p;
    const idx = p.npl_activos.findIndex(a => a.id === rec.id);
    return { ...p, npl_activos: idx >= 0 ? p.npl_activos.map(a => a.id === rec.id ? rec : a) : [...p.npl_activos, rec] };
  }));
  const onActivoDeleted = (portfolioId, activoId) => setPortfolios(ps => ps.map(p => p.id === portfolioId ? { ...p, npl_activos: p.npl_activos.filter(a => a.id !== activoId) } : p));

  const selectedPortfolio = portfolios.find(p => p.id === selectedPortfolioId) || null;

  const TABS = [
    { id:'inversores', label:'💼 Inversores' },
    { id:'carteras',   label:'📁 Carteras NPL' },
    { id:'analisis',   label:'📈 Análisis Global' },
  ];

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:BRAND }}>📊 NPL</h1>
        <p style={{ color:'#9ca3af', fontSize:13 }}>Inversores y carteras de deuda</p>
      </div>

      <div className="tabs-scroll" style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab===t.id?'on':''}`}
            onClick={() => { setTab(t.id); if (t.id !== 'carteras') setSelectedPortfolioId(null); }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color:'#9ca3af', fontSize:13 }}>Cargando...</p>
      ) : (
        <>
          {tab === 'inversores' && (
            <InversoresTab investors={investors} users={users} user={user} admin={admin}
              onSaved={onInvestorSaved} onDeleted={onInvestorDeleted} />
          )}
          {tab === 'carteras' && (
            selectedPortfolio ? (
              <CarteraDetalle portfolio={selectedPortfolio} admin={admin}
                onBack={() => setSelectedPortfolioId(null)}
                onPortfolioUpdated={onPortfolioUpdated}
                onPortfolioDeleted={onPortfolioDeleted}
                onActivosImported={onActivosImported}
                onActivoSaved={onActivoSaved}
                onActivoDeleted={onActivoDeleted} />
            ) : (
              <CarterasList portfolios={portfolios} admin={admin}
                onSelect={setSelectedPortfolioId}
                onCreated={onPortfolioCreated} />
            )
          )}
          {tab === 'analisis' && <AnalisisGlobal portfolios={portfolios} />}
        </>
      )}
    </div>
  );
}

// ─── Pestaña 1: Inversores ───────────────────────────────────────────────────

function InversoresTab({ investors, users, user, admin, onSaved, onDeleted }) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ tipo:'', estado:'', geografia:'' });
  const [modal, setModal] = useState(null); // null | 'new' | investor obj

  const filtered = investors.filter(i => {
    if (filters.tipo && i.tipo !== filters.tipo) return false;
    if (filters.estado && i.estado !== filters.estado) return false;
    if (filters.geografia && !(i.geografia||[]).includes(filters.geografia)) return false;
    if (search && !(i.nombre||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const canEdit = (inv) => admin || inv.comercial_id === user.id;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, color:BRAND }}>Inversores</h2>
          <p style={{ color:'#9ca3af', fontSize:12 }}>{filtered.length} inversores</p>
        </div>
        <button className="btn-p" onClick={() => setModal('new')}>+ Nuevo inversor</button>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input className="fi" placeholder="🔍 Buscar por nombre..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:260 }} />
        <select value={filters.tipo} onChange={e => setFilters(f => ({ ...f, tipo:e.target.value }))} style={selSt()}>
          <option value="">Todos los tipos</option>
          {Object.entries(INVESTOR_TIPOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado:e.target.value }))} style={selSt()}>
          <option value="">Todos los estados</option>
          {Object.entries(INVESTOR_ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.geografia} onChange={e => setFilters(f => ({ ...f, geografia:e.target.value }))} style={selSt()}>
          <option value="">Toda la geografía</option>
          {GEOGRAFIAS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {(search||filters.tipo||filters.estado||filters.geografia) && (
          <button onClick={() => { setSearch(''); setFilters({ tipo:'', estado:'', geografia:'' }); }}
            style={{ ...selSt(), color:'#dc2626', borderColor:'#fee2e2', background:'#fef2f2' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
          {investors.length === 0 ? 'No hay inversores. Añade el primero.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Nombre','Tipo','Ticket','Geografía','Estado','Comercial',''].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => {
                  const tipo = INVESTOR_TIPOS[i.tipo] || {};
                  const estado = INVESTOR_ESTADOS[i.estado] || {};
                  const com = users.find(u => u.id === i.comercial_id);
                  return (
                    <tr key={i.id} className="tr" style={{ borderTop:'1px solid #f0f3fb' }}>
                      <td style={{ padding:'9px 13px' }}>
                        <button onClick={() => setModal(i)} style={{ fontSize:13, fontWeight:700, color:BRAND, background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left' }}>
                          {i.nombre}
                        </button>
                        {i.email && <div style={{ fontSize:11, color:'#9ca3af' }}>{i.email}</div>}
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:tipo.bg, color:tipo.color }}>{tipo.label}</span>
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>
                        {i.ticket_min || i.ticket_max ? `${fmt(i.ticket_min)} – ${fmt(i.ticket_max)}` : '—'}
                      </td>
                      <td style={{ padding:'9px 13px' }}>
                        <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                          {(i.geografia||[]).map(g => (
                            <span key={g} className="tag" style={{ background:'#eff6ff', color:'#1d4ed8' }}>{g}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:estado.bg, color:estado.color }}>{estado.label}</span>
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{com?.name || '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        {canEdit(i) && (
                          <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                            <button className="btn-g" style={{ padding:'5px 9px' }} onClick={() => setModal(i)}>✏️</button>
                          </div>
                        )}
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
        <InvestorModal investor={modal === 'new' ? null : modal} user={user} users={users}
          canDelete={modal !== 'new' && (admin || modal.comercial_id === user.id)}
          onClose={() => setModal(null)} onSaved={rec => { onSaved(rec); setModal(null); }}
          onDeleted={id => { onDeleted(id); setModal(null); }} />
      )}
    </div>
  );
}

function InvestorModal({ investor, user, users, canDelete, onClose, onSaved, onDeleted }) {
  const isNew = !investor;
  const initForm = () => investor ? {
    nombre: investor.nombre||'', tipo: investor.tipo||'particular', email: investor.email||'', telefono: investor.telefono||'',
    ticket_min: investor.ticket_min||'', ticket_max: investor.ticket_max||'',
    geografia: parseArr(investor.geografia), tipo_activo_interes: parseArr(investor.tipo_activo_interes),
    estado: investor.estado||'potencial', comercial_id: investor.comercial_id||'', notas: investor.notas||'',
  } : { ...EMPTY_INVESTOR, comercial_id: user.id };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (field, val) => setForm(f => ({ ...f, [field]: f[field].includes(val) ? f[field].filter(x => x !== val) : [...f[field], val] }));
  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre, tipo: form.tipo, email: form.email || null, telefono: form.telefono || null,
        ticket_min: numOrNull(form.ticket_min), ticket_max: numOrNull(form.ticket_max),
        geografia: form.geografia, tipo_activo_interes: form.tipo_activo_interes,
        estado: form.estado, comercial_id: form.comercial_id || null, notas: form.notas || null,
      };
      let rec;
      if (isNew) {
        const { data, error } = await supabase.from('npl_investors').insert({ id: genId(), ...payload, created_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        rec = data;
      } else {
        const { data, error } = await supabase.from('npl_investors').update(payload).eq('id', investor.id).select().single();
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
    if (!window.confirm('¿Eliminar este inversor? No se puede deshacer.')) return;
    setDeleting(true);
    const { error } = await supabase.from('npl_investors').delete().eq('id', investor.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(investor.id);
  };

  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo mo-lg">
        <h2 style={{ fontSize:17, fontWeight:800, color:BRAND, marginBottom:18 }}>{isNew ? 'Nuevo inversor' : investor.nombre}</h2>

        <Sec title="Datos">
          <Grid2>
            <div style={{ gridColumn:'1/-1' }}><FL>Nombre *</FL><input className="fi" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del inversor" /></div>
            <div>
              <FL>Tipo</FL>
              <select className="fi" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {Object.entries(INVESTOR_TIPOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <FL>Estado</FL>
              <select className="fi" value={form.estado} onChange={e => set('estado', e.target.value)}>
                {Object.entries(INVESTOR_ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><FL>Email</FL><input className="fi" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><FL>Teléfono</FL><input className="fi" value={form.telefono} onChange={e => set('telefono', e.target.value)} /></div>
          </Grid2>
        </Sec>

        <Sec title="Ticket de inversión">
          <Grid2>
            <div><FL>Ticket mínimo (€)</FL><input className="fi" type="number" value={form.ticket_min} onChange={e => set('ticket_min', e.target.value)} placeholder="0" /></div>
            <div><FL>Ticket máximo (€)</FL><input className="fi" type="number" value={form.ticket_max} onChange={e => set('ticket_max', e.target.value)} placeholder="0" /></div>
          </Grid2>
        </Sec>

        <Sec title="Geografía de interés">
          <CheckboxGroup options={GEOGRAFIAS} selected={form.geografia} onToggle={v => toggleArr('geografia', v)} />
        </Sec>

        <Sec title="Tipo de activo interesado">
          <CheckboxGroup options={TIPOS_ACTIVO_INTERES} selected={form.tipo_activo_interes} onToggle={v => toggleArr('tipo_activo_interes', v)} />
        </Sec>

        <Sec title="Gestión">
          <Grid2>
            <div>
              <FL>Comercial asignado</FL>
              <select className="fi" value={form.comercial_id} onChange={e => set('comercial_id', e.target.value)}>
                <option value="">Seleccionar...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </Grid2>
          <div style={{ marginTop:12 }}>
            <FL>Notas</FL>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={4}
              placeholder="Notas internas sobre el inversor..."
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:90, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
          </div>
        </Sec>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
          <div>
            {!isNew && canDelete && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-g" onClick={onClose}>Cancelar</button>
            <button className="btn-p" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pestaña 2: Carteras NPL (listado) ───────────────────────────────────────

function CarterasList({ portfolios, admin, onSelect, onCreated }) {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'new'

  const filtered = portfolios.filter(p => !search ||
    (p.nombre||'').toLowerCase().includes(search.toLowerCase()) ||
    (p.banco_origen||'').toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:800, color:BRAND }}>Carteras NPL</h2>
          <p style={{ color:'#9ca3af', fontSize:12 }}>{filtered.length} carteras</p>
        </div>
        {admin && <button className="btn-p" onClick={() => setModal('new')}>+ Nueva cartera</button>}
      </div>

      <div style={{ marginBottom:16 }}>
        <input className="fi" placeholder="🔍 Buscar por nombre o banco..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:280 }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
          {portfolios.length === 0 ? 'No hay carteras. Añade la primera.' : 'Sin resultados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Nombre','Banco origen','Nº activos','Deuda total OB','VM total','LTV medio','Estado','Fecha límite'].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const m = portfolioMetrics(p);
                  const estado = PORTFOLIO_ESTADOS[p.estado] || {};
                  return (
                    <tr key={p.id} className="tr" style={{ borderTop:'1px solid #f0f3fb', cursor:'pointer' }} onClick={() => onSelect(p.id)}>
                      <td style={{ padding:'9px 13px', fontSize:13, fontWeight:700, color:BRAND }}>{p.nombre}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{p.banco_origen || '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{m.n}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(m.deudaTotal)}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(m.vmTotal)}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{m.ltvMedio !== null ? `${m.ltvMedio.toFixed(1)}%` : '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:estado.bg, color:estado.color }}>{estado.label}</span>
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{p.fecha_limite || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal === 'new' && (
        <CarteraModal portfolio={null} onClose={() => setModal(null)}
          onSaved={rec => { onCreated(rec); setModal(null); onSelect(rec.id); }} />
      )}
    </div>
  );
}

function CarteraModal({ portfolio, onClose, onSaved, onDeleted, canDelete }) {
  const isNew = !portfolio;
  const initForm = () => portfolio ? {
    nombre: portfolio.nombre||'', banco_origen: portfolio.banco_origen||'',
    estado: portfolio.estado||'identificado', fecha_limite: portfolio.fecha_limite||'', notas: portfolio.notas||'',
  } : { ...EMPTY_PORTFOLIO };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre de la cartera es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre, banco_origen: form.banco_origen || null,
        estado: form.estado, fecha_limite: form.fecha_limite || null, notas: form.notas || null,
      };
      let rec;
      if (isNew) {
        const { data, error } = await supabase.from('npl_portfolios').insert({ id: genId(), ...payload, created_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        rec = data;
      } else {
        const { data, error } = await supabase.from('npl_portfolios').update(payload).eq('id', portfolio.id).select().single();
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
    if (!window.confirm('¿Eliminar esta cartera y todos sus activos? No se puede deshacer.')) return;
    setDeleting(true);
    await supabase.from('npl_activos').delete().eq('portfolio_id', portfolio.id);
    const { error } = await supabase.from('npl_portfolios').delete().eq('id', portfolio.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(portfolio.id);
  };

  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo">
        <h2 style={{ fontSize:17, fontWeight:800, color:BRAND, marginBottom:18 }}>{isNew ? 'Nueva cartera' : 'Editar cartera'}</h2>

        <div style={{ marginBottom:12 }}><FL>Nombre *</FL><input className="fi" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Cartera Residencial Norte" /></div>
        <div style={{ marginBottom:12 }}><FL>Banco origen</FL><input className="fi" value={form.banco_origen} onChange={e => set('banco_origen', e.target.value)} placeholder="Entidad acreedora" /></div>
        <Grid2>
          <div>
            <FL>Estado</FL>
            <select className="fi" value={form.estado} onChange={e => set('estado', e.target.value)}>
              {Object.entries(PORTFOLIO_ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div><FL>Fecha límite</FL><input className="fi" type="date" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} /></div>
        </Grid2>
        <div style={{ marginTop:12, marginBottom:8 }}>
          <FL>Notas</FL>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={4}
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:90, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
          <div>
            {!isNew && canDelete && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar cartera'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-g" onClick={onClose}>Cancelar</button>
            <button className="btn-p" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pestaña 2: Detalle de cartera ───────────────────────────────────────────

function CarteraDetalle({ portfolio, admin, onBack, onPortfolioUpdated, onPortfolioDeleted, onActivosImported, onActivoSaved, onActivoDeleted }) {
  const [editModal, setEditModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [activoModal, setActivoModal] = useState(null); // null | 'new' | activo obj
  const [filters, setFilters] = useState({ tipologia:'', ltv:'', semaforo:'', destacado:false });

  const activos = portfolio.npl_activos || [];
  const metrics = portfolioMetrics(portfolio);
  const dist = distribucionTipologias(activos);
  const sem = semaforoCounts(activos);
  const estado = PORTFOLIO_ESTADOS[portfolio.estado] || {};

  const filteredActivos = activos.filter(a => {
    if (filters.tipologia && a.tipologia !== filters.tipologia) return false;
    if (filters.destacado && !a.destacado) return false;
    if (filters.ltv) {
      const ltv = a.ltv;
      if (ltv === null || ltv === undefined) return false;
      if (filters.ltv === 'lt50' && !(ltv < 50)) return false;
      if (filters.ltv === '50-100' && !(ltv >= 50 && ltv <= 100)) return false;
      if (filters.ltv === 'gt100' && !(ltv > 100)) return false;
    }
    if (filters.semaforo) {
      const map = { verde:'🟢', amarillo:'🟡', rojo:'🔴' };
      if (semaforoIcon(notaEfectiva(a)) !== map[filters.semaforo]) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={onBack}
          style={{ background:'none', border:'1.5px solid #dde2f0', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
          ← Volver
        </button>
        <div style={{ flex:1, minWidth:200 }}>
          <h2 style={{ fontSize:22, fontWeight:800, color:BRAND, fontFamily:"'Barlow Condensed',sans-serif" }}>{portfolio.nombre}</h2>
          <p style={{ fontSize:12, color:'#9ca3af' }}>
            {portfolio.banco_origen || 'Sin banco de origen'}
            <span style={{ marginLeft:8, padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:estado.bg, color:estado.color }}>{estado.label}</span>
            {portfolio.fecha_limite && <span style={{ marginLeft:8 }}>· Fecha límite: {portfolio.fecha_limite}</span>}
          </p>
          {portfolio.notas && <p style={{ fontSize:12, color:'#6b7280', marginTop:6, maxWidth:640 }}>{portfolio.notas}</p>}
        </div>
        {admin && (
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-g" onClick={() => setEditModal(true)}>✏️ Editar</button>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <StatCard label="Total activos" value={metrics.n} icon="🏘️" color={BRAND} />
        <StatCard label="Deuda total OB" value={fmt(metrics.deudaTotal)} icon="💳" color="#dc2626" />
        <StatCard label="Valor mercado total" value={fmt(metrics.vmTotal)} icon="💰" color="#059669" />
        <StatCard label="LTV medio" value={metrics.ltvMedio !== null ? `${metrics.ltvMedio.toFixed(1)}%` : '—'} icon="📊" color="#d97706" />
        <StatCard label="Distribución tipologías" value={dist} icon="🏷️" color="#7c3aed" small />
        <StatCard label="Semáforo" value={`🟢 ${sem.verde} · 🟡 ${sem.amarillo} · 🔴 ${sem.rojo}`} icon="🚦" color="#1d4ed8" small />
      </div>

      {admin && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <button className="btn-p" onClick={() => setImportModal(true)}>📥 Importar activos</button>
          <button className="btn-g" onClick={() => setActivoModal('new')}>+ Activo manual</button>
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <select value={filters.tipologia} onChange={e => setFilters(f => ({ ...f, tipologia:e.target.value }))} style={selSt()}>
          <option value="">Todas las tipologías</option>
          {TIPOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.ltv} onChange={e => setFilters(f => ({ ...f, ltv:e.target.value }))} style={selSt()}>
          <option value="">Todos los LTV</option>
          <option value="lt50">&lt; 50%</option>
          <option value="50-100">50% – 100%</option>
          <option value="gt100">&gt; 100%</option>
        </select>
        <select value={filters.semaforo} onChange={e => setFilters(f => ({ ...f, semaforo:e.target.value }))} style={selSt()}>
          <option value="">Todo el semáforo</option>
          <option value="verde">🟢 Verde</option>
          <option value="amarillo">🟡 Amarillo</option>
          <option value="rojo">🔴 Rojo</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#374151', cursor:'pointer' }}>
          <input type="checkbox" checked={filters.destacado} onChange={e => setFilters(f => ({ ...f, destacado:e.target.checked }))}
            style={{ width:15, height:15, accentColor:BRAND, cursor:'pointer' }} />
          Solo destacados
        </label>
        {(filters.tipologia||filters.ltv||filters.semaforo||filters.destacado) && (
          <button onClick={() => setFilters({ tipologia:'', ltv:'', semaforo:'', destacado:false })}
            style={{ ...selSt(), color:'#dc2626', borderColor:'#fee2e2', background:'#fef2f2' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {filteredActivos.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
          {activos.length === 0 ? 'No hay activos en esta cartera. Importa el informe o añade uno manual.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Nº','Tipología','Dirección','Superficie m²','OB','Valor mercado','LTV','Nota','Procesal','Registral','⭐',''].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredActivos.map(a => {
                  const nota = notaEfectiva(a);
                  const nb = notaBadge(nota);
                  return (
                    <tr key={a.id} className="tr" style={{ borderTop:'1px solid #f0f3fb' }}>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#9ca3af' }}>{a.num_activo || '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:'#f0f3fc', color:BRAND }}>{a.tipologia || '—'}</span>
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', maxWidth:220 }}>{a.direccion || '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmtNum(a.superficie_m2,' m²')}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.ob)}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.valor_mercado)}</td>
                      <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{a.ltv !== null && a.ltv !== undefined ? `${Number(a.ltv).toFixed(1)}%` : '—'}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        <span className="tag" style={{ background:nb.bg, color:nb.color }}>{nb.label}</span>
                      </td>
                      <td style={{ padding:'9px 13px', fontSize:11, color:'#374151', whiteSpace:'nowrap', textTransform:'capitalize' }}>{a.estado_procesal || '—'}</td>
                      <td style={{ padding:'9px 13px', fontSize:11, color:'#374151', whiteSpace:'nowrap', textTransform:'capitalize' }}>{a.estado_registral || '—'}</td>
                      <td style={{ padding:'9px 13px', textAlign:'center' }}>{a.destacado ? '⭐' : ''}</td>
                      <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>
                        {admin && (
                          <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                            <button className="btn-g" style={{ padding:'5px 9px' }} onClick={() => setActivoModal(a)}>✏️</button>
                            <button onClick={() => quickDeleteActivo(a)}
                              style={{ padding:'5px 9px', borderRadius:7, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                              🗑
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editModal && (
        <CarteraModal portfolio={portfolio} canDelete={admin}
          onClose={() => setEditModal(false)}
          onSaved={rec => { onPortfolioUpdated(rec); setEditModal(false); }}
          onDeleted={id => { onPortfolioDeleted(id); }} />
      )}

      {importModal && (
        <ImportModal portfolioId={portfolio.id} onClose={() => setImportModal(false)}
          onImported={rows => { onActivosImported(portfolio.id, rows); setImportModal(false); }} />
      )}

      {activoModal !== null && (
        <ActivoModal activo={activoModal === 'new' ? null : activoModal} portfolioId={portfolio.id}
          onClose={() => setActivoModal(null)}
          onSaved={rec => { onActivoSaved(portfolio.id, rec); setActivoModal(null); }}
          onDeleted={id => { onActivoDeleted(portfolio.id, id); setActivoModal(null); }} />
      )}
    </div>
  );

  async function quickDeleteActivo(a) {
    if (!window.confirm(`¿Eliminar activo Nº ${a.num_activo || ''}? No se puede deshacer.`)) return;
    const { error } = await supabase.from('npl_activos').delete().eq('id', a.id);
    if (error) { alert(`Error: ${error.message}`); return; }
    onActivoDeleted(portfolio.id, a.id);
  }
}

// ─── Importador de informe enriquecido ───────────────────────────────────────

function ImportModal({ portfolioId, onClose, onImported }) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const parsed = parseInformeNPL(text);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      const rows = parsed.map(a => ({ id: genId(), portfolio_id: portfolioId, ...a, created_at: new Date().toISOString() }));
      const { data, error } = await supabase.from('npl_activos').insert(rows).select();
      if (error) throw error;
      onImported(data || rows);
    } catch (e) {
      alert(`Error al importar: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo mo-lg">
        <h2 style={{ fontSize:17, fontWeight:800, color:BRAND, marginBottom:6 }}>Importar activos</h2>
        <p style={{ fontSize:12, color:'#9ca3af', marginBottom:14 }}>Pega el texto del informe enriquecido (Excel del acreedor + Catastro).</p>

        <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
          placeholder={'ACTIVO Nº 196 | Referencia interna: c915580639650019195\nProvincia/Ayto: A Coruña / Sada\nDirección (Catastro): LG TORNOS 30 15168 SADA (A CORUÑA)\n...'}
          style={{ width:'100%', padding:'10px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:12, minHeight:200, resize:'vertical', fontFamily:'monospace', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />

        {parsed.length > 0 && (
          <div style={{ marginTop:16 }}>
            <h3 style={{ fontSize:12, fontWeight:800, color:BRAND, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>
              Preview — {parsed.length} activo{parsed.length !== 1 ? 's' : ''} detectado{parsed.length !== 1 ? 's' : ''}
            </h3>
            <div className="card" style={{ overflow:'hidden', maxHeight:280, overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f8f9fd' }}>
                    {['Nº','Tipología','Dirección','OB','VM','LTV','Nota'].map(h => (
                      <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((a,idx) => {
                    const nb = notaBadge(a.nota_oportunidad);
                    return (
                      <tr key={idx} style={{ borderTop:'1px solid #f0f3fb' }}>
                        <td style={{ padding:'7px 10px', fontSize:11, color:'#9ca3af' }}>{a.num_activo || '—'}</td>
                        <td style={{ padding:'7px 10px', fontSize:11, color:'#374151' }}>{a.tipologia}</td>
                        <td style={{ padding:'7px 10px', fontSize:11, color:'#374151', maxWidth:200 }}>{a.direccion || '—'}</td>
                        <td style={{ padding:'7px 10px', fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.ob)}</td>
                        <td style={{ padding:'7px 10px', fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.valor_mercado)}</td>
                        <td style={{ padding:'7px 10px', fontSize:11, color:'#374151', whiteSpace:'nowrap' }}>{a.ltv !== null ? `${a.ltv.toFixed(1)}%` : '—'}</td>
                        <td style={{ padding:'7px 10px', whiteSpace:'nowrap' }}>
                          <span className="tag" style={{ background:nb.bg, color:nb.color, fontSize:10 }}>{nb.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:16 }}>
          <button className="btn-g" onClick={onClose}>Cancelar</button>
          <button className="btn-p" onClick={handleImport} disabled={parsed.length === 0 || importing}>
            {importing ? 'Importando...' : `Importar ${parsed.length} activo${parsed.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ficha de activo (crear/editar individual) ───────────────────────────────

function ActivoModal({ activo, portfolioId, onClose, onSaved, onDeleted }) {
  const isNew = !activo;
  const initForm = () => activo ? {
    num_activo: activo.num_activo||'', ref_interna: activo.ref_interna||'',
    provincia: activo.provincia||'', ayuntamiento: activo.ayuntamiento||'', direccion: activo.direccion||'',
    codigo_postal: activo.codigo_postal||'', ref_catastral: activo.ref_catastral||'',
    tipologia: activo.tipologia||'Piso', superficie_m2: activo.superficie_m2||'', superficie_construida_m2: activo.superficie_construida_m2||'',
    ob: activo.ob||'', valor_mercado: activo.valor_mercado||'',
    estado_procesal: activo.estado_procesal||'desconocido', estado_registral: activo.estado_registral||'desconocido',
    nota_manual: activo.nota_manual ?? '', destacado: activo.destacado||false, notas: activo.notas||'',
  } : { ...EMPTY_ACTIVO };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const ltvLive = calcLtv(form.ob, form.valor_mercado);
  const notaAutoLive = calcNotaOportunidad(ltvLive);
  const notaEfectivaLive = (form.nota_manual !== '' && form.nota_manual !== null) ? Number(form.nota_manual) : notaAutoLive;
  const nbLive = notaBadge(notaEfectivaLive);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        num_activo: form.num_activo || null, ref_interna: form.ref_interna || null,
        provincia: form.provincia || null, ayuntamiento: form.ayuntamiento || null, direccion: form.direccion || null,
        codigo_postal: form.codigo_postal || null, ref_catastral: form.ref_catastral || null,
        tipologia: form.tipologia || null,
        superficie_m2: numOrNull(form.superficie_m2), superficie_construida_m2: numOrNull(form.superficie_construida_m2),
        ob: numOrNull(form.ob), valor_mercado: numOrNull(form.valor_mercado),
        ltv: ltvLive, nota_oportunidad: notaAutoLive,
        estado_procesal: form.estado_procesal, estado_registral: form.estado_registral,
        nota_manual: numOrNull(form.nota_manual), destacado: form.destacado, notas: form.notas || null,
      };
      let rec;
      if (isNew) {
        const { data, error } = await supabase.from('npl_activos').insert({ id: genId(), portfolio_id: portfolioId, ...payload, created_at: new Date().toISOString() }).select().single();
        if (error) throw error;
        rec = data;
      } else {
        const { data, error } = await supabase.from('npl_activos').update(payload).eq('id', activo.id).select().single();
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
    if (!window.confirm('¿Eliminar este activo? No se puede deshacer.')) return;
    setDeleting(true);
    const { error } = await supabase.from('npl_activos').delete().eq('id', activo.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted(activo.id);
  };

  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo mo-lg">
        <h2 style={{ fontSize:17, fontWeight:800, color:BRAND, marginBottom:18 }}>
          {isNew ? 'Nuevo activo' : `Activo Nº ${activo.num_activo || ''}`}
        </h2>

        <Sec title="Localización">
          <Grid2>
            <div><FL>Provincia</FL><input className="fi" value={form.provincia} onChange={e => set('provincia', e.target.value)} /></div>
            <div><FL>Ayuntamiento</FL><input className="fi" value={form.ayuntamiento} onChange={e => set('ayuntamiento', e.target.value)} /></div>
            <div style={{ gridColumn:'1/-1' }}><FL>Dirección</FL><input className="fi" value={form.direccion} onChange={e => set('direccion', e.target.value)} /></div>
            <div><FL>Código postal</FL><input className="fi" value={form.codigo_postal} onChange={e => set('codigo_postal', e.target.value)} /></div>
            <div><FL>Ref. catastral</FL><input className="fi" value={form.ref_catastral} onChange={e => set('ref_catastral', e.target.value)} /></div>
          </Grid2>
        </Sec>

        <Sec title="Características">
          <Grid2>
            <div>
              <FL>Tipología</FL>
              <select className="fi" value={form.tipologia} onChange={e => set('tipologia', e.target.value)}>
                {TIPOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><FL>Superficie (m²)</FL><input className="fi" type="number" value={form.superficie_m2} onChange={e => set('superficie_m2', e.target.value)} /></div>
            <div><FL>Superficie construida (m²) — opcional</FL><input className="fi" type="number" value={form.superficie_construida_m2} onChange={e => set('superficie_construida_m2', e.target.value)} placeholder="Corrige si el Catastro da la parcela completa" /></div>
          </Grid2>
        </Sec>

        <Sec title="Financiero">
          <Grid2>
            <div><FL>OB — deuda viva (€)</FL><input className="fi" type="number" value={form.ob} onChange={e => set('ob', e.target.value)} /></div>
            <div><FL>Valor mercado (€)</FL><input className="fi" type="number" value={form.valor_mercado} onChange={e => set('valor_mercado', e.target.value)} /></div>
          </Grid2>
          <div style={{ marginTop:14, padding:'14px 16px', borderRadius:10, background:nbLive.bg, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
            <div>
              <span style={{ fontSize:12, fontWeight:700, color:nbLive.color, textTransform:'uppercase', letterSpacing:'.5px' }}>LTV: {ltvLive !== null ? `${ltvLive.toFixed(1)}%` : '—'}</span>
              <div style={{ fontSize:11, color:nbLive.color, marginTop:2 }}>Nota automática: {notaAutoLive ?? '—'} · {nbLive.label}</div>
            </div>
            <span style={{ fontSize:26, fontWeight:800, color:nbLive.color, fontFamily:"'Barlow Condensed',sans-serif" }}>{notaEfectivaLive ?? '—'}</span>
          </div>
        </Sec>

        <Sec title="Procesal / Registral">
          <Grid2>
            <div>
              <FL>Estado procesal</FL>
              <select className="fi" value={form.estado_procesal} onChange={e => set('estado_procesal', e.target.value)}>
                {ESTADO_PROCESAL_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <FL>Estado registral</FL>
              <select className="fi" value={form.estado_registral} onChange={e => set('estado_registral', e.target.value)}>
                {ESTADO_REGISTRAL_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </Grid2>
        </Sec>

        <Sec title="Otros">
          <Grid2>
            <div><FL>Nota manual (1–10, opcional)</FL><input className="fi" type="number" min="1" max="10" value={form.nota_manual} onChange={e => set('nota_manual', e.target.value)} placeholder="Sobrescribe la nota automática" /></div>
            <div>
              <FL>Destacado</FL>
              <label style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', cursor:'pointer', fontSize:13, fontWeight:600, color: form.destacado ? BRAND : '#374151' }}>
                <input type="checkbox" checked={form.destacado} onChange={e => set('destacado', e.target.checked)}
                  style={{ width:16, height:16, accentColor:BRAND, cursor:'pointer' }} />
                ⭐ Marcar como destacado
              </label>
            </div>
            <div><FL>Nº activo</FL><input className="fi" value={form.num_activo} onChange={e => set('num_activo', e.target.value)} /></div>
            <div><FL>Referencia interna</FL><input className="fi" value={form.ref_interna} onChange={e => set('ref_interna', e.target.value)} /></div>
          </Grid2>
          <div style={{ marginTop:12 }}>
            <FL>Notas</FL>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3}
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:70, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
          </div>
        </Sec>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
          <div>
            {!isNew && (
              <button onClick={handleDelete} disabled={deleting}
                style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Eliminando...' : '🗑 Eliminar'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn-g" onClick={onClose}>Cancelar</button>
            <button className="btn-p" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : '✓ Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pestaña 3: Análisis Global ──────────────────────────────────────────────

function AnalisisGlobal({ portfolios }) {
  const allActivos = portfolios.flatMap(p => (p.npl_activos||[]).map(a => ({ ...a, _cartera: p.nombre })));

  const byProv = {};
  allActivos.forEach(a => {
    const key = a.provincia || 'Sin provincia';
    if (!byProv[key]) byProv[key] = { provincia:key, n:0, deuda:0, vm:0, ltvs:[] };
    byProv[key].n += 1;
    byProv[key].deuda += Number(a.ob) || 0;
    byProv[key].vm += Number(a.valor_mercado) || 0;
    if (a.ltv !== null && a.ltv !== undefined) byProv[key].ltvs.push(Number(a.ltv));
  });
  const provRows = Object.values(byProv)
    .map(r => ({ ...r, ltvMedio: r.ltvs.length ? r.ltvs.reduce((s,v) => s+v, 0) / r.ltvs.length : null }))
    .sort((a,b) => b.n - a.n);

  const withNota = allActivos.map(a => ({ ...a, _notaEf: notaEfectiva(a) })).filter(a => a._notaEf !== null);
  const top5 = [...withNota].sort((a,b) => b._notaEf - a._notaEf).slice(0,5);
  const ltvBajo = allActivos.filter(a => a.ltv !== null && a.ltv !== undefined && a.ltv < 20).sort((a,b) => a.ltv - b.ltv);
  const destacados = allActivos.filter(a => a.destacado);

  if (allActivos.length === 0) {
    return <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>No hay activos cargados todavía. Importa una cartera para ver el análisis global.</div>;
  }

  return (
    <div>
      <Sec title="Resumen por provincia">
        <div className="card" style={{ overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#f8f9fd' }}>
                  {['Provincia','Nº activos','Deuda total','VM total','LTV medio'].map(h => (
                    <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {provRows.map(r => (
                  <tr key={r.provincia} className="tr" style={{ borderTop:'1px solid #f0f3fb' }}>
                    <td style={{ padding:'9px 13px', fontSize:12, fontWeight:700, color:BRAND }}>{r.provincia}</td>
                    <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{r.n}</td>
                    <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(r.deuda)}</td>
                    <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(r.vm)}</td>
                    <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{r.ltvMedio !== null ? `${r.ltvMedio.toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Sec>

      <Sec title="Top 5 — mejor nota de oportunidad">
        <ActivosMiniTable activos={top5} extraCols={[{ h:'Nota', render:a => { const nb = notaBadge(a._notaEf); return <span className="tag" style={{ background:nb.bg, color:nb.color }}>{a._notaEf} · {nb.label}</span>; } }]} />
      </Sec>

      <Sec title="Activos más atractivos (LTV < 20%)">
        <ActivosMiniTable activos={ltvBajo} extraCols={[{ h:'LTV', render:a => <strong style={{ color:'#059669' }}>{a.ltv.toFixed(1)}%</strong> }]} />
      </Sec>

      <Sec title={`Activos destacados ⭐ (${destacados.length})`}>
        {destacados.length === 0 ? (
          <p style={{ color:'#9ca3af', fontSize:13 }}>No hay activos destacados.</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {destacados.map(a => (
              <div key={a.id} className="ii" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1e2a4a' }}>⭐ {a.direccion || `Activo Nº ${a.num_activo}`}</span>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{a.tipologia} · {fmt(a.ob)} OB · {fmt(a.valor_mercado)} VM</div>
                </div>
                <span className="tag" style={{ background:'#eff6ff', color:'#1d4ed8' }}>{a._cartera}</span>
              </div>
            ))}
          </div>
        )}
      </Sec>
    </div>
  );
}

function ActivosMiniTable({ activos, extraCols=[] }) {
  if (activos.length === 0) return <p style={{ color:'#9ca3af', fontSize:13 }}>Sin resultados.</p>;
  return (
    <div className="card" style={{ overflow:'hidden' }}>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#f8f9fd' }}>
              {['Cartera','Tipología','Dirección','OB','VM', ...extraCols.map(c => c.h)].map(h => (
                <th key={h} style={{ padding:'9px 13px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activos.map((a,idx) => (
              <tr key={a.id||idx} className="tr" style={{ borderTop:'1px solid #f0f3fb' }}>
                <td style={{ padding:'9px 13px', whiteSpace:'nowrap' }}><span className="tag" style={{ background:'#eff6ff', color:'#1d4ed8' }}>{a._cartera}</span></td>
                <td style={{ padding:'9px 13px', fontSize:12, color:'#374151' }}>{a.tipologia || '—'}</td>
                <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', maxWidth:220 }}>{a.direccion || '—'}</td>
                <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.ob)}</td>
                <td style={{ padding:'9px 13px', fontSize:12, color:'#374151', whiteSpace:'nowrap' }}>{fmt(a.valor_mercado)}</td>
                {extraCols.map((c,i) => <td key={i} style={{ padding:'9px 13px', whiteSpace:'nowrap' }}>{c.render(a)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
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

function CheckboxGroup({ options, selected, onToggle }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'10px 24px' }}>
      {options.map(opt => (
        <label key={opt} style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', fontWeight: selected.includes(opt) ? 700 : 400, color: selected.includes(opt) ? BRAND : '#374151' }}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => onToggle(opt)}
            style={{ width:15, height:15, accentColor:BRAND, cursor:'pointer' }} />
          {opt}
        </label>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, color, small }) {
  return (
    <div className="sc" style={{ borderLeftColor:color }}>
      <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize: small ? 13 : 24, fontWeight:800, color, fontFamily: small ? 'inherit' : "'Barlow Condensed',sans-serif", lineHeight:1.3 }}>{value}</div>
      <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{label}</div>
    </div>
  );
}
