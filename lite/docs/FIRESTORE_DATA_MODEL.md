# EPIVIDA Lite Firestore Data Model

## Principios

- Firestore es la fuente de verdad clinica.
- `localStorage` no se usa como fuente de verdad.
- Los pacientes activos viven separados del historico.
- Toda lectura historica debe usar rango, pagina, cursor e indice.
- Deletes clinicos estan bloqueados; se archiva.
- La cola offline debe serializar escrituras concurrentes para no perder operaciones paralelas de importacion, ronda o dispositivos.

## Colecciones Principales

| Coleccion | Proposito | Lectura esperada |
|---|---|---|
| `users` | Perfiles, roles y usuarios activos. | Por UID; list solo admin. |
| `patients_active` | Pacientes hospitalizados activos. | Lista activa y filtros operativos. |
| `patients_archive` | Historico de egresos/archivos. | Solo por rango/cursor/busqueda; excepcion acotada `opdPending == true` + `archivedAt desc` para Alta OPD pendiente. |
| `patients_search` | Indice minimo de busqueda. | `searchTokens array-contains`, nombre normalizado, servicio/cama/estado/diagnostico y limite. |
| `census_days` | Snapshot diario de importacion/conciliacion, alcance completo/parcial y conteos de revision. | Por fecha. |
| `census_days/{date}/patients` | Pacientes observados ese dia y filas de conciliacion `present:false` para ausentes de censo completo. | Por fecha y pagina. |
| `nursing_rounds` | Revisiones diarias por paciente. | Por fecha/paciente. |
| `round_sessions` | Estado de sesion de ronda. | Por fecha. |
| `devices_active` | Episodios de dispositivos activos. | Por paciente, tipo, servicio. |
| `devices_archive` | Dispositivos retirados. | Por paciente o fecha de retiro. |
| `iaas_active` | Casos IAAS activos. | Por paciente, servicio, tipo, estado. |
| `iaas_archive` | Casos IAAS cerrados. | Por paciente o fecha de cierre. |
| `cultures` | Cultivos por paciente/caso. | Por paciente, IAAS o estado. |
| `antimicrobials` | Antimicrobianos por paciente/caso. | Por paciente, IAAS o estado. |
| `daily_snapshots` | Agregados diarios operativos. | Documento por fecha. |
| `monthly_snapshots` | Agregados mensuales. | Documento por mes. |
| `audit_logs` | Auditoria append-only. | Por usuario, paciente, modulo o fecha. |
| `catalogs` | Servicios, camas, paquetes y opciones clinicas. | Cacheado. |
| `sync_queue` | Cola remota opcional por usuario. | Solo usuario propio. |
| `exports_log` | Auditoria de exportaciones. | Por usuario/fecha. |
| `migration_logs` | Trazabilidad de migraciones. | Admin. |

## Documentos Clave

`patients_active/{patientId}` debe contener identidad operativa, ubicacion, diagnosticos, estado, resumen de antibioticos/cultivos/dispositivos/IAAS, pendientes, timestamps y usuario de cambio. La conciliacion de censo puede agregar `lastCensusDate`, `presentInLatestCensus`, `reconciliationRequired`, `probableDischarge`, `dischargeReviewRequired`, `hospitalizationStatus` (`alta_reportada` o `alta_probable`) y `reconciliationReason`.

`patients_search/{patientId}` debe contener solo el indice operativo minimo para busqueda: `patientId`, `name`, `normalizedName`, `service`, `bed`, `sex`, `status`, `active`, diagnostico/resumen clinico acotado, `searchText`, `searchTokens`, `updatedAt` y metadatos de ultimo censo cuando aplique. Censo lo consulta por `searchTokens array-contains` y luego filtra localmente el resultado limitado; no debe guardar historiales clinicos crudos ni reemplazar `patients_active`/`patients_archive`.

`census_days/{date}` debe guardar `importScope`, `preserveExistingPatients`, `importedPatients`, `reconciliationPatients`, `reportedDischarges`, `probableDischarges`, `hash` y `reconciliationStatus`. En importaciones parciales no debe generar ausentes falsos.

`census_days/{date}/patients/{patientId}` conserva el snapshot del paciente importado o la fila de conciliacion. Las filas de conciliacion usan `present:false`, `reconciliationRequired:true`, `reconciliationStatus:"requires_review"` y no reemplazan por si solas un egreso confirmado.

`patients_archive/{patientId}` debe conservar los campos activos mas egreso, razon, ultima ubicacion, rango historico y usuario de archivo. Tambien guarda `opdPending`, `opdStatusLabel` y `opdStatusDetail` para que Inicio/Monitoreo sigan mostrando Alta OPD pendiente despues del egreso sin listar historicos completos.

`devices_active/{episodeId}` debe representar un episodio activo. Un retiro crea o actualiza `devices_archive` y saca el episodio de activos.

`nursing_rounds/{roundId}` debe tener fecha, paciente, servicio, cama, estado, revisiones de paquetes, pendientes, notas, usuario y timestamps.

`iaas_active/{iaasId}` debe representar caso activo con tipo, estado, fecha de sospecha/confirmacion, criterios, cultivos, antimicrobianos, seguimiento, `labs.customStudies` para otros estudios nombre/valor y relacion con dispositivos. Cada guardado agrega `clinicalValidation`, `clinicalValidationStatus` y `clinicalValidationVersion` derivados de la cedula IAAS versionada para detectar faltantes criticos sin leer cultivos/antimicrobianos globales. Tambien conserva `clinicalTimeline` como arreglo acotado de snapshots clinicos del propio caso para graficar tendencias de signos vitales sin consultar historicos globales y `clinicalRevisionHistory` como arreglo acotado de ediciones previas antes de sobrescribir un seguimiento IAAS. Expediente reconstruye el historial diario IAAS adjuntando los cultivos y antimicrobianos ya paginados por `patientId` y cruzados por `iaasId`, sin listar colecciones hospitalarias completas. La validacion acepta evidencia normalizada nueva y evidencia heredada `iaasAssessment` cuando exista: `cultures`, `treatments`, `urinalysis`, `cbc`, `otherStudies.viralPanel` e `infectionTracking`.

`cultures/{cultureId}` y `antimicrobials/{antimicrobialId}` se consultan por paciente, caso IAAS o estado con limite. Las alertas clinicas se derivan en cliente desde resultados acotados: cultivos pendientes/vencidos, positivos criticos, negativos vinculados, antimicrobianos activos/ajustados/profilaxis, fin vencido, timeout de 48h, profilaxis prolongada, amplio espectro sin cultivo vinculado y revision de desescalamiento por cultivo negativo. No se guarda una coleccion global de alertas microbiologicas.

`daily_snapshots/{date}` resume el dia con `totalActivePatients`, `totalImportedPatients`, `totalReconciliationPatients`, `patientsByService`, `reportedDischarges` y `probableDischarges` para Inicio/Reportes sin recorrer pacientes historicos.

`monthly_snapshots/{YYYY-MM}` conserva `latest`, `dailyMetrics.{date}`, `lastSnapshotDate` y `lastUpdatedAt` para exportacion mensual y dashboard. Se actualiza al guardar censo y no guarda listas crudas de pacientes.

`yearly_snapshots/{YYYY}` conserva `latest`, `monthlyMetrics.{YYYY-MM}`, `lastSnapshotDate` y `lastUpdatedAt` para exportacion anual y dashboard. Se actualiza al guardar censo y no guarda listas crudas de pacientes.

`exports_log/{exportId}` registra exportaciones CSV, Excel y JSON con `filename`, `dataset`, `format`, `rows`, usuario, rol y metadatos de rango/bloque. No contiene credenciales ni reemplaza la auditoria append-only en `audit_logs`.

La restauracion administrativa de un respaldo JSON escribe solo datasets aprobados (`patients_active`, `devices_active`, `iaas_active`, `catalogs`, `daily_snapshots`) y marca cada documento restaurado con `restoredAt`, `restoredBy`, `restoreRunId`, `restoredFromBackupSchema` y `restoredFromBackupCreatedAt`.

`catalogs/{catalogId}` guarda catalogos clinicos versionados. Las cargas masivas administrativas agregan `source:"admin_catalog_import"`, `importBatchId`, `updatedAt`, `updatedBy` y conservan IDs deterministas; las camas conocidas usan `type:"known_beds"`, `service`, `bed` y `value:"SERVICIO|CAMA"`.

`audit_logs/{logId}` es append-only. No se actualiza ni se borra. Cada registro nuevo agrega `auditCoverageVersion`, `auditDomain`, `auditOperation`, `auditSeverity` y `auditClinical` para clasificar eventos criticos de pacientes, censo, dispositivos, IAAS, rondas, microbiologia, catalogos, usuarios, reportes y restauracion. Las vistas clinicas deben consultarlo con filtros acotados por `patientId`, `module`, `userId` o `entityId`; el timeline de dispositivos usa `entityId + createdAt` para no listar auditoria global.

## Indices

Los indices compuestos obligatorios viven en `lite/firebase/firestore.indexes.json`, incluyendo `patients_archive(opdPending asc, archivedAt desc)` para la cola acotada de Alta OPD pendiente. Las consultas de un solo campo usan indices automaticos de Firestore y se documentan en `ONE_MILLION_PATIENT_STRATEGY.md`.
