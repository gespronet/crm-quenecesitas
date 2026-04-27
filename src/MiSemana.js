import { useState, useEffect } from "react";
import { supabase } from "./utils/supabase";

const BRAND = "#002292";
const DIAS  = ["Lunes","Martes","Miércoles","Jueves","Viernes"];

const ACTIVIDAD = {
  llamada:           { label:"Llamada",          icon:"📞", color:"#2563eb", light:"#dbeafe", duracion:15  },
  visita_particular: { label:"Visita particular", icon:"🏠", color:"#059669", light:"#d1fae5", duracion:60  },
  visita_empresa:    { label:"Visita empresa",    icon:"🏢", color:"#d97706", light:"#fef3c7", duracion:90  },
  administrativo:    { label:"Administrativo",    icon:"📋", color:"#6b7280", light:"#f3f4f6", duracion:30  },
  formacion:         { label:"Formación",         icon:"🎓", color:"#7c3aed", light:"#ede9fe", duracion:60  },
  seguimiento:       { label:"Seguimiento",       icon:"🔄", color:"#0891b2", light:"#cffafe", duracion:20  },
};

const DEFAULT_DURATIONS = Object.fromEntries(
  Object.entries(ACTIVIDAD).map(([k,v]) => [k, v.duracion])
);

const GOALS_CFG = [
  { key:"llamadas",             label:"Llamadas a prospectos",  tipo:"llamada"           },
  { key:"visitas_particulares", label:"Visitas a particulares", tipo:"visita_particular"  },
  { key:"visitas_empresas",     label:"Visitas a empresas",     tipo:"visita_empresa"     },
  { key:"administrativo",       label:"Tareas administrativas", tipo:"administrativo"     },
  { key:"formacion",            label:"Formación / reuniones",  tipo:"formacion"          },
  { key:"seguimientos",         label:"Seguimientos clientes",  tipo:"seguimiento"        },
];

const DEFAULT_SCHEDULE = [1,2,3,4,5].map(d=>({
  dayOfWeek:d, morningStart:"09:00", morningEnd:"14:00",
  afternoonStart:"16:00", afternoonEnd:"19:00",
}));
const DEFAULT_GOALS = { llamadas:0, visitas_particulares:0, visitas_empresas:0, administrativo:0, formacion:0, seguimientos:0 };

function genId()          { return crypto.randomUUID(); }
function timeToMin(t)     { if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; }
function minToTime(m)     { return `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`; }
function addWeeks(ds,w)   { const d=new Date(ds+"T12:00:00"); d.setDate(d.getDate()+w*7); return d.toISOString().split("T")[0]; }
function currentMonday()  { const n=new Date(); const d=n.getDay(); const m=new Date(n); m.setDate(n.getDate()-((d+6)%7)); return m.toISOString().split("T")[0]; }
function dayLabel(ws,off) { const d=new Date(ws+"T12:00:00"); d.setDate(d.getDate()+off); return d.toLocaleDateString("es-ES",{day:"numeric",month:"short"}); }
function fmtMin(min)      { const h=Math.floor(min/60); const m=min%60; return h>0?(m>0?`${h}h ${m}′`:`${h}h`):`${m}′`; }
function dateForDay(ws,dayOfWeek) {
  const d=new Date(ws+"T12:00:00"); d.setDate(d.getDate()+(dayOfWeek-1)); return d.toISOString().split("T")[0];
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MiSemana({ user, allUsers, onAddTasks, onRemoveTasks, onSyncTaskCompletion }) {
  const [tab,        setTab]        = useState("planificacion");
  const [weekStart,  setWeekStart]  = useState(currentMonday);
  const [viewUserId, setViewUserId] = useState(user.id);
  const [schedule,   setSchedule]   = useState(DEFAULT_SCHEDULE);
  const [goals,      setGoals]      = useState(DEFAULT_GOALS);
  const [goalsId,    setGoalsId]    = useState(null);
  const [blocks,     setBlocks]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [drag,       setDrag]       = useState(null);
  const [durations,  setDurations]  = useState({...DEFAULT_DURATIONS});
  const [notes,      setNotes]      = useState({});
  const [templates,  setTemplates]  = useState([]);

  const canViewOthers = ["admin","socio"].includes(user.role);

  useEffect(() => { loadData(); }, [weekStart, viewUserId]); // eslint-disable-line
  useEffect(() => { loadTemplates(); }, [viewUserId]); // eslint-disable-line

  const loadData = async () => {
    setLoading(true);

    // Horario
    const { data: schData } = await supabase
      .from("schedules").select("*").eq("comercial_id", viewUserId);
    if (schData?.length > 0) {
      const loaded = schData.map(s=>({
        id:s.id, dayOfWeek:s.day_of_week,
        morningStart:   s.morning_start?.slice(0,5)   || "",
        morningEnd:     s.morning_end?.slice(0,5)     || "",
        afternoonStart: s.afternoon_start?.slice(0,5) || "",
        afternoonEnd:   s.afternoon_end?.slice(0,5)   || "",
      }));
      setSchedule(DEFAULT_SCHEDULE.map(def=>loaded.find(l=>l.dayOfWeek===def.dayOfWeek)||def));
    } else {
      setSchedule(DEFAULT_SCHEDULE);
    }

    // Duraciones personalizadas
    const { data: durData } = await supabase
      .from("activity_durations").select("*").eq("comercial_id", viewUserId);
    if (durData?.length > 0) {
      const custom = { ...DEFAULT_DURATIONS };
      durData.forEach(d => { custom[d.tipo] = d.duracion; });
      setDurations(custom);
    } else {
      setDurations({ ...DEFAULT_DURATIONS });
    }

    // Objetivos semana
    const { data: gData } = await supabase
      .from("weekly_goals").select("*")
      .eq("comercial_id", viewUserId).eq("week_start", weekStart)
      .maybeSingle();
    if (gData) {
      setGoals({ llamadas:gData.llamadas||0, visitas_particulares:gData.visitas_particulares||0,
        visitas_empresas:gData.visitas_empresas||0, administrativo:gData.administrativo||0,
        formacion:gData.formacion||0, seguimientos:gData.seguimientos||0 });
      setGoalsId(gData.id);
    } else {
      setGoals(DEFAULT_GOALS); setGoalsId(null);
    }

    // Bloques semana
    const { data: bData, error: bErr } = await supabase
      .from("weekly_plans").select("*")
      .eq("comercial_id", viewUserId).eq("week_start", weekStart);
    if (bErr) {
      console.error('[loadData] weekly_plans SELECT error:', bErr);
      alert(`Error al cargar la planificación:\n${bErr.message}\n\nCódigo: ${bErr.code}`);
    }
    setBlocks((bData||[]).map(b=>({
      id:b.id, tipo:b.tipo, dayOfWeek:b.day_of_week,
      startTime:b.hora_inicio?.slice(0,5)||"09:00",
      durationMinutes:b.duration_minutes, completada:b.completado, titulo:b.titulo,
    })));

    // Notas diarias de la semana
    const weekDates = [1,2,3,4,5].map(d=>dateForDay(weekStart,d));
    const { data: notesData } = await supabase
      .from("daily_notes").select("*")
      .eq("comercial_id", viewUserId)
      .in("fecha", weekDates);
    const notesMap = {};
    (notesData||[]).forEach(n => { notesMap[n.fecha] = { id:n.id, nota:n.nota||"" }; });
    setNotes(notesMap);

    setLoading(false);
  };

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("weekly_templates").select("id,nombre,created_at")
      .eq("comercial_id", viewUserId)
      .order("created_at", { ascending:false });
    setTemplates(data||[]);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const saveSchedule = async (newSch) => {
    const { error: delErr } = await supabase.from("schedules").delete().eq("comercial_id", viewUserId);
    if (delErr) { console.error('[saveSchedule delete]', delErr); alert(`Error al guardar horario:\n${delErr.message}`); return; }
    const { error: insErr } = await supabase.from("schedules").insert(newSch.map(s=>({
      id:genId(), comercial_id:viewUserId, day_of_week:s.dayOfWeek,
      morning_start:s.morningStart||null,  morning_end:s.morningEnd||null,
      afternoon_start:s.afternoonStart||null, afternoon_end:s.afternoonEnd||null,
    })));
    if (insErr) { console.error('[saveSchedule insert]', insErr); alert(`Error al guardar horario:\n${insErr.message}`); return; }
    setSchedule(newSch);
  };

  const saveDurations = async (newDur) => {
    await supabase.from("activity_durations").delete().eq("comercial_id", viewUserId);
    const rows = Object.entries(newDur).map(([tipo, duracion]) => ({
      id: genId(), comercial_id: viewUserId, tipo, duracion,
    }));
    if (rows.length > 0) await supabase.from("activity_durations").insert(rows);
    setDurations(newDur);
  };

  const saveGoals = async (newGoals) => {
    if (goalsId) {
      const { error } = await supabase.from("weekly_goals").update(newGoals).eq("id", goalsId);
      if (error) { console.error('[saveGoals update]', error); alert(`Error al guardar objetivos:\n${error.message}`); return; }
    } else {
      const payload = { id:genId(), comercial_id:viewUserId, week_start:weekStart, ...newGoals };
      const { data:rec, error } = await supabase.from("weekly_goals").insert(payload).select().single();
      if (error) { console.error('[saveGoals insert]', error); alert(`Error al guardar objetivos:\n${error.message}`); return; }
      if (rec) setGoalsId(rec.id);
    }
    setGoals(newGoals);
  };

  const generateBlocks = async () => {
    const daySlots = {};
    schedule.forEach(sch => {
      daySlots[sch.dayOfWeek] = [];
      if (sch.morningStart && sch.morningEnd)
        daySlots[sch.dayOfWeek].push({ cur:timeToMin(sch.morningStart), end:timeToMin(sch.morningEnd) });
      if (sch.afternoonStart && sch.afternoonEnd)
        daySlots[sch.dayOfWeek].push({ cur:timeToMin(sch.afternoonStart), end:timeToMin(sch.afternoonEnd) });
    });

    const planItems = [];
    GOALS_CFG.forEach(gc => {
      for (let i=0; i<(goals[gc.key]||0); i++)
        planItems.push({ tipo:gc.tipo, duration:durations[gc.tipo]||ACTIVIDAD[gc.tipo].duracion });
    });

    const newBlocks = [];
    let dayIdx = 0;
    const days = [1,2,3,4,5];
    for (const item of planItems) {
      let placed = false;
      for (let attempt=0; attempt<5&&!placed; attempt++) {
        const day = days[(dayIdx+attempt)%5];
        const slot = (daySlots[day]||[]).find(s=>s.end-s.cur>=item.duration);
        if (slot) {
          newBlocks.push({ id:genId(), tipo:item.tipo, dayOfWeek:day,
            startTime:minToTime(slot.cur), durationMinutes:item.duration,
            completada:false, titulo:ACTIVIDAD[item.tipo].label });
          slot.cur += item.duration;
          dayIdx = (dayIdx+1)%5;
          placed = true;
        }
      }
    }

    // IDs de los bloques actuales a eliminar del estado App
    const oldBlockIds = blocks.map(b => b.id);

    // Borrar plan anterior en Supabase
    const { error: delPlanErr } = await supabase.from("weekly_plans").delete()
      .eq("comercial_id", viewUserId).eq("week_start", weekStart);
    if (delPlanErr) { alert("Error al generar semana:\n" + delPlanErr.message); return; }

    // Borrar tasks antiguas vinculadas a este plan
    if (oldBlockIds.length > 0) {
      await supabase.from("tasks").delete().in("id", oldBlockIds);
      onRemoveTasks?.(oldBlockIds);
    }

    if (newBlocks.length > 0) {
      // Insertar nuevos bloques en weekly_plans
      const insertPayload = newBlocks.map(b=>({
        id:b.id, comercial_id:viewUserId, week_start:weekStart,
        day_of_week:b.dayOfWeek, tipo:b.tipo,
        hora_inicio:b.startTime,
        hora_fin:minToTime(timeToMin(b.startTime)+b.durationMinutes),
        duration_minutes:b.durationMinutes, completado:false, titulo:b.titulo,
        task_id:b.id, notas:null,
      }));
      const { error: insPlanErr } = await supabase
        .from("weekly_plans").insert(insertPayload);
      if (insPlanErr) { alert("Error al guardar planificación:\n" + insPlanErr.message); return; }

      // Crear tasks correspondientes (mismo id) para sincronizar con pestaña Tareas
      const taskRows = newBlocks.map(b => ({
        id: b.id,
        titulo: b.titulo,
        fecha: dateForDay(weekStart, b.dayOfWeek),
        prioridad: "media",
        completada: false,
        comercial_id: viewUserId,
      }));
      const { data: insertedTasks, error: insTaskErr } = await supabase.from("tasks").insert(taskRows).select();
      if (insTaskErr) console.error('[generateBlocks] tasks error:', insTaskErr);
      onAddTasks?.(insertedTasks || []);
    }

    // Verificar que los datos quedaron en BD leyendo de vuelta
    const { data: savedData, error: verifyErr } = await supabase
      .from("weekly_plans").select("*")
      .eq("comercial_id", viewUserId).eq("week_start", weekStart);
    if (verifyErr || !savedData?.length) {
      alert(`⚠️ Los bloques se generaron pero no se pudieron leer de la base de datos.\nError: ${verifyErr?.message || 'SELECT devolvió vacío — revisa que RLS está desactivado en weekly_plans'}`);
      setBlocks(newBlocks); // Mostrar en sesión actual aunque no persista
    } else {
      setBlocks(savedData.map(b=>({
        id:b.id, tipo:b.tipo, dayOfWeek:b.day_of_week,
        startTime:b.hora_inicio?.slice(0,5)||"09:00",
        durationMinutes:b.duration_minutes, completada:b.completado, titulo:b.titulo,
      })));
    }
  };

  const resetWeek = async () => {
    if (!window.confirm("¿Resetear todos los bloques de esta semana? Los objetivos y el horario se mantendrán.")) return;
    const blockIds = blocks.map(b => b.id);
    await supabase.from("weekly_plans").delete()
      .eq("comercial_id", viewUserId).eq("week_start", weekStart);
    if (blockIds.length > 0) {
      await supabase.from("tasks").delete().in("id", blockIds);
      onRemoveTasks?.(blockIds);
    }
    setBlocks([]);
  };

  const saveTemplate = async (nombre) => {
    const templateId = genId();
    const { error } = await supabase.from("weekly_templates").insert({
      id: templateId, comercial_id: viewUserId, nombre,
    });
    if (error) { alert("Error al guardar plantilla: " + error.message); return; }
    const blockRows = blocks.map(b => ({
      id: genId(), template_id: templateId,
      tipo: b.tipo, day_of_week: b.dayOfWeek,
      start_time: b.startTime, duration_minutes: b.durationMinutes, titulo: b.titulo,
    }));
    if (blockRows.length > 0) await supabase.from("weekly_template_blocks").insert(blockRows);
    await loadTemplates();
  };

  const applyTemplate = async (templateId) => {
    if (!window.confirm("¿Aplicar esta plantilla? Se reemplazarán los bloques actuales de esta semana.")) return;
    const { data: tBlocks } = await supabase
      .from("weekly_template_blocks").select("*").eq("template_id", templateId);
    if (!tBlocks) return;
    const newBlocks = tBlocks.map(b => ({
      id: genId(), tipo: b.tipo, dayOfWeek: b.day_of_week,
      startTime: b.start_time?.slice(0,5)||"09:00",
      durationMinutes: b.duration_minutes, completada: false, titulo: b.titulo,
    }));

    const oldBlockIds = blocks.map(b => b.id);
    await supabase.from("weekly_plans").delete()
      .eq("comercial_id", viewUserId).eq("week_start", weekStart);
    if (oldBlockIds.length > 0) {
      await supabase.from("tasks").delete().in("id", oldBlockIds);
      onRemoveTasks?.(oldBlockIds);
    }

    if (newBlocks.length > 0) {
      const { error: insPlanErr } = await supabase.from("weekly_plans").insert(newBlocks.map(b=>({
        id:b.id, comercial_id:viewUserId, week_start:weekStart,
        day_of_week:b.dayOfWeek, tipo:b.tipo,
        hora_inicio:b.startTime,
        hora_fin:minToTime(timeToMin(b.startTime)+b.durationMinutes),
        duration_minutes:b.durationMinutes, completado:false, titulo:b.titulo,
        task_id:b.id, notas:null,
      })));
      if (insPlanErr) { alert("Error al aplicar plantilla:\n" + insPlanErr.message); return; }

      const taskRows = newBlocks.map(b => ({
        id: b.id,
        titulo: b.titulo,
        fecha: dateForDay(weekStart, b.dayOfWeek),
        prioridad: "media",
        completada: false,
        comercial_id: viewUserId,
      }));
      const { data: insertedTasks } = await supabase.from("tasks").insert(taskRows).select();
      onAddTasks?.(insertedTasks || []);
    }
    setBlocks(newBlocks);
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm("¿Eliminar esta plantilla?")) return;
    await supabase.from("weekly_templates").delete().eq("id", id);
    setTemplates(ts => ts.filter(t => t.id !== id));
  };

  const saveNote = async (fecha, nota) => {
    const existing = notes[fecha];
    if (existing?.id) {
      await supabase.from("daily_notes").update({ nota }).eq("id", existing.id);
      setNotes(n => ({ ...n, [fecha]: { ...existing, nota } }));
    } else {
      const id = genId();
      await supabase.from("daily_notes").insert({ id, comercial_id: viewUserId, fecha, nota });
      setNotes(n => ({ ...n, [fecha]: { id, nota } }));
    }
  };

  const toggleBlock = async (id) => {
    const b = blocks.find(b=>b.id===id); if(!b) return;
    const newVal = !b.completada;
    await supabase.from("weekly_plans").update({ completado: newVal }).eq("id", id);
    await supabase.from("tasks").update({ completada: newVal }).eq("id", id);
    setBlocks(bs=>bs.map(b=>b.id===id?{...b,completada:newVal}:b));
    onSyncTaskCompletion?.(id, newVal);
  };

  const moveBlock = async (blockId, newDay) => {
    const newFecha = dateForDay(weekStart, newDay);
    await supabase.from("weekly_plans").update({ day_of_week:newDay }).eq("id", blockId);
    await supabase.from("tasks").update({ fecha:newFecha }).eq("id", blockId);
    setBlocks(bs=>bs.map(b=>b.id===blockId?{...b,dayOfWeek:newDay}:b));
  };

  const deleteBlock = async (id) => {
    await supabase.from("weekly_plans").delete().eq("id", id);
    await supabase.from("tasks").delete().eq("id", id);
    onRemoveTasks?.([id]);
    setBlocks(bs=>bs.filter(b=>b.id!==id));
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  const completed = {};
  GOALS_CFG.forEach(gc => { completed[gc.key] = blocks.filter(b=>b.tipo===gc.tipo&&b.completada).length; });
  const totalGoal = GOALS_CFG.reduce((s,gc)=>s+(goals[gc.key]||0),0);
  const totalDone = GOALS_CFG.reduce((s,gc)=>s+(completed[gc.key]||0),0);
  const pct = totalGoal>0 ? Math.round((totalDone/totalGoal)*100) : 0;

  const viewUser = allUsers?.find(u=>u.id===viewUserId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:800,color:BRAND}}>
            📅 Mi Semana
            {viewUserId!==user.id&&viewUser&&<span style={{fontSize:16,color:"#9ca3af",fontWeight:400}}> — {viewUser.name}</span>}
          </h1>
          <p style={{color:"#9ca3af",fontSize:12}}>Semana del {dayLabel(weekStart,0)} al {dayLabel(weekStart,4)}</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {canViewOthers&&allUsers&&(
            <select className="fi" style={{maxWidth:180,fontSize:12}} value={viewUserId} onChange={e=>setViewUserId(e.target.value)}>
              <option value={user.id}>Mi semana</option>
              {allUsers.filter(u=>u.id!==user.id&&u.role!=="admin").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button className="btn-g" onClick={()=>setWeekStart(w=>addWeeks(w,-1))}>← Anterior</button>
          <button className="btn-g" style={{fontWeight:700}} onClick={()=>setWeekStart(currentMonday())}>Hoy</button>
          <button className="btn-g" onClick={()=>setWeekStart(w=>addWeeks(w,1))}>Siguiente →</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:18}}>
        {[["planificacion","📅 Planificación"],["horario","🕐 Mi horario"],["resumen","📊 Resumen"]].map(([t,l])=>(
          <button key={t} className={`tab ${tab===t?"on":""}`} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{textAlign:"center",padding:48,color:"#9ca3af"}}>
          <p style={{fontSize:32,marginBottom:8}}>⏳</p><p>Cargando semana...</p>
        </div>
      ) : tab==="horario" ? (
        <ScheduleEditor schedule={schedule} onSave={saveSchedule} durations={durations} onSaveDurations={saveDurations} />
      ) : tab==="resumen" ? (
        <WeeklySummary goals={goals} completed={completed} pct={pct} weekStart={weekStart} userId={viewUserId} />
      ) : (
        <PlanificacionView
          schedule={schedule} goals={goals} blocks={blocks} weekStart={weekStart}
          drag={drag} setDrag={setDrag} durations={durations} notes={notes} templates={templates}
          onSaveGoals={saveGoals} onGenerate={generateBlocks}
          onToggle={toggleBlock} onMove={moveBlock} onDelete={deleteBlock}
          onResetWeek={resetWeek}
          onSaveTemplate={saveTemplate} onApplyTemplate={applyTemplate} onDeleteTemplate={deleteTemplate}
          onSaveNote={saveNote}
        />
      )}
    </div>
  );
}

// ─── Schedule Editor ──────────────────────────────────────────────────────────
function ScheduleEditor({ schedule, onSave, durations, onSaveDurations }) {
  const [form,     setForm]     = useState(schedule.map(s=>({...s})));
  const [saved,    setSaved]    = useState(false);
  const [durForm,  setDurForm]  = useState({...durations});
  const [durSaved, setDurSaved] = useState(false);

  useEffect(()=>{ setForm(schedule.map(s=>({...s}))); },[schedule]);
  useEffect(()=>{ setDurForm({...durations}); },[durations]);

  const upd = (i,field,val) => setForm(f=>f.map((d,idx)=>idx===i?{...d,[field]:val}:d));

  const handleSave = async () => {
    await onSave(form);
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const handleSaveDurations = async () => {
    const parsed = Object.fromEntries(
      Object.entries(durForm).map(([k,v]) => [k, Math.max(1, parseInt(v)||DEFAULT_DURATIONS[k])])
    );
    await onSaveDurations(parsed);
    setDurSaved(true); setTimeout(()=>setDurSaved(false),2500);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:720}}>
      {/* Horario */}
      <div className="card" style={{padding:24}}>
        <h2 style={{fontSize:15,fontWeight:800,color:BRAND,marginBottom:4}}>🕐 Horario semanal fijo</h2>
        <p style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>
          Define tu jornada habitual. Se usará para distribuir actividades automáticamente cada semana.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {DIAS.map((dia,i)=>(
            <div key={dia} style={{display:"grid",gridTemplateColumns:"90px 1fr 1fr",gap:12,alignItems:"center",padding:"12px 16px",background:"#f8f9fd",borderRadius:10,border:"1px solid #e8ecf8"}}>
              <span style={{fontWeight:800,color:BRAND,fontSize:13}}>{dia}</span>
              <div>
                <label className="fl">Mañana</label>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="fi" type="time" value={form[i]?.morningStart||""} onChange={e=>upd(i,"morningStart",e.target.value)} />
                  <span style={{color:"#9ca3af",fontSize:11,flexShrink:0}}>a</span>
                  <input className="fi" type="time" value={form[i]?.morningEnd||""} onChange={e=>upd(i,"morningEnd",e.target.value)} />
                </div>
              </div>
              <div>
                <label className="fl">Tarde <span style={{fontWeight:400,color:"#9ca3af"}}>(opcional)</span></label>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="fi" type="time" value={form[i]?.afternoonStart||""} onChange={e=>upd(i,"afternoonStart",e.target.value)} />
                  <span style={{color:"#9ca3af",fontSize:11,flexShrink:0}}>a</span>
                  <input className="fi" type="time" value={form[i]?.afternoonEnd||""} onChange={e=>upd(i,"afternoonEnd",e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
          <button className="btn-p" onClick={handleSave}>
            {saved?"✓ Guardado":"💾 Guardar horario"}
          </button>
        </div>
      </div>

      {/* Duraciones de actividades */}
      <div className="card" style={{padding:24}}>
        <h2 style={{fontSize:15,fontWeight:800,color:BRAND,marginBottom:4}}>⏱️ Duración de actividades</h2>
        <p style={{fontSize:12,color:"#9ca3af",marginBottom:20}}>
          Personaliza la duración en minutos de cada tipo de actividad para la planificación automática.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {Object.entries(ACTIVIDAD).map(([tipo,act])=>(
            <div key={tipo} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#f8f9fd",borderRadius:10,border:"1px solid #e8ecf8"}}>
              <span style={{fontSize:14,flexShrink:0}}>{act.icon}</span>
              <span style={{fontSize:12,fontWeight:600,color:"#374151",flex:1,minWidth:0}}>{act.label}</span>
              <input
                className="fi" type="number" min="1" max="480"
                value={durForm[tipo]??act.duracion}
                onChange={e=>setDurForm(d=>({...d,[tipo]:e.target.value}))}
                style={{width:60,textAlign:"center",borderColor:act.color+"80"}}
              />
              <span style={{fontSize:11,color:"#9ca3af",flexShrink:0}}>min</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
          <button className="btn-p" onClick={handleSaveDurations}>
            {durSaved?"✓ Guardado":"💾 Guardar duraciones"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DayNote ──────────────────────────────────────────────────────────────────
function DayNote({ fecha, initialNota, onSave }) {
  const [val, setVal] = useState(initialNota||"");
  useEffect(()=>{ setVal(initialNota||""); },[initialNota]);

  return (
    <textarea
      value={val}
      onChange={e=>setVal(e.target.value)}
      onBlur={()=>{ if(val!==(initialNota||"")) onSave(fecha,val); }}
      placeholder="Nota del día..."
      style={{
        width:"100%",marginTop:8,fontSize:10,color:"#6b7280",
        border:"1px solid #e8ecf8",borderRadius:6,padding:"6px 8px",
        resize:"vertical",minHeight:48,fontFamily:"inherit",
        background:"#fafbff",outline:"none",boxSizing:"border-box",
      }}
    />
  );
}

// ─── Planificación View ───────────────────────────────────────────────────────
function PlanificacionView({
  schedule, goals, blocks, weekStart, drag, setDrag,
  durations, notes, templates,
  onSaveGoals, onGenerate, onToggle, onMove, onDelete,
  onResetWeek, onSaveTemplate, onApplyTemplate, onDeleteTemplate, onSaveNote,
}) {
  const [editGoals, setEditGoals] = useState({...goals});
  const [dirty,     setDirty]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [tplName,   setTplName]   = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(()=>{ setEditGoals({...goals}); setDirty(false); },[goals]);

  const handleGoalChange = (key,val) => {
    setEditGoals(g=>({...g,[key]:Math.max(0,parseInt(val)||0)}));
    setDirty(true);
  };
  const handleSaveGoals = async () => {
    setSaving(true); await onSaveGoals(editGoals); setSaving(false); setDirty(false);
  };

  const handleSaveTemplate = async () => {
    const nombre = tplName.trim();
    if (!nombre) { alert("Escribe un nombre para la plantilla."); return; }
    setSavingTpl(true);
    await onSaveTemplate(nombre);
    setTplName("");
    setSavingTpl(false);
  };

  const hasSchedule = schedule.some(s=>s.morningStart&&s.morningEnd);

  // Carga horaria
  const availableMin = schedule.reduce((sum,s)=>{
    let m=0;
    if(s.morningStart&&s.morningEnd) m+=timeToMin(s.morningEnd)-timeToMin(s.morningStart);
    if(s.afternoonStart&&s.afternoonEnd) m+=timeToMin(s.afternoonEnd)-timeToMin(s.afternoonStart);
    return sum+m;
  },0);
  const plannedMin = GOALS_CFG.reduce((sum,gc)=>{
    return sum + (editGoals[gc.key]||0) * (durations[gc.tipo]||ACTIVIDAD[gc.tipo].duracion);
  },0);
  const overloaded = plannedMin > availableMin;

  return (
    <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>

      {/* ── Panel izquierdo ── */}
      <div style={{width:220,flexShrink:0}}>

        {/* Objetivos */}
        <div className="card" style={{padding:16,marginBottom:12}}>
          <h3 style={{fontSize:11,fontWeight:800,color:BRAND,marginBottom:14,textTransform:"uppercase",letterSpacing:".5px"}}>🎯 Objetivos semanales</h3>
          {GOALS_CFG.map(gc=>{
            const act = ACTIVIDAD[gc.tipo];
            const done  = blocks.filter(b=>b.tipo===gc.tipo&&b.completada).length;
            const total = blocks.filter(b=>b.tipo===gc.tipo).length;
            return (
              <div key={gc.key} style={{marginBottom:11}}>
                <label className="fl" style={{color:act.color}}>{act.icon} {gc.label}</label>
                <input className="fi" type="number" min="0" max="50"
                  value={editGoals[gc.key]||0}
                  onChange={e=>handleGoalChange(gc.key,e.target.value)}
                  style={{borderColor:act.color+"80"}}
                />
                {total>0&&(
                  <div style={{fontSize:10,color:done>=total?"#059669":"#9ca3af",marginTop:3,fontWeight:done>=total?700:400}}>
                    {done}/{total} {done>=total?"✓":"realizadas"}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:14}}>
            {dirty&&(
              <button className="btn-p" style={{fontSize:12,padding:"6px 10px"}} onClick={handleSaveGoals} disabled={saving}>
                {saving?"Guardando...":"💾 Guardar objetivos"}
              </button>
            )}
            <button className="btn-g" style={{fontSize:12,padding:"6px 10px"}} onClick={onGenerate}>
              ⚡ Generar semana
            </button>
            {blocks.length>0&&(
              <button
                style={{fontSize:12,padding:"6px 10px",background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:8,cursor:"pointer",fontWeight:600}}
                onClick={onResetWeek}
              >
                🗑️ Resetear semana
              </button>
            )}
          </div>
          {!hasSchedule&&<p style={{fontSize:10,color:"#f59e0b",marginTop:8}}>⚠️ Configura tu horario primero</p>}
        </div>

        {/* Carga horaria */}
        {availableMin>0&&(
          <div className="card" style={{padding:14,marginBottom:12,background:overloaded?"#fef2f2":"#f0fdf4",border:`1px solid ${overloaded?"#fecaca":"#bbf7d0"}`}}>
            <p style={{fontSize:10,fontWeight:800,color:overloaded?"#dc2626":"#059669",textTransform:"uppercase",marginBottom:8,letterSpacing:".5px"}}>
              ⚡ Carga horaria
            </p>
            <div style={{fontSize:12,color:"#374151",marginBottom:4}}>
              <span style={{fontWeight:700}}>Planificado:</span> {fmtMin(plannedMin)}
            </div>
            <div style={{fontSize:12,color:"#374151",marginBottom:6}}>
              <span style={{fontWeight:700}}>Disponible:</span> {fmtMin(availableMin)}
            </div>
            {overloaded&&(
              <p style={{fontSize:10,color:"#dc2626",fontWeight:600}}>
                ⚠️ Excedes {fmtMin(plannedMin-availableMin)} el tiempo disponible
              </p>
            )}
            {!overloaded&&plannedMin>0&&(
              <p style={{fontSize:10,color:"#059669",fontWeight:600}}>
                Queda {fmtMin(availableMin-plannedMin)} libre
              </p>
            )}
          </div>
        )}

        {/* Plantillas */}
        <div className="card" style={{padding:14,marginBottom:12}}>
          <p style={{fontSize:10,fontWeight:800,color:BRAND,textTransform:"uppercase",marginBottom:10,letterSpacing:".5px"}}>📎 Plantillas</p>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            <input
              className="fi" placeholder="Nombre plantilla"
              value={tplName} onChange={e=>setTplName(e.target.value)}
              style={{fontSize:11,flex:1}}
              onKeyDown={e=>e.key==="Enter"&&handleSaveTemplate()}
            />
            <button className="btn-p" style={{fontSize:11,padding:"5px 8px",whiteSpace:"nowrap"}}
              onClick={handleSaveTemplate} disabled={savingTpl||blocks.length===0}>
              {savingTpl?"...":"Guardar"}
            </button>
          </div>
          {templates.length===0&&(
            <p style={{fontSize:10,color:"#9ca3af",textAlign:"center",padding:"8px 0"}}>Sin plantillas guardadas</p>
          )}
          {templates.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:6,padding:"6px 8px",background:"#f8f9fd",borderRadius:8,border:"1px solid #e8ecf8"}}>
              <span style={{fontSize:11,color:"#374151",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={t.nombre}>{t.nombre}</span>
              <button
                style={{fontSize:10,padding:"2px 6px",background:BRAND,color:"white",border:"none",borderRadius:5,cursor:"pointer",flexShrink:0}}
                onClick={()=>onApplyTemplate(t.id)}
                title="Aplicar plantilla"
              >→</button>
              <button
                style={{fontSize:10,padding:"2px 5px",background:"none",color:"#fca5a5",border:"1px solid #fecaca",borderRadius:5,cursor:"pointer",flexShrink:0}}
                onClick={()=>onDeleteTemplate(t.id)}
                title="Eliminar plantilla"
              >✕</button>
            </div>
          ))}
        </div>

        {/* Leyenda */}
        <div className="card" style={{padding:14}}>
          <p style={{fontSize:10,fontWeight:800,color:"#9ca3af",textTransform:"uppercase",marginBottom:10,letterSpacing:".5px"}}>Tipos · duración</p>
          {Object.entries(ACTIVIDAD).map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
              <div style={{width:8,height:8,borderRadius:2,background:v.color,flexShrink:0}}/>
              <span style={{fontSize:11,color:"#374151"}}>{v.icon} {v.label}</span>
              <span style={{fontSize:10,color:"#9ca3af",marginLeft:"auto"}}>{durations[k]||v.duracion}′</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Calendario ── */}
      <div style={{flex:1,overflowX:"auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,minWidth:580}}>
          {DIAS.map((dia,i)=>{
            const dayNum    = i+1;
            const sch       = schedule.find(s=>s.dayOfWeek===dayNum);
            const dayBlocks = [...blocks].filter(b=>b.dayOfWeek===dayNum)
              .sort((a,b)=>(a.startTime||"").localeCompare(b.startTime||""));
            const fecha   = dateForDay(weekStart, dayNum);
            const dayNote = notes[fecha];
            return (
              <div key={dia}
                style={{background:"#f8f9fd",borderRadius:12,padding:10,minHeight:300,border:"2px solid transparent",transition:"border-color .15s"}}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=BRAND+"50";}}
                onDragLeave={e=>{e.currentTarget.style.borderColor="transparent";}}
                onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="transparent";if(drag){onMove(drag,dayNum);setDrag(null);}}}
              >
                {/* Cabecera día */}
                <div style={{marginBottom:10,paddingBottom:8,borderBottom:"1px solid #e8ecf8"}}>
                  <p style={{fontSize:12,fontWeight:800,color:BRAND,textTransform:"uppercase",letterSpacing:".5px"}}>{dia}</p>
                  <p style={{fontSize:10,color:"#9ca3af"}}>{dayLabel(weekStart,i)}</p>
                  {sch&&(sch.morningStart||sch.afternoonStart)&&(
                    <p style={{fontSize:9,color:"#9ca3af",marginTop:2}}>
                      {sch.morningStart&&`${sch.morningStart}–${sch.morningEnd}`}
                      {sch.afternoonStart&&` · ${sch.afternoonStart}–${sch.afternoonEnd}`}
                    </p>
                  )}
                </div>

                {/* Bloques */}
                {dayBlocks.map(block=>{
                  const act = ACTIVIDAD[block.tipo]||{color:"#6b7280",light:"#f3f4f6",icon:"•",label:block.tipo};
                  return (
                    <div key={block.id} draggable
                      onDragStart={()=>setDrag(block.id)}
                      onDragEnd={()=>setDrag(null)}
                      style={{
                        background:block.completada?"#f0fdf4":"white",
                        border:`1px solid ${act.color}30`,
                        borderLeft:`3px solid ${act.color}`,
                        borderRadius:"0 8px 8px 0",
                        padding:"7px 8px",marginBottom:5,cursor:"grab",
                        opacity:block.completada?.75:1,
                        boxShadow:"0 1px 3px rgba(0,35,146,.06)",
                      }}
                    >
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:11,fontWeight:700,color:block.completada?"#9ca3af":act.color,
                            textDecoration:block.completada?"line-through":"none",
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {act.icon} {act.label}
                          </p>
                          <p style={{fontSize:9,color:"#9ca3af"}}>{block.startTime} · {block.durationMinutes}′</p>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:3,flexShrink:0,marginLeft:4}}>
                          <input type="checkbox" checked={block.completada}
                            onChange={()=>onToggle(block.id)}
                            style={{width:13,height:13,cursor:"pointer",accentColor:act.color}}
                          />
                          <button onClick={()=>onDelete(block.id)}
                            style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:10,padding:0,lineHeight:1}}>✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {dayBlocks.length===0&&(
                  <div style={{textAlign:"center",padding:"28px 0",color:"#dde2f0",fontSize:22}}>○</div>
                )}
                {dayBlocks.length>0&&(
                  <div style={{fontSize:10,color:"#9ca3af",textAlign:"center",marginTop:6}}>
                    {dayBlocks.filter(b=>b.completada).length}/{dayBlocks.length} completadas
                  </div>
                )}

                {/* Nota del día */}
                <DayNote
                  fecha={fecha}
                  initialNota={dayNote?.nota||""}
                  onSave={onSaveNote}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Summary ───────────────────────────────────────────────────────────
function WeeklySummary({ goals, completed, pct, weekStart, userId }) {
  const [streak, setStreak] = useState(null);

  useEffect(()=>{
    const calc = async () => {
      let s = 0;
      for (let i=1; i<=12; i++) {
        const d = new Date(weekStart+"T12:00:00");
        d.setDate(d.getDate()-i*7);
        const prevWS = d.toISOString().split("T")[0];
        const { data:gls } = await supabase.from("weekly_goals").select("*")
          .eq("comercial_id",userId).eq("week_start",prevWS).maybeSingle();
        const { data:blks } = await supabase.from("weekly_plans").select("completado")
          .eq("comercial_id",userId).eq("week_start",prevWS);
        if (!gls||!blks||blks.length===0) break;
        const tg = GOALS_CFG.reduce((a,gc)=>a+(gls[gc.key]||0),0);
        const td = blks.filter(b=>b.completado).length;
        if (tg>0&&td>=tg) s++; else break;
      }
      setStreak(s);
    };
    calc();
  },[weekStart,userId]);

  const totalGoal = GOALS_CFG.reduce((s,gc)=>s+(goals[gc.key]||0),0);
  const totalDone = GOALS_CFG.reduce((s,gc)=>s+(completed[gc.key]||0),0);
  const weekDone  = pct>=100;

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:20}}>
        <div className="sc" style={{borderLeftColor:weekDone?"#059669":BRAND}}>
          <div style={{fontSize:28,fontWeight:800,color:weekDone?"#059669":BRAND,fontFamily:"'Barlow Condensed',sans-serif"}}>{pct}%</div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Cumplimiento semanal</div>
        </div>
        <div className="sc" style={{borderLeftColor:"#374151"}}>
          <div style={{fontSize:28,fontWeight:800,color:"#374151",fontFamily:"'Barlow Condensed',sans-serif"}}>{totalDone}/{totalGoal}</div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Actividades completadas</div>
        </div>
        <div className="sc" style={{borderLeftColor:"#d97706"}}>
          <div style={{fontSize:28,fontWeight:800,color:"#d97706",fontFamily:"'Barlow Condensed',sans-serif"}}>
            🔥 {streak!==null?streak:"…"}
          </div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Semanas consecutivas</div>
        </div>
      </div>

      {/* Barras de progreso */}
      <div className="card" style={{padding:20,maxWidth:540}}>
        <h3 style={{fontSize:13,fontWeight:800,color:BRAND,marginBottom:18,textTransform:"uppercase",letterSpacing:".5px"}}>Objetivos vs realizados</h3>
        {GOALS_CFG.map(gc=>{
          const act  = ACTIVIDAD[gc.tipo];
          const goal = goals[gc.key]||0;
          const done = completed[gc.key]||0;
          const p    = goal>0?Math.min(100,Math.round((done/goal)*100)):0;
          const ok   = goal>0&&done>=goal;
          if (goal===0) return null;
          return (
            <div key={gc.key} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:600,color:"#374151"}}>{act.icon} {gc.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:ok?"#059669":act.color}}>{done}/{goal} {ok?"✓":""}</span>
              </div>
              <div style={{height:8,background:"#f0f3fb",borderRadius:4}}>
                <div style={{height:"100%",width:`${p}%`,background:ok?"#059669":act.color,borderRadius:4,transition:"width .5s"}}/>
              </div>
            </div>
          );
        })}
        {totalGoal===0&&(
          <p style={{color:"#9ca3af",fontSize:13,textAlign:"center",padding:"16px 0"}}>Sin objetivos definidos para esta semana.</p>
        )}
        {totalGoal>0&&(
          <div style={{borderTop:"1px solid #f0f3fb",paddingTop:14,marginTop:4}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:BRAND}}>Total</span>
              <span style={{fontSize:14,fontWeight:800,color:weekDone?"#059669":BRAND}}>{pct}% {weekDone?"🎉":""}</span>
            </div>
            <div style={{height:10,background:"#f0f3fb",borderRadius:5}}>
              <div style={{height:"100%",width:`${pct}%`,background:weekDone?"#059669":BRAND,borderRadius:5,transition:"width .5s"}}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
