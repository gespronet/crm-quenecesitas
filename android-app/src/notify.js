import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { addDays, fmtDate, taskDate, todayStr } from './dates';

export const isNative = Capacitor.isNativePlatform();
const CHANNEL = 'avisos';
const MAX_SCHEDULED = 60;

// id numérico estable (Android exige int32) a partir del UUID de la tarea
function hashId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 1_000_000_000;
}

export async function initNotifications() {
  if (!isNative) return 'web';
  await LocalNotifications.createChannel({
    id: CHANNEL, name: 'Avisos y tareas', importance: 4, visibility: 1, vibration: true,
  });
  await LocalNotifications.registerActionTypes({
    types: [{
      id: 'AVISO',
      actions: [{ id: 'done', title: 'Hecha' }, { id: 'snooze', title: '+1 hora' }],
    }],
  });
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
  return p.display;
}

export async function permissionStatus() {
  if (!isNative) return 'web';
  return (await LocalNotifications.checkPermissions()).display;
}

/** Android 12+: permiso de alarmas exactas para que el aviso suene a la hora justa. */
export async function exactAlarmStatus() {
  if (!isNative) return 'granted';
  try { return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm; }
  catch { return 'granted'; }
}
export async function requestExactAlarm() {
  if (isNative) await LocalNotifications.changeExactNotificationSetting();
}

export function onNotificationAction(handler) {
  if (!isNative) return () => {};
  const p = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    handler({ actionId: e.actionId, taskId: e.notification?.extra?.taskId });
  });
  return () => { p.then((h) => h.remove()); };
}

/** Calcula los avisos futuros a partir de las tareas pendientes. */
export function computeAvisos(tasks, contacts, settings) {
  const now = Date.now();
  const byId = new Map(contacts.map((c) => [c.id, c]));
  return tasks
    .filter((t) => !t.completada && t.fecha)
    .map((t) => {
      const when = taskDate(t, settings.defaultTime);
      const at = new Date(when.getTime() - settings.leadMinutes * 60000);
      return { task: t, when, at, contact: byId.get(t.contact_id) };
    })
    .filter((a) => a.at.getTime() > now)
    .sort((a, b) => a.at - b.at);
}

/** Reprograma TODAS las notificaciones locales (cancela las anteriores). */
export async function rescheduleAll(tasks, contacts, settings) {
  if (!isNative) return 0;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return 0;

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  const avisos = computeAvisos(tasks, contacts, settings).slice(0, MAX_SCHEDULED);
  const notifications = avisos.map(({ task, contact, when, at }) => ({
    id: hashId(task.id),
    title: task.titulo || 'Tarea',
    body: [
      task.hora ? `🕒 ${task.hora.slice(0, 5)}` : null,
      contact ? `👤 ${contact.name}` : null,
      settings.leadMinutes ? `en ${settings.leadMinutes} min` : null,
    ].filter(Boolean).join('  ·  ') || 'Tienes una tarea pendiente',
    schedule: { at, allowWhileIdle: true },
    channelId: CHANNEL,
    actionTypeId: 'AVISO',
    extra: { taskId: task.id, when: when.toISOString() },
  }));

  // Resumen diario (08:30) para los próximos 7 días con tareas
  if (settings.dailySummary) {
    for (let i = 0; i < 7; i++) {
      const day = addDays(todayStr(), i);
      const n = tasks.filter((t) => !t.completada && t.fecha && (i === 0 ? t.fecha <= day : t.fecha === day)).length;
      const at = new Date(`${day}T08:30:00`);
      if (n > 0 && at.getTime() > Date.now()) {
        notifications.push({
          id: 1_500_000_000 + i,
          title: 'Tu día en queNECESITAS',
          body: `${n} ${n === 1 ? 'tarea pendiente' : 'tareas pendientes'} para hoy`,
          schedule: { at, allowWhileIdle: true },
          channelId: CHANNEL,
          extra: { summary: fmtDate(at) },
        });
      }
    }
  }

  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return notifications.length;
}
