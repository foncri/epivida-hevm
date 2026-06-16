# EPIVIDA Legacy Feature Inventory

Fecha de corte: 2026-06-09

Alcance: inventario funcional de la raiz legacy del repositorio para migrar solo la logica clinica util hacia `lite/`. No se debe copiar el monolito, estilos pesados, assets decorativos, `FULL_SCRIPTS`, `FULL_STYLES`, Google Sheets como base principal ni `localStorage` como fuente de verdad clinica.

## Hallazgos Base

- `epivida-auth-gate.js` carga `FULL_STYLES` y `FULL_SCRIPTS`; eso obliga a descargar el runtime completo despues de autenticar.
- `iaas-system-runtime-2026-06-04.js` concentra router, render, importacion, censo, monitoreo, IAAS, rondas, dispositivos, reportes, Sheets, offline y hotfixes. Mide 565687 bytes y 12085 lineas.
- `iaas-system.js` conserva una variante del mismo monolito. Mide 547381 bytes y 11851 lineas.
- `iaas-system.css` mide 201877 bytes y contiene estilos de muchas rutas, efectos visuales y superficies heredadas.
- La fuente legacy operacional principal era `localStorage` en `epivida-iaas-os-v1`, con claves como `patients`, `dailyCensus`, `dailyRounds`, `deviceEpisodes`, `auditLogs` y `writeQueue`.
- Los hotfixes contienen reglas clinicas valiosas, pero estan acoplados a DOM global, rutas legacy y almacenamiento local.
- `data/censo-data.js` no contiene censo real precargado; solo estructura vacia por privacidad.

## Tabla De Inventario

| Funcion legacy | Archivo legacy | Que hacia | Sigue siendo util | Problema de rendimiento | Modulo Lite destino | Estado |
|---|---|---|---|---|---|---|
| Auth gate Firebase | `epivida-auth-gate.js` | Inicializaba Firebase Auth, login Google, control de correos permitidos y carga posterior de la app completa. | Si, solo el flujo Auth. | Cargaba `FULL_SCRIPTS` y `FULL_STYLES`, registraba SW legacy y calentaba assets pesados. | `src/services/authService.js`, `src/lib/firebase.js`, `src/modules/login/` | reemplazado por arquitectura nueva |
| Carga del monolito | `epivida-auth-gate.js`, `index.html` | Inyectaba todos los scripts clinicos tras autenticacion. | No como implementacion. | Descarga masiva aunque el usuario solo abra monitoreo o censo. | `src/router.js` con imports dinamicos | descartado por visual |
| Runtime clinico central | `iaas-system-runtime-2026-06-04.js`, `iaas-system.js` | Unia estado, router, UI y datos de toda la app. | Si, como fuente de reglas. | 550 KB de JS, render global y acoplamiento entre dominios. | Servicios Lite por dominio | pendiente |
| Catalogos de servicios | `iaas-system-runtime-2026-06-04.js:201`, `hospital-bed-service-normalizer-2026-06-02.js` | Definia servicios hospitalarios, colores, iconos y filtros de ronda. | Si, sin iconografia pesada. | Mezclado con assets y render. | `catalogService.js`, `ronda-paquetes` | migrado |
| Catalogo de camas conocidas | `hospital-bed-service-normalizer-2026-06-02.js:158` | Mantenia camas por servicio para tablero y normalizacion. | Si. | Parches sobre funciones globales y DOM. | `catalogService.js`, `roundHelpers.js`, `admin` | migrado |
| Normalizacion servicio/cama | `hospital-bed-service-normalizer-2026-06-02.js:247`, `import-service-fix.js:57` | Inferia servicio desde cama, limpiaba etiquetas y corregia ubicaciones. | Si, critica para importacion. | Duplicada en varios hotfixes. | `src/lib/normalize.js`, `importService.js` | migrado |
| Importacion de censo por texto/tabla | `iaas-system-runtime-2026-06-04.js:3919`, `import-census-repair.js`, `import-service-fix.js` | Parseaba texto, Excel/Sheets/CSV, detectaba encabezados y armaba preview. | Si. | Dependia del monolito y podia tocar todo el store. | `modules/importar-censo`, `importService.js` | migrado |
| Reparacion de importacion | `import-census-repair.js`, `hospital-bed-service-normalizer-2026-06-02.js` | Detectaba filas sin servicio, camas mal pegadas, encabezados rotos y hemodialisis/oncologia. | Si. | Hotfix incremental, dificil de probar. | `reconciliationService.js`, `validate-census-import` | migrado parcial |
| Deteccion de pacientes nuevos | `iaas-system-runtime-2026-06-04.js:11464` | Creaba o resolvia `patientId` desde identificador estable o nombre/demografia. | Si. | Buscaba en `store.patients` completo. | `patientService.js`, `importService.js` | migrado |
| Conciliacion de pacientes existentes | `iaas-system-runtime-2026-06-04.js:11485` | Emparejaba por nombre, ingreso y demografia. | Si. | Candidatos locales sobre store completo; no escalable a 1M. | `reconciliationService.js`, `patients_search` | migrado |
| Deteccion de ausentes/posible egreso | `hospital-bed-service-normalizer-2026-06-02.js`, `ronda-paquetes` legacy | Mostraba pacientes no vistos en censo o con alta reportada. | Si. | Derivado desde `dailyCensus` local completo. | `censusService.js`, `modules/ronda-paquetes` | migrado |
| Alta/egreso logico | `iaas-system-runtime-2026-06-04.js`, `preventive-round-workflow-hotfix-2026-06-02.js` | Marcaba egreso, tipo de alta, turno y fecha. | Si. | Mutaba pacientes y censo local; riesgo de doble estado. | `patientService.archivePatient`, `patients_archive` | migrado |
| Movimiento de servicio/cama | `preventive-round-workflow-hotfix-2026-06-02.js`, `ronda-paquetes` legacy | Permitio cambiar servicio/cama desde ronda. | Si. | Acoplado a formulario de ronda. | `patientService.savePatient`, `ronda-paquetes` | migrado |
| Monitoreo epidemiologico | `iaas-system-runtime-2026-06-04.js:1505`, `:1532`, `:2956` | Listaba pacientes, etiquetas epidemiologicas, filtros y conteos. | Si. | Render global y podia cargar IAAS/ronda/reportes. | `modules/monitoreo`, `patientService` | migrado |
| Diagnostico epidemiologico | `data/censo-data.js`, `iaas-system-runtime-2026-06-04.js` | Manejo estados `NO IAAS`, `RIESGO IAAS`, `1 IAAS`, etc. | Si. | Valores dispersos y texto libre. | `patientService`, `iaasService`, catalogos | migrado |
| Clasificacion IAAS/riesgo/no IAAS | `epivida-iaas-monitor-sync-hotfix-2026-05-18.js`, `epivida-iaas-sheets-preventive-hotfix-2026-05-18.js` | Sincronizaba clasificacion entre monitoreo, seguimiento y ronda. | Si. | Hotfixes escribian store local y queue. | `iaasService`, `patientService`, `auditService` | migrado |
| Seguimiento IAAS | `iaas-system-runtime-2026-06-04.js:3482`, `epivida-iaas-followup-noreload-hotfix-2026-05-13.js` | Listaba pacientes en seguimiento, estado y tarjetas por paciente. | Si. | Usaba tarjetas DOM, querySelectorAll y localStorage. | `modules/epi-iaas`, `expediente` | migrado |
| Cedulas preventivas | `iaas-system-cedulas-loader-2026-05-21.js` | Generaba hojas ITS X CC, ITU X CU, NAVM, ISQ, P.E. y mensual por servicio desde rondas/paquetes. | Si, como reporte operativo. | Loader con gzip/base64, `eval` opcional y sincronizacion Google Sheets pesada. | `preventiveCedulaService.js`, `modules/reportes` | migrado |
| Loader seguimiento IAAS | `iaas-system-followup-loader-2026-05-20.js` | Ampliaba seguimiento IAAS con catalogo antimicrobiano legacy, otros estudios, otro cultivo/farmaco, OPD y resumen de estudios. | Si. | Loader con `eval`, catalogos dentro del runtime y mutacion de store global. | `legacyClinicalCatalogs.js`, `catalogService.js`, `iaasService.js`, `clinicalFollowUp.js`, `expediente` | migrado |
| Cultivos | `iaas-system-runtime-2026-06-04.js:455`, `preventive-round-repair.js:274` | Catalogo/tipos de cultivos y alertas por resultados. | Si. | Se mezclaba con ronda y notificaciones globales. | `cultureService.js`, `cultures`, `clinicalFollowUp`, `microbiologyDashboard` | migrado |
| Antibioticos/antimicrobianos | `iaas-system-runtime-2026-06-04.js:474`, `iaas-system-followup-loader-2026-05-20.js` | Catalogo IAAS de antimicrobianos y seguimiento. | Si. | Catalogo dentro del monolito. | `legacyClinicalCatalogs.js`, `antimicrobialService.js`, `antimicrobials`, `clinicalFollowUp`, `microbiologyDashboard` | migrado |
| Signos vitales | `iaas-system-runtime-2026-06-04.js:400` | Campos de constantes vitales para seguimiento IAAS. | Si. | Campos en runtime global. | `iaasService.js`, `expediente` | migrado |
| Ventilacion | `iaas-system-runtime-2026-06-04.js:407` | Campos para ventilacion y NAVM. | Si. | Acoplado a cedulas IAAS. | `iaasService.js`, `modules/epi-iaas` | migrado |
| Biometria hematica | `iaas-system-runtime-2026-06-04.js:411` | Campos CBC para seguimiento. | Si. | Sin servicio propio. | `iaasService.js` | migrado |
| EGO/urianalisis | `iaas-system-runtime-2026-06-04.js:422` | Selectores de EGO en seguimiento. | Si. | Mezclado con UI monolitica. | `iaasService.js` | migrado |
| Otros estudios | `iaas-system-runtime-2026-06-04.js:430`, `iaas-system-followup-loader-2026-05-20.js` | Campos para estudios adicionales y lista nombre/valor. | Si. | Sin modelo separado y acoplado al runtime. | `iaasService.js`, `modules/epi-iaas`, `expediente` | migrado |
| Dispositivos invasivos | `iaas-system-runtime-2026-06-04.js:308`, `preventive-invasive-editor.js` | Episodios de CVC, CU, VM y especiales. | Si, critico. | Store local y edicion DOM. | `deviceService.js`, `modules/dispositivos` | migrado |
| Episodios activos/retirados | `preventive-invasive-editor.js:83`, `:91`, `:96` | Calculaba activo por fecha, dias de dispositivo y retiro. | Si. | Retirados convivian con activos en store local. | `devices_active`, `devices_archive`, `modules/dispositivos` | migrado |
| Reinstalacion de dispositivos | `README.md`, `preventive-invasive-editor.js` | Reinstalacion como nuevo episodio. | Si. | Sin separacion fuerte activo/archivo. | `deviceService.js`, `modules/dispositivos/deviceForms.js` | migrado |
| Paquetes preventivos base | `preventive-packages-enhancement-2026-06-01.js`, `preventive-round-repair.js` | Checklists SI/NO/NA y resumen de cumplimiento. | Si. | Hotfixes y render extenso en runtime. | `preventivePackageService.js` | migrado |
| ITS-CVC / ITS-CC | `iaas-system-runtime-2026-06-04.js:330`, `preventivePackageService` legacy | Paquete asociado a cateter central. | Si. | Campos dispersos. | `preventivePackageService.js`, `ronda-paquetes` | migrado |
| ITU-CU | `iaas-system-runtime-2026-06-04.js:332` | Paquete para cateter urinario y material. | Si. | Reglas mezcladas con UI. | `preventivePackageService.js` | migrado |
| NAVM | `iaas-system-runtime-2026-06-04.js:333` | Paquete para ventilacion mecanica. | Si. | Dependia de device text. | `preventivePackageService.js` | migrado |
| ISQ | `preventive-round-workflow-hotfix-2026-06-02.js`, `ronda-paquetes` legacy | Senal quirurgica, sala y acciones. | Si. | No separado como servicio. | `ronda-paquetes`, futuro `preventiveForms.js` | pendiente |
| P.E. y P.B.M.T. | `iaas-system-runtime-2026-06-04.js:11944`, `:11966` | Identificaba paquetes PE/PBMT y resumen historico. | Si. | Logica dentro de ronda monolitica. | `preventivePackageService.js` | migrado |
| Paquetes especiales | `iaas-system-runtime-2026-06-04.js:335` | Dispositivos/paquetes especiales. | Si. | Catalogo en runtime. | `preventivePackageService.js`, catalogos | migrado |
| Ronda por fecha | `iaas-system-runtime-2026-06-04.js:4057` | Renderizaba ronda diaria por fecha. | Si. | Cargaba panel completo y dependencias globales. | `modules/ronda-paquetes` | migrado |
| Mapa de camas | `iaas-system-runtime-2026-06-04.js:4290`, `bed-board-density-fix.js` | Tablero por servicio/cama con estados. | Si. | Re-render y parches de densidad DOM. | `modules/ronda-paquetes` | migrado |
| Navegacion anterior/siguiente cama | `iaas-system-runtime-2026-06-04.js:4435`, `preventive-round-workflow-hotfix-2026-06-02.js` | Guardar y saltar cama. | Si. | Antes dependia de DOM y hotfixes. | `ronda-paquetes` calculado desde datos | migrado |
| Guardado de ronda | `preventive-round-repair.js:577`, `preventive-round-workflow-hotfix-2026-06-02.js` | Guardaba entrada de ronda, pendientes y dispositivos. | Si. | Escribia secuencial y mutaba store local. | `roundService.saveRoundReview`, cola offline | migrado |
| Historial de ronda por paciente | `iaas-system-runtime-2026-06-04.js:12001`, `preventive-round-repair.js` | Mostraba historial diario y revisiones previas. | Si. | Podia leer todos los dias localmente. | `roundService.listRoundsForPatient`, expediente | migrado |
| Sesion de ronda | `README_EPIVIDA_LITE_REWORK.md` | Apertura/cierre de sesion diaria de ronda. | Si. | No existia como entidad limpia en legacy. | `round_sessions` | migrado |
| Pendientes y alertas | `iaas-system-runtime-2026-06-04.js:2431`, `:2512`, `:2522` | Notificaciones IAAS, riesgo, cultivos y pendientes. | Si. | Se calculaba sobre store global. | `snapshotService`, `monitorService` futuro | pendiente |
| Expediente del paciente | `iaas-system-runtime-2026-06-04.js`, `README.md` | Unia censo, dispositivos, rondas, IAAS y exportacion. | Si. | Lecturas historicas no paginadas. | `modules/expediente`, `expedienteService.js` | migrado |
| Reporte diario | `README.md`, `iaas-system-runtime-2026-06-04.js` | Exportaba censo, ronda, IAAS, dispositivos. | Si. | Exportadores dentro del runtime. | `modules/reportes`, `reportService.js` | migrado |
| Exportacion CSV | `README.md`, `iaas-system-runtime-2026-06-04.js` | Descarga CSV de datasets clinicos. | Si. | Riesgo de formulas si no se escapaba. | `exportService.js` | migrado |
| Exportacion XLSX | `README.md`, legacy import/export | Soporte de hojas de calculo. | Requiere decision clinica. | Libreria pesada si se carga al inicio. | `reportes` con import dinamico opcional | requiere decision clinica |
| Google Sheets sync | `README.md`, `epivida-iaas-sheets-preventive-hotfix-2026-05-18.js` | Sincronizaba con hojas `BASE_DATOS`, `RONDAS_IAAS`, `DISPOSITIVOS`. | Solo como export/import opcional. | Base principal no escalable y OAuth pesado. | `exportService`, `backupRestoreService` bajo demanda | reemplazado por arquitectura nueva |
| Offline mirror | `epivida-offline-storage-2026-06-03.js` | Espejaba localStorage a IndexedDB con historial y restauracion. | Si, la idea de resiliencia. | Interceptaba `Storage.prototype` y mantenia verdad local. | Firestore persistence, `offlineQueueService` | reemplazado por arquitectura nueva |
| Cola `writeQueue` | `iaas-system-runtime-2026-06-04.js`, hotfixes | Guardaba escrituras pendientes. | Si. | Cola local no tipada y mezclada con UI. | `offlineQueueService.js`, `sync_queue` | migrado |
| Service worker legacy | `epivida-service-worker.js` | Cacheaba app shell y soporte offline. | Solo estrategia minima. | Riesgo de cachear monolito/config/datos. | `epivida-lite-sw.js` | reemplazado por arquitectura nueva |
| Auditoria legacy | `iaas-system-runtime-2026-06-04.js:114`, `preventive-invasive-editor.js:154` | `auditLogs` para acciones de ronda/dispositivos. | Si, obligatorio. | Escribia en store/Sheets y podia editarse localmente. | `auditService.js`, `audit_logs` append-only | migrado |
| Dashboard visual | `iaas-system-runtime-2026-06-04.js:729`, CSS/assets pro | Superficies, fondos, logos y efectos. | No como visual. | Carga de WebP, CSS grande y render decorativo. | `inicio` minimo con snapshots | descartado por visual |
| Assets pro | `assets/epivida-pro/**` | Fondos, iconos, badges, logos y report watermark. | Solo favicon/logo minimo si se decide. | Pesan y no aportan operacion clinica. | `lite/assets` solo con hash futuro | descartado por visual |
| Reparaciones de contraste/densidad | `contrast-repair.css`, `bed-board-density-fix.js` | Hizo UI mas legible en tablets/movil. | Si, como requerimiento UX. | CSS global y querySelectorAll. | `base.css`, componentes Lite | reemplazado por arquitectura nueva |
| Date guard | `epivida-date-guard.js` | Evitaba rutas de ronda/seguimiento con fecha incorrecta. | Si. | Parche sobre hash y localStorage. | `date.js`, `ronda-paquetes` | migrado |
| Urgencias/AISP preloaders | `iaas-urgencias-aisp-system-preloader-2026-06-01.js`, `import-urgencias-aisp-fix-2026-06-01.js` | Ajustaba importacion y etiquetas de urgencias/AISP. | Requiere decision clinica. | Preloaders especificos y acoplados. | `importService`, catalogos | requiere decision clinica |
| OPD loader | `iaas-system-opd-loader-2026-05-20.js` | Cargaba vistas/ajustes OPD: direccion, telefono, inicio de sintomas, egreso, subido, alta, elegibilidad VIG/IAAS y notificaciones. | Si, como flujo operativo. | Loader extra con `eval`, parche de runtime y estado global. | `opdService.js`, `opdFields.js`, `censo`, `monitoreo`, `epi-iaas` | migrado |
| Backup/restauracion local | `epivida-offline-storage-2026-06-03.js` | Snapshot local de estado operativo. | Si, bajo control. | Puede restaurar datos obsoletos como verdad. | `reportService.buildOperationalBackup`, `backupRestoreService`, `admin` | migrado con drill pendiente |
| Firebase legacy rules | `firestore.rules` raiz | Reglas antiguas para modelo legacy. | No como destino. | No cubren modelo Lite y pueden confundir deploy. | `lite/firebase/firestore.rules` | reemplazado por arquitectura nueva |

## Decisiones De Migracion

- Todo lo clinico de censo, monitoreo, ronda, dispositivos, IAAS, cultivos, antimicrobianos, expediente, auditoria y reportes se migra como servicios Lite.
- Todo lo visual pesado, fondos WebP, hologramas, glassmorphism, parches de contraste globales y preloaders decorativos se descarta.
- Google Sheets queda solo como migracion/exportacion opcional bajo demanda, no como base principal.
- `localStorage` queda prohibido como fuente de verdad clinica. IndexedDB solo se usa como cache/cola offline controlada.
- Las consultas historicas se deben redisenar con `limit`, cursores, rangos de fecha e indices.
