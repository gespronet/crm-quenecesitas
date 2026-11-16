import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

// Página pública ?activar=TOKEN — crear o restablecer la contraseña del CRM
export function ActivarCuenta({ token, css }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [p1, setP1] = useState(''); const [p2, setP2] = useState('');
  const [busy, setBusy] = useState(false); const [hecho, setHecho] = useState(false);

  const api = async (body) => {
    const { data, error } = await supabase.functions.invoke('cuentas', { body });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (e) {} throw new Error(m); }
    if (data?.error) throw new Error(data.error);
    return data;
  };
  useEffect(() => { api({ action:'token', token }).then(setInfo).catch(e => setError(e.message)); /* eslint-disable-next-line */ }, [token]);

  const fuerza = p1.length >= 10 && /[A-Za-z]/.test(p1) && /[0-9]/.test(p1);
  const guardar = async () => {
    if (!fuerza) return setError('Mínimo 10 caracteres, con letras y números.');
    if (p1 !== p2) return setError('Las contraseñas no coinciden.');
    setBusy(true); setError('');
    try {
      const r = await api({ action:'activar', token, password:p1 });
      await supabase.auth.signInWithPassword({ email:r.email, password:p1 });
      setHecho(true);
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#F6F5F1', display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{css}</style>
      <div className="card" style={{ width:'100%', maxWidth:420, padding:32 }}>
        <div className="eyebrow">Qué necesitas hoy · CRM</div>
        {!info && !error && <p style={{ color:'#5B6178' }}>Comprobando enlace…</p>}
        {!info && error && <><h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:24, marginBottom:8 }}>Enlace no válido</h1><p style={{ color:'#5B6178' }}>{error}</p><a href="/" style={{ display:'inline-block', marginTop:16, color:'#00208F', fontWeight:700 }}>Ir al acceso</a></>}
        {info && !hecho && <>
          <h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:26, letterSpacing:'-.03em', marginBottom:6 }}>{info.tipo === 'reset' ? 'Nueva contraseña' : `Hola, ${(info.nombre || '').split(' ')[0]}`}</h1>
          <p style={{ color:'#5B6178', fontSize:14, marginBottom:20 }}>{info.tipo === 'reset' ? 'Elige una nueva contraseña para' : 'Crea tu contraseña para entrar al CRM con'} <b>{info.email}</b>.</p>
          <label className="fl">Contraseña</label>
          <input className="fi" type="password" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} style={{ height:48, marginBottom:6 }} />
          <p style={{ fontSize:12, color: fuerza ? '#00208F' : '#8A8FA3', marginBottom:14 }}>{fuerza ? '✓ Contraseña válida' : 'Mínimo 10 caracteres, con letras y números'}</p>
          <label className="fl">Repite la contraseña</label>
          <input className="fi" type="password" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardar()} style={{ height:48, marginBottom:16 }} />
          {error && <p style={{ color:'#dc2626', fontSize:13, marginBottom:12 }}>{error}</p>}
          <button className="btn-p" disabled={busy} onClick={guardar} style={{ width:'100%', height:50, fontSize:15 }}>{busy ? 'Guardando…' : 'Guardar y entrar'}</button>
        </>}
        {hecho && <><h1 style={{ fontFamily:"'Poppins',sans-serif", fontSize:24 }}>¡Listo!</h1><p style={{ color:'#5B6178' }}>Entrando en el CRM…</p></>}
      </div>
    </div>
  );
}
