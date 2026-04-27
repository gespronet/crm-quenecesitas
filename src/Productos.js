import { useState, useEffect } from "react";
import { supabase } from "./utils/supabase";
import logo from "./Que Necesitas - Logo para web y Favicon.png";

const BRAND  = "#002292";
const tday   = () => new Date().toISOString().split("T")[0];
const genId  = () => crypto.randomUUID();
const IVA    = 0.21;
const e2     = n => (Math.round((+n) * 100) / 100).toFixed(2);
const fmtE   = (n, suffix = "") => `${e2(n)} €${suffix}`;

const CATS = {
  alarmas:  { label:"🔐 Alarmas ADT",        cat:"Alarmas ADT", color:"#dc2626", light:"#fef2f2" },
  energia:  { label:"⚡ Energía / Luz y gas", cat:"Energía",     color:"#d97706", light:"#fffbeb" },
  telefonia:{ label:"📱 Telefonía móvil",     cat:"Telefonía",   color:"#7c3aed", light:"#f5f3ff" },
};
// Busca la entrada de CATS por el valor real de la columna categoria en BD
const catLookup = (dbVal) => Object.values(CATS).find(v => v.cat === dbVal) || { label:dbVal, color:BRAND, light:"#f0f3fb" };

// Mapeo linea de negocio → claves de CATS (para filtrar por permisos)
const LINEA_TO_CAT_KEYS = {
  alarmas:      ["alarmas"],
  energia:      ["energia","telefonia"],
  inmobiliaria: [],
  subastas:     [],
};

const SUBS_ADT = [
  { key:"seguridad",    label:"🔒 Seguridad"            },
  { key:"video",        label:"📹 Vídeo"                 },
  { key:"conectividad", label:"🌐 Conectividad"          },
  { key:"adicionales",  label:"🛠️ Elementos adicionales" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcTotals(items, products, tipoInst) {
  let cuota = 0, cuotaIva = 0, costeUnico = 0;
  for (const it of items) {
    const p = products.find(x => x.id === it.productId); if (!p) continue;
    const qty = it.cantidad || 1;
    if (it.modoPrecio === "pvp") {
      costeUnico += (p.precio_sin_iva || 0) * qty;
      // en modo compra no hay cuota mensual
    } else {
      cuota    += (p.cuota_sin_iva || 0) * qty;
      cuotaIva += (p.cuota_con_iva || 0) * qty;
      costeUnico += (p.precio_instalacion || 0) * qty;
    }
  }
  return { cuota, cuotaIva, costeUnico };
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function printQuote({ quoteId, fecha, tipoInst, notas, rawItems, products, contact, comercial }) {
  const perm  = tipoInst === "negocio" ? 36 : 24;
  const tipoL = tipoInst === "negocio" ? "Negocio / Profesional" : "Residencial";

  const rows = rawItems.map(it => {
    const p = products.find(x => x.id === (it.product_id || it.productId)) || {};
    const qty = it.cantidad || 1;
    const modo = it.modo_precio || it.modoPrecio || "cuota";
    const cuotaU    = modo === "pvp" ? 0 : (p.cuota_sin_iva || 0);
    const cuotaIvaU = modo === "pvp" ? 0 : (p.cuota_con_iva || 0);
    const unicoU    = modo === "pvp" ? (p.precio_sin_iva || 0) : (p.precio_instalacion || 0);
    return { nombre: it.nombre_snapshot || p.nombre || "—", qty, modo, cuotaU, cuotaIvaU, unicoU };
  });

  const totalCuota    = rows.reduce((s, r) => s + r.cuotaU    * r.qty, 0);
  const totalCuotaIva = rows.reduce((s, r) => s + r.cuotaIvaU * r.qty, 0);
  const totalUnico    = rows.reduce((s, r) => s + r.unicoU    * r.qty, 0);

  const rowsHtml = rows.map(r => `
    <tr>
      <td><strong>${r.nombre}</strong></td>
      <td style="text-align:center">${r.qty}</td>
      <td style="text-align:center">${r.modo === "pvp" ? "Compra" : "Cuota"}</td>
      <td style="text-align:right">${r.cuotaU > 0 ? fmtE(r.cuotaIvaU * r.qty, "/mes") : "—"}</td>
      <td style="text-align:right">${r.unicoU > 0 ? fmtE(r.unicoU * r.qty) : "Incluido"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Presupuesto ${(quoteId || "").slice(-8).toUpperCase()}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a2e;padding:28px 36px;}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:14px;border-bottom:3px solid #002292;}
.logo{width:52px;height:52px;border-radius:10px;object-fit:cover;}
.brand{font-size:20px;font-weight:800;color:#002292;letter-spacing:1px;}
.brand-sub{font-size:10px;color:#6b7280;margin-top:2px;}
.info-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px;background:#f8f9fd;padding:13px 16px;border-radius:8px;}
.ik p:first-child{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin-bottom:2px;}
.ik p:last-child{font-size:12px;font-weight:600;color:#1a1a2e;}
.sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:8px;}
table{width:100%;border-collapse:collapse;margin-bottom:18px;}
th{background:#002292;color:white;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left;}
td{padding:7px 10px;border-bottom:1px solid #f0f3fb;font-size:11px;}
tr:nth-child(even) td{background:#f8f9fd;}
.totals{background:#002292;color:white;border-radius:10px;padding:14px 18px;margin-bottom:14px;}
.tr{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:5px;}
.tr.main{font-size:15px;font-weight:800;border-top:1px solid rgba(255,255,255,.3);padding-top:8px;margin-top:4px;}
.cond{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:11px 14px;margin-bottom:12px;font-size:11px;line-height:1.5;}
.notes-box{background:#f8f9fd;border-radius:8px;padding:11px 14px;margin-bottom:12px;font-size:11px;}
.footer{border-top:2px solid #e8ecf8;padding-top:10px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between;margin-top:8px;}
@media print{@page{margin:1.5cm;}body{padding:0;}}
</style></head><body>
<div class="hdr">
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${logo}" class="logo" alt="queNECESITAS" onerror="this.style.display='none'"/>
    <div><div class="brand">queNECESITAS</div><div class="brand-sub">Plataforma de servicios multisector · Galicia</div></div>
  </div>
  <div style="text-align:right;font-size:11px;color:#6b7280">
    <div style="font-size:14px;font-weight:800;color:#002292">PRESUPUESTO</div>
    <div style="margin-top:2px">Nº ${(quoteId || "").slice(-8).toUpperCase()}</div>
    <div style="margin-top:2px;font-weight:600;color:#374151">Fecha: ${fecha}</div>
  </div>
</div>

<p class="sec">Datos del cliente</p>
<div class="info-grid">
  <div class="ik"><p>Cliente</p><p>${contact?.name || "—"}</p></div>
  <div class="ik"><p>Empresa</p><p>${contact?.empresa || "—"}</p></div>
  <div class="ik"><p>Teléfono</p><p>${contact?.phone || "—"}</p></div>
  <div class="ik"><p>Email</p><p>${contact?.email || "—"}</p></div>
  <div class="ik"><p>Tipo instalación</p><p>${tipoL}</p></div>
  <div class="ik"><p>Comercial</p><p>${comercial?.name || "—"}</p></div>
</div>

<p class="sec">Productos y servicios</p>
<table>
  <thead><tr>
    <th>Producto / Servicio</th>
    <th style="text-align:center">Uds.</th>
    <th style="text-align:center">Modalidad</th>
    <th style="text-align:right">Cuota/mes (IVA inc.)</th>
    <th style="text-align:right">Coste único</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>

<div class="totals">
  <div class="tr"><span>Cuota mensual (sin IVA)</span><span>${fmtE(totalCuota, "/mes")}</span></div>
  <div class="tr"><span>IVA (21%)</span><span>${fmtE(totalCuotaIva - totalCuota, "/mes")}</span></div>
  <div class="tr main"><span>💡 Cuota mensual total (IVA incluido)</span><span>${fmtE(totalCuotaIva, "/mes")}</span></div>
  ${totalUnico > 0 ? `<div class="tr" style="margin-top:8px"><span>🔧 Coste instalación / equipos</span><span>${fmtE(totalUnico)}</span></div>` : ""}
</div>

<div class="cond">
  ⚠️ <strong>Permanencia mínima: ${perm} meses</strong> (${tipoL}).
  Los precios se indican con IVA incluido (21%) salvo los totalizadores sin IVA.
  Presupuesto válido durante 30 días desde la fecha de emisión.
</div>
${notas ? `<div class="notes-box">📝 <strong>Observaciones:</strong> ${notas}</div>` : ""}

<div class="footer">
  <span>queNECESITAS CRM · Galicia</span>
  <span>${comercial?.email || ""}</span>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open("", "_blank", "width=960,height=720");
  if (!w) { alert("Activa las ventanas emergentes en tu navegador para generar el PDF."); return; }
  w.document.write(html);
  w.document.close();
}

// ── Catálogo View ─────────────────────────────────────────────────────────────
function CatalogoView({ products, catFilter, setCatFilter, canEdit, onEdit, onAdd, onToggle, allowedCatKeys }) {
  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.categoria]) grouped[p.categoria] = {};
    const sub = p.subcategoria || "_root";
    if (!grouped[p.categoria][sub]) grouped[p.categoria][sub] = [];
    grouped[p.categoria][sub].push(p);
  });

  return (
    <div>
      {/* Category filters */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setCatFilter("all")} style={{padding:"6px 14px",borderRadius:20,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:catFilter==="all"?BRAND:"#f0f3fb",color:catFilter==="all"?"white":"#6b7280"}}>
          Todos
        </button>
        {Object.entries(CATS).filter(([k])=>allowedCatKeys.includes(k)).map(([k,v])=>(
          <button key={k} onClick={()=>setCatFilter(k)} style={{padding:"6px 14px",borderRadius:20,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:catFilter===k?v.color:"#f0f3fb",color:catFilter===k?"white":"#6b7280"}}>
            {v.label}
          </button>
        ))}
        {canEdit && (
          <button className="btn-p" style={{marginLeft:"auto",fontSize:12,padding:"6px 14px"}} onClick={onAdd}>
            + Añadir producto
          </button>
        )}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card" style={{padding:48,textAlign:"center",color:"#9ca3af"}}>
          <p style={{fontSize:32,marginBottom:8}}>📦</p>
          {catFilter === "all" ? (
            <>
              <p style={{fontSize:14,marginBottom:4}}>El catálogo está vacío</p>
              {canEdit && <p style={{fontSize:12}}>Añade productos manualmente o ejecuta los INSERTs de Supabase.</p>}
            </>
          ) : (
            <>
              <p style={{fontSize:14,marginBottom:4}}>Sin productos en esta categoría</p>
              <p style={{fontSize:11,marginTop:6}}>
                Filtrando por: <code style={{background:"#f0f3fb",padding:"1px 6px",borderRadius:4}}>{catFilter}</code>
              </p>
              <p style={{fontSize:11,color:"#f59e0b",marginTop:6}}>
                ⚠️ Revisa la consola — el campo <code>categoria</code> en Supabase
                puede tener un valor distinto a <strong>"{catFilter}"</strong>
              </p>
            </>
          )}
        </div>
      )}

      {Object.entries(grouped).map(([cat, subs]) => {
        const cv = catLookup(cat);
        return (
          <div key={cat} style={{marginBottom:28}}>
            <h2 style={{fontSize:16,fontWeight:800,color:cv.color,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
              {cv.label}
              <span style={{fontSize:11,color:"#9ca3af",fontWeight:400}}>({Object.values(subs).flat().length} productos)</span>
            </h2>
            {Object.entries(subs).map(([sub, prods]) => {
              const subLabel = SUBS_ADT.find(s=>s.key===sub)?.label || (sub === "_root" ? "" : sub);
              return (
                <div key={sub} style={{marginBottom:16}}>
                  {subLabel && <h3 style={{fontSize:12,fontWeight:800,color:"#374151",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>{subLabel}</h3>}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                    {prods.map(p => (
                      <ProductCard key={p.id} product={p} catColor={cv.color} catLight={cv.light} canEdit={canEdit} onEdit={()=>onEdit(p)} onToggle={()=>onToggle(p.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ProductCard({ product: p, catColor, catLight, canEdit, onEdit, onToggle }) {
  const cuota    = parseFloat(p.cuota_sin_iva)      || 0;
  const cuotaIva = parseFloat(p.cuota_con_iva)      || 0;
  const pvp      = parseFloat(p.precio_sin_iva)     || 0;
  const pvpIva   = parseFloat(p.precio_con_iva)     || 0;
  const inst     = parseFloat(p.precio_instalacion) || 0;
  const isInactivo = p.activo === false;

  return (
    <div className="card" style={{padding:14,opacity:isInactivo?.55:1,position:"relative",borderTop:`3px solid ${catColor}`}}>
      {isInactivo && (
        <span style={{position:"absolute",top:8,right:8,fontSize:9,fontWeight:700,background:"#fee2e2",color:"#dc2626",padding:"2px 6px",borderRadius:20}}>INACTIVO</span>
      )}
      {p.tipo_producto === "paquete_base" && (
        <span style={{position:"absolute",top:8,right:isInactivo?68:8,fontSize:9,fontWeight:700,background:catLight,color:catColor,padding:"2px 6px",borderRadius:20}}>BASE</span>
      )}
      <p style={{fontSize:13,fontWeight:700,color:"#1e2a4a",marginBottom:6,paddingRight:p.tipo_producto==="paquete_base"?52:0}}>{p.nombre}</p>
      {p.descripcion && <p style={{fontSize:10,color:"#9ca3af",marginBottom:8,lineHeight:1.4}}>{p.descripcion}</p>}

      {/* Cuota mensual — siempre visible, muestra "—" si 0 */}
      <div style={{marginBottom:4}}>
        {cuota > 0 ? (
          <>
            <span style={{fontSize:16,fontWeight:800,color:catColor}}>{fmtE(cuotaIva || cuota)}</span>
            <span style={{fontSize:10,color:"#9ca3af"}}>/mes · sin IVA {fmtE(cuota)}</span>
          </>
        ) : (
          <span style={{fontSize:12,color:"#9ca3af"}}>Cuota: —</span>
        )}
      </div>

      {pvp > 0 && (
        <div style={{fontSize:11,color:"#6b7280",marginBottom:4}}>
          Ó PVP <strong>{fmtE(pvpIva || pvp)}</strong>
          <span style={{fontSize:10,color:"#9ca3af"}}> · sin IVA {fmtE(pvp)}</span>
        </div>
      )}
      {inst > 0 && <div style={{fontSize:10,color:"#6b7280"}}>🔧 Instalación: {fmtE(inst)}</div>}
      {cuota === 0 && pvp === 0 && inst === 0 && (
        <div style={{fontSize:10,color:"#f59e0b",marginTop:4}}>⚠️ Sin precios — edita el producto</div>
      )}

      {canEdit && (
        <div style={{display:"flex",gap:6,marginTop:10,borderTop:"1px solid #f0f3fb",paddingTop:8}}>
          <button className="btn-g" style={{fontSize:11,padding:"3px 8px",flex:1}} onClick={onEdit}>✏️ Editar</button>
          <button className="btn-g" style={{fontSize:11,padding:"3px 8px",color:p.activo?"#d97706":"#059669",borderColor:p.activo?"#fde68a":"#a7f3d0"}} onClick={onToggle}>
            {p.activo ? "⏸ Desactivar" : "▶ Activar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Presupuestos View ─────────────────────────────────────────────────────────
function PresupuestosView({ quotes, contacts, products, user, onNew, onDelete }) {
  const getContact = q => contacts.find(c => c.id === q.contact_id) || { name: q.contact_nombre || "—", phone: q.contact_phone, email:"", empresa: q.contact_empresa };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <p style={{fontSize:13,color:"#6b7280"}}>{quotes.length} presupuesto{quotes.length !== 1 ? "s" : ""} guardado{quotes.length !== 1 ? "s" : ""}</p>
        <button className="btn-p" onClick={onNew}>+ Nuevo presupuesto</button>
      </div>

      {quotes.length === 0 && (
        <div className="card" style={{padding:48,textAlign:"center",color:"#9ca3af"}}>
          <p style={{fontSize:32,marginBottom:8}}>📄</p>
          <p>Aún no hay presupuestos guardados.</p>
          <button className="btn-p" style={{marginTop:16}} onClick={onNew}>Crear primer presupuesto</button>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {quotes.map(q => {
          const contact = getContact(q);
          const items = q.quote_items || [];
          const { cuotaIva, costeUnico } = calcTotals(
            items.map(it => ({ productId: it.product_id, cantidad: it.cantidad, modoPrecio: it.modo_precio })),
            products, q.tipo_instalacion
          );
          return (
            <div key={q.id} className="card" style={{padding:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{width:40,height:40,background:"#eff6ff",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📄</div>
              <div style={{flex:1,minWidth:160}}>
                <p style={{fontSize:13,fontWeight:700,color:BRAND}}>{contact.name}</p>
                <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:"#9ca3af"}}>📅 {q.fecha}</span>
                  <span style={{fontSize:10,color:"#9ca3af"}}>Nº {q.id.slice(-8).toUpperCase()}</span>
                  <span style={{fontSize:10,fontWeight:700,color:q.tipo_instalacion==="negocio"?"#d97706":"#059669",background:q.tipo_instalacion==="negocio"?"#fffbeb":"#f0fdf4",padding:"1px 7px",borderRadius:20}}>
                    {q.tipo_instalacion==="negocio"?"🏢 Negocio":"🏠 Residencial"}
                  </span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:16,fontWeight:800,color:BRAND}}>{fmtE(cuotaIva, "/mes")}</p>
                {costeUnico > 0 && <p style={{fontSize:11,color:"#6b7280"}}>+ {fmtE(costeUnico)} instalación</p>}
                <p style={{fontSize:10,color:"#9ca3af"}}>{items.length} producto{items.length!==1?"s":""}</p>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button className="btn-p" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>
                  printQuote({ quoteId:q.id, fecha:q.fecha, tipoInst:q.tipo_instalacion, notas:q.notas,
                    rawItems: items, products, contact,
                    comercial: { name: user.name, email: user.email } })
                }>
                  📄 PDF
                </button>
                <button className="btn-g" style={{fontSize:12,padding:"6px 10px",color:"#dc2626",borderColor:"#fecaca"}} onClick={()=>onDelete(q.id)}>🗑️</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quote Wizard ──────────────────────────────────────────────────────────────
function QuoteWizardModal({ contacts, products, user, onSave, onClose }) {
  const [step, setStep]         = useState(1);
  const [useExisting, setUseEx] = useState(true);
  const [contactId, setConId]   = useState("");
  const [newContact, setNewC]   = useState({ name:"", phone:"", email:"", empresa:"" });
  const [tipoInst, setTipoInst] = useState("residencial");
  const [fecha, setFecha]       = useState(tday());
  const [items, setItems]       = useState([]);
  const [notas, setNotas]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");

  const baseIds   = products.filter(p => p.tipo_producto === "paquete_base").map(p => p.id);
  const isSelected = id => items.some(it => it.productId === id);
  const getItem   = id => items.find(it => it.productId === id);
  const perm      = tipoInst === "negocio" ? 36 : 24;
  const { cuota, cuotaIva, costeUnico } = calcTotals(items, products, tipoInst);

  const toggleItem = (id, isBase) => {
    if (isSelected(id)) {
      setItems(its => its.filter(it => it.productId !== id));
    } else {
      if (isBase) {
        setItems(its => [...its.filter(it => !baseIds.includes(it.productId)), { productId:id, cantidad:1, modoPrecio:"cuota" }]);
      } else {
        setItems(its => [...its, { productId:id, cantidad:1, modoPrecio:"cuota" }]);
      }
    }
  };
  const setQty  = (id, qty) => setItems(its => its.map(it => it.productId===id?{...it,cantidad:Math.max(1,+qty||1)}:it));
  const setMode = (id, mode) => setItems(its => its.map(it => it.productId===id?{...it,modoPrecio:mode}:it));

  const contactObj = useExisting
    ? contacts.find(c => c.id === contactId)
    : { name: newContact.name, phone: newContact.phone, email: newContact.email, empresa: newContact.empresa };

  const canNext1 = useExisting ? !!contactId : !!newContact.name.trim();
  const canNext2 = items.length > 0;

  const handleSave = async () => {
    setSaving(true);
    const itemsPayload = items.map(it => {
      const p = products.find(x => x.id === it.productId) || {};
      const modo = it.modoPrecio;
      return {
        product_id:               it.productId,
        cantidad:                 it.cantidad,
        modo_precio:              modo,
        nombre_snapshot:          p.nombre || "",
        cuota_unitaria_sin_iva:   modo === "pvp" ? 0 : (p.cuota_sin_iva      || 0),
        cuota_unitaria_con_iva:   modo === "pvp" ? 0 : (p.cuota_con_iva      || 0),
        precio_unitario_sin_iva:  modo === "pvp" ? (p.precio_sin_iva || 0)   : (p.precio_instalacion || 0),
        precio_unitario_con_iva:  modo === "pvp" ? (p.precio_con_iva || 0)   : +(((p.precio_instalacion || 0) * (1 + IVA)).toFixed(2)),
      };
    });
    await onSave({
      contact_id:       useExisting ? (contactId || null) : null,
      contact_nombre:   contactObj?.name    || "",
      contact_phone:    contactObj?.phone   || "",
      contact_empresa:  contactObj?.empresa || "",
      tipo_instalacion: tipoInst,
      fecha,
      notas,
      items: itemsPayload,
    });
    setSaving(false);
  };

  const filteredContacts = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone||"").includes(search)
  );

  // Step 1 ──────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div>
      <h3 style={{fontSize:14,fontWeight:800,color:BRAND,marginBottom:16}}>Paso 1 — Datos del cliente</h3>

      {/* Client type toggle */}
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        {[["existing","👤 Contacto existente"],["new","➕ Nuevo cliente"]].map(([v,l])=>(
          <button key={v} onClick={()=>setUseEx(v==="existing")}
            style={{flex:1,padding:12,borderRadius:10,border:`2px solid ${(useExisting&&v==="existing")||(!useExisting&&v==="new")?BRAND:"#dde2f0"}`,background:(useExisting&&v==="existing")||(!useExisting&&v==="new")?"#eff6ff":"white",cursor:"pointer",fontWeight:700,fontSize:12,color:(useExisting&&v==="existing")||(!useExisting&&v==="new")?BRAND:"#6b7280"}}>
            {l}
          </button>
        ))}
      </div>

      {useExisting ? (
        <div>
          <label className="fl">Buscar contacto</label>
          <input className="fi" placeholder="🔍 Nombre o teléfono…" value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:8}} />
          <div style={{maxHeight:200,overflowY:"auto",border:"1.5px solid #dde2f0",borderRadius:8}}>
            {filteredContacts.slice(0,20).map(c=>(
              <div key={c.id} onClick={()=>setConId(c.id)} style={{padding:"9px 12px",cursor:"pointer",background:contactId===c.id?"#eff6ff":"white",borderBottom:"1px solid #f0f3fb",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:BRAND}}>{c.name}</p>
                  <p style={{fontSize:10,color:"#9ca3af"}}>{c.empresa || ""} {c.phone || ""}</p>
                </div>
                {contactId===c.id && <span style={{color:BRAND,fontSize:16}}>✓</span>}
              </div>
            ))}
            {filteredContacts.length === 0 && <p style={{padding:16,color:"#9ca3af",fontSize:12,textAlign:"center"}}>Sin resultados</p>}
          </div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["name","Nombre *"],["phone","Teléfono"],["email","Email"],["empresa","Empresa"]].map(([k,l])=>(
            <div key={k}><label className="fl">{l}</label>
              <input className="fi" value={newContact[k]||""} onChange={e=>setNewC(f=>({...f,[k]:e.target.value}))} />
            </div>
          ))}
        </div>
      )}

      {/* Tipo instalación */}
      <div style={{marginTop:16}}>
        <label className="fl">Tipo de instalación</label>
        <div style={{display:"flex",gap:10,marginTop:6}}>
          {[["residencial","🏠 Residencial","24 meses permanencia"],["negocio","🏢 Negocio / Profesional","36 meses permanencia"]].map(([v,l,sub])=>(
            <div key={v} onClick={()=>setTipoInst(v)} style={{flex:1,padding:12,borderRadius:10,border:`2px solid ${tipoInst===v?BRAND:"#dde2f0"}`,background:tipoInst===v?"#eff6ff":"white",cursor:"pointer"}}>
              <p style={{fontSize:12,fontWeight:700,color:tipoInst===v?BRAND:"#374151"}}>{l}</p>
              <p style={{fontSize:10,color:"#9ca3af",marginTop:2}}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{marginTop:12}}>
        <label className="fl">Fecha del presupuesto</label>
        <input className="fi" type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{maxWidth:200}} />
      </div>
    </div>
  );

  // Step 2 ──────────────────────────────────────────────────────────────────
  const renderStep2 = () => {
    // products prop ya viene filtrado por activo !== false desde el padre
    const catKeys = [...new Set(products.map(p => p.categoria).filter(Boolean))];

    // Renderiza una fila de producto (inline para acceder a closures)
    const prodRow = (p, cv) => {
      const isBase = p.tipo_producto === "paquete_base";
      const sel    = isSelected(p.id);
      const it     = getItem(p.id);
      const hasPvp = (p.precio_sin_iva || 0) > 0;
      return (
        <div key={p.id}
          style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:3,borderRadius:8,cursor:"pointer",background:sel?cv.light:"white",border:`1.5px solid ${sel?cv.color:"#e8ecf8"}`}}
          onClick={()=>toggleItem(p.id, isBase)}>
          {/* Checkbox / radio */}
          <input type={isBase?"radio":"checkbox"} readOnly checked={sel}
            style={{width:15,height:15,cursor:"pointer",accentColor:cv.color,flexShrink:0}} />
          {/* Nombre + descripción */}
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:12,fontWeight:sel?700:500,color:sel?cv.color:"#1e2a4a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {p.nombre}
              {isBase && <span style={{marginLeft:6,fontSize:9,fontWeight:700,background:cv.light,color:cv.color,padding:"1px 5px",borderRadius:10,border:`1px solid ${cv.color}`}}>BASE</span>}
            </p>
            {p.descripcion && <p style={{fontSize:10,color:"#9ca3af",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.descripcion}</p>}
          </div>
          {/* Precios */}
          <div style={{textAlign:"right",flexShrink:0,minWidth:110}} onClick={e=>e.stopPropagation()}>
            {p.cuota_sin_iva > 0 ? (
              <>
                <span style={{fontSize:12,fontWeight:700,color:cv.color}}>{fmtE(p.cuota_sin_iva)}/mes</span>
                <span style={{fontSize:10,color:"#9ca3af",display:"block"}}>({fmtE(p.cuota_con_iva)} IVA)</span>
              </>
            ) : hasPvp ? (
              <>
                <span style={{fontSize:12,fontWeight:700,color:"#6b7280"}}>PVP {fmtE(p.precio_con_iva||p.precio_sin_iva)}</span>
                <span style={{fontSize:10,color:"#9ca3af",display:"block"}}>sin IVA {fmtE(p.precio_sin_iva)}</span>
              </>
            ) : p.precio_instalacion > 0 ? (
              <span style={{fontSize:11,color:"#6b7280"}}>Inst. {fmtE(p.precio_instalacion)}</span>
            ) : (
              <span style={{fontSize:10,color:"#d1d5db"}}>Sin precio</span>
            )}
          </div>
          {/* Controles: cantidad o botón añadir */}
          {sel ? (
            <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}} onClick={e=>e.stopPropagation()}>
              {hasPvp && !isBase && (
                <button onClick={()=>setMode(p.id, it?.modoPrecio==="pvp"?"cuota":"pvp")}
                  style={{fontSize:9,padding:"2px 6px",borderRadius:20,border:`1px solid ${cv.color}`,background:it?.modoPrecio==="pvp"?cv.color:"white",color:it?.modoPrecio==="pvp"?"white":cv.color,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>
                  {it?.modoPrecio==="pvp"?"PVP":"Cuota"}
                </button>
              )}
              {!isBase && (
                <input type="number" min="1" max="20" value={it?.cantidad||1}
                  onChange={e=>setQty(p.id,e.target.value)}
                  style={{width:44,padding:"3px 5px",border:`1.5px solid ${cv.color}`,borderRadius:6,fontSize:12,textAlign:"center",color:cv.color,fontWeight:700}} />
              )}
            </div>
          ) : (
            <button
              style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:`1.5px solid ${cv.color}`,background:"white",color:cv.color,cursor:"pointer",fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}
              onClick={e=>{e.stopPropagation();toggleItem(p.id,isBase);}}>
              + Añadir
            </button>
          )}
        </div>
      );
    };

    return (
      <div>
        <h3 style={{fontSize:14,fontWeight:800,color:BRAND,marginBottom:12}}>Paso 2 — Seleccionar productos</h3>
        <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
          {/* Product list */}
          <div style={{flex:1,maxHeight:460,overflowY:"auto",paddingRight:4}}>
            {catKeys.map(cat => {
              const catProds = products.filter(p => p.categoria === cat);
              const cv       = catLookup(cat);
              // Grupos de subcategoría derivados de los valores reales de la BD
              const subKeys  = [...new Set(catProds.map(p => p.subcategoria).filter(Boolean))];
              return (
                <div key={cat} style={{marginBottom:20}}>
                  {/* Cabecera categoría */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,paddingBottom:6,borderBottom:`2px solid ${cv.color}`}}>
                    <span style={{fontSize:13,fontWeight:800,color:cv.color,textTransform:"uppercase",letterSpacing:".5px"}}>{cv.label}</span>
                    <span style={{fontSize:10,color:"#9ca3af"}}>({catProds.length})</span>
                  </div>
                  {/* Productos sin subcategoría */}
                  {catProds.filter(p => !p.subcategoria).map(p => prodRow(p, cv))}
                  {/* Productos agrupados por subcategoría */}
                  {subKeys.map(sk => {
                    const subLabel = SUBS_ADT.find(s => s.key.toLowerCase() === sk.toLowerCase())?.label || sk;
                    const subProds = catProds.filter(p => p.subcategoria === sk);
                    return (
                      <div key={sk} style={{marginBottom:12}}>
                        <p style={{fontSize:10,fontWeight:800,color:"#6b7280",textTransform:"uppercase",letterSpacing:".6px",marginBottom:6,paddingLeft:2}}>{subLabel}</p>
                        {subProds.map(p => prodRow(p, cv))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {products.length === 0 && (
              <p style={{color:"#9ca3af",fontSize:12,padding:24,textAlign:"center"}}>No hay productos activos en el catálogo.</p>
            )}
          </div>

          {/* Live totals */}
          <div style={{width:190,flexShrink:0,position:"sticky",top:0}}>
            <div style={{background:BRAND,borderRadius:12,padding:14,color:"white"}}>
              <p style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginBottom:12,opacity:.8}}>Resumen</p>
              <div style={{fontSize:11,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                <span>Cuota sin IVA</span><span style={{fontWeight:700}}>{fmtE(cuota, "/mes")}</span>
              </div>
              <div style={{fontSize:13,marginBottom:6,display:"flex",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,.3)",paddingTop:8}}>
                <span style={{fontWeight:700}}>Con IVA</span><span style={{fontWeight:800}}>{fmtE(cuotaIva, "/mes")}</span>
              </div>
              {costeUnico > 0 && (
                <div style={{fontSize:11,marginBottom:6,display:"flex",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,.3)",paddingTop:8}}>
                  <span>Instalación</span><span style={{fontWeight:700}}>{fmtE(costeUnico)}</span>
                </div>
              )}
              <div style={{marginTop:10,borderTop:"1px solid rgba(255,255,255,.3)",paddingTop:8,fontSize:10,opacity:.8}}>
                <p>Permanencia: <strong>{perm} meses</strong></p>
                <p style={{marginTop:3}}>Tipo: <strong>{tipoInst==="negocio"?"Negocio":"Residencial"}</strong></p>
              </div>
            </div>
            <div style={{marginTop:10,padding:10,background:"#f8f9fd",borderRadius:10,fontSize:10,color:"#6b7280"}}>
              <p style={{fontWeight:700,marginBottom:4}}>{items.length} producto{items.length!==1?"s":""} seleccionado{items.length!==1?"s":""}</p>
              {items.slice(0,5).map(it=>{
                const p=products.find(x=>x.id===it.productId);
                return p ? <p key={it.productId} style={{marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>• {p.nombre}</p> : null;
              })}
              {items.length > 5 && <p>…y {items.length-5} más</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Step 3 ──────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div>
      <h3 style={{fontSize:14,fontWeight:800,color:BRAND,marginBottom:14}}>Paso 3 — Resumen y generación</h3>

      {/* Client info */}
      <div style={{background:"#f8f9fd",borderRadius:10,padding:12,marginBottom:14,display:"flex",gap:16,flexWrap:"wrap"}}>
        <div><p style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:2}}>Cliente</p><p style={{fontSize:12,fontWeight:700,color:BRAND}}>{contactObj?.name || "—"}</p></div>
        {contactObj?.empresa && <div><p style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:2}}>Empresa</p><p style={{fontSize:12,color:"#374151"}}>{contactObj.empresa}</p></div>}
        <div><p style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:2}}>Tipo</p><p style={{fontSize:12,color:"#374151"}}>{tipoInst==="negocio"?"🏢 Negocio":"🏠 Residencial"}</p></div>
        <div><p style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:2}}>Fecha</p><p style={{fontSize:12,color:"#374151"}}>{fecha}</p></div>
        <div><p style={{fontSize:9,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",marginBottom:2}}>Permanencia</p><p style={{fontSize:12,color:"#374151"}}>{perm} meses</p></div>
      </div>

      {/* Items table */}
      <div style={{overflowX:"auto",marginBottom:14}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#f8f9fd"}}>
              {["Producto","Uds.","Modalidad","Cuota/mes (IVA)","Coste único"].map(h=>(
                <th key={h} style={{padding:"7px 10px",textAlign:h==="Cuota/mes (IVA)"||h==="Coste único"?"right":"left",fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const p = products.find(x=>x.id===it.productId)||{};
              const cuotaU    = it.modoPrecio==="pvp" ? 0 : (p.cuota_sin_iva||0);
              const cuotaIvaU = it.modoPrecio==="pvp" ? 0 : (p.cuota_con_iva||0);
              const unicoU    = it.modoPrecio==="pvp" ? (p.precio_sin_iva||0) : (p.precio_instalacion||0);
              return (
                <tr key={it.productId} style={{borderTop:"1px solid #f0f3fb"}}>
                  <td style={{padding:"7px 10px",fontWeight:600,color:"#1e2a4a"}}>{p.nombre||"—"}</td>
                  <td style={{padding:"7px 10px",textAlign:"left"}}>{it.cantidad}</td>
                  <td style={{padding:"7px 10px"}}><span style={{fontSize:10,fontWeight:700,background:it.modoPrecio==="pvp"?"#fffbeb":"#eff6ff",color:it.modoPrecio==="pvp"?"#d97706":BRAND,padding:"1px 7px",borderRadius:20}}>{it.modoPrecio==="pvp"?"Compra":"Cuota"}</span></td>
                  <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:BRAND}}>{cuotaU>0?fmtE(cuotaIvaU*it.cantidad,"/mes"):"—"}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",color:"#6b7280"}}>{unicoU>0?fmtE(unicoU*it.cantidad):"Incluido"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{borderTop:"2px solid #002292",background:"#eff6ff"}}>
              <td colSpan={3} style={{padding:"9px 10px",fontWeight:800,color:BRAND,fontSize:13}}>TOTAL</td>
              <td style={{padding:"9px 10px",textAlign:"right",fontWeight:800,color:BRAND,fontSize:13}}>{fmtE(cuotaIva, "/mes")}</td>
              <td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:"#6b7280"}}>{costeUnico>0?fmtE(costeUnico):"—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{marginBottom:14}}>
        <label className="fl">Notas / condiciones especiales</label>
        <textarea className="fi" rows={3} placeholder="Información adicional, condiciones especiales…" value={notas} onChange={e=>setNotas(e.target.value)} />
      </div>

      <div style={{background:"#fffbeb",borderRadius:8,padding:10,fontSize:11,color:"#92400e",borderLeft:"3px solid #fbbf24"}}>
        ⚠️ Permanencia mínima: <strong>{perm} meses</strong> · {tipoInst==="negocio"?"Negocio/Profesional":"Residencial"}
      </div>
    </div>
  );

  return (
    <div className="mb" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo mo-lg" style={{maxWidth:860}}>
        {/* Header + stepper */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontSize:17,fontWeight:800,color:BRAND}}>📄 Nuevo presupuesto</h2>
          <button className="btn-g" style={{fontSize:13}} onClick={onClose}>✕</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          {[1,2,3].map(n=>(
            <div key={n} style={{flex:1,height:4,borderRadius:2,background:step>=n?BRAND:"#e8ecf8"}}/>
          ))}
        </div>

        {step===1 && renderStep1()}
        {step===2 && renderStep2()}
        {step===3 && renderStep3()}

        {/* Navigation */}
        <div style={{display:"flex",justifyContent:"space-between",marginTop:20,borderTop:"1px solid #f0f3fb",paddingTop:16}}>
          <button className="btn-g" onClick={step===1?onClose:()=>setStep(s=>s-1)}>
            {step===1?"Cancelar":"← Anterior"}
          </button>
          <div style={{display:"flex",gap:8}}>
            {step===3 && (
              <button className="btn-g" style={{color:BRAND,borderColor:"#b8c3e8"}} onClick={()=>
                printQuote({ quoteId:"PREVIEW", fecha, tipoInst, notas,
                  rawItems: items.map(it=>({product_id:it.productId,cantidad:it.cantidad,modo_precio:it.modoPrecio})),
                  products, contact: contactObj,
                  comercial: { name:user.name, email:user.email } })
              }>
                📄 Generar PDF
              </button>
            )}
            {step < 3 ? (
              <button className="btn-p" onClick={()=>setStep(s=>s+1)} disabled={step===1?!canNext1:!canNext2}>
                Siguiente →
              </button>
            ) : (
              <button className="btn-p" onClick={handleSave} disabled={saving}>
                {saving?"Guardando…":"💾 Guardar presupuesto"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product Form Modal ────────────────────────────────────────────────────────
function ProductFormModal({ product, onSave, onClose }) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    categoria:CATS.alarmas.cat, subcategoria:"", nombre:"", descripcion:"",
    cuota_sin_iva:0, cuota_con_iva:0, precio_instalacion:0,
    precio_sin_iva:0, precio_con_iva:0, tipo_producto:"adicional", activo:true,
    ...product,
  });

  const upd = (k,v) => setForm(f => {
    const next = { ...f, [k]:v };
    if (k === "cuota_sin_iva")  next.cuota_con_iva  = +(+v * (1 + IVA)).toFixed(2);
    if (k === "precio_sin_iva") next.precio_con_iva = +(+v * (1 + IVA)).toFixed(2);
    return next;
  });

  const handleSave = () => {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio."); return; }
    onSave(form, isNew);
  };

  return (
    <div className="mb" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="mo">
        <h2 style={{fontSize:17,fontWeight:800,color:BRAND,marginBottom:18}}>{isNew?"Nuevo producto":"Editar producto"}</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
          <div><label className="fl">Categoría</label>
            <select className="fi" value={form.categoria} onChange={e=>upd("categoria",e.target.value)}>
              {Object.entries(CATS).map(([k,v])=><option key={k} value={v.cat}>{v.label}</option>)}
            </select>
          </div>
          <div><label className="fl">Subcategoría</label>
            {form.categoria===CATS.alarmas.cat ? (
              <select className="fi" value={form.subcategoria||""} onChange={e=>upd("subcategoria",e.target.value)}>
                <option value="">—</option>
                {SUBS_ADT.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            ) : (
              <input className="fi" value={form.subcategoria||""} onChange={e=>upd("subcategoria",e.target.value)} placeholder="Opcional" />
            )}
          </div>
          <div style={{gridColumn:"1 / -1"}}><label className="fl">Nombre *</label>
            <input className="fi" value={form.nombre} onChange={e=>upd("nombre",e.target.value)} />
          </div>
          <div style={{gridColumn:"1 / -1"}}><label className="fl">Descripción</label>
            <input className="fi" value={form.descripcion||""} onChange={e=>upd("descripcion",e.target.value)} />
          </div>
          <div><label className="fl">Tipo</label>
            <select className="fi" value={form.tipo_producto} onChange={e=>upd("tipo_producto",e.target.value)}>
              <option value="adicional">Adicional</option>
              <option value="paquete_base">Paquete base</option>
            </select>
          </div>
          <div><label className="fl">Cuota mensual (sin IVA) €</label>
            <input className="fi" type="number" step="0.01" value={form.cuota_sin_iva||0} onChange={e=>upd("cuota_sin_iva",+e.target.value)} />
          </div>
          <div><label className="fl">Cuota mensual (con IVA) €</label>
            <input className="fi" type="number" step="0.01" value={form.cuota_con_iva||0} onChange={e=>upd("cuota_con_iva",+e.target.value)} />
          </div>
          <div><label className="fl">Precio instalación €</label>
            <input className="fi" type="number" step="0.01" value={form.precio_instalacion||0} onChange={e=>upd("precio_instalacion",+e.target.value)} />
          </div>
          <div><label className="fl">Precio PVP (sin IVA) €</label>
            <input className="fi" type="number" step="0.01" value={form.precio_sin_iva||0} onChange={e=>upd("precio_sin_iva",+e.target.value)} />
          </div>
          <div><label className="fl">Precio PVP (con IVA) €</label>
            <input className="fi" type="number" step="0.01" value={form.precio_con_iva||0} onChange={e=>upd("precio_con_iva",+e.target.value)} />
          </div>
        </div>
        <div style={{marginTop:14,display:"flex",alignItems:"center",gap:8}}>
          <input type="checkbox" id="activo" checked={form.activo} onChange={e=>upd("activo",e.target.checked)} style={{width:14,height:14,accentColor:BRAND}} />
          <label htmlFor="activo" style={{fontSize:13,color:"#374151",cursor:"pointer"}}>Producto activo</label>
        </div>
        <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"flex-end"}}>
          <button className="btn-g" onClick={onClose}>Cancelar</button>
          <button className="btn-p" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Quotes (usado en App.js ContactDetail) ────────────────────────────
export function ContactQuotes({ contactId, contacts, user }) {
  const [quotes, setQuotes] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data:qs }, { data:ps }] = await Promise.all([
        supabase.from("quotes").select("*, quote_items(*)").eq("contact_id", contactId).order("created_at",{ascending:false}),
        supabase.from("products").select("id,nombre,cuota_sin_iva,cuota_con_iva,precio_instalacion,precio_sin_iva,precio_con_iva").order("nombre"),
      ]);
      setQuotes(qs || []);
      setProducts(ps || []);
      setLoading(false);
    };
    load();
  }, [contactId]);

  if (loading) return <p style={{color:"#9ca3af",fontSize:12,padding:"16px 0"}}>Cargando presupuestos…</p>;
  if (quotes.length === 0) return <p style={{color:"#9ca3af",fontSize:12,padding:"16px 0",textAlign:"center"}}>No hay presupuestos para este contacto.</p>;

  const contact = contacts.find(c => c.id === contactId) || {};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {quotes.map(q => {
        const items = q.quote_items || [];
        const { cuotaIva, costeUnico } = calcTotals(
          items.map(it => ({ productId:it.product_id, cantidad:it.cantidad, modoPrecio:it.modo_precio })),
          products, q.tipo_instalacion
        );
        return (
          <div key={q.id} style={{background:"#f8f9fd",borderRadius:10,padding:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <div>
              <p style={{fontSize:12,fontWeight:700,color:BRAND}}>Presupuesto {q.id.slice(-8).toUpperCase()}</p>
              <div style={{display:"flex",gap:8,marginTop:3}}>
                <span style={{fontSize:10,color:"#9ca3af"}}>📅 {q.fecha}</span>
                <span style={{fontSize:10,fontWeight:700,color:q.tipo_instalacion==="negocio"?"#d97706":"#059669"}}>{q.tipo_instalacion==="negocio"?"🏢":"🏠"} {q.tipo_instalacion==="negocio"?"Negocio":"Residencial"}</span>
                <span style={{fontSize:10,color:"#9ca3af"}}>{items.length} productos</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:14,fontWeight:800,color:BRAND}}>{fmtE(cuotaIva, "/mes")}</p>
              {costeUnico > 0 && <p style={{fontSize:10,color:"#6b7280"}}>+ {fmtE(costeUnico)} inst.</p>}
            </div>
            <button className="btn-p" style={{fontSize:11,padding:"5px 10px",flexShrink:0}} onClick={()=>
              printQuote({ quoteId:q.id, fecha:q.fecha, tipoInst:q.tipo_instalacion, notas:q.notas,
                rawItems:items, products, contact,
                comercial:{ name:user.name, email:user.email } })
            }>📄 PDF</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Productos({ user, contacts }) {
  const [tab,         setTab]       = useState("catalogo");
  const [products,    setProducts]  = useState([]);
  const [quotes,      setQuotes]    = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [showWizard,  setWizard]    = useState(false);
  const [editProduct, setEditProd]  = useState(null);
  const [catFilter,   setCatFilter] = useState("all");
  const [dbError,     setDbError]   = useState(null);
  const canEdit = ["admin","socio"].includes(user.role);
  const isPriv  = canEdit; // admin/socio ven todo
  const allowedCatKeys   = isPriv ? Object.keys(CATS) : [...new Set((user.lineaPermisos||[]).flatMap(l=>LINEA_TO_CAT_KEYS[l]||[]))];
  const allowedCatValues = allowedCatKeys.map(k=>CATS[k]?.cat).filter(Boolean);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  const loadAll = async () => {
    setLoading(true);

    // Productos — independiente, no bloquea si quotes falla
    const prodRes = await supabase.from("products").select("*").order("nombre");
    setProducts(prodRes.data || []);
    setDbError(prodRes.error?.message || null);

    // Presupuestos — fallo aislado para que no afecte al catálogo
    try {
      const quotRes = await supabase.from("quotes")
        .select("*")
        .eq("comercial_id", user.id)
        .order("created_at", { ascending: false });
      const qs = quotRes.data || [];

      // Cargar items por separado (más robusto que el join si FK no está configurada)
      const qIds = qs.map(q => q.id);
      let allItems = [];
      if (qIds.length > 0) {
        const { data:itemsData } = await supabase.from("quote_items")
          .select("*").in("quote_id", qIds);
        allItems = itemsData || [];
      }

      // Unir items a cada presupuesto
      setQuotes(qs.map(q => ({
        ...q,
        quote_items: allItems.filter(it => it.quote_id === q.id),
      })));
    } catch (e) {
      console.warn("[Productos] quotes no disponibles:", e.message);
      setQuotes([]);
    }

    setLoading(false);
  };

  const matchCat = (p) => (p.categoria||"").trim() === (CATS[catFilter]?.cat || catFilter);
  const visibleProducts = (() => {
    let ps = isPriv
      ? products
      : products.filter(p => p.activo!==false && allowedCatValues.includes((p.categoria||"").trim()));
    return catFilter==="all" ? ps : ps.filter(matchCat);
  })();

  const saveProduct = async (form, isNew) => {
    if (isNew) {
      const { data } = await supabase.from("products").insert({ ...form, id:genId() }).select().single();
      if (data) setProducts(p => [...p, data]);
    } else {
      await supabase.from("products").update(form).eq("id", form.id);
      setProducts(p => p.map(x => x.id===form.id ? form : x));
    }
    setEditProd(null);
  };

  const toggleProduct = async (id) => {
    const p = products.find(x=>x.id===id); if (!p) return;
    await supabase.from("products").update({ activo:!p.activo }).eq("id", id);
    setProducts(ps => ps.map(x => x.id===id ? {...x,activo:!x.activo} : x));
  };

  const saveQuote = async (quoteData) => {
    const { items, ...quote } = quoteData;
    const quoteId = genId();

    // 1. Guardar cabecera del presupuesto
    const { data:qRec, error:qErr } = await supabase.from("quotes")
      .insert({ ...quote, id:quoteId, comercial_id:user.id }).select().single();
    if (qErr || !qRec) { alert("Error al guardar presupuesto:\n" + (qErr?.message||"")); return; }

    // 2. Guardar líneas
    let savedItems = [];
    if (items.length > 0) {
      const { data:itemsRec, error:iErr } = await supabase.from("quote_items")
        .insert(items.map(it => ({ id:genId(), quote_id:quoteId, ...it }))).select();
      if (iErr) { console.error('[saveQuote] quote_items error:', iErr?.message, iErr?.details, iErr); }
      savedItems = itemsRec || [];
    }

    // 3. Intentar re-fetch con join; si no funciona, fetch separado de items
    let quoteToAdd;
    const { data:fresh } = await supabase.from("quotes")
      .select("*, quote_items(*)").eq("id", quoteId).single();

    if (fresh && Array.isArray(fresh.quote_items) && fresh.quote_items.length === items.length) {
      quoteToAdd = fresh;
    } else {
      // Join no disponible o FK no configurada → fetch separado
      const { data:itemsFresh } = await supabase.from("quote_items")
        .select("*").eq("quote_id", quoteId);
      quoteToAdd = { ...qRec, quote_items: itemsFresh || savedItems };
    }

    setQuotes(qs => [quoteToAdd, ...qs]);
    setWizard(false);
    setTab("presupuestos");
  };

  const deleteQuote = async (id) => {
    if (!window.confirm("¿Eliminar este presupuesto?")) return;
    await supabase.from("quotes").delete().eq("id", id);
    setQuotes(qs => qs.filter(q => q.id !== id));
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:BRAND}}>📦 Productos & Presupuestos</h1>
          <p style={{color:"#9ca3af",fontSize:12}}>Catálogo de servicios y generador de presupuestos</p>
        </div>
        <button className="btn-p" onClick={()=>setWizard(true)}>+ Nuevo presupuesto</button>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:18}}>
        {[["catalogo","📦 Catálogo"],["presupuestos","📄 Presupuestos"]].map(([t,l])=>(
          <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {dbError && (
        <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:12}}>
          <p style={{fontWeight:700,color:"#dc2626",marginBottom:4}}>⚠️ Error al cargar desde Supabase</p>
          <p style={{color:"#991b1b",fontFamily:"monospace"}}>{dbError}</p>
          <p style={{color:"#6b7280",marginTop:6}}>
            Causa más probable: <strong>Row Level Security (RLS)</strong> activo sin política SELECT.
            Ejecuta en Supabase SQL Editor:<br/>
            <code style={{background:"#fee2e2",padding:"2px 6px",borderRadius:4,display:"inline-block",marginTop:4}}>
              alter table products enable row level security;<br/>
              create policy "Lectura pública" on products for select using (true);
            </code>
          </p>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:"center",padding:48,color:"#9ca3af"}}><p style={{fontSize:32,marginBottom:8}}>⏳</p><p>Cargando…</p></div>
      ) : tab==="catalogo" ? (
        <CatalogoView products={visibleProducts} catFilter={catFilter} setCatFilter={setCatFilter} canEdit={canEdit} onEdit={p=>setEditProd(p)} onAdd={()=>setEditProd({})} onToggle={toggleProduct} allowedCatKeys={allowedCatKeys} />
      ) : (
        <PresupuestosView quotes={quotes} contacts={contacts} products={products} user={user} onNew={()=>setWizard(true)} onDelete={deleteQuote} />
      )}

      {showWizard && (
        <QuoteWizardModal contacts={contacts} products={products.filter(p=>p.activo!==false&&(isPriv||allowedCatValues.includes((p.categoria||"").trim())))} user={user} onSave={saveQuote} onClose={()=>setWizard(false)} />
      )}
      {editProduct!==null && canEdit && (
        <ProductFormModal product={editProduct} onSave={saveProduct} onClose={()=>setEditProd(null)} />
      )}
    </div>
  );
}
