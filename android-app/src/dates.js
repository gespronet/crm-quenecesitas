const pad = (n) => String(n).padStart(2, '0');

export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayStr = () => fmtDate(new Date());

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

/** Fecha/hora local de una tarea. Sin hora usa `defaultTime` (HH:MM). */
export function taskDate(t, defaultTime = '09:00') {
  if (!t.fecha) return null;
  const hhmm = (t.hora || defaultTime).slice(0, 5);
  return new Date(`${t.fecha}T${hhmm}:00`);
}

export function plusMinutes(fecha, hora, minutes, defaultTime = '09:00') {
  const d = new Date(`${fecha}T${(hora || defaultTime).slice(0, 5)}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  return { fecha: fmtDate(d), hora: fmtTime(d) };
}

export function humanDay(dateStr) {
  const t = todayStr();
  if (dateStr === t) return 'Hoy';
  if (dateStr === addDays(t, 1)) return 'Mañana';
  if (dateStr === addDays(t, -1)) return 'Ayer';
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
