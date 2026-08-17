import { useState, useEffect } from 'react';
import { supabase, sanitizeFileName, compressFileIfPdf } from './utils/supabase';

const BRAND = '#002292';
const TIPOS_INMUEBLE = ['Piso','Casa/Chalet','Local comercial','Oficina','Garaje','Trastero','Terreno','Nave industrial','Finca rústica'];
const ESTADOS_VENTA = {
  Disponible: { color:'#059669', bg:'#d1fae5' },
  Reservado:  { color:'#d97706', bg:'#fef3c7' },
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
const DOC_TIPOS = ['Nota simple','Nota catastro','Certificado energético','Planos','Cédula de habitabilidad','IBI','Estatutos comunidad','Otros'];

const EMPTY_FORM = {
  titulo:'', tipo_inmueble:'', estado_venta:'Disponible', estado_conservacion:'',
  comercial_id:'', contact_id:'', precio:'', precio_minimo:'',
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
  return { padding:'7px 12px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, color:'#374151', background:'white', cursor:'pointer' };
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
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, color:BRAND }}>🏠 Inmobiliaria</h1>
          <p style={{ color:'#9ca3af', fontSize:13 }}>{filtered.length} inmuebles</p>
        </div>
        <button onClick={() => setSelected('new')}
          style={{ padding:'10px 20px', borderRadius:10, border:'none', background:BRAND, color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
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
        <p style={{ color:'#9ca3af', fontSize:13 }}>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
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
  const est = ESTADOS_VENTA[p.estado_venta] || { color:'#6b7280', bg:'#f3f4f6' };
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
      style={{ background:'white', borderRadius:14, overflow:'hidden', cursor:'pointer', boxShadow:'0 1px 4px rgba(0,35,146,.07)', transition:'transform .2s,box-shadow .2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(0,35,146,.14)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,35,146,.07)'; }}
    >
      {/* Foto */}
      <div style={{ height:200, background:'#f0f3fb', position:'relative', overflow:'hidden' }}>
        {coverUrl ? (
          <img src={coverUrl} alt={p.titulo} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }}>
            <span style={{ fontSize:40 }}>🏠</span>
            <span style={{ fontSize:11, color:'#9ca3af' }}>Sin fotos</span>
          </div>
        )}
        <span style={{ position:'absolute', top:10, left:10, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:est.bg, color:est.color }}>
          {p.estado_venta}
        </span>
        {p.publicado_web && (
          <span style={{ position:'absolute', top:10, right:10, fontSize:18 }} title="Publicado en web">🌐</span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'14px 16px' }}>
        <p style={{ fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>
          {p.referencia}{p.tipo_inmueble ? ` · ${p.tipo_inmueble}` : ''}
        </p>
        <h3 style={{ fontSize:14, fontWeight:800, color:BRAND, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {p.titulo || 'Sin título'}
        </h3>
        <p style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>
          📍 {[p.localidad, p.municipio].filter(Boolean).join(', ') || '—'}
        </p>
        {p.precio && (
          <p style={{ fontSize:22, fontWeight:800, color:'#059669', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 }}>
            {fmt(p.precio)}
          </p>
        )}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:12 }}>
          {p.superficie_construida && <span style={{ fontSize:12, color:'#374151' }}>📐 {p.superficie_construida} m²</span>}
          {p.habitaciones && <span style={{ fontSize:12, color:'#374151' }}>🛏 {p.habitaciones}</span>}
          {p.banos && <span style={{ fontSize:12, color:'#374151' }}>🚿 {p.banos}</span>}
        </div>
        <button onClick={e => { e.stopPropagation(); onView(); }}
          style={{ width:'100%', padding:'7px 0', borderRadius:8, border:`1.5px solid ${BRAND}`, background:'transparent', color:BRAND, fontSize:12, fontWeight:700, cursor:'pointer' }}>
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
  ];

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
        <button onClick={onClose}
          style={{ background:'none', border:'1.5px solid #dde2f0', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151' }}>
          ← Volver
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:800, color:BRAND }}>
            {isNew ? 'Nuevo inmueble' : (prop?.titulo || prop?.referencia || 'Ficha')}
          </h1>
          {prop && (
            <p style={{ fontSize:12, color:'#9ca3af' }}>
              {prop.referencia}{prop.tipo_inmueble ? ` · ${prop.tipo_inmueble}` : ''}
              {prop.estado_venta && (
                <span style={{ marginLeft:8, padding:'1px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:ESTADOS_VENTA[prop.estado_venta]?.bg, color:ESTADOS_VENTA[prop.estado_venta]?.color }}>
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
              padding:'7px 16px', borderRadius:8, border:'none', fontSize:12, fontWeight:700,
              cursor: t.disabled ? 'not-allowed' : 'pointer',
              background: tab === t.id ? BRAND : '#f0f3fc',
              color: tab === t.id ? 'white' : t.disabled ? '#c0c8e0' : '#6b7280',
              opacity: t.disabled ? 0.5 : 1,
              textTransform:'uppercase', letterSpacing:'.4px',
            }}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'datos'       && <TabDatos property={prop} user={user} users={inmoUsers} contacts={contacts} isAdmin={isAdmin} onSaved={handleSaved} onDeleted={() => onDeleted(prop?.id)} />}
      {tab === 'fotos'       && prop && <TabFotos property={prop} onPropUpdated={handleSaved} />}
      {tab === 'docs'        && prop && <TabDocs property={prop} user={user} />}
      {tab === 'publicacion' && prop && <TabPublicacion property={prop} onPropUpdated={handleSaved} />}
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
    precio: property.precio||'', precio_minimo: property.precio_minimo||'',
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
        </Grid2>
      </Sec>

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
            <label key={e.key} style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, cursor:'pointer', fontWeight: form[e.key] ? 700 : 400, color: form[e.key] ? BRAND : '#374151' }}>
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
          <FL>Descripción para la web (pública)</FL>
          <textarea value={form.descripcion_web} onChange={e => set('descripcion_web',e.target.value)}
            placeholder="Descripción pública del inmueble..."
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:120, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:12 }}>
          <FL>Notas internas (solo CRM)</FL>
          <textarea value={form.notas_internas} onChange={e => set('notas_internas',e.target.value)}
            placeholder="Notas internas..."
            style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #dde2f0', borderRadius:8, fontSize:13, minHeight:80, resize:'vertical', fontFamily:'inherit', color:'#1e2a4a', outline:'none', boxSizing:'border-box' }} />
        </div>
        <Grid2>
          <div><FL>URL Vídeo YouTube</FL><input className="fi" value={form.video_url} onChange={e => set('video_url',e.target.value)} placeholder="https://youtube.com/..." /></div>
          <div><FL>Referencia catastral</FL><input className="fi" value={form.referencia_catastral} onChange={e => set('referencia_catastral',e.target.value)} placeholder="Ref. catastral..." /></div>
        </Grid2>
      </Sec>

      {/* Acciones */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:16, borderTop:'1px solid #e8ecf8', marginTop:8 }}>
        <div>
          {!isNew && (
            <button onClick={handleDelete} disabled={deleting}
              style={{ padding:'9px 16px', borderRadius:8, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:13, fontWeight:700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
              {deleting ? 'Eliminando...' : '🗑 Eliminar inmueble'}
            </button>
          )}
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'10px 28px', borderRadius:8, border:'none', background: saving ? '#9ca3af' : BRAND, color:'white', fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer' }}>
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
    const remaining = 20 - photos.length;
    if (remaining <= 0) { alert('Máximo 20 fotos'); return; }
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) alert(`Solo se subirán ${remaining} foto(s): el máximo son 20 por inmueble.`);
    await handleUploadMultiple(toUpload);
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
    setOrientations(o => ({ ...o, [photoId]: naturalWidth >= naturalHeight ? '16/9' : '4/5' }));
  };

  return (
    <div style={{ maxWidth:820 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <p style={{ fontSize:13, fontWeight:600, color:'#374151' }}>{photos.length}/20 fotos</p>
          <p style={{ fontSize:11, color:'#9ca3af' }}>Arrastra para reordenar · La primera foto es la imagen principal</p>
        </div>
        <label style={{ cursor: photos.length >= 20 || uploadProgress ? 'not-allowed' : 'pointer' }}>
          <span style={{ display:'inline-block', padding:'9px 18px', borderRadius:8, background: photos.length >= 20 || uploadProgress ? '#9ca3af' : BRAND, color:'white', fontSize:12, fontWeight:700, pointerEvents:'none' }}>
            {uploadProgress ? `Subiendo ${uploadProgress.done}/${uploadProgress.total}...` : '+ Añadir fotos'}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display:'none' }} onChange={handleFileChange} disabled={photos.length >= 20 || !!uploadProgress} multiple />
        </label>
      </div>

      {uploadProgress && (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#6b7280', marginBottom:4 }}>
            <span>Subiendo fotos...</span>
            <span>{uploadProgress.done}/{uploadProgress.total}</span>
          </div>
          <div style={{ width:'100%', height:6, background:'#e8ecf8', borderRadius:4, overflow:'hidden' }}>
            <div style={{ width:`${(uploadProgress.done/uploadProgress.total)*100}%`, height:'100%', background:BRAND, transition:'width .2s' }} />
          </div>
        </div>
      )}

      {photos.length === 0 && !uploadProgress && (
        <div style={{ textAlign:'center', padding:'50px 0', background:'#f8f9fd', borderRadius:12, border:'2px dashed #dde2f0', color:'#9ca3af' }}>
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
            style={{ position:'relative', borderRadius:10, overflow:'hidden', border: dragOver===idx ? `2.5px dashed ${BRAND}` : '2px solid #e8ecf8', cursor:'grab', opacity: dragIdx===idx ? 0.4 : 1, background:'#111' }}
          >
            {signedUrls[photo.id] ? (
              <img src={signedUrls[photo.id]} alt="" onLoad={handleImgLoad(photo.id)}
                style={{ width:'100%', aspectRatio: orientations[photo.id] || '4/5', objectFit:'contain', display:'block', background:'#111' }} />
            ) : (
              <div style={{ width:'100%', aspectRatio:'4/5', display:'flex', alignItems:'center', justifyContent:'center', color:'#9ca3af', fontSize:11 }}>Cargando...</div>
            )}
            {idx === 0 && (
              <span style={{ position:'absolute', top:8, left:8, background:BRAND, color:'white', fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:20 }}>PRINCIPAL</span>
            )}
            <button onClick={() => handleDelete(photo)}
              style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(220,38,38,.88)', color:'white', border:'none', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              ✕
            </button>
            <div style={{ padding:'5px 0', textAlign:'center', background:'white' }}>
              <span style={{ fontSize:10, color:'#9ca3af' }}>#{idx+1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 3: Documentos ────────────────────────────────────────────────────────

function TabDocs({ property, user }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [docTipo, setDocTipo] = useState('Otros');

  useEffect(() => { loadDocs(); }, [property.id]); // eslint-disable-line

  const loadDocs = async () => {
    const { data } = await supabase.from('property_documents').select('*').eq('property_id', property.id).order('created_at', { ascending:false });
    setDocs(data || []);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se aceptan archivos PDF'); return; }
    setUploading(true);
    try {
      const ts = Date.now();
      const fileName = `${ts}-${sanitizeFileName(file.name)}`;
      const storagePath = `properties/${property.id}/docs/${fileName}`;
      const compressedFile = await compressFileIfPdf(file);
      const { error: upErr } = await supabase.storage.from('documentos').upload(storagePath, compressedFile, { upsert:true });
      if (upErr) throw upErr;
      const { data: rec, error: dbErr } = await supabase.from('property_documents').insert({
        id: crypto.randomUUID(), property_id: property.id, nombre: file.name,
        tipo: docTipo, url: storagePath, size: file.size,
        uploaded_by: user.id, created_at: new Date().toISOString(),
      }).select().single();
      if (dbErr) throw dbErr;
      setDocs(d => [rec, ...d]);
    } catch (e) {
      alert(`Error al subir: ${e.message}`);
    } finally {
      setUploading(false);
    }
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

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        <select value={docTipo} onChange={e => setDocTipo(e.target.value)} style={{ ...selSt(), fontSize:13 }}>
          {DOC_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
          <span style={{ display:'inline-block', padding:'8px 18px', borderRadius:8, background: uploading ? '#9ca3af' : BRAND, color:'white', fontSize:12, fontWeight:700, pointerEvents:'none' }}>
            {uploading ? 'Subiendo...' : '+ Subir PDF'}
          </span>
          <input type="file" accept=".pdf,application/pdf" style={{ display:'none' }} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {docs.length === 0 && (
        <div style={{ textAlign:'center', padding:'50px 0', background:'#f8f9fd', borderRadius:12, border:'2px dashed #dde2f0', color:'#9ca3af' }}>
          <div style={{ fontSize:40, marginBottom:8 }}>📄</div>
          <p style={{ fontSize:13 }}>No hay documentos.</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {docs.map(doc => (
          <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'white', borderRadius:10, border:'1.5px solid #e8ecf8' }}>
            <span style={{ fontSize:22, flexShrink:0 }}>📄</span>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#1e2a4a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.nombre}</p>
              <p style={{ fontSize:11, color:'#9ca3af' }}>
                {doc.tipo}{doc.size ? ` · ${(doc.size/1024).toFixed(0)} KB` : ''} · {new Date(doc.created_at).toLocaleDateString('es-ES')}
              </p>
            </div>
            <button onClick={() => handleDownload(doc)}
              style={{ padding:'6px 12px', borderRadius:7, border:`1.5px solid ${BRAND}`, background:'transparent', color:BRAND, fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              Descargar
            </button>
            <button onClick={() => handleDelete(doc)}
              style={{ padding:'6px 10px', borderRadius:7, border:'1.5px solid #fee2e2', background:'#fef2f2', color:'#dc2626', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              ✕
            </button>
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
      <div style={{ background:'white', borderRadius:14, padding:28, marginBottom:20, boxShadow:'0 1px 4px rgba(0,35,146,.07)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:20 }}>
          <div>
            <h3 style={{ fontSize:16, fontWeight:800, color:BRAND, marginBottom:6 }}>Publicar en quenecesitashoy.es/inmuebles/</h3>
            <p style={{ fontSize:12, color:'#6b7280' }}>
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
            <span style={{ fontSize:13, fontWeight:700, color:'#059669', background:'#d1fae5', padding:'4px 14px', borderRadius:20 }}>🌐 Publicado</span>
          ) : (
            <span style={{ fontSize:13, fontWeight:700, color:'#6b7280', background:'#f3f4f6', padding:'4px 14px', borderRadius:20 }}>⭕ No publicado</span>
          )}
        </div>
      </div>

      {/* Vista previa */}
      <div style={{ background:'white', borderRadius:14, padding:20, boxShadow:'0 1px 4px rgba(0,35,146,.07)' }}>
        <h3 style={{ fontSize:11, fontWeight:800, color:BRAND, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:16 }}>Vista previa web</h3>
        <div style={{ border:'1.5px solid #e8ecf8', borderRadius:12, overflow:'hidden' }}>
          <div style={{ height:180, background:'#f0f3fb', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {coverUrl
              ? <img src={coverUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ fontSize:44 }}>🏠</span>}
          </div>
          <div style={{ padding:16 }}>
            <p style={{ fontSize:10, color:'#9ca3af', marginBottom:4 }}>{property.referencia} · {property.tipo_inmueble||'—'}</p>
            <h4 style={{ fontSize:15, fontWeight:800, color:'#1e2a4a', marginBottom:4 }}>{property.titulo||'Sin título'}</h4>
            <p style={{ fontSize:12, color:'#6b7280', marginBottom:8 }}>📍 {[property.localidad, property.municipio].filter(Boolean).join(', ')||'—'}</p>
            {property.precio && (
              <p style={{ fontSize:20, fontWeight:800, color:'#059669', fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 }}>{fmt(property.precio)}</p>
            )}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {property.superficie_construida && <span style={{ fontSize:12, color:'#374151' }}>📐 {property.superficie_construida} m²</span>}
              {property.habitaciones && <span style={{ fontSize:12, color:'#374151' }}>🛏 {property.habitaciones} hab.</span>}
              {property.banos && <span style={{ fontSize:12, color:'#374151' }}>🚿 {property.banos} baños</span>}
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
