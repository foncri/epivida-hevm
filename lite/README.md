# EPIVIDA Lite

Base modular estatica para reconstruir EPIVIDA sin cargar el runtime legacy.

## Estado

Fase 3 inicial:

- Shell minimo.
- Router hash con carga diferida por modulo.
- Firebase Auth como puerta de acceso.
- Firestore como fuente de verdad objetivo.
- Modulos separados: inicio, censo, monitoreo, ronda-paquetes, EPI-IAAS, dispositivos, reportes y admin.
- CSS base unico, sobrio y pequeno.
- Service worker minimo.
- Google Sheets no se carga en el arranque.
- XLSX no se carga en el arranque.
- No hay datos clinicos seed.
- CRUD minimo en censo, dispositivos e IAAS.
- Revision de ronda con guardado puntual.
- Cola offline explicita en IndexedDB para escrituras pendientes.
- Admin muestra y reintenta sincronizacion pendiente.
- Reportes exporta CSV bajo demanda, incluida la cola pendiente.
- Configuracion productiva en `epivida-lite-config.js`.
- Admin muestra si Firebase esta listo o faltan llaves.
- Herramienta de migracion legacy de solo lectura en `tools/legacy-export/`.
- Validador local de paquetes de migracion.

## Ejecutar local

Desde la raiz del repositorio, usar cualquier servidor estatico. En este equipo no siempre existe Python; si esta disponible:

```powershell
python -m http.server 5199
```

Abrir:

```text
http://localhost:5199/lite/index.html#/inicio
```

## Configurar Firebase

Antes de publicar en produccion, editar `epivida-lite-config.js`:

```js
window.EPIVIDA_LITE_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

La API key de Firebase no es secreto absoluto, pero la proteccion real depende de Auth, reglas Firestore y dominios autorizados.
Despues de configurar, entrar a `#/admin` y verificar que aparezca `Configurado: <projectId>`.

## Cloudflare Pages

Configuracion recomendada para esta fase estatica:

- Build command: vacio.
- Output directory: `lite`.
- Variables: ninguna obligatoria si se inyecta la configuracion por script seguro. En una fase posterior con Vite, usar `VITE_FIREBASE_*`.

`lite/_headers` ya incluye headers de cache para HTML, JS, CSS, assets y manifest.
Los modulos `src/*` quedan con `Cache-Control: no-cache` porque esta fase no usa filenames con hash; esto evita que Cloudflare o el navegador conserven modulos viejos despues de un despliegue.
`epivida-lite-config.js` tambien queda `no-cache` para permitir cambios de configuracion entre despliegues.

## Rutas

- `#/login`
- `#/inicio`
- `#/censo`
- `#/monitoreo-epidemiologico`
- `#/ronda-paquetes`
- `#/epi-iaas`
- `#/dispositivos`
- `#/reportes`
- `#/admin`

## Migracion legacy

Herramienta de solo lectura:

```text
lite/tools/legacy-export/index.html
```

Uso:

1. Abrir la herramienta en el mismo origen donde se uso EPIVIDA legacy, o cargar un respaldo JSON.
2. Preparar el paquete.
3. Descargar `epivida-lite-migration-YYYY-MM-DD.json`.
4. Validar localmente:

```powershell
node lite/tools/validate-migration-package.mjs ruta\al\paquete.json
```

No subir ese paquete al repositorio. Puede contener pacientes, diagnosticos y trazabilidad clinica.

## Firestore

Reglas e indices iniciales:

- `lite/firebase/firestore.rules`
- `lite/firebase/firestore.indexes.json`

Colecciones objetivo:

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

## Reglas de trabajo

- No borrar legacy todavia.
- No subir datos clinicos reales.
- No usar Google Sheets como base principal.
- No usar localStorage como fuente de verdad.
- No agregar assets decorativos a la carga inicial.
- No convertir esta base nueva en otro monolito.

## Pruebas Fase 3

- Sintaxis de todos los `.js`: OK.
- Busqueda de legacy prohibido (`iaas-system`, `FULL_SCRIPTS`, Sheets, XLSX, `innerHTML`, `localStorage`): sin coincidencias en `lite/src`.
- Browser integrado: alta de paciente, dispositivo e IAAS en modo local sin Firebase.
- Chrome local: rutas criticas sin errores de consola ni respuestas 400/500.
- Mobile 393 px: sin desbordamiento horizontal en formulario de dispositivo.
- Herramienta `legacy-export`: sintaxis OK.
- Validador de migracion: probado con paquete sintetico OK.
