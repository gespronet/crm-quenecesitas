import { useState, useEffect, useRef } from 'react';
import { supabase } from './utils/supabase';
import { imprimirHTML, VistaPrevia } from './Mandato';

// Llamada a la Edge Function «firma»
export async function firmaApi(body) {
  const { data, error } = await supabase.functions.invoke('firma', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const ESTADOS = {
  pendiente:        { l:'En espera (firma tras el cliente)', bg:'#F6F5F1', c:'#8A8FA3' },
  enviado:          { l:'Enviado',          bg:'#F0EFEA', c:'#5B6178' },
  email_verificado: { l:'Email verificado', bg:'#DCE3FF', c:'#00208F' },
  dni_subido:       { l:'DNI aportado',     bg:'#DCE3FF', c:'#00208F' },
  firmado:          { l:'Firmado ✓',        bg:'#00208F', c:'#FFFFFF' },
  caducado:         { l:'Caducado',         bg:'#fee2e2', c:'#dc2626' },
};
const fh = d => d ? new Date(d).toLocaleString('es-ES', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';

// ─── Panel de firma dentro del CRM (por documento) ───────────────────────────
// tipo: 'mandato' | 'arras' · doc: fila de mandatos / contratos_arras · contacts: contactos del CRM
export function PanelFirma({ tipo, doc, contacts, user }) {
  const [st, setSt] = useState(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState('');
  const load = async () => { try { setSt(await firmaApi({ action:'estado_doc', doc_tipo:tipo, doc_id:doc.id })); } catch (e) { setSt({ solicitudes:[], error:e.message }); } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [doc.id]);

  const sols = st?.solicitudes || [];
  const accion = async (action, token, ok) => {
    setBusy(token + action);
    try { await firmaApi({ action, token }); if (ok) alert(ok); await load(); } catch (e) { alert(e.message); }
    setBusy('');
  };
  const verDni = async (token) => {
    try { const u = await firmaApi({ action:'dni_urls', token }); Object.values(u).forEach(x => x && window.open(x, '_blank')); } catch (e) { alert(e.message); }
  };

  if (!st) return <span className="mono" style={{ fontSize:10, color:'#8A8FA3' }}>…</span>;
  return (
    <div style={{ width:'100%', marginTop:6 }}>
      {st.firmado_at ? (
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span className="tag" style={{ background:'#00208F', color:'white' }}>✓ Firmado por todas las partes · {fh(st.firmado_at)}</span>
          <button className="btn-p" style={{ padding:'5px 12px', fontSize:12 }} onClick={() => imprimirHTML(st.html_firmado, `${doc.referencia} firmado`)}>Descargar firmado</button>
        </div>
      ) : sols.length === 0 ? (
        <button className="btn-a" style={{ padding:'6px 14px', fontSize:12 }} onClick={() => setModal(true)}>✍️ Enviar a firmar</button>
      ) : null}
      {sols.length > 0 && (
        <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
          {sols.map(s => {
            const cad = s.estado !== 'firmado' && new Date(s.expira_at) < new Date();
            const e = ESTADOS[cad ? 'caducado' : s.estado] || ESTADOS.enviado;
            return (
              <div key={s.token} style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', fontSize:12, background:'#F6F5F1', borderRadius:'12px 12px 12px 0', padding:'7px 10px' }}>
                <span className="mono" style={{ fontSize:10, color:'#5B6178', textTransform:'uppercase', minWidth:70 }}>{s.rol.startsWith('socio_') ? 'Socio' : s.rol}</span>
                <span style={{ color:'#0B1233', fontWeight:500 }}>{s.firmante_nombre}</span>
                <span style={{ color:'#5B6178' }}>{s.firmante_email}</span>
                <span className="tag" style={{ background:e.bg, color:e.c, fontSize:10 }}>{e.l}{s.estado === 'firmado' ? ' · ' + fh(s.firmado_at) : ''}</span>
                <span style={{ flex:1 }} />
                {s.dni_numero && <button className="btn-g" style={{ padding:'3px 9px', fontSize:11 }} onClick={() => verDni(s.token)}>Ver DNI</button>}
                {s.estado !== 'firmado' && s.estado !== 'pendiente' && <>
                  <button className="btn-g" style={{ padding:'3px 9px', fontSize:11 }} onClick={() => { navigator.clipboard?.writeText(`https://crm.quenecesitashoy.com/?firmar=${s.token}`); alert('Enlace copiado'); }}>Copiar enlace</button>
                  <button className="btn-g" style={{ padding:'3px 9px', fontSize:11 }} disabled={!!busy} onClick={() => accion('reenviar', s.token, 'Recordatorio enviado')}>{busy === s.token + 'reenviar' ? '…' : 'Reenviar'}</button>
                  <button className="btn-g" style={{ padding:'3px 9px', fontSize:11, color:'#dc2626' }} disabled={!!busy} onClick={() => window.confirm('¿Anular esta solicitud de firma?') && accion('anular', s.token)}>Anular</button>
                </>}
              </div>
            );
          })}
          {!st.firmado_at && <button className="btn-g" style={{ alignSelf:'flex-start', padding:'4px 10px', fontSize:11 }} onClick={() => setModal(true)}>Volver a enviar a firmar…</button>}
        </div>
      )}
      {modal && <ModalEnviar tipo={tipo} doc={doc} contacts={contacts} user={user} onClose={() => setModal(false)} onSent={() => { setModal(false); load(); }} />}
    </div>
  );
}

function ModalEnviar({ tipo, doc, contacts, user, onClose, onSent }) {
  const d = doc.datos || {};
  const emailDe = id => contacts.find(c => c.id === id)?.email || '';
  const inicial = tipo === 'mandato'
    ? [{ rol:'propiedad', nombre: d.propiedad?.firmante || d.propiedad?.nombre || '', dni: d.propiedad?.firmante_dni || d.propiedad?.nif || '', email: emailDe(doc.contact_id) }]
    : [{ rol:'vendedor', nombre: d.vendedor?.firmante || d.vendedor?.nombre || '', dni: d.vendedor?.firmante_dni || '', email: emailDe(doc.vendedor_contact_id) },
       { rol:'comprador', nombre: d.comprador?.firmante || d.comprador?.nombre || '', dni: d.comprador?.firmante_dni || '', email: emailDe(doc.comprador_contact_id) }];
  const [f, setF] = useState(inicial);
  const [sending, setSending] = useState(false);
  const set = (i, k, v) => setF(x => x.map((y, j) => j === i ? { ...y, [k]: v } : y));
  const enviar = async () => {
    if (f.some(x => !x.email)) { alert('Falta el email de algún firmante'); return; }
    setSending(true);
    try { await firmaApi({ action:'crear', doc_tipo:tipo, doc_id:doc.id, firmantes:f, creado_por:user.id }); onSent(); }
    catch (e) { alert(e.message); setSending(false); }
  };
  return (
    <div className="mb" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mo">
        <div className="eyebrow">Firma electrónica · {doc.referencia}</div>
        <h2 style={{ fontFamily:"'Poppins',sans-serif", fontSize:22, letterSpacing:'-.03em', color:'#0B1233', marginBottom:6 }}>Enviar a firmar</h2>
        <p style={{ fontSize:13, color:'#5B6178', marginBottom:16 }}>Cada firmante recibe un enlace por email. Para firmar tendrá que verificar su email con un código y aportar su DNI. Cuando firmen, recibiréis el enlace los dos socios (Antonio Rey Pereiro y Antonio Manuel Novo Platas) para la firma mancomunada; sin la firma de ambos el documento no queda completo.</p>
        {f.map((x, i) => (
          <div key={x.rol} className="card" style={{ padding:16, marginBottom:12 }}>
            <div className="mono" style={{ fontSize:10, color:'#00208F', letterSpacing:'.08em', textTransform:'uppercase', marginBottom:10 }}>{x.rol}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ gridColumn:'1 / -1' }}><label className="fl">Nombre del firmante</label><input className="fi" value={x.nombre} onChange={e => set(i,'nombre',e.target.value)} /></div>
              <div><label className="fl">Email</label><input className="fi" type="email" value={x.email} onChange={e => set(i,'email',e.target.value)} /></div>
              <div><label className="fl">DNI/NIE esperado</label><input className="fi" value={x.dni} onChange={e => set(i,'dni',e.target.value)} placeholder="Se comprueba al firmar" /></div>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn-g" onClick={onClose}>Cancelar</button>
          <button className="btn-p" disabled={sending} onClick={enviar}>{sending ? 'Enviando…' : 'Enviar por email'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Página pública de firma (?firmar=TOKEN) ─────────────────────────────────
const comprimir = (file) => new Promise((res, rej) => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    res(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => rej(new Error('No se pudo leer la imagen'));
  img.src = url;
});

function PadFirma({ onChange }) {
  const ref = useRef(null); const dib = useRef(false); const trazos = useRef(0);
  useEffect(() => {
    const c = ref.current; const r = window.devicePixelRatio || 1;
    c.width = c.clientWidth * r; c.height = c.clientHeight * r;
    const x = c.getContext('2d'); x.scale(r, r); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#0B1233';
  }, []);
  const pos = e => { const b = ref.current.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const down = e => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); dib.current = true; const x = ref.current.getContext('2d'); x.beginPath(); x.moveTo(...pos(e)); };
  const move = e => { if (!dib.current) return; const x = ref.current.getContext('2d'); x.lineTo(...pos(e)); x.stroke(); trazos.current++; };
  const up = () => { if (!dib.current) return; dib.current = false; onChange(trazos.current > 15 ? ref.current.toDataURL('image/png') : null); };
  const borrar = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); trazos.current = 0; onChange(null); };
  return (
    <div>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width:'100%', height:200, background:'white', border:'1.5px dashed #C9CBD3', borderRadius:'20px 20px 20px 0', touchAction:'none', cursor:'crosshair', display:'block' }} />
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
        <span className="mono" style={{ fontSize:10, color:'#8A8FA3', letterSpacing:'.08em' }}>FIRMA AQUÍ CON EL DEDO O EL RATÓN</span>
        <button className="btn-g" style={{ padding:'3px 10px', fontSize:12 }} onClick={borrar}>Borrar</button>
      </div>
    </div>
  );
}

export function FirmaPublica({ token, css }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [paso, setPaso] = useState(0); // 0 revisar · 1 email · 2 dni · 3 firmar · 4 hecho
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [codigo, setCodigo] = useState(''); const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [dni, setDni] = useState({ numero:'', anverso:null, reverso:null });
  const [firma, setFirma] = useState(null); const [acepto, setAcepto] = useState(false);

  const cargar = async () => {
    try {
      const r = await firmaApi({ action:'publico', token }); setInfo(r);
      setPaso(r.estado === 'firmado' ? 4 : r.estado === 'dni_subido' ? 3 : r.estado === 'email_verificado' ? 2 : 0);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [token]);

  const run = async (fn) => { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg(e.message); } setBusy(false); };
  const pedirCodigo = () => run(async () => { await firmaApi({ action:'enviar_codigo', token }); setCodigoEnviado(true); setPaso(1); });
  const verificar = () => run(async () => { const r = await firmaApi({ action:'verificar', token, codigo }); setPaso(r?.dni_ok ? 3 : 2); });
  const subirDni = () => run(async () => {
    if (!dni.anverso || !dni.reverso) throw new Error('Sube las dos caras del DNI.');
    await firmaApi({ action:'dni', token, numero:dni.numero, anverso:dni.anverso, reverso:dni.reverso }); setPaso(3);
  });
  const firmar = () => run(async () => { await firmaApi({ action:'firmar', token, firma, acepto }); await cargar(); setPaso(4); });
  const foto = async (k, file) => { if (!file) return; try { const u = await comprimir(file); setDni(d => ({ ...d, [k]: u })); } catch (e) { setMsg(e.message); } };

  const PASOS = ['Revisar', 'Verificar email', 'DNI', 'Firmar'];
  const wrap = (children) => (
    <div style={{ minHeight:'100vh', background:'#F6F5F1', fontFamily:"'DM Sans',sans-serif", color:'#0B1233' }}>
      <style>{css}</style>
      <div style={{ background:'#00208F', color:'white', padding:'16px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:17, letterSpacing:'-.03em' }}>Qué necesitas hoy</div>
        <span className="mono" style={{ fontSize:10, color:'#8FA2F0', letterSpacing:'.08em' }}>FIRMA ELECTRÓNICA</span>
      </div>
      <div style={{ maxWidth:860, margin:'0 auto', padding:'24px 16px 60px' }}>{children}</div>
    </div>
  );

  if (error) return wrap(<div className="card" style={{ padding:28 }}><h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:24 }}>No podemos abrir este enlace</h1><p style={{ marginTop:8, color:'#5B6178' }}>{error}</p><p style={{ marginTop:8, color:'#5B6178' }}>Escríbenos a <a href="mailto:info@quenecesitashoy.es">info@quenecesitashoy.es</a>.</p></div>);
  if (!info) return wrap(<p style={{ color:'#5B6178' }}>Cargando documento…</p>);
  if (info.estado === 'caducado') return wrap(<div className="card" style={{ padding:28 }}><h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:24 }}>El enlace ha caducado</h1><p style={{ marginTop:8, color:'#5B6178' }}>Pide a Qué necesitas hoy que te lo reenvíe.</p></div>);

  return wrap(<>
    <div className="eyebrow">{info.tipo} · {info.referencia}</div>
    <h1 style={{ fontFamily:"'Poppins',sans-serif", fontWeight:700, fontSize:28, letterSpacing:'-.03em', lineHeight:1.15, marginBottom:6 }}>
      {paso === 4 ? (info.completo ? 'Documento firmado' : '¡Gracias! Has firmado') : `Hola, ${(info.nombre || '').split(' ')[0]}`}
    </h1>
    {paso < 4 && <>
      <p style={{ color:'#5B6178', marginBottom:18 }}>Revisa el documento y fírmalo en tres pasos. Tardarás un par de minutos.</p>
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {PASOS.map((p, i) => (
          <span key={p} className="tag" style={{ background: i < paso ? '#00208F' : i === paso ? '#FFB81C' : 'white', color: i < paso ? 'white' : '#0B1233', border: i > paso ? '1px solid #E4E2DA' : 'none', padding:'5px 12px' }}>
            {i < paso ? '✓ ' : `${i + 1}. `}{p}
          </span>
        ))}
      </div>
    </>}
    {msg && <div style={{ background:'#fee2e2', color:'#991b1b', borderRadius:'14px 14px 14px 0', padding:'10px 14px', marginBottom:14, fontSize:14 }}>{msg}</div>}

    {paso === 0 && <>
      <VistaPrevia html={info.html} />
      <div className="card" style={{ padding:20, marginTop:16, position:'sticky', bottom:12, zIndex:5 }}>
        <p style={{ fontSize:14, marginBottom:12 }}>Cuando lo hayas leído, te enviaremos un código a <b>{info.email}</b>.</p>
        <button className="btn-p" disabled={busy} onClick={pedirCodigo} style={{ width:'100%', height:50, fontSize:15 }}>{busy ? 'Enviando…' : 'He leído el documento · Continuar'}</button>
      </div>
    </>}

    {paso === 1 && (
      <div className="card" style={{ padding:24 }}>
        <h3 style={{ marginBottom:8 }}>Verifica tu email</h3>
        <p style={{ fontSize:14, color:'#5B6178', marginBottom:14 }}>{codigoEnviado ? `Hemos enviado un código de 6 cifras a ${info.email}. Revisa también la carpeta de spam.` : `Te enviaremos un código a ${info.email}.`}</p>
        <input className="fi" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, ''))}
          placeholder="000000" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:28, letterSpacing:'.3em', textAlign:'center', height:60 }} />
        <button className="btn-p" disabled={busy || codigo.length !== 6} onClick={verificar} style={{ width:'100%', height:50, fontSize:15, marginTop:14 }}>{busy ? 'Comprobando…' : 'Verificar'}</button>
        <button className="btn-g" disabled={busy} onClick={pedirCodigo} style={{ width:'100%', marginTop:8 }}>Enviar otro código</button>
      </div>
    )}

    {paso === 2 && (
      <div className="card" style={{ padding:24 }}>
        <h3 style={{ marginBottom:8 }}>Tu documento de identidad</h3>
        <p style={{ fontSize:14, color:'#5B6178', marginBottom:14 }}>Haz una foto de las dos caras de tu DNI o NIE. Solo la verá Qué necesitas hoy para acreditar tu identidad.</p>
        <label className="fl">Número de DNI / NIE</label>
        <input className="fi" value={dni.numero} onChange={e => setDni(d => ({ ...d, numero:e.target.value.toUpperCase() }))} placeholder="12345678Z" style={{ marginBottom:14 }} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[['anverso','Cara delantera'],['reverso','Cara trasera']].map(([k, l]) => (
            <label key={k} style={{ cursor:'pointer' }}>
              <div style={{ aspectRatio:'1.58', borderRadius:'14px 14px 14px 0', border: dni[k] ? 'none' : '1.5px dashed #C9CBD3', background: dni[k] ? `center/cover url(${dni[k]})` : 'white', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center', fontSize:13, color:'#5B6178' }}>
                {!dni[k] && <span>📷<br />{l}</span>}
              </div>
              <input type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => foto(k, e.target.files[0])} />
              {dni[k] && <span className="mono" style={{ fontSize:10, color:'#00208F' }}>✓ {l.toUpperCase()} · CAMBIAR</span>}
            </label>
          ))}
        </div>
        <button className="btn-p" disabled={busy || !dni.numero || !dni.anverso || !dni.reverso} onClick={subirDni} style={{ width:'100%', height:50, fontSize:15, marginTop:18 }}>{busy ? 'Subiendo…' : 'Continuar'}</button>
      </div>
    )}

    {paso === 3 && (
      <div className="card" style={{ padding:24 }}>
        <h3 style={{ marginBottom:8 }}>Firma el documento</h3>
        <PadFirma onChange={setFirma} />
        <label style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:14, marginTop:16, cursor:'pointer' }}>
          <input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)} style={{ accentColor:'#00208F', width:18, height:18, marginTop:2, flexShrink:0 }} />
          <span>He leído y acepto el {info.tipo} {info.referencia}, y firmo electrónicamente como <b>{info.nombre}</b>.</span>
        </label>
        <button className="btn-p" disabled={busy || !firma || !acepto} onClick={firmar} style={{ width:'100%', height:52, fontSize:15, marginTop:16 }}>{busy ? 'Firmando…' : 'Firmar documento'}</button>
        <details style={{ marginTop:14 }}><summary style={{ fontSize:13, color:'#00208F', cursor:'pointer' }}>Volver a ver el documento</summary><div style={{ marginTop:10 }}><VistaPrevia html={info.html} /></div></details>
      </div>
    )}

    {paso === 4 && (
      <div className="card" style={{ padding:24 }}>
        <p style={{ fontSize:15, marginBottom:16 }}>{info.completo
          ? 'Todas las partes han firmado. Puedes descargar tu copia en PDF; también te la hemos enviado por email.'
          : 'Tu firma se ha registrado correctamente. Cuando firmen el resto de partes recibirás el documento completo por email.'}</p>
        <button className="btn-p" onClick={() => imprimirHTML(info.html, `${info.referencia}${info.completo ? ' firmado' : ''}`)} style={{ height:48 }}>Descargar / imprimir PDF</button>
        <div style={{ marginTop:16 }}><VistaPrevia html={info.html} /></div>
      </div>
    )}
  </>);
}
