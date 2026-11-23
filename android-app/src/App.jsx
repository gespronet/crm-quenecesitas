import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { supabase } from './supabase';
import {
  useStore, getState, loadProfile, sync, addTask, patchTask, toggleTask, removeTask,
  setSettings, clearAll,
} from './store';
import {
  initNotifications, rescheduleAll, onNotificationAction, computeAvisos,
  permissionStatus, exactAlarmStatus, requestExactAlarm, isNative,
} from './notify';
import { addDays, fmtDate, fmtTime, humanDay, todayStr } from './dates';

const PRIO = { alta: '🔴 Alta', media: '🟡 Normal', baja: '🔵 Baja' };

// ───────────────────────────── Login ─────────────────────────────
function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e) => {
    e.preventDefault();
    if (!email || !pass) return setErr('Escribe tu email y tu contraseña');
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    setBusy(false);
    if (error) setErr(error.message.includes('Invalid') ? 'Email o contraseña incorrectos' : error.message);
  };

  return (
    <form className="login" onSubmit={go}>
      <h1>queNECESITAS</h1>
      <p>Avisos y tareas del CRM. Entra con tu email corporativo.</p>
      {err && <div className="err">{err}</div>}
      <input className="input" type="email" placeholder="tu@quenecesitashoy.es" autoComplete="username"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Contraseña" autoComplete="current-password"
        value={pass} onChange={(e) => setPass(e.target.value)} />
      <button className="btn" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}

// ───────────────────────────── Filas ─────────────────────────────
function TaskRow({ t, contact, onOpen }) {
  const late = !t.completada && t.fecha && t.fecha < todayStr();
  const list = Array.isArray(t.checklist) ? t.checklist : [];
  return (
    <div className={`card row ${t.completada ? 'done' : ''}`}>
      <button className={`check p-${t.prioridad} ${t.completada ? 'on' : ''}`}
        aria-label="Marcar como hecha" onClick={() => toggleTask(t.id)}>{t.completada ? '✓' : ''}</button>
      <div className="body" onClick={() => onOpen(t)}>
        <div className="t">{t.titulo || '(sin título)'}</div>
        <div className="meta">
          {t.fecha && <span className={late ? 'late' : ''}>📅 {humanDay(t.fecha)}{late ? ' ⚠️' : ''}</span>}
          {t.hora && <span>🕒 {t.hora.slice(0, 5)}</span>}
          {contact && <span>👤 {contact.name}</span>}
          {list.length > 0 && <span>☑ {list.filter((i) => i.done).length}/{list.length}</span>}
        </div>
      </div>
    </div>
  );
}

const byWhen = (a, b) => (a.fecha || '9').localeCompare(b.fecha || '9') || (a.hora || '').localeCompare(b.hora || '');

// ───────────────────────────── Editor de tarea ─────────────────────────────
function TaskSheet({ draft, contacts, onClose }) {
  const [f, setF] = useState({
    titulo: '', fecha: todayStr(), prioridad: 'media', contact_id: null, ...draft,
    hora: draft.hora ? draft.hora.slice(0, 5) : '',
  });
  const [q, setQ] = useState('');
  const contact = contacts.find((c) => c.id === f.contact_id);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return contacts.filter((c) =>
      (c.name || '').toLowerCase().includes(s) || (c.empresa || '').toLowerCase().includes(s) || (c.phone || '').includes(s)
    ).slice(0, 6);
  }, [q, contacts]);

  const save = () => {
    if (!f.titulo.trim()) return;
    const row = { titulo: f.titulo.trim(), fecha: f.fecha || null, hora: f.hora || null, prioridad: f.prioridad, contact_id: f.contact_id || null };
    if (f.id) patchTask(f.id, row); else addTask(row);
    onClose();
  };
  const del = () => {
    if (window.confirm('¿Eliminar esta tarea?')) { removeTask(f.id); onClose(); }
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{f.id ? 'Editar tarea' : 'Nueva tarea o aviso'}</h3>
        <label className="label">Qué hay que hacer</label>
        <input className="input" autoFocus={!f.id} placeholder="Llamar, enviar oferta, revisar contrato…"
          value={f.titulo} onChange={(e) => set('titulo', e.target.value)} />

        <label className="label">Fecha y hora del aviso</label>
        <div className="btns">
          <input className="input" type="date" value={f.fecha || ''} onChange={(e) => set('fecha', e.target.value)} />
          <input className="input" type="time" value={f.hora} onChange={(e) => set('hora', e.target.value)} />
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          <button className="chip" onClick={() => set('fecha', todayStr())}>Hoy</button>
          <button className="chip" onClick={() => set('fecha', addDays(todayStr(), 1))}>Mañana</button>
          <button className="chip" onClick={() => set('fecha', addDays(todayStr(), 7))}>En 1 semana</button>
          <button className="chip" onClick={() => set('hora', '')}>Sin hora</button>
        </div>

        <label className="label">Prioridad</label>
        <div className="chips">
          {Object.entries(PRIO).map(([k, l]) => (
            <button key={k} className={`chip ${f.prioridad === k ? 'on' : ''}`} onClick={() => set('prioridad', k)}>{l}</button>
          ))}
        </div>

        <label className="label">Contacto</label>
        {contact ? (
          <div className="card row" style={{ alignItems: 'center' }}>
            <div className="body"><div className="t">{contact.name}</div><div className="meta">{contact.phone}</div></div>
            <button className="btn ghost sm" onClick={() => set('contact_id', null)}>Quitar</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="Buscar por nombre, empresa o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
            {matches.length > 0 && (
              <div className="suggest">
                {matches.map((c) => (
                  <button key={c.id} onClick={() => { set('contact_id', c.id); setQ(''); }}>
                    <b>{c.name}</b> <span className="meta">{c.empresa || c.phone || ''}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="btns" style={{ marginTop: 20 }}>
          {f.id && <button className="btn danger" onClick={del}>Eliminar</button>}
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Contacto ─────────────────────────────
const waNumber = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 9 ? `34${d}` : d;
};

function ContactSheet({ c, tasks, onNewTask, onOpenTask, onClose }) {
  const mine = tasks.filter((t) => t.contact_id === c.id && !t.completada).sort(byWhen);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{c.name}</h3>
        <div className="meta" style={{ marginBottom: 12 }}>
          {c.tipo && <span className={`tag ${c.tipo === 'cliente' ? 'cliente' : ''}`}>{c.tipo}</span>}
          {c.empresa && <span>🏢 {c.empresa}</span>}
        </div>
        <div className="btns">
          {c.phone && <a className="btn" style={{ textAlign: 'center', lineHeight: '48px', textDecoration: 'none' }} href={`tel:${c.phone}`}>📞 Llamar</a>}
          {c.phone && <a className="btn ghost" style={{ textAlign: 'center', lineHeight: '46px', textDecoration: 'none' }} href={`https://wa.me/${waNumber(c.phone)}`}>💬 WhatsApp</a>}
          {c.email && <a className="btn ghost" style={{ textAlign: 'center', lineHeight: '46px', textDecoration: 'none' }} href={`mailto:${c.email}`}>✉️ Email</a>}
        </div>
        {c.phone && <p className="meta">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>}
        <button className="btn full" style={{ marginTop: 12, background: 'var(--accent)', color: 'var(--ink)' }} onClick={() => onNewTask(c)}>
          ＋ Crear aviso para este contacto
        </button>
        <div className="h2">Tareas pendientes ({mine.length})</div>
        {mine.map((t) => <TaskRow key={t.id} t={t} contact={null} onOpen={onOpenTask} />)}
        {!mine.length && <div className="empty">Sin tareas pendientes con este contacto</div>}
      </div>
    </div>
  );
}

// ───────────────────────────── Pantallas ─────────────────────────────
function Hoy({ tasks, cmap, onOpen }) {
  const t0 = todayStr();
  const pend = tasks.filter((t) => !t.completada && t.fecha && t.fecha <= t0);
  const vencidas = pend.filter((t) => t.fecha < t0).sort(byWhen);
  const hoy = pend.filter((t) => t.fecha === t0).sort(byWhen);
  const hechas = tasks.filter((t) => t.completada && t.fecha === t0);
  return (
    <>
      {vencidas.length > 0 && <div className="h2 red">⚠️ Vencidas ({vencidas.length})</div>}
      {vencidas.map((t) => <TaskRow key={t.id} t={t} contact={cmap.get(t.contact_id)} onOpen={onOpen} />)}
      <div className="h2">📅 Hoy ({hoy.length})</div>
      {hoy.map((t) => <TaskRow key={t.id} t={t} contact={cmap.get(t.contact_id)} onOpen={onOpen} />)}
      {!hoy.length && !vencidas.length && <div className="empty">Nada pendiente para hoy 🎉</div>}
      {hechas.length > 0 && <div className="h2">✅ Hechas hoy ({hechas.length})</div>}
      {hechas.map((t) => <TaskRow key={t.id} t={t} contact={cmap.get(t.contact_id)} onOpen={onOpen} />)}
    </>
  );
}

function Tareas({ tasks, cmap, onOpen }) {
  const [filtro, setFiltro] = useState('pendientes');
  const [q, setQ] = useState('');
  const list = tasks
    .filter((t) => (filtro === 'pendientes' ? !t.completada : filtro === 'hechas' ? t.completada : true))
    .filter((t) => !q.trim() || (t.titulo || '').toLowerCase().includes(q.trim().toLowerCase())
      || (cmap.get(t.contact_id)?.name || '').toLowerCase().includes(q.trim().toLowerCase()))
    .sort(filtro === 'hechas' ? (a, b) => byWhen(b, a) : byWhen);
  return (
    <>
      <input className="input search" placeholder="Buscar tarea o contacto" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {[['pendientes', '⏳ Pendientes'], ['hechas', '✅ Hechas'], ['todas', '📋 Todas']].map(([k, l]) => (
          <button key={k} className={`chip ${filtro === k ? 'on' : ''}`} onClick={() => setFiltro(k)}>{l}</button>
        ))}
      </div>
      {list.slice(0, 200).map((t) => <TaskRow key={t.id} t={t} contact={cmap.get(t.contact_id)} onOpen={onOpen} />)}
      {!list.length && <div className="empty">No hay tareas en esta vista</div>}
    </>
  );
}

function Avisos({ tasks, contacts, settings, onOpen }) {
  const [perm, setPerm] = useState('granted');
  const [exact, setExact] = useState('granted');
  useEffect(() => { permissionStatus().then(setPerm); exactAlarmStatus().then(setExact); }, []);
  const avisos = useMemo(() => computeAvisos(tasks, contacts, settings), [tasks, contacts, settings]);

  const groups = [];
  avisos.forEach((a) => {
    const d = fmtDate(a.at);
    const g = groups.find((x) => x.d === d);
    g ? g.items.push(a) : groups.push({ d, items: [a] });
  });

  const snooze = (t, mode) => {
    if (mode === 'hora') {
      const d = new Date(Date.now() + 3600000);
      patchTask(t.id, { fecha: fmtDate(d), hora: fmtTime(d) });
    } else {
      patchTask(t.id, { fecha: addDays(t.fecha, 1) });
    }
  };

  return (
    <>
      {isNative && perm !== 'granted' && (
        <div className="warn">Los avisos están bloqueados. Actívalos en Ajustes del móvil → Aplicaciones → queNECESITAS Avisos → Notificaciones.</div>
      )}
      {isNative && perm === 'granted' && exact !== 'granted' && (
        <div className="warn">
          Para que el aviso suene a la hora exacta, permite las alarmas exactas.{' '}
          <button className="btn sm" onClick={() => requestExactAlarm().then(() => setTimeout(() => exactAlarmStatus().then(setExact), 1500))}>Permitir</button>
        </div>
      )}
      {!isNative && <div className="warn">Los avisos con sonido solo funcionan en la app Android instalada.</div>}
      {groups.map((g) => (
        <div key={g.d}>
          <div className="h2">{humanDay(g.d)}</div>
          {g.items.map(({ task, contact, at }) => (
            <div key={task.id} className="card">
              <div className="row">
                <div className="body" onClick={() => onOpen(task)}>
                  <div className="t">🔔 {fmtTime(at)} · {task.titulo}</div>
                  <div className="meta">{contact && <span>👤 {contact.name}</span>}</div>
                </div>
              </div>
              <div className="btns" style={{ marginTop: 10 }}>
                <button className="btn sm ghost" onClick={() => toggleTask(task.id)}>✓ Hecha</button>
                <button className="btn sm ghost" onClick={() => snooze(task, 'hora')}>+1 h</button>
                <button className="btn sm ghost" onClick={() => snooze(task, 'dia')}>Mañana</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {!groups.length && <div className="empty">No hay avisos programados.<br />Crea una tarea con fecha y hora con el botón ＋</div>}
    </>
  );
}

function Contactos({ contacts, onOpen }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const l = !s ? contacts : contacts.filter((c) =>
      (c.name || '').toLowerCase().includes(s) || (c.empresa || '').toLowerCase().includes(s)
      || (c.phone || '').includes(s) || (c.email || '').toLowerCase().includes(s));
    return l.slice(0, 100);
  }, [q, contacts]);
  return (
    <>
      <input className="input search" placeholder={`Buscar entre ${contacts.length} contactos`} value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((c) => (
        <div key={c.id} className="card" onClick={() => onOpen(c)}>
          <div className="t" style={{ fontWeight: 700 }}>{c.name}</div>
          <div className="meta">
            {c.tipo && <span className={`tag ${c.tipo === 'cliente' ? 'cliente' : ''}`}>{c.tipo}</span>}
            {c.phone && <span>📞 {c.phone}</span>}
            {c.empresa && <span>🏢 {c.empresa}</span>}
          </div>
        </div>
      ))}
      {!list.length && <div className="empty">Sin resultados</div>}
    </>
  );
}

function Ajustes({ s, onLogout }) {
  const { settings, profile, queue, lastSync, lastError, online } = s;
  return (
    <>
      <div className="card">
        <b>{profile?.name}</b>
        <div className="meta">{profile?.email}</div>
        <div className="meta">
          {online ? 'Conectado' : 'Sin conexión'} · {queue.length ? `${queue.length} cambios por enviar` : 'Todo sincronizado'}
          {lastSync && ` · ${new Date(lastSync).toLocaleString('es-ES')}`}
        </div>
        {lastError && <div className="err" style={{ marginTop: 8 }}>{lastError}</div>}
        <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => sync()}>Sincronizar ahora</button>
      </div>
      <div className="card">
        <div className="setting">Avisar con antelación
          <select className="select" value={settings.leadMinutes} onChange={(e) => setSettings({ leadMinutes: Number(e.target.value) })}>
            <option value={0}>A la hora</option><option value={5}>5 min antes</option><option value={15}>15 min antes</option>
            <option value={30}>30 min antes</option><option value={60}>1 hora antes</option>
          </select>
        </div>
        <div className="setting">Hora si la tarea no tiene
          <input className="select" type="time" value={settings.defaultTime} onChange={(e) => e.target.value && setSettings({ defaultTime: e.target.value })} />
        </div>
        <div className="setting">Resumen diario a las 08:30
          <input type="checkbox" checked={settings.dailySummary} onChange={(e) => setSettings({ dailySummary: e.target.checked })} />
        </div>
        <div className="setting">Ver tareas de todo el equipo
          <input type="checkbox" checked={settings.showTeam} onChange={(e) => { setSettings({ showTeam: e.target.checked }); setTimeout(sync, 0); }} />
        </div>
      </div>
      <button className="btn danger full" onClick={onLogout}>Cerrar sesión</button>
    </>
  );
}

// ───────────────────────────── App ─────────────────────────────
export default function App() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState('hoy');
  const [editing, setEditing] = useState(null);   // borrador/tarea abierta
  const [contact, setContact] = useState(null);
  const s = useStore();
  const ready = useRef(false);

  // Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Perfil + primera sincronización + permisos
  useEffect(() => {
    if (!session) return;
    (async () => {
      const p = await loadProfile(session);
      if (!p) { alert('Tu cuenta no tiene acceso al CRM.'); await supabase.auth.signOut(); return; }
      await initNotifications();
      ready.current = true;
      sync();
    })();
  }, [session]);

  // Sincronizar al volver a primer plano, al recuperar red y cada 5 min
  useEffect(() => {
    const go = () => ready.current && sync();
    const subs = [];
    CapApp.addListener('appStateChange', ({ isActive }) => isActive && go()).then((h) => subs.push(h));
    Network.addListener('networkStatusChange', ({ connected }) => connected && go()).then((h) => subs.push(h));
    const iv = setInterval(go, 5 * 60 * 1000);
    window.addEventListener('online', go);
    return () => { subs.forEach((h) => h.remove()); clearInterval(iv); window.removeEventListener('online', go); };
  }, []);

  // Reprogramar avisos cada vez que cambian tareas, contactos o ajustes
  const { tasks, contacts, settings } = s;
  useEffect(() => {
    if (!s.profile) return;
    rescheduleAll(tasks, contacts, settings).catch((e) => console.warn('[avisos]', e));
  }, [tasks, contacts, settings.leadMinutes, settings.defaultTime, settings.dailySummary, s.profile]); // eslint-disable-line

  // Acciones desde la notificación (Hecha / +1 hora / abrir)
  useEffect(() => onNotificationAction(({ actionId, taskId }) => {
    const t = getState().tasks.find((x) => x.id === taskId);
    if (!t) return;
    if (actionId === 'done') toggleTask(t.id);
    else if (actionId === 'snooze') {
      const d = new Date(Date.now() + 3600000);
      patchTask(t.id, { fecha: fmtDate(d), hora: fmtTime(d) });
    } else { setTab('hoy'); setEditing(t); }
  }), []);

  const cmap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const vencidas = tasks.filter((t) => !t.completada && t.fecha && t.fecha < todayStr()).length;

  if (session === undefined) return <div className="empty">Cargando…</div>;
  if (!session) return <Login />;

  const logout = async () => { await supabase.auth.signOut(); clearAll(); };
  const newTaskFor = (c) => { setContact(null); setEditing({ contact_id: c.id, titulo: `Llamar a ${c.name}` }); };

  const TABS = [['hoy', '📅', 'Hoy'], ['tareas', '✅', 'Tareas'], ['avisos', '🔔', 'Avisos'], ['contactos', '👥', 'Contactos'], ['ajustes', '⚙️', 'Ajustes']];
  const TITLES = { hoy: 'Hoy', tareas: 'Tareas', avisos: 'Avisos', contactos: 'Contactos', ajustes: 'Ajustes' };

  return (
    <div className="app">
      <div className="topbar">
        <h1>{TITLES[tab]}</h1>
        <small>
          <span className={`sync-dot ${s.syncing ? 'busy' : !s.online || s.queue.length ? 'off' : ''}`} />
          {s.syncing ? 'Sincronizando' : !s.online ? 'Sin conexión' : s.queue.length ? `${s.queue.length} pendientes` : 'Al día'}
        </small>
      </div>

      <div className="content">
        {tab === 'hoy' && <Hoy tasks={tasks} cmap={cmap} onOpen={setEditing} />}
        {tab === 'tareas' && <Tareas tasks={tasks} cmap={cmap} onOpen={setEditing} />}
        {tab === 'avisos' && <Avisos tasks={tasks} contacts={contacts} settings={settings} onOpen={setEditing} />}
        {tab === 'contactos' && <Contactos contacts={contacts} onOpen={setContact} />}
        {tab === 'ajustes' && <Ajustes s={s} onLogout={logout} />}
      </div>

      {tab !== 'ajustes' && tab !== 'contactos' && (
        <button className="fab" aria-label="Nueva tarea" onClick={() => setEditing({})}>＋</button>
      )}

      <nav className="tabbar">
        {TABS.map(([k, i, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            <span className="i">{i}</span>{k === 'hoy' && vencidas > 0 && <span className="badge">{vencidas}</span>}{l}
          </button>
        ))}
      </nav>

      {editing && <TaskSheet draft={editing} contacts={contacts} onClose={() => setEditing(null)} />}
      {contact && (
        <ContactSheet c={contact} tasks={tasks} onNewTask={newTaskFor}
          onOpenTask={(t) => { setContact(null); setEditing(t); }} onClose={() => setContact(null)} />
      )}
    </div>
  );
}
