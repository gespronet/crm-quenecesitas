import { useState, useEffect } from 'react';
import { supabase, sanitizeFileName, compressFileIfPdf } from './utils/supabase';
import TabMandato from './Mandato';

const BRAND = '#00208F';
const TIPOS_INMUEBLE = ['Piso','Casa/Chalet','Local comercial','Oficina','Garaje','Trastero','Terreno','Nave industrial','Finca rústica'];
const ESTADOS_VENTA = {
  Disponible: { color:'#059669', bg:'#d1fae5' },
  Reservado:  { color:'#d97706', bg:'#fef3c7' },
  'Contrato arras': { color:'#00208F', bg:'#DCE3FF' },
  Vendido:    { color:'#dc2626', bg:'#fee2e2' },
};
const ESTADOS_CONSERVACION = ['Nuevo','Buen estado','A reformar'];
const CALEFACCION_OPTS = ['Sin calefacción','Eléctrica','Gas natural','Gasoil','Aerotermia','Suelo radiante'];
const CERT_OPTS = ['A','B','C','D','E','F','G','En trámite'];
const ORIENTACION_OPTS = ['Norte','Sur','Este','Oeste','Noreste','Noroeste','Sureste','Suroeste'];
const EXTRAS = [
  {key:'garaje',label:'Garaje'},{key:'trastero',label:'Trastero'},{key:'ascensor',label:'Ascensor'},
  {key:'terraza',label:'Terraza'},{key:'balcon',label:'Balcón'},{key:'jardin',label:'Jardín'},
  {key:'piscina',label:'Piscina'},{key:'piscina_comunitaria',label:'Piscina comunitaria'},
  {key:'aire_acondicionado',label:'Aire acondicionado'},{key:'armarios_empotrados',label:'Armarios empotrados'},
  {key:'amueblado',label:'Amueblado'},{key:'mascotas',label:'Permite mascotas'},
];
// Checklist documental del vendedor. «id» = valor guardado en property_documents.tipo
const DOCS_OBLIGATORIOS = [
  { id:'Escritura de propiedad', info:'Copia autorizada de la escritura que acredita la titularidad.' },
  { id:'DNI / NIE propietarios', info:'En vigor, de todos los propietarios que vayan a firmar.' },
  { id:'Nota simple registral', info:'Actualizada (menos de 3 meses): descripción, titularidad y cargas.', caduca:90 },
  { id:'Certificado de eficiencia energética', info:'Obligatorio para publicar y anunciar la vivienda.' },
  { id:'Último recibo del IBI', info:'Pagado.' },
  { id:'Certificado de deuda cero de la comunidad', info:'Firmado por el administrador o el presidente.' },
  { id:'Cédula de habitabilidad / Licencia de primera ocupación', info:'Obligatoria en la mayoría de comunidades autónomas.' },
  { id:'Certificado ITE / IEE', info:'Si el edificio tiene más de 50 años.' },
  { id:'Certificado catastral', info:'Descriptivo y gráfico. Comprueba que superficie y referencia coinciden con el Registro.' },
];
const DOCS_ESPECIALES = [
  { id:'Certificado de deuda pendiente / cancelación de hipoteca', info:'Si hay hipoteca que se cancela en la firma.' },
  { id:'Estatutos y normas de la comunidad', info:'Para informar al comprador de las reglas internas.' },
  { id:'Últimas facturas de suministros', info:'Agua, luz y gas, para los cambios de titularidad.' },
  { id:'Autorización de venta VPO', info:'Visado o descalificación de la comunidad autónoma.' },
  { id:'Poder notarial / libro de familia / capitulaciones', info:'Si hay representantes, menores o régimen matrimonial específico.' },
  { id:'Herencia: aceptación y pago de Sucesiones', info:'Si el inmueble procede de una herencia: escritura de aceptación y justificante del impuesto.' },
  { id:'Contrato de alquiler y renuncia de tanteo', info:'Si está alquilada: contrato vigente y renuncia del inquilino a los derechos de tanteo y retracto.' },
  { id:'Documentación de no residente', info:'NIE y modelo 211: el comprador retiene el 3 % del precio si el vendedor no reside en España.' },
  { id:'Licencias de obra / legalización de ampliaciones', info:'Si se ha reformado o ampliado: que lo construido coincida con lo inscrito.' },
  { id:'Planos', info:'Útiles para publicar y para el comprador.' },
];
const DOC_TIPOS = [...DOCS_OBLIGATORIOS, ...DOCS_ESPECIALES].map(d => d.id).concat('Otros');

const EMPTY_FORM = {
  titulo:'', tipo_inmueble:'', estado_venta:'Disponible', estado_conservacion:'',
  comercial_id:'', contact_id:'', precio:'', precio_minimo:'', precio_venta_acordado:'', comision_pct:'', reparto_pct:100,
  direccion:'', localidad:'', municipio:'', provincia:'', codigo_postal:'', zona_barrio:'',
  superficie_construida:'', superficie_util:'', superficie_parcela:'',
  habitaciones:'', banos:'', aseos:'', planta:'', orientacion:'', ano_construccion:'',
  garaje:false, trastero:false, ascensor:false, terraza:false, balcon:false, jardin:false,
  piscina:false, piscina_comunitaria:false, aire_acondicionado:false,
  armarios_empotrados:false, amueblado:false, mascotas:false,
  calefaccion:'', certificado_energetico:'', consumo_energetico:'',
  descripcion_web:'', notas_internas:'', video_url:'', referencia_catastral:'',
};

function isInmoUser(u) {
  return ['admin','socio'].includes(u.role) || (u.lineaPermisos||[]).includes('inmobiliaria');
}
function fmt(v) {
  if (!v && v !== 0) return null;
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v));
}
function selSt() {
  return { padding:'7px 12px', border:'1.5px solid #C9CBD3', borderRadius:"14px 14px 14px 0", fontSize:13, color:'#3A4058', background:'white', cursor:'pointer' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Inmobiliaria({ user, contacts, users }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // null=list, 'new'=crear, obj=editar
  const [filters, setFilters] = useState({ tipo:'', estado:'', localidad:'', precioMax:'' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('properties').select('*').order('created_at', { ascending:false });
    setProperties(data || []);
    setLoading(false);
  };

  const handleSaved = (prop) => {
    setProperties(ps => {
      const idx = ps.findIndex(p => p.id === prop.id);
      return idx >= 0 ? ps.map(p => p.id === prop.id ? prop : p) : [prop, ...ps];
    });
    setSelected(prop);
  };

  const handleDeleted = (id) => {
    setProperties(ps => ps.filter(p => p.id !== id));
    setSelected(null);
  };

  const localidades = [...new Set(properties.map(p => p.localidad).filter(Boolean))].sort();
  const filtered = properties.filter(p => {
    if (filters.tipo && p.tipo_inmueble !== filters.tipo) return false;
    if (filters.estado && p.estado_venta !== filters.estado) return false;
    if (filters.localidad && p.localidad !== filters.localidad) return false;
    if (filters.precioMax && Number(p.precio) > Number(filters.precioMax)) return false;
    return true;
  });

  if (selected !== null) {
    return (
      <InmuebleFicha
        property={selected === 'new' ? null : selected}
        user={user} users={users} contacts={contacts}
        onClose={() => setSelected(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <><div className="eyebrow">Línea de negocio · Inmuebles</div><h1>Inmobiliaria</h1></>
          <p style={{ color:'#8A8FA3', fontSize:13 }}>{filtered.length} inmuebles</p>
        </div>
        <button onClick={() => setSelected('new')}
          style={{ padding:'10px 20px', borderRadius:"14px 14px 14px 0", border:'none', background:BRAND, color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          ➕ Nuevo inmueble
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <select value={filters.tipo} onChange={e => setFilters(f=>({...f,tipo:e.target.value}))} style={selSt()}>
          <option value="">Todos los tipos</option>
          {TIPOS_INMUEBLE.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.estado} onChange={e => setFilters(f=>({...f,estado:e.target.value}))} style={selSt()}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_VENTA).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={filters.localidad} onChange={e => setFilters(f=>({...f,localidad:e.target.value}))} style={selSt()}>
          <option value="">Todas las localidades</option>
          {localidades.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <input type="number" placeholder="Precio máximo €" value={filters.precioMax}
          onChange={e => setFilters(f=>({...f,precioMax:e.target.value}))}
          style={{ ...selSt(), maxWidth:160 }} />
        {(filters.tipo||filters.estado||filters.localidad||filters.precioMax) && (
          <button onClick={() => setFilters({tipo:'',estado:'',localidad:'',precioMax:''})}
            style={{ ...selSt(), color:'#dc2626', borderColor:'#fee2e2', background:'#fef2f2' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color:'#8A8FA3', fontSize:13 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#8A8FA3', fontSize:14 }}>
          {properties.length === 0 ? 'No hay inmuebles. Añade el primero.' : 'Sin resultados con los filtros aplicados.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
          {filtered.map(p => <InmuebleCard key={p.id} p={p} onView={() => setSelected(p)} />)}
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function InmuebleCard({ p, onView }) {
  const est = ESTADOS_VENTA[p.estado_venta] || { color:'#5B6178', bg:'#f3f4f6' };
  const fotos = Array.isArray(p.fotos) ? p.fotos : [];
  const [coverUrl, setCoverUrl] = useState(null);

  useEffect(() => {
    let active = true;
    if (fotos[0]) {
      supabase.storage.from('documentos').createSignedUrl(fotos[0], 3600).then(({ data, error }) => {
        if (!active) return;
        if (error) { console.log('[foto upload] error:', error); setCoverUrl(null); return; }
        setCoverUrl(data.signedUrl);
      });
    } else {
      setCoverUrl(null);
    }
    return () => { active = false; };
  }, [fotos[0]]); // eslint-disable-line

  return (
    <div onClick={onView}
      style={{ background:'white', borderRadius:"20px 20px 20px 0", overflow:'hidden', cursor:'pointer', boxShadow:"none", transition:'transform .2s,box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(0,35,146,.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,35,146,.07)'; }}
    >
      {/* Foto */}
      <div style={{ height:200, background:'#F6F5F1', position:'relative', overflow:'hidden' }}>
        {coverUrl ? (
          <img src={coverUrl} alt={p.titulo} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
            <span style={{ fontSize:40 }}>🏠</span>
            <span style={{ fontSize:11, color:'#8A8FA3' }}>Sin fotos</span>
          </div>
        )}
        <span style={{ position:'absolute', top:10, left:10, padding:'3px 10px', borderRadius:"20px 20px 20px 0", fontSize:11, fontWeight:700, background:est.bg, color:est.color }}>
          {p.estado_venta}
        </span>
        {p.publicado_web && (
          <span style={{ position:'absolute', top:10, right:10, fontSize:18 }} title="Publicado en web">🌐</span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'14px 16px' }}>
        <p style={{ fontSize:10, color:'#8A8FA3', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>
          {p.referencia}{p.tipo_inmueble ? ` · ${p.tipo_inmueble}` : ''}
        </p>
        <h3 style={{ fontSize:14, fontWeight:800, color:BRAND, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {p.titulo || 'Sin título'}
        </h3>
        <p style={{ fontSize:12, color:'#5B6178', marginBottom:8 }}>
          📍 {[p.localidad, p.municipio].filter(Boolean).join(', ') || '—'}
        </p>
        {p.precio && (
          <p style={{ fontSize:22, fontWeight:800, color:'#059669', fontFamily:"'Poppins',sans-serif", marginBottom:8 }}>
            {fmt(p.precio)}
          </p>
        )}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          {p.superficie_construida && <span style={{ fontSize:12, color:'#3A4058' }}>📐 {p.superficie_construida} m²</span>}
          {p.habitaciones && <span style={{ fontSize:12, color:'#3A4058' }}>🛏 {p.habitaciones}</span>}
          {p.banos && <span style={{ fontSize:12, color:'#3A4058' }}>🚿 {p.banos}</span>}
        </div>
        <button onClick={e => { e.stopPropagation(); onView(); }}
          style={{ width:'100%', padding:'7px 0', borderRadius:"14px 14px 14px 0", border:`1.5px solid ${BRAND}`, background:'transparent', color:BRAND, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          Ver ficha
        </button>
      </div>
    </div>
  );
}

// ─── Ficha (4 pestañas) ───────────────────────────────────────────────────────

function InmuebleFicha({ property, user, users, contacts, onClose, onSaved, onDeleted }) {
  const isNew = !property;
  const [tab, setTab] = useState('datos');
  const [prop, setProp] = useState(property);
  const isAdmin = ['admin','socio'].includes(user.role);
  const inmoUsers = users.filter(u => isInmoUser(u));

  const handleSaved = (saved) => { setProp(saved); onSaved(saved); };

  const TABS = [
    { id:'datos',      label:'📋 Datos' },
    { id:'fotos',      label:'📷 Fotos',      disabled: isNew && !prop },
    { id:'docs',       label:'📄 Documentos', disabled: isNew && !prop },
    { id:'publicacion',label:'🌐 Publicación', disabled: isNew && !prop },
    { id:'mandato',    label:'✍️ Contratos',    disabled: isNew && !prop },
  ];

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={onClose}
          style={{ background:'none', border:'1.5px solid #C9CBD3', borderRadius:"14px 14px 14px 0", padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#3A4058' }}>
          ← Volver
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:26, fontWeight:800, color:BRAND }}>
            {isNew ? 'Nuevo inmueble' : (prop?.titulo || prop?.referencia || 'Ficha')}
          </h1>
          {prop && (
            <p style={{ fontSize:12, color:'#8A8FA3' }}>
              {prop.referencia}{prop.tipo_inmueble ? ` · ${prop.tipo_inmueble}` : ''}
              {prop.estado_venta && (
                <span style={{ marginLeft:8, padding:'1px 8px', borderRadius:"20px 20px 20px 0", fontSize:11, fontWeight:700, background:ESTADOS_VENTA[prop.estado_venta]?.bg, color:ESTADOS_VENTA[prop.estado_venta]?.color }}>
                  {prop.estado_venta}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled}
            style={{
              padding:'7px 16px', borderRadius:"14px 14px 14px 0", border:'none', fontSize:12, fontWeight:700,
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              background: tab === t.id ? BRAND : '#f0f3fc',
              color: tab === t.id ? 'white' : t.disabled ? '#c0c8e0' : '#5B6178',
              opacity: t.disabled ? 0.5 : 1,
              textTransform:'uppercase', letterSpacing:'.4px',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'datos'       && <TabDatos property={prop} user={user} users={inmoUsers} contacts={contacts} isAdmin={isAdmin} onSaved={handleSaved} onDeleted={() => onDeleted(prop?.id)} />}
      {tab === 'fotos'       && prop && <TabFotos property={prop} onPropUpdated={handleSaved} />}
      {tab === 'docs'        && prop && <TabDocs property={prop} user={user} onPropUpdated={handleSaved} />}
      {tab === 'publicacion' && prop && <TabPublicacion property={prop} onPropUpdated={handleSaved} />}
      {tab === 'mandato'     && prop && <TabMandato property={prop} user={user} contacts={contacts} />}
    </div>
  );
}

// ─── Tab 1: Datos ─────────────────────────────────────────────────────────────

function TabDatos({ property, user, users, contacts, isAdmin, onSaved, onDeleted }) {
  const isNew = !property;
  const initForm = () => property ? {
    titulo: property.titulo||'', tipo_inmueble: property.tipo_inmueble||'',
    estado_venta: property.estado_venta||'Disponible', estado_conservacion: property.estado_conservacion||'',
    comercial_id: property.comercial_id||'', contact_id: property.contact_id||'',
    precio: property.precio||'', precio_minimo: property.precio_minimo||'', precio_venta_acordado: property.precio_venta_acordado||'', comision_pct: property.comision_pct??'', reparto_pct: property.reparto_pct??100,
    direccion: property.direccion||'', localidad: property.localidad||'',
    municipio: property.municipio||'', provincia: property.provincia||'',
    codigo_postal: property.codigo_postal||'', zona_barrio: property.zona_barrio||'',
    superficie_construida: property.superficie_construida||'', superficie_util: property.superficie_util||'',
    superficie_parcela: property.superficie_parcela||'', habitaciones: property.habitaciones||'',
    banos: property.banos||'', aseos: property.aseos||'', planta: property.planta||'',
    orientacion: property.orientacion||'', ano_construccion: property.ano_construccion||'',
    garaje: property.garaje||false, trastero: property.trastero||false, ascensor: property.ascensor||false,
    terraza: property.terraza||false, balcon: property.balcon||false, jardin: property.jardin||false,
    piscina: property.piscina||false, piscina_comunitaria: property.piscina_comunitaria||false,
    aire_acondicionado: property.aire_acondicionado||false, armarios_empotrados: property.armarios_empotrados||false,
    amueblado: property.amueblado||false, mascotas: property.mascotas||false,
    calefaccion: property.calefaccion||'', certificado_energetico: property.certificado_energetico||'',
    consumo_energetico: property.consumo_energetico||'', descripcion_web: property.descripcion_web||'',
    notas_internas: property.notas_internas||'', video_url: property.video_url||'',
    referencia_catastral: property.referencia_catastral||'',
  } : { ...EMPTY_FORM, comercial_id: user.id };

  const [form, setForm] = useState(initForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cSearch, setCSearch] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const genRef = async () => {
    const { data } = await supabase.from('properties').select('referencia');
    const nums = (data||[]).map(p => { const m = (p.referencia||'').match(/INM-(\d+)/); return m ? parseInt(m[1]) : 0; });
    return `INM-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0')}`;
  };

  const numOrNull = v => (v !== '' && v !== null && v !== undefined) ? Number(v) : null;

  const handleSave = async () => {
    if (!form.titulo.trim()) { alert('El título es obligatorio'); return; }
    if (!form.precio) { alert('El precio de venta es obligatorio'); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const payload = {
        ...form,
        precio: numOrNull(form.precio),
        precio_minimo: numOrNull(form.precio_minimo),
        precio_venta_acordado: numOrNull(form.precio_venta_acordado),
        comision_pct: numOrNull(form.comision_pct),
        reparto_pct: numOrNull(form.reparto_pct) ?? 100,
        superficie_construida: numOrNull(form.superficie_construida),
        superficie_util: numOrNull(form.superficie_util),
        superficie_parcela: numOrNull(form.superficie_parcela),
        habitaciones: numOrNull(form.habitaciones),
        banos: numOrNull(form.banos),
        aseos: numOrNull(form.aseos),
        consumo_energetico: numOrNull(form.consumo_energetico),
        ano_construccion: numOrNull(form.ano_construccion),
        updated_at: now,
      };
      let rec;
      if (isNew) {
        const referencia = await genRef();
        const id = crypto.randomUUID();
        const { data: d, error } = await supabase.from('properties')
          .insert({ id, referencia, ...payload, created_at: now, publicado_web: false, fotos: [] })
          .select().single();
        if (error) throw error;
        rec = d;
      } else {
        const { data: d, error } = await supabase.from('properties').update(payload).eq('id', property.id).select().single();
        if (error) throw error;
        rec = d;
      }
      onSaved(rec);
      alert(isNew ? 'Inmueble creado. Ahora puedes añadir fotos y documentos.' : 'Cambios guardados.');
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este inmueble? No se puede deshacer.')) return;
    setDeleting(true);
    const { error } = await supabase.from('properties').delete().eq('id', property.id);
    if (error) { alert(`Error: ${error.message}`); setDeleting(false); return; }
    onDeleted();
  };

  const selCon = contacts.find(c => c.id === form.contact_id);
  const filtCon = cSearch ? contacts.filter(c => c.name?.toLowerCase().includes(cSearch.toLowerCase())).slice(0,15) : [];

  return (
    <div style={{ maxWidth:820 }}>
      <Sec title="Identificación">
        <Grid2>
          <div style={{ gridColumn:'1/-1' }}>
            <FL>Título del anuncio *</FL>
            <input className="fi" value={form.titulo} onChange={e => set('titulo',e.target.value)} placeholder="Ej: Piso luminoso en el centro..." />
          </div>
          <div>
            <FL>Estado de venta</FL>
            <select className="fi" value={form.estado_venta} onChange={e => set('estado_venta',e.target.value)}>
              {Object.keys(ESTADOS_VENTA).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <FL>Estado de conservación</FL>
            <select className="fi" value={form.estado_conservacion} onChange={e => set('estado_conservacion',e.target.value)}>
              <option value="">Seleccionar...</option>
              {ESTADOS_CONSERVACION.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <FL>Comercial asignado</FL>
            <select className="fi" value={form.comercial_id} onChange={e => set('comercial_id',e.target.value)}>
              <option value="">Seleccionar...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div style={{ position:'relative' }}>
            <FL>Propietario (contacto CRM)</FL>
            {selCon ? (
              <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 11px', border:'1.5px solid #C9CBD3', borderRadius:"14px 14px 14px 0" }}>
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:BRAND }}>{selCon.name}</span>
                <button onClick={() => { set('contact_id',''); setCSearch(''); }} style={{ fontSize:12, color:'#dc2626', border:'none', background:'none', cursor:'pointer' }}>✕</button>
              </div>
            ) : (
              <>
                <input className="fi" placeholder="Buscar contacto..." value={cSearch} onChange={e => setCSearch(e.target.value)} />
                {filtCon.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1.5px solid #C9CBD3', borderRadius:"14px 14px 14px 0", zIndex:200, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,.12)' }}>
                    {filtCon.map(c => (
                      <div key={c.id} onClick={() => { set('contact_id',c.id); setCSearch(''); }}
                        style={{ padding:'8px 12px', fontSize:13, cursor:'pointer', borderBottom:'1px solid #F6F5F1' }}
                        onMouseEnter={e => e.currentTarget.style.background='#F6F5F1'}
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
      </Sec>

      <Sec title="Tipo de inmueble">
        <div style={{ maxWidth:320 }}>
          <select className="fi" value={form.tipo_inmueble} onChange={e => set('tipo_inmueble',e.target.value)}>
            <option value="">Seleccionar tipo...</option>
            {TIPOS_INMUEBLE.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </Sec>

      <Sec title="Precio">
        <Grid2>
          <div>
            <FL>Precio de venta (€) *</FL>
            <input className="fi" type="number" value={form.precio} onChange={e => set('precio',e.target.value)} placeholder="0" />
          </div>
          {isAdmin && (
            <div>
              <FL>Precio mínimo aceptado (€) — solo admin</FL>
              <input className="fi" type="number" value={form.precio_minimo} onChange={e => set('precio_minimo',e.target.value)} placeholder="0" />
            </div>
          )}
          <div>
            <FL>Precio venta acordado (€) — final</FL>
            <input className="fi" type="number" value={form.precio_venta_acordado} onChange={e => set('precio_venta_acordado',e.target.value)} placeholder="Se rellena al cerrar la venta" />
          </div>
        </Grid2>
      </Sec>

      {isAdmin && (() => {
        const com = Number(form.comision_pct)||0, rep = form.reparto_pct===''||form.reparto_pct==null ? 100 : Number(form.reparto_pct);
        const ben = v => v ? Math.round(Number(v)*com/100*rep/100) : null;
        const eur = v => v==null ? '—' : v.toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' €';
        const est = ben(form.precio), fin = ben(form.precio_venta_acordado);
        const box = (label, val, hi) => (
          <div style={{ background: hi ? '#00208F' : '#F6F5F1', color: hi ? 'white' : '#0B1233', borderRadius:'14px 14px 14px 0', padding:'12px 14px', border: hi ? 'none' : '1px solid #E4E2DA' }}>
            <div className="mono" style={{ fontSize:10, letterSpacing:'.08em', textTransform:'uppercase', color: hi ? '#8FA2F0' : '#5B6178' }}>{label}</div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:22, letterSpacing:'-.03em', marginTop:4 }}>{eur(val)}</div>
          </div>);
        return (
          <Sec title="Beneficio para nosotros">
            <Grid2>
              <div>
                <FL>Comisión (%)</FL>
                <input className="fi" type="number" step="0.01" value={form.comision_pct} onChange={e => set('comision_pct',e.target.value)} placeholder="Ej. 3" />
              </div>
              <div>
                <FL>Reparto de la comisión (%)</FL>
                <select className="fi" value={[100,50].includes(Number(form.reparto_pct)) ? String(Number(form.reparto_pct)) : 'otro'} onChange={e => set('reparto_pct', e.target.value==='otro' ? '' : Number(e.target.value))}>
                  <option value="100">100 % — sin compartir</option>
                  <option value="50">50 % — compartida</option>
                  <option value="otro">Otro…</option>
                </select>
                {![100,50].includes(Number(form.reparto_pct)) && (
                  <input className="fi" style={{ marginTop:6 }} type="number" step="0.01" value={form.reparto_pct} onChange={e => set('reparto_pct',e.target.value)} placeholder="% que nos corresponde" />
                )}
              </div>
              {box('Beneficio estimado · precio de venta', est)}
              {box('Beneficio final · precio acordado', fin, true)}
            </Grid2>
          </Sec>
        );
      })()}

      <Sec title="Ubicación">
        <Grid2>
          <div style={{ gridColumn:'1/-1' }}>
            <FL>Dirección *</FL>
            <input className="fi" value={form.direccion} onChange={e => set('direccion',e.target.value)} placeholder="Calle, número..." />
          </div>
          <div><FL>Localidad *</FL><input className="fi" value={form.localidad} onChange={e => set('localidad',e.target.value)} placeholder="Localidad" /></div>
          <div><FL>Municipio</FL><input className="fi" value={form.municipio} onChange={e => set('municipio',e.target.value)} placeholder="Municipio" /></div>
          <div><FL>Provincia</FL><input className="fi" value={form.provincia} onChange={e => set('provincia',e.target.value)} placeholder="Provincia" /></div>
          <div><FL>Código Postal</FL><input className="fi" value={form.codigo_postal} onChange={e => set('codigo_postal',e.target.value)} placeholder="00000" maxLength={5} /></div>
          <div style={{ gridColumn:'1/-1' }}><FL>Zona / Barrio</FL><input className="fi" value={form.zona_barrio} onChange={e => set('zona_barrio',e.target.value)} placeholder="Zona o barrio" /></div>
        </Grid2>
      </Sec>

      <Sec title="Características">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          <div><FL>Sup. construida (m²)</FL><input className="fi" type="number" value={form.superficie_construida} onChange={e => set('superficie_construida',e.target.value)} placeholder="0" /></div>
          <div><FL>Sup. útil (m²)</FL><input className="fi" type="number" value={form.superficie_util} onChange={e => set('superficie_util',e.target.value)} placeholder="0" /></div>
          <div><FL>Sup. parcela (m²)</FL><input className="fi" type="number" value={form.superficie_parcela} onChange={e => set('superficie_parcela',e.target.value)} placeholder="0" /></div>
          <div><FL>Habitaciones</FL><input className="fi" type="number" value={form.habitaciones} onChange={e => set('habitaciones',e.target.value)} placeholder="0" /></div>
          <div><FL>Baños</FL><input className="fi" type="number" value={form.banos} onChange={e => set('banos',e.target.value)} placeholder="0" /></div>
          <div><FL>Aseos</FL><input className="fi" type="number" value={form.aseos} onChange={e => set('aseos',e.target.value)} placeholder="0" /></div>
          <div><FL>Planta</FL><input className="fi" value={form.planta} onChange={e => set('planta',e.target.value)} placeholder="Ej: 2, Bajo..." /></div>
          <div>
            <FL>Orientación</FL>
            <select className="fi" value={form.orientacion} onChange={e => set('orientacion',e.target.value)}>
              <option value="">Seleccionar...</option>
              {ORIENTACION_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div><FL>Año construcción</FL><input className="fi" type="number" value={form.ano_construccion} onChange={e => set('ano_construccion',e.target.value)} placeholder="2000" /></div>
        </div>
      </Sec>

      <Sec title="Extras">
        <div style={{ display:'flex', flexWrap:'wrap', gap:'12px 28px' }}>
          {EXTRAS.map(e => (
            <label key={e.key} style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', fontWeight: form[e.key] ? 700 : 400, color: form[e.key] ? BRAND : '#3A4058' }}>
              <input type="checkbox" checked={form[e.key]} onChange={ev => set(e.key, ev.target.checked)}
                style={{ width:15, height:15, accentColor:BRAND, cursor:'pointer' }} />
              {e.label}
            </label>
          ))}
        </div>
      </Sec>

      <Sec title="Calefacción">
        <div style={{ maxWidth:320 }}>
          <select className="fi" value={form.calefaccion} onChange={e => set('calefaccion',e.target.value)}>
            <option value="">Seleccionar...</option>
            {CALEFACCION_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </Sec>

      <Sec title="Certificado energético">
        <Grid2>
          <div>
            <FL>Letra energética</FL>
            <select className="fi" value={form.certificado_energetico} onChange={e => set('certificado_energetico',e.target.value)}>
              <option value="">Seleccionar...</option>
              {CERT_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div><FL>Consumo energético (kWh/m²)</FL><input className="fi" type="number" value={form.consumo_energetico} onChange={e => set('consumo_energetico',e.target.value)} placeholder="0" /></div>
        </Grid2>
      </Sec>

      <Sec title="Descripción y notas">
        <div style={{ marginBottom:12 }}>
          <FL>Descripción comercial (se publica en la web)</FL>
          <textarea value={form.descripcion_web} onChange={e => set('descripcion_web',e.target.value)}
            placeholder="Descripción pública del inmueble..." rows={6}
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #C9CBD3', borderRadius:"14px 14px 14px 0", fontSize:13, minHeight:120, resize:'vertical', fontFamily:'inherit', color:'#0B1233', outline:'none', boxSizing:'border-box' }} />
          <p style={{ fontSize:11, color:'#8A8FA3', marginTop:4 }}>Este texto aparecerá en la ficha del inmueble en quenecesitashoy.es</p>
        </div>
        <div style={{ marginBottom:12 }}>
          <FL>Notas internas (solo CRM)</FL>
          <textarea value={form.notas_internas} onChange={e => set('notas_internas',e.target.value)}
            placeholder="Notas internas..."
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #C9CBD3', borderRadius:"14px 14px 14px 0", fontSize:13, minHeight:80, resize:'vertical', fontFamily:'inherit', color:'#0B1233', outline:'none', boxSizing:'border-box' }} />
        </div>
        <Grid2>
          <div><FL>URL Vídeo YouTube</FL><input className="fi" value={form.video_url} onChange={e => set('video_url',e.target.value)} placeholder="https://youtube.com/..." /></div>
          <div><FL>Referencia catastral</FL><input className="fi" value={form.referencia_catastral} onChange={e => set('referencia_catastral',e.target.value)} placeholder="Ref. catastral..." /></div>
        </Grid2>
      </Sec>

      {/* Acciones */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #E4E2DA', marginTop:8 }}>
        <div>
          {!isNew && (
            <button onClick={handleDelete} disabled={deleting}
              style={{ padding:'9px 16px', borderRadius:"14px 14px 14px 0", border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
              {deleting ? 'Eliminando...' : '🗑 Eliminar inmueble'}
            </button>
          )}
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'10px 28px', borderRadius:"14px 14px 14px 0", border:'none', background: saving ? '#8A8FA3' : BRAND, color:'white', fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Guardando...' : isNew ? '✓ Crear inmueble' : '✓ Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

// ─── Tab 2: Fotos ─────────────────────────────────────────────────────────────

function TabFotos({ property, onPropUpdated }) {
  const [photos, setPhotos] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [orientations, setOrientations] = useState({});
  const [uploadProgress, setUploadProgress] = useState(null); // { done, total } | null
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => { loadPhotos(); }, [property.id]); // eslint-disable-line

  const loadPhotos = async () => {
    const { data } = await supabase.from('property_photos').select('*').eq('property_id', property.id).order('orden', { ascending:true });
    const list = data || [];
    setPhotos(list);
    refreshSignedUrls(list);
  };

  const refreshSignedUrls = async (list) => {
    const entries = await Promise.all(list.map(async p => {
      const { data, error } = await supabase.storage.from('documentos').createSignedUrl(p.url, 3600);
      if (error) { console.log('[foto upload] error:', error); return [p.id, null]; }
      return [p.id, data.signedUrl];
    }));
    setSignedUrls(Object.fromEntries(entries));
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (!files.length) return;
    await handleUploadMultiple(files);
  };

  const handleUploadMultiple = async (files) => {
    setUploadProgress({ done:0, total:files.length });
    let currentPhotos = photos;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const nombreLimpio = sanitizeFileName(file.name);
        const storagePath = `properties/${property.id}/fotos/${Date.now()}_${i}_${nombreLimpio}`;
        const { error: upErr } = await supabase.storage.from('documentos').upload(storagePath, file, { upsert:true });
        if (upErr) throw upErr;
        const orden = currentPhotos.length;
        const { data: rec, error: dbErr } = await supabase.from('property_photos').insert({
          id: crypto.randomUUID(), property_id: property.id, url: storagePath,
          nombre: file.name, orden, created_at: new Date().toISOString(),
        }).select().single();
        if (dbErr) throw dbErr;
        currentPhotos = [...currentPhotos, rec];
        setPhotos(currentPhotos);
        refreshSignedUrls(currentPhotos);
      } catch (error) {
        console.log('[foto upload] error:', error);
        alert(`Error al subir "${file.name}": ${error.message}`);
      } finally {
        setUploadProgress(p => p ? { ...p, done: p.done + 1 } : null);
      }
    }
    const fotosPaths = currentPhotos.map(p => p.url);
    await supabase.from('properties').update({ fotos: fotosPaths }).eq('id', property.id);
    onPropUpdated({ ...property, fotos: fotosPaths });
    setUploadProgress(null);
  };

  const handleDelete = async (photo) => {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    await supabase.from('property_photos').delete().eq('id', photo.id);
    const { error } = await supabase.storage.from('documentos').remove([photo.url]);
    if (error) console.log('[foto upload] error:', error);
    const newPhotos = photos.filter(p => p.id !== photo.id).map((p,i) => ({ ...p, orden:i }));
    setPhotos(newPhotos);
    for (const p of newPhotos) await supabase.from('property_photos').update({ orden:p.orden }).eq('id', p.id);
    const fotosPaths = newPhotos.map(p => p.url);
    await supabase.from('properties').update({ fotos: fotosPaths }).eq('id', property.id);
    onPropUpdated({ ...property, fotos: fotosPaths });
  };

  const handleDrop = async (e, targetIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOver(null); return; }
    const arr = [...photos];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(targetIdx, 0, moved);
    const reordered = arr.map((p,i) => ({ ...p, orden:i }));
    setPhotos(reordered);
    setDragIdx(null); setDragOver(null);
    for (const p of reordered) await supabase.from('property_photos').update({ orden:p.orden }).eq('id', p.id);
    const fotosPaths = reordered.map(p => p.url);
    await supabase.from('properties').update({ fotos: fotosPaths }).eq('id', property.id);
    onPropUpdated({ ...property, fotos: fotosPaths });
  };

  const handleImgLoad = (photoId) => (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setOrientations(o => ({ ...o, [photoId]: `${naturalWidth}/${naturalHeight}` }));
  };

  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'#3A4058' }}>{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</p>
          <p style={{ fontSize:11, color:'#8A8FA3' }}>Arrastra para reordenar · La primera foto es la imagen principal</p>
        </div>
        <label style={{ cursor: uploadProgress ? 'not-allowed' : 'pointer' }}>
          <span style={{ display:'inline-block', padding:'9px 18px', borderRadius:"14px 14px 14px 0", background: uploadProgress ? '#8A8FA3' : BRAND, color:'white', fontSize:12, fontWeight:700, pointerEvents:'none' }}>
            {uploadProgress ? `Subiendo ${uploadProgress.done}/${uploadProgress.total}...` : '+ Añadir fotos'}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleFileChange} disabled={!!uploadProgress} multiple />
        </label>
      </div>

      {uploadProgress && (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#5B6178', marginBottom:4 }}>
            <span>Subiendo fotos...</span>
            <span>{uploadProgress.done}/{uploadProgress.total}</span>
          </div>
          <div style={{ width:'100%', height:6, background:'#E4E2DA', borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:`${(uploadProgress.done/uploadProgress.total)*100}%`, height:'100%', background:BRAND, transition:'width .2s' }} />
          </div>
        </div>
      )}

      {photos.length === 0 && !uploadProgress && (
        <div style={{ textAlign:'center', padding:'50px 0', background:'#F6F5F1', borderRadius:"20px 20px 20px 0", border:'2px dashed #C9CBD3', color:'#8A8FA3' }}>
          <div style={{ fontSize:44, marginBottom:8 }}>📷</div>
          <p style={{ fontSize:13 }}>No hay fotos. Añade la primera.</p>
          <p style={{ fontSize:11, marginTop:4 }}>JPG, PNG o WEBP</p>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
        {photos.map((photo, idx) => (
          <div key={photo.id} draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
            onDrop={e => handleDrop(e, idx)}
            onDragEnd={() => { setDragIdx(null); setDragOver(null); }}
            style={{ position:'relative', borderRadius:"14px 14px 14px 0", overflow:'hidden', border: dragOver===idx ? `2.5px dashed ${BRAND}` : '2px solid #E4E2DA', cursor:'grab', opacity: dragIdx===idx ? 0.4 : 1, background:'#111' }}
          >
            {signedUrls[photo.id] ? (
              <img src={signedUrls[photo.id]} alt="" onLoad={handleImgLoad(photo.id)}
                style={{ width:'100%', aspectRatio: orientations[photo.id] || 'auto', objectFit:'contain', display:'block', background:'#111' }} />
            ) : (
              <div style={{ width:'100%', aspectRatio:'4/5', display:'flex', alignItems:'center', justifyContent:'center', color:'#8A8FA3', fontSize:11 }}>Cargando...</div>
            )}
            {idx === 0 && (
              <span style={{ position:'absolute', top:8, left:8, background:BRAND, color:'white', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:"20px 20px 20px 0" }}>PRINCIPAL</span>
            )}
            <button onClick={() => handleDelete(photo)}
              style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(220,38,38,.88)', color:'white', border:'none', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              ✕
            </button>
            <div style={{ padding:'5px 0', textAlign:'center', background:'white' }}>
              <span style={{ fontSize:10, color:'#8A8FA3' }}>#{idx+1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 3: Documentos ────────────────────────────────────────────────────────

function TabDocs({ property, user, onPropUpdated }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState('');
  const [docTipo, setDocTipo] = useState('Otros');
  const [noAplica, setNoAplica] = useState(property.docs_no_aplica || []);

  useEffect(() => { loadDocs(); }, [property.id]); // eslint-disable-line

  const loadDocs = async () => {
    const { data } = await supabase.from('property_documents').select('*').eq('property_id', property.id).order('created_at', { ascending:false });
    setDocs(data || []);
  };

  const subir = async (file, tipo) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se aceptan archivos PDF'); return; }
    setUploading(tipo);
    try {
      const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`;
      const storagePath = `properties/${property.id}/docs/${fileName}`;
      const compressedFile = await compressFileIfPdf(file);
      const { error: upErr } = await supabase.storage.from('documentos').upload(storagePath, compressedFile, { upsert:true });
      if (upErr) throw upErr;
      const { data: rec, error: dbErr } = await supabase.from('property_documents').insert({
        id: crypto.randomUUID(), property_id: property.id, nombre: file.name,
        tipo, url: storagePath, size: file.size, uploaded_by: user.id, created_at: new Date().toISOString(),
      }).select().single();
      if (dbErr) throw dbErr;
      setDocs(d => [rec, ...d]);
      if (noAplica.includes(tipo)) toggleNoAplica(tipo);
    } catch (e) { alert(`Error al subir: ${e.message}`); }
    finally { setUploading(''); }
  };
  const handleUpload = e => { const f = e.target.files[0]; e.target.value = ''; subir(f, docTipo); };

  const toggleNoAplica = async (id) => {
    const next = noAplica.includes(id) ? noAplica.filter(x => x !== id) : [...noAplica, id];
    setNoAplica(next);
    const { data } = await supabase.from('properties').update({ docs_no_aplica: next }).eq('id', property.id).select().single();
    if (data && onPropUpdated) onPropUpdated(data);
  };

  const handleDownload = async (doc) => {
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.url, 120);
    if (error) { alert('Error al generar enlace'); return; }
    window.open(data.signedUrl, '_blank');
  };
  const handleDelete = async (doc) => {
    if (!window.confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    await supabase.storage.from('documentos').remove([doc.url]);
    await supabase.from('property_documents').delete().eq('id', doc.id);
    setDocs(d => d.filter(x => x.id !== doc.id));
  };

  const docsDe = id => docs.filter(d => d.tipo === id);
  const oblig = DOCS_OBLIGATORIOS.filter(d => !noAplica.includes(d.id));
  const okOblig = oblig.filter(d => docsDe(d.id).length).length;
  const pct = oblig.length ? Math.round(okOblig / oblig.length * 100) : 100;

  const Fila = ({ d }) => {
    const lista = docsDe(d.id); const ok = lista.length > 0; const na = noAplica.includes(d.id);
    const dias = ok ? Math.floor((Date.now() - new Date(lista[0].created_at)) / 864e5) : 0;
    const caducado = ok && d.caduca && dias > d.caduca;
    return (
      <div style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'12px 0', borderTop:'1px solid #E4E2DA', opacity: na ? .5 : 1 }}>
        <span style={{ width:22, height:22, flexShrink:0, marginTop:1, borderRadius:'7px 7px 7px 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700,
          background: ok ? (caducado ? '#FFB81C' : '#00208F') : 'white', color: ok ? (caducado ? '#0B1233' : 'white') : '#8A8FA3', border: ok ? 'none' : '1.5px solid #C9CBD3' }}>
          {ok ? (caducado ? '!' : '✓') : na ? '–' : ''}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:14, fontWeight:500, color:'#0B1233', textDecoration: na ? 'line-through' : 'none' }}>{d.id}</p>
          <p style={{ fontSize:12, color:'#5B6178' }}>{d.info}{caducado ? ` · Tiene ${dias} días: conviene pedir una nueva.` : ''}</p>
          {lista.map(doc => (
            <div key={doc.id} style={{ display:'flex', gap:8, alignItems:'center', marginTop:6, fontSize:12 }}>
              <button onClick={() => handleDownload(doc)} style={{ background:'none', border:'none', padding:0, color:'#00208F', cursor:'pointer', textDecoration:'underline', fontSize:12, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nombre}</button>
              <span className="mono" style={{ fontSize:10, color:'#8A8FA3' }}>{new Date(doc.created_at).toLocaleDateString('es-ES')}</span>
              <button onClick={() => handleDelete(doc)} title="Eliminar" style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:12 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
          {!ok && (
            <button onClick={() => toggleNoAplica(d.id)} className="btn-g" style={{ padding:'4px 10px', fontSize:11 }}>{na ? 'Sí aplica' : 'No aplica'}</button>
          )}
          <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <span className={ok ? 'btn-g' : 'btn-p'} style={{ display:'inline-block', padding:'5px 12px', fontSize:12, pointerEvents:'none' }}>
              {uploading === d.id ? 'Subiendo…' : ok ? '+ Otro' : 'Subir PDF'}
            </span>
            <input type="file" accept=".pdf,application/pdf" style={{ display:'none' }} disabled={!!uploading}
              onChange={e => { const f = e.target.files[0]; e.target.value = ''; subir(f, d.id); }} />
          </label>
        </div>
      </div>
    );
  };

  const otros = docs.filter(d => !DOC_TIPOS.slice(0,-1).includes(d.tipo));

  return (
    <div style={{ maxWidth:860 }}>
      <div className="card" style={{ padding:24, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          <div>
            <div className="eyebrow">Documentos obligatorios del vendedor</div>
            <h3>{okOblig} de {oblig.length} entregados</h3>
          </div>
          <span style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:28, letterSpacing:'-.04em', color: pct===100 ? '#00208F' : '#0B1233' }}>{pct} %</span>
        </div>
        <div style={{ height:10, background:'#F0EFEA', borderRadius:'8px 8px 8px 0', marginBottom:8 }}>
          <div style={{ height:'100%', width:`${pct}%`, background: pct===100 ? '#00208F' : '#FFB81C', borderRadius:'8px 8px 8px 0', transition:'width .3s' }} />
        </div>
        {DOCS_OBLIGATORIOS.map(d => <Fila key={d.id} d={d} />)}
      </div>

      <div className="card" style={{ padding:24, marginBottom:16 }}>
        <div className="eyebrow">Según el caso</div>
        <p style={{ fontSize:13, color:'#5B6178', marginBottom:6 }}>Solo si aplican a este inmueble.</p>
        {DOCS_ESPECIALES.map(d => <Fila key={d.id} d={d} />)}
      </div>

      <div className="card" style={{ padding:24 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', marginBottom:8 }}>
          <div className="eyebrow" style={{ marginBottom:0 }}>Otros documentos</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <select className="fi" value={docTipo} onChange={e => setDocTipo(e.target.value)} style={{ width:'auto', fontSize:13, padding:'6px 10px' }}>
              {DOC_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
              <span className="btn-p" style={{ display:'inline-block', padding:'7px 14px', fontSize:12, pointerEvents:'none' }}>{uploading && !DOC_TIPOS.slice(0,-1).includes(uploading) ? 'Subiendo…' : '+ Subir PDF'}</span>
              <input type="file" accept=".pdf,application/pdf" style={{ display:'none' }} onChange={handleUpload} disabled={!!uploading} />
            </label>
          </div>
        </div>
        {otros.length === 0 && <p style={{ fontSize:13, color:'#8A8FA3', paddingTop:8 }}>Sin otros documentos.</p>}
        {otros.map(doc => (
          <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop:'1px solid #E4E2DA' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:14, fontWeight:500, color:'#0B1233', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nombre}</p>
              <p className="mono" style={{ fontSize:10, color:'#8A8FA3' }}>{doc.tipo}{doc.size ? ` · ${(doc.size/1024).toFixed(0)} KB` : ''} · {new Date(doc.created_at).toLocaleDateString('es-ES')}</p>
            </div>
            <button className="btn-g" style={{ padding:'5px 12px', fontSize:12 }} onClick={() => handleDownload(doc)}>Descargar</button>
            <button onClick={() => handleDelete(doc)} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 4: Publicación ───────────────────────────────────────────────────────

function TabPublicacion({ property, onPropUpdated }) {
  const [toggling, setToggling] = useState(false);
  const published = property.publicado_web;
  const fotos = Array.isArray(property.fotos) ? property.fotos : [];
  const [coverUrl, setCoverUrl] = useState(null);

  useEffect(() => {
    let active = true;
    if (fotos[0]) {
      supabase.storage.from('documentos').createSignedUrl(fotos[0], 3600).then(({ data, error }) => {
        if (!active) return;
        if (error) { console.log('[foto upload] error:', error); setCoverUrl(null); return; }
        setCoverUrl(data.signedUrl);
      });
    } else {
      setCoverUrl(null);
    }
    return () => { active = false; };
  }, [fotos[0]]); // eslint-disable-line

  const handleToggle = async () => {
    setToggling(true);
    const newVal = !published;
    const hoy = new Date().toISOString().split('T')[0];
    const { data: rec, error } = await supabase.from('properties')
      .update({ publicado_web: newVal, ...(newVal ? { fecha_publicacion: hoy } : {}) })
      .eq('id', property.id).select().single();
    if (error) { alert(`Error: ${error.message}`); setToggling(false); return; }
    onPropUpdated(rec);
    setToggling(false);
  };

  return (
    <div style={{ maxWidth:600 }}>
      {/* Toggle */}
      <div style={{ background:'white', borderRadius:"20px 20px 20px 0", padding:28, marginBottom:20, boxShadow:"none" }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:20 }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:800, color:BRAND, marginBottom:6 }}>Publicar en quenecesitashoy.es/inmuebles/</h3>
            <p style={{ fontSize:12, color:'#5B6178' }}>
              {published
                ? `Publicado el ${property.fecha_publicacion ? new Date(property.fecha_publicacion).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}) : '—'}`
                : 'No publicado actualmente'}
            </p>
          </div>
          {/* Toggle switch */}
          <button onClick={handleToggle} disabled={toggling}
            style={{ width:56, height:30, borderRadius:15, background: published ? '#059669' : '#d1d5db', border:'none', cursor:'pointer', position:'relative', transition:'background .3s', flexShrink:0 }}>
            <span style={{ display:'block', width:24, height:24, borderRadius:'50%', background:'white', position:'absolute', top:3, left: published ? 29 : 3, transition:'left .3s', boxShadow:'0 1px 4px rgba(0,0,0,.2)' }} />
          </button>
        </div>
        <div style={{ marginTop:16 }}>
          {published ? (
            <span style={{ fontSize:13, fontWeight:700, color:'#059669', background:'#d1fae5', padding:'4px 14px', borderRadius:"20px 20px 20px 0" }}>🌐 Publicado</span>
          ) : (
            <span style={{ fontSize:13, fontWeight:700, color:'#5B6178', background:'#f3f4f6', padding:'4px 14px', borderRadius:"20px 20px 20px 0" }}>⭕ No publicado</span>
          )}
        </div>
      </div>

      {/* Vista previa */}
      <div style={{ background:'white', borderRadius:"20px 20px 20px 0", padding:20, boxShadow:"none" }}>
        <h3 style={{ fontSize:11, fontWeight:800, color:BRAND, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:16 }}>Vista previa web</h3>
        <div style={{ border:'1.5px solid #E4E2DA', borderRadius:"20px 20px 20px 0", overflow:'hidden' }}>
          <div style={{ height:180, background:'#F6F5F1', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {coverUrl
              ? <img src={coverUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ fontSize:44 }}>🏠</span>}
          </div>
          <div style={{ padding:16 }}>
            <p style={{ fontSize:10, color:'#8A8FA3', marginBottom:4 }}>{property.referencia} · {property.tipo_inmueble||'—'}</p>
            <h4 style={{ fontSize:15, fontWeight:800, color:'#0B1233', marginBottom:4 }}>{property.titulo||'Sin título'}</h4>
            <p style={{ fontSize:12, color:'#5B6178', marginBottom:8 }}>📍 {[property.localidad, property.municipio].filter(Boolean).join(', ')||'—'}</p>
            {property.precio && (
              <p style={{ fontSize:20, fontWeight:800, color:'#059669', fontFamily:"'Poppins',sans-serif", marginBottom:8 }}>{fmt(property.precio)}</p>
            )}
            {property.precio_venta_acordado && (
              <p style={{ fontSize:14, color:'#0B1233', marginBottom:8 }}><span className="mono" style={{ fontSize:10, letterSpacing:'.08em', color:'#5B6178', marginRight:6 }}>VENTA ACORDADA</span><strong>{fmt(property.precio_venta_acordado)}</strong></p>
            )}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {property.superficie_construida && <span style={{ fontSize:12, color:'#3A4058' }}>📐 {property.superficie_construida} m²</span>}
              {property.habitaciones && <span style={{ fontSize:12, color:'#3A4058' }}>🛏 {property.habitaciones} hab.</span>}
              {property.banos && <span style={{ fontSize:12, color:'#3A4058' }}>🚿 {property.banos} baños</span>}
            </div>
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
      <h3 style={{ fontSize:11, fontWeight:800, color:BRAND, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12, paddingBottom:6, borderBottom:'2px solid #E4E2DA' }}>
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
  return <label style={{ fontSize:11, fontWeight:700, color:'#3A4058', marginBottom:4, display:'block', textTransform:'uppercase', letterSpacing:'.5px' }}>{children}</label>;
}
