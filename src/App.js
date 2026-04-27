import { useState, useEffect } from "react";
import logo from "./Que Necesitas - Logo para web y Favicon.png";
import { supabase } from "./utils/supabase";
import Productos, { ContactQuotes } from "./Productos";
import Subastas from "./Subastas";

const BRAND = "#002292";
const BRAND_LIGHT = "#e6eaf8";

const LINEAS = {
  alarmas:      { label: "🔐 Alarmas / ADT",        color: "#dc2626", light: "#fef2f2" },
  energia:      { label: "⚡ Energía / Telefonía",  color: "#d97706", light: "#fffbeb" },
  inmobiliaria: { label: "🏠 Inmobiliaria",          color: "#059669", light: "#ecfdf5" },
  subastas:     { label: "⚖️ Subastas Judiciales",  color: "#7c3aed", light: "#f5f3ff" },
};

const ETAPAS = {
  alarmas:      ["prospecto","contacto","visita","propuesta","contrato","instalado","perdido"],
  energia:      ["prospecto","análisis","propuesta","firmado","activo","perdido"],
  inmobiliaria: ["captación","valoración","publicado","visita","oferta","cerrado","perdido"],
  subastas:     ["inversor","búsqueda","contacto_judicial","due_diligence","puja","adjudicado","perdido"],
};

const ETAPA_LABELS = {
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
  };
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [map[k] || k, v]));
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  .crm-root{font-family:'Barlow',system-ui,sans-serif;display:flex;height:100vh;overflow:hidden;background:#f0f3fb;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-thumb{background:#c5cde8;border-radius:3px;}
  input,select,textarea,button{font-family:'Barlow',system-ui,sans-serif;}
  .card{background:white;border-radius:14px;box-shadow:0 1px 4px rgba(0,35,146,.07),0 4px 12px rgba(0,35,146,.04);}
  .btn-p{background:#002292;color:white;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;}
  .btn-p:hover{background:#001a78;box-shadow:0 4px 14px rgba(0,35,146,.3);}
  .btn-g{background:transparent;border:1.5px solid #dde2f0;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;color:#374151;cursor:pointer;transition:all .2s;}
  .btn-g:hover{background:#f0f3fc;border-color:#b8c3e8;}
  .fi{width:100%;padding:8px 11px;border:1.5px solid #dde2f0;border-radius:8px;font-size:13px;outline:none;transition:border .2s;color:#1e2a4a;background:white;}
  .fi:focus{border-color:#002292;}
  .fl{font-size:11px;font-weight:700;color:#374151;margin-bottom:4px;display:block;text-transform:uppercase;letter-spacing:.5px;}
  .nav{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:9px;cursor:pointer;transition:all .2s;font-size:13px;font-weight:500;color:#6b7280;border:none;background:none;width:100%;text-align:left;}
  .nav:hover{background:#f0f3fc;color:#002292;}
  .nav.on{background:#002292;color:white;font-weight:600;}
  .tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;}
  .kc{flex:0 0 210px;background:#f8f9fd;border-radius:12px;padding:11px;}
  .kcard{background:white;border-radius:10px;padding:11px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,35,146,.06);cursor:grab;transition:all .2s;border-left:3px solid transparent;}
  .kcard:hover{box-shadow:0 4px 12px rgba(0,35,146,.12);transform:translateY(-2px);}
  .mb{position:fixed;inset:0;background:rgba(0,20,80,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;}
  .mo{background:white;border-radius:18px;padding:24px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;}
  .mo-lg{max-width:780px;}
  .tr:hover{background:#f8f9fd;}
  .tab{padding:6px 14px;border-radius:7px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;text-transform:uppercase;letter-spacing:.4px;}
  .tab.on{background:#002292;color:white;}
  .tab:not(.on){background:#f0f3fc;color:#6b7280;}
  .ii{border-left:3px solid #002292;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:8px;background:white;}
  .sc{background:white;border-radius:14px;padding:18px;border-left:4px solid;}
`;

function LoadingScreen() {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#002292 0%,#001a78 60%,#0a0050 100%)",fontFamily:"'Barlow',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{textAlign:"center",color:"white"}}>
        <img src={logo} style={{width:80,height:80,borderRadius:20,objectFit:"cover",marginBottom:20}} alt="logo" />
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,letterSpacing:"1px",marginBottom:12}}>queNECESITAS CRM</div>
        <p style={{fontSize:14,opacity:.7}}>Cargando datos...</p>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState({users:[],contacts:[],interactions:[],deals:[],tasks:[]});
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [sidebar, setSidebar] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [u, c, i, d, t] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('contacts').select('*'),
      supabase.from('interactions').select('*'),
      supabase.from('deals').select('*'),
      supabase.from('tasks').select('*'),
    ]);
    const deals = (d.data || []).map(toCamel);
    setData({
      users:        (u.data || []).map(toCamel),
      contacts:     (c.data || []).map(toCamel),
      interactions: (i.data || []).map(toCamel),
      deals,
      tasks:        (t.data || []).map(toCamel),
    });
    setLoading(false);
  };

  // ── Contacts ─────────────────────────────────────────────────────────────
  const saveContact = async (form, isNew) => {
    if (isNew) {
      const contactId = genId();
      const payload = toSnake({ ...form, id: contactId, createdAt: today() });
      const { data: rec, error } = await supabase.from('contacts').insert(payload).select().single();
      if (error) { console.error('[saveContact]', error); alert(`Error al guardar contacto:\n${error.message}`); return; }
      const newContact = rec ? toCamel(rec) : null;
      if (newContact) setData(d => ({ ...d, contacts: [...d.contacts, newContact] }));

      // Auto-crear deal en etapa inicial para nuevos prospectos
      if (form.tipo === 'prospecto' && form.linea) {
        const dealPayload = toSnake({
          id: genId(),
          contactId: contactId,
          linea: form.linea,
          etapa: (ETAPAS[form.linea] || [])[0] || 'prospecto',
          comercialId: form.comercialId,
          titulo: form.name,
          valor: 0,
          updatedAt: today(),
        });
        const { data: dealRec, error: dealErr } = await supabase.from('deals').insert(dealPayload).select().single();
        if (dealErr) console.error('[saveContact] auto-deal error:', dealErr);
        else if (dealRec) setData(d => ({ ...d, deals: [...d.deals, toCamel(dealRec)] }));
      }
    } else {
      const { error } = await supabase.from('contacts').update(toSnake(form)).eq('id', form.id);
      if (error) { console.error('[saveContact update]', error); alert(`Error al actualizar:\n${error.message}`); return; }
      setData(d => ({ ...d, contacts: d.contacts.map(c => c.id === form.id ? form : c) }));
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
      const { error } = await supabase.from('tasks').update(toSnake(form)).eq('id', form.id);
      if (error) { console.error('[saveTask update]', error); alert(`Error al actualizar tarea:\n${error.message}`); return; }
      setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === form.id ? form : t) }));
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

  // ── Users ─────────────────────────────────────────────────────────────────
  const addUser = async (form) => {
    const payload = toSnake({
      id:            genId(),
      name:          form.name,
      email:         form.email,
      password:      form.password || 'pass123',
      role:          form.role || 'comercial',
      lineaPermisos: form.lineaPermisos || ['alarmas', 'energia'],
      managerId:     form.managerId || null,
    });
    const { data: rec, error } = await supabase.from('users').insert(payload).select().single();
    if (!error) setData(d => ({ ...d, users: [...d.users, toCamel(rec)] }));
  };
  const deleteUser = async (id) => {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (!error) setData(d => ({ ...d, users: d.users.filter(u => u.id !== id) }));
  };
  const savePermisos = async (userId, permisos) => {
    const { error } = await supabase.from('users').update({ linea_permisos: permisos }).eq('id', userId);
    if (!error) setData(d => ({ ...d, users: d.users.map(u => u.id === userId ? { ...u, lineaPermisos: permisos } : u) }));
  };


  if (loading) return <LoadingScreen />;
  if (!user) return <Login users={data.users} onLogin={u=>{setUser(u);setView("dashboard");}} />;

  const canSee = l => ["admin","socio"].includes(user.role) || user.lineaPermisos?.includes(l);
  const vis = (user.role==="admin"||user.role==="socio") ? data.users.map(u=>u.id) : [user.id];
  const myCon = data.contacts.filter(c=>vis.includes(c.comercialId)&&canSee(c.linea));
  const myDea = data.deals.filter(d=>vis.includes(d.comercialId)&&canSee(d.linea));
  const myTas = data.tasks.filter(t=>vis.includes(t.comercialId));

  const navItems = [
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"contacts",icon:"👥",label:"Prospectos"},
    {id:"clients",icon:"🌟",label:"Clientes"},
    {id:"pipeline",icon:"📋",label:"Pipeline"},
    {id:"tasks",icon:"✅",label:"Tareas"},
    {id:"productos",icon:"📦",label:"Productos"},
    ...(canSee("subastas")?[{id:"subastas",icon:"⚖️",label:"Subastas"}]:[]),
    ...(["admin","socio"].includes(user.role)?[{id:"team",icon:"👔",label:"Equipo"}]:[]),
  ];

  return (
    <div className="crm-root">
      <style>{CSS}</style>
      {/* Sidebar */}
      <div style={{width:sidebar?216:56,background:"white",borderRight:"1px solid #e8ecf8",padding:"14px 8px",display:"flex",flexDirection:"column",transition:"width .3s",overflow:"hidden",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:22,padding:"0 4px"}}>
          <img src={logo} style={{width:36,height:36,borderRadius:10,flexShrink:0,objectFit:"cover"}} alt="logo" />
          {sidebar && <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:17,color:"#002292",whiteSpace:"nowrap"}}>queNECESITAS</span>}
        </div>
        {navItems.map(item=>(
          <button key={item.id} className={`nav ${view===item.id?"on":""}`} onClick={()=>setView(item.id)}>
            <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
            {sidebar&&<span style={{whiteSpace:"nowrap"}}>{item.label}</span>}
          </button>
        ))}
        <div style={{marginTop:"auto"}}>
          <div style={{borderTop:"1px solid #e8ecf8",paddingTop:10,display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,background:BRAND_LIGHT,borderRadius:50,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:BRAND,fontSize:13,flexShrink:0}}>{user.name.charAt(0)}</div>
            {sidebar&&<div style={{overflow:"hidden"}}><div style={{fontSize:12,fontWeight:700,color:BRAND,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div><div style={{fontSize:10,color:"#9ca3af",textTransform:"capitalize"}}>{user.role}</div></div>}
          </div>
          <button className="nav" onClick={()=>setUser(null)} style={{marginTop:4,color:"#dc2626"}}>
            <span>🚪</span>{sidebar&&<span>Salir</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{padding:"16px 20px"}}>
          <button onClick={()=>setSidebar(s=>!s)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",marginBottom:12,color:"#9ca3af"}}>☰</button>
          {view==="dashboard" && <Dashboard contacts={myCon} deals={myDea} tasks={myTas} user={user} />}
          {view==="contacts"  && <Contacts
            contacts={myCon.filter(c=>c.tipo==="prospecto")}
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
          />}
          {view==="clients"   && <Contacts
            contacts={myCon.filter(c=>c.tipo==="cliente")}
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
            isClients
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
          />}
          {view==="productos" && <Productos user={user} contacts={data.contacts} />}
          {view==="subastas"  && <Subastas user={user} contacts={data.contacts} users={data.users} />}
          {view==="team"      && <Team
            users={data.users}
            contacts={data.contacts}
            deals={data.deals}
            tasks={data.tasks}
            onAddUser={addUser}
            onDeleteUser={deleteUser}
            onSavePermisos={savePermisos}
          />}
        </div>
      </div>
    </div>
  );
}

function Login({users,onLogin}) {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const go=()=>{
    const u=users.find(u=>u.email===email&&u.password===pass);
    u?onLogin(u):setErr("Credenciales incorrectas");
  };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#002292 0%,#001a78 60%,#0a0050 100%)",fontFamily:"'Barlow',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{background:"white",borderRadius:20,padding:40,width:"100%",maxWidth:380,boxShadow:"0 24px 64px rgba(0,0,0,.35)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <img src={logo} style={{width:64,height:64,borderRadius:16,objectFit:"cover",margin:"0 auto 14px",display:"block"}} alt="queNECESITAS" />
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:800,color:"#002292",letterSpacing:"1px"}}>queNECESITAS CRM</h1>
          <p style={{color:"#9ca3af",fontSize:12,marginTop:4}}>Plataforma de ventas multisector · Galicia</p>
        </div>
        <div style={{marginBottom:12}}><label className="fl">Email</label><input className="fi" type="email" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} /></div>
        <div style={{marginBottom:18}}><label className="fl">Contraseña</label><input className="fi" type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} /></div>
        {err&&<p style={{color:"#dc2626",fontSize:12,marginBottom:12,textAlign:"center"}}>{err}</p>}
        <button className="btn-p" style={{width:"100%",padding:12,fontSize:14,borderRadius:10}} onClick={go}>Entrar</button>
      </div>
    </div>
  );
}

function Dashboard({contacts,deals,tasks,user}) {
  const canSee = l => ["admin","socio"].includes(user.role) || (user.lineaPermisos||[]).includes(l);
  const {start,end}=weekRange();
  const weekT=tasks.filter(t=>!t.completada&&t.fecha>=start&&t.fecha<=end);
  const total=deals.filter(d=>d.etapa!=="perdido").reduce((s,d)=>s+(d.valor||0),0);
  const byL=Object.keys(LINEAS).filter(canSee).map(l=>({l,count:deals.filter(d=>d.linea===l&&d.etapa!=="perdido").length,val:deals.filter(d=>d.linea===l&&d.etapa!=="perdido").reduce((s,d)=>s+(d.valor||0),0)}));
  const pending=tasks.filter(t=>!t.completada);
  return (
    <div>
      <div style={{marginBottom:20}}>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,color:BRAND}}>Dashboard</h1>
        <p style={{color:"#9ca3af",fontSize:13}}>Bienvenido, {user.name} · {new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
        {[
          {l:"Prospectos",v:contacts.filter(c=>c.tipo==="prospecto").length,i:"👥",c:BRAND},
          {l:"Clientes",v:contacts.filter(c=>c.tipo==="cliente").length,i:"🌟",c:"#059669"},
          {l:"Pipeline activo",v:"€"+total.toLocaleString("es-ES"),i:"💰",c:"#d97706"},
          {l:"Tareas esta semana",v:weekT.length,i:"📅",c:weekT.length>0?"#dc2626":"#6b7280"},
        ].map(s=>(
          <div key={s.l} className="sc" style={{borderLeftColor:s.c}}>
            <div style={{fontSize:24,marginBottom:6}}>{s.i}</div>
            <div style={{fontSize:24,fontWeight:800,color:s.c,fontFamily:"'Barlow Condensed',sans-serif"}}>{s.v}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
        <div className="card" style={{padding:20}}>
          <h3 style={{fontSize:13,fontWeight:800,color:BRAND,marginBottom:14,textTransform:"uppercase",letterSpacing:".5px"}}>Pipeline por línea</h3>
          {byL.map(item=>(
            <div key={item.l} style={{marginBottom:11}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{LINEAS[item.l].label}</span>
                <span style={{fontSize:11,color:"#6b7280"}}>{item.count} · €{item.val.toLocaleString("es-ES")}</span>
              </div>
              <div style={{height:6,background:"#f0f3fb",borderRadius:4}}>
                <div style={{height:"100%",width:`${Math.min(100,(item.val/(total||1))*100)}%`,background:LINEAS[item.l].color,borderRadius:4,transition:"width .5s"}} />
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:20}}>
          <h3 style={{fontSize:13,fontWeight:800,color:BRAND,marginBottom:14,textTransform:"uppercase",letterSpacing:".5px"}}>
            Tareas semana {start} → {end}
            {weekT.length>0&&<span style={{background:"#fee2e2",color:"#dc2626",fontSize:11,padding:"1px 7px",borderRadius:20,marginLeft:8}}>{weekT.length}</span>}
          </h3>
          {pending.slice(0,5).map(t=>(
            <div key={t.id} style={{display:"flex",gap:8,alignItems:"center",marginBottom:9,padding:"8px 10px",background:t.fecha>=start&&t.fecha<=end?"#fffbeb":"#f8f9fd",borderRadius:8}}>
              <span>{t.prioridad==="alta"?"🔴":t.prioridad==="media"?"🟡":"🟢"}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:12,fontWeight:600,color:"#1e2a4a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.titulo}</p>
                <p style={{fontSize:11,color:"#9ca3af"}}>{t.fecha}</p>
              </div>
            </div>
          ))}
          {pending.length===0&&<p style={{color:"#9ca3af",fontSize:13,textAlign:"center",padding:"16px 0"}}>¡Sin tareas pendientes! 🎉</p>}
        </div>
      </div>
    </div>
  );
}

function Contacts({contacts,interactions,users,deals,user,onSaveContact,onDeleteContact,onToClient,onSaveInteraction,onDeleteInteraction,canSee,isClients}) {
  const [search,setSearch]=useState("");
  const [fLinea,setFLinea]=useState("all");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [detail,setDetail]=useState(null);

  const filtered=contacts.filter(c=>(fLinea==="all"||c.linea===fLinea)&&(c.name.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search)||c.empresa?.toLowerCase().includes(search.toLowerCase())));
  const openNew=()=>{const defaultLinea=Object.keys(LINEAS).find(k=>canSee(k))||"alarmas";setForm({linea:defaultLinea,tipo:isClients?"cliente":"prospecto",comercialId:user.id});setModal("new");};
  const openEdit=c=>{setForm({...c});setModal("edit");};
  const save=async()=>{if(!form.name?.trim())return;await onSaveContact(form,modal==="new");setModal(null);};
  const del=id=>{if(window.confirm("¿Eliminar contacto?"))onDeleteContact(id);};
  const toClient=c=>onToClient(c);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:BRAND}}>{isClients?"🌟 Clientes":"👥 Prospectos"}</h1>
          <p style={{color:"#9ca3af",fontSize:12}}>{filtered.length} registros</p>
        </div>
        <button className="btn-p" onClick={openNew}>+ {isClients?"Nuevo cliente":"Nuevo prospecto"}</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input className="fi" style={{maxWidth:240}} placeholder="🔍 Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="fi" style={{maxWidth:190}} value={fLinea} onChange={e=>setFLinea(e.target.value)}>
          <option value="all">Todas las líneas</option>
          {Object.entries(LINEAS).filter(([k])=>canSee(k)).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f8f9fd"}}>
              {["Contacto","Empresa","Teléfono","Línea","Comercial","Alta",""].map(h=>(
                <th key={h} style={{padding:"9px 13px",textAlign:"left",fontSize:10,fontWeight:700,color:"#6b7280",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{filtered.map(c=>{
              const ln=LINEAS[c.linea]||{};
              const com=users.find(u=>u.id===c.comercialId);
              const ci=interactions.filter(i=>i.contactId===c.id);
              return (
                <tr key={c.id} className="tr" style={{borderTop:"1px solid #f0f3fb"}}>
                  <td style={{padding:"9px 13px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:32,height:32,background:ln.light,borderRadius:50,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:ln.color,fontSize:12,flexShrink:0}}>{c.name.charAt(0)}</div>
                      <div>
                        <button onClick={()=>setDetail(c)} style={{fontSize:12,fontWeight:700,color:BRAND,background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>{c.name}</button>
                        {["admin","socio"].includes(user.role)&&com&&<p style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{com.name}</p>}
                        <p style={{fontSize:10,color:"#9ca3af"}}>{ci.length>0&&<span style={{color:BRAND}}>📋 {ci.length} actuaciones</span>}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"9px 13px",fontSize:12,color:"#374151"}}>{c.empresa||"—"}</td>
                  <td style={{padding:"9px 13px",fontSize:12,color:"#374151"}}>{c.phone||"—"}</td>
                  <td style={{padding:"9px 13px"}}><span className="tag" style={{background:ln.light,color:ln.color}}>{ln.label}</span></td>
                  <td style={{padding:"9px 13px",fontSize:11,color:"#374151"}}>{com?.name||"—"}</td>
                  <td style={{padding:"9px 13px",fontSize:10,color:"#9ca3af"}}>{c.createdAt}</td>
                  <td style={{padding:"9px 13px"}}>
                    <div style={{display:"flex",gap:4}}>
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11}} onClick={()=>setDetail(c)}>📋</button>
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11}} onClick={()=>openEdit(c)}>✏️</button>
                      {!isClients&&<button className="btn-g" style={{padding:"4px 8px",fontSize:10,color:"#059669",borderColor:"#a7f3d0"}} onClick={()=>toClient(c)}>→ Cliente</button>}
                      <button className="btn-g" style={{padding:"4px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>del(c.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {filtered.length===0&&<p style={{textAlign:"center",padding:36,color:"#9ca3af"}}>Sin registros</p>}
        </div>
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
        onToClient={!isClients?onToClient:null}
      />}

      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>{modal==="new"?(isClients?"Nuevo cliente":"Nuevo prospecto"):"Editar"}</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              {/* Tipo de cliente */}
              <div style={{gridColumn:"1 / -1"}}>
                <label className="fl">Tipo de cliente</label>
                <select className="fi" value={form.tipo_cliente||"particular"} onChange={e=>setForm(f=>({...f,tipo_cliente:e.target.value}))}>
                  <option value="particular">Particular</option>
                  <option value="empresa">Empresa</option>
                </select>
              </div>
              {/* Línea — siempre visible */}
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Línea</label>
                <select className="fi" value={form.linea||"alarmas"} onChange={e=>setForm(f=>({...f,linea:e.target.value}))}>
                  {Object.entries(LINEAS).filter(([k])=>canSee(k)).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                </select>
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
                <div style={{gridColumn:"1 / -1",paddingTop:4,borderTop:"1px solid #e8ecf8"}}>
                  <p style={{fontSize:11,fontWeight:700,color:BRAND,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Datos de la empresa</p>
                </div>
                {[["empresa_razon_social","Razón Social *"],["empresa_cif","CIF"],["empresa_telefono","Teléfono empresa"],["empresa_email","Email empresa"]].map(([k,l])=>(
                  <div key={k}><label className="fl">{l}</label><input className="fi" value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value,name:k==="empresa_razon_social"?e.target.value:form.name}))} /></div>
                ))}
                <div style={{gridColumn:"1 / -1"}}><label className="fl">Dirección empresa</label><input className="fi" value={form.empresa_direccion||""} onChange={e=>setForm(f=>({...f,empresa_direccion:e.target.value}))} /></div>
                <div style={{gridColumn:"1 / -1",marginTop:6,paddingTop:10,borderTop:"1px solid #e8ecf8"}}>
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
  const ln=LINEAS[contact.linea]||{};
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
            <div style={{width:48,height:48,background:ln.light,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:ln.color,fontSize:20}}>{contact.name.charAt(0)}</div>
            <div>
              <h2 style={{fontSize:18,fontWeight:800,color:BRAND}}>{contact.name}</h2>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                <span className="tag" style={{background:ln.light,color:ln.color}}>{ln.label}</span>
                <span className="tag" style={{background:contact.tipo==="cliente"?"#d1fae5":"#eff6ff",color:contact.tipo==="cliente"?"#059669":"#2563eb"}}>{contact.tipo==="cliente"?"⭐ Cliente":"👤 Prospecto"}</span>
                {contact.empresa&&<span style={{fontSize:11,color:"#6b7280"}}>🏢 {contact.empresa}</span>}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {contact.tipo==="prospecto"&&onToClient&&(
              <button className="btn-p" style={{fontSize:12,background:"#059669"}} onClick={()=>{setSelectedDealId(contactDeals[0]?.id||"");setShowConvert(true);}}>⭐ Convertir a cliente</button>
            )}
            {(contact.linea==="subastas"||["admin","socio"].includes(user.role))&&(
              <button className="btn-p" style={{fontSize:11,background:"#7c3aed",opacity:generating?0.6:1}} onClick={generateAcuerdo} disabled={generating}>{generating?"Generando...":"📄 Acuerdo confidencialidad"}</button>
            )}
            <button className="btn-g" style={{fontSize:12}} onClick={onEdit}>✏️ Editar</button>
            <button className="btn-g" style={{fontSize:12}} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Info grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:9,background:"#f8f9fd",borderRadius:10,padding:13,marginBottom:16}}>
          {infoRows.map(([k,v])=>(
            <div key={k}><p style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px"}}>{k}</p><p style={{fontSize:12,fontWeight:600,color:"#1e2a4a",marginTop:2}}>{v}</p></div>
          ))}
        </div>
        {contact.notas&&<div style={{background:"#fffbeb",borderRadius:8,padding:11,marginBottom:16,fontSize:12,color:"#92400e",borderLeft:"3px solid #fbbf24"}}>📝 {contact.notas}</div>}

        {/* Tabs */}
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          {[["historial","📋 Historial"],["documentos","📎 Documentos"],["presupuestos","💰 Presupuestos"],["acciones","🎯 Próximas acciones"]].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {tab==="historial"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>{interactions.length} actuaciones</span>
              <button className="btn-p" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>setShowF(s=>!s)}>+ Nueva actuación</button>
            </div>
            {showF&&(
              <div style={{background:"#f8f9fd",borderRadius:10,padding:14,marginBottom:14}}>
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
                      <div><span style={{fontSize:12,fontWeight:700,color:BRAND,textTransform:"capitalize"}}>{i.tipo}</span><span style={{fontSize:10,color:"#9ca3af",marginLeft:7}}>{i.fecha} · {u?.name}</span></div>
                    </div>
                    <button onClick={()=>delI(i.id)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#fca5a5"}}>✕</button>
                  </div>
                  <p style={{fontSize:12,color:"#374151",marginTop:5,lineHeight:1.5}}>{i.descripcion}</p>
                </div>
              );
            })}
            {interactions.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#9ca3af",fontSize:12}}>Sin actuaciones aún. Registra el primer contacto.</p>}
          </div>
        )}
        {tab==="documentos"&&<DocumentsSection contactId={contact.id} user={user} refreshKey={docRefreshKey} />}
        {tab==="presupuestos"&&(
          <ContactQuotes contactId={contact.id} contacts={users} user={user} />
        )}
        {tab==="acciones"&&(
          <div style={{padding:"8px 0"}}>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:10}}>Apunta aquí las próximas acciones con este contacto.</p>
            <div style={{background:"#f0f3fb",borderRadius:10,padding:14}}>
              <p style={{fontSize:12,color:"#6b7280"}}>💡 Usa el módulo de <strong>Tareas</strong> para crear recordatorios con fecha específica vinculados a este contacto.</p>
            </div>
          </div>
        )}

        {/* Modal convertir a cliente */}
        {showConvert&&(
          <div className="mb" onClick={e=>e.target===e.currentTarget&&setShowConvert(false)}>
            <div className="mo" style={{maxWidth:420}}>
              <h2 style={{fontSize:17,fontWeight:800,color:"#059669",marginBottom:10}}>⭐ Convertir a cliente</h2>
              <p style={{fontSize:13,color:"#374151",marginBottom:16}}><strong>{contact.name}</strong> pasará a ser cliente.</p>
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
    const path=`${contactId}/${Date.now()}_${file.name}`;
    const {error:upErr}=await supabase.storage.from('documentos').upload(path,file);
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
        <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>{docs.length} documentos</span>
        <label style={{cursor:uploading?"not-allowed":"pointer"}}>
          <span className="btn-p" style={{fontSize:12,padding:"5px 12px",display:"inline-block",opacity:uploading?.6:1,background:BRAND}}>
            {uploading?"Subiendo...":"+ Subir documento"}
          </span>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{display:"none"}} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {docs.map(doc=>(
        <div key={doc.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#f8f9fd",borderRadius:8,marginBottom:7}}>
          <span style={{fontSize:18}}>📄</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12,fontWeight:600,color:"#1e2a4a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.nombre}</p>
            <p style={{fontSize:10,color:"#9ca3af"}}>{doc.created_at}</p>
          </div>
          <button className="btn-g" style={{padding:"4px 9px",fontSize:11,flexShrink:0}} onClick={()=>handleDownload(doc)}>⬇️ Descargar</button>
          <button className="btn-g" style={{padding:"4px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca",flexShrink:0}} onClick={()=>handleDelete(doc)}>🗑️</button>
        </div>
      ))}
      {docs.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#9ca3af",fontSize:12}}>Sin documentos. Sube el primer archivo.</p>}
    </div>
  );
}

function Pipeline({deals,contacts,users,user,onSaveDeal,onDeleteDeal,onMoveDeal,canSee}) {
  const lv=Object.keys(LINEAS).filter(l=>canSee(l));
  const [al,setAl]=useState(lv[0]||"alarmas");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [drag,setDrag]=useState(null);

  const etapas=ETAPAS[al]||[];
  const lDe=deals.filter(d=>d.linea===al);
  const openNew=()=>{setForm({linea:al,etapa:etapas[0],comercialId:user.id,valor:""});setModal("new");};
  const save=async()=>{if(!form.titulo?.trim())return;await onSaveDeal(form,modal==="new");setModal(null);};
  const del=id=>{if(window.confirm("¿Eliminar?"))onDeleteDeal(id);};
  const move=(did,e)=>onMoveDeal(did,e);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:BRAND}}>Pipeline de Ventas</h1>
          <p style={{color:"#9ca3af",fontSize:12}}>{lDe.filter(d=>d.etapa!=="perdido").length} oportunidades activas</p>
        </div>
        <button className="btn-p" onClick={openNew}>+ Nueva oportunidad</button>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:18,flexWrap:"wrap"}}>
        {lv.map(k=>(
          <button key={k} onClick={()=>setAl(k)} style={{padding:"6px 14px",borderRadius:20,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:al===k?LINEAS[k].color:"#f0f3fb",color:al===k?"white":"#6b7280",transition:"all .2s"}}>
            {LINEAS[k].label} <span style={{opacity:.7}}>{deals.filter(d=>d.linea===k&&d.etapa!=="perdido").length}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:10}}>
        {etapas.map(etapa=>{
          const ed=lDe.filter(d=>d.etapa===etapa);
          const ev=ed.reduce((s,d)=>s+(d.valor||0),0);
          const ip=etapa==="perdido";
          return (
            <div key={etapa} className="kc" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag){move(drag,etapa);setDrag(null);}}}>
              <div style={{marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:800,color:ip?"#dc2626":BRAND,textTransform:"uppercase",letterSpacing:".5px"}}>{ETAPA_LABELS[etapa]||etapa}</span>
                  <span style={{background:ip?"#fee2e2":BRAND_LIGHT,color:ip?"#dc2626":BRAND,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:20}}>{ed.length}</span>
                </div>
                {ev>0&&<p style={{fontSize:10,color:"#9ca3af",marginTop:1}}>€{ev.toLocaleString("es-ES")}</p>}
              </div>
              {ed.map(deal=>{
                const c=contacts.find(c=>c.id===deal.contactId);
                const ln=LINEAS[deal.linea]||{};
                return (
                  <div key={deal.id} className="kcard" style={{borderLeftColor:ln.color}} draggable onDragStart={()=>setDrag(deal.id)} onDragEnd={()=>setDrag(null)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                      <p style={{fontSize:12,fontWeight:700,color:"#1e2a4a",lineHeight:1.3,flex:1,marginRight:5}}>{deal.titulo}</p>
                      <button onClick={()=>{setForm({...deal});setModal("edit");}} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#9ca3af",padding:0}}>✏️</button>
                    </div>
                    {c&&<p style={{fontSize:11,color:"#6b7280",marginBottom:4}}>👤 {c.name}</p>}
                    {deal.valor>0&&<p style={{fontSize:12,fontWeight:800,color:ln.color}}>€{deal.valor.toLocaleString("es-ES")}</p>}
                    {deal.notas&&<p style={{fontSize:10,color:"#9ca3af",marginTop:4,borderTop:"1px solid #f0f3fb",paddingTop:4}}>{deal.notas}</p>}
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                      <span style={{fontSize:9,color:"#c4c4c4"}}>{deal.updatedAt}</span>
                      <button onClick={()=>del(deal.id)} style={{background:"none",border:"none",fontSize:10,cursor:"pointer",color:"#fca5a5"}}>✕</button>
                    </div>
                  </div>
                );
              })}
              {ed.length===0&&<div style={{textAlign:"center",padding:"14px 0",color:"#dde2f0",fontSize:20}}>○</div>}
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

function Tasks({tasks,deals,contacts,user,onSaveTask,onDeleteTask,onToggleTask}) {
  const [filter,setFilter]=useState("semana");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const {start,end}=weekRange();

  const fil=tasks.filter(t=>
    filter==="todas"||(filter==="pendientes"&&!t.completada)||(filter==="semana"&&!t.completada&&t.fecha>=start&&t.fecha<=end)||(filter==="completadas"&&t.completada)
  );
  const toggleDone=id=>onToggleTask(id);
  const del=id=>{if(window.confirm("¿Eliminar?"))onDeleteTask(id);};
  const save=async()=>{if(!form.titulo?.trim())return;await onSaveTask(form,modal==="new");setModal(null);};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:BRAND}}>Tareas</h1>
          <p style={{color:"#9ca3af",fontSize:12}}>{tasks.filter(t=>!t.completada).length} pendientes</p>
        </div>
        <button className="btn-p" onClick={()=>{setForm({prioridad:"media",fecha:today(),comercialId:user.id});setModal("new");}}>+ Nueva tarea</button>
      </div>
      <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
        {[["semana","📅 Esta semana"],["pendientes","⏳ Pendientes"],["completadas","✅ Completadas"],["todas","📋 Todas"]].map(([f,l])=>(
          <button key={f} className={`tab ${filter===f?"on":""}`} onClick={()=>setFilter(f)}>{l}</button>
        ))}
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
                <p style={{fontSize:13,fontWeight:600,color:"#1e2a4a",textDecoration:task.completada?"line-through":"none"}}>{task.titulo}</p>
                <div style={{display:"flex",gap:9,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:ov?"#dc2626":tw?"#d97706":"#9ca3af",fontWeight:ov||tw?700:400}}>📅 {task.fecha}{ov?" ⚠️":tw?" 📌":""}</span>
                  {deal&&<span style={{fontSize:10,color:"#9ca3af"}}>📋 {deal.titulo}</span>}
                  {contact&&<span style={{fontSize:10,color:"#9ca3af"}}>👤 {contact.name}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <span className="tag" style={{background:task.prioridad==="alta"?"#fee2e2":task.prioridad==="media"?"#fffbeb":"#f3f4f6",color:task.prioridad==="alta"?"#dc2626":task.prioridad==="media"?"#d97706":"#6b7280",fontSize:10}}>{task.prioridad}</span>
                <button className="btn-g" style={{padding:"3px 8px",fontSize:11}} onClick={()=>{setForm({...task});setModal("edit");}}>✏️</button>
                <button className="btn-g" style={{padding:"3px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>del(task.id)}>🗑️</button>
              </div>
            </div>
          );
        })}
        {fil.length===0&&<div className="card" style={{padding:40,textAlign:"center",color:"#9ca3af"}}><p style={{fontSize:32,marginBottom:8}}>✅</p><p>No hay tareas en esta vista</p></div>}
      </div>
      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="mo">
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>{modal==="new"?"Nueva tarea":"Editar tarea"}</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Título *</label><input className="fi" value={form.titulo||""} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} /></div>
              <div><label className="fl">Fecha</label><input className="fi" type="date" value={form.fecha||today()} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} /></div>
              <div><label className="fl">Prioridad</label>
                <select className="fi" value={form.prioridad||"media"} onChange={e=>setForm(f=>({...f,prioridad:e.target.value}))}>
                  <option value="alta">🔴 Alta</option><option value="media">🟡 Media</option><option value="baja">🟢 Baja</option>
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

function Team({users,contacts,deals,tasks,onAddUser,onDeleteUser,onSavePermisos}) {
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({});
  const [editP,setEditP]=useState(null);
  const [tmpP,setTmpP]=useState([]);
  const com=users.filter(u=>u.role!=="admin");

  const save=async()=>{if(!form.name?.trim()||!form.email?.trim())return;await onAddUser(form);setModal(false);};
  const del=id=>{if(window.confirm("¿Eliminar?"))onDeleteUser(id);};
  const saveP=async()=>{await onSavePermisos(editP,tmpP);setEditP(null);};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:BRAND}}>Equipo</h1>
          <p style={{color:"#9ca3af",fontSize:12}}>{com.length} miembros</p>
        </div>
        <button className="btn-p" onClick={()=>{setForm({role:"comercial",lineaPermisos:["alarmas","energia"]});setModal(true);}}>+ Añadir</button>
      </div>
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
                  <div style={{width:44,height:44,background:BRAND_LIGHT,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:BRAND,fontSize:18}}>{u.name.charAt(0)}</div>
                  <div>
                    <p style={{fontSize:13,fontWeight:700,color:BRAND}}>{u.name}</p>
                    <p style={{fontSize:10,color:"#9ca3af"}}>{u.email}</p>
                    <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",background:u.role==="socio"?"#f5f3ff":BRAND_LIGHT,color:u.role==="socio"?"#7c3aed":BRAND,padding:"2px 7px",borderRadius:20,display:"inline-block",marginTop:2}}>{u.role}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button className="btn-g" style={{padding:"3px 7px",fontSize:11}} onClick={()=>{setEditP(u.id);setTmpP(u.lineaPermisos||[]);}}>🔐</button>
                  <button onClick={()=>del(u.id)} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#fca5a5"}}>✕</button>
                </div>
              </div>
              {mgr&&<p style={{fontSize:10,color:"#9ca3af",marginBottom:6}}>👤 Responsable: {mgr.name}</p>}
              {subs.length>0&&<p style={{fontSize:10,color:"#9ca3af",marginBottom:6}}>👥 Subcomerciales: {subs.map(s=>s.name).join(", ")}</p>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
                {[["Contactos",mc.length,"👥"],["Ops.",md.length,"📋"],["Tareas",mt.length,"✅"]].map(([l,v,i])=>(
                  <div key={l} style={{background:"#f8f9fd",borderRadius:8,padding:8,textAlign:"center"}}>
                    <p style={{fontSize:16,fontWeight:800,color:BRAND}}>{v}</p>
                    <p style={{fontSize:9,color:"#9ca3af"}}>{i} {l}</p>
                  </div>
                ))}
              </div>
              <div style={{background:"#eff6ff",borderRadius:8,padding:"8px 11px",marginBottom:10}}>
                <p style={{fontSize:10,color:"#6b7280"}}>Pipeline activo</p>
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
            {[["name","Nombre *","text"],["email","Email *","email"],["password","Contraseña","text"]].map(([k,l,t])=>(
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
                  return <button key={k} onClick={()=>setForm(f=>({...f,lineaPermisos:has?(f.lineaPermisos||[]).filter(x=>x!==k):[...(f.lineaPermisos||[]),k]}))} style={{padding:"5px 12px",borderRadius:20,border:"2px solid",fontSize:11,fontWeight:700,cursor:"pointer",borderColor:has?v.color:"#dde2f0",background:has?v.light:"white",color:has?v.color:"#6b7280",transition:"all .2s"}}>{v.label}</button>;
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
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:6}}>🔐 Permisos de línea</h2>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>{users.find(u=>u.id===editP)?.name}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:9}}>
              {Object.entries(LINEAS).map(([k,v])=>{
                const has=tmpP.includes(k);
                return <button key={k} onClick={()=>setTmpP(p=>has?p.filter(x=>x!==k):[...p,k])} style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:12,fontWeight:700,cursor:"pointer",borderColor:has?v.color:"#dde2f0",background:has?v.light:"white",color:has?v.color:"#6b7280",transition:"all .2s"}}>{has?"✓ ":""}{v.label}</button>;
              })}
            </div>
            <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setEditP(null)}>Cancelar</button>
              <button className="btn-p" onClick={saveP}>Guardar permisos</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
