/* global BigInt */
import { useState } from 'react';
import { supabase, compressFileIfPdf, sanitizeFileName } from './utils/supabase';

const BRAND = '#00208F';
const BUCKET = 'energia-facturas';
const PERIODOS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';

const num = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const eur = v => (v == null || isNaN(Number(v))) ? '—' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export function normalizaCups(c) {
  if (!c) return null;
  const s = String(c).toUpperCase().replace(/[\s-]/g, '');
  return /^ES\d{16}[A-Z]{2}(\d[FPCRXYZ])?$/.test(s) ? s : null;
}
export function cupsLetrasOk(c) {
  const s = normalizaCups(c);
  if (!s) return false;
  const r = Number(BigInt(s.slice(2, 18)) % 529n);
  return LETRAS[Math.floor(r / 23)] + LETRAS[r % 23] === s.slice(18, 20);
}

// precios en el formato que ya usa el comparador: termino_energia_pN / termino_potencia_pN
function preciosDesdeLineas(lineas) {
  const out = {};
  for (const l of lineas || []) {
    if (!l.periodo || l.periodo === 'unico' || l.precio_unitario == null) continue;
    if (l.tipo === 'energia') out[`termino_energia_${l.periodo}`] = l.precio_unitario;
    if (l.tipo === 'potencia') out[`termino_potencia_${l.periodo}`] = l.precio_unitario;
  }
  return out;
}

const lblSt = { fontSize: 11, fontWeight: 700, color: '#3A4058', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.5px' };
const boxSt = { border: '1.5px solid #C9CBD3', borderRadius: '14px 14px 14px 0', padding: 14, background: 'white' };

function Campo({ label, children }) {
  return <div><label style={lblSt}>{label}</label>{children}</div>;
}

/**
 * Sube una factura al bucket privado, la analiza con la Edge Function extract-invoice,
 * deja revisar los datos y, al confirmar, crea/enlaza contacto + suministro + factura
 * y actualiza el proceso.
 *
 * Props:
 *  - proceso: el proceso actual (o null si es nuevo)
 *  - ensureProceso(): async () => proceso   (crea el proceso si aún no existe)
 *  - contacts: lista de contactos del CRM
 *  - user
 *  - onApplied(procesoActualizado, contactoNuevo|null)
 */
export default function ExtraccionFactura({ proceso, ensureProceso, user, onApplied }) {
  const [fase, setFase] = useState('inicio'); // inicio | subiendo | analizando | revision | guardando | hecho
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);       // respuesta de la función
  const [archivo, setArchivo] = useState(null); // { path, mime }
  const [procId, setProcId] = useState(null);
  const [f, setF] = useState(null);           // formulario editable
  const [contactoModo, setContactoModo] = useState('nuevo'); // nuevo | existente
  const [contactoId, setContactoId] = useState('');
  const [revisado, setRevisado] = useState(false);
  const [forzarCups, setForzarCups] = useState(false);
  const [posibles, setPosibles] = useState([]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setPot = (k, v) => setF(x => ({ ...x, potencias: { ...x.potencias, [k]: v } }));

  const reset = () => { setFase('inicio'); setError(''); setRes(null); setArchivo(null); setF(null); setRevisado(false); setForzarCups(false); };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      setFase('subiendo');
      const rec = proceso || await ensureProceso();
      if (!rec) { setFase('inicio'); return; }
      setProcId(rec.id);

      const esPdf = file.type === 'application/pdf';
      const subir = esPdf ? await compressFileIfPdf(file) : file;
      const ext = esPdf ? 'pdf' : (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `procesos/${rec.id}/${Date.now()}_${sanitizeFileName(file.name).replace(/\.[^.]+$/, '')}.${ext}`;
      const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, subir, { contentType: subir.type || file.type, upsert: false });
      if (eUp) throw new Error(`No se pudo subir el archivo: ${eUp.message}`);
      setArchivo({ path, mime: subir.type || file.type });

      setFase('analizando');
      const { data, error: eFn } = await supabase.functions.invoke('extract-invoice', { body: { bucket: BUCKET, path } });
      if (eFn) {
        let msg = eFn.message;
        try { const j = await eFn.context?.json?.(); if (j?.error) msg = j.error; } catch (_) { /* sin cuerpo */ }
        throw new Error(msg);
      }
      if (!data?.datos) throw new Error(data?.error || 'Respuesta vacía');
      prepararRevision(data);
    } catch (err) {
      setError(err.message || String(err));
      setFase('inicio');
    }
  };

  const prepararRevision = (data) => {
    const d = data.datos;
    const sum = d.suministro || {};
    const pot = {}; PERIODOS.forEach(p => { pot[p] = sum.potencias_kw?.[p] ?? ''; });
    setRes(data);
    setF({
      nombre: d.titular?.nombre || '', nif: d.titular?.nif || '', direccionFiscal: d.titular?.direccion_fiscal || '',
      tipoCliente: /^[A-HJNPQRSUVW]/i.test(d.titular?.nif || '') ? 'empresa' : 'residencial',
      cups: sum.cups || '', tarifa: sum.tarifa_acceso || '2.0TD', distribuidora: sum.distribuidora || '', cnae: sum.cnae || '',
      direccion: sum.direccion || '', localidad: sum.localidad || '', provincia: sum.provincia || '', cp: sum.codigo_postal || '',
      potencias: pot,
      comercializadora: d.comercializadora?.nombre || '', producto: d.comercializadora?.producto || '',
      tipoProducto: d.comercializadora?.tipo_producto || 'desconocido',
      fechaFin: d.contrato?.fecha_fin || '', sinPenalizacionHasta: d.contrato?.sin_penalizacion_hasta || '',
      permanencia: d.contrato?.permanencia || 'desconocida',
      numero: d.factura?.numero || '', fechaEmision: d.factura?.fecha_emision || '',
      periodoInicio: d.factura?.periodo_inicio || '', periodoFin: d.factura?.periodo_fin || '', dias: d.factura?.dias ?? '',
      base: d.factura?.base_imponible ?? '', total: d.factura?.total ?? '',
    });
    setContactoModo('nuevo'); setContactoId(''); setPosibles([]);
    setFase('revision');
    buscarContactos(d.titular?.nif);
  };

  // Busca contactos con el mismo NIF/CIF (con la sesión del usuario, bajo RLS)
  const buscarContactos = async (nif) => {
    const n = String(nif || '').toUpperCase().replace(/[\s.-]/g, '');
    if (!n) return;
    const { data } = await supabase.from('contacts').select('id, name, dni_cif, empresa_cif').or(`dni_cif.ilike.${n},empresa_cif.ilike.${n}`).limit(5);
    if (data?.length) {
      setPosibles(data);
      if (data.length === 1) { setContactoModo('existente'); setContactoId(data[0].id); }
    }
  };

  const duplicada = !!res?.existente?.factura_duplicada;
  const cupsNorm = normalizaCups(f?.cups);
  const cupsRevisar = cupsNorm && !cupsLetrasOk(cupsNorm);
  const tarifaSoportada = ['2.0TD', '3.0TD', '6.1TD', '6.2TD', '6.3TD', '6.4TD'].includes(f?.tarifa);
  const puedeGuardar = fase === 'revision' && revisado && !duplicada && cupsNorm && tarifaSoportada && (!cupsRevisar || forzarCups)
    && (contactoModo === 'nuevo' ? !!f.nombre : !!contactoId);

  // Guarda contacto + suministro + factura + proceso en una sola transacción
  // (función energia_guardar_extraccion, migración 004): si algo falla no queda nada a medias.
  const guardar = async () => {
    setFase('guardando'); setError('');
    const d = res.datos;
    try {
      const esEmpresa = f.tipoCliente === 'empresa';
      const nombreCom = (f.comercializadora || '').trim();
      let comercId = null;
      if (nombreCom) {
        const { data: comerc } = await supabase.from('energia_comercializadoras').select('id').ilike('nombre', `%${nombreCom}%`).limit(1);
        comercId = comerc?.[0]?.id || null;
      }

      const pot = {}; PERIODOS.forEach(p => { pot[p] = num(f.potencias[p]); });
      const consumos = {}, maxim = {};
      PERIODOS.forEach(p => { if (d.consumos_kwh?.[p] != null) consumos[p] = d.consumos_kwh[p]; if (d.maximetros_kw?.[p] != null) maxim[p] = d.maximetros_kw[p]; });
      const lineas = d.lineas || [];
      const suma = tipo => lineas.filter(l => l.tipo === tipo).reduce((s, l) => s + (Number(l.importe) || 0), 0);
      const sumaPuntual = lineas.filter(l => l.recurrente === false).reduce((s, l) => s + (Number(l.importe) || 0), 0);
      const base = num(f.base);

      // URL firmada (1 año): mantiene vivo el envío existente al partner (n8n) con el bucket privado.
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(archivo.path, 60 * 60 * 24 * 365);

      const p = {
        proceso_id: procId,
        contact_id: contactoModo === 'existente' ? contactoId : null,
        contacto: contactoModo === 'nuevo' ? {
          name: f.nombre, tipo_cliente: esEmpresa ? 'empresa' : 'particular', comercial_id: user.id,
          dni_cif: esEmpresa ? null : f.nif || null,
          direccion: f.direccionFiscal || null, localidad: f.localidad || null, provincia: f.provincia || null, codigo_postal: f.cp || null,
          ...(esEmpresa ? { empresa: f.nombre, empresa_razon_social: f.nombre, empresa_cif: f.nif || null, empresa_direccion: f.direccionFiscal || null } : {}),
        } : null,
        suministro: {
          codigo_cups: cupsNorm, titular: f.nombre || null, nif: f.nif || null, direccion: f.direccion || null,
          poblacion: f.localidad || null, provincia: f.provincia || null, codigo_postal: f.cp || null,
          tarifa: f.tarifa, distribuidora: f.distribuidora || null, cnae: f.cnae || null, direccion_fiscal: f.direccionFiscal || null,
          tipo_cliente: f.tipoCliente, comercializadora_actual_id: comercId, producto_actual: f.producto || null,
          tipo_producto: f.tipoProducto, permanencia: f.permanencia, permanencia_hasta: f.sinPenalizacionHasta || null,
          fecha_fin_contrato: f.fechaFin || null, fecha_fin_origen: f.fechaFin ? 'factura' : null,
        },
        factura: {
          numero_factura: f.numero || null, fecha_factura: f.fechaEmision || null,
          periodo_inicio: f.periodoInicio || null, periodo_fin: f.periodoFin || null, dias: num(f.dias),
          importe_total: num(f.total), base_imponible: base, iva_importe: d.factura?.iva_importe ?? null,
          importe_recurrente: base == null ? null : Math.round((base - sumaPuntual) * 100) / 100,
          potencias_contratadas: pot, consumos, maximetros: maxim, precios: preciosDesdeLineas(lineas), lineas,
          alquiler_equipo: suma('alquiler_equipo'), bono_social: suma('bono_social'),
          comercializadora_id: comercId, comercializadora_nombre: nombreCom || null, producto: f.producto || null,
          lectura_estimada: !!d.factura?.lectura_estimada, idioma: d.idioma || null, confianza: d.confianza ?? null,
          extraccion: { datos: d, avisos: res.avisos }, archivo_bucket: BUCKET, archivo_path: archivo.path,
        },
        proceso: {
          tarifa_actual: f.tarifa, comercializadora_actual: nombreCom || null,
          direccion_suministro: [f.direccion, f.cp, f.localidad].filter(Boolean).join(', ') || null,
          factura_url: signed?.signedUrl || null,
        },
      };

      const { data: r, error: eG } = await supabase.rpc('energia_guardar_extraccion', { p });
      if (eG) {
        if (/energia_facturas_cups_numero_uq/.test(eG.message)) throw new Error('Esta factura ya está cargada en el CRM.');
        throw new Error(eG.message);
      }

      const { data: upd, error: eP } = await supabase.from('energia_procesos')
        .select('*, contacts(name, phone), users(name)').eq('id', procId).single();
      if (eP) throw new Error(`Proceso: ${eP.message}`);

      onApplied(upd, r?.contacto_nuevo ? { id: r.contact_id, name: f.nombre, phone: null } : null);
      setFase('hecho');
    } catch (err) {
      setError(err.message || String(err));
      setFase('revision');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (fase === 'inicio' || fase === 'subiendo' || fase === 'analizando' || fase === 'hecho') {
    return (
      <div style={boxSt}>
        <p style={{ fontSize: 13, fontWeight: 800, color: BRAND, marginBottom: 6 }}>🔎 Analizar factura con IA</p>
        <p style={{ fontSize: 12, color: '#8A8FA3', marginBottom: 10 }}>
          Sube la factura de luz (PDF o foto). Se leen cliente, CUPS, tarifa, potencias, precios y vencimiento, y tú revisas antes de guardar nada.
        </p>
        {fase === 'hecho' && <p style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginBottom: 8 }}>✅ Factura analizada y guardada. Contacto, suministro y factura quedan enlazados.</p>}
        <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" disabled={fase === 'subiendo' || fase === 'analizando'} onChange={onFile} />
        {fase === 'subiendo' && <p style={{ fontSize: 12, color: '#8A8FA3', marginTop: 6 }}>Subiendo archivo…</p>}
        {fase === 'analizando' && <p style={{ fontSize: 12, color: '#8A8FA3', marginTop: 6 }}>Leyendo la factura… (10–40 s)</p>}
        {error && <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginTop: 8 }}>❌ {error}</p>}
      </div>
    );
  }

  const errores = (res.avisos || []).filter(a => a.nivel === 'error');
  const avisos = (res.avisos || []).filter(a => a.nivel !== 'error');
  const lineas = res.datos.lineas || [];

  return (
    <div style={{ ...boxSt, borderColor: BRAND }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: BRAND, marginBottom: 10 }}>Revisa los datos leídos</p>

      {duplicada && <p style={{ background: '#fee2e2', color: '#b91c1c', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Esta factura ya está cargada en el CRM. No se puede guardar otra vez.</p>}
      {errores.map((a, i) => <p key={i} style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 12px', borderRadius: 8, fontSize: 12, marginBottom: 6 }}>⛔ {a.mensaje}</p>)}
      {avisos.map((a, i) => <p key={i} style={{ background: '#fffbeb', color: '#92400e', padding: '6px 12px', borderRadius: 8, fontSize: 12, marginBottom: 6 }}>⚠️ {a.mensaje}</p>)}

      <h4 style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', margin: '14px 0 8px' }}>Cliente</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Nombre / razón social"><input className="fi" value={f.nombre} onChange={e => set('nombre', e.target.value)} /></Campo>
        <Campo label="NIF / CIF"><input className="fi" value={f.nif} onChange={e => set('nif', e.target.value)} /></Campo>
        <Campo label="Tipo de cliente">
          <select className="fi" value={f.tipoCliente} onChange={e => set('tipoCliente', e.target.value)}>
            <option value="residencial">Particular / autónomo</option><option value="empresa">Empresa</option>
          </select>
        </Campo>
        <Campo label="Dirección fiscal"><input className="fi" value={f.direccionFiscal} onChange={e => set('direccionFiscal', e.target.value)} /></Campo>
      </div>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <label style={{ marginRight: 16 }}>
          <input type="radio" checked={contactoModo === 'nuevo'} onChange={() => setContactoModo('nuevo')} /> Crear contacto nuevo
        </label>
        {posibles.length > 0 && (
          <label>
            <input type="radio" checked={contactoModo === 'existente'} onChange={() => { setContactoModo('existente'); if (!contactoId) setContactoId(posibles[0].id); }} /> Usar contacto existente
          </label>
        )}
        {contactoModo === 'existente' && (
          <select className="fi" style={{ marginTop: 6, maxWidth: 420 }} value={contactoId} onChange={e => setContactoId(e.target.value)}>
            {posibles.map(c => <option key={c.id} value={c.id}>{c.name} · {c.dni_cif || c.empresa_cif}</option>)}
          </select>
        )}
        {posibles.length === 0 && <span style={{ fontSize: 12, color: '#8A8FA3' }}> (no hay ningún contacto con ese NIF/CIF)</span>}
      </div>

      <h4 style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', margin: '16px 0 8px' }}>
        Suministro {res.existente?.suministros?.length ? '· ya existe, se actualizará' : '· nuevo'}
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="CUPS"><input className="fi" value={f.cups} onChange={e => set('cups', e.target.value)} /></Campo>
        <Campo label="Tarifa de acceso">
          <select className="fi" value={f.tarifa} onChange={e => set('tarifa', e.target.value)}>
            {['2.0TD', '3.0TD', '6.1TD', '6.2TD', '6.3TD', '6.4TD', 'otra'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo label="Dirección del suministro"><input className="fi" value={f.direccion} onChange={e => set('direccion', e.target.value)} /></Campo>
        <Campo label="Localidad"><input className="fi" value={f.localidad} onChange={e => set('localidad', e.target.value)} /></Campo>
        <Campo label="Provincia"><input className="fi" value={f.provincia} onChange={e => set('provincia', e.target.value)} /></Campo>
        <Campo label="Código postal"><input className="fi" value={f.cp} onChange={e => set('cp', e.target.value)} /></Campo>
        <Campo label="Distribuidora"><input className="fi" value={f.distribuidora} onChange={e => set('distribuidora', e.target.value)} /></Campo>
        <Campo label="CNAE"><input className="fi" value={f.cnae} onChange={e => set('cnae', e.target.value)} /></Campo>
      </div>
      {!tarifaSoportada && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>Elige la tarifa de acceso que figura en la factura.</p>}
      {cupsRevisar && (
        <label style={{ display: 'block', fontSize: 12, color: '#92400e', marginTop: 8 }}>
          <input type="checkbox" checked={forzarCups} onChange={e => setForzarCups(e.target.checked)} /> Las letras de control del CUPS no cuadran; lo he comprobado con la factura y es correcto.
        </label>
      )}

      <h4 style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', margin: '16px 0 8px' }}>Potencia contratada (kW)</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {PERIODOS.map(p => (
          <Campo key={p} label={p.toUpperCase()}><input className="fi" type="number" step="0.001" value={f.potencias[p]} onChange={e => setPot(p, e.target.value)} /></Campo>
        ))}
      </div>

      <h4 style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', margin: '16px 0 8px' }}>Contrato actual</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Comercializadora"><input className="fi" value={f.comercializadora} onChange={e => set('comercializadora', e.target.value)} /></Campo>
        <Campo label="Producto"><input className="fi" value={f.producto} onChange={e => set('producto', e.target.value)} /></Campo>
        <Campo label="Tipo de precio">
          <select className="fi" value={f.tipoProducto} onChange={e => set('tipoProducto', e.target.value)}>
            <option value="desconocido">Desconocido</option><option value="fijo">Fijo</option><option value="indexado">Indexado</option>
          </select>
        </Campo>
        <Campo label="Permanencia">
          <select className="fi" value={f.permanencia} onChange={e => set('permanencia', e.target.value)}>
            <option value="desconocida">Desconocida</option><option value="sin_permanencia">Sin permanencia</option><option value="con_permanencia">Con permanencia</option>
          </select>
        </Campo>
        <Campo label="Fecha fin de contrato (según factura)"><input className="fi" type="date" value={f.fechaFin} onChange={e => set('fechaFin', e.target.value)} /></Campo>
        <Campo label="Sin penalización hasta"><input className="fi" type="date" value={f.sinPenalizacionHasta} onChange={e => set('sinPenalizacionHasta', e.target.value)} /></Campo>
      </div>
      {res.datos.contrato?.texto_origen && <p style={{ fontSize: 11, color: '#8A8FA3', marginTop: 6 }}>Texto de la factura: «{res.datos.contrato.texto_origen}»</p>}

      <h4 style={{ fontSize: 11, fontWeight: 800, color: BRAND, textTransform: 'uppercase', margin: '16px 0 8px' }}>Factura</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Campo label="Nº factura"><input className="fi" value={f.numero} onChange={e => set('numero', e.target.value)} /></Campo>
        <Campo label="Fecha emisión"><input className="fi" type="date" value={f.fechaEmision} onChange={e => set('fechaEmision', e.target.value)} /></Campo>
        <Campo label="Días"><input className="fi" type="number" value={f.dias} onChange={e => set('dias', e.target.value)} /></Campo>
        <Campo label="Periodo desde"><input className="fi" type="date" value={f.periodoInicio} onChange={e => set('periodoInicio', e.target.value)} /></Campo>
        <Campo label="Periodo hasta"><input className="fi" type="date" value={f.periodoFin} onChange={e => set('periodoFin', e.target.value)} /></Campo>
        <Campo label="Base imponible (€)"><input className="fi" type="number" step="0.01" value={f.base} onChange={e => set('base', e.target.value)} /></Campo>
        <Campo label="Total (€)"><input className="fi" type="number" step="0.01" value={f.total} onChange={e => set('total', e.target.value)} /></Campo>
      </div>

      {lineas.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: '#8A8FA3' }}><th>Concepto</th><th>Periodo</th><th>Cantidad</th><th>Precio</th><th style={{ textAlign: 'right' }}>Importe</th><th>Tipo</th></tr></thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} style={{ borderTop: '1px solid #F0EEE8' }}>
                  <td>{l.concepto}</td><td>{l.periodo || ''}</td><td>{l.cantidad ?? ''} {l.unidad || ''}</td><td>{l.precio_unitario ?? ''}</td>
                  <td style={{ textAlign: 'right' }}>{eur(l.importe)}</td>
                  <td>{l.recurrente === false ? 'puntual' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: '#8A8FA3', marginTop: 4 }}>
            Las líneas se guardan tal cual las leyó la IA. Recurrente sin cargos puntuales: {eur(res.datos._calculo?.importe_recurrente)}.
          </p>
        </div>
      )}

      {error && <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginTop: 10 }}>❌ {error}</p>}

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginTop: 14 }}>
        <input type="checkbox" checked={revisado} onChange={e => setRevisado(e.target.checked)} /> He comparado los datos con la factura
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-g" disabled={!puedeGuardar || fase === 'guardando'} onClick={guardar}
          style={!puedeGuardar ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
          {fase === 'guardando' ? 'Guardando…' : '💾 Confirmar y guardar'}
        </button>
        <button onClick={reset} disabled={fase === 'guardando'}
          style={{ padding: '9px 16px', borderRadius: '14px 14px 14px 0', border: '1.5px solid #C9CBD3', background: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
