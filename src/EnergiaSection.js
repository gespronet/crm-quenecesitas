import { useState, useEffect } from 'react';
import { supabase } from './utils/supabase';

const BREVO_API_KEY = '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';
const PARTNER_EMAIL = 'piandorenergia@corporacionlexgal.com';
const BRAND = '#002292';
const TARIFAS = ['2.0TD', '3.0TD', '6.1TD', 'Otra'];

const fileToBase64 = (file) => new Promise((res, rej) => {
  const reader = new FileReader();
  reader.onload = () => res(reader.result.split(',')[1]);
  reader.onerror = rej;
  reader.readAsDataURL(file);
});

const EMPTY_FORM = {
  nombre: '', cups: '', direccion: '', localidad: '',
  codigo_postal: '', provincia: '', tarifa: '',
  potencia_contratada: '', comercializadora_actual: '',
  factura_1_nombre: null, factura_1_base64: null,
  factura_2_nombre: null, factura_2_base64: null,
};

const DOCS_POR_PERFIL = {
  particular: [
    'DNI (foto dos caras carnet)',
    'Una de las tres últimas facturas',
    'Número de cuenta bancaria',
    'Correo electrónico',
    'Móvil',
  ],
  autonomo: [
    'DNI (foto dos caras carnet)',
    'Una de las tres últimas facturas',
    'Número de cuenta bancaria + Certificado bancario',
    'Correo electrónico',
    'Móvil',
    'Último recibo de autónomo',
  ],
  pyme: [
    'DNI del firmante + documento que acredite firma',
    'Una de las tres últimas facturas',
    'Número de cuenta bancaria (certificado bancario)',
    'Correo electrónico',
    'Móvil',
    'CIF (documento de hacienda)',
  ],
};

const PERFIL_LABELS = {
  particular: 'Particular',
  autonomo: 'Autónomo',
  pyme: 'Pyme / Empresa',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function EnergiaSection({ contact, user, users }) {
  const [points, setPoints] = useState([]);
  const [contractsByPointId, setContractsByPointId] = useState({});
  const [docsByContractId, setDocsByContractId] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState({ 1: false, 2: false });
  const [saving, setSaving] = useState(false);
  const [showEnviarModal, setShowEnviarModal] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { loadData(); }, [contact.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoaded(false);
    const { data: spData } = await supabase
      .from('supply_points')
      .select('*')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: true });

    let pts = spData || [];

    // Migración automática desde energy_invoices si no hay puntos aún
    if (pts.length === 0) {
      const { data: inv } = await supabase
        .from('energy_invoices')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: true });

      if (inv && inv.length > 0) {
        const toInsert = inv.map(r => ({
          id: crypto.randomUUID(),
          contact_id: r.contact_id,
          nombre: 'Principal',
          comercial_id: r.comercial_id,
          factura_1_nombre: r.factura_1_nombre,
          factura_1_base64: r.factura_1_base64,
          factura_2_nombre: r.factura_2_nombre,
          factura_2_base64: r.factura_2_base64,
          enviado_partner: r.enviado_partner,
          fecha_envio: r.fecha_envio,
          mensaje: r.mensaje,
          created_at: r.created_at,
        }));
        const { data: migrated } = await supabase.from('supply_points').insert(toInsert).select();
        pts = migrated || [];
      }
    }

    setPoints(pts);

    // Cargar contratos de energía
    if (pts.length > 0) {
      const { data: contractsData } = await supabase
        .from('energy_contracts')
        .select('*')
        .eq('contact_id', contact.id);

      const cbp = {};
      if (contractsData) {
        contractsData.forEach(c => { cbp[c.supply_point_id] = c; });
      }
      setContractsByPointId(cbp);

      const contractIds = contractsData ? contractsData.map(c => c.id) : [];
      if (contractIds.length > 0) {
        const { data: docsData } = await supabase
          .from('energy_contract_docs')
          .select('*')
          .in('contract_id', contractIds)
          .order('created_at', { ascending: true });

        const dbc = {};
        if (docsData) {
          docsData.forEach(d => {
            if (!dbc[d.contract_id]) dbc[d.contract_id] = [];
            dbc[d.contract_id].push(d);
          });
        }
        setDocsByContractId(dbc);
      } else {
        setDocsByContractId({});
      }
    } else {
      setContractsByPointId({});
      setDocsByContractId({});
    }

    setLoaded(true);
  };

  // ── Add / Edit modal ─────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingPoint(null);
    setForm(EMPTY_FORM);
    setUploading({ 1: false, 2: false });
    setShowAddModal(true);
  };

  const openEdit = (pt) => {
    setEditingPoint(pt);
    setForm({
      nombre: pt.nombre || '',
      cups: pt.cups || '',
      direccion: pt.direccion || '',
      localidad: pt.localidad || '',
      codigo_postal: pt.codigo_postal || '',
      provincia: pt.provincia || '',
      tarifa: pt.tarifa || '',
      potencia_contratada: pt.potencia_contratada || '',
      comercializadora_actual: pt.comercializadora_actual || '',
      factura_1_nombre: pt.factura_1_nombre || null,
      factura_1_base64: pt.factura_1_base64 || null,
      factura_2_nombre: pt.factura_2_nombre || null,
      factura_2_base64: pt.factura_2_base64 || null,
    });
    setUploading({ 1: false, 2: false });
    setShowAddModal(true);
  };

  const handleFormChange = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleFormUpload = async (num, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Solo se aceptan archivos PDF'); return; }
    setUploading(u => ({ ...u, [num]: true }));
    try {
      const b64 = await fileToBase64(file);
      setForm(f => ({ ...f, [`factura_${num}_nombre`]: file.name, [`factura_${num}_base64`]: b64 }));
    } catch (e) {
      alert(`Error al leer el archivo: ${e.message}`);
    } finally {
      setUploading(u => ({ ...u, [num]: false }));
    }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { alert('El nombre identificativo es obligatorio'); return; }
    if (!form.direccion.trim()) { alert('La dirección es obligatoria'); return; }
    if (!form.factura_1_nombre || !form.factura_2_nombre) { alert('Debes subir las dos facturas'); return; }
    if (form.cups.trim() && form.cups.trim().length !== 20 && form.cups.trim().length !== 22) {
      alert('El CUPS debe tener 20 caracteres'); return;
    }

    setSaving(true);
    const payload = {
      contact_id: contact.id,
      comercial_id: user.id,
      nombre: form.nombre.trim(),
      cups: form.cups.trim().toUpperCase() || null,
      direccion: form.direccion.trim() || null,
      localidad: form.localidad.trim() || null,
      codigo_postal: form.codigo_postal.trim() || null,
      provincia: form.provincia.trim() || null,
      tarifa: form.tarifa || null,
      potencia_contratada: form.potencia_contratada || null,
      comercializadora_actual: form.comercializadora_actual.trim() || null,
      factura_1_nombre: form.factura_1_nombre,
      factura_1_base64: form.factura_1_base64,
      factura_2_nombre: form.factura_2_nombre,
      factura_2_base64: form.factura_2_base64,
    };

    let error;
    if (editingPoint) {
      ({ error } = await supabase.from('supply_points').update(payload).eq('id', editingPoint.id));
    } else {
      ({ error } = await supabase.from('supply_points').insert({ id: crypto.randomUUID(), ...payload }));
    }

    if (error) { alert(`Error al guardar: ${error.message}`); setSaving(false); return; }
    setSaving(false);
    setShowAddModal(false);
    await loadData();
  };

  const handleDeletePoint = async (pt) => {
    if (!window.confirm(`¿Eliminar el punto "${pt.nombre}"? Esta acción no se puede deshacer.`)) return;
    await supabase.from('supply_points').delete().eq('id', pt.id);
    await loadData();
  };

  // ── Enviar facturas al partner (Fase 1) ──────────────────────────────────

  const openEnviarModal = (pt) => {
    setShowEnviarModal(pt);
    setMensaje(
      `Estimados, adjunto les envío las facturas de consumo eléctrico del cliente ${contact.name} correspondientes al punto de suministro "${pt.nombre}"${pt.cups ? ` (CUPS: ${pt.cups})` : ''} para su estudio y propuesta de ahorro. Quedamos a su disposición para cualquier consulta. Un saludo.`
    );
  };

  const handleEnviar = async () => {
    const pt = showEnviarModal;
    setSending(true);
    try {
      const dirCliente = [contact.direccion, contact.localidad, contact.provincia].filter(Boolean).join(', ') || '—';
      const dirPunto = [pt.direccion, pt.localidad, pt.provincia].filter(Boolean).join(', ') || '—';
      const bodyText = [
        mensaje,
        '',
        'Datos del cliente:',
        `Nombre: ${contact.name}`,
        `Teléfono: ${contact.phone || '—'}`,
        `Email: ${contact.email || '—'}`,
        `Dirección: ${dirCliente}`,
        '',
        `Punto de suministro: ${pt.nombre}`,
        `CUPS: ${pt.cups || '—'}`,
        `Dirección: ${dirPunto}`,
        `Tarifa: ${pt.tarifa || '—'}`,
        `Potencia contratada: ${pt.potencia_contratada ? `${pt.potencia_contratada} kW` : '—'}`,
        `Comercializadora actual: ${pt.comercializadora_actual || '—'}`,
      ].join('\n');

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
          subject: `Facturas energía — ${contact.name} — ${pt.nombre}`,
          textContent: bodyText,
          attachment: [
            { content: pt.factura_1_base64, name: pt.factura_1_nombre },
            { content: pt.factura_2_base64, name: pt.factura_2_nombre },
          ],
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData));
      }

      const fechaEnvio = new Date().toISOString();
      await supabase.from('supply_points')
        .update({ enviado_partner: true, fecha_envio: fechaEnvio, mensaje, comercial_id: user.id })
        .eq('id', pt.id);

      await supabase.from('interactions').insert({
        id: crypto.randomUUID(),
        contact_id: contact.id,
        tipo: 'email',
        fecha: new Date().toISOString().split('T')[0],
        descripcion: `Facturas de energía enviadas al partner — punto "${pt.nombre}"${pt.cups ? ` (CUPS: ${pt.cups})` : ''}. ${mensaje}`,
        comercial_id: user.id,
      });

      const hoy = new Date().toISOString().split('T')[0];
      const { data: deals } = await supabase.from('deals').select('id').eq('contact_id', contact.id).eq('linea', 'energia').limit(1);
      if (deals && deals.length > 0) {
        await supabase.from('deals').update({ etapa: 'análisis', updated_at: hoy }).eq('id', deals[0].id);
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
      setShowEnviarModal(null);
      alert('Facturas enviadas correctamente');
    } catch (e) {
      alert(`Error al enviar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  // ── Aprobar estudio (Fase 1 → Fase 2) ────────────────────────────────────

  const handleAprobarEstudio = async (pt) => {
    if (!window.confirm('¿El cliente ha aprobado el estudio?')) return;

    const hoy = new Date().toISOString();

    // 1. Convertir contacto a 'cliente'
    await supabase.from('contacts').update({ tipo: 'cliente' }).eq('id', contact.id);

    // 2. Mover deal a 'Contratación'
    const { data: deals } = await supabase.from('deals').select('id').eq('contact_id', contact.id).eq('linea', 'energia').limit(1);
    if (deals && deals.length > 0) {
      await supabase.from('deals').update({ etapa: 'contratación', updated_at: hoy.split('T')[0] }).eq('id', deals[0].id);
    }

    // 3. Crear o actualizar registro en energy_contracts
    const existingContract = contractsByPointId[pt.id];
    if (!existingContract) {
      await supabase.from('energy_contracts').insert({
        id: crypto.randomUUID(),
        contact_id: contact.id,
        supply_point_id: pt.id,
        estudio_aprobado: true,
        fecha_aprobacion: hoy,
        comercial_id: user.id,
        created_at: hoy,
      });
    } else {
      await supabase.from('energy_contracts').update({
        estudio_aprobado: true,
        fecha_aprobacion: hoy,
      }).eq('id', existingContract.id);
    }

    await loadData();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!loaded) return <p style={{ color: '#9ca3af', fontSize: 13, padding: '12px 0' }}>Cargando...</p>;

  return (
    <div>
      {points.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 13 }}>
          No hay puntos de suministro. Añade el primero.
        </div>
      )}

      {points.map(pt => {
        const contract = contractsByPointId[pt.id] || null;
        const contractDocs = contract ? (docsByContractId[contract.id] || []) : [];
        return (
          <SupplyPointCard
            key={pt.id}
            pt={pt}
            users={users}
            contact={contact}
            user={user}
            contract={contract}
            contractDocs={contractDocs}
            onEdit={() => openEdit(pt)}
            onDelete={() => handleDeletePoint(pt)}
            onEnviar={() => openEnviarModal(pt)}
            onAprobar={() => handleAprobarEstudio(pt)}
            onRefresh={loadData}
          />
        );
      })}

      <button
        onClick={openAdd}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10,
          border: `2px dashed ${BRAND}`, fontSize: 14, fontWeight: 700,
          cursor: 'pointer', background: '#f0f4ff', color: BRAND,
          marginTop: points.length > 0 ? 10 : 0,
        }}
      >
        Añadir punto de suministro
      </button>

      {showAddModal && (
        <AddEditModal
          editingPoint={editingPoint}
          form={form}
          uploading={uploading}
          saving={saving}
          onClose={() => setShowAddModal(false)}
          onChange={handleFormChange}
          onUpload={handleFormUpload}
          onSave={handleSave}
        />
      )}

      {showEnviarModal && (
        <EnviarModal
          pt={showEnviarModal}
          contact={contact}
          mensaje={mensaje}
          sending={sending}
          onClose={() => setShowEnviarModal(null)}
          onMensajeChange={setMensaje}
          onEnviar={handleEnviar}
        />
      )}
    </div>
  );
}

// ─── Supply point card ────────────────────────────────────────────────────────

function SupplyPointCard({ pt, users, contact, user, contract, contractDocs, onEdit, onDelete, onEnviar, onAprobar, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const enviado = pt.enviado_partner;
  const bothReady = !!(pt.factura_1_nombre && pt.factura_2_nombre);
  const com = users?.find(u => u.id === pt.comercial_id);
  const estudioAprobado = contract?.estudio_aprobado;

  return (
    <div style={{ border: '1.5px solid #dde2f0', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
      {/* Cabecera */}
      <div style={{ padding: '12px 16px', background: estudioAprobado ? '#eff6ff' : enviado ? '#f0fdf4' : '#f8f9fd' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: BRAND }}>{pt.nombre}</span>
              {estudioAprobado ? (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, padding: '2px 8px' }}>
                  Contratación
                </span>
              ) : enviado ? (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#d1fae5', color: '#059669', borderRadius: 20, padding: '2px 8px' }}>
                  Enviado
                </span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#d97706', borderRadius: 20, padding: '2px 8px' }}>
                  Pendiente
                </span>
              )}
            </div>
            {pt.cups && (
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>CUPS: {pt.cups}</p>
            )}
            {pt.direccion && (
              <p style={{ fontSize: 11, color: '#6b7280' }}>
                {[pt.direccion, pt.localidad, pt.provincia].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={() => setExpanded(e => !e)} style={chipBtn('#e6eaf8', BRAND)}>
              {expanded ? 'Ocultar' : 'Ver detalle'}
            </button>
            <button onClick={onEdit} style={chipBtn('#f0fdf4', '#059669')}>Editar</button>
            <button onClick={onDelete} style={chipBtn('#fef2f2', '#dc2626')}>Eliminar</button>
          </div>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div style={{ padding: '14px 16px', borderTop: '1px solid #dde2f0', background: 'white' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 14 }}>
            {[
              ['Tarifa', pt.tarifa],
              ['Potencia', pt.potencia_contratada ? `${pt.potencia_contratada} kW` : null],
              ['Comercializadora', pt.comercializadora_actual],
              ['Facturas', `${pt.factura_1_nombre ? '✓' : '✗'} F1  ${pt.factura_2_nombre ? '✓' : '✗'} F2`],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 2 }}>{k}</p>
                <p style={{ fontSize: 12, color: '#1e2a4a', fontWeight: 600 }}>{v}</p>
              </div>
            ))}
          </div>

          {/* ── FASE 1 ── */}
          {!enviado && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Fase 1 — Estudio energético
              </p>
              <button
                onClick={onEnviar}
                disabled={!bothReady}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 700,
                  cursor: bothReady ? 'pointer' : 'not-allowed',
                  background: bothReady ? '#d97706' : '#f3f4f6',
                  color: bothReady ? 'white' : '#9ca3af',
                }}
              >
                {bothReady ? 'Enviar facturas al partner' : 'Enviar al partner — sube las 2 facturas primero'}
              </button>
            </div>
          )}

          {enviado && !estudioAprobado && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Fase 1 — Estudio energético
              </p>
              {pt.fecha_envio && (
                <p style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 10 }}>
                  Facturas enviadas el {new Date(pt.fecha_envio).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {com ? ` por ${com.name}` : ''}
                </p>
              )}
              <button
                onClick={onAprobar}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: '#059669', color: 'white',
                }}
              >
                ✅ Estudio aprobado por cliente
              </button>
            </div>
          )}

          {/* ── FASE 2 ── */}
          {estudioAprobado && (
            <ContratoSection
              contract={contract}
              docs={contractDocs}
              contact={contact}
              user={user}
              pt={pt}
              onRefresh={onRefresh}
            />
          )}
        </div>
      )}
    </div>
  );
}

function chipBtn(bg, color) {
  return {
    fontSize: 11, fontWeight: 700, background: bg, color,
    border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
  };
}

// ─── Fase 2 — Documentación para contrato ─────────────────────────────────────

function ContratoSection({ contract, docs, contact, user, pt, onRefresh }) {
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [sending, setSending] = useState(false);

  const perfil = contract?.perfil_cliente;
  const docsTotal = docs.length;
  const docsRecibidos = docs.filter(d => d.recibido).length;
  const todosRecibidos = docsTotal > 0 && docsRecibidos === docsTotal;

  const handlePerfilChange = async (nuevoPerfil) => {
    if (!contract || nuevoPerfil === perfil) return;
    if (docs.length > 0) {
      if (!window.confirm('Cambiar el perfil eliminará los documentos actuales. ¿Continuar?')) return;
    }
    setSavingPerfil(true);
    await supabase.from('energy_contract_docs').delete().eq('contract_id', contract.id);
    await supabase.from('energy_contracts').update({ perfil_cliente: nuevoPerfil }).eq('id', contract.id);
    const docNames = DOCS_POR_PERFIL[nuevoPerfil] || [];
    const now = new Date().toISOString();
    const newDocs = docNames.map(nombre => ({
      id: crypto.randomUUID(),
      contract_id: contract.id,
      nombre,
      recibido: false,
      archivo_url: null,
      archivo_nombre: null,
      archivo_base64: null,
      created_at: now,
    }));
    if (newDocs.length > 0) {
      await supabase.from('energy_contract_docs').insert(newDocs);
    }
    setSavingPerfil(false);
    onRefresh();
  };

  const handleToggleRecibido = async (doc) => {
    await supabase.from('energy_contract_docs').update({ recibido: !doc.recibido }).eq('id', doc.id);
    onRefresh();
  };

  const handleDocUpload = async (doc, file) => {
    const b64 = await fileToBase64(file);
    await supabase.from('energy_contract_docs').update({
      archivo_nombre: file.name,
      archivo_base64: b64,
      recibido: true,
    }).eq('id', doc.id);
    onRefresh();
  };

  const handleEnviarExpediente = async () => {
    if (!todosRecibidos || sending) return;
    setSending(true);
    try {
      const perfilLabel = PERFIL_LABELS[perfil] || perfil;
      const bodyText = [
        `Estimados, adjunto les envío el expediente de contratación del cliente ${contact.name} (perfil: ${perfilLabel}).`,
        '',
        'Datos del cliente:',
        `Nombre: ${contact.name}`,
        `Teléfono: ${contact.phone || '—'}`,
        `Email: ${contact.email || '—'}`,
        '',
        `Punto de suministro: ${pt.nombre}`,
        `CUPS: ${pt.cups || '—'}`,
        `Dirección: ${[pt.direccion, pt.localidad, pt.provincia].filter(Boolean).join(', ') || '—'}`,
        `Tarifa: ${pt.tarifa || '—'}`,
        '',
        `Perfil cliente: ${perfilLabel}`,
        '',
        'Documentos adjuntos:',
        ...docs.map(d => `- ${d.nombre}${d.archivo_nombre ? `: ${d.archivo_nombre}` : ''}`),
      ].join('\n');

      const attachments = docs
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
          subject: `Expediente contratación — ${contact.name}`,
          textContent: bodyText,
          ...(attachments.length > 0 ? { attachment: attachments } : {}),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData));
      }

      const hoy = new Date().toISOString();
      await supabase.from('energy_contracts').update({
        expediente_enviado: true,
        fecha_envio_expediente: hoy,
      }).eq('id', contract.id);

      await supabase.from('interactions').insert({
        id: crypto.randomUUID(),
        contact_id: contact.id,
        tipo: 'email',
        fecha: hoy.split('T')[0],
        descripcion: `Expediente de contratación enviado al partner — punto "${pt.nombre}" — perfil: ${perfilLabel}`,
        comercial_id: user.id,
      });

      const { data: deals } = await supabase.from('deals').select('id').eq('contact_id', contact.id).eq('linea', 'energia').limit(1);
      if (deals && deals.length > 0) {
        await supabase.from('deals').update({ etapa: 'contrato enviado', updated_at: hoy.split('T')[0] }).eq('id', deals[0].id);
      }

      await onRefresh();
      alert('Expediente enviado correctamente');
    } catch (e) {
      alert(`Error al enviar: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 14, background: '#f0f4ff', borderRadius: 10, border: '1.5px solid #c7d2fe' }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: BRAND, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
        Fase 2 — Documentación para contrato
      </p>

      {/* Selector de perfil */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Perfil del cliente</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(PERFIL_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handlePerfilChange(key)}
              disabled={savingPerfil}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: `2px solid ${perfil === key ? BRAND : '#dde2f0'}`,
                background: perfil === key ? BRAND : 'white',
                color: perfil === key ? 'white' : '#374151',
                cursor: savingPerfil ? 'not-allowed' : 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de documentos */}
      {perfil && docs.length > 0 && (
        <>
          {/* Barra de progreso */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                {docsRecibidos} de {docsTotal} documentos recibidos
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: todosRecibidos ? '#059669' : '#d97706' }}>
                {todosRecibidos ? '✅ Completo' : `${Math.round((docsRecibidos / docsTotal) * 100)}%`}
              </span>
            </div>
            <div style={{ height: 6, background: '#dde2f0', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(docsRecibidos / docsTotal) * 100}%`,
                background: todosRecibidos ? '#059669' : BRAND,
                borderRadius: 99,
                transition: 'width .3s',
              }} />
            </div>
          </div>

          {/* Items de documentos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {docs.map(doc => (
              <DocItem
                key={doc.id}
                doc={doc}
                onToggle={() => handleToggleRecibido(doc)}
                onUpload={(file) => handleDocUpload(doc, file)}
              />
            ))}
          </div>

          {/* Botón enviar expediente */}
          {contract?.expediente_enviado ? (
            <p style={{ fontSize: 12, fontWeight: 700, color: '#059669', textAlign: 'center', padding: '8px 0' }}>
              ✅ Expediente enviado al partner el{' '}
              {new Date(contract.fecha_envio_expediente).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                ? '📋 Enviar expediente al partner'
                : '📋 Enviar expediente al partner — marca todos los documentos primero'}
            </button>
          )}
        </>
      )}

      {perfil && docs.length === 0 && !savingPerfil && (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Cargando documentos...</p>
      )}

      {savingPerfil && (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Guardando perfil...</p>
      )}
    </div>
  );
}

// ─── Doc item ──────────────────────────────────────────────────────────────────

function DocItem({ doc, onToggle, onUpload }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', background: 'white', borderRadius: 8,
      border: `1.5px solid ${doc.recibido ? '#a7f3d0' : '#dde2f0'}`,
    }}>
      <input
        type="checkbox"
        checked={doc.recibido}
        onChange={onToggle}
        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: BRAND, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: doc.recibido ? '#059669' : '#374151', marginBottom: doc.archivo_nombre ? 2 : 0 }}>
          {doc.nombre}
        </p>
        {doc.archivo_nombre && (
          <p style={{ fontSize: 10, color: '#6b7280', wordBreak: 'break-all' }}>📎 {doc.archivo_nombre}</p>
        )}
      </div>
      <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
          background: doc.archivo_nombre ? '#f0fdf4' : '#f0f4ff',
          color: doc.archivo_nombre ? '#059669' : BRAND,
          border: `1px solid ${doc.archivo_nombre ? '#a7f3d0' : '#c7d2fe'}`,
          display: 'inline-block',
          opacity: uploading ? 0.6 : 1,
        }}>
          {uploading ? '...' : doc.archivo_nombre ? 'Cambiar' : 'Subir'}
        </span>
        <input
          type="file"
          accept=".pdf,image/*"
          style={{ display: 'none' }}
          onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

function AddEditModal({ editingPoint, form, uploading, saving, onClose, onChange, onUpload, onSave }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,80,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: BRAND, marginBottom: 18 }}>
          {editingPoint ? 'Editar punto de suministro' : 'Nuevo punto de suministro'}
        </h2>

        {/* Sección 1 — Datos del punto */}
        <SectionTitle>Datos del punto</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <FormLabel>Nombre identificativo *</FormLabel>
            <FormInput value={form.nombre} onChange={v => onChange('nombre', v)} placeholder="Ej: Casa, Local comercial..." />
          </div>
          <div>
            <FormLabel>CUPS (20 caracteres)</FormLabel>
            <FormInput value={form.cups} onChange={v => onChange('cups', v.toUpperCase())} placeholder="ES0031..." maxLength={22} />
          </div>
          <div>
            <FormLabel>Comercializadora actual</FormLabel>
            <FormInput value={form.comercializadora_actual} onChange={v => onChange('comercializadora_actual', v)} placeholder="Ej: Iberdrola..." />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <FormLabel>Dirección *</FormLabel>
            <FormInput value={form.direccion} onChange={v => onChange('direccion', v)} placeholder="Calle, número..." />
          </div>
          <div>
            <FormLabel>Localidad</FormLabel>
            <FormInput value={form.localidad} onChange={v => onChange('localidad', v)} placeholder="Ciudad..." />
          </div>
          <div>
            <FormLabel>Código Postal</FormLabel>
            <FormInput value={form.codigo_postal} onChange={v => onChange('codigo_postal', v)} placeholder="28000" maxLength={5} />
          </div>
          <div>
            <FormLabel>Provincia</FormLabel>
            <FormInput value={form.provincia} onChange={v => onChange('provincia', v)} placeholder="Provincia..." />
          </div>
          <div>
            <FormLabel>Tarifa actual</FormLabel>
            <select
              value={form.tarifa}
              onChange={e => onChange('tarifa', e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #dde2f0', borderRadius: 8, fontSize: 13, color: '#1e2a4a', background: 'white', boxSizing: 'border-box' }}
            >
              <option value="">Seleccionar...</option>
              {TARIFAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <FormLabel>Potencia contratada (kW)</FormLabel>
            <FormInput value={form.potencia_contratada} onChange={v => onChange('potencia_contratada', v)} placeholder="Ej: 5.75" />
          </div>
        </div>

        {/* Sección 2 — Facturas */}
        <SectionTitle style={{ marginTop: 6 }}>Facturas</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[1, 2].map(num => {
            const nombre = form[`factura_${num}_nombre`];
            const isUploading = uploading[num];
            return (
              <div key={num} style={{ border: '2px dashed #dde2f0', borderRadius: 12, padding: 14, textAlign: 'center', background: '#f8f9fd' }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>📄</div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Factura {num} *</p>
                {nombre ? (
                  <div>
                    <p style={{ fontSize: 10, color: '#059669', fontWeight: 600, marginBottom: 8, wordBreak: 'break-all', lineHeight: 1.4 }}>{nombre}</p>
                    <label style={{ cursor: 'pointer' }}>
                      <span style={{ fontSize: 11, color: BRAND, border: '1.5px solid #dde2f0', borderRadius: 6, padding: '3px 10px', display: 'inline-block' }}>
                        Cambiar
                      </span>
                      <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                        onChange={e => { onUpload(num, e.target.files[0]); e.target.value = ''; }}
                        disabled={isUploading} />
                    </label>
                  </div>
                ) : (
                  <label style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}>
                    <span style={{ fontSize: 12, color: BRAND, fontWeight: 600, display: 'inline-block', padding: '6px 14px', background: '#e6eaf8', borderRadius: 8, opacity: isUploading ? 0.6 : 1 }}>
                      {isUploading ? 'Leyendo...' : '+ Subir PDF'}
                    </span>
                    <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                      onChange={e => { onUpload(num, e.target.files[0]); e.target.value = ''; }}
                      disabled={isUploading} />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #dde2f0', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : BRAND, color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Guardando...' : 'Guardar punto de suministro'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enviar modal ─────────────────────────────────────────────────────────────

function EnviarModal({ pt, contact, mensaje, sending, onClose, onMensajeChange, onEnviar }) {
  const dirCliente = [contact.direccion, contact.localidad, contact.provincia].filter(Boolean).join(', ') || '—';
  const dirPunto = [pt.direccion, pt.localidad, pt.provincia].filter(Boolean).join(', ') || '—';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,80,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: BRAND, marginBottom: 16 }}>Enviar facturas al partner</h2>

        <div style={{ background: '#f8f9fd', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Datos del cliente</p>
          {[
            ['Nombre', contact.name],
            ['Teléfono', contact.phone || '—'],
            ['Email', contact.email || '—'],
            ['Dirección', dirCliente],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 70 }}>{k}:</span>
              <span style={{ fontSize: 11, color: '#1e2a4a' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Punto de suministro</p>
          {[
            ['Nombre', pt.nombre],
            ['CUPS', pt.cups || '—'],
            ['Dirección', dirPunto],
            ['Tarifa', pt.tarifa || '—'],
            ['Potencia', pt.potencia_contratada ? `${pt.potencia_contratada} kW` : '—'],
            ['Comercializadora', pt.comercializadora_actual || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 100 }}>{k}:</span>
              <span style={{ fontSize: 11, color: '#1e2a4a' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.5px' }}>Mensaje</label>
          <textarea
            style={{ width: '100%', padding: '8px 11px', border: '1.5px solid #dde2f0', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 100, fontFamily: 'inherit', color: '#1e2a4a', boxSizing: 'border-box' }}
            value={mensaje}
            onChange={e => onMensajeChange(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #dde2f0', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Cancelar
          </button>
          <button onClick={onEnviar} disabled={sending} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: sending ? '#9ca3af' : '#d97706', color: 'white', fontSize: 13, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer' }}>
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function SectionTitle({ children, style }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, ...style }}>
      {children}
    </p>
  );
}

function FormLabel({ children }) {
  return <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 3, display: 'block' }}>{children}</label>;
}

function FormInput({ value, onChange, placeholder, maxLength }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #dde2f0', borderRadius: 8, fontSize: 13, color: '#1e2a4a', outline: 'none', boxSizing: 'border-box' }}
    />
  );
}
