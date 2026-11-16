import { useState, useEffect, useMemo } from 'react';
import { supabase } from './utils/supabase';
import { ARRAS_HTML } from './mandatoPlantillas';
import { PanelFirma } from './Firma';
import { renderTpl, imprimirHTML, eur, fechaLarga, hoyISO, datosPropietario, datosInmueble, F, Bloque, VistaPrevia } from './Mandato';

const masDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };

// ─── Historial de contratos de arras del inmueble ────────────────────────────
export function HistorialArras({ property, recarga, contacts, user }) {
  const [hist, setHist] = useState([]);
  useEffect(() => {
    supabase.from('contratos_arras').select('id,referencia,fecha,datos,html,precio,importe_arras,vendedor_contact_id,comprador_contact_id,firmado_at')
      .eq('property_id', String(property.id)).order('created_at', { ascending:false })
      .then(({ data }) => setHist(data || []));
  }, [property.id, recarga]);
  return (
    <div className="card" style={{ padding:24, marginTop:16 }}>
      <h3 style={{ marginBottom:14 }}>Contratos de arras</h3>
      {hist.length === 0 && <p style={{ color:'#5B6178', fontSize:14 }}>Todavía no se ha generado ningún contrato de arras.</p>}
      {hist.map(m => (
        <div key={m.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderTop:'1px solid #E4E2DA', flexWrap:'wrap' }}>
          <span className="mono" style={{ fontSize:12, color:'#00208F', fontWeight:500 }}>{m.referencia}</span>
          <span style={{ fontSize:14, color:'#0B1233', flex:1, minWidth:160 }}>
            {m.datos?.comprador?.nombre || '—'} · {m.datos?.arras?.precio} · arras {m.datos?.arras?.importe}
          </span>
          <span className="mono" style={{ fontSize:11, color:'#5B6178' }}>{fechaLarga(m.fecha)}</span>
          <button className="btn-g" style={{ padding:'5px 12px', fontSize:12 }}
            onClick={() => imprimirHTML(m.html || renderTpl(ARRAS_HTML, m.datos), `Arras ${m.referencia}`)}>Imprimir / PDF</button>
          <PanelFirma tipo="arras" doc={m} contacts={contacts} user={user} />
        </div>
      ))}
    </div>
  );
}

// ─── Editor del contrato de arras ────────────────────────────────────────────
export function EditorArras({ property, user, contacts, onClose }) {
  const vend0 = contacts.find(c => c.id === property.contact_id) || null;
  const [vendId, setVendId] = useState(vend0?.id || '');
  const [compId, setCompId] = useState('');
  const [ref, setRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [marcarEstado, setMarcarEstado] = useState(true);
  const precio0 = property.precio_venta_acordado || property.precio || '';
  const [d, setD] = useState(() => ({
    agente: { nombre: user.name || '', dni: user.dni || '', cargo: user.cargo || (user.role === 'socio' ? 'Socio' : 'Agente comercial') },
    vendedor: datosPropietario(vend0),
    comprador: datosPropietario(null),
    inmueble: { ...datosInmueble(property), registro: '' },
    arras: {
      lugar:'Oleiros', fecha: hoyISO(), precio: precio0, importe: precio0 ? Math.round(Number(precio0) * 0.1) : '',
      medio_pago:'transferencia bancaria', deposito_agencia:false, penitenciales:true,
      fecha_limite: masDias(hoyISO(), 90), notario:'',
      condicion_hipoteca:false, importe_hipoteca:'', fecha_hipoteca: masDias(hoyISO(), 45),
      mobiliario:'vacío de muebles y enseres', ibi:'proporcionalmente entre las partes según los días de titularidad de cada una',
      honorarios_comprador:false, observaciones:'',
    },
  }));

  useEffect(() => { supabase.rpc('arras_siguiente_referencia').then(({ data }) => data && setRef(data)); }, []);
  const set = (grp, k, v) => setD(x => ({ ...x, [grp]: { ...x[grp], [k]: v } }));
  const pick = (grp, setter) => id => { setter(id); setD(x => ({ ...x, [grp]: datosPropietario(contacts.find(c => c.id === id)) })); };

  const datosDoc = useMemo(() => {
    const a = d.arras; const resto = (Number(a.precio) || 0) - (Number(a.importe) || 0);
    // numeración de cláusulas: la 05 (financiación) es opcional
    let n = a.condicion_hipoteca ? 6 : 5; const num = () => String(n++).padStart(2, '0');
    const nums = { cargas:num(), estado:num(), gastos:num(), agencia:num(), datos:num(), ley:num(), obs:num() };
    return {
      ...d, n: nums,
      arras: {
        ...a, referencia: ref || 'ARR-····-····', fecha: fechaLarga(a.fecha),
        precio: eur(a.precio), importe: eur(a.importe), resto: a.precio ? eur(resto) : '',
        fecha_limite: fechaLarga(a.fecha_limite), fecha_hipoteca: fechaLarga(a.fecha_hipoteca), importe_hipoteca: eur(a.importe_hipoteca),
        tipo: a.penitenciales ? 'penitenciales (art. 1454 del Código Civil)' : 'confirmatorias',
        tipo_titulo: a.penitenciales ? 'penitenciales' : 'confirmatorias',
      },
    };
  }, [d, ref]);
  const html = useMemo(() => renderTpl(ARRAS_HTML, datosDoc), [datosDoc]);

  const faltan = [
    !d.vendedor.nombre && 'vendedor', !d.vendedor.nif && 'NIF vendedor', !d.comprador.nombre && 'comprador', !d.comprador.nif && 'NIF comprador',
    !d.arras.precio && 'precio', !d.arras.importe && 'importe de arras', 
    d.arras.condicion_hipoteca && !d.arras.importe_hipoteca && 'importe de la hipoteca',
  ].filter(Boolean);

  const guardar = async () => {
    setSaving(true); setMsg('');
    let referencia = ref, err = null;
    for (let i = 0; i < 3; i++) {
      const datos = { ...datosDoc, arras: { ...datosDoc.arras, referencia } };
      const docHtml = renderTpl(ARRAS_HTML, datos);
      const { error } = await supabase.from('contratos_arras').insert({
        property_id: String(property.id), vendedor_contact_id: vendId || null, comprador_contact_id: compId || null,
        referencia, fecha: d.arras.fecha, precio: Number(d.arras.precio) || null, importe_arras: Number(d.arras.importe) || null,
        fecha_limite_escritura: d.arras.fecha_limite || null, datos, html: docHtml, creado_por: user.id,
      });
      if (!error) { err = null; imprimirHTML(docHtml, `Arras ${referencia}`); break; }
      err = error;
      const { data } = await supabase.rpc('arras_siguiente_referencia'); referencia = data; setRef(data);
    }
    if (!err) {
      if (d.agente.dni !== (user.dni || '') || d.agente.cargo !== (user.cargo || '')) {
        await supabase.from('users').update({ dni: d.agente.dni, cargo: d.agente.cargo }).eq('id', user.id);
        user.dni = d.agente.dni; user.cargo = d.agente.cargo;
      }
      const upd = {};
      if (marcarEstado) { upd.estado_venta = 'Contrato arras'; upd.precio_venta_acordado = Number(d.arras.precio) || null; }
      if (vendId && !property.contact_id) upd.contact_id = vendId;
      if (Object.keys(upd).length) await supabase.from('properties').update(upd).eq('id', property.id);
      if (compId) await supabase.from('interactions').insert({ id: crypto.randomUUID(), contact_id: compId, tipo:'nota', fecha: hoyISO(),
        descripcion: `Contrato de arras ${referencia} · ${property.referencia || ''} ${property.titulo || ''} · arras ${eur(d.arras.importe)}` });
    }
    setSaving(false);
    if (err) setMsg('No se pudo guardar: ' + err.message); else onClose(true);
  };

  const inp = (grp, k, type='text', extra={}) => (
    <input className="fi" type={type} value={d[grp][k] ?? ''} onChange={e => set(grp, k, e.target.value)} {...extra} />
  );
  const chk = (grp, k, label) => (
    <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:14, color:'#0B1233', cursor:'pointer', gridColumn:'1 / -1' }}>
      <input type="checkbox" checked={!!d[grp][k]} onChange={e => set(grp, k, e.target.checked)} style={{ accentColor:'#00208F', width:16, height:16 }} />{label}
    </label>
  );
  const ordenados = [...contacts].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  const parte = (grp, id, setter, titulo) => (
    <Bloque t={titulo}>
      <F label="Contacto" span>
        <select className="fi" value={id} onChange={e => pick(grp, setter)(e.target.value)}>
          <option value="">— Elegir contacto —</option>
          {ordenados.map(c => <option key={c.id} value={c.id}>{c.name}{c.empresa ? ` · ${c.empresa}` : ''}</option>)}
        </select>
      </F>
      <F label="Nombre / razón social" span>{inp(grp,'nombre')}</F>
      <F label="NIF / CIF">{inp(grp,'nif')}</F>
      <F label="Domicilio">{inp(grp,'domicilio')}</F>
      <F label="Representante (si es empresa)">{inp(grp,'representante')}</F>
      <F label="DNI representante">{inp(grp,'representante_dni')}</F>
      <F label="Firmante">{inp(grp,'firmante')}</F>
      <F label="DNI firmante">{inp(grp,'firmante_dni')}</F>
    </Bloque>
  );

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18, flexWrap:'wrap' }}>
        <button className="btn-g" onClick={() => onClose(false)}>← Contratos</button>
        <h3 style={{ flex:1 }}>Contrato de arras <span className="mono" style={{ fontSize:13, color:'#00208F', marginLeft:8 }}>{ref}</span></h3>
        <button className="btn-g" onClick={() => imprimirHTML(html, `Arras ${ref} (borrador)`)}>Vista de impresión</button>
        <button className="btn-p" disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : 'Guardar e imprimir / PDF'}</button>
      </div>
      {faltan.length > 0 && (
        <div style={{ background:'#FFF4D6', borderRadius:'14px 14px 14px 0', padding:'10px 14px', marginBottom:14, fontSize:13, color:'#0B1233' }}>
          Faltan datos: {faltan.join(', ')}. Saldrán como «—» en el documento.
        </div>
      )}
      {msg && <p style={{ color:'#dc2626', marginBottom:12 }}>{msg}</p>}

      <div className="mandato-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:20, alignItems:'start' }}>
        <div>
          {parte('vendedor', vendId, setVendId, 'Parte vendedora')}
          {parte('comprador', compId, setCompId, 'Parte compradora')}

          {/* Agencia: firma mancomunada de los socios, fija en la plantilla */}

          <Bloque t="El inmueble">
            <F label="Dirección" span>{inp('inmueble','direccion')}</F>
            <F label="Tipo">{inp('inmueble','tipo')}</F>
            <F label="Referencia catastral">{inp('inmueble','ref_catastral')}</F>
            <F label="Superficie">{inp('inmueble','superficie')}</F>
            <F label="Anejos">{inp('inmueble','anejos')}</F>
            <F label="Datos registrales (Registro, tomo, libro, folio, finca)" span>{inp('inmueble','registro', 'text', { placeholder:'Según nota simple' })}</F>
            <F label="Cargas" span>{inp('inmueble','cargas')}</F>
          </Bloque>

          <Bloque t="Condiciones económicas">
            <F label="Lugar">{inp('arras','lugar')}</F>
            <F label="Fecha">{inp('arras','fecha','date')}</F>
            <F label="Precio de venta (€)">{inp('arras','precio','number')}</F>
            <F label="Arras entregadas (€)">{inp('arras','importe','number')}</F>
            <F label="Medio de pago" span>
              <select className="fi" value={d.arras.medio_pago} onChange={e => set('arras','medio_pago',e.target.value)}>
                <option>transferencia bancaria</option><option>cheque bancario</option><option>cheque nominativo</option>
              </select>
            </F>
            <F label="Tipo de arras" span>
              <select className="fi" value={d.arras.penitenciales ? 'p' : 'c'} onChange={e => set('arras','penitenciales', e.target.value === 'p')}>
                <option value="p">Penitenciales (art. 1454 CC) — lo habitual</option>
                <option value="c">Confirmatorias</option>
              </select>
            </F>
            {chk('arras','deposito_agencia','Las arras quedan depositadas en Qué necesitas hoy hasta la escritura')}
          </Bloque>

          <Bloque t="Escritura y condiciones">
            <F label="Escritura antes del">{inp('arras','fecha_limite','date')}</F>
            <F label="Notario (opcional)">{inp('arras','notario')}</F>
            {chk('arras','condicion_hipoteca','Sujeto a que el comprador obtenga hipoteca')}
            {d.arras.condicion_hipoteca && <>
              <F label="Importe del préstamo (€)">{inp('arras','importe_hipoteca','number')}</F>
              <F label="Plazo para obtenerlo">{inp('arras','fecha_hipoteca','date')}</F>
            </>}
            <F label="Se entrega" span>
              <select className="fi" value={d.arras.mobiliario} onChange={e => set('arras','mobiliario',e.target.value)}>
                <option>vacío de muebles y enseres</option>
                <option>con el mobiliario y los electrodomésticos existentes en la visita</option>
                <option>con el mobiliario que las partes detallen en anexo</option>
              </select>
            </F>
            <F label="IBI del año" span>
              <select className="fi" value={d.arras.ibi} onChange={e => set('arras','ibi',e.target.value)}>
                <option>proporcionalmente entre las partes según los días de titularidad de cada una</option>
                <option>a cargo íntegro de la Vendedora</option>
              </select>
            </F>
            {chk('arras','honorarios_comprador','Hay también encargo/honorarios con el comprador')}
            <F label="Otros pactos (opcional)" span>
              <textarea className="fi" rows={3} value={d.arras.observaciones} onChange={e => set('arras','observaciones', e.target.value)} />
            </F>
          </Bloque>

          <div className="card" style={{ padding:16, marginBottom:14 }}>
            <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:14, color:'#0B1233', cursor:'pointer' }}>
              <input type="checkbox" checked={marcarEstado} onChange={e => setMarcarEstado(e.target.checked)} style={{ accentColor:'#00208F', width:16, height:16 }} />
              Al guardar, pasar el inmueble a «Contrato arras» y fijar el precio de venta acordado
            </label>
          </div>
        </div>

        <VistaPrevia html={html} />
      </div>
    </div>
  );
}
