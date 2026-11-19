import { useState, useEffect } from "react";
import logo from "./Que Necesitas - Logo para web y Favicon.png";
import isotipo from "./assets/isotipo.svg";
import logoNeg from "./assets/logo-principal-negativo.svg";
import { supabase, sanitizeFileName, compressFileIfPdf } from "./utils/supabase";
import { ContactQuotes } from "./Productos";
import EnergiaSection from "./EnergiaSection";
import Llamadas from "./Llamadas";
import Contabilidad from "./Contabilidad";
import Documentos from "./Documentos";
import Objetivos from "./Objetivos";
import AlarmaSection from "./AlarmaSection";
import Inmobiliaria from "./Inmobiliaria";
import VentaDirecta from "./VentaDirecta";
import MiSemana from './MiSemana';
import NPL from './NPL';
import TelefoniaSection from './TelefoniaSection';

const BRAND = "#00208F";
const BRAND_LIGHT = "#DCE3FF";

const LINEAS = {
  alarmas:       { label:"🔐 Alarmas",        color:"#dc2626", light:"#fef2f2" },
  energia:       { label:"⚡ Energía",        color:"#d97706", light:"#fffbeb" },
  telefonia:     { label:"📱 Telefonía",      color:"#7c3aed", light:"#f5f3ff" },
  inmobiliaria:  { label:"🏠 Inmobiliaria",   color:"#059669", light:"#ecfdf5" },
  venta_directa: { label:"🏷️ Venta Directa",  color:"#0891b2", light:"#ecfeff" },
  npl:           { label:"📊 NPL",            color:"#1d4ed8", light:"#eff6ff" },
};

const COLAB_TIPOS = {
  captador:          { label:"Captador",          color:"#059669", light:"#d1fae5" },
  comercial_externo: { label:"Comercial externo",  color:"#2563eb", light:"#dbeafe" },
  partner:           { label:"Partner",            color:"#7c3aed", light:"#ede9fe" },
  asesor:            { label:"Asesor",             color:"#d97706", light:"#fef3c7" },
};

const ETAPAS = {
  alarmas:       ["prospecto","contacto","visita","propuesta","contrato","instalado","perdido"],
  energia:       ["factura_recibida","enviada_partner","opciones_recibidas","seleccionada","docs_solicitados","contratado","seguimiento"],
  telefonia:     ["prospecto","documentacion","enviado_operador","en_tramite","activo","incidencia","baja"],
  inmobiliaria:  ["captación","en_venta","reservado","arras","vendido"],
  venta_directa: ["identificado","análisis","propuesta","negociación","docs_solicitados","cerrado","perdido"],
  npl:           ["identificado","análisis","oferta_enviada","negociación","cerrado","descartado"],
};

const ETAPA_LABELS = {
  reservado:"Reservado", en_venta:"En venta", arras:"Contrato arras", vendido:"Vendido ✓",
  prospecto:"Prospecto", contacto:"Contacto", visita:"Visita", propuesta:"Propuesta",
  contrato:"Contrato", instalado:"Instalado ✓", perdido:"Perdido ✗",
  análisis:"Análisis", firmado:"Firmado", activo:"Activo ✓",
  captación:"Captación", valoración:"Valoración", publicado:"Publicado",
  oferta:"Oferta", cerrado:"Cerrado ✓",
  inversor:"Inversor", búsqueda:"Búsqueda", contacto_judicial:"Contacto Judicial",
  due_diligence:"Due Diligence", puja:"Puja", adjudicado:"Adjudicado ✓",
};

const INTERACTION_TIPOS = ["llamada","visita","email","reunión","whatsapp","seguimiento","otro"];
const INTERACTION_ICONS = { llamada:"📞", visita:"🚗", email:"📧", reunión:"🤝", whatsapp:"💬", seguimiento:"🔄", otro:"📝" };

function genId() { return crypto.randomUUID(); }
function today() { return new Date().toISOString().split("T")[0]; }
function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = d => d.toISOString().split("T")[0];
  return { start: fmt(mon), end: fmt(sun) };
}

// Convierte snake_case de Supabase a camelCase para el JS
const toCamel = (obj) => {
  if (!obj) return obj;
  const map = {
    linea_permisos:  "lineaPermisos",
    manager_id:      "managerId",
    comercial_id:    "comercialId",
    contact_id:      "contactId",
    deal_id:         "dealId",
    created_at:      "createdAt",
    updated_at:      "updatedAt",
    weekly_plan_id:  "weeklyPlanId",
    dni_cif:         "dniCif",
    codigo_postal:   "codigoPostal",
    storage_path:    "storagePath",
    descripcion_rol: "descripcionRol",
    auth_id:         "authId",
  };
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [map[k] || k, v]));
};

// Convierte camelCase de JS a snake_case para Supabase
const toSnake = (obj) => {
  if (!obj) return obj;
  const map = {
    lineaPermisos: "linea_permisos",
    managerId:     "manager_id",
    comercialId:   "comercial_id",
    contactId:     "contact_id",
    dealId:        "deal_id",
    createdAt:     "created_at",
    updatedAt:     "updated_at",
    weeklyPlanId:  "weekly_plan_id",
    dniCif:        "dni_cif",
    codigoPostal:  "codigo_postal",
    storagePath:   "storage_path",
    descripcionRol:"descripcion_rol",
    authId:        "auth_id",
  };
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [map[k] || k, v]));
};

// Normaliza el campo linea a array siempre.
// Maneja: null → [], array → array, string "energia" → ["energia"],
// formato PostgreSQL "{energia,alarmas}" → ["energia","alarmas"]
const parseLinea = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') {
    if (v.startsWith('{')) return v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    return [v];
  }
  return [];
};

export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  .crm-root{font-family:'DM Sans',system-ui,sans-serif;display:flex;height:100vh;overflow:hidden;background:#F6F5F1;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-thumb{background:#C9CBD3;border-radius:3px;}
  input,select,textarea,button{font-family:'DM Sans',system-ui,sans-serif;}
  :root{--q-blue:#00208F;--q-blue-2:#1A38A8;--q-blue-3:#3D5BFF;--q-blue-l:#DCE3FF;--q-amber:#FFB81C;--q-ink:#0B1233;--q-body:#3A4058;--q-sec:#5B6178;--q-ph:#8A8FA3;--q-bg:#F6F5F1;--q-line:#C9CBD3;--q-div:#E4E2DA;}
  body{background:#F6F5F1;color:#3A4058;}
  .crm-root{color:#3A4058;font-size:14px;line-height:1.5;}
  .crm-root h1{font-family:'Poppins',sans-serif!important;font-weight:700!important;letter-spacing:-.03em!important;color:#0B1233!important;font-size:32px!important;line-height:1.15;}
  .crm-root h2,.crm-root h3{font-family:'Poppins',sans-serif;letter-spacing:-.02em;}
  .crm-root h3{color:#0B1233!important;text-transform:none!important;font-size:16px!important;font-weight:700!important;letter-spacing:-.02em!important;}
  .crm-root th{font-family:'JetBrains Mono',monospace!important;font-size:10.5px!important;text-transform:uppercase;letter-spacing:.08em!important;color:#5B6178!important;font-weight:500!important;background:transparent!important;border-bottom:1px solid #E4E2DA!important;}
  .crm-root td{border-color:#E4E2DA!important;}
  .mono{font-family:'JetBrains Mono',monospace;}
  .eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#00208F;font-weight:500;margin-bottom:6px;}
  .card{background:white;border-radius:20px 20px 20px 0;border:1px solid #E4E2DA;box-shadow:none;}
  .btn-p{background:#00208F;color:white;border:none;padding:10px 18px;border-radius:14px 14px 14px 0;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s;}
  .btn-p:hover{background:#1A38A8;}
  .btn-p:focus-visible,.btn-g:focus-visible{outline:none;box-shadow:0 0 0 4px #DCE3FF;}
  .btn-a{background:#FFB81C;color:#0B1233;border:none;padding:10px 18px;border-radius:14px 14px 14px 0;font-size:14px;font-weight:700;cursor:pointer;transition:filter .15s;}
  .btn-a:hover{filter:brightness(.95);}
  .btn-g{background:white;border:1.5px solid #C9CBD3;padding:8px 14px;border-radius:14px 14px 14px 0;font-size:13px;font-weight:500;color:#0B1233;cursor:pointer;transition:all .15s;}
  .btn-g:hover{border-color:#00208F;color:#00208F;}
  .fi{width:100%;padding:10px 14px;border:1.5px solid #C9CBD3;border-radius:14px 14px 14px 0;font-size:14px;outline:none;transition:border .15s,box-shadow .15s;color:#0B1233;background:white;}
  .fi::placeholder{color:#8A8FA3;}
  .fi:focus{border-color:#00208F;box-shadow:0 0 0 4px #DCE3FF;}
  .fl{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:500;color:#5B6178;margin-bottom:6px;display:block;text-transform:uppercase;letter-spacing:.08em;}
  .nav{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px 14px 14px 0;cursor:pointer;transition:background .15s;font-size:14px;font-weight:500;color:#DCE3FF;border:none;background:none;width:100%;text-align:left;}
  .nav .dot{width:10px;height:10px;border-radius:50% 50% 50% 0;background:#3D5BFF;flex-shrink:0;}
  .nav:hover{background:rgba(255,255,255,.07);color:white;}
  .nav.on{background:#1A38A8;color:white;font-weight:700;}
  .nav.on .dot{background:#FFB81C;}
  .side-sec{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.08em;color:#8FA2F0;padding:18px 12px 6px;text-transform:uppercase;}
  .tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:8px 8px 8px 0;font-size:11.5px;font-weight:700;}
  .kc{flex:0 0 220px;background:#EFEDE6;border-radius:20px 20px 20px 0;padding:12px;}
  .kcard{background:white;border-radius:14px 14px 14px 0;padding:12px;margin-bottom:8px;border:1px solid #E4E2DA;cursor:grab;transition:border-color .15s;border-left:3px solid transparent;}
  .kcard:hover{border-color:#00208F;}
  .mb{position:fixed;inset:0;background:rgba(11,18,51,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;}
  .mo{background:white;border-radius:24px 24px 24px 0;padding:28px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;}
  .mo-lg{max-width:780px;}
  .tr{transition:background .15s;}
  .tr:hover{background:#DCE3FF!important;}
  .tab{padding:7px 14px;border-radius:14px 14px 14px 0;border:none;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;}
  .tab.on{background:#0B1233;color:white;}
  .tab:not(.on){background:white;color:#3A4058;box-shadow:inset 0 0 0 1.5px #E4E2DA;}
  .ii{border-left:3px solid #00208F;padding:12px 16px;border-radius:0 14px 14px 0;margin-bottom:8px;background:white;}
  .sc{background:white;border-radius:20px 20px 20px 0;padding:20px;border:1px solid #E4E2DA;border-left-width:1px!important;border-left-color:#E4E2DA!important;}
  .sc > div:last-child{font-family:"JetBrains Mono",monospace;font-size:10.5px!important;text-transform:uppercase;letter-spacing:.08em;color:#5B6178!important;margin-top:6px!important;}
  .sc:first-child{background:#00208F;border-color:#00208F!important;}
  .sc:first-child *{color:white!important;}
  .topbar{display:flex;align-items:center;gap:16px;padding:18px 40px;border-bottom:1px solid #E4E2DA;background:#F6F5F1;position:sticky;top:0;z-index:50;}
  .topbar .search{flex:1;max-width:460px;}

  /* ══ RESPONSIVE ══════════════════════════════════════════════════════════
     Mobile < 768px  |  Tablet 768-1023px  |  Desktop ≥ 1024px
  ══════════════════════════════════════════════════════════════════════════ */

  /* Elementos base (estado inicial para desktop) */
  .mob-header{display:none;position:sticky;top:0;z-index:200;background:#00208F;color:white;border-bottom:1px solid #E4E2DA;padding:11px 16px;align-items:center;gap:12px;flex-shrink:0;}
  .crm-sidebar{transition:transform .25s,width .3s;}
  .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:298;cursor:pointer;}
  .sidebar-label{transition:opacity .2s;}
  .contact-cards{display:none;}
  .contact-table{display:block;}
  .kanban-mob-sel{display:none;margin-bottom:14px;gap:10px;align-items:center;}
  .kanban-full{display:flex;gap:10px;overflow-x:auto;padding-bottom:10px;}
  .kanban-mob-col{display:none;}
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;}

  /* ── Móvil (< 768px) ──────────────────────────────────────────────── */
  @media(max-width:767px){
    .crm-root{flex-direction:column;overflow:hidden;}
    .crm-sidebar{position:fixed!important;top:0!important;left:0!important;height:100dvh!important;width:240px!important;z-index:299!important;transform:translateX(-100%);overflow-y:auto;overflow-x:hidden;}
    .crm-sidebar.mob-open{transform:translateX(0)!important;box-shadow:6px 0 32px rgba(0,35,146,.25)!important;}
    .sidebar-overlay.mob-open{display:block!important;}
    .mob-header{display:flex!important;}
    .crm-main{flex:1;overflow:auto;display:flex;flex-direction:column;}
    .crm-main-inner{padding:14px 14px 80px!important;}
    .desk-hamburger{display:none!important;}

    /* Contactos: tarjetas en lugar de tabla */
    .contact-table{display:none!important;}
    .contact-cards{display:flex!important;flex-direction:column;gap:10px;}

    /* Modales → bottom-sheet */
    .mb{padding:0!important;align-items:flex-end!important;}
    .mo{border-radius:24px 24px 0 0!important;max-width:100%!important;width:100%!important;max-height:93dvh!important;padding:20px 16px 28px!important;}
    .mo-lg{max-width:100%!important;}

    /* Tabs → scroll horizontal */
    .tabs-scroll{overflow-x:auto!important;flex-wrap:nowrap!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px;gap:6px!important;}
    .tabs-scroll::-webkit-scrollbar{display:none;}
    .tabs-scroll .tab{flex-shrink:0!important;}

    /* Dashboard métricas: 2×2 */
    .stats-grid{grid-template-columns:1fr 1fr!important;gap:10px!important;}
    .dash-grid{grid-template-columns:1fr!important;}
    .week-grid{grid-template-columns:1fr!important;}
    .mandato-grid{grid-template-columns:1fr!important;}

    /* Pipeline kanban → selector de columna */
    .kanban-mob-sel{display:flex!important;}
    .kanban-full{display:none!important;}
    .kanban-mob-col{display:block!important;width:100%;}

    /* Botones táctiles */
    .btn-p{min-height:44px;padding:10px 18px!important;font-size:14px!important;}
    .btn-g{min-height:40px;}

    /* Prevenir zoom en iOS al enfocar inputs */
    .fi{font-size:16px!important;}
    input.fi,select.fi,textarea.fi{font-size:16px!important;}

    /* ContactDetail: acciones en columna */
    .cd-actions{flex-wrap:wrap!important;justify-content:stretch!important;}
    .cd-actions .btn-p,.cd-actions .btn-g{flex:1!important;min-width:120px;justify-content:center;display:flex;align-items:center;gap:5px;}

    /* Formulario: columna única */
    .form-grid{grid-template-columns:1fr!important;}
    .form-gcol2{grid-column:span 1!important;}

    /* Ficha info grid */
    .info-grid{grid-template-columns:1fr 1fr!important;}
  }

  /* ── Tablet (768px – 1023px) ─────────────────────────────────────── */
  @media(min-width:768px) and (max-width:1023px){
    .crm-sidebar{width:64px!important;overflow:hidden!important;}
    .sidebar-label{display:none!important;}
    .sidebar-logo-text{display:none!important;}
    .crm-main-inner{padding:16px 18px!important;}
    /* Contactos: grid 2 col */
    .contact-table{display:none!important;}
    .contact-cards{display:grid!important;grid-template-columns:1fr 1fr;gap:12px!important;}
    .stats-grid{grid-template-columns:1fr 1fr!important;gap:10px!important;}
    .kc{flex:0 0 190px!important;}
  }

  /* ── Desktop (≥ 1024px) ──────────────────────────────────────────── */
  @media(min-width:1024px){
    .mob-header{display:none!important;}
    .kanban-mob-sel{display:none!important;}
    .kanban-full{display:flex!important;}
  }
`;

function LoadingScreen() {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#00208F",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{textAlign:"center",color:"white"}}>
        <img src={logo} style={{width:80,height:80,borderRadius:"20px 20px 20px 0",objectFit:"cover",marginBottom:20}} alt="logo" />
        <div style={{fontFamily:"'Poppins',sans-serif",fontSize:28,fontWeight:800,letterSpacing:"1px",marginBottom:12}}>queNECESITAS CRM</div>
        <p style={{fontSize:14,opacity:.7}}>Cargando datos...</p>
      </div>
    </div>
  );
}

const USER_COLS = 'id,name,email,role,linea_permisos,manager_id,dni,cargo,domicilio,auth_id';

export default function App() {
  const [data, setData] = useState({users:[],contacts:[],interactions:[],deals:[],tasks:[]});
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [sidebar, setSidebar] = useState(true);
  const [openGroups, setOpenGroups] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = (id) => { setView(id); setMenuOpen(false); };

  // Sesión segura con Supabase Auth: el perfil se busca por auth_id
  const cargarPerfil = async (session) => {
    if (!session) { setUser(null); setLoading(false); return; }
    const { data: perfil } = await supabase.from('users').select(USER_COLS).eq('auth_id', session.user.id).maybeSingle();
    if (!perfil) { await supabase.auth.signOut(); setUser(null); setLoading(false); alert('Tu cuenta no tiene acceso al CRM.'); return; }
    await loadAll();
    setUser(u => (u && u.id === perfil.id) ? u : toCamel(perfil));
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => cargarPerfil(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_OUT') { setUser(null); setData({users:[],contacts:[],interactions:[],deals:[],tasks:[]}); }
      if (ev === 'SIGNED_IN') cargarPerfil(session);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line
  }, []);
  const salir = async () => { await supabase.auth.signOut(); setUser(null); setMenuOpen(false); };

  const loadAll = async () => {
    setLoading(true);
    const [u, c, i, d, t] = await Promise.all([
      supabase.from('users').select(USER_COLS),
      supabase.from('contacts').select('*'),
      supabase.from('interactions').select('*'),
      supabase.from('deals').select('*'),
      supabase.from('tasks').select('*'),
    ]);
    const deals = (d.data || []).map(toCamel);
    console.log('[loadAll] contacts sample linea raw:', c.data?.[0]?.linea, '| type:', typeof c.data?.[0]?.linea);
    setData({
      users:        (u.data || []).map(toCamel),
      contacts:     (c.data || []).map(r => { const c2 = toCamel(r); return { ...c2, linea: parseLinea(c2.linea) }; }),
      interactions: (i.data || []).map(toCamel),
      deals,
      tasks:        (t.data || []).map(toCamel),
    });
    setLoading(false);
  };

  // ── Contacts ─────────────────────────────────────────────────────────────
  const saveContact = async (form, isNew) => {
    // Asegurar que linea es siempre un array antes de guardar
    const normalizedForm = { ...form, linea: Array.isArray(form.linea) ? form.linea : form.linea ? [form.linea] : [] };
    if (isNew) {
      const contactId = genId();
      const payload = toSnake({ ...normalizedForm, id: contactId, createdAt: today() });
      console.log('[saveContact:new] linea enviado→', payload.linea, '| type:', typeof payload.linea);
      const { data: rec, error } = await supabase.from('contacts').insert(payload).select().single();
      if (error) { console.error('[saveContact]', error); alert(`Error al guardar contacto:\n${error.message}`); return; }
      const newContact = rec ? { ...toCamel(rec), linea: parseLinea(rec.linea) } : null;
      console.log('[saveContact:new] linea guardado en Supabase→', newContact?.linea);
      if (newContact) setData(d => ({ ...d, contacts: [...d.contacts, newContact] }));

      // Auto-crear deal en etapa inicial para nuevos prospectos (uno por línea)
      const lineas = normalizedForm.linea; // ya es array normalizado
      console.log('[saveContact:new] tipo:', normalizedForm.tipo, '| lineas para deals:', lineas);
      if (normalizedForm.tipo === 'prospecto' && lineas.length > 0) {
        for (const linea of lineas) {
          if (linea === "inmobiliaria") continue; // el pipeline de inmobiliaria va por inmuebles, no por contactos
          const dealPayload = toSnake({
            id: genId(),
            contactId: contactId,
            linea: linea,
            etapa: (ETAPAS[linea] || [])[0] || 'prospecto',
            comercialId: normalizedForm.comercialId,
            titulo: normalizedForm.name,
            valor: 0,
            createdAt: today(),
            updatedAt: today(),
          });
          console.log('[saveContact:new] insertando deal:', dealPayload);
          const { data: dealRec, error: dealErr } = await supabase.from('deals').insert(dealPayload).select().single();
          if (dealErr) {
            console.error('[saveContact] auto-deal error:', dealErr);
            alert(`Deal no creado para línea "${linea}":\n${dealErr.message}`);
          } else if (dealRec) {
            console.log('[saveContact:new] deal creado:', dealRec);
            setData(d => ({ ...d, deals: [...d.deals, toCamel(dealRec)] }));
          }
        }
      }
    } else {
      const updatePayload = toSnake(normalizedForm);
      console.log('[saveContact:edit] linea enviado→', updatePayload.linea, '| type:', typeof updatePayload.linea);
      const { data: rec, error } = await supabase.from('contacts').update(updatePayload).eq('id', normalizedForm.id).select().single();
      if (error) { console.error('[saveContact update]', error); alert(`Error al actualizar:\n${error.message}`); return; }
      const updated = rec ? { ...toCamel(rec), linea: parseLinea(rec.linea) } : normalizedForm;
      console.log('[saveContact:edit] linea guardado en Supabase→', updated.linea);
      setData(d => ({ ...d, contacts: d.contacts.map(c => c.id === normalizedForm.id ? updated : c) }));
    }
  };
  const deleteContact = async (id) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (!error) setData(d => ({ ...d, contacts: d.contacts.filter(c => c.id !== id) }));
  };
  const toClientContact = async (contact, dealId) => {
    const { error } = await supabase.from('contacts').update({ tipo: 'cliente' }).eq('id', contact.id);
    if (error) { alert(`Error al convertir: ${error.message}`); return; }
    setData(d => ({ ...d, contacts: d.contacts.map(c => c.id === contact.id ? { ...c, tipo: 'cliente' } : c) }));
    if (dealId) {
      const deal = data.deals.find(d => d.id === dealId);
      if (deal) {
        const stages = ETAPAS[deal.linea] || [];
        const perdidoIdx = stages.indexOf('perdido');
        const winStage = perdidoIdx > 0 ? stages[perdidoIdx - 1] : stages[stages.length - 1];
        await moveDeal(dealId, winStage);
      }
    }
  };

  // ── Interactions ──────────────────────────────────────────────────────────
  const saveInteraction = async (form) => {
    const payload = toSnake({ ...form, id: genId() });
    const { data: rec, error } = await supabase.from('interactions').insert(payload).select().single();
    if (error) { console.error('[saveInteraction]', error); alert(`Error al guardar actuación:\n${error.message}`); return; }
    if (rec) setData(d => ({ ...d, interactions: [...d.interactions, toCamel(rec)] }));
  };
  const deleteInteraction = async (id) => {
    const { error } = await supabase.from('interactions').delete().eq('id', id);
    if (!error) setData(d => ({ ...d, interactions: d.interactions.filter(i => i.id !== id) }));
  };

  // ── Deals ─────────────────────────────────────────────────────────────────
  const saveDeal = async (form, isNew) => {
    const val = Number(form.valor) || 0;
    if (isNew) {
      const payload = toSnake({ ...form, id: genId(), valor: val, updatedAt: today() });
      const { data: rec, error } = await supabase.from('deals').insert(payload).select().single();
      if (error) { console.error('[saveDeal]', error); alert(`Error al guardar oportunidad:\n${error.message}`); return; }
      if (rec) setData(d => ({ ...d, deals: [...d.deals, toCamel(rec)] }));
    } else {
      const updated = { ...form, valor: val, updatedAt: today() };
      const { error } = await supabase.from('deals').update(toSnake(updated)).eq('id', form.id);
      if (error) { console.error('[saveDeal update]', error); alert(`Error al actualizar:\n${error.message}`); return; }
      setData(d => ({ ...d, deals: d.deals.map(deal => deal.id === form.id ? updated : deal) }));
    }
  };
  const deleteDeal = async (id) => {
    const { error } = await supabase.from('deals').delete().eq('id', id);
    if (!error) setData(d => ({ ...d, deals: d.deals.filter(deal => deal.id !== id) }));
  };
  const moveDeal = async (dealId, etapa) => {
    const now = today();
    const { error } = await supabase.from('deals').update({ etapa, updated_at: now }).eq('id', dealId);
    if (!error) setData(d => ({ ...d, deals: d.deals.map(deal => deal.id === dealId ? { ...deal, etapa, updatedAt: now } : deal) }));
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const saveTask = async (form, isNew) => {
    if (isNew) {
      const payload = toSnake({ ...form, id: genId(), completada: false, comercialId: user.id });
      const { data: rec, error } = await supabase.from('tasks').insert(payload).select().single();
      if (error) { console.error('[saveTask]', error); alert(`Error al guardar tarea:\n${error.message}`); return; }
      if (rec) setData(d => ({ ...d, tasks: [...d.tasks, toCamel(rec)] }));
    } else {
      const { checklist, ...rest } = form; // la lista se guarda aparte al marcar cada punto
      const { error } = await supabase.from('tasks').update(toSnake(rest)).eq('id', form.id);
      if (error) { console.error('[saveTask update]', error); alert(`Error al actualizar tarea:\n${error.message}`); return; }
      setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === form.id ? { ...t, ...rest } : t) }));
    }
  };
  const deleteTask = async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setData(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== id) }));
      // Sincronizar Mi Semana: task.id === block.id (mismo UUID), UPDATE hace 0 filas si no existe
      await supabase.from('weekly_plans').delete().eq('id', id);
    }
  };
  const toggleTask = async (id) => {
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    const newVal = !task.completada;
    const { error } = await supabase.from('tasks').update({ completada: newVal }).eq('id', id);
    if (!error) {
      setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, completada: newVal } : t) }));
      // Sincronizar Mi Semana: task.id === block.id (mismo UUID), UPDATE hace 0 filas si no existe
      await supabase.from('weekly_plans').update({ completado: newVal }).eq('id', id);
    }
  };

  const toggleChecklistItem = async (taskId, itemId) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task || !Array.isArray(task.checklist)) return;
    const checklist = task.checklist.map(i => i.id === itemId ? { ...i, done: !i.done } : i);
    const { data: rec, error } = await supabase.from('tasks').update({ checklist }).eq('id', taskId).select().single();
    if (error) { alert(`Error al actualizar:\n${error.message}`); return; }
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? toCamel(rec) : t) }));
  };

  // ── Users ─────────────────────────────────────────────────────────────────
  // Si la tabla `users` no tiene aún la columna descripcion_rol, ejecutar manualmente:
  // ALTER TABLE users ADD COLUMN IF NOT EXISTS descripcion_rol text;
  const addUser = async (form) => {
    const payload = toSnake({
      id:            genId(),
      name:          form.name,
      email:         form.email,
      role:          form.role || 'comercial',
      lineaPermisos: form.lineaPermisos || ['inmobiliaria'],
      managerId:     form.managerId || null,
      descripcionRol: form.descripcionRol || null,
    });
    payload.email = String(payload.email || '').trim().toLowerCase();
    const { data: rec, error } = await supabase.from('users').insert(payload).select(USER_COLS).single();
    if (error) { alert(`Error al crear usuario:\n${error.message}`); return; }
    setData(d => ({ ...d, users: [...d.users, toCamel(rec)] }));
    await invitarUsuario(rec.id, rec.email);
  };
  const invitarUsuario = async (id, email) => {
    const { data, error } = await supabase.functions.invoke('cuentas', { body: { action:'invitar', user_id:id } });
    const r = data?.resultados?.[0];
    if (error || data?.error || r?.error) alert(`No se pudo enviar la invitación: ${data?.error || r?.error || error?.message}`);
    else alert(`Invitación enviada a ${email}. Recibirá un enlace para crear su contraseña.`);
  };
  const deleteUser = async (id) => {
    await supabase.functions.invoke('cuentas', { body: { action:'baja', user_id:id } });
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) setData(d => ({ ...d, users: d.users.filter(u => u.id !== id) }));
  };
  const savePermisos = async (userId, permisos, descripcionRol) => {
    const payload = { linea_permisos: permisos };
    if (descripcionRol !== undefined) payload.descripcion_rol = descripcionRol;
    const { error } = await supabase.from('users').update(payload).eq('id', userId);
    if (!error) setData(d => ({ ...d, users: d.users.map(u => u.id === userId ? { ...u, lineaPermisos: permisos, ...(descripcionRol !== undefined ? { descripcionRol } : {}) } : u) }));
  };


  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;

  const canSee = l => ["admin","socio"].includes(user.role) || user.lineaPermisos?.includes(l);
  const vis = (user.role==="admin"||user.role==="socio") ? data.users.map(u=>u.id) : [user.id];
  const isBoss = ["admin","socio"].includes(user.role);
  const myCon = data.contacts.filter(c=>(isBoss||vis.includes(c.comercialId))&&parseLinea(c.linea).some(l=>canSee(l)));
  const myDea = data.deals.filter(d=>(["admin","socio"].includes(user.role)||vis.includes(d.comercialId))&&canSee(d.linea));
  const myTas = data.tasks.filter(t=>vis.includes(t.comercialId));

  const navItems = [
    { id:"dashboard",    icon:"📊", label:"Panel" },
    ...(["admin","socio"].includes(user.role)?[{ id:"objetivos", icon:"🎯", label:"Objetivos" }]:[]),
    { id:"contacts",     icon:"👥", label:"Contactos" },
    { id:"pipeline",     icon:"📋", label:"Pipeline" },
    { id:"tasks",        icon:"✅", label:"Tareas" },
    { id:"misemana",     icon:"📅", label:"Mi Semana" },
    { id:"documentos",   icon:"📁", label:"Documentos" },
    ...(canSee("energia")      ?[{ id:"llamadas",      icon:"📞", label:"Llamadas" }]:[]),
    ...(canSee("alarmas")      ?[{ id:"alarmas",       icon:"🔐", label:"Alarmas" }]:[]),
    ...(canSee("energia")      ?[{ id:"energia",       icon:"⚡", label:"Energía" }]:[]),
    ...(canSee("telefonia")    ?[{ id:"telefonia",     icon:"📱", label:"Telefonía" }]:[]),
    ...(canSee("inmobiliaria") ?[{ id:"inmobiliaria",  icon:"🏠", label:"Inmobiliaria" }]:[]),
    ...(canSee("venta_directa")?[{ id:"venta_directa", icon:"🏷️", label:"Venta Directa" }]:[]),
    ...(canSee("npl")          ?[{ id:"npl",           icon:"📊", label:"NPL" }]:[]),
    ...(["admin","socio"].includes(user.role)?[{ id:"administracion", icon:"🏛️", label:"Administración", children:[{ id:"contabilidad", icon:"🧾", label:"Contabilidad" }] }]:[]),
    ...(["admin","socio"].includes(user.role)?[{ id:"team", icon:"👔", label:"Equipo" }]:[]),
  ];

  { const li=navItems.findIndex(i=>["alarmas","energia","telefonia","inmobiliaria","venta_directa","npl"].includes(i.id)); if(li>=0) navItems[li]={...navItems[li],sec:"Líneas de negocio"}; const ti=navItems.findIndex(i=>i.id==="administracion"||i.id==="team"); if(ti>=0) navItems[ti]={...navItems[ti],sec:"Empresa"}; }
  const currentNavLabel = navItems.flatMap(i=>[i,...(i.children||[])]).find(i=>i.id===view)?.label || "CRM";

  return (
    <div className="crm-root">
      <style>{CSS}</style>

      {/* Overlay móvil (cierra el menú al tocar fuera) */}
      <div className={`sidebar-overlay ${menuOpen?"mob-open":""}`} onClick={()=>setMenuOpen(false)} />

      {/* Sidebar */}
      <div className={`crm-sidebar ${menuOpen?"mob-open":""}`}
        style={{width:sidebar?248:72,background:"#00208F",padding:"28px 16px",display:"flex",flexDirection:"column",overflowY:"auto",overflowX:"hidden",flexShrink:0,color:"white"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,padding:"0 4px"}}>
          <div style={{width:40,height:40,borderRadius:"50% 50% 50% 0",background:"#F6F5F1",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <img src={isotipo} style={{width:24,height:24}} alt="Qué necesitas hoy" />
          </div>
          <div className="sidebar-label" style={{display:sidebar?"block":"none",whiteSpace:"nowrap"}}>
            <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:16,letterSpacing:"-.03em",lineHeight:1.1}}>Qué necesitas hoy</div>
            <div className="mono" style={{fontSize:10,letterSpacing:".08em",color:"#8FA2F0",marginTop:2}}>CRM</div>
          </div>
        </div>
        {navItems.map((item,i)=>(
          <div key={item.id}>
            {item.sec && <div className="side-sec sidebar-label" style={{display:sidebar?"block":"none"}}>{item.sec}</div>}
            {item.children ? (()=>{ const act=item.children.some(c=>c.id===view); const op=openGroups[item.id]??act; return (<>
              <button className={`nav ${act&&!op?"on":""}`} onClick={()=>{ if(!sidebar){ navigate(item.children[0].id); return; } setOpenGroups(g=>({...g,[item.id]:!op})); }} title={item.label}>
                <span className="dot" />
                <span className="sidebar-label" style={{whiteSpace:"nowrap",display:sidebar?"inline":"none",flex:1,textAlign:"left"}}>{item.label}</span>
                <span className="sidebar-label" style={{display:sidebar?"inline":"none",fontSize:10,transition:"transform .2s",transform:op?"rotate(90deg)":"none"}}>▶</span>
              </button>
              {op && sidebar && item.children.map(c=>(
                <button key={c.id} className={`nav ${view===c.id?"on":""}`} onClick={()=>navigate(c.id)} title={c.label} style={{paddingLeft:34,fontSize:13}}>
                  <span className="sidebar-label" style={{whiteSpace:"nowrap"}}>{c.icon} {c.label}</span>
                </button>))}
            </>); })() : (
            <button className={`nav ${view===item.id?"on":""}`} onClick={()=>navigate(item.id)} title={item.label}>
              <span className="dot" />
              <span className="sidebar-label" style={{whiteSpace:"nowrap",display:sidebar?"inline":"none"}}>{item.label}</span>
            </button>)}
          </div>
        ))}
        <div style={{marginTop:"auto",paddingTop:16}}>
          <div style={{borderTop:"1px solid rgba(255,255,255,.12)",paddingTop:16,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,background:"#FFB81C",borderRadius:"50% 50% 50% 0",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#0B1233",fontSize:14,flexShrink:0}}>{user.name.charAt(0)}</div>
            <span className="sidebar-label" style={{display:sidebar?"block":"none",overflow:"hidden",flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"white",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
              <div className="mono" style={{fontSize:10,color:"#8FA2F0",textTransform:"uppercase",letterSpacing:".08em"}}>{user.role}</div>
            </span>
            <button className="sidebar-label" onClick={salir} style={{display:sidebar?"inline":"none",background:"none",border:"none",color:"#DCE3FF",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Salir</button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="crm-main" style={{flex:1,overflow:"auto"}}>
        {/* Cabecera móvil */}
        <div className="mob-header">
          <button onClick={()=>setMenuOpen(m=>!m)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"white",padding:"4px",lineHeight:1,flexShrink:0}}>☰</button>
          <span style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:17,color:"white",flex:1,letterSpacing:"-.03em"}}>{currentNavLabel}</span>
          <div style={{width:32,height:32,background:"#FFB81C",borderRadius:"50% 50% 50% 0",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#0B1233",fontSize:13}}>{user.name.charAt(0)}</div>
        </div>

        <div className="topbar desk-hamburger">
          <button onClick={()=>setSidebar(s=>!s)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#5B6178"}}>☰</button>
          <input className="fi search" placeholder="Buscar clientes, inmuebles, CUPS…" onKeyDown={e=>{if(e.key==="Enter"){navigate("contacts");}}} />
          <div style={{flex:1}} />
          <span className="mono" style={{fontSize:11,color:"#5B6178",letterSpacing:".08em",textTransform:"uppercase"}}>{new Date().toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span>
          <button className="btn-a" onClick={()=>navigate("contacts")}>+ Nuevo</button>
        </div>
        <div className="crm-main-inner" style={{padding:"32px 40px"}}>
          {view==="dashboard" && <Dashboard contacts={myCon} deals={myDea} tasks={myTas} user={user} onNavigate={navigate} />}
          {(view==="contacts"||view==="clients") && <Contacts
            contacts={myCon}
            interactions={data.interactions}
            users={data.users}
            deals={data.deals}
            user={user}
            onSaveContact={saveContact}
            onDeleteContact={deleteContact}
            onToClient={toClientContact}
            onSaveInteraction={saveInteraction}
            onDeleteInteraction={deleteInteraction}
            canSee={canSee}
            initialTipo={view==="clients"?"cliente":"all"}
          />}
          {view==="pipeline"  && <Pipeline
            deals={myDea}
            contacts={data.contacts}
            users={data.users}
            user={user}
            onSaveDeal={saveDeal}
            onDeleteDeal={deleteDeal}
            onMoveDeal={moveDeal}
            canSee={canSee}
          />}
          {view==="tasks"     && <Tasks
            tasks={myTas}
            deals={data.deals}
            contacts={data.contacts}
            user={user}
            onSaveTask={saveTask}
            onDeleteTask={deleteTask}
            onToggleTask={toggleTask}
           onToggleItem={toggleChecklistItem}/>}
          {view==="productos" && null}
          {view==="subastas" && null}
          {view==="inmobiliaria" && <Inmobiliaria user={user} contacts={data.contacts} users={data.users} />}
          {view==="misemana"     && <MiSemana user={user} />}
          {view==="venta_directa"&& <VentaDirecta user={user} users={data.users} contacts={data.contacts} />}
          {view==="npl"          && <NPL user={user} users={data.users} />}
          {view==="alarmas"      && <AlarmaSection user={user} users={data.users} contacts={data.contacts} />}
          {view==="objetivos" && ["admin","socio"].includes(user.role) && <Objetivos user={user} />}
          {view==="documentos"   && <Documentos />}
          {view==="contabilidad" && ["admin","socio"].includes(user.role) && <Contabilidad user={user} />}
          {view==="llamadas"     && <Llamadas user={user} users={data.users} onReload={loadAll} />}
          {view==="energia"      && <EnergiaSection user={user} users={data.users} contacts={data.contacts} />}
          {view==="telefonia"    && <TelefoniaSection user={user} users={data.users} contacts={data.contacts} />}
          {view==="team"      && <Team
            users={data.users}
            contacts={data.contacts}
            deals={data.deals}
            tasks={data.tasks}
            onAddUser={addUser}
            onInvite={invitarUsuario}
            onDeleteUser={deleteUser}
            onSavePermisos={savePermisos}
          />}
        </div>
      </div>
    </div>
  );
}

function Login() {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  const [info,setInfo]=useState("");
  const go=async()=>{
    if(!email||!pass){setErr("Escribe tu email y tu contraseña");return;}
    setBusy(true);setErr("");
    const {error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password:pass});
    setBusy(false);
    if(error) setErr(error.message.includes("Invalid")?"Email o contraseña incorrectos":error.message);
  };
  const olvide=async()=>{
    if(!email){setErr("Escribe tu email y vuelve a pulsar «He olvidado mi contraseña»");return;}
    await supabase.functions.invoke('cuentas',{body:{action:'olvide',email}});
    setErr("");setInfo("Si el email está dado de alta, te hemos enviado un enlace para elegir una nueva contraseña.");
  };
  return (
    <div className="login-wrap" style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"1.05fr 1fr",background:"#F6F5F1",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{CSS+`@media(max-width:900px){.login-wrap{grid-template-columns:1fr!important}.login-hero{min-height:300px!important;padding:40px 28px!important}.login-hero .claim{font-size:34px!important}}`}</style>
      <div className="login-hero" style={{position:"relative",overflow:"hidden",background:"#00208F",color:"white",padding:"56px 64px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <div style={{position:"absolute",width:560,height:560,borderRadius:"50% 50% 50% 0",background:"#1A38A8",top:-180,right:-200}} />
        <div style={{position:"absolute",width:380,height:380,borderRadius:"50% 50% 50% 0",background:"#FFB81C",bottom:-160,right:-90}} />
        <img src={logoNeg} alt="Qué necesitas hoy" style={{width:120,position:"relative"}} />
        <div style={{position:"relative",maxWidth:520}}>
          <div className="mono" style={{fontSize:11,letterSpacing:".08em",color:"#8FA2F0",marginBottom:16}}>CRM · ÁREA INTERNA</div>
          <div className="claim" style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:52,lineHeight:1.05,letterSpacing:"-.04em"}}>Todo lo que necesitas, en un solo sitio.</div>
          <p style={{fontSize:16,color:"#DCE3FF",marginTop:18,lineHeight:1.5,maxWidth:420}}>Clientes, inmuebles, energía y tareas del equipo, conectados en una única herramienta.</p>
        </div>
        <div />
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 28px"}}>
        <div style={{width:"100%",maxWidth:400}}>
          <div className="eyebrow">Acceso</div>
          <h1 style={{fontFamily:"'Poppins',sans-serif",fontSize:32,fontWeight:700,letterSpacing:"-.03em",color:"#0B1233",marginBottom:8}}>Hola de nuevo</h1>
          <p style={{color:"#5B6178",fontSize:15,marginBottom:28}}>Entra con tu email corporativo.</p>
          <div style={{marginBottom:16}}><label className="fl">Email</label><input className="fi" style={{height:48}} type="email" placeholder="tu@quenecesitashoy.es" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} /></div>
          <div style={{marginBottom:22}}><label className="fl">Contraseña</label><input className="fi" style={{height:48}} type="password" placeholder="••••••••" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} /></div>
          {err&&<p style={{color:"#dc2626",fontSize:13,marginBottom:14}}>{err}</p>}
          {info&&<p style={{color:"#00208F",fontSize:13,marginBottom:14}}>{info}</p>}
          <button className="btn-p" style={{width:"100%",height:52,fontSize:15}} disabled={busy} onClick={go}>{busy?"Entrando…":"Entrar"}</button>
          <button onClick={olvide} style={{background:"none",border:"none",color:"#00208F",fontSize:13,marginTop:14,cursor:"pointer",padding:0,textDecoration:"underline"}}>He olvidado mi contraseña</button>
          <p style={{fontSize:13,color:"#5B6178",marginTop:22}}>¿Problemas para entrar? Escribe a <a href="mailto:info@gespronet.es" style={{color:"#00208F",fontWeight:700}}>info@gespronet.es</a></p>
        </div>
      </div>
    </div>
  );
}

function Dashboard({contacts,deals,tasks,user,onNavigate}) {
  const canSee = l => ["admin","socio"].includes(user.role) || (user.lineaPermisos||[]).includes(l);
  const {start,end}=weekRange();
  const today=new Date().toISOString().slice(0,10);
  const weekT=tasks.filter(t=>!t.completada&&t.fecha>=start&&t.fecha<=end);
  const activeDeals=deals.filter(d=>d.etapa!=="perdido");
  const total=activeDeals.reduce((s,d)=>s+(d.valor||0),0);
  const byL=Object.keys(LINEAS).filter(canSee).map(l=>({l,count:activeDeals.filter(d=>d.linea===l).length,val:activeDeals.filter(d=>d.linea===l).reduce((s,d)=>s+(d.valor||0),0)}));
  const maxCount=Math.max(1,...byL.map(x=>x.count));
  const pending=tasks.filter(t=>!t.completada).sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
  const todayT=pending.filter(t=>t.fecha<=today);
  const list=(todayT.length?todayT:pending).slice(0,6);
  const prospectos=contacts.filter(c=>c.tipo==="prospecto").length;
  const clientes=contacts.filter(c=>c.tipo==="cliente").length;
  const nuevos30=contacts.filter(c=>(c.createdAt||"")>=new Date(Date.now()-30*864e5).toISOString().slice(0,10)).length;
  const [ahorro,setAhorro]=useState(null);
  useEffect(()=>{ if(!canSee("energia")) return;
    supabase.from("energia_procesos").select("ahorro_real_eur").then(({data})=>{
      if(data) setAhorro(data.reduce((s,r)=>s+(Number(r.ahorro_real_eur)||0),0));
    });
  // eslint-disable-next-line
  },[]);
  const prio={alta:{l:"Alta",bg:"#FFB81C",c:"#0B1233"},media:{l:"Media",bg:"#DCE3FF",c:"#00208F"},baja:{l:"Baja",bg:"#F0EFEA",c:"#5B6178"}};
  const eur=v=>Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g,".")+" €";
  const kpis=[
    {l:"Contactos activos",v:contacts.length,s:`${prospectos} prospectos · ${clientes} clientes`,go:"contacts"},
    {l:"Pipeline activo",v:eur(total),s:`${activeDeals.length} oportunidades`,go:"pipeline"},
    {l:"Tareas esta semana",v:weekT.length,s:`${todayT.length} para hoy o vencidas`,go:"tasks"},
    {l:"Nuevos · 30 días",v:nuevos30,s:"contactos captados",go:"contacts"},
  ];
  const nombre=(user.name||"").split(" ")[0];
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:16,flexWrap:"wrap",marginBottom:28}}>
        <div>
          <div className="eyebrow">Panel · {new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</div>
          <h1>Buenos días, {nombre}</h1>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-g" onClick={()=>onNavigate&&onNavigate("tasks")}>Ver tareas</button>
          <button className="btn-p" onClick={()=>onNavigate&&onNavigate("contacts")}>+ Nuevo contacto</button>
        </div>
      </div>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:24}}>
        {kpis.map((k,i)=>(
          <div key={k.l} onClick={()=>onNavigate&&onNavigate(k.go)} style={{cursor:"pointer",padding:24,borderRadius:"24px 24px 24px 0",background:i===0?"#00208F":"white",border:i===0?"1px solid #00208F":"1px solid #E4E2DA",color:i===0?"white":"#0B1233",transition:"border-color .15s"}}>
            <div className="mono" style={{fontSize:10.5,letterSpacing:".08em",textTransform:"uppercase",color:i===0?"#8FA2F0":"#5B6178"}}>{k.l}</div>
            <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:36,letterSpacing:"-.04em",lineHeight:1.1,margin:"14px 0 6px"}}>{k.v}</div>
            <div style={{fontSize:13,color:i===0?"#DCE3FF":"#5B6178"}}>{k.s}</div>
          </div>
        ))}
      </div>
      <div className="dash-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1.4fr) minmax(0,1fr)",gap:16}}>
        <div className="card" style={{padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3>{todayT.length?"Tareas de hoy":"Próximas tareas"}</h3>
            <button className="btn-g" style={{padding:"5px 12px",fontSize:12}} onClick={()=>onNavigate&&onNavigate("tasks")}>Ver todas</button>
          </div>
          {list.map(t=>{const p=prio[t.prioridad]||prio.baja; const late=t.fecha<today; return (
            <div key={t.id} style={{display:"flex",gap:14,alignItems:"center",padding:"12px 0",borderTop:"1px solid #E4E2DA"}}>
              <span className="mono" style={{fontSize:11,color:late?"#dc2626":"#5B6178",width:62,flexShrink:0}}>{t.hora||(t.fecha===today?"HOY":(t.fecha||"").slice(5).split("-").reverse().join("/"))}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,fontWeight:500,color:"#0B1233",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.titulo}</p>
                {(()=>{const c=contacts.find(c=>c.id===t.contactId);return c?<p style={{fontSize:12,color:"#5B6178"}}>{c.name}</p>:null;})()}
              </div>
              <span className="tag" style={{background:p.bg,color:p.c}}>{p.l}</span>
            </div>);})}
          {list.length===0&&<p style={{color:"#5B6178",fontSize:14,padding:"20px 0",borderTop:"1px solid #E4E2DA"}}>Sin tareas pendientes.</p>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div className="card" style={{padding:24}}>
            <h3 style={{marginBottom:18}}>Pipeline por línea</h3>
            {byL.map(item=>(
              <div key={item.l} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:13}}>
                  <span style={{fontWeight:500,color:"#0B1233"}}>{LINEAS[item.l].label.replace(/^\S+\s/,"")}</span>
                  <span className="mono" style={{fontSize:11,color:"#5B6178"}}>{item.count} · {eur(item.val)}</span>
                </div>
                <div style={{height:10,background:"#F0EFEA",borderRadius:"8px 8px 8px 0"}}>
                  <div style={{height:"100%",width:`${item.count?Math.max(4,(item.count/maxCount)*100):0}%`,background:"#00208F",borderRadius:"8px 8px 8px 0",transition:"width .5s"}} />
                </div>
              </div>
            ))}
          </div>
          {canSee("energia")&&(
            <div style={{background:"#FFB81C",color:"#0B1233",borderRadius:"24px 24px 24px 0",padding:24}}>
              <div className="mono" style={{fontSize:10.5,letterSpacing:".08em",textTransform:"uppercase"}}>Ahorro energético generado</div>
              <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:40,letterSpacing:"-.04em",lineHeight:1.1,margin:"12px 0 6px"}}>{ahorro===null?"—":eur(ahorro)}</div>
              <div style={{fontSize:13}}>Ahorro real acumulado de los clientes de energía.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TIPOS = {
  prospecto: { label:"Prospecto", color:"#0B1233", bg:"#FFE7A8" },
  cliente:   { label:"Cliente",   color:"#00208F", bg:"#DCE3FF" },
};
function TipoBadge({tipo}) {
  const t = TIPOS[tipo==="cliente"?"cliente":"prospecto"];
  return <span className="tag" style={{background:t.bg,color:t.color,fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>{t.label}</span>;
}

function Contacts({contacts,interactions,users,deals,user,onSaveContact,onDeleteContact,onToClient,onSaveInteraction,onDeleteInteraction,canSee,initialTipo="all"}) {
  const [search,setSearch]=useState("");
  const [fTipo,setFTipo]=useState(initialTipo);
  const [fLinea,setFLinea]=useState("all");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [detail,setDetail]=useState(null);

  const q=search.trim().toLowerCase();
  const porTipo={ all:contacts.length, prospecto:contacts.filter(c=>c.tipo!=="cliente").length, cliente:contacts.filter(c=>c.tipo==="cliente").length };
  const filtered=contacts.filter(c=>{
    const lineas=Array.isArray(c.linea)?c.linea:c.linea?[c.linea]:[];
    const okTipo=fTipo==="all"||(fTipo==="cliente"?c.tipo==="cliente":c.tipo!=="cliente");
    return okTipo&&(fLinea==="all"||lineas.includes(fLinea))&&(!q||c.name.toLowerCase().includes(q)||c.phone?.includes(search.trim())||c.email?.toLowerCase().includes(q)||c.empresa?.toLowerCase().includes(q));
  }).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  const openNew=()=>{const defaultLinea = Object.keys(LINEAS).find(k => canSee(k)) || "inmobiliaria";setForm({linea:[defaultLinea],tipo:fTipo==="cliente"?"cliente":"prospecto",comercialId:user.id});setModal("new");};
  const openEdit=c=>{
    console.log('[openEdit] contact.linea:', c.linea, '| type:', typeof c.linea);
    setForm({...c, linea: parseLinea(c.linea)});
    setModal("edit");
  };
  const save=async()=>{if(!form.name?.trim())return;await onSaveContact(form,modal==="new");setModal(null);};
  const del=id=>{if(window.confirm("¿Eliminar contacto?"))onDeleteContact(id);};
  const toClient=c=>onToClient(c);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <><div className="eyebrow">Prospectos y clientes</div><h1>Contactos</h1></>
          <p style={{color:"#8A8FA3",fontSize:12}}>{filtered.length} de {contacts.length} contactos</p>
        </div>
        <button className="btn-p" onClick={openNew}>+ Nuevo contacto</button>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[["all","Todos"],["prospecto","Prospectos"],["cliente","Clientes"]].map(([k,l])=>(
          <button key={k} type="button" onClick={()=>setFTipo(k)} style={{padding:"8px 16px",borderRadius:"14px 14px 14px 0",border:"1.5px solid",fontSize:13,fontWeight:700,cursor:"pointer",borderColor:fTipo===k?"#0B1233":"#E4E2DA",background:fTipo===k?"#0B1233":"white",color:fTipo===k?"white":"#3A4058"}}>
            {l} <span style={{opacity:.75,fontWeight:600}}>{porTipo[k]}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input className="fi" style={{maxWidth:240}} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="fi" style={{maxWidth:190}} value={fLinea} onChange={e=>setFLinea(e.target.value)}>
          <option value="all">Todas las líneas</option>
          {Object.entries(LINEAS).filter(([k])=>canSee(k)).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {/* Vista tabla — escritorio */}
      <div className="contact-table card" style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#F6F5F1"}}>
              {["Contacto","Estado","Empresa","Teléfono","Línea","Comercial","Alta",""].map(h=>(
                <th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"#5B6178",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.map(c=>{
              const lineas=Array.isArray(c.linea)?c.linea:c.linea?[c.linea]:[];
              const ln0=LINEAS[lineas[0]]||{};
              const com=users.find(u=>u.id===c.comercialId);
              const ci=interactions.filter(i=>i.contactId===c.id);
              return (
                <tr key={c.id} className="tr" style={{borderTop:"1px solid #F6F5F1"}}>
                  <td style={{padding:"9px 13px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:32,height:32,background:"#DCE3FF",borderRadius:"50% 50% 50% 0",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#00208F",fontSize:12,flexShrink:0}}>{c.name.charAt(0)}</div>
                      <div>
                        <button onClick={()=>setDetail(c)} style={{fontSize:12,fontWeight:700,color:BRAND,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>{c.name}</button>
                        {["admin","socio"].includes(user.role)&&com&&<p style={{fontSize:10,color:"#8A8FA3",marginTop:1}}>{com.name}</p>}
                        <p style={{fontSize:10,color:"#8A8FA3"}}>{ci.length>0&&<span style={{color:BRAND}}>📋 {ci.length} actuaciones</span>}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"9px 13px"}}><TipoBadge tipo={c.tipo} /></td>
                  <td style={{padding:"9px 13px",fontSize:12,color:"#3A4058"}}>{c.empresa||"—"}</td>
                  <td style={{padding:"9px 13px",fontSize:12,color:"#3A4058"}}>{c.phone||"—"}</td>
                  <td style={{padding:"9px 13px"}}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{lineas.map(l=>{const lx=LINEAS[l]||{};return <span key={l} className="tag" style={{background:lx.light,color:lx.color}}>{lx.label}</span>;})}</div></td>
                  <td style={{padding:"9px 13px",fontSize:11,color:"#3A4058"}}>{com?.name||"—"}</td>
                  <td style={{padding:"9px 13px",fontSize:10,color:"#8A8FA3"}}>{c.createdAt}</td>
                  <td style={{padding:"9px 13px"}}>
                    <div style={{display:"flex",gap:4}}>
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11}} onClick={()=>setDetail(c)}>📋</button>
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11}} onClick={()=>openEdit(c)}>✏️</button>
                      {c.tipo!=="cliente"&&<button className="btn-g" style={{padding:"4px 8px",fontSize:10,color:"#059669",borderColor:"#a7f3d0"}} onClick={()=>toClient(c)}>→ Cliente</button>}
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>del(c.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {filtered.length===0&&<p style={{textAlign:"center",padding:36,color:"#8A8FA3"}}>Sin registros</p>}
        </div>
      </div>

      {/* Vista tarjetas — móvil y tablet */}
      <div className="contact-cards">
        {filtered.length===0&&<p style={{textAlign:"center",padding:36,color:"#8A8FA3"}}>Sin registros</p>}
        {filtered.map(c=>{
          const lineas=Array.isArray(c.linea)?c.linea:c.linea?[c.linea]:[];
          const ln0=LINEAS[lineas[0]]||{};
          const com=users.find(u=>u.id===c.comercialId);
          const ci=interactions.filter(i=>i.contactId===c.id);
          return (
            <div key={c.id} className="card" style={{padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:42,height:42,background:"#DCE3FF",borderRadius:"50% 50% 50% 0",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#00208F",fontSize:16,flexShrink:0}}>{c.name.charAt(0)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <button onClick={()=>setDetail(c)} style={{fontSize:15,fontWeight:800,color:BRAND,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left",display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{c.name}</button>
                  {c.empresa&&<p style={{fontSize:11,color:"#5B6178",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.empresa}</p>}
                  {com&&["admin","socio"].includes(user.role)&&<p style={{fontSize:10,color:"#8A8FA3"}}>{com.name}</p>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end",flexShrink:0}}>
                  <TipoBadge tipo={c.tipo} />
                  {lineas.map(l=>{const lx=LINEAS[l]||{};return <span key={l} className="tag" style={{background:lx.light,color:lx.color,fontSize:9}}>{lx.label}</span>;})}
                </div>
              </div>
              <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
                {c.phone&&<a href={`tel:${c.phone}`} style={{fontSize:13,color:"#3A4058",textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>📞 {c.phone}</a>}
                {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:13,color:"#3A4058",textDecoration:"none",display:"flex",alignItems:"center",gap:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>✉️ {c.email}</a>}
                {ci.length>0&&<span style={{fontSize:11,color:BRAND}}>📋 {ci.length} actuaciones</span>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn-p" style={{flex:1,minWidth:100,justifyContent:"center",display:"flex",alignItems:"center",gap:5,fontSize:13,padding:"10px 12px"}} onClick={()=>setDetail(c)}>📋 Ver ficha</button>
                <button className="btn-g" style={{flex:1,minWidth:80,justifyContent:"center",display:"flex",alignItems:"center",gap:5,fontSize:13,padding:"10px 12px"}} onClick={()=>openEdit(c)}>Editar</button>
                {c.tipo!=="cliente"&&<button className="btn-g" style={{fontSize:12,color:"#059669",borderColor:"#a7f3d0",padding:"10px 12px"}} onClick={()=>toClient(c)}>→ Cliente</button>}
                <button className="btn-g" style={{fontSize:12,color:"#dc2626",borderColor:"#fecaca",padding:"10px 12px"}} onClick={()=>del(c.id)}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>

      {detail&&<ContactDetail
        contact={detail}
        interactions={interactions.filter(i=>i.contactId===detail.id)}
        users={users}
        deals={deals}
        user={user}
        onClose={()=>setDetail(null)}
        onSaveInteraction={onSaveInteraction}
        onDeleteInteraction={onDeleteInteraction}
        onEdit={()=>{openEdit(detail);setDetail(null);}}
        onToClient={detail.tipo!=="cliente"?onToClient:null}
      />}

      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>{modal==="new"?"Nuevo contacto":"Editar contacto"}</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              {/* Estado: prospecto o cliente */}
              <div style={{gridColumn:"1 / -1"}}>
                <label className="fl">Estado</label>
                <div style={{display:"flex",gap:7,marginTop:4}}>
                  {[["prospecto","Prospecto"],["cliente","Cliente"]].map(([k,l])=>{
                    const sel=(form.tipo||"prospecto")===k;
                    return <button key={k} type="button" onClick={()=>setForm(f=>({...f,tipo:k}))} style={{padding:"5px 14px",borderRadius:"20px 20px 20px 0",border:"2px solid",fontSize:12,fontWeight:700,cursor:"pointer",borderColor:sel?TIPOS[k].color:"#C9CBD3",background:sel?TIPOS[k].bg:"white",color:sel?TIPOS[k].color:"#5B6178"}}>{l}</button>;
                  })}
                </div>
              </div>
              {/* Tipo de cliente */}
              <div style={{gridColumn:"1 / -1"}}>
                <label className="fl">Tipo de cliente</label>
                <select className="fi" value={form.tipo_cliente||"particular"} onChange={e=>setForm(f=>({...f,tipo_cliente:e.target.value}))}>
                  <option value="particular">Particular</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>
              {/* Línea — checkboxes múltiples */}
              <div style={{gridColumn:"1 / -1"}}>
                <label className="fl">Línea(s)</label>
                <div style={{display:"flex",gap:7,flexWrap:"wrap",marginTop:4}}>
                  {Object.entries(LINEAS).filter(([k])=>canSee(k)).map(([k,v])=>{
                    const sel=(Array.isArray(form.linea)?form.linea:[]).includes(k);
                    return (
                      <button key={k} type="button" onClick={()=>setForm(f=>{const cur=Array.isArray(f.linea)?f.linea:[];return {...f,linea:sel?cur.filter(x=>x!==k):[...cur,k]};})} style={{padding:"5px 12px",borderRadius:"20px 20px 20px 0",border:"2px solid",fontSize:12,fontWeight:700,cursor:"pointer",borderColor:sel?v.color:"#C9CBD3",background:sel?v.light:"white",color:sel?v.color:"#5B6178",transition:"all .2s"}}>{v.label}</button>
                    );
                  })}
                </div>
              </div>
              {/* Campos particular */}
              {(form.tipo_cliente||"particular")==="particular"&&<>
                {[["name","Nombre *"],["phone","Teléfono"],["email","Email"],["dniCif","DNI"]].map(([k,l])=>(
                  <div key={k}><label className="fl">{l}</label><input className="fi" value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} /></div>
                ))}
                <div style={{gridColumn:"1 / -1"}}><label className="fl">Dirección</label><input className="fi" value={form.direccion||""} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} /></div>
                <div><label className="fl">Localidad</label><input className="fi" value={form.localidad||""} onChange={e=>setForm(f=>({...f,localidad:e.target.value}))} /></div>
                <div><label className="fl">Código Postal</label><input className="fi" value={form.codigoPostal||""} onChange={e=>setForm(f=>({...f,codigoPostal:e.target.value}))} /></div>
                <div style={{gridColumn:"1 / -1"}}><label className="fl">Provincia</label><input className="fi" value={form.provincia||""} onChange={e=>setForm(f=>({...f,provincia:e.target.value}))} /></div>
              </>}
              {/* Campos empresa */}
              {form.tipo_cliente==="empresa"&&<>
                <div style={{gridColumn:"1 / -1",paddingTop:4,borderTop:"1px solid #E4E2DA"}}>
                  <p style={{fontSize:11,fontWeight:700,color:BRAND,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Datos de la empresa</p>
                </div>
                {[["empresa_razon_social","Razón Social *"],["empresa_cif","CIF"],["empresa_telefono","Teléfono empresa"],["empresa_email","Email empresa"]].map(([k,l])=>(
                  <div key={k}><label className="fl">{l}</label><input className="fi" value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value,name:k==="empresa_razon_social"?e.target.value:form.name}))} /></div>
                ))}
                <div style={{gridColumn:"1 / -1"}}><label className="fl">Dirección empresa</label><input className="fi" value={form.empresa_direccion||""} onChange={e=>setForm(f=>({...f,empresa_direccion:e.target.value}))} /></div>
                <div style={{gridColumn:"1 / -1",marginTop:6,paddingTop:10,borderTop:"1px solid #E4E2DA"}}>
                  <p style={{fontSize:11,fontWeight:700,color:BRAND,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Datos del representante que firma</p>
                </div>
                {[["representante_nombre","Nombre completo *"],["representante_dni","DNI"],["representante_telefono","Teléfono"],["representante_email","Email"]].map(([k,l])=>(
                  <div key={k}><label className="fl">{l}</label><input className="fi" value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} /></div>
                ))}
                <div style={{gridColumn:"1 / -1"}}><label className="fl">Dirección representante</label><input className="fi" value={form.representante_direccion||""} onChange={e=>setForm(f=>({...f,representante_direccion:e.target.value}))} /></div>
              </>}
            </div>
            <div style={{marginTop:10}}><label className="fl">Notas</label><textarea className="fi" rows={2} value={form.notas||""} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} /></div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-p" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactDetail({contact,interactions,users,deals,user,onClose,onSaveInteraction,onDeleteInteraction,onEdit,onToClient}) {
  const [tab,setTab]=useState("historial");
  const [ni,setNi]=useState({tipo:"llamada",fecha:today(),descripcion:"",comercialId:user.id});
  const [showF,setShowF]=useState(false);
  const [showConvert,setShowConvert]=useState(false);
  const [selectedDealId,setSelectedDealId]=useState("");
  const [docRefreshKey,setDocRefreshKey]=useState(0);
  const [generating,setGenerating]=useState(false);
  const [showEmail,setShowEmail]=useState(false);
  const [emailForm,setEmailForm]=useState({asunto:"",mensaje:""});
  const [emailAttachments,setEmailAttachments]=useState([]);
  const [sendingEmail,setSendingEmail]=useState(false);
  const contactLineas=parseLinea(contact.linea);
  const ln=LINEAS[contactLineas[0]]||{};
  const com=users.find(u=>u.id===contact.comercialId);
  const contactDeals=(deals||[]).filter(d=>d.contactId===contact.id&&d.etapa!=="perdido");

  const addI=async()=>{if(!ni.descripcion.trim())return;await onSaveInteraction({...ni,contactId:contact.id});setNi({tipo:"llamada",fecha:today(),descripcion:"",comercialId:user.id});setShowF(false);};
  const delI=id=>{if(window.confirm("¿Eliminar?"))onDeleteInteraction(id);};
  const doConvert=async()=>{await onToClient(contact,selectedDealId||undefined);setShowConvert(false);onClose();};

  const generateAcuerdo=async()=>{
    setGenerating(true);
    try{
      const{jsPDF}=await import('jspdf');
      const doc=new jsPDF({unit:'mm',format:'a4'});
      const ML=20,PW=210,PH=297,MB=25,TW=170;
      let y=25;
      const wr=(text,opts={})=>{
        if(!text)return;
        const{size=10,bold=false,center=false,indent=0,after=0}=opts;
        const justify=!bold&&!center;
        doc.setFontSize(size);doc.setFont('helvetica',bold?'bold':'normal');
        const lh=size*0.43;
        const width=center?TW:TW-indent;
        const lines=doc.splitTextToSize(text,width);
        if(justify){
          const totalH=lines.length*lh;
          if(y+totalH>PH-MB){doc.addPage();y=20;}
          doc.text(lines,ML+indent,y,{align:'justify',maxWidth:width});
          y+=totalH+after;
        } else {
          for(const line of lines){
            if(y>PH-MB){doc.addPage();y=20;}
            doc.text(line,center?PW/2:ML+indent,y,center?{align:'center'}:{});
            y+=lh;
          }
          y+=after;
        }
      };
      const fechaHoy=new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
      const isEmpresa=contact.tipo_cliente==='empresa';
      const dniCif=isEmpresa?(contact.empresa_cif||'___________'):(contact.dniCif||'___________');
      const razSocial=contact.empresa_razon_social||contact.empresa||contact.name;
      const repNombre=contact.representante_nombre||contact.name;
      const repDni=contact.representante_dni||contact.dniCif||'___________';
      const dir=isEmpresa?(contact.empresa_direccion||contact.direccion||'___________'):(contact.direccion||'___________');
      const cp=contact.codigoPostal||'';
      const loc=contact.localidad||'___________';
      const phone=isEmpresa?(contact.empresa_telefono||contact.phone||''):(contact.phone||'');
      const email=isEmpresa?(contact.empresa_email||contact.email||''):(contact.email||'');
      const clienteBloque=isEmpresa
        ?`la mercantil ${razSocial}, con CIF ${dniCif}, con domicilio en ${dir}, C.P. ${cp}, ${loc}, representada por D./Dña. ${repNombre} con D.N.I. ${repDni}.`
        :`Don/Doña ${contact.name}, con D.N.I. núm. ${dniCif}, mayor de edad y de nacionalidad española, con domicilio a efectos de este contrato en ${dir}, C.P. ${cp}, ${loc}, en su propio nombre y representación.`;
      const nombreFirma=isEmpresa?razSocial:contact.name;

      wr('ACUERDO DE CONFIDENCIALIDAD Y COLABORACION MUTUA',{size:13,bold:true,center:true,after:5});
      wr(`En, A Coruña, a ${fechaHoy}`,{size:10,after:7});

      wr('REUNIDOS',{size:11,bold:true,after:4});
      wr('De una parte, Don Antonio Luis Rey Pereiro, con D.N.I. núm. 34.890.867.M mayor de edad y de nacionalidad española, con domicilio a efectos de este contrato en Rúa de la Playa 18 - Gandarío, C.P. 15165, Bergondo, en su propio nombre y representación.',{size:10,after:4});
      wr(`De otra parte, ${clienteBloque}`,{size:10,after:4});
      wr('Ambas partes se reconocen mutua y recíprocamente capacidad legal y representación suficientes para el otorgamiento del presente acuerdo y a tal efecto,',{size:10,after:7});

      wr('EXPONEN',{size:11,bold:true,after:4});
      wr('I. Que, las partes han llegado a un acuerdo en virtud del cual de forma recíproca se comprometen a poner en relación, la una a la otra y viceversa, con potenciales clientes que pudieran estar interesados en adquirir los servicios ofrecidos por cada una de las partes.',{size:10,after:4});
      wr('II. Que, cada acuerdo al que lleguen las partes con los clientes aportados, será objeto de un ANEXO DE CONDICIONES de cada cliente independientemente, que se adjuntará al presente acuerdo.',{size:10,after:4});
      wr('III. Que, con el fin de realizar las oportunas negociaciones y para la debida ejecución futura de las OPERACIONES originadas entre las partes, firman el presente Acuerdo de Confidencialidad y Colaboración.',{size:10,after:4});
      wr('Y ello, con arreglo a las siguientes',{size:10,after:7});

      wr('ESTIPULACIONES',{size:11,bold:true,after:5});

      wr('PRIMERA.- INDEPENDENCIA DE LAS PARTES',{size:10,bold:true,after:2});
      wr('En sus relaciones las Partes actuarán según su leal saber y entender, asumiendo su correcta realización, sin sujetarse en ningún caso al ámbito organizativo y rector de la otra.',{size:10,after:2});
      wr('Las relaciones entre las Partes que se contemplan en el presente acuerdo son las propias de dos personas independientes la una de la otra y frente a terceros.',{size:10,after:2});
      wr('Ninguna de las partes, ni sus empleados, actúa o podrá interpretarse que actúa como representante, agente o mandatario de la otra, ni sus actos y omisiones podrán dar lugar a vínculo alguno que obligue a la otra parte frente a terceros.',{size:10,after:2});
      wr('Sin perjuicio de lo anterior, las Partes se obligan, recíprocamente, a prestarse todo el auxilio y colaboración que sea necesario, así como a intercambiar cuantos documentos e información se requiera en cada momento.',{size:10,after:5});

      wr('SEGUNDA.- INTERCAMBIO DE INFORMACIÓN.-',{size:10,bold:true,after:2});
      wr('Tras la firma del presente acuerdo, las partes se proporcionarán la información relevante de las distintas Operaciones.',{size:10,after:2});
      wr('Las partes se facilitarán las reuniones o comunicaciones precisas con los clientes, si fuere el caso, con la exclusiva finalidad y mejor ejecución del contrato.',{size:10,after:5});

      wr('TERCERA.- CONFIDENCIALIDAD.-',{size:10,bold:true,after:2});
      wr('El presente acuerdo, así como toda la información aportada por las partes en relación con lo establecido en este acuerdo tendrá carácter confidencial y no podrá ser revelada a terceros para cualesquiera otros usos distintos al señalado sin el previo consentimiento por escrito de las partes.',{size:10,after:2});
      wr('A los efectos de este acuerdo, tendrá la consideración de información confidencial toda información relativa a la Operación susceptible de ser revelada de palabra, por escrito o por cualquier otro medio o soporte, tangible o intangible, que las partes se intercambien, incluida la información que se pudiere facilitar. Incluye, sin limitación, datos de mercado y criterios, planificación, documentación y planes, clientela, proveedores, precios, información financiera, ideas y cualquier informe, estudio y análisis realizado por cualesquiera de las partes firmantes o cualesquiera de sus asesores o agentes o colaboradores o proveedores, ya internos o externos, conteniendo o reflejando dicha información.',{size:10,after:2});
      wr('Las partes se obligan a suscribir un contrato de confidencialidad respecto de la información que las mismas se puedan suministrar en el marco del presente acuerdo y contratos que dimanan del mismo.',{size:10,after:2});
      wr('Las partes se comprometen a adoptar las medidas oportunas, para asegurar el tratamiento confidencial de dicha información, medidas que no serán menores que las aplicadas por ellas a su propia información confidencial, asumiendo las siguientes obligaciones:',{size:10,after:2});
      wr('1. Las partes, sus respectivos directivos, socios, empleados y asesores tratarán de modo confidencial cualquier información relativa a la Operación que les sea proporcionada, así como cualquier otra información, informes, resultados, resúmenes u otros datos elaborados a partir de aquélla, comprometiéndose a usar la información confidencial para llevar a cabo la Operación única y exclusivamente, absteniéndose de utilizarla para cualesquiera otros usos distintos al señalado. Quedando expresamente prohibido utilizar dicha información, en especial la relativa a clientes y proveedores, para ser utilizadas o utilizarlos en futuras operaciones en las que no intervengan conjuntamente ambas partes. Es decir, existe reserva de clientes y proveedores.',{size:10,indent:5,after:2});
      wr('2. Permitir el acceso a la información confidencial únicamente a aquellas personas que necesiten la información para el desarrollo de tareas para las que el uso de esta información sea estrictamente necesaria, advirtiendo a dichas personas de sus obligaciones respecto a la confidencialidad, y velando por el correcto cumplimiento de las mismas.',{size:10,indent:5,after:2});
      wr('3. Comunicarse toda filtración de información de la que se tenga o llegue a tener conocimiento, producida por la vulneración de las obligaciones de confidencialidad o infidelidad de las personas que hayan accedido a la información confidencial, bien entendido que esa comunicación no exime a cada parte de su propia responsabilidad, pero si la incumple dará lugar a cuantas responsabilidades se deriven de dicha omisión en particular.',{size:10,indent:5,after:2});
      wr('4. En el caso de que cualquiera de las Partes lo solicite, las Partes estarán obligadas a devolver o a destruir de acuerdo con su petición, toda la información confidencial recibida, salvo aquella que requiera ser retenida en virtud de una ley.',{size:10,indent:5,after:2});
      wr('5. Limitar el uso de la información confidencial al estrictamente necesario para el cumplimiento del objeto de las Operaciones.',{size:10,indent:5,after:2});
      wr('6. No desvelar ni revelar la información confidencial a terceras personas, ni siquiera la existencia de la Operación hasta que ésta haya sido firmada.',{size:10,indent:5,after:2});
      wr('7. El alcance del presente Acuerdo de Confidencialidad no es aplicable a la información que se esté obligado a revelar por ley o por cualquier autoridad judicial o administrativa.',{size:10,indent:5,after:5});

      wr('CUARTA.- GASTOS.',{size:10,bold:true,after:2});
      wr('Las partes firmantes asumirán a su propia costa, sin poder repercutirlos a la contraria, los gastos en que incurran en la consecución de lo que constituye el objeto del contrato.',{size:10,after:5});

      wr('QUINTA.- DURACIÓN del acuerdo.',{size:10,bold:true,after:2});
      wr('El presente acuerdo tiene una validez de UN año desde su firma, salvo prórroga de las partes. Finalizado el presente acuerdo durante el plazo de DOS años desde su finalización, ninguna de las partes firmantes, podrá ponerse en contacto con los proveedores ni clientes del otro. Y si lo hicieren, se establece como cláusula penal a recibir por la contraparte que no ha incumplido el importe de un 5% del importe bruto a que ascienda el contrato que hubieren suscrito por sí o por persona interpuesta.',{size:10,after:5});

      wr('SEXTA.- COMISION.',{size:10,bold:true,after:2});
      wr('De forma genérica NO se pacta una comisión por la cantidad intermediada en el concepto proyecto, sino que se pactará en relación a cada concreta operación que se presente, y que se procederá a percibir, en su caso y si se llegase a la consecución de la intermediación, en el plazo de CINCO días desde la consecución del contrato, a contar desde que el principal cobre sus honorarios. Constituyendo la base imponible para el cobro de la comisión la del contrato principal.',{size:10,after:2});
      wr('Dicha comisión deberá estar recogida en el ANEXO DE CONDICIONES.',{size:10,after:5});

      wr('SÉPTIMA.- INTERLOCUTORES.',{size:10,bold:true,after:2});
      wr('A los efectos de las comunicaciones que deban efectuarse entre las partes, se establecen como datos de contacto los siguientes:',{size:10,after:4});
      wr('D. ANTONIO REY PEREIRO',{size:10,bold:true,after:1});
      wr('Calle de la Playa 18 - Gandarío',{size:10,after:1});
      wr('15165 Bergondo (A Coruña)',{size:10,after:1});
      wr('(+34) 672 274969',{size:10,after:1});
      wr('arey@quenecesitashoy.es',{size:10,after:4});
      wr(nombreFirma,{size:10,bold:true,after:1});
      if(isEmpresa&&repNombre!==contact.name) wr(`Representante: D./Dña. ${repNombre}`,{size:10,after:1});
      if(dir!=='___________') wr(dir,{size:10,after:1});
      if(cp||loc) wr(`${cp} ${loc}`.trim(),{size:10,after:1});
      if(phone) wr(phone,{size:10,after:1});
      if(email) wr(email,{size:10,after:5});

      wr('OCTAVA.- PROTECCIÓN DE DATOS',{size:10,bold:true,after:2});
      wr('Las Partes se comprometen a cumplir, en todo momento, las disposiciones contenidas en el Reglamento (UE) 2016/679, de 27 de abril (RGPD), y la Ley Orgánica 3/2018, de 5 de diciembre (LOPDGDD), y en la restante normativa vigente en materia de datos de carácter personal, adoptando todas las medidas de índole técnica y organizativas necesarias para garantizar la seguridad, confidencialidad e integridad de los Datos de carácter personal.',{size:10,after:5});

      wr('NOVENA.- ACUERDO ÚNICO',{size:10,bold:true,after:2});
      wr('Este Acuerdo sólo podrá modificarse cuando las Partes así lo acuerden por escrito.',{size:10,after:2});
      wr('En el supuesto de que cualquiera de los términos y condiciones de este Acuerdo sea declaradas nulos o inaplicables, los restantes términos y condiciones del mismo continuarán estando en vigor.',{size:10,after:2});
      wr('Las Partes declaran que no existen otros acuerdos o pactos entre ellos.',{size:10,after:5});

      wr('DÉCIMA.- COMPETENCIA JURISDICCIONAL.',{size:10,bold:true,after:2});
      wr('Las partes intervinientes se someten a la jurisdicción de los Tribunales de la ciudad de A Coruña para todo litigio, discrepancia, cuestión o reclamación resultante de la ejecución o interpretación del presente documento.',{size:10,after:2});
      wr('La legislación aplicable será la legislación española.',{size:10,after:8});

      wr('Y, en prueba de conformidad, ambas partes firman y rubrican el presente acuerdo en el lugar y fecha del encabezamiento.',{size:10,after:10});

      // Bloque de firmas — nueva página si no hay espacio suficiente
      if(y>PH-MB-55){doc.addPage();y=30;}
      const cL=ML,cR=PW/2+10;
      doc.setFontSize(10);doc.setFont('helvetica','bold');
      doc.text('ANTONIO REY PEREIRO',cL,y);doc.text(nombreFirma.toUpperCase().slice(0,35),cR,y);y+=5;
      doc.setFont('helvetica','normal');
      if(isEmpresa){
        doc.text('34.890.867.M',cL,y);doc.text(repNombre,cR,y);y+=5;
        doc.text('',cL,y);doc.text(repDni,cR,y);y+=9;
      }else{
        doc.text('34.890.867.M',cL,y);doc.text(dniCif,cR,y);y+=14;
      }
      doc.text('______________________________',cL,y);doc.text('__________________________',cR,y);y+=5;
      doc.text('Fdo.: Antonio Rey Pereiro',cL,y);
      if(isEmpresa){doc.text(`Fdo.: ${razSocial.slice(0,35)}`,cR,y);}
      else{doc.text(`Fdo.: ${contact.name}`,cR,y);}

      // Nombre de archivo y descarga
      const fechaFile=today();
      const slug=(isEmpresa?razSocial:contact.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9\s]/g,'').trim().replace(/\s+/g,'_');
      const fileName=`Acuerdo_Confidencialidad_${slug}_${fechaFile}.pdf`;
      doc.save(fileName);

      // Guardar en Supabase Storage + tabla documents
      const pdfBlob=doc.output('blob');
      const storagePath=`${contact.id}/Acuerdo_Confidencialidad_${fechaFile}.pdf`;
      console.log('[Acuerdo] Subiendo a Storage, path:', storagePath);
      const{data:upData,error:upErr}=await supabase.storage.from('documentos').upload(storagePath,pdfBlob,{contentType:'application/pdf',upsert:true});
      console.log('[Acuerdo] Storage upload → data:', upData, 'error:', upErr);
      if(upErr){
        alert('El PDF se descargó pero no se pudo guardar en Supabase:\n'+upErr.message);
      }else{
        const docRecord={id:genId(),contact_id:contact.id,nombre:`Acuerdo de Confidencialidad ${fechaFile}`,tipo:'pdf',url:storagePath,uploaded_by:user.id,created_at:fechaFile};
        console.log('[Acuerdo] Insertando en documents:', docRecord);
        const{data:insData,error:insErr}=await supabase.from('documents').insert(docRecord).select().single();
        console.log('[Acuerdo] INSERT documents → data:', insData, 'error:', insErr);
        if(insErr){
          alert('Guardado en Storage pero error en tabla documents:\n'+insErr.message+'\nCódigo: '+insErr.code);
        }else{
          setDocRefreshKey(k=>k+1);
          setTab('documentos');
        }
      }
    }catch(e){
      alert('Error al generar el acuerdo: '+e.message);
    }finally{
      setGenerating(false);
    }
  };

  const infoRows=[
    ["📞 Teléfono",contact.phone||"—"],
    ["📧 Email",contact.email||"—"],
    ["🪪 DNI/CIF",contact.dniCif||"—"],
    ["👤 Comercial",com?.name||"—"],
    ["📅 Alta",contact.createdAt],
    ...(contact.direccion?[["📍 Dirección",contact.direccion]]:[]),
    ...(contact.localidad?[["🏘️ Localidad",[contact.localidad,contact.codigoPostal,contact.provincia].filter(Boolean).join(" · ")]]:[]),
  ];

  return (
    <div className="mb" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo mo-lg">
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:56,height:56,background:"#00208F",borderRadius:"50% 50% 50% 0",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Poppins',sans-serif",fontWeight:700,color:"white",fontSize:22,flexShrink:0}}>{contact.name.charAt(0)}</div>
            <div>
              <div className="eyebrow" style={{marginBottom:2}}>Ficha de contacto</div><h2 style={{fontFamily:"'Poppins',sans-serif",fontSize:26,fontWeight:700,letterSpacing:"-.03em",color:"#0B1233",lineHeight:1.15}}>{contact.name}</h2>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                {contactLineas.map(l=>{const lx=LINEAS[l]||{};return <span key={l} className="tag" style={{background:lx.light,color:lx.color}}>{lx.label}</span>;})}
                <span className="tag" style={{background:contact.tipo==="cliente"?"#00208F":"#FFB81C",color:contact.tipo==="cliente"?"white":"#0B1233"}}>{contact.tipo==="cliente"?"Cliente":"Prospecto"}</span>
                {contact.empresa&&<span style={{fontSize:11,color:"#5B6178"}}>🏢 {contact.empresa}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {contact.tipo==="prospecto"&&onToClient&&(
              <button className="btn-a" style={{fontSize:13}} onClick={()=>{setSelectedDealId(contactDeals[0]?.id||"");setShowConvert(true);}}>→ Convertir a cliente</button>
            )}
            {contactLineas.includes("subastas")&&(
              <button className="btn-p" style={{fontSize:11,background:"#7c3aed",opacity:generating?0.6:1}} onClick={generateAcuerdo} disabled={generating}>{generating?"Generando...":"📄 Acuerdo confidencialidad"}</button>
            )}
            {contact.email&&<button className="btn-g" style={{fontSize:12}} onClick={()=>{setEmailForm({asunto:"",mensaje:""});setEmailAttachments([]);setShowEmail(true);}}>Enviar email</button>}
            <button className="btn-g" style={{fontSize:12}} onClick={onEdit}>Editar</button>
            <button className="btn-g" style={{fontSize:12}} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Info grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16,background:"#F6F5F1",borderRadius:"20px 20px 20px 0",padding:20,marginBottom:18,border:"1px solid #E4E2DA"}}>
          {infoRows.map(([k,v])=>(
            <div key={k}><p className="mono" style={{fontSize:10,color:"#5B6178",textTransform:"uppercase",letterSpacing:".08em"}}>{k}</p><p style={{fontSize:14,fontWeight:500,color:"#0B1233",marginTop:4,wordBreak:"break-word"}}>{v}</p></div>
          ))}
        </div>
        {contact.notas&&<div style={{background:"#FFF4D6",borderRadius:"14px 14px 14px 0",padding:14,marginBottom:18,fontSize:14,color:"#0B1233"}}><span className="mono" style={{fontSize:10,letterSpacing:".08em",color:"#5B6178",display:"block",marginBottom:4}}>NOTAS</span>{contact.notas}</div>}

        {/* Tabs */}
        <div className="tabs-scroll" style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[
            ["historial","📋 Historial"],
            ["documentos","📎 Documentos"],
            ["presupuestos","💰 Presupuestos"],
            ["acciones","🎯 Próximas acciones"],
          ].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {tab==="historial"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:12,color:"#5B6178",fontWeight:600}}>{interactions.length} actuaciones</span>
              <button className="btn-p" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>setShowF(s=>!s)}>+ Nueva actuación</button>
            </div>
            {showF&&(
              <div style={{background:"#F6F5F1",borderRadius:"14px 14px 14px 0",padding:14,marginBottom:14}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div><label className="fl">Tipo</label>
                    <select className="fi" value={ni.tipo} onChange={e=>setNi(f=>({...f,tipo:e.target.value}))}>
                      {INTERACTION_TIPOS.map(t=><option key={t} value={t}>{INTERACTION_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div><label className="fl">Fecha</label><input className="fi" type="date" value={ni.fecha} onChange={e=>setNi(f=>({...f,fecha:e.target.value}))} /></div>
                </div>
                <div><label className="fl">Descripción</label><textarea className="fi" rows={2} value={ni.descripcion} onChange={e=>setNi(f=>({...f,descripcion:e.target.value}))} placeholder="Describe la actuación..." /></div>
                <div style={{display:"flex",gap:8,marginTop:9,justifyContent:"flex-end"}}>
                  <button className="btn-g" onClick={()=>setShowF(false)}>Cancelar</button>
                  <button className="btn-p" onClick={addI}>Guardar</button>
                </div>
              </div>
            )}
            {[...interactions].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(i=>{
              const u=users.find(u=>u.id===i.comercialId);
              return (
                <div key={i.id} className="ii">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{display:"flex",gap:7,alignItems:"center"}}>
                      <span style={{fontSize:17}}>{INTERACTION_ICONS[i.tipo]||"📝"}</span>
                      <div><span style={{fontSize:12,fontWeight:700,color:BRAND,textTransform:"capitalize"}}>{i.tipo}</span><span style={{fontSize:10,color:"#8A8FA3",marginLeft:7}}>{i.fecha} · {u?.name}</span></div>
                    </div>
                    <button onClick={()=>delI(i.id)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#fca5a5"}}>✕</button>
                  </div>
                  <p style={{fontSize:12,color:"#3A4058",marginTop:5,lineHeight:1.5}}>{i.descripcion}</p>
                </div>
              );
            })}
            {interactions.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#8A8FA3",fontSize:12}}>Sin actuaciones aún. Registra el primer contacto.</p>}
          </div>
        )}
        {tab==="documentos"&&<DocumentsSection contactId={contact.id} user={user} refreshKey={docRefreshKey} />}
        {tab==="presupuestos"&&(
          <ContactQuotes contactId={contact.id} contacts={users} user={user} />
        )}
        {tab==="acciones"&&(
          <div style={{padding:"8px 0"}}>
            <p style={{fontSize:13,color:"#5B6178",marginBottom:10}}>Apunta aquí las próximas acciones con este contacto.</p>
            <div style={{background:"#F6F5F1",borderRadius:"14px 14px 14px 0",padding:14}}>
              <p style={{fontSize:12,color:"#5B6178"}}>💡 Usa el módulo de <strong>Tareas</strong> para crear recordatorios con fecha específica vinculados a este contacto.</p>
            </div>
          </div>
        )}
        {/* Modal enviar email */}
        {showEmail&&(
          <div className="mb" onClick={e=>e.target===e.currentTarget&&setShowEmail(false)}>
            <div className="mo" style={{maxWidth:500}}>
              <h2 style={{fontSize:16,fontWeight:800,color:BRAND,marginBottom:16}}>✉️ Enviar email</h2>
              <div style={{marginBottom:10}}>
                <label className="fl">Para</label>
                <input className="fi" value={contact.email} readOnly style={{background:"#F6F5F1",color:"#5B6178"}} />
              </div>
              <div style={{marginBottom:10}}>
                <label className="fl">Asunto</label>
                <input className="fi" value={emailForm.asunto} onChange={e=>setEmailForm(f=>({...f,asunto:e.target.value}))} placeholder="Escribe el asunto..." />
              </div>
              <div style={{marginBottom:14}}>
                <label className="fl">Mensaje</label>
                <textarea className="fi" rows={6} value={emailForm.mensaje} onChange={e=>setEmailForm(f=>({...f,mensaje:e.target.value}))} placeholder="Escribe el mensaje..." style={{resize:"vertical"}} />
              </div>
              {/* Adjuntos */}
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:emailAttachments.length>0?8:0}}>
                  <label className="fl" style={{margin:0}}>Adjuntos</label>
                  <label style={{cursor:"pointer"}}>
                    <span className="btn-g" style={{fontSize:11,padding:"4px 10px",display:"inline-block"}}>+ Adjuntar archivo</span>
                    <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp" style={{display:"none"}} onChange={e=>{
                      const files=Array.from(e.target.files);
                      setEmailAttachments(a=>[...a,...files.filter(f=>!a.find(x=>x.name===f.name&&x.size===f.size))]);
                      e.target.value='';
                    }} />
                  </label>
                </div>
                {emailAttachments.length>0&&(
                  <div style={{background:"#F6F5F1",borderRadius:"14px 14px 14px 0",padding:"8px 10px"}}>
                    {emailAttachments.map((f,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:i<emailAttachments.length-1?"1px solid #E4E2DA":"none"}}>
                        <span style={{fontSize:14}}>📎</span>
                        <span style={{flex:1,fontSize:11,color:"#3A4058",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</span>
                        <span style={{fontSize:10,color:"#8A8FA3",flexShrink:0}}>{(f.size/1024).toFixed(0)} KB</span>
                        <button onClick={()=>setEmailAttachments(a=>a.filter((_,j)=>j!==i))} style={{background:"none",border:"none",fontSize:13,cursor:"pointer",color:"#fca5a5",flexShrink:0}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button className="btn-g" onClick={()=>setShowEmail(false)}>Cancelar</button>
                <button className="btn-p" disabled={sendingEmail||!emailForm.asunto.trim()||!emailForm.mensaje.trim()} style={{opacity:sendingEmail?0.6:1}} onClick={async()=>{
                  setSendingEmail(true);
                  try{
                    // Convertir adjuntos a base64
                    const toB64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(f);});
                    const attachmentPayload=await Promise.all(emailAttachments.map(async f=>({content:await toB64(f),name:f.name})));
                    const payload={
                      sender:{name:user.name,email:user.email},
                      to:[{email:contact.email,name:contact.name}],
                      subject:emailForm.asunto,
                      textContent:emailForm.mensaje,
                    };
                    if(attachmentPayload.length>0) payload.attachment=attachmentPayload;
                    const res=await fetch('https://api.brevo.com/v3/smtp/email',{
                      method:'POST',
                      headers:{accept:'application/json','api-key':'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','content-type':'application/json'},
                      body:JSON.stringify(payload),
                    });
                    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(JSON.stringify(e));}
                    const adjuntosStr=emailAttachments.length>0?` | Adjuntos: ${emailAttachments.map(f=>f.name).join(', ')}`:'';
                    await supabase.from('interactions').insert({
                      id:genId(),
                      contact_id:contact.id,
                      tipo:'email',
                      fecha:today(),
                      descripcion:`Asunto: ${emailForm.asunto}${adjuntosStr} | ${emailForm.mensaje}`,
                      comercial_id:user.id,
                    });
                    setShowEmail(false);
                    alert('Email enviado correctamente');
                  }catch(e){
                    alert(`Error al enviar: ${e.message}`);
                  }finally{
                    setSendingEmail(false);
                  }
                }}>{sendingEmail?'Enviando...':'Enviar'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal convertir a cliente */}
        {showConvert&&(
          <div className="mb" onClick={e=>e.target===e.currentTarget&&setShowConvert(false)}>
            <div className="mo" style={{maxWidth:420}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#059669",marginBottom:10}}>→ Convertir a cliente</h2>
              <p style={{fontSize:13,color:"#3A4058",marginBottom:16}}><strong>{contact.name}</strong> pasará a ser cliente.</p>
              {contactDeals.length>0&&(
                <div style={{marginBottom:16}}>
                  <label className="fl">Oportunidad a marcar como ganada</label>
                  <select className="fi" value={selectedDealId} onChange={e=>setSelectedDealId(e.target.value)}>
                    <option value="">— No mover ninguna —</option>
                    {contactDeals.map(d=><option key={d.id} value={d.id}>{d.titulo} ({ETAPA_LABELS[d.etapa]||d.etapa})</option>)}
                  </select>
                  {selectedDealId&&<p style={{fontSize:11,color:"#059669",marginTop:5}}>✓ Se moverá a etapa ganada automáticamente</p>}
                </div>
              )}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button className="btn-g" onClick={()=>setShowConvert(false)}>Cancelar</button>
                <button className="btn-p" style={{background:"#059669"}} onClick={doConvert}>⭐ Confirmar conversión</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentsSection({contactId,user,refreshKey=0}) {
  const [docs,setDocs]=useState([]);
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{
    supabase.from('documents').select('*').eq('contact_id',contactId).order('created_at',{ascending:false}).then(({data})=>setDocs(data||[]));
  },[contactId,refreshKey]);

  const handleUpload=async(e)=>{
    console.log('[Upload] handleUpload ejecutado, archivo:', e.target.files[0]?.name, 'size:', e.target.files[0]?.size);
    const file=e.target.files[0]; if(!file)return;
    if(file.size>10*1024*1024){alert('Máximo 10MB por archivo');return;}
    setUploading(true);
    const compressedFile = await compressFileIfPdf(file);
    const path=`${contactId}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const {error:upErr}=await supabase.storage.from('documentos').upload(path,compressedFile);
    if(upErr){alert(`Error al subir: ${upErr.message}`);setUploading(false);return;}
    const tipo=file.name.split('.').pop().toLowerCase();
    const rec={id:genId(),contact_id:contactId,uploaded_by:user.id,nombre:file.name,tipo,url:path,created_at:today()};
    console.log('[Upload] Insertando en documents:', rec);
    const {data:inserted,error:insErr}=await supabase.from('documents').insert(rec).select().single();
    console.log('[Upload] INSERT documents → data:', inserted, 'error:', insErr);
    if(insErr){alert(`Archivo subido pero error al guardar registro: ${insErr.message}`);setUploading(false);return;}
    setDocs(d=>[inserted,...d]);
    setUploading(false); e.target.value='';
  };

  const handleDownload=async(doc)=>{
    const {data,error}=await supabase.storage.from('documentos').createSignedUrl(doc.url,3600);
    if(error){alert(`Error al descargar: ${error.message}`);return;}
    window.open(data.signedUrl,'_blank');
  };

  const handleDelete=async(doc)=>{
    if(!window.confirm(`¿Eliminar "${doc.nombre}"?`))return;
    await supabase.storage.from('documentos').remove([doc.url]);
    await supabase.from('documents').delete().eq('id',doc.id);
    setDocs(d=>d.filter(x=>x.id!==doc.id));
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:12,color:"#5B6178",fontWeight:600}}>{docs.length} documentos</span>
        <label style={{cursor:uploading?"not-allowed":"pointer"}}>
          <span className="btn-p" style={{fontSize:12,padding:"5px 12px",display:"inline-block",opacity:uploading?.6:1,background:BRAND}}>
            {uploading?"Subiendo...":"+ Subir documento"}
          </span>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{display:"none"}} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {docs.map(doc=>(
        <div key={doc.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F6F5F1",borderRadius:"14px 14px 14px 0",marginBottom:7}}>
          <span style={{fontSize:18}}>📄</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12,fontWeight:600,color:"#0B1233",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.nombre}</p>
            <p style={{fontSize:10,color:"#8A8FA3"}}>{doc.created_at}</p>
          </div>
          <button className="btn-g" style={{padding:"4px 9px",fontSize:11,flexShrink:0}} onClick={()=>handleDownload(doc)}>⬇️ Descargar</button>
          <button className="btn-g" style={{padding:"4px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca",flexShrink:0}} onClick={()=>handleDelete(doc)}>🗑️</button>
        </div>
      ))}
      {docs.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#8A8FA3",fontSize:12}}>Sin documentos. Sube el primer archivo.</p>}
    </div>
  );
}

function Pipeline({deals,contacts,users,user,onSaveDeal,onDeleteDeal,onMoveDeal,canSee}) {
  const lv=Object.keys(LINEAS).filter(l=>canSee(l));
  const [al,setAl]=useState(lv[0]||"alarmas");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [drag,setDrag]=useState(null);
  const [mobEtapa,setMobEtapa]=useState("");

  const etapas=ETAPAS[al]||[];
  const lDe=deals.filter(d=>d.linea===al).map(d=>(ETAPAS[al]||[]).includes(d.etapa)?d:{...d,etapa:(ETAPAS[al]||[])[0]});
  const activeMobEtapa=mobEtapa&&etapas.includes(mobEtapa)?mobEtapa:(etapas[0]||"");
  const openNew=()=>{setForm({linea:al,etapa:etapas[0],comercialId:user.id,valor:""});setModal("new");};
  const save=async()=>{if(!form.titulo?.trim())return;await onSaveDeal(form,modal==="new");setModal(null);};
  const del=id=>{if(window.confirm("¿Eliminar?"))onDeleteDeal(id);};
  const move=(did,e)=>onMoveDeal(did,e);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <><div className="eyebrow">Oportunidades</div><h1>Pipeline de Ventas</h1></>
          <p style={{color:"#8A8FA3",fontSize:12}}>{lDe.filter(d=>d.etapa!=="perdido").length} oportunidades activas</p>
        </div>
        <button className="btn-p" onClick={openNew}>+ Nueva oportunidad</button>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {lv.map(k=>(
          <button key={k} onClick={()=>setAl(k)} style={{padding:"6px 14px",borderRadius:"20px 20px 20px 0",border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:al===k?LINEAS[k].color:"#F6F5F1",color:al===k?"white":"#5B6178",transition:"all .2s"}}>
            {LINEAS[k].label} <span style={{opacity:.7}}>{deals.filter(d=>d.linea===k&&d.etapa!=="perdido").length}</span>
          </button>
        ))}
      </div>
      {/* Selector de etapa en móvil */}
      <div className="kanban-mob-sel">
        <label style={{fontSize:12,fontWeight:700,color:"#5B6178",flexShrink:0}}>Etapa:</label>
        <select className="fi" value={activeMobEtapa} onChange={e=>setMobEtapa(e.target.value)}>
          {etapas.map(e=><option key={e} value={e}>{ETAPA_LABELS[e]||e} ({lDe.filter(d=>d.etapa===e).length})</option>)}
        </select>
      </div>

      {/* Columna única en móvil */}
      <div className="kanban-mob-col">
        {(()=>{
          const etapa=activeMobEtapa;
          const ed=lDe.filter(d=>d.etapa===etapa);
          const ev=ed.reduce((s,d)=>s+(d.valor||0),0);
          const ip=etapa==="perdido";
          return (
            <div className="kc" style={{width:"100%",maxWidth:"100%"}}>
              <div style={{marginBottom:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,fontWeight:800,color:ip?"#dc2626":BRAND,textTransform:"uppercase",letterSpacing:".5px"}}>{ETAPA_LABELS[etapa]||etapa}</span>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {ev>0&&<span style={{fontSize:11,color:"#8A8FA3"}}>€{ev.toLocaleString("es-ES")}</span>}
                  <span style={{background:ip?"#fee2e2":BRAND_LIGHT,color:ip?"#dc2626":BRAND,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:"20px 20px 20px 0"}}>{ed.length}</span>
                </div>
              </div>
              {ed.map(deal=>{
                const c=contacts.find(c=>c.id===deal.contactId);
                const ln=LINEAS[deal.linea]||{};
                return (
                  <div key={deal.id} className="kcard" style={{borderLeftColor:ln.color,cursor:"default"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                      <p style={{fontSize:13,fontWeight:700,color:"#0B1233",lineHeight:1.3,flex:1,marginRight:5}}>{deal.titulo}</p>
                      <button onClick={()=>{setForm({...deal});setModal("edit");}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#8A8FA3",padding:"4px",flexShrink:0}}>✏️</button>
                    </div>
                    {c&&<p style={{fontSize:12,color:"#5B6178",marginBottom:4}}>👤 {c.name}</p>}
                    {deal.valor>0&&<p style={{fontSize:13,fontWeight:800,color:ln.color}}>€{deal.valor.toLocaleString("es-ES")}</p>}
                    {deal.notas&&<p style={{fontSize:11,color:"#8A8FA3",marginTop:4,borderTop:"1px solid #F6F5F1",paddingTop:4}}>{deal.notas}</p>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                      <select style={{fontSize:11,border:"1px solid #C9CBD3",borderRadius:6,padding:"3px 6px",background:"white",color:"#3A4058"}}
                        value={etapa} onChange={e=>move(deal.id,e.target.value)}>
                        {etapas.map(et=><option key={et} value={et}>{ETAPA_LABELS[et]||et}</option>)}
                      </select>
                      <button onClick={()=>del(deal.id)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#fca5a5",padding:"4px"}}>✕</button>
                    </div>
                  </div>
                );
              })}
              {ed.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:"#C9CBD3",fontSize:28}}>○<p style={{fontSize:12,marginTop:6}}>Sin oportunidades</p></div>}
            </div>
          );
        })()}
      </div>

      {/* Tablero completo — escritorio y tablet */}
      <div className="kanban-full">
        {etapas.map(etapa=>{
          const ed=lDe.filter(d=>d.etapa===etapa);
          const ev=ed.reduce((s,d)=>s+(d.valor||0),0);
          const ip=etapa==="perdido";
          return (
            <div key={etapa} className="kc" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag){move(drag,etapa);setDrag(null);}}}>
              <div style={{marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:800,color:ip?"#dc2626":BRAND,textTransform:"uppercase",letterSpacing:".5px"}}>{ETAPA_LABELS[etapa]||etapa}</span>
                  <span style={{background:ip?"#fee2e2":BRAND_LIGHT,color:ip?"#dc2626":BRAND,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:"20px 20px 20px 0"}}>{ed.length}</span>
                </div>
                {ev>0&&<p style={{fontSize:10,color:"#8A8FA3",marginTop:1}}>€{ev.toLocaleString("es-ES")}</p>}
              </div>
              {ed.map(deal=>{
                const c=contacts.find(c=>c.id===deal.contactId);
                const ln=LINEAS[deal.linea]||{};
                return (
                  <div key={deal.id} className="kcard" style={{borderLeftColor:ln.color}} draggable onDragStart={()=>setDrag(deal.id)} onDragEnd={()=>setDrag(null)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                      <p style={{fontSize:12,fontWeight:700,color:"#0B1233",lineHeight:1.3,flex:1,marginRight:5}}>{deal.titulo}</p>
                      <button onClick={()=>{setForm({...deal});setModal("edit");}} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#8A8FA3",padding:0}}>✏️</button>
                    </div>
                    {c&&<p style={{fontSize:11,color:"#5B6178",marginBottom:4}}>👤 {c.name}</p>}
                    {deal.valor>0&&<p style={{fontSize:12,fontWeight:800,color:ln.color}}>€{deal.valor.toLocaleString("es-ES")}</p>}
                    {deal.notas&&<p style={{fontSize:10,color:"#8A8FA3",marginTop:4,borderTop:"1px solid #F6F5F1",paddingTop:4}}>{deal.notas}</p>}
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                      <span style={{fontSize:9,color:"#c4c4c4"}}>{deal.updatedAt}</span>
                      <button onClick={()=>del(deal.id)} style={{background:"none",border:"none",fontSize:10,cursor:"pointer",color:"#fca5a5"}}>✕</button>
                    </div>
                  </div>
                );
              })}
              {ed.length===0&&<div style={{textAlign:"center",padding:"14px 0",color:"#C9CBD3",fontSize:20}}>○</div>}
            </div>
          );
        })}
      </div>
      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>{modal==="new"?"Nueva oportunidad":"Editar"}</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Título *</label><input className="fi" value={form.titulo||""} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} /></div>
              <div><label className="fl">Línea</label>
                <select className="fi" value={form.linea||al} onChange={e=>setForm(f=>({...f,linea:e.target.value,etapa:ETAPAS[e.target.value][0]}))}>
                  {lv.map(k=><option key={k} value={k}>{LINEAS[k].label}</option>)}
                </select>
              </div>
              <div><label className="fl">Etapa</label>
                <select className="fi" value={form.etapa||""} onChange={e=>setForm(f=>({...f,etapa:e.target.value}))}>
                  {(ETAPAS[form.linea]||[]).map(e=><option key={e} value={e}>{ETAPA_LABELS[e]||e}</option>)}
                </select>
              </div>
              <div><label className="fl">Valor (€)</label><input className="fi" type="number" value={form.valor||""} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} /></div>
              <div><label className="fl">Contacto</label>
                <select className="fi" value={form.contactId||""} onChange={e=>setForm(f=>({...f,contactId:e.target.value}))}>
                  <option value="">Sin contacto</option>
                  {contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginTop:10}}><label className="fl">Notas</label><textarea className="fi" rows={2} value={form.notas||""} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} /></div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-p" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Si la tabla `tasks` de Supabase no tiene aún las columnas linea/hora, ejecutar manualmente:
// ALTER TABLE tasks ADD COLUMN IF NOT EXISTS linea text;
// ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hora time;

function TaskLineaBadge({linea}) {
  if(!linea||!LINEAS[linea]) return null;
  const lx=LINEAS[linea];
  return <span className="tag" style={{background:lx.light,color:lx.color,fontSize:10}}>{lx.label}</span>;
}

function TaskPrioridadBadge({prioridad}) {
  const bg=prioridad==="alta"?"#fee2e2":prioridad==="media"?"#fffbeb":"#f3f4f6";
  const c=prioridad==="alta"?"#dc2626":prioridad==="media"?"#d97706":"#5B6178";
  return <span className="tag" style={{background:bg,color:c,fontSize:10}}>{prioridad}</span>;
}

function ChecklistProgreso({task}) {
  if (!Array.isArray(task.checklist) || !task.checklist.length) return null;
  const n = task.checklist.filter(i => i.done).length, t = task.checklist.length;
  return <span className="tag" style={{background:n===t?"#00208F":"#FFE7A8",color:n===t?"white":"#0B1233",fontSize:10}}>☑ {n}/{t}</span>;
}
function ChecklistLista({task,onToggle}) {
  if (!Array.isArray(task.checklist) || !task.checklist.length) return null;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:2,marginTop:8}}>
      {task.checklist.map(i => (
        <label key={i.id} style={{display:"flex",gap:9,alignItems:"flex-start",fontSize:13,color:i.done?"#8A8FA3":"#0B1233",cursor:"pointer",padding:"5px 0",borderTop:"1px solid #E4E2DA"}}>
          <input type="checkbox" checked={!!i.done} onChange={()=>onToggle(task.id,i.id)} style={{marginTop:2,accentColor:"#00208F",width:15,height:15,flexShrink:0}} />
          <span style={{textDecoration:i.done?"line-through":"none"}}>{i.label}</span>
        </label>
      ))}
    </div>
  );
}

function Tasks({tasks,deals,contacts,user,onSaveTask,onDeleteTask,onToggleTask,onToggleItem}) {
  const [vistaTask,setVistaTask]=useState("hoy");
  const [weekOffset,setWeekOffset]=useState(0);
  const [filter,setFilter]=useState("semana");
  const [fLinea,setFLinea]=useState("all");
  const [fPrioridad,setFPrioridad]=useState("all");
  const [fFechaDesde,setFFechaDesde]=useState("");
  const [fFechaHasta,setFFechaHasta]=useState("");
  const [collapsed,setCollapsed]=useState({});
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const {start,end}=weekRange();
  const hoy=today();

  const toggleDone=id=>onToggleTask(id);
  const del=id=>{if(window.confirm("¿Eliminar?"))onDeleteTask(id);};
  const save=async()=>{if(!form.titulo?.trim())return;await onSaveTask(form,modal==="new");setModal(null);};
  const openNew=(extra={})=>{setForm({prioridad:"media",fecha:today(),comercialId:user.id,...extra});setModal("new");};
  const openEdit=task=>{setForm({...task});setModal("edit");};

  // ── Vista Lista: filtros ──────────────────────────────────────────────
  const fil=tasks.filter(t=>{
    const passBase=filter==="todas"||(filter==="pendientes"&&!t.completada)||(filter==="semana"&&!t.completada&&t.fecha>=start&&t.fecha<=end)||(filter==="completadas"&&t.completada);
    const passLinea=fLinea==="all"||t.linea===fLinea;
    const passPrioridad=fPrioridad==="all"||t.prioridad===fPrioridad;
    const passDesde=!fFechaDesde||(t.fecha&&t.fecha>=fFechaDesde);
    const passHasta=!fFechaHasta||(t.fecha&&t.fecha<=fFechaHasta);
    return passBase&&passLinea&&passPrioridad&&passDesde&&passHasta;
  });

  // ── Vista Hoy ──────────────────────────────────────────────────────────
  const tasksHoy=tasks.filter(t=>t.fecha===hoy);
  const pendHoy=tasksHoy.filter(t=>!t.completada);
  const gruposHoy=[
    {key:"alta",label:"🔴 Alta"},
    {key:"media",label:"🟡 Normal"},
    {key:"baja",label:"🔵 Baja"},
  ].map(g=>({...g,items:tasksHoy.filter(t=>t.prioridad===g.key)}));
  const toggleCollapsed=k=>setCollapsed(c=>({...c,[k]:!c[k]}));

  const TaskRowHoy=({task})=>{
    const contact=contacts.find(c=>c.id===task.contactId);
    return (
      <div className="card" style={{padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:11,opacity:task.completada?.6:1,marginBottom:7}}>
        <input type="checkbox" checked={task.completada} onChange={()=>toggleDone(task.id)} style={{width:16,height:16,cursor:"pointer",accentColor:BRAND,flexShrink:0}} />
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:600,color:"#0B1233",textDecoration:task.completada?"line-through":"none"}}>{task.titulo}</p>
          <div style={{display:"flex",gap:9,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
            {task.hora&&<span style={{fontSize:10,color:"#5B6178"}}>🕒 {task.hora.slice(0,5)}</span>}
            {contact&&<span style={{fontSize:10,color:"#8A8FA3"}}>👤 {contact.name}</span>}
            <TaskLineaBadge linea={task.linea} />
            <ChecklistProgreso task={task} />
          </div>
          {Array.isArray(task.checklist)&&task.checklist.length>0&&(
            <details style={{marginTop:4}}><summary style={{fontSize:12,color:"#00208F",cursor:"pointer"}}>Ver lista</summary>
              <ChecklistLista task={task} onToggle={onToggleItem} />
            </details>
          )}
        </div>
        <button className="btn-g" style={{padding:"3px 8px",fontSize:11,flexShrink:0}} onClick={()=>openEdit(task)}>✏️</button>
      </div>
    );
  };

  const vistaHoyContent=(
    <div>
      <div style={{marginBottom:14}}>
        <h2 style={{fontSize:16,fontWeight:800,color:BRAND}}>Tareas de hoy — {new Date(hoy+"T00:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h2>
        <span className="tag" style={{background:pendHoy.length>0?"#fee2e2":"#d1fae5",color:pendHoy.length>0?"#dc2626":"#059669",marginTop:6,display:"inline-flex"}}>{pendHoy.length} tareas pendientes</span>
      </div>
      {tasksHoy.length===0?(
        <div className="card" style={{padding:40,textAlign:"center",color:"#8A8FA3"}}>
          <p style={{fontSize:32,marginBottom:8}}>🎉</p>
          <p style={{marginBottom:14}}>Sin tareas para hoy 🎉</p>
          <button className="btn-p" onClick={()=>openNew({fecha:hoy})}>+ Nueva tarea</button>
        </div>
      ):(
        gruposHoy.map(g=>g.items.length>0&&(
          <div key={g.key} style={{marginBottom:12}}>
            <button onClick={()=>toggleCollapsed(g.key)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:"6px 2px",width:"100%",textAlign:"left"}}>
              <span style={{fontSize:13,fontWeight:800,color:"#3A4058"}}>{g.label}</span>
              <span className="tag" style={{background:"#F6F5F1",color:"#5B6178"}}>{g.items.length}</span>
              <span style={{marginLeft:"auto",fontSize:11,color:"#8A8FA3"}}>{collapsed[g.key]?"▸":"▾"}</span>
            </button>
            {!collapsed[g.key]&&g.items.map(task=><TaskRowHoy key={task.id} task={task} />)}
          </div>
        ))
      )}
    </div>
  );

  // ── Vista Lista ────────────────────────────────────────────────────────
  const vistaListaContent=(
    <div>
      <div className="tabs-scroll" style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap"}}>
        {[["semana","📅 Esta semana"],["pendientes","⏳ Pendientes"],["completadas","✅ Completadas"],["todas","📋 Todas"]].map(([f,l])=>(
          <button key={f} className={`tab ${filter===f?"on":""}`} onClick={()=>setFilter(f)}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div>
          <label className="fl">Línea</label>
          <select className="fi" style={{maxWidth:170}} value={fLinea} onChange={e=>setFLinea(e.target.value)}>
            <option value="all">Todas las líneas</option>
            {Object.entries(LINEAS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Prioridad</label>
          <select className="fi" style={{maxWidth:140}} value={fPrioridad} onChange={e=>setFPrioridad(e.target.value)}>
            <option value="all">Todas</option>
            <option value="alta">🔴 Alta</option><option value="media">🟡 Normal</option><option value="baja">🔵 Baja</option>
          </select>
        </div>
        <div>
          <label className="fl">Fecha desde</label>
          <input className="fi" type="date" style={{maxWidth:150}} value={fFechaDesde} onChange={e=>setFFechaDesde(e.target.value)} />
        </div>
        <div>
          <label className="fl">Fecha hasta</label>
          <input className="fi" type="date" style={{maxWidth:150}} value={fFechaHasta} onChange={e=>setFFechaHasta(e.target.value)} />
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {fil.sort((a,b)=>{const p={alta:0,media:1,baja:2};return p[a.prioridad]-p[b.prioridad]||a.fecha.localeCompare(b.fecha);}).map(task=>{
          const deal=deals.find(d=>d.id===task.dealId);
          const contact=contacts.find(c=>c.id===task.contactId);
          const ov=!task.completada&&task.fecha<today();
          const tw=task.fecha>=start&&task.fecha<=end;
          return (
            <div key={task.id} className="card" style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:11,opacity:task.completada?.6:1,borderLeft:`4px solid ${ov?"#dc2626":task.prioridad==="alta"?"#d97706":task.prioridad==="media"?"#fbbf24":"#e5e7eb"}`}}>
              <input type="checkbox" checked={task.completada} onChange={()=>toggleDone(task.id)} style={{width:16,height:16,cursor:"pointer",accentColor:BRAND,flexShrink:0}} />
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:"#0B1233",textDecoration:task.completada?"line-through":"none"}}>{task.titulo}</p>
                <div style={{display:"flex",gap:9,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{fontSize:10,color:ov?"#dc2626":tw?"#d97706":"#8A8FA3",fontWeight:ov||tw?700:400}}>📅 {task.fecha}{ov?" ⚠️":tw?" 📌":""}</span>
                  {task.hora&&<span style={{fontSize:10,color:"#5B6178"}}>🕒 {task.hora.slice(0,5)}</span>}
                  {deal&&<span style={{fontSize:10,color:"#8A8FA3"}}>📋 {deal.titulo}</span>}
                  <ChecklistProgreso task={task} />
                  {contact&&<span style={{fontSize:10,color:"#8A8FA3"}}>👤 {contact.name}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                <TaskLineaBadge linea={task.linea} />
                <TaskPrioridadBadge prioridad={task.prioridad} />
                <button className="btn-g" style={{padding:"3px 8px",fontSize:11}} onClick={()=>openEdit(task)}>✏️</button>
                <button className="btn-g" style={{padding:"3px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>del(task.id)}>🗑️</button>
              </div>
            </div>
          );
        })}
        {fil.length===0&&<div className="card" style={{padding:40,textAlign:"center",color:"#8A8FA3"}}><p style={{fontSize:32,marginBottom:8}}>✅</p><p>No hay tareas en esta vista</p></div>}
      </div>
    </div>
  );

  // ── Vista Kanban ───────────────────────────────────────────────────────
  const kanbanCols=[
    {key:"pendiente",label:"📋 Pendiente",bg:"#F6F5F1",items:tasks.filter(t=>!t.completada&&t.fecha!==hoy)},
    {key:"en_curso",label:"⚙️ En curso",bg:"#fffbeb",items:tasks.filter(t=>!t.completada&&t.fecha===hoy)},
    {key:"completada",label:"✅ Completada",bg:"#ecfdf5",items:tasks.filter(t=>t.completada)},
  ];

  const vistaKanbanContent=(
    <div style={{display:"flex",gap:12,overflowX:"auto",paddingBottom:10,alignItems:"flex-start"}}>
      {kanbanCols.map(col=>(
        <div key={col.key} style={{flex:"0 0 260px",background:col.bg,borderRadius:"20px 20px 20px 0",padding:11,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9,flexShrink:0}}>
            <span style={{fontSize:12,fontWeight:800,color:BRAND}}>{col.label}</span>
            <span className="tag" style={{background:BRAND_LIGHT,color:BRAND}}>{col.items.length}</span>
          </div>
          <div style={{overflowY:"auto",flex:1}}>
            {col.items.map(task=>{
              const contact=contacts.find(c=>c.id===task.contactId);
              return (
                <div key={task.id} className="kcard" onClick={()=>openEdit(task)} style={{cursor:"pointer"}}>
                  <p style={{fontSize:12,fontWeight:700,color:"#0B1233",lineHeight:1.3,marginBottom:6,textDecoration:task.completada?"line-through":"none"}}>{task.titulo}</p>
                  {contact&&<p style={{fontSize:11,color:"#5B6178",marginBottom:5}}>👤 {contact.name}</p>}
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:5}}>
                    <TaskLineaBadge linea={task.linea} />
                    <TaskPrioridadBadge prioridad={task.prioridad} />
                  </div>
                  <p style={{fontSize:10,color:"#8A8FA3"}}>📅 {task.fecha}{task.hora?` · 🕒 ${task.hora.slice(0,5)}`:""}</p>
                </div>
              );
            })}
            {col.items.length===0&&<div style={{textAlign:"center",padding:"14px 0",color:"#C9CBD3",fontSize:20}}>○</div>}
          </div>
        </div>
      ))}
    </div>
  );

  // ── Vista Semana ───────────────────────────────────────────────────────
  const fmtD=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10);};
  const monday=(()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)+weekOffset*7);return d;})();
  const weekDays=[...Array(7)].map((_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return d;});
  const wStart=fmtD(weekDays[0]), wEnd=fmtD(weekDays[6]);
  const prioC={alta:{bg:"#FFB81C",c:"#0B1233"},media:{bg:"#DCE3FF",c:"#00208F"},baja:{bg:"#F0EFEA",c:"#5B6178"}};
  const overdue=weekOffset===0?tasks.filter(t=>!t.completada&&t.fecha&&t.fecha<wStart):[];
  const vistaSemanaContent=(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button className="btn-g" onClick={()=>setWeekOffset(o=>o-1)}>←</button>
        <button className="btn-g" onClick={()=>setWeekOffset(0)} disabled={weekOffset===0} style={{opacity:weekOffset===0?.5:1}}>Esta semana</button>
        <button className="btn-g" onClick={()=>setWeekOffset(o=>o+1)}>→</button>
        <span className="mono" style={{fontSize:12,letterSpacing:".08em",textTransform:"uppercase",color:"#5B6178",marginLeft:6}}>
          {weekDays[0].toLocaleDateString("es-ES",{day:"numeric",month:"short"})} – {weekDays[6].toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}
        </span>
        <span style={{flex:1}} />
        <span style={{fontSize:13,color:"#5B6178"}}>{tasks.filter(t=>t.fecha>=wStart&&t.fecha<=wEnd&&!t.completada).length} pendientes · {tasks.filter(t=>t.fecha>=wStart&&t.fecha<=wEnd&&t.completada).length} hechas</span>
      </div>
      {overdue.length>0&&(
        <div style={{background:"#FFF4D6",borderRadius:"14px 14px 14px 0",padding:"10px 14px",marginBottom:14,fontSize:13,color:"#0B1233",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span className="mono" style={{fontSize:10.5,letterSpacing:".08em"}}>VENCIDAS · {overdue.length}</span>
          {overdue.slice(0,4).map(t=><button key={t.id} onClick={()=>openEdit(t)} style={{background:"white",border:"1px solid #E4E2DA",borderRadius:"8px 8px 8px 0",padding:"3px 9px",fontSize:12,cursor:"pointer"}}>{t.titulo}</button>)}
          {overdue.length>4&&<span style={{fontSize:12,color:"#5B6178"}}>+{overdue.length-4} más</span>}
        </div>
      )}
      <div className="week-grid" style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(150px,1fr))",gap:10,overflowX:"auto",paddingBottom:8}}>
        {weekDays.map(d=>{
          const ds=fmtD(d); const isToday=ds===hoy; const wknd=d.getDay()===0||d.getDay()===6;
          const items=tasks.filter(t=>t.fecha===ds).sort((a,b)=>(a.completada-b.completada)||String(a.hora||"99").localeCompare(String(b.hora||"99")));
          return (
            <div key={ds} style={{background:isToday?"#DCE3FF":wknd?"#EFEDE6":"white",border:isToday?"1.5px solid #00208F":"1px solid #E4E2DA",borderRadius:"20px 20px 20px 0",padding:12,minHeight:260,display:"flex",flexDirection:"column"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <div>
                  <div className="mono" style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase",color:isToday?"#00208F":"#5B6178"}}>{d.toLocaleDateString("es-ES",{weekday:"short"})}{isToday?" · hoy":""}</div>
                  <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:700,fontSize:24,letterSpacing:"-.04em",color:"#0B1233",lineHeight:1.1}}>{d.getDate()}</div>
                </div>
                <button onClick={()=>openNew({fecha:ds})} title="Añadir tarea" style={{width:28,height:28,border:"none",background:isToday?"#00208F":"#F6F5F1",color:isToday?"white":"#00208F",borderRadius:"50% 50% 50% 0",cursor:"pointer",fontSize:16,fontWeight:700}}>+</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flex:1}}>
                {items.map(t=>{const c=contacts.find(x=>x.id===t.contactId);const p=prioC[t.prioridad]||prioC.baja;return(
                  <div key={t.id} onClick={()=>openEdit(t)} style={{background:"white",border:"1px solid #E4E2DA",borderLeft:`3px solid ${p.bg}`,borderRadius:"0 12px 12px 0",padding:"7px 9px",cursor:"pointer",opacity:t.completada?.55:1}}>
                    <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                      <input type="checkbox" checked={!!t.completada} onClick={e=>e.stopPropagation()} onChange={()=>toggleDone(t.id)} style={{marginTop:2,accentColor:"#00208F",flexShrink:0}} />
                      <div style={{minWidth:0}}>
                        {t.hora&&<div className="mono" style={{fontSize:10,color:"#5B6178"}}>{t.hora.slice(0,5)}</div>}
                        <div style={{fontSize:12.5,fontWeight:500,color:"#0B1233",lineHeight:1.3,textDecoration:t.completada?"line-through":"none",wordBreak:"break-word"}}>{t.titulo}</div>
                        {c&&<div style={{fontSize:11,color:"#5B6178",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>}
                        <div style={{marginTop:3}}><ChecklistProgreso task={t} /></div>
                      </div>
                    </div>
                  </div>);})}
                {items.length===0&&<div style={{fontSize:12,color:"#8A8FA3",textAlign:"center",marginTop:20}}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <><div className="eyebrow">Organización</div><h1>Tareas</h1></>
          <p style={{color:"#8A8FA3",fontSize:12}}>{tasks.filter(t=>!t.completada).length} pendientes</p>
        </div>
        <button className="btn-p" onClick={()=>openNew()}>+ Nueva tarea</button>
      </div>

      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {[["hoy","Hoy"],["semana","Semana"],["lista","Lista"],["kanban","Kanban"]].map(([v,l])=>(
          <button key={v} className={`tab ${vistaTask===v?"on":""}`} onClick={()=>setVistaTask(v)}>{l}</button>
        ))}
      </div>

      {vistaTask==="hoy"&&vistaHoyContent}
      {vistaTask==="lista"&&vistaListaContent}
      {vistaTask==="semana"&&vistaSemanaContent}
      {vistaTask==="kanban"&&vistaKanbanContent}

      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>{modal==="new"?"Nueva tarea":"Editar tarea"}</h2>
            {modal!=="new"&&form.notas&&<p style={{fontSize:13,color:"#3A4058",background:"#F6F5F1",borderRadius:"14px 14px 14px 0",padding:"10px 12px",marginBottom:14}}>{form.notas}</p>}
            {modal!=="new"&&Array.isArray(form.checklist)&&form.checklist.length>0&&(()=>{const live=tasks.find(t=>t.id===form.id)||form;return(
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><label className="fl" style={{marginBottom:0}}>Lista de comprobación</label><ChecklistProgreso task={live} /></div>
                <ChecklistLista task={live} onToggle={onToggleItem} />
              </div>);})()}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Título *</label><input className="fi" value={form.titulo||""} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} /></div>
              <div><label className="fl">Fecha</label><input className="fi" type="date" value={form.fecha||today()} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} /></div>
              <div><label className="fl">Hora</label><input className="fi" type="time" value={form.hora||""} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} /></div>
              <div><label className="fl">Prioridad</label>
                <select className="fi" value={form.prioridad||"media"} onChange={e=>setForm(f=>({...f,prioridad:e.target.value}))}>
                  <option value="alta">🔴 Alta</option><option value="media">🟡 Normal</option><option value="baja">🔵 Baja</option>
                </select>
              </div>
              <div><label className="fl">Línea</label>
                <select className="fi" value={form.linea||""} onChange={e=>setForm(f=>({...f,linea:e.target.value}))}>
                  <option value="">Sin línea</option>
                  {Object.entries(LINEAS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="fl">Contacto</label>
                <select className="fi" value={form.contactId||""} onChange={e=>setForm(f=>({...f,contactId:e.target.value}))}>
                  <option value="">Sin contacto</option>
                  {contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="fl">Oportunidad</label>
                <select className="fi" value={form.dealId||""} onChange={e=>setForm(f=>({...f,dealId:e.target.value}))}>
                  <option value="">Sin oportunidad</option>
                  {deals.map(d=><option key={d.id} value={d.id}>{d.titulo}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-p" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Team({users,contacts,deals,tasks,onAddUser,onDeleteUser,onSavePermisos,onInvite}) {
  const [teamTab,setTeamTab]=useState("interno");
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({});
  const [editP,setEditP]=useState(null);
  const [tmpP,setTmpP]=useState([]);
  const [tmpDesc,setTmpDesc]=useState("");
  const com=users.filter(u=>u.role!=="admin");

  const save=async()=>{if(!form.name?.trim()||!form.email?.trim())return;await onAddUser(form);setModal(false);};
  const del=id=>{if(window.confirm("¿Eliminar?"))onDeleteUser(id);};
  const saveP=async()=>{await onSavePermisos(editP,tmpP,tmpDesc);setEditP(null);};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:10}}>
        <div>
          <><div className="eyebrow">Administración</div><h1>Equipo</h1></>
          <p style={{color:"#8A8FA3",fontSize:12}}>{teamTab==="interno"?`${com.length} miembros`:"Colaboradores externos sin acceso al CRM"}</p>
        </div>
        {teamTab==="interno"&&<button className="btn-p" onClick={()=>{setForm({role:"comercial",lineaPermisos:["inmobiliaria"]});setModal(true);}}>+ Añadir</button>}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[["interno","👔 Equipo interno"],["colaboradores","🤝 Colaboradores"]].map(([t,l])=>(
          <button key={t} className={`tab ${teamTab===t?"on":""}`} onClick={()=>setTeamTab(t)}>{l}</button>
        ))}
      </div>

      {teamTab!=="interno"?(
        <Colaboradores />
      ):(
      <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {com.map(u=>{
          const md=deals.filter(d=>d.comercialId===u.id&&d.etapa!=="perdido");
          const mt=tasks.filter(t=>t.comercialId===u.id&&!t.completada);
          const mc=contacts.filter(c=>c.comercialId===u.id);
          const pip=md.reduce((s,d)=>s+(d.valor||0),0);
          const mgr=users.find(m=>m.id===u.managerId);
          const subs=users.filter(s=>s.managerId===u.id);
          return (
            <div key={u.id} className="card" style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <div style={{width:44,height:44,background:BRAND_LIGHT,borderRadius:"20px 20px 20px 0",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:BRAND,fontSize:18}}>{u.name.charAt(0)}</div>
                  <div>
                    <p style={{fontSize:13,fontWeight:700,color:BRAND}}>{u.name}</p>
                    <p style={{fontSize:10,color:"#8A8FA3"}}>{u.email}</p>
                    <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",background:u.role==="socio"?"#f5f3ff":BRAND_LIGHT,color:u.role==="socio"?"#7c3aed":BRAND,padding:"2px 7px",borderRadius:"20px 20px 20px 0",display:"inline-block",marginTop:2}}>{u.role}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button className="btn-g" style={{padding:"3px 7px",fontSize:11}} onClick={()=>{setEditP(u.id);setTmpP(u.lineaPermisos||[]);setTmpDesc(u.descripcionRol||"");}}>✏️</button>
                  <button className="btn-g" style={{padding:"3px 9px",fontSize:11}} title="Enviar email para crear o restablecer la contraseña" onClick={()=>onInvite&&onInvite(u.id,u.email)}>{u.authId?"Reenviar acceso":"Enviar acceso"}</button>
                  <button onClick={()=>del(u.id)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#fca5a5"}}>✕</button>
                </div>
              </div>
              {u.descripcionRol&&<p style={{fontSize:11,color:"#3A4058",marginBottom:6,fontStyle:"italic"}}>{u.descripcionRol}</p>}
              {mgr&&<p style={{fontSize:10,color:"#8A8FA3",marginBottom:6}}>👤 Responsable: {mgr.name}</p>}
              {subs.length>0&&<p style={{fontSize:10,color:"#8A8FA3",marginBottom:6}}>👥 Subcomerciales: {subs.map(s=>s.name).join(", ")}</p>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
                {[["Contactos",mc.length,"👥"],["Ops.",md.length,"📋"],["Tareas",mt.length,"✅"]].map(([l,v,i])=>(
                  <div key={l} style={{background:"#F6F5F1",borderRadius:"14px 14px 14px 0",padding:8,textAlign:"center"}}>
                    <p style={{fontSize:16,fontWeight:800,color:BRAND}}>{v}</p>
                    <p style={{fontSize:9,color:"#8A8FA3"}}>{i} {l}</p>
                  </div>
                ))}
              </div>
              <div style={{background:"#eff6ff",borderRadius:"14px 14px 14px 0",padding:"8px 11px",marginBottom:10}}>
                <p style={{fontSize:10,color:"#5B6178"}}>Pipeline activo</p>
                <p style={{fontSize:16,fontWeight:800,color:BRAND}}>€{pip.toLocaleString("es-ES")}</p>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {(u.lineaPermisos||[]).map(l=><span key={l} className="tag" style={{background:LINEAS[l]?.light,color:LINEAS[l]?.color,fontSize:10}}>{LINEAS[l]?.label}</span>)}
              </div>
            </div>
          );
        })}
      </div>

      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>Nuevo miembro</h2>
            {[["name","Nombre *","text"],["email","Email *","email"]].map(([k,l,t])=>(
              <div key={k} style={{marginBottom:11}}><label className="fl">{l}</label><input className="fi" type={t} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={k==="password"?"pass123":""} /></div>
            ))}
            <div style={{marginBottom:11}}><label className="fl">Rol</label>
              <select className="fi" value={form.role||"comercial"} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                <option value="comercial">Comercial</option><option value="socio">Socio</option>
              </select>
            </div>
            <div style={{marginBottom:13}}><label className="fl">Acceso a líneas</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:6}}>
                {Object.entries(LINEAS).map(([k,v])=>{
                  const has=(form.lineaPermisos||[]).includes(k);
                  return <button key={k} onClick={()=>setForm(f=>({...f,lineaPermisos:has?(f.lineaPermisos||[]).filter(x=>x!==k):[...(f.lineaPermisos||[]),k]}))} style={{padding:"5px 12px",borderRadius:"20px 20px 20px 0",border:"2px solid",fontSize:11,fontWeight:700,cursor:"pointer",borderColor:has?v.color:"#C9CBD3",background:has?v.light:"white",color:has?v.color:"#5B6178",transition:"all .2s"}}>{v.label}</button>;
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn-p" onClick={save}>Añadir</button>
            </div>
          </div>
        </div>
      )}

      {editP&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setEditP(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:6}}>✏️ Editar miembro</h2>
            <p style={{fontSize:13,color:"#5B6178",marginBottom:16}}>{users.find(u=>u.id===editP)?.name}</p>

            <div style={{marginBottom:16}}>
              <label className="fl">Descripción del rol</label>
              <input className="fi" value={tmpDesc} onChange={e=>setTmpDesc(e.target.value)} placeholder="Ej: Comercial Alarmas y Telefonía" />
            </div>

            <label className="fl">Acceso a líneas</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
              {Object.entries(LINEAS).map(([k,v])=>{
                const has=tmpP.includes(k);
                return (
                  <label key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:"14px 14px 14px 0",border:`1.5px solid ${has?v.color:"#C9CBD3"}`,background:has?v.light:"white",cursor:"pointer",fontSize:12,fontWeight:700,color:has?v.color:"#5B6178",transition:"all .2s"}}>
                    <input type="checkbox" checked={has} onChange={()=>setTmpP(p=>has?p.filter(x=>x!==k):[...p,k])} style={{width:15,height:15,accentColor:v.color,cursor:"pointer",flexShrink:0}} />
                    {v.label}
                  </label>
                );
              })}
            </div>

            <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setEditP(null)}>Cancelar</button>
              <button className="btn-p" onClick={saveP}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ─── Colaboradores externos ─────────────────────────────────────────────────
// Tabla Supabase: collaborators
// Columnas: id, nombre, tipo, email, telefono, lineas, comision_pct, estado, notas, created_at
function Colaboradores() {
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('collaborators').select('*').order('nombre');
    if (error) { console.error('[Colaboradores load]', error); alert(`Error al cargar colaboradores:\n${error.message}`); }
    setItems(data||[]);
    setLoading(false);
  };

  const openNew = () => { setForm({tipo:"captador",lineas:[],estado:"activo"}); setModal("new"); };
  const openEdit = c => { setForm({...c, lineas:parseLinea(c.lineas)}); setModal("edit"); };

  const save = async () => {
    if (!form.nombre?.trim()) return;
    const payload = {
      nombre:       form.nombre.trim(),
      tipo:         form.tipo || "captador",
      email:        form.email || null,
      telefono:     form.telefono || null,
      lineas:       Array.isArray(form.lineas) ? form.lineas : [],
      comision_pct: form.comision_pct !== "" && form.comision_pct != null ? Number(form.comision_pct) : null,
      estado:       form.estado || "activo",
      notas:        form.notas || null,
    };
    if (modal === "new") {
      const { data:rec, error } = await supabase.from('collaborators').insert({ id:genId(), ...payload, created_at:today() }).select().single();
      if (error) { console.error('[saveCollaborator]', error); alert(`Error al guardar colaborador:\n${error.message}`); return; }
      if (rec) setItems(items => [...items, rec].sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"")));
    } else {
      const { error } = await supabase.from('collaborators').update(payload).eq('id', form.id);
      if (error) { console.error('[saveCollaborator update]', error); alert(`Error al actualizar colaborador:\n${error.message}`); return; }
      setItems(items => items.map(i => i.id===form.id ? {...i,...payload} : i).sort((a,b)=>(a.nombre||"").localeCompare(b.nombre||"")));
    }
    setModal(null);
  };

  const del = async id => {
    if (!window.confirm("¿Eliminar colaborador?")) return;
    const { error } = await supabase.from('collaborators').delete().eq('id', id);
    if (error) { console.error('[deleteCollaborator]', error); alert(`Error al eliminar:\n${error.message}`); return; }
    setItems(items => items.filter(i => i.id !== id));
  };

  const filtered = items.filter(c => (c.nombre||"").toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{textAlign:"center",padding:48,color:"#8A8FA3"}}><p style={{fontSize:32,marginBottom:8}}>⏳</p><p>Cargando colaboradores...</p></div>;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <p style={{color:"#8A8FA3",fontSize:12}}>{filtered.length} colaboradores</p>
        <button className="btn-p" onClick={openNew}>+ Nuevo colaborador</button>
      </div>
      <input className="fi" style={{maxWidth:280,marginBottom:14}} placeholder="🔍 Buscar por nombre..." value={search} onChange={e=>setSearch(e.target.value)} />

      <div className="card" style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#F6F5F1"}}>
              {["Nombre","Tipo","Líneas","Estado","Teléfono",""].map(h=>(
                <th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"#5B6178",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.map(c=>{
              const lineas=parseLinea(c.lineas);
              const t=COLAB_TIPOS[c.tipo]||{};
              const activo=c.estado==="activo";
              return (
                <tr key={c.id} className="tr" style={{borderTop:"1px solid #F6F5F1"}}>
                  <td style={{padding:"9px 13px",fontSize:12,fontWeight:700,color:BRAND}}>{c.nombre}</td>
                  <td style={{padding:"9px 13px"}}><span className="tag" style={{background:t.light||"#f3f4f6",color:t.color||"#5B6178"}}>{t.label||c.tipo}</span></td>
                  <td style={{padding:"9px 13px"}}>
                    <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                      {lineas.map(l=>{const lx=LINEAS[l]||{};return <span key={l} className="tag" style={{background:lx.light,color:lx.color}}>{lx.label}</span>;})}
                      {lineas.length===0&&<span style={{fontSize:11,color:"#8A8FA3"}}>—</span>}
                    </div>
                  </td>
                  <td style={{padding:"9px 13px"}}><span className="tag" style={{background:activo?"#d1fae5":"#f3f4f6",color:activo?"#059669":"#5B6178"}}>{activo?"● Activo":"○ Inactivo"}</span></td>
                  <td style={{padding:"9px 13px",fontSize:12,color:"#3A4058"}}>{c.telefono||"—"}</td>
                  <td style={{padding:"9px 13px"}}>
                    <div style={{display:"flex",gap:4}}>
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11}} onClick={()=>openEdit(c)}>✏️</button>
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>del(c.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {filtered.length===0&&<p style={{textAlign:"center",padding:36,color:"#8A8FA3"}}>Sin colaboradores</p>}
        </div>
      </div>

      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>{modal==="new"?"Nuevo colaborador":"Editar colaborador"}</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Nombre *</label><input className="fi" value={form.nombre||""} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} /></div>
              <div><label className="fl">Tipo</label>
                <select className="fi" value={form.tipo||"captador"} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                  {Object.entries(COLAB_TIPOS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label className="fl">Estado</label>
                <select className="fi" value={form.estado||"activo"} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div><label className="fl">Email</label><input className="fi" type="email" value={form.email||""} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
              <div><label className="fl">Teléfono</label><input className="fi" value={form.telefono||""} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} /></div>
              <div><label className="fl">Comisión % habitual</label><input className="fi" type="number" min="0" max="100" step="0.1" value={form.comision_pct??""} onChange={e=>setForm(f=>({...f,comision_pct:e.target.value}))} /></div>
              <div style={{gridColumn:"1 / -1"}}>
                <label className="fl">Líneas con las que trabaja</label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:6}}>
                  {Object.entries(LINEAS).map(([k,v])=>{
                    const has=(Array.isArray(form.lineas)?form.lineas:[]).includes(k);
                    return (
                      <label key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:"14px 14px 14px 0",border:`1.5px solid ${has?v.color:"#C9CBD3"}`,background:has?v.light:"white",cursor:"pointer",fontSize:12,fontWeight:700,color:has?v.color:"#5B6178",transition:"all .2s"}}>
                        <input type="checkbox" checked={has} onChange={()=>setForm(f=>{const cur=Array.isArray(f.lineas)?f.lineas:[];return {...f,lineas:has?cur.filter(x=>x!==k):[...cur,k]};})} style={{width:15,height:15,accentColor:v.color,cursor:"pointer",flexShrink:0}} />
                        {v.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{marginTop:10}}><label className="fl">Notas</label><textarea className="fi" rows={2} value={form.notas||""} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} /></div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setModal(null)}>Cancelar</button>
              <button className="btn-p" onClick={save}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
