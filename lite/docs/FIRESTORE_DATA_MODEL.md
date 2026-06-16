# EPIVIDA Lite Firestore Data Model

## Principios

- Firestore es la fuente de verdad clinica.
- `localStorage` no se usa como fuente de verdad.
- Los pacientes activos viven separados del historico.
- Toda lectura historica debe usar rango, pagina, cursor e indice.
- Deletes clinicos estan bloqueados; se archiva.

## Colecciones Principales

| Coleccion | Proposito | Lectura esperada |
|---|---|---|
| `users` | Perfiles, roles y usuarios activos. | Por UID; list solo admin. |
| `patients_active` | Pacientes hospitalizados activos. | Lista activa y filtros operativos. |
| `patients_archive` | Historico de egresos/archivos. | Solo por rango/cursor/busqueda. |
| `patients_search` | Indice minimo de busqueda. | Tokens, nombre normalizado, servicio/cama. |
| `census_days` | Snapshot diario de importacion/conciliacion. | Por fecha. |
| `census_days/{date}/patients` | Pacientes observados ese dia. | Por fecha y pagina. |
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

`patients_active/{patientId}` debe contener identidad operativa, ubicacion, diagnosticos, estado, resumen de antibioticos/cultivos/dispositivos/IAAS, pendientes, timestamps y usuario de cambio.

`patients_archive/{patientId}` debe conservar los campos activos mas egreso, razon, ultima ubicacion, rango historico y usuario de archivo.

`devices_active/{episodeId}` debe representar un episodio activo. Un retiro crea o actualiza `devices_archive` y saca el episodio de activos.

`nursing_rounds/{roundId}` debe tener fecha, paciente, servicio, cama, estado, revisiones de paquetes, pendientes, notas, usuario y timestamps.

`iaas_active/{iaasId}` debe representar caso activo con tipo, estado, fecha de sospecha/confirmacion, criterios, cultivos, antimicrobianos, seguimiento, `labs.customStudies` para otros estudios nombre/valor y relacion con dispositivos.

`audit_logs/{logId}` es append-only. No se actualiza ni se borra.

## Indices

Los indices compuestos obligatorios viven en `lite/firebase/firestore.indexes.json`. Las consultas de un solo campo usan indices automaticos de Firestore y se documentan en `ONE_MILLION_PATIENT_STRATEGY.md`.
