import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BREVO_API_KEY = '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';
const PARTNER_EMAIL = 'administracion@corporacionlexgal.com';
const BRAND = '#dc2626'; // rojo alarmas

const fileToBase64 = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = () => res(reader.result.split(',')[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

const PERFIL_LABELS = {
  residencial: 'Residencial / Particular',
  pyme: 'Pyme',
};

// tipo: 'file' | 'text'
const DOCS_POR_PERFIL = {
  residencial: [
    { nombre: 'DNI del firmante + documento que acredite firma',                                  tipo: 'file' },
    { nombre: 'Número de cuenta bancaria (certificado bancario o factura/recibo con nombre)',     tipo: 'file' },
    { nombre: 'Correo electrónico',                                                               tipo: 'text', placeholder: 'email@ejemplo.com' },
    { nombre: 'Móvil',                                                                            tipo: 'text', placeholder: '600 000 000' },
  ],
  pyme: [
    { nombre: 'DNI del firmante + documento que acredite firma',                                  tipo: 'file' },
    { nombre: 'Número de cuenta bancaria (certificado bancario o factura/recibo con nombre)',     tipo: 'file' },
    { nombre: 'Correo electrónico',                                                               tipo: 'text', placeholder: 'email@ejemplo.com' },
    { nombre: 'Móvil',                                                                            tipo: 'text', placeholder: '600 000 000' },
    { nombre: 'CIF (documento de hacienda)',                                                      tipo: 'file' },
  ],
};

// Devuelve el tipo (file/text) de un doc por su nombre
function docTipo(nombre) {
  for (const docs of Object.values(DOCS_POR_PERFIL)) {
    const found = docs.find(d => d.nombre === nombre);
    if (found) return found.tipo;
  }
  return 'file';
}
function docPlaceholder(nombre) {
  for (const docs of Object.values(DOCS_POR_PERFIL)) {
    const found = docs.find(d => d.nombre === nombre);
    if (found) return found.placeholder || '';
  }
  return '';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AlarmaSection({ contact, user }) {
  const [contract, setContract]   = useState(null);
  const [docs, setDocs]           = useState([]);
  const [loaded, setLoaded]       = useState(false);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [sending, setSending]     = useState(false);

  useEffect(() => { loadData(); }, [contact.id]); // eslint-disable-line

  const loadData = async () => {
    setLoaded(false);

    const { data: contractData } = await supabase
      .from('alarm_contracts')
      .select('*')
      .eq('contact_id', contact.id)
      .maybeSingle();

    setContract(contractData || null);

    if (contractData) {
      const { data: docsData } = await supabase
        .from('alarm_contract_docs')
        .select('*')
        .eq('contract_id', contractData.id)
        .order('created_at', { ascending: true });
      setDocs(docsData || []);
    } else {
      // Crear contrato vacío
      const newContract = {
        id: crypto.randomUUID(),
        contact_id: contact.id,
        perfil_cliente: null,
        contrato_enviado: false,
        fecha_envio: null,
        comercial_id: user.id,
        created_at: new Date().toISOString(),
      };
      const { data: created } = await supabase
        .from('alarm_contracts')
        .insert(newContract)
        .select()
        .single();
      setContract(created || newContract);
      setDocs([]);
    }

    setLoaded(false); // lo ponemos a false hasta que terminemos
    setLoaded(true);
  };

  const handlePerfilChange = async (nuevoPerfil) => {
    if (!contract) return;
    if (nuevoPerfil === contract.perfil_cliente) return;
    if (docs.length > 0) {
      if (!window.confirm('Cambiar el perfil eliminará los documentos actuales. ¿Continuar?')) return;
    }
    setSavingPerfil(true);
    await supabase.from('alarm_contract_docs').delete().eq('contract_id', contract.id);
    await supabase.from('alarm_contracts').update({ perfil_cliente: nuevoPerfil }).eq('id', contract.id);

    const now = new Date().toISOString();
    const newDocs = (DOCS_POR_PERFIL[nuevoPerfil] || []).map(d => ({
      id: crypto.randomUUID(),
      contract_id: contract.id,
      nombre: d.nombre,
      recibido: false,
      archivo_url: null,
      archivo_nombre: null,
      archivo_base64: null,
      created_at: now,
    }));
    if (newDocs.length > 0) {
      await supabase.from('alarm_contract_docs').insert(newDocs);
    }
    setContract(c => ({ ...c, perfil_cliente: nuevoPerfil }));
    setDocs(newDocs);
    setSavingPerfil(false);
  };

  const handleToggleRecibido = async (doc) => {
    const newVal = !doc.recibido;
    await supabase.from('alarm_contract_docs').update({ recibido: newVal }).eq('id', doc.id);
    setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, recibido: newVal } : d));
  };

  const handleDocUpload = async (doc, file) => {
    const b64 = await fileToBase64(file);
    await supabase.from('alarm_contract_docs').update({
      archivo_nombre: file.name,
      archivo_base64: b64,
      recibido: true,
    }).eq('id', doc.id);
    setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, archivo_nombre: file.name, archivo_base64: b64, recibido: true } : d));
  };

  const handleTextChange = async (doc, value) => {
    // Actualizar estado local inmediatamente
    setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, archivo_nombre: value, recibido: value.trim().length > 0 } : d));
    // Persistir en DB
    await supabase.from('alarm_contract_docs').update({
      archivo_nombre: value,
      recibido: value.trim().length > 0,
    }).eq('id', doc.id);
  };

  const handleEnviarExpediente = async () => {
    if (!contract || sending) return;
    setSending(true);
    try {
      const perfilLabel = PERFIL_LABELS[contract.perfil_cliente] || contract.perfil_cliente;
      const dir = [contact.direccion, contact.localidad, contact.provincia].filter(Boolean).join(', ') || '—';

      // Construir cuerpo del email
      const textDocs = docs.filter(d => docTipo(d.nombre) === 'text');
      const fileDocs = docs.filter(d => docTipo(d.nombre) === 'file');

      const bodyLines = [
        `Estimados, adjunto les envío el expediente de contratación de alarma del cliente ${contact.name} (perfil: ${perfilLabel}).`,
        '',
        'Datos del cliente:',
        `Nombre: ${contact.name}`,
        `Teléfono: ${contact.phone || '—'}`,
        `Email: ${contact.email || '—'}`,
        `Dirección: ${dir}`,
        '',
        `Perfil: ${perfilLabel}`,
        '',
      ];

      if (textDocs.length > 0) {
        bodyLines.push('Datos de contacto del cliente:');
        textDocs.forEach(d => bodyLines.push(`${d.nombre}: ${d.archivo_nombre || '—'}`));
        bodyLines.push('');
      }

      if (fileDocs.length > 0) {
        bodyLines.push('Documentos adjuntos:');
        fileDocs.forEach(d => bodyLines.push(`- ${d.nombre}${d.archivo_nombre ? `: ${d.archivo_nombre}` : ''}`));
      }

      const attachments = fileDocs
        .filter(d => d.archivo_base64 && d.archivo_nombre)
        .map(d => ({ content: d.archivo_base64, name: d.archivo_nombre }));

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
          subject: `Expediente contratación alarma — ${contact.name}`,
          textContent: bodyLines.join('\n'),
          ...(attachments.length > 0 ? { attachment: attachments } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData));
      }

      const hoy = new Date().toISOString();

      // Marcar contrato como enviado
      await supabase.from('alarm_contracts').update({
        contrato_enviado: true,
        fecha_envio: hoy,
      }).eq('id', contract.id);

      // Registrar interacción
      await supabase.from('interactions').insert({
        id: crypto.randomUUID(),
        contact_id: contact.id,
        tipo: 'email',
        fecha: hoy.split('T')[0],
        descripcion: `Expediente de contratación de alarma enviado a ${PARTNER_EMAIL} — perfil: ${perfilLabel}`,
        comercial_id: user.id,
      });

      // Mover deal de alarmas a "contrato enviado"
      const { data: deals } = await supabase
        .from('deals')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('linea', 'alarmas')
        .limit(1);
      if (deals && deals.length > 0) {
        await supabase.from('deals').update({ etapa: 'contrato', updated_at: hoy.split('T')[0] }).eq('id', deals[0].id);
      }

      setContract(c => ({ ...c, contrato_enviado: true, fecha_envio: hoy }));
      alert('Expediente enviado correctamente');
    } catch (e) {
      alert(`Error al enviar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!loaded) return <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>Cargando...</p>;

  const perfil = contract?.perfil_cliente;
  const docsTotal = docs.length;
  const docsRecibidos = docs.filter(d => d.recibido).length;
  const todosRecibidos = docsTotal > 0 && docsRecibidos === docsTotal;
  const enviado = contract?.contrato_enviado;

  return (
    <div>
      {/* Selector de perfil */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
          Perfil del cliente
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PERFIL_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => !enviado && handlePerfilChange(key)}
              disabled={savingPerfil || enviado}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: `2px solid ${perfil === key ? BRAND : '#dde2f0'}`,
                background: perfil === key ? BRAND : 'white',
                color: perfil === key ? 'white' : '#374151',
                cursor: (savingPerfil || enviado) ? 'not-allowed' : 'pointer',
                opacity: enviado && perfil !== key ? 0.4 : 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {savingPerfil && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>Cargando documentos...</p>}
      </div>

      {/* Lista de documentos */}
      {perfil && docs.length > 0 && (
        <div style={{ background: '#fef2f2', borderRadius: 10, padding: 14, border: '1.5px solid #fecaca' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
            Documentación para contrato
          </p>

          {/* Barra de progreso */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                {docsRecibidos} de {docsTotal} documentos recibidos
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: todosRecibidos ? '#059669' : BRAND }}>
                {todosRecibidos ? '✅ Completo' : `${Math.round((docsRecibidos / docsTotal) * 100)}%`}
              </span>
            </div>
            <div style={{ height: 6, background: '#fecaca', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(docsRecibidos / docsTotal) * 100}%`,
                background: todosRecibidos ? '#059669' : BRAND,
                borderRadius: 99,
                transition: 'width .3s',
              }} />
            </div>
          </div>

          {/* Docs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {docs.map(doc => (
              <DocItem
                key={doc.id}
                doc={doc}
                tipo={docTipo(doc.nombre)}
                placeholder={docPlaceholder(doc.nombre)}
                disabled={enviado}
                onToggle={() => handleToggleRecibido(doc)}
                onUpload={(file) => handleDocUpload(doc, file)}
                onTextChange={(val) => handleTextChange(doc, val)}
              />
            ))}
          </div>

          {/* Botón enviar */}
          {enviado ? (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'center', padding: '8px 0' }}>
              ✅ Expediente enviado el{' '}
              {new Date(contract.fecha_envio).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          ) : (
            <button
              onClick={handleEnviarExpediente}
              disabled={!todosRecibidos || sending}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                fontSize: 13, fontWeight: 700,
                cursor: (todosRecibidos && !sending) ? 'pointer' : 'not-allowed',
                background: todosRecibidos ? BRAND : '#f3f4f6',
                color: todosRecibidos ? 'white' : '#9ca3af',
              }}
            >
              {sending
                ? 'Enviando...'
                : todosRecibidos
                ? '📋 Enviar expediente'
                : '📋 Enviar expediente — marca todos los documentos primero'}
            </button>
          )}
        </div>
      )}

      {perfil && docs.length === 0 && !savingPerfil && (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>Cargando documentos...</p>
      )}
    </div>
  );
}

// ─── Doc item ──────────────────────────────────────────────────────────────────

function DocItem({ doc, tipo, placeholder, disabled, onToggle, onUpload, onTextChange }) {
  const [uploading, setUploading] = useState(false);
  const [textVal, setTextVal] = useState(doc.archivo_nombre || '');

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); }
  };

  const handleBlur = () => {
    if (textVal !== doc.archivo_nombre) onTextChange(textVal);
  };

  const isText = tipo === 'text';

  return (
    <div style={{
      padding: '9px 11px', background: 'white', borderRadius: 8,
      border: `1.5px solid ${doc.recibido ? '#a7f3d0' : '#e8ecf8'}`,
    }}>
      {/* Primera fila: checkbox + nombre */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <input
          type="checkbox"
          checked={doc.recibido}
          onChange={onToggle}
          disabled={disabled || isText} // los de texto se marcan automáticamente
          style={{ width: 15, height: 15, marginTop: 2, cursor: (disabled || isText) ? 'default' : 'pointer', accentColor: '#dc2626', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: doc.recibido ? '#059669' : '#374151', lineHeight: 1.3 }}>
            {doc.nombre}
          </p>
          {!isText && doc.archivo_nombre && (
            <p style={{ fontSize: 10, color: '#6b7280', marginTop: 2, wordBreak: 'break-all' }}>📎 {doc.archivo_nombre}</p>
          )}
        </div>
        {/* Botón subir — solo para tipo file */}
        {!isText && !disabled && (
          <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 6, display: 'inline-block',
              background: doc.archivo_nombre ? '#f0fdf4' : '#fef2f2',
              color: doc.archivo_nombre ? '#059669' : '#dc2626',
              border: `1px solid ${doc.archivo_nombre ? '#a7f3d0' : '#fecaca'}`,
              opacity: uploading ? 0.6 : 1,
            }}>
              {uploading ? '...' : doc.archivo_nombre ? 'Cambiar' : 'Subir'}
            </span>
            <input
              type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {/* Segunda fila: input texto — solo para tipo text */}
      {isText && !disabled && (
        <input
          type="text"
          value={textVal}
          onChange={e => setTextVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => e.key === 'Enter' && handleBlur()}
          placeholder={placeholder}
          style={{
            marginTop: 7, width: '100%', padding: '6px 10px',
            border: '1.5px solid #dde2f0', borderRadius: 7, fontSize: 12,
            color: '#1e2a4a', outline: 'none', boxSizing: 'border-box',
          }}
        />
      )}
      {isText && disabled && doc.archivo_nombre && (
        <p style={{ marginTop: 4, fontSize: 12, color: '#374151', fontWeight: 600 }}>{doc.archivo_nombre}</p>
      )}
    </div>
  );
}
