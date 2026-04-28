import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BREVO_API_KEY = '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';
const PARTNER_EMAIL = 'piandorenergia@corporacionlexgal.com';
const FROM_EMAIL = 'arey@quenecesitashoy.es';
const BRAND = '#002292';

const fileToBase64 = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = () => res(reader.result.split(',')[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

export default function EnergiaSection({ contact, user, users }) {
  const [active, setActive] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [uploading, setUploading] = useState({ 1: false, 2: false });
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { loadData(); }, [contact.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoaded(false);
    const { data } = await supabase
      .from('energy_invoices')
      .select('id, contact_id, comercial_id, factura_1_nombre, factura_2_nombre, factura_1_base64, factura_2_base64, enviado_partner, fecha_envio, mensaje, created_at')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false });
    const all = data || [];
    setHistorial(all.filter(r => r.enviado_partner));
    setActive(all.find(r => !r.enviado_partner) || {});
    setLoaded(true);
  };

  const handleUpload = async (num, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se aceptan archivos PDF'); return; }
    setUploading(u => ({ ...u, [num]: true }));

    let b64;
    try {
      b64 = await fileToBase64(file);
    } catch (e) {
      alert(`Error al leer el archivo: ${e.message}`);
      setUploading(u => ({ ...u, [num]: false }));
      return;
    }

    const update = {
      [`factura_${num}_nombre`]: file.name,
      [`factura_${num}_base64`]: b64,
    };

    let updated;
    if (active?.id) {
      const { data, error } = await supabase
        .from('energy_invoices').update(update).eq('id', active.id).select().single();
      if (error) { alert(`Error al guardar: ${error.message}`); setUploading(u => ({ ...u, [num]: false })); return; }
      updated = data;
    } else {
      const { data, error } = await supabase
        .from('energy_invoices')
        .insert({ id: crypto.randomUUID(), contact_id: contact.id, comercial_id: user.id, ...update })
        .select().single();
      if (error) { alert(`Error al guardar: ${error.message}`); setUploading(u => ({ ...u, [num]: false })); return; }
      updated = data;
    }
    setActive(updated);
    setUploading(u => ({ ...u, [num]: false }));
  };

  const handleDelete = async (num) => {
    if (!window.confirm(`¿Eliminar factura ${num}?`)) return;
    const update = { [`factura_${num}_nombre`]: null, [`factura_${num}_base64`]: null };
    const { data, error } = await supabase
      .from('energy_invoices').update(update).eq('id', active.id).select().single();
    if (!error) setActive(data);
  };

  const openEnviarModal = () => {
    setMensaje(
      `Estimados, adjunto les envío las facturas de consumo eléctrico del cliente ${contact.name} para su estudio y propuesta de ahorro. Quedamos a su disposición para cualquier consulta. Un saludo.`
    );
    setShowModal(true);
  };

  const handleEnviar = async () => {
    setSending(true);
    try {
      const direccionCompleta = [contact.direccion, contact.localidad, contact.provincia].filter(Boolean).join(', ') || '—';
      const bodyText = `${mensaje}\n\nDatos del cliente:\nNombre: ${contact.name}\nTeléfono: ${contact.phone || '—'}\nEmail: ${contact.email || '—'}\nDirección: ${direccionCompleta}`;

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: user.name, email: user.email },
          to: [{ email: PARTNER_EMAIL }],
          subject: `Facturas energía — ${contact.name}`,
          textContent: bodyText,
          attachment: [
            { content: active.factura_1_base64, name: active.factura_1_nombre },
            { content: active.factura_2_base64, name: active.factura_2_nombre },
          ],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData));
      }

      const fechaEnvio = new Date().toISOString();
      const { error: updErr } = await supabase
        .from('energy_invoices')
        .update({ enviado_partner: true, fecha_envio: fechaEnvio, mensaje, comercial_id: user.id })
        .eq('id', active.id);
      if (updErr) console.error('[EnergiaSection] update enviado:', updErr);

      await supabase.from('interactions').insert({
        id: crypto.randomUUID(),
        contact_id: contact.id,
        tipo: 'email',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Facturas de energía enviadas al partner. ${mensaje}`,
        comercial_id: user.id,
      });

      // Actualizar o crear deal de energía en etapa análisis
      const hoy = new Date().toISOString().split('T')[0];
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('linea', 'energia')
        .limit(1);
      if (deals && deals.length > 0) {
        await supabase.from('deals')
          .update({ etapa: 'análisis', updated_at: hoy })
          .eq('id', deals[0].id);
      } else {
        await supabase.from('deals').insert({
          id: crypto.randomUUID(),
          contact_id: contact.id,
          linea: 'energia',
          etapa: 'análisis',
          comercial_id: user.id,
          titulo: contact.name,
          valor: 0,
          updated_at: hoy,
        });
      }

      await loadData();
      setShowModal(false);
      alert('Facturas enviadas correctamente');
    } catch (e) {
      alert(`Error al enviar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!loaded) return <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>Cargando...</p>;

  const f1 = active?.factura_1_nombre;
  const f2 = active?.factura_2_nombre;
  const bothReady = !!(f1 && f2);
  const lastSend = historial[0];

  return (
    <div>
      {/* Badge ultimo envio */}
      {lastSend?.fecha_envio && (
        <div style={{ background: '#d1fae5', borderRadius: 8, padding: '8px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✅</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>
            Enviado al partner el {new Date(lastSend.fecha_envio).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      )}

      {/* Zonas de subida */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        {[1, 2].map(num => {
          const nombre = active?.[`factura_${num}_nombre`];
          const isUploading = uploading[num];
          return (
            <div key={num} style={{ border: '2px dashed #dde2f0', borderRadius: 12, padding: 16, textAlign: 'center', background: '#f8f9fd' }}>
              <div style={{ fontSize: 22, marginBottom: 7 }}>📄</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Factura {num}</p>
              {nombre ? (
                <div>
                  <p style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 8, wordBreak: 'break-all', lineHeight: 1.4 }}>{nombre}</p>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleDelete(num)}
                      style={{ fontSize: 11, color: '#dc2626', background: 'none', border: '1.5px solid #fecaca', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                    >Eliminar</button>
                    <label style={{ cursor: 'pointer' }}>
                      <span style={{ fontSize: 11, color: BRAND, background: 'none', border: '1.5px solid #dde2f0', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', display: 'inline-block' }}>
                        Cambiar
                      </span>
                      <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => { handleUpload(num, e.target.files[0]); e.target.value = ''; }} disabled={isUploading} />
                    </label>
                  </div>
                </div>
              ) : (
                <label style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                  <span style={{ fontSize: 12, color: BRAND, fontWeight: 600, display: 'inline-block', padding: '6px 16px', background: '#e6eaf8', borderRadius: 8, opacity: isUploading ? 0.6 : 1 }}>
                    {isUploading ? 'Guardando...' : '+ Subir PDF'}
                  </span>
                  <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => { handleUpload(num, e.target.files[0]); e.target.value = ''; }} disabled={isUploading} />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Boton enviar */}
      <button
        onClick={openEnviarModal}
        disabled={!bothReady}
        style={{
          width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
          fontSize: 14, fontWeight: 700,
          cursor: bothReady ? 'pointer' : 'not-allowed',
          background: bothReady ? '#d97706' : '#f3f4f6',
          color: bothReady ? 'white' : '#9ca3af',
          transition: 'all .2s', marginBottom: 24,
        }}
      >
        Enviar al partner{!bothReady ? ' — sube las 2 facturas para activar' : ''}
      </button>

      {/* Historial */}
      {historial.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Historial de envios</p>
          {historial.map(h => {
            const com = users?.find(u => u.id === h.comercial_id);
            return (
              <div key={h.id} style={{ background: '#f8f9fd', borderRadius: 8, padding: '10px 14px', marginBottom: 8, borderLeft: '3px solid #d97706' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>
                    {h.fecha_envio
                      ? new Date(h.fecha_envio).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                  {com && <span style={{ fontSize: 11, color: '#6b7280' }}>{com.name}</span>}
                </div>
                {h.mensaje && <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{h.mensaje}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal envio */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,80,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: BRAND, marginBottom: 16 }}>Enviar facturas al partner</h2>

            <div style={{ background: '#f8f9fd', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Datos del cliente</p>
              {[
                ['Nombre', contact.name],
                ['Telefono', contact.phone || '—'],
                ['Email', contact.email || '—'],
                ['Direccion', [contact.direccion, contact.localidad, contact.provincia].filter(Boolean).join(', ') || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 70 }}>{k}:</span>
                  <span style={{ fontSize: 11, color: '#1e2a4a' }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.5px' }}>Mensaje</label>
              <textarea
                style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #dde2f0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 110, fontFamily: 'inherit', color: '#1e2a4a', boxSizing: 'border-box' }}
                value={mensaje}
                onChange={e => setMensaje(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #dde2f0', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
              >Cancelar</button>
              <button
                onClick={handleEnviar}
                disabled={sending}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: sending ? '#9ca3af' : '#d97706', color: 'white', fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}
              >{sending ? 'Enviando...' : 'Enviar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
