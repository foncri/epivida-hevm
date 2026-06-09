# EPIVIDA Lite Performance Architecture

## Objetivo

EPIVIDA Lite debe pintar rapido, autenticar rapido, cargar solo la ruta necesaria y nunca descargar ni procesar historicos completos en el navegador.

## Carga Inicial

- `lite/index.html` solo carga favicon, manifest, `src/styles/base.css`, `epivida-lite-config.js` y `src/main.js`.
- `main.js` crea el shell e inicia router; Auth y PWA se importan despues del primer frame.
- Ningun modulo clinico entra al grafo inicial.
- Prohibido en carga inicial: legacy, Sheets, XLSX, reportes, IAAS completo, ronda, assets decorativos.

## Rutas

- `router.js` usa imports dinamicos por ruta.
- Auth ready y rol se validan antes de importar modulos clinicos.
- `app.js` precarga rutas permitidas en hover/focus.
- Rutas pesadas, empezando por `ronda-paquetes`, solo se precargan en idle.

## Datos

- Inicio y monitoreo solo leen `patients_active`, `daily_snapshots` o catalogos necesarios.
- Historicos deben usar rango de fecha, `limit`, cursor e indice.
- Nunca hacer `listCollection("patients_archive")` sin filtros.
- Busqueda historica debe ir por `patients_search` o por consulta paginada.

## UI Antilag

- `table()` normal para hasta 100 filas.
- `pagedTable()` para mas de 100 filas, 50 por pagina.
- `virtualTable` queda reservado para mas de 300 filas en componentes de fase P0/P1.
- Filtros locales se coalescen con `frameScheduler`.
- Ronda no debe usar `querySelectorAll` para navegar camas; la navegacion sale de datos ya cargados.
- El mapa de camas vive fuera del orquestador en `modules/ronda-paquetes/bedBoard.js`, los paneles de paciente/historial en `patientRoundPanels.js`, los formularios preventivos en `preventiveForms.js` y el guardado/drafts en `saveRoundFlow.js`; el siguiente corte debe separar el contenedor de paciente individual.
- No renderizar formularios ocultos gigantes.

## Escrituras

- UI optimista con `local_pending`.
- Errores reintentables van a cola offline.
- Errores de reglas/permisos van a `sync_blocked`.
- Guardados independientes se paralelizan con `Promise.all`.
- No recargar toda la app despues de guardar.

## Service Worker

- Precache minimo: `index.html`, `base.css`, `main.js`.
- Nunca cachear config, datos clinicos, Google Sheets, reportes o legacy.
- Runtime cache solo para scripts/styles/modulos visitados.
- Cada cambio relevante debe cambiar `APP_VERSION`.

## Cloudflare

- `wrangler.toml` publica `pages_build_output_dir = "lite"`.
- Proyecto oficial: `epivida-hevm`.
- `index.html`, `*.html`, config, SW y `/src/*` son `no-cache`.
- Solo `/assets/*` puede tener `immutable`, porque debe contener assets versionables/fingerprint en fase posterior.
