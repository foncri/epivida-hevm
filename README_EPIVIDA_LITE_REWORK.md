# EPIVIDA Lite Ultrafast Rework

Fecha de arranque: 2026-06-04  
Rama: `feature/epivida-lite-ultrafast-rework`  
App: EPIVIDA  
Repositorio base: `foncri/epivida-hevm`

## Objetivo

Reconstruir EPIVIDA como una app hospitalaria modular, sobria, segura y muy rapida. El nombre visible de la app se conserva como **EPIVIDA**. La version nueva no debe ser un conjunto de hotfixes sobre el monolito actual: debe separar rutas, datos, servicios, reglas, cache y exportadores.

## Correccion de rumbo: remake fiel, no app nueva

EPIVIDA Lite debe conservar la experiencia operativa que ya existia en EPIVIDA. La meta no es inventar una app distinta, sino rehacer la pagina anterior con carga modular, menos peso y Firestore como base organizada.

La ruta legacy `#/ronda/2026-06-04` se conserva como entrada compatible y ahora abre el modulo rapido de **Paquetes Preventivos**. Este flujo mantiene:

- Encabezado `Paquetes Preventivos`.
- Ronda movil por cama.
- Filtros por servicio.
- Mapa de camas preventivas con estados disponible, vacia, vista y pendiente.
- Selector "Ir a cama preventiva".
- Resumen de paquetes CVC, cateter urinario, ventilacion mecanica e ISQ.
- Tarjetas por cama con estado, sincronizacion, invasivos y paquetes detectados.
- Vista por paciente/cama con invasivos activos, alta de paquete preventivo, criterios SI/NO/NA, porcentaje de cumplimiento, pendientes, observaciones y navegacion anterior/siguiente cama.
- Guardado en `nursing_rounds`, dispositivos en `devices_active`, sesiones en `round_sessions`, auditoria y cola offline.

Los pacientes reales pueden limpiarse o migrarse despues; lo que no debe perderse es la tecnologia clinico-operativa de camas, paquetes preventivos, dispositivos y ronda.

Prioridades:

1. Velocidad.
2. Estabilidad.
3. Seguridad.
4. Datos confiables.
5. Mantenibilidad.
6. Exportacion bajo demanda.
7. Diseno visual minimo.

## Fase 0: diagnostico del sistema actual

### Arquitectura actual

- App estatica vanilla JavaScript.
- No existe `package.json`.
- Hosting actual: GitHub Pages.
- Router actual: hash router (`#/dashboard`, `#/monitoreo-epidemiologico`, `#/censo-hospitalario`, `#/ronda`, `#/seguimiento-iaas`, `#/reporte-diario`, `#/importar-censo`).
- Render principal: `renderIaas()` global dentro de `iaas-system.js`.
- Modulos actuales mezclados en un solo runtime: dashboard, monitoreo, censo, importacion, ronda, seguimiento IAAS, expediente, reportes, Sheets, Firestore fallback, exportaciones y offline.
- El auth gate ya reduce la carga previa a login, pero despues de autenticacion sigue cargando un paquete clinico global.

### Inventario de archivos

- 42 archivos `.js`.
- 10 archivos `.css`.
- 97 archivos `.webp`.
- 42 archivos `.svg`.
- Assets totales: aproximadamente 4.40 MB.
- WebP: aproximadamente 4.37 MB.

Archivos dominantes:

- `iaas-system-runtime-2026-06-04.js`: 552.0 KB, 11,356 lineas.
- `iaas-system.js`: 534.5 KB, 11,138 lineas.
- `iaas-system.css`: 197.1 KB, 7,804 lineas.
- Fondos/imagenes decorativas WebP: varios entre 70 KB y 166 KB.

### Carga actual

`index.html` carga inicialmente:

- `epivida-auth-gate.css`
- configuracion global Firebase/Sheets
- `epivida-auth-gate.js`

`epivida-auth-gate.js` mantiene carga global post-auth:

- `FULL_STYLES`: 9 hojas CSS.
- `FULL_SCRIPTS`: 26 scripts clinicos.

`epivida-service-worker.js` mantiene:

- `APP_SHELL`: 42 entradas.

Esto mejora el login, pero no cumple la meta de EPIVIDA Lite: despues de login debe cargarse solo el modulo solicitado.

### Medicion actual en produccion

URL auditada:

`https://foncri.github.io/epivida-hevm/index.html#/monitoreo-epidemiologico`

Pantalla publica no autenticada:

- Desktop FCP: 644 ms.
- Mobile FCP: 636 ms.
- Sin errores de consola.
- Sin respuestas 400/500.

Carga completa forzada de la app clinica:

- 26 scripts clinicos.
- 10 hojas CSS.
- Transfer diferida observada: aproximadamente 1.09 MB.
- Runtime dominante: `iaas-system-runtime-2026-06-04.js` con 553.9 KB transferidos.
- CSS dominante: `iaas-system.css` con 193.1 KB transferidos.
- Se solicita el runtime estatico, no `iaas-system.js` ni `iaas-system-cedulas-loader`.

### Datos y persistencia actuales

Estado local principal:

- `localStorage`: `epivida-iaas-os-v1`.
- `localStorage`: `epivida-iaas-drafts-v1`.
- `localStorage`: `epivida-sheets-session-v1`.
- IndexedDB: `epivida-offline-v1`.
- Offline mirror: store, drafts y sesion Sheets.

Modelo local actual:

- `patients`
- `dailyCensus`
- `dailyRounds`
- `deviceEpisodes`
- `auditLogs`
- `writeQueue`

Persistencia remota actual:

- Google Sheets aparece como base primaria operativa en `README.md`.
- Firestore existe como fallback tecnico.
- La app puede hidratar Firestore desde `dailyCensus/{date}`, `dailyRounds/{date}` y subcolecciones.
- La capa de datos esta mezclada en el runtime UI, no separada por servicios.

### Google Sheets actual

Configuracion visible en frontend:

- `EPIVIDA_SHEETS_CONFIG.spreadsheetId`.
- `EPIVIDA_SHEETS_CONFIG.spreadsheetUrl`.
- `EPIVIDA_SHEETS_CONFIG.googleClientId`.

Pestanas canonicas actuales:

- `BASE_DATOS`
- `RONDAS_IAAS`
- `DISPOSITIVOS`
- `AUDITORIA`
- `CATALOGOS`
- `APP_CONFIG`

EPIVIDA Lite debe mover Sheets a exportacion/importacion bajo demanda. Sheets no debe ser fuente principal ni cargar en rutas operativas.

### Firebase y Firestore actuales

Firebase Auth esta configurado en frontend. Firestore rules existen y no estan abiertas con `allow read, write: if true`.

Reglas actuales:

- Nadie no autenticado accede.
- Bootstrap admin por dos correos hardcodeados.
- Roles: `admin`, `epidemiologia`, `enfermeria`, `lectura`.
- Borrados fisicos bloqueados.
- Audit logs append-only desde cliente.

Limitaciones para EPIVIDA Lite:

- Roles y bootstrap por email deben evolucionar a `users/{uid}` robusto o custom claims.
- Colecciones actuales no coinciden con el modelo objetivo.
- Reglas no cubren todavia `patients_active`, `patients_archive`, `devices_active`, `iaas_active`, `daily_snapshots`, `catalogs`, `sync_queue`, `exports_log`.
- La UI actual llama Firestore desde el runtime monolitico.

### Riesgos tecnicos principales

1. Monolito JS: `iaas-system.js` concentra UI, router, datos, importacion, exportacion, Firestore, Sheets y offline.
2. CSS monolitico: `iaas-system.css` pesa casi 200 KB y contiene estilos de muchas rutas.
3. Hotfix sprawl: hay multiples archivos con fecha que corrigen comportamiento global.
4. Global observers/listeners: varios hotfixes usan `MutationObserver`, `hashchange`, `setTimeout`, `setInterval` y listeners globales.
5. Router global: cambiar de hash llama render global, no import dinamico de modulo.
6. Service worker: `APP_SHELL` todavia precachea demasiado para el objetivo Lite.
7. Datos: localStorage/IndexedDB funcionan como soporte operativo importante, pero no deben ser la fuente de verdad.
8. Sheets: sigue como base primaria segun documentacion actual.
9. Seguridad: lista de correos y Google Sheet ID estan en frontend.
10. XSS legacy: algunos hotfixes usan `innerHTML` con datos que pueden venir de pacientes si no se escapan correctamente.

### Datos clinicos en repo

No se encontro censo real precargado. `data/censo-data.js` contiene:

- `rows: []`
- `problems: []`
- catalogos genericos.

Se debe mantener esta regla: no subir pacientes reales, RFC, diagnosticos reales, telefonos, direcciones ni snapshots clinicos al repositorio.

## Arquitectura objetivo

EPIVIDA sera una sola app con modulos internos separados.

Rutas objetivo:

- `#/login`
- `#/inicio`
- `#/censo`
- `#/monitoreo-epidemiologico`
- `#/ronda-paquetes`
- `#/epi-iaas`
- `#/dispositivos`
- `#/reportes`
- `#/admin`

Principio de carga:

- Shell minimo.
- Auth minimo.
- Router minimo.
- Import dinamico del modulo actual.
- Exportadores, graficas, importadores y reportes solo bajo demanda.

Ejemplo:

```js
const routes = {
  login: () => import("./modules/login/index.js"),
  inicio: () => import("./modules/inicio/index.js"),
  censo: () => import("./modules/censo/index.js"),
  "monitoreo-epidemiologico": () => import("./modules/monitoreo/index.js"),
  "ronda-paquetes": () => import("./modules/ronda-paquetes/index.js"),
  "epi-iaas": () => import("./modules/epi-iaas/index.js"),
  dispositivos: () => import("./modules/dispositivos/index.js"),
  reportes: () => import("./modules/reportes/index.js"),
  admin: () => import("./modules/admin/index.js")
};
```

## Estructura propuesta

```text
src/
  main.ts
  app.ts
  router.ts
  styles/
    base.css
    tables.css
    forms.css
  lib/
    firebase.ts
    firestore.ts
    auth.ts
    cache.ts
    date.ts
    validators.ts
    performance.ts
    security.ts
  services/
    authService.ts
    userService.ts
    patientService.ts
    censusService.ts
    roundService.ts
    deviceService.ts
    iaasService.ts
    snapshotService.ts
    auditService.ts
    catalogService.ts
    exportService.ts
  modules/
    login/
    inicio/
    censo/
    monitoreo/
    ronda-paquetes/
    epi-iaas/
    dispositivos/
    reportes/
    admin/
  components/
    table.ts
    modal.ts
    toast.ts
    loading.ts
    confirm.ts
    patientSearch.ts
  types/
    patient.ts
    device.ts
    iaas.ts
    user.ts
    audit.ts
  tools/
    exportLegacyLocalStorage.ts
    importLegacyToFirestore.ts
    validateFirestoreData.ts
firebase/
  firestore.rules
  firestore.indexes.json
public/
  manifest.webmanifest
  epivida-service-worker.js
  icons/
```

## Firestore objetivo

Colecciones principales:

- `users`
- `patients_active`
- `patients_archive`
- `census_days`
- `nursing_rounds`
- `devices_active`
- `devices_archive`
- `iaas_active`
- `iaas_archive`
- `daily_snapshots`
- `audit_logs`
- `catalogs`
- `sync_queue`
- `exports_log`

Reglas:

- Nadie no autenticado lee o escribe.
- Usuarios inactivos no acceden.
- `admin_epidemiologia`: todo.
- `epidemiologia`: censo, monitoreo, IAAS, dispositivos, reportes.
- `enfermeria`: ronda-paquetes, dispositivos relacionados y lectura limitada.
- `lectura`: lectura autorizada sin escritura.
- Audit logs append-only.
- No borrado fisico; usar archivado.

## Variables de entorno objetivo

Para Vite/Cloudflare Pages:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

No colocar en frontend:

- Service account JSON.
- Tokens privados.
- Credenciales admin.
- `client_secret`.
- Datos clinicos reales.

## Cloudflare Pages

Hosting principal objetivo: Cloudflare Pages.

Configuracion recomendada:

- Build command: `npm run build`.
- Output directory: `dist`.
- Rutas hash inicialmente para evitar redirects complejos.

Archivo `_headers` propuesto:

```text
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: public, max-age=86400
```

Si se migra a history routing, agregar `_redirects`:

```text
/* /index.html 200
```

## Plan por fases

### Fase 1: base nueva minima

Estado: iniciada en `lite/`.

Implementado:

- App ES modules estatica sin build obligatorio.
- `lite/index.html` minimo.
- Router hash con `import()` por ruta.
- CSS base unico blanco/gris/negro.
- Firebase Auth modular por CDN.
- Servicios separados para usuarios, pacientes, censo, rondas, dispositivos, IAAS, snapshots, catalogos, auditoria y exportacion CSV.
- PWA/service worker minimo.
- Reglas e indices Firestore iniciales en `lite/firebase/`.
- Sin import de `iaas-system`, `FULL_SCRIPTS`, `FULL_STYLES`, Google Sheets, XLSX, `innerHTML` ni `localStorage` en `lite/src`.

Prueba local realizada:

- `#/monitoreo-epidemiologico`: carga solo `src/modules/monitoreo/index.js`, sin legacy.
- `#/ronda-paquetes`: carga solo `src/modules/ronda-paquetes/index.js`, sin legacy.
- `#/reportes`: carga solo `src/modules/reportes/index.js`, sin legacy.
- 1 hoja CSS: `src/styles/base.css`.
- 1 script HTML inicial: `src/main.js`.
- Sin respuestas 404/500 despues de agregar `favicon.svg`.

### Avance posterior: Fase 2 CRUD modular y cola offline explicita

Estado: iniciada y validada localmente en `lite/`.

Implementado:

- Alta, edicion y egreso logico de pacientes en `#/censo`.
- Alta, edicion y retiro logico de dispositivos en `#/dispositivos`.
- Alta, edicion y cierre logico de casos IAAS en `#/epi-iaas`.
- Guardado de revision de ronda con estado visible de sincronizacion en `#/ronda-paquetes`.
- Cola IndexedDB `sync_queue:pending` para escrituras que no llegan a Firestore.
- `Admin` muestra operaciones pendientes y permite reintentar sincronizacion.
- `Inicio` muestra pendientes de sincronizacion.
- `Reportes` exporta censo, dispositivos, IAAS y cola pendiente en CSV, sin XLSX.
- Auditoria append-only por accion clinica; si Firestore no esta configurado, la auditoria tambien queda en cola local.
- Headers ajustados para no dejar modulos `src/*` cacheados entre despliegues.
- Service worker versionado a `epivida-lite-shell-2026-06-04-phase2`.

Prueba local Fase 2:

- Browser integrado: flujo `#/censo` -> alta de paciente -> visible como `Pendiente`, sin errores de consola.
- Browser integrado: flujo `#/dispositivos` -> alta de dispositivo -> visible como `Pendiente`, sin errores de consola.
- Browser integrado: flujo `#/epi-iaas` -> alta IAAS -> visible como `Pendiente`, sin errores de consola.
- Browser integrado: `#/admin` muestra 6 operaciones pendientes para paciente, dispositivo, IAAS y auditorias.
- Chrome local: paciente -> dispositivo -> IAAS -> admin pasa completo.
- Mobile 393 px: formulario de dispositivo sin desbordamiento horizontal.

Medicion local Fase 2, servidor sin cache:

| Ruta | Recursos | Transfer aprox. | Legacy |
|---|---:|---:|---|
| `#/censo` | 23 | 44.5 KB | 0 |
| `#/monitoreo-epidemiologico` | 22 | 38.9 KB | 0 |
| `#/dispositivos` | 23 | 46.6 KB | 0 |
| `#/epi-iaas` | 23 | 45.7 KB | 0 |
| `#/ronda-paquetes` | 24 | 46.1 KB | 0 |
| `#/reportes` | 25 | 31.8 KB | 0 |
| `#/admin` | 21 | 38.2 KB | 0 |

No se detectaron respuestas 400/500 ni errores de consola en estas rutas.

### Avance posterior: Fase 3 preparacion productiva y migracion

Estado: iniciada y validada localmente en `lite/`.

Implementado:

- `epivida-lite-config.js` como archivo editable de configuracion Firebase sin tocar codigo fuente.
- Validacion de configuracion Firebase en `src/lib/config.js`.
- `Admin` muestra si Firebase esta configurado y que llaves faltan.
- Lecturas Firestore mas finas:
  - `patients_active`: `active == true`.
  - `devices_active`: `active == true`.
  - `iaas_active`: `active == true`.
  - `nursing_rounds`: `date == hoy`.
- `listCollectionWhere()` centraliza consultas con `where`, `orderBy` y `limit`.
- Service worker `phase3` corrige fallback: `index.html` solo se devuelve para documentos, no para scripts o CSS.
- Herramienta `lite/tools/legacy-export/` prepara paquete JSON de migracion desde store legacy o archivo JSON, sin subir datos al servidor.
- Validador `lite/tools/validate-migration-package.mjs` revisa llaves minimas antes de cualquier importacion productiva.
- `Admin` enlaza a la herramienta de migracion.

Validacion Fase 3:

- Sintaxis de todos los `.js` y `.mjs`: OK.
- `lite/src` sigue sin `iaas-system`, `FULL_SCRIPTS`, `FULL_STYLES`, Sheets, XLSX, `innerHTML` ni `localStorage`.
- `localStorage` solo aparece en `lite/tools/legacy-export/index.js`, como herramienta de exportacion legacy de solo lectura.
- Paquete sintetico de migracion validado con `validate-migration-package.mjs`: OK.

### Fase 2: modelo Firestore

Estado: iniciado.

- Crear `firebase/firestore.rules`.
- Crear `firebase/firestore.indexes.json`.
- Crear catalogos semilla sin pacientes reales.
- Crear servicios de Firestore.
- Crear audit logger.

### Fase 3: censo

- Migrar `patients_active`.
- Alta, edicion, egreso y archivo.
- Busqueda local con debounce.
- Filtros por servicio/cama/estado.
- Exportacion CSV bajo demanda.

### Fase 4: monitoreo epidemiologico

- Prioridad por URL actual.
- Cargar solo `patients_active`, `daily_snapshots` y catalogos necesarios.
- Tabla sobria.
- Sin dashboard, reportes, importador ni IAAS completo.

### Fase 5: ronda-paquetes

- Modulo celular para enfermeria.
- Cargar pacientes activos y dispositivos activos.
- Guardar ronda en `nursing_rounds`.
- Guardar dispositivos en `devices_active/devices_archive`.
- Boton guardar y siguiente.

### Fase 6: EPI-IAAS

- `iaas_active`, `iaas_archive`.
- Seguimiento, cultivos, antimicrobianos y cierre.
- Audit logs por accion.

### Fase 7: reportes

- CSV sin libreria.
- Excel con import dinamico.
- JSON backup.
- Export logs.

### Fase 8: offline/PWA

- Service worker minimo.
- Firestore persistence si aplica.
- Cache de catalogos.
- Cola offline explicita, no monkey patch global de Storage.

### Fase 9: Cloudflare Pages

- Build.
- Headers.
- Variables.
- Deploy.
- Medicion en desktop, mobile y red lenta.

### Fase 10: retiro legacy

- Eliminar carga global.
- Eliminar hotfixes integrados.
- Eliminar assets decorativos iniciales.
- Mantener legacy aislado solo como respaldo hasta validacion.

## Reglas de no regresion

- No trabajar directo sobre `main`.
- No borrar legacy sin respaldo.
- No subir datos clinicos reales.
- No dejar reglas abiertas.
- No usar Google Sheets como source of truth.
- No usar localStorage como source of truth.
- No precargar reportes, importadores ni exportadores.
- No usar runtime monolitico para rutas nuevas.
- No cargar assets decorativos en la carga inicial.

## Criterios de exito

- `/monitoreo-epidemiologico` carga solo monitoreo.
- `/ronda-paquetes` no carga reportes ni IAAS completo.
- `/epi-iaas` no carga dashboard ni exportadores.
- `/reportes` carga exportadores solo al entrar o al exportar.
- Firestore es fuente de verdad.
- Audit logs existen.
- Roles y reglas bloquean usuarios inactivos y no autenticados.
- No hay pacientes reales en repo.
- La app funciona desde celular con carga rapida.
- La version nueva se puede revertir sin perder la version actual.
