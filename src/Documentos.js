import { MANDATO_HTML, DESISTIMIENTO_HTML, ARRAS_HTML } from './mandatoPlantillas';

const BRAND = '#00208F';
const HUECO = '<span style="display:inline-block;min-width:38mm;border-bottom:.6pt dotted #5B6178">&nbsp;</span>';
const HUECO_C = '<span style="display:inline-block;min-width:14mm;border-bottom:.6pt dotted #5B6178">&nbsp;</span>';
const CAJA = '<b style="display:inline-block;width:3.6mm;height:3.6mm;border:.75pt solid #0B1233;border-radius:.6mm;margin-right:2mm;vertical-align:-.6mm"></b>';

// Convierte una plantilla con marcadores {{…}} en un modelo en blanco
const EMPRESA = 'Que Necesitas Hoy Servicios e Inversiones S.L.';
const empresa = h => h
  .replace(/Qué necesitas hoy es una marca de Gespronet Axencia de Marketing e Deseño, S\.L\./g, EMPRESA)
  .replace(/Gespronet Axencia de Marketing e Deseño, S\.L\./g, EMPRESA)
  .replace(/CIF B75490136 · /g, '')
  .replace(/, CIF B75490136,/g, ',')
  .replace('</head>', '<style>p,.cl p,.caja p{text-align:justify;hyphens:auto;-webkit-hyphens:auto}</style></head>');

function enBlanco(html, cortos = []) {
  return empresa(html)
    .replace(/\{\{#([a-z_.]+)\}\}✓\{\{\/\1\}\}/g, '')                       // casillas → vacías
    .replace(/\{\{#[a-z_.]+\}\}([\s\S]*?)\{\{\/[a-z_.]+\}\}/g, '$1')          // bloques condicionales → visibles
    .replace(/\{\{([a-z_.]+)\}\}/g, (_, k) => cortos.includes(k) ? HUECO_C : HUECO);
}

const BANDA = (txt) => `<div style="background:#FFB81C;color:#0B1233;font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;padding:2.5mm 4mm;border-radius:3mm 3mm 3mm 0;margin:0 0 5mm">${txt}</div>`;

function mandatoBorrador() {
  let h = MANDATO_HTML;
  // Resumen: modalidad con las dos opciones
  h = h.replace('<span class="big">{{mandato.modalidad}}</span>',
    `<span style="display:flex;flex-direction:column;gap:1mm;font-size:9.5pt;color:#0B1233;font-weight:500"><span>${CAJA}En exclusiva</span><span>${CAJA}Sin exclusiva</span></span>`);
  // Cláusula 03 con las dos modalidades
  h = h.replace(
    'En régimen de exclusiva, durante su vigencia la Propiedad no encargará la venta a otra agencia ni la anunciará por su cuenta, y derivará a Qué necesitas hoy a cualquier interesado que contacte directamente con ella.</p>',
    `La Propiedad elige una de estas dos modalidades:</p>
<div style="display:flex;flex-direction:column;gap:2.5mm;margin-top:2.5mm">
  <div class="caja" style="padding:3mm 4mm"><p style="color:#0B1233"><b>${CAJA}Opción A · En exclusiva.</b> Durante la vigencia del mandato, la Propiedad no encargará la venta a otra agencia ni la anunciará por su cuenta, y derivará a Qué necesitas hoy a cualquier interesado que contacte directamente con ella. A cambio, Qué necesitas hoy dedica al inmueble su plan completo de promoción (reportaje profesional, publicación destacada en portales, campañas en redes y base de compradores).</p></div>
  <div class="caja" style="padding:3mm 4mm"><p style="color:#0B1233"><b>${CAJA}Opción B · Sin exclusiva.</b> La Propiedad puede vender el inmueble por sí misma o encargar su venta a otras agencias. Qué necesitas hoy solo cobrará honorarios si la venta se realiza con un comprador presentado por ella. La Propiedad se compromete a avisar por escrito si el inmueble se vende o se retira de la venta.</p></div>
</div><p>`);
  // Cláusula 05: aclarar que la última frase solo aplica a la exclusiva
  h = h.replace('Lo mismo ocurre si, durante la exclusiva, la Propiedad vende',
    'En la modalidad en exclusiva (opción A), también se devengarán si, durante la vigencia del mandato, la Propiedad vende');
  h = enBlanco(h, ['mandato.duracion_meses', 'mandato.honorarios_pct', 'mandato.meses_proteccion', 'mandato.dias_informe']);
  h = h.replace('<title>Mandato de venta · ' + HUECO + '</title>', '<title>Mandato de venta · Borrador informativo</title>');
  h = h.replace('<div class="eyebrow"', `${BANDA('Borrador informativo · Documento sin valor contractual hasta su firma')}<div class="eyebrow"`);
  return h;
}

const MODELOS = [
  {
    id: 'mandato', cat: 'Inmobiliaria', icon: '🏠', titulo: 'Mandato de venta (borrador para cliente)',
    desc: 'Modelo en blanco para que el propietario lo lea antes de firmar. Incluye las dos modalidades: en exclusiva y sin exclusiva.',
    html: mandatoBorrador, nombre: 'Mandato_venta_borrador_QueNecesitasHoy',
  },
  {
    id: 'desistimiento', cat: 'Inmobiliaria', icon: '↩️', titulo: 'Formulario de desistimiento',
    desc: 'Formulario para que un particular anule el mandato en los 14 días siguientes a la firma.',
    html: () => enBlanco(DESISTIMIENTO_HTML), nombre: 'Formulario_desistimiento_QueNecesitasHoy',
  },
  {
    id: 'arras', cat: 'Inmobiliaria', icon: '🤝', titulo: 'Contrato de arras (modelo)',
    desc: 'Modelo en blanco de contrato de arras para revisar con comprador y vendedor.',
    html: () => enBlanco(ARRAS_HTML), nombre: 'Contrato_arras_modelo_QueNecesitasHoy',
  },
];

function abrir(m, imprimir) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permite las ventanas emergentes para ver el documento'); return; }
  w.document.open(); w.document.write(m.html()); w.document.close();
  if (imprimir) setTimeout(() => { w.focus(); w.print(); }, 900);
}

function descargarWord(m) {
  const html = m.html().replace(/position:fixed/g, 'position:static');
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m.nombre + '.doc'; a.click();
}

export default function Documentos() {
  const cats = [...new Set(MODELOS.map(m => m.cat))];
  const btn = (bg, c) => ({ padding: '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: bg, color: c });
  return (
    <div style={{ padding: '18px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: BRAND, margin: '0 0 4px' }}>📁 Documentos</h1>
      <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>Modelos de contrato para enseñar o enviar a clientes. Para generar un documento con los datos ya rellenos, hazlo desde la ficha del inmueble.</p>
      {cats.map(cat => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{cat}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {MODELOS.filter(m => m.cat === cat).map(m => (
              <div key={m.id} style={{ background: 'white', borderRadius: '16px 16px 16px 0', boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 26 }}>{m.icon}</div>
                <div style={{ fontWeight: 800, color: '#0B1233' }}>{m.titulo}</div>
                <div style={{ fontSize: 13, color: '#64748b', flex: 1 }}>{m.desc}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={btn('#eef0f6', '#334')} onClick={() => abrir(m, false)}>👁 Ver</button>
                  <button style={btn(BRAND, 'white')} onClick={() => abrir(m, true)}>⬇ PDF</button>
                  <button style={btn('#eef0f6', '#334')} onClick={() => descargarWord(m)}>📝 Word</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
