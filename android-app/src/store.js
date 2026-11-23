import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/**
 * Almacén offline-first.
 * - Todo se lee de una caché local (localStorage) y se escribe primero allí.
 * - Los cambios se encolan (`queue`) y se envían a Supabase cuando hay conexión.
 * - Las filas se guardan tal cual vienen de Supabase (snake_case).
 */
const KEY = 'qn_avisos_cache_v1';
const DEFAULT_SETTINGS = {
  leadMinutes: 0,          // antelación del aviso
  defaultTime: '09:00',    // hora del aviso si la tarea no tiene hora
  dailySummary: true,      // resumen diario a las 08:30
  showTeam: false,         // ver tareas de todo el equipo
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) return { ...EMPTY(), ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
  } catch { /* caché corrupta: se ignora */ }
  return EMPTY();
}
const EMPTY = () => ({
  profile: null, tasks: [], contacts: [], queue: [],
  settings: { ...DEFAULT_SETTINGS }, lastSync: null, syncing: false, lastError: null, online: true,
});

let state = load();
const listeners = new Set();

function commit(patch) {
  state = { ...state, ...patch };
  try {
    const { syncing, ...persist } = state; // eslint-disable-line no-unused-vars
    localStorage.setItem(KEY, JSON.stringify(persist));
  } catch { /* cuota llena: seguimos en memoria */ }
  listeners.forEach((l) => l());
}

export const getState = () => state;
export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useStore = () => useSyncExternalStore(subscribe, getState);

const uuid = () => crypto.randomUUID();

// ── Ajustes ────────────────────────────────────────────────────────────────
export const setSettings = (patch) => commit({ settings: { ...state.settings, ...patch } });

// ── Cola de cambios ────────────────────────────────────────────────────────
function enqueue(item) {
  let queue = [...state.queue];
  const pendingInsert = queue.find((q) => q.id === item.id && q.t === 'insert');

  if (item.t === 'update') {
    if (pendingInsert) { // la fila aún no existe en servidor: fusionar en el insert
      pendingInsert.row = { ...pendingInsert.row, ...item.patch };
    } else {
      const prev = queue.find((q) => q.id === item.id && q.t === 'update');
      if (prev) prev.patch = { ...prev.patch, ...item.patch };
      else queue.push(item);
    }
  } else if (item.t === 'delete') {
    queue = queue.filter((q) => q.id !== item.id);
    if (!pendingInsert) queue.push(item);
  } else {
    queue.push(item);
  }
  commit({ queue });
  sync();
}

// ── Tareas ─────────────────────────────────────────────────────────────────
export function addTask(fields) {
  const row = {
    id: uuid(),
    titulo: '',
    fecha: null,
    hora: null,
    prioridad: 'media',
    contact_id: null,
    completada: false,
    comercial_id: state.profile?.id ?? null,
    ...fields,
  };
  commit({ tasks: [...state.tasks, row] });
  enqueue({ t: 'insert', id: row.id, row });
  return row;
}

export function patchTask(id, patch) {
  commit({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  enqueue({ t: 'update', id, patch });
}

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (t) patchTask(id, { completada: !t.completada });
}

export function removeTask(id) {
  commit({ tasks: state.tasks.filter((t) => t.id !== id) });
  enqueue({ t: 'delete', id });
}

// ── Sincronización ─────────────────────────────────────────────────────────
const isNetworkError = (e) =>
  !e || e.status === 0 || /fetch|network|failed to|timeout/i.test(String(e.message || e));

async function runItem(q) {
  if (q.t === 'insert') {
    const { error } = await supabase.from('tasks').insert(q.row);
    return error;
  }
  if (q.t === 'update') {
    const { error } = await supabase.from('tasks').update(q.patch).eq('id', q.id);
    if (!error && 'completada' in q.patch) {
      // Igual que el CRM web: mantener "Mi Semana" sincronizada (0 filas si no existe)
      await supabase.from('weekly_plans').update({ completado: q.patch.completada }).eq('id', q.id);
    }
    return error;
  }
  if (q.t === 'delete') {
    const { error } = await supabase.from('tasks').delete().eq('id', q.id);
    if (!error) await supabase.from('weekly_plans').delete().eq('id', q.id);
    return error;
  }
  return null;
}

async function fetchAll(table, build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(supabase.from(table).select('*').range(from, from + 999));
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

let flushing = false;
export async function sync() {
  if (flushing || !state.profile) return;
  flushing = true;
  commit({ syncing: true });
  try {
    // 1) Enviar cola en orden
    while (state.queue.length) {
      const q = state.queue[0];
      const err = await runItem(q);
      if (err && isNetworkError(err)) throw err;           // sin red: reintentar luego
      commit({
        queue: state.queue.slice(1),
        lastError: err ? `No se pudo guardar un cambio: ${err.message}` : state.lastError,
      });
    }
    // 2) Descargar datos frescos (solo si no hay cambios pendientes)
    const tasks = await fetchAll('tasks', (qb) =>
      state.settings.showTeam ? qb : qb.eq('comercial_id', state.profile.id));
    const contacts = await fetchAll('contacts', (qb) => qb.order('name'));
    if (state.queue.length === 0) {
      commit({ tasks, contacts, lastSync: new Date().toISOString(), online: true, lastError: null });
    }
  } catch (e) {
    commit({ online: !isNetworkError(e), lastError: isNetworkError(e) ? null : String(e.message || e) });
  } finally {
    flushing = false;
    commit({ syncing: false });
  }
}

// ── Sesión ─────────────────────────────────────────────────────────────────
export async function loadProfile(session) {
  if (!session) { commit({ profile: null }); return null; }
  const { data, error } = await supabase
    .from('users').select('id,name,email,role').eq('auth_id', session.user.id).maybeSingle();
  if (error && isNetworkError(error) && state.profile) return state.profile; // offline: usar caché
  if (!data) return null;
  commit({ profile: data });
  return data;
}

export function clearAll() {
  localStorage.removeItem(KEY);
  state = EMPTY();
  listeners.forEach((l) => l());
}
