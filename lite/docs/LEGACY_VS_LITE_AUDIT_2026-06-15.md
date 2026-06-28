# EPIVIDA Antiguo vs EPIVIDA Lite - Auditoria Profesional

Fecha de corte: 2026-06-15
Rama auditada: `feature/epivida-lite-ultrafast-rework`
Alcance: raiz legacy del repositorio contra `lite/`, con verificacion local, validadores y Cloudflare publico.

## Dictamen Ejecutivo

EPIVIDA Lite ya reemplaza la arquitectura critica de EPIVIDA antiguo: carga inicial minima, router modular, Firestore como fuente principal, reglas por roles, service worker minimo, cache sin conflictos, tablas paginadas, expediente con cargas incrementales y modulos clinicos separados.

No es correcto declarar paridad clinica total. La auditoria confirma paridad funcional critica en Auth, censo basico, importacion CSV/TSV/Excel con conciliacion completa/parcial, monitoreo, OPD base, ronda preventiva, dispositivos activos/archivo/reinstalacion, IAAS base con ventilacion, expediente incremental, reportes CSV/Excel/snapshots, auditoria, offline queue, seguridad y despliegue Cloudflare. Avance del 2026-06-16: ya se agregaron prioridad clinica en monitoreo, alertas operativas y tendencia agregada desde `iaas-system-runtime-2026-06-04.js`, reparador puro de `import-census-repair.js` para censos hospitalarios humanos, fix de `import-urgencias-aisp-fix-2026-06-01.js` para `AISLADO P`/filas partidas de Urgencias, migracion de `iaas-urgencias-aisp-system-preloader-2026-06-01.js` para `AIS P` permanente en tablero de Urgencias sin `eval`, catalogos editables con `known_beds`, UI de cultivos/antimicrobianos por caso IAAS, tablero microbiologico agregado, respaldo JSON operativo con restauracion administrativa, reportes historicos por cursor/bloque, cedulas preventivas CSV/Excel diarias/mensuales sin Sheets, flujo ISQ/quirofano del hotfix preventivo, IAAS cerradas en `iaas_archive`, edicion/reinstalacion de dispositivos retirados, FiO2/PEEP, OPD sin loader, loader IAAS followup sin `eval` con catalogo antimicrobiano legacy y otros estudios estructurados, y auditoria reciente en Admin. Avance adicional: `reconciliationService` ya replica el alcance automatico/completo/parcial de `buildImportPlanV2`, marca altas reportadas y altas probables revisables y escribe snapshots mensual/anual; `excelImportService` permite importar censos Excel bajo demanda; `excelExportService` genera reportes Excel bajo demanda sin libreria pesada inicial; `snapshotService` y `snapshotExports` exponen agregados diarios/mensuales/anuales sin leer colecciones clinicas completas; `patients_search` ya alimenta busqueda avanzada por tokens desde Censo sin recorrer historicos completos; la restauracion JSON ya tiene plan local automatizado con catalogos, snapshots, `restoreRunId` y auditoria; EPI-IAAS ahora normaliza alias legacy de tipos, persiste `clinicalValidation` versionada por cedula y valida evidencia heredada `iaasAssessment` de EGO/biometria/cultivos/tratamientos/panel viral/seguimiento de infecciones. Persisten brechas P0/P1 en validacion clinica formal externa de criterios IAAS, pruebas manuales por rol contra Firebase real, timeline visual por episodio con datos reales, mas fixtures hospitalarios anonimizados y drill Firebase real de restauracion.

## Evidencia De Tamano Y Riesgo Legacy

| Archivo legacy | Bytes | Lineas | Simbolos aproximados | Hallazgo |
|---|---:|---:|---:|---|
| `iaas-system-runtime-2026-06-04.js` | 565687 | 12085 | 2123 | Monolito clinico principal: router, estado, censo, importacion, monitoreo, ronda, IAAS, dispositivos, reportes, Google Sheets, offline y Firestore. |
| `iaas-system.js` | 547381 | 11851 | 2058 | Variante del monolito; no debe entrar a Lite. |
| `iaas-system.css` | 201877 | n/a | n/a | CSS global pesado con estetica legacy. |
| `preventive-packages-enhancement-2026-06-01.js` | 33216 | 368 | 116 | Hotfix/extension de paquetes preventivos. |
| `preventive-round-repair.js` | 31745 | 759 | 163 | Reparaciones de ronda, guardado, paquetes y DOM. |
| `hospital-bed-service-normalizer-2026-06-02.js` | 29386 | 582 | 166 | Normalizacion de camas/servicios y parches de importacion/ronda. |
| `import-census-repair.js` | 27733 | 589 | 169 | Reparacion de importacion de censo hospitalario. |
| `import-service-fix.js` | 19795 | 402 | 123 | Parser mas tolerante para texto/Excel/servicio/cama. |
| `preventive-invasive-editor.js` | 17139 | 406 | 93 | Editor de invasivos y episodios. |
| `epivida-auth-gate.js` | 12669 | 332 | 53 | Auth gate legacy que inyecta `FULL_STYLES` y `FULL_SCRIPTS`. |

Conclusion tecnica: el legacy no es una app modular; es una app monolitica con hotfixes acumulados. Migrar "todo" copiando archivos reintroduciria lentitud y cache obsoleta. La ruta correcta es extraer reglas clinicas y reimplementarlas como servicios Lite.

## Raiz Legacy: Flujo De Ejecucion

| Capa | Evidencia | Funcion | Riesgo |
|---|---|---|---|
| `index.html` legacy | Solo carga `epivida-auth-gate.js` | Puerta de autenticacion y bootstrap | Contiene referencias Firebase y limpieza de `localStorage`; no es shell modular. |
| `epivida-auth-gate.js` | `FULL_STYLES`, `FULL_SCRIPTS`, `loadScript`, `epivida-service-worker.js` | Despues del login descarga todo el runtime y estilos | Carga monolitica, SW legacy y assets aunque solo se necesite una ruta. |
| `epivida-service-worker.js` | cachea `iaas-system-runtime-2026-06-04.js` | Offline legacy | Riesgo de JS viejo y cache de monolito. |
| `iaas-system-runtime-2026-06-04.js` | mas de 12k lineas | Estado global, render y reglas clinicas | Acopla todos los dominios; no escala a millones. |
| Hotfixes | `preventive-*`, `iaas-*`, `import-*`, `contrast-*` | Corrigen bugs reales | Duplican reglas y mutan DOM/estado global. |

## EPIVIDA Lite: Flujo De Ejecucion Verificado

| Capa Lite | Estado verificado |
|---|---|
| `lite/index.html` | HTML publico de 579 bytes en Cloudflare; contiene `epivida-lite-config.js`, `src/main.js` y `base.css`; no contiene `iaas-system`, `epivida-auth-gate`, `FULL_SCRIPTS`, `FULL_STYLES`, `XLSX` ni `google.script`. |
| `src/main.js` | Arranque minimo; auth y PWA se difieren despues del primer frame. |
| `src/router.js` | Import dinamico por ruta clinica; conserva alias legacy. |
| `src/app.js` | Shell minimo, navegacion por rol, precarga hover/focus y rutas pesadas diferidas. |
| `lite/_headers` | `/`, HTML, config, SW, build marker y `src/*` con `no-cache`; `assets/*` immutable solo para assets. |
| `epivida-lite-sw.js` | `APP_VERSION`, core minimo y exclusiones para config/legacy/datos clinicos. |
| Cloudflare | `https://epivida-hevm.pages.dev/epivida-lite-build.json` debe responder `release: 2026-06-16-parity11`, `Cache-Control: no-cache`, despues de publicar este bloque. |

## Paridad Por Dominio

| Dominio | EPIVIDA antiguo | EPIVIDA Lite | Dictamen |
|---|---|---|---|
| Auth | Firebase Auth en `epivida-auth-gate.js`, carga monolito tras login. | `authService` usa runtime Auth separado, persistencia local, popup con fallback redirect y perfil Firestore activo. | Migrado arquitectonicamente; falta prueba manual de dominios Auth reales. |
| Roles | Correos/autorizacion y control interno legacy. | `security.js`, `users`, Admin, reglas por rol. | Migrado; falta QA manual multirol en Firebase real. |
| Censo | `renderHospitalCensusPage`, edicion, egreso, filtros y estado global. | `modules/censo`, `patientService`, `patients_active`, `patients_archive`, `patients_search`, sync pending, busqueda avanzada por indice y conciliacion por alcance; ausentes de censo completo quedan como alta probable/revision, importaciones parciales conservan activos; el formulario conserva el catalogo epidemiologico legacy completo con `1-4 IAAS`, IAAS importadas, combinaciones VIG + IAAS/riesgo/no IAAS, COVID/Influenza, ESAVI y morbimortalidad. | Critico migrado; falta QA manual con datos reales anonimizados. |
| Importacion | `parseImportInput`, `buildImportDraft`, `buildImportPlanV2`, `import-census-repair.js`, `import-urgencias-aisp-fix-2026-06-01.js` y parsers de hotfix. | `excelImportService`, `importService`, `censusRepairService`, `reconciliationService`, preview, protegidos, `census_days`, snapshots y auditoria; el reparador detecta censos hospitalarios legacy con encabezados rotos, filas guia, fechas Excel, RFC/afiliacion, sector, edad en meses/dias, estados intubados, diagnosticos, observaciones, `AISLADO P` y filas partidas de Urgencias/AISP; conserva DX ingreso + DX actual, ahora tambien con aliases tecnicos del runtime (`patient_name`, `servicio_cama`, `dx_ingreso`, `diagnostico_actual`, `riesgo_iaas`) y fusiona observaciones/pendientes duplicados. El preview acepta Excel bajo demanda, expone modo automatico/completo/parcial, altas reportadas, avisos de movimiento de cama/servicio, altas automaticas previas al censo completo para `alta_probable`, `alta_reportada` y ambulatorio simple viejo, conflictos de mismo paciente en dos ubicaciones, duplicados activos existentes para conciliacion y separacion de estancia hospitalaria para protegidos de hemodialisis/oncologia. | Migrado ampliado; faltan mas fuentes reales anonimizadas. |
| Monitoreo | `renderEpidemiologicalMonitoringPage`, filtros, etiquetas IAAS/riesgo/vig, rangos de edad, orden DEIH/estado, paneles de pendientes y alertas. | `monitorService`, `modules/monitoreo`, filtros locales, paginacion, metricas, rangos de edad legacy, orden por DEIH/estado/prioridad, filtro/conteo por etiquetas legacy IAAS/riesgo/no IAAS/vigilancia/COVID-Influenza/ESAVI/morbimortalidad con soporte de combinaciones VIG + IAAS, panel acotado de Alta OPD archivada, `operationalAlertService` para avisos preventivos/dispositivos activos/IAAS/cultivos/OPD/sync y `snapshotService.snapshotTrend()` para tendencia corta desde `daily_snapshots` sin store global. | Migrado ampliado; falta QA longitudinal con snapshots reales anonimizados. |
| OPD | `iaas-system-opd-loader-2026-05-20.js` parcheaba OPD en monitoreo/IAAS. | `opdService`, `opdFields`, Censo, Monitoreo y EPI-IAAS guardan/visualizan OPD sin `eval`, sin loader y sin coleccion nueva; conserva elegibilidad legacy para VIG/morbimortalidad, COVID/Influenza o ESAVI hospitalizados e IAAS confirmada con exclusiones ambulatorio/hemodialisis/oncologia; alertas y badges OPD abren `#/censo/paciente/ID` para editar el paciente exacto sin cargar la lista general. OPD archivada se conserva con `patients_archive.opdPending` limitado e indexado. | Migrado base ampliado; falta validacion operativa con casos reales anonimizados. |
| Ronda | `renderRoundPage`, `renderPatientRound`, mapa de camas, guardar/siguiente y preloader Urgencias/AISP. | `ronda-paquetes` dividido en `bedBoard`, `patientRound`, `preventiveForms`, `roundNavigation`, `saveRoundFlow`; `roundHelpers` conserva `AIS P` como cama canonica/permanente de Urgencias e infiere servicio desde cama sin `eval`. | Critico migrado; `index.js` aun es grande y debe seguir vigilado. |
| Paquetes preventivos | ITS-CC, ITU-CU, NAVM, ISQ, PE/PBMT, especiales, quirofano y cedulas. | `preventivePackageService`, UI de ronda, `saveRoundFlow` con `surgeryRoom` en `nursing_rounds`, pendientes limpios, estado `pendiente` explicito y `preventiveCedulaService` para CSV diario/mensual desde rondas. | Migrado funcional ampliado; requiere validacion clinica formal con casos anonimizados de ISQ/especiales. |
| Dispositivos | `deviceEpisodes`, editor invasivo, instalacion/retiro/reinstalacion y auditoria por evento. | `deviceService`, `devices_active`, `devices_archive`, modulo dispositivos, historial retirado editable, reinstalacion como nuevo episodio, uso en ronda/expediente, ruta `#/dispositivos/paciente/ID` con carga acotada por paciente y timeline lazy por `audit_logs.entityId` con indice compuesto. | Migrado funcional; falta QA manual contra auditoria real desplegada. |
| IAAS | Seguimiento completo en runtime: vitales, ventilacion, BH, EGO, estudios, cultivos, tratamientos, tendencia de signos vitales y tabla diaria IAAS. | `iaasService`, `iaasCriteriaService`, `modules/epi-iaas`, expediente y servicios de cultivos/antimicrobianos; incluye FiO2/PEEP, otros estudios nombre/valor, `clinicalTimeline` ligero con tendencia de signos vitales y tabla diaria por caso que integra cultivos/tratamientos por `iaasId`, alias legacy de tipo y `clinicalValidation` versionada con semaforo de cedula; el validador entiende bloques heredados `iaasAssessment` de cultivos, tratamientos, EGO, biometria, panel viral y seguimiento de infecciones/hemodialisis; la ruta legacy `#/seguimiento-iaas/FECHA/paciente/ID` entra directo al paciente en Lite. | Migrado base ampliado; los criterios aun requieren validacion clinica formal externa. |
| Cultivos | Catalogos y alertas mezclados con IAAS/ronda. | `cultureService` por paciente/caso/estado con limite, `clinicalFollowUp` para agregar/editar cultivos desde IAAS, `microbiologyAlertService` para pendientes vencidos, positivos criticos y cultivos negativos vinculados a desescalamiento; tablero e Inicio abren seguimiento IAAS directo por paciente. | Migrado ampliado; falta validacion formal de umbrales/organismos con microbiologia. |
| Antimicrobianos | Catalogo grande legacy y tratamientos por seguimiento. | `legacyClinicalCatalogs`, `antimicrobialService` por paciente/caso/estado con limite, catalogos versionados, `clinicalFollowUp`, consultas activas `activo`/`ajustado`/`profilaxis`, alertas de tratamiento prolongado, fin vencido, amplio sin cultivo, timeout 48h, profilaxis prolongada y desescalamiento por cultivo negativo con enlace directo al seguimiento IAAS del paciente. | Migrado ampliado; falta validacion formal de reglas de de-escalamiento. |
| Expediente | `renderPatientExpediente`, `printPatientExpediente`, tablas de censo/ronda/dispositivos/IAAS. | `expedienteService` carga por paciente y secciones con cursor; `modules/expediente/panels.js` agrega tabs, tarjetas desplegables por evento, `Cargar mas` y acciones hacia Dispositivos/Ronda/EPI-IAAS; `modules/expediente/print.js` prepara impresion local desde el expediente ya cargado, sin lecturas globales extra; dispositivos abren `#/dispositivos/paciente/ID` y cultivos, antimicrobianos e IAAS abren el seguimiento directo del paciente con la ruta legacy `#/seguimiento-iaas/FECHA/paciente/ID`. | Migrado y mejorado para escala; falta QA con expedientes reales extensos. |
| Reportes | Reportes/print/Sheets y `computeRangeStats(30)` en runtime; el bloque legacy de reporte contaba `CONFIRMADOS INFLUENZA/COVID`, `ESAVIS`, riesgo/no IAAS, VIG transmisible/no transmisible y morbimortalidad con formulas. | `reportService`, `snapshotExports`, `epidemiologicalExports`, `exportService`, `excelExportService`, CSV/Excel/JSON protegido, snapshots diarios/mensuales/anuales por rango, `snapshotService` para tendencia de Inicio, cedulas preventivas, censo epidemiologico CSV/Excel y vista imprimible local calculados desde `patients_active`, historicos por cursor/bloque y `exports_log`. | Migrado ampliado; QA de volumen real pendiente. |
| Offline | `localStorage`, mirror IndexedDB, writeQueue y SW legacy. | Firestore persistence, IndexedDB cache controlada, `offlineQueueService`, backup JSON operativo con catalogos/snapshots y restauracion admin con plan previo, `restoreRunId`, auditoria y drill local QA. | Reemplazado correctamente; falta drill contra Firebase real. |
| Auditoria | `auditLogs` locales y sync a Firestore/Sheets. | `auditService`, reglas `audit_logs`, escrituras criticas. | Migrado base; cobertura exhaustiva debe seguir ampliandose. |
| Seguridad | Reglas legacy root para modelo anterior. | `lite/firebase/firestore.rules`, roles activos, deletes bloqueados. | Migrado; falta desplegar/probar reglas reales por rol si no se hizo desde Firebase CLI. |
| Performance | Monolito, CSS global, assets pro y hotfixes DOM. | HTML minimo, imports dinamicos, tablas paginadas, SW minimo, validadores. | Mejorado sustancialmente y verificado con validadores. |
| Cloudflare | Legacy GitHub Pages/root. | `wrangler.toml` `name = epivida-hevm`, output `lite`, build marker publico. | Configuracion unificada y verificada en produccion. |

## Brechas Que Aun No Pueden Declararse Cerradas

| Prioridad | Brecha | Riesgo | Siguiente accion |
|---|---|---|---|
| P0 | Mas formatos reales anonimizados de importacion y conciliacion hospitalaria fina. | Formatos aun no vistos podrian requerir ajustes clinicos locales. | Ampliar bateria de fixtures anonimos por formato real; conservar reglas versionadas completo/parcial/alta reportada. |
| P0 | Validacion clinica formal de cedulas IAAS Lite contra criterios aprobados. | Seguimiento incompleto o criterio mal clasificado. | Revision clinica y pruebas por tipo IAAS. |
| P0 | Prueba manual por rol en Firebase real. | Reglas pueden estar correctas en archivo pero no desplegadas. | Ejecutar QA admin/epidemiologia/enfermeria/lectura cuando haya acceso. |
| P1 | Timeline visual por episodio de dispositivo. | Cerrado en codigo con lectura filtrada por entidad; falta probarlo contra datos reales despues de desplegar indices. | QA manual de episodio retirado/reinstalado en Firebase real. |
| P1 | Validacion operativa OPD con casos reales anonimizados. | La captura OPD base existe, pero debe probarse con reglas locales de plataforma OPD. | Fixtures anonimizados VIG/IAAS confirmada y QA de egreso/subido/alta. |
| P1 | Drill Firebase real de restauracion JSON. | El simulacro local ya cubre plan, cola, sanitizacion y auditoria; falta probar permisos, cola y resultado contra Firebase de prueba. | Ejecutar simulacro admin con datos anonimizados. |
| P2 | QA de importacion masiva de catalogos con fuente oficial. | La carga CSV/TSV controlada ya existe en Admin; falta probarla con fuente aprobada por epidemiologia y permisos Firebase reales. | Ejecutar import controlado de catalogos versionados en Firebase de prueba. |

## Funcionalidad Legacy Que No Debe Migrarse Como Codigo

| Elemento legacy | Motivo |
|---|---|
| `FULL_SCRIPTS` y `FULL_STYLES` | Reintroducen carga monolitica. |
| `iaas-system-runtime-2026-06-04.js` dentro de Lite | Rompe modularidad, performance y validadores. |
| `iaas-system.css` completo | Arrastra visual pesado y estilos globales. |
| Assets `assets/epivida-pro/**` | Decorativos/pesados; no son operacion clinica. |
| Google Sheets como base principal | No escala, OAuth pesado y no es fuente clinica robusta. |
| `localStorage` como verdad clinica | No es auditable ni multiusuario seguro. |
| Hotfixes DOM (`querySelectorAll` global, monkey patches) | Fragiles y lentos; se deben convertir en servicios puros. |

## Verificacion Ejecutada

| Verificacion | Resultado |
|---|---|
| `git branch --show-current` | `feature/epivida-lite-ultrafast-rework` |
| `git pull --ff-only origin feature/epivida-lite-ultrafast-rework` | `Already up to date` |
| `npm run validate` | OK: validacion completa de Lite, seguridad, deploy, offline, pacientes, ronda, importacion, paridad, no-legacy, performance, indices y escalabilidad. |
| Cloudflare build marker | Esperado tras publicacion: `2026-06-16-parity11`, `no-cache`. |
| Cloudflare HTML publico | OK: HTML minimo, sin legacy detectado. |
| Cloudflare headers | OK: `/`, `src/main.js`, `base.css`, SW y build marker con `no-cache`. |
| Wrangler deploy directo | Bloqueado: falta `CLOUDFLARE_API_TOKEN` en entorno no interactivo. Cloudflare publico si auto-publico desde GitHub. |

## Dictamen Final De Esta Auditoria

EPIVIDA Lite es la direccion correcta y ya resuelve el problema estructural de lentitud del legacy: no carga el monolito, no usa Google Sheets como base principal, no usa `localStorage` como verdad clinica, separa dominios, pagina historicos y valida seguridad/despliegue.

La auditoria no cierra "todo EPIVIDA antiguo" como migrado. Cierra la arquitectura y la paridad critica base. Las brechas restantes son clinicas y operativas, no de shell/carga inicial: requieren fixtures reales anonimizados, validacion clinica de cedulas, pruebas por rol en Firebase real y ampliacion de formularios de cultivos/antimicrobianos/reportes historicos.
