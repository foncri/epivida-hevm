# EPIVIDA Lite Functional Parity Matrix

Fecha de corte: 2026-06-09

Esta matriz fija la paridad funcional esperada entre EPIVIDA antigua y EPIVIDA Lite. La columna "En Lite actual" describe el estado del codigo en `lite/` al momento del corte, no una garantia clinica final.

| Dominio | Feature antigua | En Lite actual | Brecha | Prioridad | Implementacion propuesta | Prueba |
|---|---|---|---|---|---|---|
| Auth | Login Google, dominio autorizado, persistencia y usuario activo. | `authService` usa `firebaseAuthRuntime`, popup con redirect fallback y perfil activo; bootstrap cliente retirado. | Falta verificar manualmente dominios Auth y flujo de provision por Admin/seed. | P0 | Mantener creacion de usuarios solo por Admin/seed controlado y auditar altas. | `npm run validate:security`; login admin; usuario no activo queda bloqueado. |
| Usuarios | Roles admin, epidemiologia, enfermeria y lectura. | `security.js`, `admin/index.js`, reglas `users`; `saveUserProfile` audita altas/cambios con before/after. | Falta vista de historial simple en Admin. | P1 | Mostrar ultimos `audit_logs` filtrados por usuario objetivo sin cargar auditoria global. | Cambiar rol en admin y verificar `audit_logs`. |
| Censo | Alta, edicion, egreso, cama, servicio, estado, sexo, DEIH, diagnosticos. | `modules/censo`, `patientService`, `patients_active`, `patients_archive`. | Falta conciliacion avanzada de traslados/egresos con decisiones clinicas finas. | P0 | Completar `reconciliationService` con reglas hospitalarias versionadas. | Fixture con nuevos, movidos, ausentes protegidos y egreso confirmado. |
| Importacion | Pegar Excel/Sheets/CSV, detectar encabezados, normalizar servicio/cama y preview. | `modules/importar-censo`, `importService` y `reconciliationService` parsean texto/CSV, infieren servicio desde cama (`AIS P`, `HEM`, `ONCO`, `UCIA`) y protegen ausentes de hemodialisis/oncologia/ambulatorio. | Falta soporte Excel dinamico opcional y mas fixtures hospitalarios anonimizados. | P0 | Endurecer reglas de importacion con fixtures hospitalarios por formato. | `node lite/tools/validate-census-import.mjs`; importar fixture CSV sin guardar automatico. |
| Monitoreo | Filtros por servicio, sexo, estado, diagnostico, busqueda y conteos. | `modules/monitoreo` usa `monitorService` para filtros, orden y metricas locales sobre pacientes activos; tabla paginada. | Falta gravedad avanzada y enlace con snapshots operativos. | P0 | Extender `monitorService` con gravedad y usar `daily_snapshots` para tendencias sin leer historicos. | 300 pacientes activos: filtro sin consulta por tecla; NO IAAS no cuenta como IAAS. |
| Ronda | Ronda por fecha, mapa de camas, paciente individual, guardar y siguiente. | `modules/ronda-paquetes` implementa flujo completo con cola offline; `bedBoard.js`, `patientRound.js`, `patientRoundPanels.js`, `preventiveForms.js`, `roundNavigation.js`, `saveRoundFlow.js`, `roundHelpers.js` y `roundPatientUtils.js` separan mapa, paciente individual, paneles, formularios, navegacion, guardado/drafts y logica pura. | Archivo principal aun concentra la pagina/lista principal de ronda. | P0 | Continuar split en `roundPage` si el modulo vuelve a crecer; medir en movil. | `npm run validate:round`; entrar a monitoreo no carga ronda. |
| Paquetes preventivos | CVC/ITS, ITU-CU, NAVM, ISQ, PE/PBMT, especiales, SI/NO/NA. | `preventivePackageService` y UI de ronda. | Reglas de ISQ y especiales deben pasar a catalogos/servicio. | P0 | Catalogos versionados y pruebas unitarias de paquetes. | Fixture de dispositivos activa paquetes correctos. |
| Dispositivos | Episodios, instalacion, retiro, sitio, French, curacion, infeccion. | `deviceService`, `modules/dispositivos`, uso en ronda; el retiro marca `devices_active` inactivo, escribe copia en `devices_archive` y expediente carga mas archivo por paciente con cursor. | Falta edicion avanzada del historial retirado y auditoria visual por episodio. | P1 | Completar detalle de episodio bajo demanda desde expediente/dispositivos. | Retiro crea `devices_archive/{episodeId}`, deja activo fuera de listados activos y visible en expediente; cargar mas no lee archivo global. |
| IAAS | Sospecha, confirmacion, tipo, estado, cierre, clasificacion IAAS/riesgo/no IAAS y relacion con dispositivos. | `iaasService`, `iaasCriteriaService` y `modules/epi-iaas`; el formulario captura criterios versionados, origen, vitales, labs, plan, cultivo y antimicrobiano inicial; guardar/cerrar IAAS sincroniza `patients_active` con `IAAS`, `RIESGO IAAS` o `NO IAAS` mediante `patientService` y auditoria; expediente lee IAAS por paciente sin cargar todo el hospital. | Falta UI avanzada por secciones, catalogo clinico editable y validacion clinica formal de cedulas. | P0 | Dividir seguimiento por secciones lazy y permitir catalogos versionados aprobados. | Crear/cerrar IAAS, aplicar cedula Lite, guardar `criteriaVersion`, vitales/labs/plan, verificar `patients_active.epidemiologicalDiagnosis` y reglas por rol. |
| Cultivos | Tipos de cultivo, resultados y alertas. | `cultureService` consulta por paciente/caso con limite y cola offline; expediente muestra cultivos del paciente. | Falta UI avanzada por caso, resultados seriados y filtros por estado. | P1 | Crear seccion lazy en IAAS/expediente con edicion y seguimiento. | Agregar cultivo a caso IAAS y verlo solo al abrir caso/paciente. |
| Antibioticos | Catalogo antimicrobiano, inicio, fin, indicacion. | `antimicrobialService` consulta por paciente/caso con limite y cola offline; expediente muestra antimicrobianos. | Falta catalogo, cierre/fin de tratamiento y filtros por estado. | P1 | Crear formulario bajo demanda y catalogo de farmacos. | Agregar antibiotico y verlo en expediente sin cargar todo el hospital. |
| Expediente | Vista por paciente con censos, rondas, dispositivos, IAAS y auditoria. | `modules/expediente` usa `expedienteService`; lee paciente por ID desde activo/archivo y expone carga incremental por seccion para rondas, `devices_archive`, IAAS, cultivos, antimicrobianos y auditoria. | Falta tabs/details para secciones muy extensas y detalle editable por evento. | P1 | Dividir secciones clinicas pesadas en detalles lazy y formularios por evento. | Abrir expediente no carga historicos globales; botones de cargar mas usan `patientId`, `limit` y cursor. |
| Reportes | Diario, censo, ronda, dispositivos, IAAS, CSV/XLSX/JSON. | `modules/reportes`, `exportService` CSV protegido/auditado, `exports_log` y `reportService` para snapshots diarios por rango acotado. | Falta chunking avanzado para historicos crudos y Excel dinamico opcional. | P0 | Extender `reportService` con cursores por coleccion historica aprobada. | Exportar CSV registra `exports_log`; XLSX no carga al inicio; snapshots por rango no listan historicos. |
| Auditoria | `auditLogs` para cambios clinicos y sync. | `auditService` append-only y reglas `audit_logs`. | Falta cobertura exhaustiva de todos los dominios. | P0 | Envolver acciones criticas con `writeAudit`. | Alta/edicion/egreso/dispositivo/IAAS/ronda generan log. |
| Offline | Mirror local, drafts, writeQueue, respaldo. | IndexedDB cache + `offlineQueueService`, Firestore persistence y `sync_blocked`. | Falta UX de restauracion/export JSON y retry por lote. | P1 | Admin muestra cola, reintento, limpieza bloqueada y backup controlado. | Simular permiso denegado y ver `sync_blocked`. |
| Exportacion | CSV, respaldo, Sheets opcional. | CSV protegido, sin XLSX inicial. | Falta export por rango con cursor y JSON backup. | P1 | `exportService` paginado y `migrationService` para backup. | Exportar rango de 30 dias sin cargar 1M. |
| Dashboard | Dashboard visual/operativo. | `inicio` usa snapshot minimo. | Falta snapshot diario robusto y metricas operativas. | P1 | `snapshotService` con `daily_snapshots`, mensual y anual. | Inicio lee un snapshot, no colecciones clinicas completas. |
| Catalogos | Servicios, camas, dispositivos, antimicrobianos, cultivos. | `catalogService` basico y constantes dispersas. | Falta normalizacion central y catalogos editables. | P1 | `catalogs` con cache y versionado; `normalize.js`. | Cambiar catalogo en Admin se refleja sin redeploy. |
| Rendimiento | App monolitica con todos los scripts. | `index.html` minimo, router dinamico, SW Lite, tablas paginadas. | Falta medir Cloudflare final y split de ronda. | P0 | Validadores de performance, Lighthouse y Network. | `#/monitoreo` no carga ronda, IAAS completo, reportes, XLSX ni legacy. |
| Seguridad | Reglas por rol, deletes bloqueados. | `lite/firebase/firestore.rules` exige usuario activo, roles, colecciones clinicas nuevas, snapshots y busqueda; `validate:security` bloquea bootstrap cliente. | Falta prueba manual por rol en Firebase real. | P0 | Ejecutar QA manual con usuarios enfermeria/epidemiologia/lectura/admin. | `npm run validate:security` y pruebas manuales por rol. |
| Escalabilidad | Store local completo. | Colecciones activas separadas de archive; expediente usa cursores por seccion historica y reportes leen snapshots acotados. | Falta busqueda avanzada limitada sobre `patients_search` y chunking historico aprobado para reportes crudos. | P0 | `patients_search`, snapshots y cursores por reportes historicos autorizados. | Validador de escalabilidad bloquea lecturas historicas globales. |

## Brechas P0

- Endurecer `#/importar-censo` con mas fixtures hospitalarios anonimizados por formato.
- Ampliar `reconciliationService` para excepciones clinicas locales restantes.
- Continuar split de `ronda-paquetes/index.js` solo si la pagina/lista principal vuelve a crecer; paciente individual, formularios, navegacion e historial ya viven en modulos dedicados.
- IAAS con UI avanzada de seguimiento por secciones y validacion clinica formal de cedulas versionadas.
- `reportService` con chunking avanzado para historicos crudos aprobados.
- Pruebas manuales por rol contra Firebase real para las nuevas colecciones clinicas.

## Brechas P1

- Cultivos y antimicrobianos completos.
- Catalogos editables.
- Snapshots mensuales/anuales.
- Backup JSON controlado.
- Exportacion Excel dinamica si se aprueba.

## Brechas P2

- Analitica avanzada.
- Graficas ligeras.
- Busqueda avanzada sobre `patients_search`.
- Limpieza final de legacy cuando Lite sea produccion.
