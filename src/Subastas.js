import { useState, useEffect, useCallback } from "react";
import { supabase } from "./utils/supabase";

const BRAND = "#002292";
function genId() { return crypto.randomUUID(); }
function today() { return new Date().toISOString().split("T")[0]; }
function fmt(v) { return v ? new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v)) : '—'; }

const ESTADOS = {
  Activa:     { color:"#059669", bg:"#d1fae5" },
  Adjudicada: { color:"#2563eb", bg:"#dbeafe" },
  Desierta:   { color:"#6b7280", bg:"#f3f4f6" },
  Suspendida: { color:"#dc2626", bg:"#fee2e2" },
};

const DOC_TIPOS = ["Decreto subasta","Nota simple","Nota catastro","Certificado cargas","Planos","Fotografías","Acuerdo confidencialidad","Otros"];
const INT_TIPOS = ["Llamada","Visita","Email","WhatsApp","Reunión","Otro"];
const INT_ICONS = {Llamada:"📞",Visita:"🚗",Email:"📧",WhatsApp:"💬",Reunión:"🤝",Otro:"📝"};

// ── Generador de acuerdo de confidencialidad ──────────────────────────────────
async function generarAcuerdoPDF(contact, user, onSaved) {
  const {jsPDF} = await import('jspdf');
  const doc = new jsPDF({unit:'mm',format:'a4'});
  const ML=20,PW=210,PH=297,MB=25,TW=170;
  let y=25;
  const wr=(text,opts={})=>{
    if(!text)return;
    const{size=10,bold=false,center=false,indent=0,after=0}=opts;
    doc.setFontSize(size);doc.setFont('helvetica',bold?'bold':'normal');
    const lh=size*0.43;
    const lines=doc.splitTextToSize(text,center?TW:TW-indent);
    for(const line of lines){
      if(y>PH-MB){doc.addPage();y=20;}
      doc.text(line,center?PW/2:ML+indent,y,center?{align:'center'}:{});
      y+=lh;
    }
    y+=after;
  };
  const fechaHoy=new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
  const isEmpresa=contact.tipo_cliente==='empresa';
  const dniCif=isEmpresa?(contact.empresa_cif||'___________'):(contact.dniCif||contact.dni_cif||'___________');
  const razSocial=contact.empresa_razon_social||contact.empresa||contact.name;
  const repNombre=contact.representante_nombre||contact.name;
  const repDni=contact.representante_dni||contact.dniCif||contact.dni_cif||'___________';
  const dir=isEmpresa?(contact.empresa_direccion||contact.direccion||'___________'):(contact.direccion||'___________');
  const cp=contact.codigoPostal||contact.codigo_postal||'';
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
  wr('Las partes se obligan a suscribir un contrato de confidencialidad respecto de la información que las mismas se puedan suministrar en el marco del presente acuerdo y contratos que dimanan del mismo.',{size:10,after:2});
  wr('Las partes se comprometen a adoptar las medidas oportunas, para asegurar el tratamiento confidencial de dicha información.',{size:10,after:5});
  wr('CUARTA.- GASTOS.',{size:10,bold:true,after:2});
  wr('Las partes firmantes asumirán a su propia costa, sin poder repercutirlos a la contraria, los gastos en que incurran en la consecución de lo que constituye el objeto del contrato.',{size:10,after:5});
  wr('QUINTA.- DURACIÓN del acuerdo.',{size:10,bold:true,after:2});
  wr('El presente acuerdo tiene una validez de UN año desde su firma, salvo prórroga de las partes.',{size:10,after:5});
  wr('SEXTA.- COMISION.',{size:10,bold:true,after:2});
  wr('De forma genérica NO se pacta una comisión por la cantidad intermediada en el concepto proyecto, sino que se pactará en relación a cada concreta operación que se presente.',{size:10,after:5});
  wr('SÉPTIMA.- INTERLOCUTORES.',{size:10,bold:true,after:2});
  wr('D. ANTONIO REY PEREIRO',{size:10,bold:true,after:1});
  wr('Calle de la Playa 18 - Gandarío · 15165 Bergondo (A Coruña) · (+34) 672 274969 · arey@quenecesitashoy.es',{size:10,after:4});
  wr(nombreFirma,{size:10,bold:true,after:1});
  if(isEmpresa&&repNombre!==contact.name) wr(`Representante: D./Dña. ${repNombre}`,{size:10,after:1});
  if(dir!=='___________') wr(dir,{size:10,after:1});
  if(cp||loc) wr(`${cp} ${loc}`.trim(),{size:10,after:1});
  if(phone) wr(phone,{size:10,after:1});
  if(email) wr(email,{size:10,after:5});
  wr('OCTAVA.- PROTECCIÓN DE DATOS',{size:10,bold:true,after:2});
  wr('Las Partes se comprometen a cumplir, en todo momento, las disposiciones contenidas en el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).',{size:10,after:5});
  wr('NOVENA.- ACUERDO ÚNICO',{size:10,bold:true,after:2});
  wr('Este Acuerdo sólo podrá modificarse cuando las Partes así lo acuerden por escrito. Las Partes declaran que no existen otros acuerdos o pactos entre ellos.',{size:10,after:5});
  wr('DÉCIMA.- COMPETENCIA JURISDICCIONAL.',{size:10,bold:true,after:2});
  wr('Las partes intervinientes se someten a la jurisdicción de los Tribunales de la ciudad de A Coruña para todo litigio o reclamación resultante de la ejecución o interpretación del presente documento.',{size:10,after:8});
  wr('Y, en prueba de conformidad, ambas partes firman y rubrican el presente acuerdo en el lugar y fecha del encabezamiento.',{size:10,after:10});
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

  const fechaFile=today();
  const slug=(isEmpresa?razSocial:contact.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9\s]/g,'').trim().replace(/\s+/g,'_');
  const fileName=`Acuerdo_Confidencialidad_${slug}_${fechaFile}.pdf`;
  doc.save(fileName);

  const pdfBlob=doc.output('blob');
  if(onSaved) await onSaved(pdfBlob, fileName, fechaFile, slug);
}

// ── Componente principal ──────────────────────────────────────────────────────
const esComercialSubastas = u =>
  (u.lineaPermisos||[]).includes('subastas') || u.role==='admin' || u.role==='socio';

export default function Subastas({ user, contacts, users }) {
  const [auctions, setAuctions] = useState([]);
  const [clientCounts, setClientCounts] = useState({});
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ estado:"Activa", comercial_id:user.id });
  const [filtro, setFiltro] = useState("todas");
  const [loading, setLoading] = useState(true);

  const loadAuctions = useCallback(async () => {
    setLoading(true);
    const [{ data: aucs }, { data: ac }] = await Promise.all([
      supabase.from('auctions').select('*').order('created_at',{ascending:false}),
      supabase.from('auction_clients').select('auction_id'),
    ]);
    setAuctions(aucs || []);
    const counts = {};
    (ac||[]).forEach(r => { counts[r.auction_id] = (counts[r.auction_id]||0)+1; });
    setClientCounts(counts);
    setLoading(false);
  }, []);

  useEffect(() => { loadAuctions(); }, [loadAuctions]);

  const saveNew = async () => {
    if (!form.inmueble?.trim()) { alert('El campo Inmueble es obligatorio'); return; }
    const payload = { id:genId(), ...form, created_at:today(), updated_at:today() };
    const { data:rec, error } = await supabase.from('auctions').insert(payload).select().single();
    if (error) { alert(`Error al crear subasta: ${error.message}`); return; }
    setAuctions(a => [rec, ...a]);
    setModal(false);
    setForm({ estado:"Activa", comercial_id:user.id });
  };

  const filtered = filtro==="todas" ? auctions : auctions.filter(a => a.estado===filtro);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:800,color:BRAND}}>⚖️ Subastas Judiciales</h1>
          <p style={{color:"#9ca3af",fontSize:13}}>{filtered.length} subastas</p>
        </div>
        <button className="btn-p" onClick={()=>{setForm({estado:"Activa",comercial_id:user.id});setModal(true);}}>+ Nueva subasta</button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {["todas",...Object.keys(ESTADOS)].map(e=>(
          <button key={e} className={`tab ${filtro===e?"on":""}`} onClick={()=>setFiltro(e)}>
            {e==="todas"?"Todas":e}
          </button>
        ))}
      </div>

      {loading && <p style={{color:"#9ca3af",textAlign:"center",padding:40}}>Cargando...</p>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
        {filtered.map(a => {
          const est = ESTADOS[a.estado]||ESTADOS.Activa;
          const com = users.find(u=>u.id===a.comercial_id);
          return (
            <div key={a.id} className="card" style={{padding:18,borderLeft:`4px solid ${est.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1,minWidth:0,marginRight:8}}>
                  <p style={{fontSize:11,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".5px"}}>{a.referencia||"Sin referencia"}</p>
                  <h3 style={{fontSize:15,fontWeight:800,color:BRAND,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.inmueble||"Sin inmueble"}</h3>
                </div>
                <span className="tag" style={{background:est.bg,color:est.color,whiteSpace:"nowrap",flexShrink:0}}>{a.estado}</span>
              </div>
              {a.ubicacion&&<p style={{fontSize:12,color:"#6b7280",marginBottom:10}}>📍 {a.ubicacion}</p>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                <div style={{background:"#f8f9fd",borderRadius:7,padding:"6px 10px"}}>
                  <p style={{fontSize:10,color:"#9ca3af",fontWeight:700,textTransform:"uppercase"}}>Fecha subasta</p>
                  <p style={{fontSize:13,fontWeight:700,color:"#1e2a4a"}}>{a.fecha_subasta||"—"}</p>
                </div>
                <div style={{background:"#f8f9fd",borderRadius:7,padding:"6px 10px"}}>
                  <p style={{fontSize:10,color:"#9ca3af",fontWeight:700,textTransform:"uppercase"}}>Precio</p>
                  <p style={{fontSize:13,fontWeight:700,color:"#1e2a4a"}}>{fmt(a.precio_subasta)}</p>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#6b7280"}}>👥 {clientCounts[a.id]||0} clientes · {com?.name||"—"}</span>
                <button className="btn-p" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>setDetail(a)}>Ver detalle →</button>
              </div>
            </div>
          );
        })}
      </div>
      {!loading&&filtered.length===0&&<p style={{textAlign:"center",padding:48,color:"#9ca3af"}}>No hay subastas{filtro!=="todas"?` con estado "${filtro}"`:""}. {filtro==="todas"?"Crea la primera.":""}</p>}

      {modal&&(
        <div className="mb" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="mo" style={{maxWidth:520}}>
            <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:16}}>Nueva subasta</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              <div><label className="fl">Referencia</label><input className="fi" value={form.referencia||""} onChange={e=>setForm(f=>({...f,referencia:e.target.value}))} /></div>
              <div><label className="fl">Estado</label>
                <select className="fi" value={form.estado||"Activa"} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                  {Object.keys(ESTADOS).map(e=><option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Inmueble *</label><input className="fi" value={form.inmueble||""} onChange={e=>setForm(f=>({...f,inmueble:e.target.value}))} placeholder="Ej: Piso 3º B" /></div>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Ubicación</label><input className="fi" value={form.ubicacion||""} onChange={e=>setForm(f=>({...f,ubicacion:e.target.value}))} /></div>
              <div><label className="fl">Fecha subasta</label><input className="fi" type="date" value={form.fecha_subasta||""} onChange={e=>setForm(f=>({...f,fecha_subasta:e.target.value}))} /></div>
              <div><label className="fl">Precio subasta (€)</label><input className="fi" type="number" value={form.precio_subasta||""} onChange={e=>setForm(f=>({...f,precio_subasta:e.target.value}))} /></div>
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Comercial asignado</label>
                <select className="fi" value={form.comercial_id||user.id} onChange={e=>setForm(f=>({...f,comercial_id:e.target.value}))}>
                  {users.filter(esComercialSubastas).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
              <button className="btn-g" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn-p" onClick={saveNew}>Crear subasta</button>
            </div>
          </div>
        </div>
      )}

      {detail&&(
        <AuctionDetail
          auction={detail}
          user={user}
          users={users}
          contacts={contacts}
          onClose={()=>setDetail(null)}
          onUpdate={updated=>{setAuctions(a=>a.map(x=>x.id===updated.id?updated:x));setDetail(updated);}}
        />
      )}
    </div>
  );
}

// ── Ficha de subasta ──────────────────────────────────────────────────────────
function AuctionDetail({ auction, user, users, contacts, onClose, onUpdate }) {
  const [tab, setTab] = useState("datos");
  const [form, setForm] = useState({...auction});
  const [saving, setSaving] = useState(false);

  const est = ESTADOS[form.estado]||ESTADOS.Activa;
  const com = users.find(u=>u.id===form.comercial_id);

  const save = async () => {
    setSaving(true);
    const { data:rec, error } = await supabase.from('auctions')
      .update({...form, updated_at:today()})
      .eq('id', auction.id)
      .select().single();
    setSaving(false);
    if (error) { alert(`Error al guardar: ${error.message}`); return; }
    onUpdate(rec);
  };

  const fi = (k,l,opts={}) => (
    <div key={k} style={opts.full?{gridColumn:"1 / -1"}:{}}>
      <label className="fl">{l}</label>
      {opts.area
        ? <textarea className="fi" rows={3} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} />
        : <input className="fi" type={opts.type||"text"} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} />}
    </div>
  );

  return (
    <div className="mb" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo mo-lg" style={{maxWidth:860}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:48,height:48,background:est.bg,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⚖️</div>
            <div>
              <h2 style={{fontSize:18,fontWeight:800,color:BRAND}}>{form.inmueble||"Subasta"}</h2>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                {form.referencia&&<span className="tag" style={{background:"#f0f3fc",color:"#374151"}}>Ref: {form.referencia}</span>}
                <span className="tag" style={{background:est.bg,color:est.color}}>{form.estado}</span>
                {com&&<span style={{fontSize:11,color:"#6b7280"}}>👤 {com.name}</span>}
              </div>
            </div>
          </div>
          <button className="btn-g" style={{fontSize:12}} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {[["datos","📋 Datos del bien"],["documentacion","📎 Documentación"],["clientes","👥 Clientes vinculados"],["gestiones","🗂️ Gestiones"]].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {/* PESTAÑA 1 — Datos del bien */}
        {tab==="datos"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
              {fi("inmueble","Inmueble")}
              {fi("referencia_catastral","Referencia catastral")}
              {fi("ubicacion","Ubicación (dirección completa)",{full:true})}
              {fi("descripcion","Descripción del bien",{full:true,area:true})}
              {fi("numero_autos","Nº autos / expediente")}
              {fi("juzgado","Juzgado")}
              {fi("localidad_juzgado","Localidad del juzgado")}
              {fi("fecha_subasta","Fecha de la subasta",{type:"date"})}
              {fi("precio_subasta","Precio de subasta (€)",{type:"number"})}
              {fi("valor_tasacion","Valor de tasación (€)",{type:"number"})}
              {fi("deuda","Deuda total (€)",{type:"number"})}
              {fi("cargas_previas","Cargas previas",{full:true})}
              <div>
                <label className="fl">Estado</label>
                <select className="fi" value={form.estado||"Activa"} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}>
                  {Object.keys(ESTADOS).map(e=><option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Comercial asignado</label>
                <select className="fi" value={form.comercial_id||""} onChange={e=>setForm(f=>({...f,comercial_id:e.target.value}))}>
                  {users.filter(esComercialSubastas).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              {fi("notas","Notas internas",{full:true,area:true})}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
              <button className="btn-p" onClick={save} disabled={saving}>{saving?"Guardando...":"💾 Guardar cambios"}</button>
            </div>
          </div>
        )}

        {/* PESTAÑA 2 — Documentación */}
        {tab==="documentacion"&&(
          <AuctionDocuments auctionId={auction.id} user={user} />
        )}

        {/* PESTAÑA 3 — Clientes vinculados */}
        {tab==="clientes"&&(
          <AuctionClients auction={auction} user={user} users={users} contacts={contacts} />
        )}

        {/* PESTAÑA 4 — Registro de gestiones */}
        {tab==="gestiones"&&(
          <AuctionInteractions auctionId={auction.id} user={user} users={users} contacts={contacts} />
        )}
      </div>
    </div>
  );
}

// ── Pestaña Documentación ─────────────────────────────────────────────────────
function AuctionDocuments({ auctionId, user }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tipoSel, setTipoSel] = useState("Otros");

  useEffect(()=>{
    supabase.from('auction_documents').select('*').eq('auction_id',auctionId).order('created_at',{ascending:false})
      .then(({data})=>setDocs(data||[]));
  },[auctionId]);

  const handleUpload = async(e) => {
    const file=e.target.files[0]; if(!file)return;
    if(file.size>20*1024*1024){alert('Máximo 20MB por archivo');return;}
    setUploading(true);
    const path=`auctions/${auctionId}/${Date.now()}_${file.name}`;
    const {error:upErr}=await supabase.storage.from('documentos').upload(path,file);
    if(upErr){alert(`Error al subir: ${upErr.message}`);setUploading(false);return;}
    const rec={id:genId(),auction_id:auctionId,nombre:file.name,tipo:tipoSel,url:path,size:file.size,uploaded_by:user.id,created_at:today()};
    console.log('[AuctionDocs] INSERT:', rec);
    const {data:inserted,error:insErr}=await supabase.from('auction_documents').insert(rec).select().single();
    console.log('[AuctionDocs] result:', inserted, insErr);
    if(insErr){alert(`Subido pero error al registrar: ${insErr.message}`);setUploading(false);return;}
    setDocs(d=>[inserted,...d]);
    setUploading(false); e.target.value='';
  };

  const handleDownload = async(doc) => {
    const {data,error}=await supabase.storage.from('documentos').createSignedUrl(doc.url,3600);
    if(error){alert(`Error al descargar: ${error.message}`);return;}
    window.open(data.signedUrl,'_blank');
  };

  const handleDelete = async(doc) => {
    if(!window.confirm(`¿Eliminar "${doc.nombre}"?`))return;
    await supabase.storage.from('documentos').remove([doc.url]);
    await supabase.from('auction_documents').delete().eq('id',doc.id);
    setDocs(d=>d.filter(x=>x.id!==doc.id));
  };

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <select className="fi" style={{width:"auto",flex:1,minWidth:180}} value={tipoSel} onChange={e=>setTipoSel(e.target.value)}>
          {DOC_TIPOS.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{cursor:uploading?"not-allowed":"pointer",flexShrink:0}}>
          <span className="btn-p" style={{fontSize:12,padding:"7px 14px",display:"inline-block",opacity:uploading?0.6:1}}>
            {uploading?"Subiendo...":"+ Subir documento"}
          </span>
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" style={{display:"none"}} onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {docs.map(doc=>(
        <div key={doc.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#f8f9fd",borderRadius:8,marginBottom:7}}>
          <span style={{fontSize:18}}>📄</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12,fontWeight:600,color:"#1e2a4a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.nombre}</p>
            <p style={{fontSize:10,color:"#9ca3af"}}>{doc.tipo} · {doc.created_at}</p>
          </div>
          <button className="btn-g" style={{padding:"4px 9px",fontSize:11,flexShrink:0}} onClick={()=>handleDownload(doc)}>⬇️ Descargar</button>
          <button className="btn-g" style={{padding:"4px 8px",fontSize:11,color:"#dc2626",borderColor:"#fecaca",flexShrink:0}} onClick={()=>handleDelete(doc)}>🗑️</button>
        </div>
      ))}
      {docs.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#9ca3af",fontSize:12}}>Sin documentos. Selecciona el tipo y sube el primer archivo.</p>}
    </div>
  );
}

// ── Helper: número a palabras en español ──────────────────────────────────────
function numToWords(n) {
  n = Math.round(Number(n)||0);
  if(n===0) return 'cero';
  if(n<0) return 'menos '+numToWords(-n);
  const ones=['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve',
    'diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve',
    'veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const tens=['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const hundreds=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  if(n===100) return 'cien';
  if(n<30) return ones[n];
  if(n<100){ const t=Math.floor(n/10),o=n%10; return tens[t]+(o?' y '+ones[o]:''); }
  if(n<1000){ const h=Math.floor(n/100),r=n%100; return hundreds[h]+(r?' '+numToWords(r):''); }
  if(n<2000){ const r=n%1000; return 'mil'+(r?' '+numToWords(r):''); }
  if(n<1000000){ const t=Math.floor(n/1000),r=n%1000; return numToWords(t)+' mil'+(r?' '+numToWords(r):''); }
  if(n<2000000){ const r=n%1000000; return 'un millón'+(r?' '+numToWords(r):''); }
  const m=Math.floor(n/1000000),r=n%1000000; return numToWords(m)+' millones'+(r?' '+numToWords(r):'');
}

// ── Helper: número con céntimos a palabras ────────────────────────────────────
function numToWordsFull(n) {
  const amount=Math.abs(Number(n)||0);
  const integer=Math.floor(amount);
  const cents=Math.round((amount-integer)*100);
  const words=numToWords(integer).toUpperCase();
  if(cents>0) return `${words} CON ${numToWords(cents).toUpperCase()} CÉNTIMOS`;
  return words;
}

// ── Generador de LOI Honorarios PDF ───────────────────────────────────────────
async function generarLOIPDF(contact, auction, loiData) {
  const {jsPDF} = await import('jspdf');
  const doc = new jsPDF({unit:'mm',format:'a4'});
  const ML=25,PW=210,PH=297,MB=25,TW=160;
  let y=30;
  const wr=(text,opts={})=>{
    if(!text)return;
    const{size=11,bold=false,center=false,justify=false,indent=0,after=0}=opts;
    doc.setFontSize(size);doc.setFont('helvetica',bold?'bold':'normal');
    const lh=size*0.45;
    const width=center?TW:TW-indent;
    const lines=doc.splitTextToSize(text,width);
    if(justify&&!center){
      // Justify: render all lines at once; add page break first if needed
      const totalH=lines.length*lh;
      if(y+totalH>PH-MB){doc.addPage();y=25;}
      doc.text(lines,ML+indent,y,{align:'justify',maxWidth:width});
      y+=totalH+after;
    } else {
      for(const line of lines){
        if(y>PH-MB){doc.addPage();y=25;}
        doc.text(line,center?PW/2:ML+indent,y,center?{align:'center'}:{});
        y+=lh;
      }
      y+=after;
    }
  };
  // Formatos moneda y letras
  const fmtEur=(n)=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const fmtCantidad=(n)=>`${fmtEur(n)} € (${numToWords(n).toUpperCase()} EUROS)`;

  const now=new Date();
  const fechaHoy=`${String(now.getDate()).padStart(2,'0')} / ${String(now.getMonth()+1).padStart(2,'0')} / ${now.getFullYear()}`;
  const oferta=Number(loiData.loi_oferta)||0;
  const pct=Number(loiData.loi_honorarios_porcentaje)||0;
  const honImporte=Number(loiData.loi_honorarios_importe)||0;
  const tasas=Number(loiData.loi_tasas)||Math.round(oferta*0.05);
  const isEmpresa=contact.tipo_cliente==='empresa';
  const dniCif=isEmpresa?(contact.empresa_cif||'___________'):(contact.dniCif||contact.dni_cif||'___________');
  const razSocial=contact.empresa_razon_social||contact.empresa||contact.name;
  const repNombre=contact.representante_nombre||contact.name;
  const repDni=contact.representante_dni||contact.dniCif||contact.dni_cif||'___________';
  const dir=isEmpresa?(contact.empresa_direccion||contact.direccion||'___________'):(contact.direccion||'___________');
  const cp=contact.codigoPostal||contact.codigo_postal||'';
  const loc=contact.localidad||'';
  const dirCompleta=[dir,cp,loc].filter(v=>v&&v!=='___________').join(', ')||'___________';
  const phone=isEmpresa?(contact.empresa_telefono||contact.phone||'___________'):(contact.phone||'___________');
  const emailC=isEmpresa?(contact.empresa_email||contact.email||'___________'):(contact.email||'___________');

  wr(fechaHoy,{after:6});
  wr(`Asunto: LOI ${auction.inmueble||''}`,{bold:true,after:6});
  if(isEmpresa){
    wr(`De D. ${repNombre} con D.N.I. ${repDni} en representación de la mercantil ${razSocial} con C.I.F. ${dniCif} y domicilio fiscal en ${dirCompleta}, Tfno: ${phone} mail, ${emailC}`,{justify:true,after:6});
  }else{
    wr(`De D./Dña. ${contact.name} con D.N.I. ${dniCif} y domicilio en ${dirCompleta}, Tfno: ${phone} mail, ${emailC}`,{justify:true,after:6});
  }
  wr('Att. de:',{bold:true,after:3});
  wr('D. Jose Luis Torron Crende con D.N.I 34.890.867M en representación de la mercantil DISGAMOVIL SOLUTIONS S.L.U. con C.IF. B70564075 y domicilio fiscal en C/ Copérnico 6, Despacho Nº2, 15008 A Coruña, en adelante (Despacho Gestor).',{justify:true,after:6});
  wr('Por la presente confirmamos el interés en estudiar en firme, la posibilidad de compra de los Activos:',{justify:true,after:4});
  wr(auction.inmueble||'',{bold:true,after:2});
  wr(`Localidad ${auction.ubicacion||'___________'}`,{after:6});
  const sujetoLOI=isEmpresa?`La mercantil ${razSocial}`:`D./Dña. ${contact.name}`;
  wr(`${sujetoLOI} manifiesta disponer de fondos para la adquisición del inmueble, cuyo documento acreditativo entregará para la formalización de la operación, por un importe de ${fmtCantidad(oferta)}, reconociendo al Despacho Gestor, honorarios a añadir, por importe del ${pct}% - ${fmtCantidad(honImporte)} más sus correspondientes impuestos (por cuenta del comprador).`,{justify:true,after:3});
  wr(`Tasas Oficiales: ${fmtCantidad(tasas)}.`,{justify:true,after:6});
  wr('Para el estudio de la operación requerimos nos remita dossier completo del activo, dicha documentación será mantenida con carácter confidencial y limitará el conocimiento de la información confidencial a aquellas personas (directivos, administradores, empleados y asesores) de la Entidad a las que sea imprescindible su transmisión para el evaluó, estudio, impulso y, en su caso, formalización de la operación, Informando debidamente a esas personas del carácter confidencial de la información.',{justify:true,after:8});
  wr('Cordialmente,',{after:14});
  if(isEmpresa){
    wr(`Fdo.: ${razSocial.slice(0,40)}`,{after:4});
    wr(`D./Dña. ${repNombre}`,{after:0});
  }else{
    wr(`Fdo.: ${contact.name}`,{after:0});
  }
  return doc.output('blob');
}

// ── Generador de LOI Juzgado PDF ──────────────────────────────────────────────
async function generarLOIJuzgadoPDF(contact, auction, loiData) {
  const {jsPDF}=await import('jspdf');
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const ML=25,PW=210,PH=297,MB=25,TW=160;
  let y=30;
  const wr=(text,opts={})=>{
    if(!text)return;
    const{size=11,bold=false,center=false,justify=false,indent=0,after=0}=opts;
    doc.setFontSize(size);doc.setFont('helvetica',bold?'bold':'normal');
    const lh=size*0.45;
    const width=center?TW:TW-indent;
    const lines=doc.splitTextToSize(text,width);
    if(justify&&!center){
      const totalH=lines.length*lh;
      if(y+totalH>PH-MB){doc.addPage();y=25;}
      doc.text(lines,ML+indent,y,{align:'justify',maxWidth:width});
      y+=totalH+after;
    } else {
      for(const line of lines){
        if(y>PH-MB){doc.addPage();y=25;}
        doc.text(line,center?PW/2:ML+indent,y,center?{align:'center'}:{});
        y+=lh;
      }
      y+=after;
    }
  };
  const now=new Date();
  const dd=String(now.getDate()).padStart(2,'0');
  const mm=String(now.getMonth()+1).padStart(2,'0');
  const yyyy=now.getFullYear();
  const fechaHoy=`${dd}/ ${mm} / ${yyyy}`;
  const oferta=Number(loiData.loi_oferta)||0;
  const fmtEur=(n)=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  const ofertaFmt=fmtEur(oferta);
  const ofertaWords=numToWordsFull(oferta);
  const isEmpresa=contact.tipo_cliente==='empresa';
  const dniCif=isEmpresa?(contact.empresa_cif||'___________'):(contact.dniCif||contact.dni_cif||'___________');
  const razSocial=contact.empresa_razon_social||contact.empresa||contact.name;
  const repNombre=contact.representante_nombre||contact.name;
  const repDni=contact.representante_dni||contact.dniCif||contact.dni_cif||'___________';
  const dir=isEmpresa?(contact.empresa_direccion||contact.direccion||'___________'):(contact.direccion||'___________');
  const cp=contact.codigoPostal||contact.codigo_postal||'';
  const loc=contact.localidad||'';
  const dirCompleta=[dir,cp,loc].filter(v=>v&&v!=='___________').join(', ')||'___________';
  const phone=isEmpresa?(contact.empresa_telefono||contact.phone||'___________'):(contact.phone||'___________');
  const emailC=isEmpresa?(contact.empresa_email||contact.email||'___________'):(contact.email||'___________');

  wr(fechaHoy,{after:6});
  wr(`Asunto . LOI ${auction.inmueble||''}`,{bold:true,after:6});
  if(isEmpresa){
    wr(`De D. ${repNombre} con D.N.I. ${repDni} en representación de la mercantil ${razSocial} con C.I.F. ${dniCif} y domicilio fiscal en ${dirCompleta}, Tfno: ${phone} mail, ${emailC}`,{justify:true,after:6});
  }else{
    wr(`De D./Dña. ${contact.name} con D.N.I. ${dniCif} y domicilio en ${dirCompleta}, Tfno: ${phone} mail, ${emailC}`,{justify:true,after:6});
  }
  wr('Por la presente confirmamos el interés en estudiar en firme, la posibilidad de compra de los Activos:',{justify:true,after:4});
  wr(auction.inmueble||'',{bold:true,after:2});
  wr(`Localidad ${auction.ubicacion||'___________'}`,{after:6});
  const sujetoJuzgado=isEmpresa?`La mercantil ${razSocial}`:`D./Dña. ${contact.name}`;
  wr(`${sujetoJuzgado} manifiesta disponer de fondos para la adquisición del inmueble, cuyo documento acreditativo entregará para la formalización de la operación, por un importe de ${ofertaFmt} € ( ${ofertaWords} ).`,{justify:true,after:6});
  wr('Para el estudio de la operación requerimos nos remita dossier completo del activo, dicha documentación será mantenida con carácter confidencial y limitará el conocimiento de la información confidencial a aquellas personas (directivos, administradores, empleados y asesores) de la Entidad a las que sea imprescindible su transmisión para el evaluó, estudio, impulso y, en su caso, formalización de la operación, Informando debidamente a esas personas del carácter confidencial de la información.',{justify:true,after:8});
  wr('Cordialmente,',{after:14});
  if(isEmpresa){
    wr(`Fdo.: ${razSocial.slice(0,40)}`,{after:4});
    wr(`D./Dña. ${repNombre}`,{after:0});
  }else{
    wr(`Fdo.: ${contact.name}`,{after:0});
  }
  return doc.output('blob');
}

// ── Pestaña Clientes vinculados ───────────────────────────────────────────────
function AuctionClients({ auction, user, users, contacts }) {
  const auctionId = auction.id;
  const [linked, setLinked] = useState([]);
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(null);
  const [generatingLOI, setGeneratingLOI] = useState(null);
  const [generatingLOIJuzgado, setGeneratingLOIJuzgado] = useState(null);
  const [editLink, setEditLink] = useState(null);
  const [loiForms, setLoiForms] = useState({});

  useEffect(()=>{
    supabase.from('auction_clients').select('*').eq('auction_id',auctionId).order('created_at',{ascending:false})
      .then(({data})=>{
        setLinked(data||[]);
        const forms={};
        (data||[]).forEach(lnk=>{
          forms[lnk.id]={
            loi_fecha:lnk.loi_fecha||today(),
            loi_oferta:lnk.loi_oferta||'',
            loi_tasas:lnk.loi_tasas||'',
            loi_honorarios_importe:lnk.loi_honorarios_importe||'',
            loi_honorarios_porcentaje:lnk.loi_honorarios_porcentaje||'',
          };
        });
        setLoiForms(forms);
      });
  },[auctionId]);

  const linkedIds = linked.map(l=>l.contact_id);
  const results = search.trim().length>0
    ? contacts.filter(c=>!linkedIds.includes(c.id)&&(c.name?.toLowerCase().includes(search.toLowerCase())||c.email?.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search)))
    : [];

  const link = async(contact) => {
    const rec={id:genId(),auction_id:auctionId,contact_id:contact.id,fecha_envio:null,notas:"",tiene_loi:false,created_at:today()};
    const {data:inserted,error}=await supabase.from('auction_clients').insert(rec).select().single();
    if(error){alert(`Error: ${error.message}`);return;}
    setLinked(l=>[inserted,...l]);
    setLoiForms(f=>({...f,[inserted.id]:{loi_fecha:today(),loi_oferta:'',loi_tasas:'',loi_honorarios_importe:'',loi_honorarios_porcentaje:''}}));
    setSearch("");
  };

  const unlink = async(id) => {
    if(!window.confirm("¿Desvincular este cliente?"))return;
    await supabase.from('auction_clients').delete().eq('id',id);
    setLinked(l=>l.filter(x=>x.id!==id));
  };

  const saveLink = async(lnk) => {
    await supabase.from('auction_clients').update({fecha_envio:lnk.fecha_envio,notas:lnk.notas}).eq('id',lnk.id);
    setLinked(l=>l.map(x=>x.id===lnk.id?lnk:x));
    setEditLink(null);
  };

  const toggleLOI = async(lnk) => {
    const newVal=!lnk.tiene_loi;
    await supabase.from('auction_clients').update({tiene_loi:newVal}).eq('id',lnk.id);
    setLinked(l=>l.map(x=>x.id===lnk.id?{...x,tiene_loi:newVal}:x));
  };

  const updateLoiField = (lnkId, field, value) => {
    setLoiForms(f=>{
      const curr=f[lnkId]||{};
      const updated={...curr,[field]:value};
      if(field==='loi_oferta'||field==='loi_honorarios_importe'){
        const oferta=Number(field==='loi_oferta'?value:curr.loi_oferta)||0;
        const importe=Number(field==='loi_honorarios_importe'?value:curr.loi_honorarios_importe)||0;
        updated.loi_honorarios_porcentaje=oferta>0?Math.round((importe/oferta)*10000)/100:'';
        if(field==='loi_oferta') updated.loi_tasas=oferta>0?Math.round(oferta*0.05):'';
      }
      return {...f,[lnkId]:updated};
    });
  };

  const saveLoiData = async(lnk) => {
    const fd=loiForms[lnk.id]||{};
    const payload={
      loi_fecha:fd.loi_fecha||null,
      loi_oferta:fd.loi_oferta?Number(fd.loi_oferta):null,
      loi_tasas:fd.loi_tasas?Number(fd.loi_tasas):null,
      loi_honorarios_porcentaje:fd.loi_honorarios_porcentaje!==''?Number(fd.loi_honorarios_porcentaje):null,
      loi_honorarios_importe:fd.loi_honorarios_importe?Number(fd.loi_honorarios_importe):null,
    };
    const {error}=await supabase.from('auction_clients').update(payload).eq('id',lnk.id);
    if(error){alert(`Error al guardar LOI: ${error.message}`);return;}
    setLinked(l=>l.map(x=>x.id===lnk.id?{...x,...payload}:x));
  };

  const slugify=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9\s]/g,'').trim().replace(/\s+/g,'_');

  const genLOI = async(lnk, contact, regenerar=false) => {
    if(!regenerar&&lnk.loi_documento_url){
      if(!window.confirm("Ya existe un LOI Honorarios para este cliente. ¿Regenerar?"))return;
    }
    setGeneratingLOI(lnk.id);
    try {
      await saveLoiData(lnk);
      const fd=loiForms[lnk.id]||{};
      const blob=await generarLOIPDF(contact,auction,fd);
      const fechaFile=today();
      const nombreSlug=contact.tipo_cliente==='empresa'?(contact.empresa_razon_social||contact.empresa||contact.name):contact.name;
      const fileName=`LOI_Honorarios_${slugify(nombreSlug)}_${fechaFile}.pdf`;
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=fileName; a.click(); URL.revokeObjectURL(url);
      const storagePath=`auctions/${auctionId}/loi/${fileName}`;
      const {error:upErr}=await supabase.storage.from('documentos').upload(storagePath,blob,{contentType:'application/pdf',upsert:true});
      if(upErr){alert('LOI Honorarios descargado pero error al subir a Storage:\n'+upErr.message);return;}
      const {error:updErr}=await supabase.from('auction_clients').update({tiene_loi:true,loi_documento_url:storagePath}).eq('id',lnk.id);
      if(!updErr) setLinked(l=>l.map(x=>x.id===lnk.id?{...x,tiene_loi:true,loi_documento_url:storagePath}:x));
      const rec={id:genId(),auction_id:auctionId,nombre:fileName,tipo:'LOI Honorarios',url:storagePath,size:blob.size,uploaded_by:user.id,created_at:fechaFile};
      await supabase.from('auction_documents').insert(rec);
    } catch(e) {
      alert('Error al generar LOI Honorarios: '+e.message);
    } finally {
      setGeneratingLOI(null);
    }
  };

  const verLOI = async(lnk) => {
    const {data,error}=await supabase.storage.from('documentos').createSignedUrl(lnk.loi_documento_url,3600);
    if(error){alert(`Error al abrir LOI Honorarios: ${error.message}`);return;}
    window.open(data.signedUrl,'_blank');
  };

  const genLOIJuzgado = async(lnk, contact) => {
    if(lnk.loi_juzgado_url){
      if(!window.confirm("Ya existe un LOI Juzgado para este cliente. ¿Regenerar?"))return;
    }
    setGeneratingLOIJuzgado(lnk.id);
    try {
      const fd=loiForms[lnk.id]||{};
      const blob=await generarLOIJuzgadoPDF(contact,auction,fd);
      const fechaFile=today();
      const nombreSlugJ=contact.tipo_cliente==='empresa'?(contact.empresa_razon_social||contact.empresa||contact.name):contact.name;
      const fileName=`LOI_Juzgado_${slugify(nombreSlugJ)}_${fechaFile}.pdf`;
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=fileName; a.click(); URL.revokeObjectURL(url);
      const storagePath=`auctions/${auctionId}/loi/${fileName}`;
      const {error:upErr}=await supabase.storage.from('documentos').upload(storagePath,blob,{contentType:'application/pdf',upsert:true});
      if(upErr){alert('LOI Juzgado descargado pero error al subir a Storage:\n'+upErr.message);return;}
      const {error:updErr}=await supabase.from('auction_clients').update({loi_juzgado_url:storagePath}).eq('id',lnk.id);
      if(!updErr) setLinked(l=>l.map(x=>x.id===lnk.id?{...x,loi_juzgado_url:storagePath}:x));
      const rec={id:genId(),auction_id:auctionId,nombre:fileName,tipo:'LOI Juzgado',url:storagePath,size:blob.size,uploaded_by:user.id,created_at:fechaFile};
      await supabase.from('auction_documents').insert(rec);
    } catch(e) {
      alert('Error al generar LOI Juzgado: '+e.message);
    } finally {
      setGeneratingLOIJuzgado(null);
    }
  };

  const verLOIJuzgado = async(lnk) => {
    const {data,error}=await supabase.storage.from('documentos').createSignedUrl(lnk.loi_juzgado_url,3600);
    if(error){alert(`Error al abrir LOI Juzgado: ${error.message}`);return;}
    window.open(data.signedUrl,'_blank');
  };

  const genAcuerdo = async(contact) => {
    setGenerating(contact.id);
    try {
      await generarAcuerdoPDF(contact, user, async(pdfBlob,fileName,fechaFile)=>{
        const storagePath=`auctions/${auctionId}/acuerdo_${contact.id}_${fechaFile}.pdf`;
        const {error:upErr}=await supabase.storage.from('documentos').upload(storagePath,pdfBlob,{contentType:'application/pdf',upsert:true});
        if(upErr){alert('PDF descargado pero no se pudo guardar en Storage:\n'+upErr.message);return;}
        const rec={id:genId(),auction_id:auctionId,nombre:`Acuerdo Confidencialidad - ${contact.name} - ${fechaFile}`,tipo:'Acuerdo confidencialidad',url:storagePath,size:pdfBlob.size,uploaded_by:user.id,created_at:fechaFile};
        const {error:insErr}=await supabase.from('auction_documents').insert(rec);
        if(insErr) console.error('[Acuerdo subastas] INSERT auction_documents:', insErr);
      });
    } catch(e) {
      alert('Error al generar el acuerdo: '+e.message);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div>
      {/* Buscador */}
      <div style={{position:"relative",marginBottom:12}}>
        <input className="fi" placeholder="Buscar cliente por nombre, email o teléfono..." value={search} onChange={e=>setSearch(e.target.value)} />
        {results.length>0&&(
          <div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1.5px solid #dde2f0",borderRadius:8,boxShadow:"0 4px 14px rgba(0,35,146,.1)",zIndex:50,maxHeight:220,overflowY:"auto"}}>
            {results.slice(0,8).map(c=>(
              <div key={c.id} style={{padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f0f3fb",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>link(c)}
                onMouseEnter={e=>e.currentTarget.style.background="#f8f9fd"} onMouseLeave={e=>e.currentTarget.style.background="white"}>
                <div>
                  <span style={{fontSize:13,fontWeight:600,color:BRAND}}>{c.name}</span>
                  {c.empresa&&<span style={{fontSize:11,color:"#6b7280",marginLeft:6}}>· {c.empresa}</span>}
                  <p style={{fontSize:11,color:"#9ca3af"}}>{c.phone} {c.email&&`· ${c.email}`}</p>
                </div>
                <span style={{fontSize:11,color:"#059669",fontWeight:700}}>+ Vincular</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lista de vinculados */}
      {linked.map(lnk=>{
        const c=contacts.find(x=>x.id===lnk.contact_id);
        if(!c)return null;
        const isEdit=editLink?.id===lnk.id;
        const fd=loiForms[lnk.id]||{loi_honorarios_porcentaje:5};
        const isGenLOI=generatingLOI===lnk.id;
        const isGenLOIJuzgado=generatingLOIJuzgado===lnk.id;
        return (
          <div key={lnk.id} style={{background:"#f8f9fd",borderRadius:10,padding:13,marginBottom:9,border:lnk.tiene_loi?"1.5px solid #7c3aed20":"1.5px solid transparent"}}>
            {/* Header cliente */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
              <div>
                <p style={{fontSize:13,fontWeight:700,color:BRAND}}>{c.name}</p>
                <p style={{fontSize:11,color:"#6b7280"}}>{c.phone&&`📞 ${c.phone}`}{c.email&&` · 📧 ${c.email}`}</p>
                {!isEdit&&lnk.fecha_envio&&<p style={{fontSize:11,color:"#059669",marginTop:2}}>📤 Docs enviados: {lnk.fecha_envio}</p>}
                {!isEdit&&lnk.notas&&<p style={{fontSize:11,color:"#92400e",marginTop:2}}>📝 {lnk.notas}</p>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                <button className="btn-p" style={{fontSize:11,padding:"4px 9px",background:"#7c3aed",opacity:generating===c.id?0.6:1}} onClick={()=>genAcuerdo(c)} disabled={generating===c.id}>
                  {generating===c.id?"Generando...":"📄 Acuerdo"}
                </button>
                <button className="btn-g" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>setEditLink(isEdit?null:{...lnk})}>✏️</button>
                <button className="btn-g" style={{fontSize:11,padding:"4px 8px",color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>unlink(lnk.id)}>✕</button>
              </div>
            </div>

            {/* Form básico edición */}
            {isEdit&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8,marginBottom:8}}>
                <div><label className="fl">Fecha envío documentación</label><input className="fi" type="date" value={editLink.fecha_envio||""} onChange={e=>setEditLink(l=>({...l,fecha_envio:e.target.value}))} /></div>
                <div><label className="fl">Notas</label><input className="fi" value={editLink.notas||""} onChange={e=>setEditLink(l=>({...l,notas:e.target.value}))} /></div>
                <div style={{gridColumn:"1 / -1",display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button className="btn-g" style={{fontSize:12}} onClick={()=>setEditLink(null)}>Cancelar</button>
                  <button className="btn-p" style={{fontSize:12}} onClick={()=>saveLink(editLink)}>Guardar</button>
                </div>
              </div>
            )}

            {/* Sección LOI */}
            <div style={{borderTop:"1px solid #e8ecf8",marginTop:10,paddingTop:10}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
                <input type="checkbox" checked={!!lnk.tiene_loi} onChange={()=>toggleLOI(lnk)}
                  style={{width:16,height:16,accentColor:"#7c3aed",cursor:"pointer"}} />
                <span style={{fontSize:12,fontWeight:700,color:"#7c3aed"}}>
                  {lnk.tiene_loi?"✅ Tiene LOI":"☐ Tiene LOI"}
                </span>
                {lnk.tiene_loi&&lnk.loi_fecha&&<span style={{fontSize:11,color:"#9ca3af"}}>· {lnk.loi_fecha}</span>}
              </label>

              {lnk.tiene_loi&&(
                <div style={{marginTop:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:9,marginBottom:10}}>
                    <div>
                      <label className="fl">Fecha LOI</label>
                      <input className="fi" type="date" value={fd.loi_fecha||today()} onChange={e=>updateLoiField(lnk.id,'loi_fecha',e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Oferta cliente (€)</label>
                      <input className="fi" type="number" value={fd.loi_oferta||''} placeholder="0" onChange={e=>updateLoiField(lnk.id,'loi_oferta',e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">Tasas Oficiales (€)</label>
                      <input className="fi" type="text" value={fd.loi_tasas!==''&&fd.loi_tasas!=null?new Intl.NumberFormat('es-ES').format(Number(fd.loi_tasas)):''} readOnly placeholder="5% oferta"
                        style={{background:"#f0f3fc",color:"#374151",cursor:"default"}} />
                    </div>
                    <div>
                      <label className="fl">Honorarios (€)</label>
                      <input className="fi" type="number" value={fd.loi_honorarios_importe||''} placeholder="0" onChange={e=>updateLoiField(lnk.id,'loi_honorarios_importe',e.target.value)} />
                    </div>
                    <div>
                      <label className="fl">% Honorarios (auto)</label>
                      <input className="fi" type="text" value={fd.loi_honorarios_porcentaje!==''?`${fd.loi_honorarios_porcentaje}%`:''} readOnly placeholder="—"
                        style={{background:"#f0f3fc",color:"#374151",cursor:"default"}} />
                    </div>
                  </div>
                  {fd.loi_oferta&&(
                    <div style={{background:"#f5f3ff",borderRadius:7,padding:"6px 10px",marginBottom:10,fontSize:11,color:"#7c3aed"}}>
                      Oferta: <strong>{new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(Number(fd.loi_oferta))}</strong>
                      {fd.loi_honorarios_importe&&<> · Honorarios: <strong>{new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(Number(fd.loi_honorarios_importe))}</strong></>}
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button className="btn-g" style={{fontSize:11,padding:"5px 11px"}} onClick={()=>saveLoiData(lnk)}>💾 Guardar datos LOI</button>
                    {/* LOI Honorarios */}
                    {!lnk.loi_documento_url?(
                      <button className="btn-p" style={{fontSize:11,padding:"5px 11px",background:"#7c3aed",opacity:isGenLOI?0.6:1}} onClick={()=>genLOI(lnk,c)} disabled={isGenLOI}>
                        {isGenLOI?"Generando...":"📝 LOI Honorarios"}
                      </button>
                    ):(
                      <>
                        <button className="btn-p" style={{fontSize:11,padding:"5px 11px",background:"#059669"}} onClick={()=>verLOI(lnk)}>👁️ Ver LOI Hon.</button>
                        <button className="btn-p" style={{fontSize:11,padding:"5px 11px",background:"#7c3aed",opacity:isGenLOI?0.6:1}} onClick={()=>genLOI(lnk,c,true)} disabled={isGenLOI}>
                          {isGenLOI?"Regenerando...":"🔄 Regen. LOI Hon."}
                        </button>
                      </>
                    )}
                    {/* LOI Juzgado */}
                    {!lnk.loi_juzgado_url?(
                      <button className="btn-p" style={{fontSize:11,padding:"5px 11px",background:"#0369a1",opacity:isGenLOIJuzgado?0.6:1}} onClick={()=>genLOIJuzgado(lnk,c)} disabled={isGenLOIJuzgado}>
                        {isGenLOIJuzgado?"Generando...":"🏛️ LOI Juzgado"}
                      </button>
                    ):(
                      <>
                        <button className="btn-p" style={{fontSize:11,padding:"5px 11px",background:"#059669"}} onClick={()=>verLOIJuzgado(lnk)}>👁️ Ver LOI Juzg.</button>
                        <button className="btn-p" style={{fontSize:11,padding:"5px 11px",background:"#0369a1",opacity:isGenLOIJuzgado?0.6:1}} onClick={()=>genLOIJuzgado(lnk,c)} disabled={isGenLOIJuzgado}>
                          {isGenLOIJuzgado?"Regenerando...":"🔄 Regen. LOI Juzg."}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {linked.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#9ca3af",fontSize:12}}>Sin clientes vinculados. Busca y añade clientes del CRM.</p>}
    </div>
  );
}

// ── Pestaña Registro de gestiones ─────────────────────────────────────────────
function AuctionInteractions({ auctionId, user, users, contacts }) {
  const [ints, setInts] = useState([]);
  const [showF, setShowF] = useState(false);
  const [ni, setNi] = useState({tipo:"Llamada",fecha:today(),descripcion:"",contact_id:""});
  const [linkedContacts, setLinkedContacts] = useState([]);

  useEffect(()=>{
    supabase.from('auction_interactions').select('*').eq('auction_id',auctionId).order('fecha',{ascending:false})
      .then(({data})=>setInts(data||[]));
    supabase.from('auction_clients').select('contact_id').eq('auction_id',auctionId)
      .then(({data})=>setLinkedContacts((data||[]).map(r=>r.contact_id)));
  },[auctionId]);

  const add = async() => {
    if(!ni.descripcion.trim())return;
    const rec={id:genId(),auction_id:auctionId,tipo:ni.tipo,fecha:ni.fecha,descripcion:ni.descripcion,contact_id:ni.contact_id||null,comercial_id:user.id,created_at:today()};
    const {data:inserted,error}=await supabase.from('auction_interactions').insert(rec).select().single();
    if(error){alert(`Error: ${error.message}`);return;}
    setInts(i=>[inserted,...i]);
    setNi({tipo:"Llamada",fecha:today(),descripcion:"",contact_id:""});
    setShowF(false);
  };

  const del = async(id)=>{
    if(!window.confirm("¿Eliminar esta gestión?"))return;
    await supabase.from('auction_interactions').delete().eq('id',id);
    setInts(i=>i.filter(x=>x.id!==id));
  };

  const linkedContactsData = contacts.filter(c=>linkedContacts.includes(c.id));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:12,color:"#6b7280",fontWeight:600}}>{ints.length} gestiones</span>
        <button className="btn-p" style={{fontSize:12,padding:"5px 12px"}} onClick={()=>setShowF(s=>!s)}>+ Añadir gestión</button>
      </div>

      {showF&&(
        <div style={{background:"#f8f9fd",borderRadius:10,padding:14,marginBottom:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <div><label className="fl">Tipo</label>
              <select className="fi" value={ni.tipo} onChange={e=>setNi(f=>({...f,tipo:e.target.value}))}>
                {INT_TIPOS.map(t=><option key={t} value={t}>{INT_ICONS[t]} {t}</option>)}
              </select>
            </div>
            <div><label className="fl">Fecha</label><input className="fi" type="date" value={ni.fecha} onChange={e=>setNi(f=>({...f,fecha:e.target.value}))} /></div>
            {linkedContactsData.length>0&&(
              <div style={{gridColumn:"1 / -1"}}><label className="fl">Cliente vinculado (opcional)</label>
                <select className="fi" value={ni.contact_id||""} onChange={e=>setNi(f=>({...f,contact_id:e.target.value}))}>
                  <option value="">— Sin cliente —</option>
                  {linkedContactsData.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div><label className="fl">Descripción</label><textarea className="fi" rows={2} value={ni.descripcion} onChange={e=>setNi(f=>({...f,descripcion:e.target.value}))} placeholder="Describe la gestión realizada..." /></div>
          <div style={{display:"flex",gap:8,marginTop:9,justifyContent:"flex-end"}}>
            <button className="btn-g" onClick={()=>setShowF(false)}>Cancelar</button>
            <button className="btn-p" onClick={add}>Guardar</button>
          </div>
        </div>
      )}

      {ints.map(i=>{
        const u=users.find(x=>x.id===i.comercial_id);
        const c=contacts.find(x=>x.id===i.contact_id);
        return (
          <div key={i.id} className="ii">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <span style={{fontSize:17}}>{INT_ICONS[i.tipo]||"📝"}</span>
                <div>
                  <span style={{fontSize:12,fontWeight:700,color:BRAND}}>{i.tipo}</span>
                  <span style={{fontSize:10,color:"#9ca3af",marginLeft:7}}>{i.fecha} · {u?.name}</span>
                  {c&&<span style={{fontSize:10,color:"#7c3aed",marginLeft:7}}>👤 {c.name}</span>}
                </div>
              </div>
              <button onClick={()=>del(i.id)} style={{background:"none",border:"none",fontSize:12,cursor:"pointer",color:"#fca5a5"}}>✕</button>
            </div>
            <p style={{fontSize:12,color:"#374151",marginTop:5,lineHeight:1.5}}>{i.descripcion}</p>
          </div>
        );
      })}
      {ints.length===0&&<p style={{textAlign:"center",padding:"24px 0",color:"#9ca3af",fontSize:12}}>Sin gestiones registradas.</p>}
    </div>
  );
}
