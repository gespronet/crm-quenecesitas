# queNECESITAS Avisos (Android)

App Android (Capacitor + React) para gestionar **tareas y avisos** del CRM de queNECESITAS.
Usa el mismo Supabase y las mismas tablas (`tasks`, `contacts`, `users`, `weekly_plans`) que el CRM web,
así que lo que crees aquí aparece en el CRM y al revés. **No requiere cambios en la base de datos.**

## Qué hace

- Login con el mismo email/contraseña del CRM.
- **Hoy** (vencidas + hoy), **Tareas** (pendientes/hechas, búsqueda), **Avisos** (próximos avisos con ✓ / +1 h / mañana).
- Avisos como **notificaciones locales** (suenan aunque no haya cobertura): a la hora de la tarea
  (o 09:00 si no tiene hora), con antelación configurable y resumen diario 08:30.
  Desde la notificación: **Hecha** o **+1 hora**.
- **Contactos**: búsqueda, llamar, WhatsApp, email y crear aviso ligado al contacto.
- **Offline**: caché local y cola de cambios que se envía a Supabase al recuperar conexión
  (al abrir la app, al volver a primer plano, al recuperar red y cada 5 min).
  Conflictos: gana el último cambio.

## Desarrollo

```bash
cd android-app
npm install
npm run dev          # vista previa en el navegador (sin notificaciones)
npm run android      # build + sync + abre Android Studio
```

Requisitos para compilar en local: Node 22, JDK 21 y Android Studio (SDK 36).

## APK sin Android Studio

El workflow `.github/workflows/android-apk.yml` compila un **APK debug** en GitHub Actions
(pestaña *Actions* → *Android APK* → *Run workflow*). Descarga el artefacto `quenecesitas-avisos-debug-apk`,
pásalo al móvil e instálalo (permitir “instalar apps desconocidas”).

Para publicar en Play Store hará falta firmar un `release` (keystore propio, guardado en *secrets*, nunca en el repo).

## Notas Android

- Android 13+: la app pide permiso de notificaciones al entrar.
- Android 12+: para que el aviso suene a la hora exacta, en la pestaña **Avisos** pulsa *Permitir*
  (alarmas exactas). Sin ello Android puede retrasarlo unos minutos.
- Algunos fabricantes (Xiaomi, Huawei, Samsung…) matan apps en segundo plano: desactiva el ahorro de batería para esta app.
- Se programan los 60 avisos más próximos; se recalculan en cada cambio y cada vez que se abre la app.
