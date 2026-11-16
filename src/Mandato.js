import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './utils/supabase';
import { MANDATO_HTML, DESISTIMIENTO_HTML } from './mandatoPlantillas';
import { EditorArras, HistorialArras } from './Arras';
import { PanelFirma } from './Firma';

// ─── Utilidades ──────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const truthy = v => v !== undefined && v !== null && v !== false && String(v).trim() !== '';

// Mini-motor Mustache: {{#a.b}}…{{/a.b}} (mostrar si hay valor) y {{a.b}} (escapado, «—» si vacío)
export function renderTpl(tpl, data) {
  let out = tpl.replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, inner) => truthy(getPath(data, k)) ? inner : '');
  out = out.replace(/\{\{\^([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k, inner) => truthy(getPath(data, k)) ? '' : inner);
  out = out.replace(/\{\{([\w.]+)\}\}/g, (_, k) => { const v = getPath(data, k); return truthy(v) ? esc(v) : '—'; });
  return out;
}

export const eur = v => {
  if (v === '' || v == null || isNaN(Number(v))) return '';
  const n = Math.round(Number(v) * 100) / 100;
  const [i, d] = n.toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d !== '00' ? ',' + d : '') + ' €';
};
export const fechaLarga = iso => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day:'numeric', month:'long', year:'numeric' });
};
export const hoyISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); };

// Imprime un HTML en un iframe oculto (el usuario elige «Guardar como PDF» para descargar)
export function imprimirHTML(html, titulo) {
  const ifr = document.createElement('iframe');
  ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(ifr);
  const doc = ifr.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  if (titulo) doc.title = titulo;
  const go = async () => {
    try { await ifr.contentWindow.document.fonts.ready; } catch (e) {}
    setTimeout(() => {
      ifr.contentWindow.focus(); ifr.contentWindow.print();
      setTimeout(() => ifr.remove(), 2000);
    }, 300);
  };
  if (doc.readyState === 'complete') go(); else ifr.onload = go;
}

// ─── Datos por defecto desde la ficha ────────────────────────────────────────
export function datosPropietario(c) {
  if (!c) return { nombre:'', nif:'', domicilio:'', representante:'', representante_dni:'', firmante:'', firmante_dni:'' };
  const dom = (a, cp, loc, prov) => [a, [cp, loc].filter(Boolean).join(' '), prov].filter(Boolean).join(' · ');
  if (c.tipo_cliente === 'empresa' || c.tipoCliente === 'empresa') {
    const g = k => c[k] ?? c[k.replace(/_(\w)/g, (_, x) => x.toUpperCase())];
    const rep = g('representante_nombre') || '';
    return {
      nombre: g('empresa_razon_social') || c.name || '', nif: g('empresa_cif') || g('dni_cif') || '',
      domicilio: g('empresa_direccion') || dom(c.direccion, g('codigo_postal'), c.localidad, c.provincia),
      representante: rep, representante_dni: g('representante_dni') || '',
      firmante: rep || c.name || '', firmante_dni: g('representante_dni') || '',
    };
  }
  const nif = c.dni_cif ?? c.dniCif ?? '';
  return {
    nombre: c.name || '', nif,
    domicilio: dom(c.direccion, c.codigo_postal ?? c.codigoPostal, c.localidad, c.provincia),
    representante:'', representante_dni:'', firmante: c.name || '', firmante_dni: nif,
  };
}

export function datosInmueble(p) {
  const loc = p.localidad && p.municipio && p.localidad !== p.municipio ? `${p.localidad} (${p.municipio})` : (p.localidad || p.municipio || '');
  const dir = [p.direccion, [p.codigo_postal, loc].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const sup = [p.superficie_construida && `${p.superficie_construida} m² construidos`, p.superficie_parcela && `parcela ${p.superficie_parcela} m²`].filter(Boolean).join(' · ');
  const anejos = [p.garaje && 'Garaje', p.trastero && 'Trastero', p.jardin && 'Jardín'].filter(Boolean);
  return {
    direccion: dir, tipo: p.tipo_inmueble || '', ref_catastral: (p.referencia_catastral || '').trim(),
    superficie: sup, anejos: anejos.length ? anejos.join(', ').replace(/, ([^,]*)$/, ' y $1') : 'Ninguno',
    cargas: 'Ninguna',
  };
}

// ─── Pestaña «Mandato» de la ficha de inmueble ───────────────────────────────
export default function TabMandato({ property, user, contacts }) {
  const [hist, setHist] = useState([]);
  const [editor, setEditor] = useState(false);
  const [arras, setArras] = useState(false);
  const [recArras, setRecArras] = useState(0);
  const load = async () => {
    const { data } = await supabase.from('mandatos').select('id,referencia,fecha,datos,html,creado_por,created_at,contact_id,firmado_at')
      .eq('property_id', String(property.id)).order('created_at', { ascending:false });
    setHist(data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [property.id]);

  if (arras) return <EditorArras property={property} user={user} contacts={contacts} onClose={() => { setArras(false); setRecArras(x => x + 1); }} />;
  if (editor) return <EditorMandato property={property} user={user} contacts={contacts} onClose={() => { setEditor(false); load(); }} />;

  return (
    <div>
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:20 }}>
        <button className="btn-p" onClick={() => setEditor(true)}>+ Generar mandato de venta</button>
        <button className="btn-p" onClick={() => setArras(true)}>+ Generar contrato de arras</button>
        <button className="btn-g" onClick={() => imprimirHTML(DESISTIMIENTO_HTML, 'Formulario de desistimiento')}>Formulario de desistimiento</button>
      </div>
      <div className="card" style={{ padding:24 }}>
        <h3 style={{ marginBottom:14 }}>Mandatos de venta</h3>
        {hist.length === 0 && <p style={{ color:'#5B6178', fontSize:14 }}>Todavía no se ha generado ningún mandato para este inmueble.</p>}
        {hist.map(m => (
          <div key={m.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderTop:'1px solid #E4E2DA', flexWrap:'wrap' }}>
            <span className="mono" style={{ fontSize:12, color:'#00208F', fontWeight:500 }}>{m.referencia}</span>
            <span style={{ fontSize:14, color:'#0B1233', flex:1, minWidth:160 }}>
              {m.datos?.propiedad?.nombre || '—'} · {m.datos?.mandato?.precio || ''} · {m.datos?.mandato?.modalidad || ''}
            </span>
            <span className="mono" style={{ fontSize:11, color:'#5B6178' }}>{fechaLarga(m.fecha)}</span>
            <button className="btn-g" style={{ padding:'5px 12px', fontSize:12 }}
              onClick={() => imprimirHTML(m.html || renderTpl(MANDATO_HTML, m.datos), `Mandato ${m.referencia}`)}>Imprimir / PDF</button>
            <PanelFirma tipo="mandato" doc={m} contacts={contacts} user={user} />
          </div>
        ))}
      </div>
      <HistorialArras property={property} recarga={recArras} contacts={contacts} user={user} />
    </div>
  );
}


// Componentes de maquetación del formulario (fuera del editor para no perder el foco)
export const F = ({ label, children, span }) => (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}><label className="fl">{label}</label>{children}</div>
  );
export const Bloque = ({ t, children }) => (
    <div className="card" style={{ padding:20, marginBottom:14 }}>
      <div className="eyebrow" style={{ marginBottom:12 }}>{t}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>{children}</div>
    </div>
  );


function EditorMandato({ property, user, contacts, onClose }) {
  const owner0 = contacts.find(c => c.id === property.contact_id) || null;
  const [ownerId, setOwnerId] = useState(owner0?.id || '');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [d, setD] = useState(() => ({
    agente: { nombre: user.name || '', dni: user.dni || '', cargo: user.cargo || (user.role === 'socio' ? 'Socio' : user.role === 'admin' ? 'Administrador' : 'Agente comercial') },
    propiedad: datosPropietario(owner0),
    inmueble: datosInmueble(property),
    mandato: {
      lugar:'Oleiros', fecha: hoyISO(), precio: property.precio || '', duracion_meses: 6, modalidad:'Exclusiva',
      honorarios_pct: property.comision_pct || 3, honorarios_minimo: 3000, meses_proteccion: 12, dias_informe: 15,
      jurisdiccion:'A Coruña', inicio_inmediato:false,
    },
    autoriza: { fotos:true, portales:true, cartel:false, llaves:false },
  }));

  useEffect(() => { supabase.rpc('mandato_siguiente_referencia').then(({ data }) => data && setRef(data)); }, []);

  const set = (grp, k, v) => setD(x => ({ ...x, [grp]: { ...x[grp], [k]: v } }));
  const pickOwner = id => { setOwnerId(id); setD(x => ({ ...x, propiedad: datosPropietario(contacts.find(c => c.id === id)) })); };

  // Datos ya formateados para la plantilla
  const datosDoc = useMemo(() => ({
    ...d,
    agencia: { cif:'B75490136' },
    mandato: {
      ...d.mandato, referencia: ref || 'QNH-····-····', fecha: fechaLarga(d.mandato.fecha),
      precio: eur(d.mandato.precio), honorarios_minimo: eur(d.mandato.honorarios_minimo),
      honorarios_pct: String(d.mandato.honorarios_pct).replace('.', ','),
    },
  }), [d, ref]);
  const html = useMemo(() => renderTpl(MANDATO_HTML, datosDoc), [datosDoc]);

  const faltan = [
    !d.propiedad.nombre && 'nombre de la propiedad', !d.propiedad.nif && 'NIF/CIF de la propiedad',
     !d.mandato.precio && 'precio', !d.inmueble.direccion && 'dirección del inmueble',
  ].filter(Boolean);

  const guardar = async (imprimir) => {
    setSaving(true); setMsg('');
    let referencia = ref, err = null;
    for (let i = 0; i < 3; i++) {
      const datos = { ...datosDoc, mandato: { ...datosDoc.mandato, referencia } };
      const { error } = await supabase.from('mandatos').insert({
        property_id: String(property.id), contact_id: ownerId || null, referencia, fecha: d.mandato.fecha,
        datos, html: renderTpl(MANDATO_HTML, datos), creado_por: user.id,
      });
      if (!error) { err = null; if (imprimir) imprimirHTML(renderTpl(MANDATO_HTML, datos), `Mandato ${referencia}`); break; }
      err = error;
      const { data } = await supabase.rpc('mandato_siguiente_referencia'); referencia = data; setRef(data);
    }
    // Recordar DNI y cargo del agente para la próxima vez
    if (!err && (d.agente.dni !== (user.dni || '') || d.agente.cargo !== (user.cargo || ''))) {
      await supabase.from('users').update({ dni: d.agente.dni, cargo: d.agente.cargo }).eq('id', user.id);
      user.dni = d.agente.dni; user.cargo = d.agente.cargo;
    }
    // Vincular el propietario a la ficha si no lo estaba
    if (!err && ownerId && !property.contact_id) await supabase.from('properties').update({ contact_id: ownerId }).eq('id', property.id);
    setSaving(false);
    if (err) setMsg('No se pudo guardar: ' + err.message); else onClose();
  };

  const inp = (grp, k, type='text', extra={}) => (
    <input className="fi" type={type} value={d[grp][k] ?? ''} onChange={e => set(grp, k, type === 'number' ? e.target.value : e.target.value)} {...extra} />
  );
  const chk = (grp, k, label) => (
    <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:14, color:'#0B1233', cursor:'pointer' }}>
      <input type="checkbox" checked={!!d[grp][k]} onChange={e => set(grp, k, e.target.checked)} style={{ accentColor:'#00208F', width:16, height:16 }} />{label}
    </label>
  );
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <button className="btn-g" onClick={onClose}>← Mandatos</button>
        <h3 style={{ flex:1 }}>Mandato de venta <span className="mono" style={{ fontSize:13, color:'#00208F', marginLeft:8 }}>{ref}</span></h3>
        <button className="btn-g" onClick={() => imprimirHTML(html, `Mandato ${ref} (borrador)`)}>Vista de impresión</button>
        <button className="btn-p" disabled={saving} onClick={() => guardar(true)}>{saving ? 'Guardando…' : 'Guardar e imprimir / PDF'}</button>
      </div>
      {faltan.length > 0 && (
        <div style={{ background:'#FFF4D6', borderRadius:'14px 14px 14px 0', padding:'10px 14px', marginBottom:14, fontSize:13, color:'#0B1233' }}>
          Faltan datos: {faltan.join(', ')}. Saldrán como «—» en el documento.
        </div>
      )}
      {msg && <p style={{ color:'#dc2626', marginBottom:12 }}>{msg}</p>}

      <div className="mandato-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:20, alignItems:'start' }}>
        <div>
          <Bloque t="La propiedad (quien nos encarga la venta)">
            <F label="Contacto propietario" span>
              <select className="fi" value={ownerId} onChange={e => pickOwner(e.target.value)}>
                <option value="">— Elegir contacto —</option>
                {[...contacts].sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => <option key={c.id} value={c.id}>{c.name}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
              </select>
            </F>
            <F label="Nombre / razón social" span>{inp('propiedad','nombre')}</F>
            <F label="NIF / CIF">{inp('propiedad','nif')}</F>
            <F label="Domicilio">{inp('propiedad','domicilio')}</F>
            <F label="Representante (si es empresa)">{inp('propiedad','representante')}</F>
            <F label="DNI representante">{inp('propiedad','representante_dni')}</F>
            <F label="Firmante">{inp('propiedad','firmante')}</F>
            <F label="DNI firmante">{inp('propiedad','firmante_dni')}</F>
          </Bloque>

          {/* Agencia: firma mancomunada de los socios, fija en la plantilla */}

          <Bloque t="El inmueble">
            <F label="Dirección" span>{inp('inmueble','direccion')}</F>
            <F label="Tipo">{inp('inmueble','tipo')}</F>
            <F label="Referencia catastral">{inp('inmueble','ref_catastral')}</F>
            <F label="Superficie">{inp('inmueble','superficie')}</F>
            <F label="Anejos">{inp('inmueble','anejos')}</F>
            <F label="Cargas conocidas" span>{inp('inmueble','cargas')}</F>
          </Bloque>

          <Bloque t="Condiciones del mandato">
            <F label="Lugar">{inp('mandato','lugar')}</F>
            <F label="Fecha">{inp('mandato','fecha','date')}</F>
            <F label="Precio de venta (€)">{inp('mandato','precio','number')}</F>
            <F label="Modalidad">
              <select className="fi" value={d.mandato.modalidad} onChange={e => set('mandato','modalidad',e.target.value)}>
                <option>Exclusiva</option><option>No exclusiva</option>
              </select>
            </F>
            <F label="Duración (meses)">{inp('mandato','duracion_meses','number',{min:1})}</F>
            <F label="Honorarios (% + IVA)">{inp('mandato','honorarios_pct','number',{step:'0.1'})}</F>
            <F label="Honorarios mínimos (€ + IVA)">{inp('mandato','honorarios_minimo','number')}</F>
            <F label="Meses de protección">{inp('mandato','meses_proteccion','number')}</F>
            <F label="Informar cada (días)">{inp('mandato','dias_informe','number')}</F>
            <F label="Jurisdicción">{inp('mandato','jurisdiccion')}</F>
            <div style={{ gridColumn:'1 / -1' }}>{chk('mandato','inicio_inmediato','Empezar a promocionar desde hoy (antes de los 14 días)')}</div>
          </Bloque>

          <Bloque t="Autorizaciones">
            {chk('autoriza','fotos','Fotografías, vídeo y plano')}
            {chk('autoriza','portales','Portales y redes sociales')}
            {chk('autoriza','cartel','Cartel en el inmueble')}
            {chk('autoriza','llaves','Custodiar copia de llaves')}
          </Bloque>
        </div>

        <VistaPrevia html={html} />
      </div>
    </div>
  );
}

// Vista previa A4 escalada al ancho disponible
export function VistaPrevia({ html }) {
  const box = useRef(null), ifr = useRef(null);
  const [scale, setScale] = useState(0.6);
  const [h, setH] = useState(1123);
  useEffect(() => {
    const ro = new ResizeObserver(() => { if (box.current) setScale(Math.min(1, box.current.clientWidth / 860)); });
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const onLoad = () => { try { const b = ifr.current.contentWindow.document.documentElement; setH(b.scrollHeight); } catch (e) {} };
  return (
    <div ref={box} style={{ position:'sticky', top:90, background:'#D9D8D2', borderRadius:'20px 20px 20px 0', maxHeight:'calc(100vh - 120px)', overflowY:'auto', overflowX:'hidden' }}>
      <div style={{ width:860*scale, height:h*scale, overflow:'hidden' }}>
        <iframe ref={ifr} title="Vista previa del mandato" srcDoc={html} onLoad={onLoad} scrolling="no"
          style={{ width:860, height:h, border:0, transform:`scale(${scale})`, transformOrigin:'top left', display:'block' }} />
      </div>
    </div>
  );
}
