# EPIVIDA Deep Legacy Omission Audit

Fecha: 2026-06-15
Rama: `feature/epivida-lite-ultrafast-rework`
App destino: `lite/`

## Alcance De Esta Fase

Esta fase no declara paridad total. Su objetivo fue convertir el reclamo de "faltan demasiadas cosas" en evidencia reproducible, lista de omisiones y una primera migracion P0 comprobada.

Se reviso la raiz legacy como superficie funcional, no como codigo para copiar. La regla se mantiene: cada regla clinica util debe migrarse a Lite como servicio/modulo pequeno, con Firestore, auditoria y carga por ruta. El monolito, `FULL_SCRIPTS`, `FULL_STYLES`, Google Sheets como base principal y `localStorage` como verdad clinica siguen prohibidos.

## Evidencia Automatizada

Comando nuevo:

```bash
npm run audit:legacy
```

Resumen del barrido de raiz legacy:

| Metrica | Valor |
|---|---:|
| Archivos legacy revisados | 55 |
| JavaScript legacy | 42 |
| CSS legacy | 10 |
| Bytes legacy analizados | 1874997 |
| Lineas legacy analizadas | 44862 |
| Funciones detectadas | 2087 |

Archivos legacy de mayor peso:

| Archivo | KB | Lineas | Dictamen |
|---|---:|---:|---|
| `iaas-system-runtime-2026-06-04.js` | 552.4 | 12085 | Monolito clinico principal; solo sirve como fuente de reglas. |
| `iaas-system.js` | 534.6 | 11851 | Variante monolitica; no debe entrar a Lite. |
| `iaas-system.css` | 197.1 | 9108 | CSS pesado global; no debe entrar a Lite. |
| `preventive-packages-enhancement-2026-06-01.js` | 32.4 | 368 | Reglas utiles de paquetes, pero acopladas a legacy. |
| `preventive-round-repair.js` | 31.0 | 759 | Correcciones reales de ronda, pero con DOM/global state. |
| `hospital-bed-service-normalizer-2026-06-02.js` | 28.7 | 582 | Normalizacion util de servicios/camas. |
| `import-census-repair.js` | 27.1 | 589 | Reglas utiles de importacion y reparacion de censo. |

Rutas legacy detectadas:

| Ruta legacy | Destino Lite |
|---|---|
| `#/dashboard` | `#/inicio` |
| `#/monitoreo-epidemiologico` | `#/monitoreo-epidemiologico` |
| `#/censo-hospitalario` | `#/censo` |
| `#/importar-censo` | `#/importar-censo` |
| `#/ronda` | `#/ronda-paquetes` |
| `#/seguimiento-iaas` | `#/epi-iaas` |
| `#/reporte-diario` | `#/reportes` |
| `#/pacientes/:patientId/expediente` | `#/pacientes/:patientId/expediente` y `#/expediente/:patientId` |

## Omisiones Confirmadas Que Siguen Abiertas

| Prioridad | Omision | Motivo Clinico | Implementacion Correcta En Lite |
|---|---|---|---|
| P0 | Conciliacion hospitalaria avanzada para censo real anonimo. | Evita egresos o traslados incorrectos. | Mas fixtures por formato, reglas versionadas y confirmacion antes de archivar. |
| P0 | Severidad/gravedad avanzada en monitoreo. | Priorizacion epidemiologica diaria. | `monitorService` con score local sobre pacientes activos y snapshots. |
| P0 | Cedulas IAAS con validacion clinica formal por tipo. | Evita clasificaciones incompletas. | Secciones IAAS lazy y reglas versionadas aprobadas. |
| P0 | Reportes historicos crudos por chunks/cursors. | Evita cargar historicos grandes en memoria. | Exportaciones por rango, lote, cursor y registro en `exports_log`. |
| P0 | Pruebas manuales multirol en Firebase real. | Confirma que reglas desplegadas coinciden con el archivo. | QA admin/epidemiologia/enfermeria/lectura con usuarios reales de prueba. |
| P1 | Reinstalacion guiada de dispositivos como nuevo episodio. | Evita reactivar historicos retirados y conserva trazabilidad. | Accion explicita desde historial que cree un episodio activo nuevo. |
| P1 | Timeline visual por episodio. | Facilita auditoria clinica de cambios. | Vista lazy por `episodeId` basada en `audit_logs`. |
| P1 | Simulacro real de restauracion JSON. | Recuperacion operativa debe probar permisos, cola y rollback humano. | Drill admin con datos anonimizados en Firebase de prueba. |
| P2 | Importacion masiva de catalogos aprobados. | Cambios grandes de catalogos sin captura manual. | Import controlado solo cuando exista fuente clinica aprobada. |

## Avance 2026-06-16: Omisiones Cerradas En Codigo

| Prioridad | Omision cerrada | Implementacion Lite | Verificacion |
|---|---|---|---|
| P0 | Severidad/gravedad avanzada en monitoreo. | `monitorService.monitorSeverity()` calcula prioridad local por estado clinico, IAAS/riesgo, senales microbiologicas y DEIH; `#/monitoreo-epidemiologico` agrega filtro y orden por prioridad. | `npm run validate:lite`; `npm run validate:lite:qa`. |
| P0 | Reportes historicos crudos por chunks/cursors. | `reportService.pageHistoricalRows()` exporta bloques paginados por rango para rondas, IAAS archivadas, dispositivos archivados, cultivos, antimicrobianos, auditoria y exportaciones; `#/reportes` descarga el siguiente bloque sin listar historicos completos. | `npm run validate:lite`; `npm run validate:indexes`. |
| P1 | UI completa de cultivos por caso. | `components/clinicalFollowUp.js` agrega/edita tipo, toma, resultado, microorganismo, susceptibilidad, estado y notas desde `#/epi-iaas`, usando `cultureService` y cola offline. | `npm run validate:lite`. |
| P1 | UI completa de antimicrobianos por caso. | `components/clinicalFollowUp.js` agrega/edita farmaco, inicio, fin, indicacion, estado y notas desde `#/epi-iaas`, usando `antimicrobialService` y cola offline. | `npm run validate:lite`. |
| P1 | Catalogos editables/versionados. | `catalogService` incluye semillas legacy ligeras, cache, cola offline y `saveCatalogEntry()`; `#/admin` permite crear, editar, activar/desactivar y versionar catalogos. | `npm run validate:lite`. |
| P1 | Backup JSON controlado. | `exportService.downloadJson()` y `reportService.buildOperationalBackup()` generan respaldo operativo de censo activo, dispositivos activos, IAAS activas, cola y snapshots acotados. | `npm run validate:lite`. |
| P1 | IAAS cerradas sin archivo dedicado. | `closeIaasCase()` ahora escribe `iaas_archive/{iaasId}` y expediente mezcla IAAS activas/cerradas por paciente con limite. | `npm run validate:lite`; `npm run validate:indexes`. |
| P1 | Camas conocidas completas fuera de Admin. | `catalogService` ahora siembra `known_beds` legacy completo; `roundHelpers` consume catalogos administrados y mezcla camas conocidas/ocupadas sin lecturas por cama; Admin edita servicio/cama. | `npm run validate:lite`; `npm run validate:round`. |
| P1 | Tablero agregado de cultivos/antimicrobianos. | `microbiologyDashboardService` consulta por estado con limite e indices existentes; `components/microbiologyDashboard.js` resume pendientes, resultados, positivos y antimicrobianos activos en `#/epi-iaas`. | `npm run validate:lite`. |
| P1 | Restauracion JSON administrativa. | `backupRestoreService` y `backupRestorePanel` previsualizan respaldo operativo, seleccionan datasets activos restaurables y escriben por `setDocMergeOrQueue` con auditoria. | `npm run validate:lite`. |
| P1 | Detalle editable de dispositivos retirados. | `saveArchivedDeviceEpisode()` actualiza `devices_archive/{episodeId}`; `#/dispositivos` carga historial por paciente y edita sin reactivar. | `npm run validate:lite`. |

## Omision P0 Migrada En Esta Fase

Legacy tenia dos hotfixes para sincronizar la clasificacion epidemiologica entre seguimiento IAAS, monitoreo y ronda:

- `epivida-iaas-monitor-sync-hotfix-2026-05-18.js`
- `epivida-iaas-sheets-preventive-hotfix-2026-05-18.js`

Problema en Lite antes de esta fase:

- El caso IAAS podia guardarse, pero la clasificacion del paciente activo no quedaba garantizada como verdad visible para monitoreo/ronda.

Implementacion Lite agregada:

- `iaasService.patientClassificationForIaasStatus(status)` normaliza:
  - `confirmada` -> `IAAS`
  - `sospecha`/`probable` -> `RIESGO IAAS`
  - `descartada`/`closed` -> `NO IAAS`
- `iaasService.saveIaasCase()` sincroniza el paciente despues de guardar el caso.
- `iaasService.closeIaasCase()` recalcula la clasificacion restante del paciente antes de marcarlo como `NO IAAS`.
- `patientService.syncPatientIaasClassification()` escribe `patients_active/{patientId}` con `epidemiologicalDiagnosis`, `currentEpidemiologicalDiagnosis` e `iaasSummary`.
- La sincronizacion escribe auditoria con `actionType: patient_iaas_classification_sync`.
- La UI de `#/epi-iaas` informa si la IAAS y la clasificacion del paciente quedaron sincronizadas o pendientes offline.

## Protecciones Agregadas

| Validador | Proteccion |
|---|---|
| `validate-lite` | Falla si `iaasService` no contiene sincronizacion de clasificacion IAAS-paciente. |
| `validate-lite` | Falla si `patientService` no expone sincronizacion auditada hacia `patients_active`. |
| `validate-local-qa` | Verifica `confirmada`, `sospecha` y `descartada` contra `IAAS`, `RIESGO IAAS`, `NO IAAS`. |
| `validate-local-qa` | Verifica que guardar una IAAS en modo QA encole sincronizacion de `patients_active`. |
| `validate-all` | Incluye sintaxis de `audit-legacy-surface.mjs`. |

## Estado Real

EPIVIDA Lite es superior en arquitectura y rendimiento, pero no se debe vender como cierre total de paridad clinica. La ruta correcta es continuar por bloques:

1. Cerrar P0 de censo/conciliacion con fixtures anonimos reales.
2. Cerrar IAAS avanzado por secciones y cedulas.
3. Cerrar reportes historicos por chunks.
4. Completar pruebas manuales multirol contra Firebase real.
5. Pasar a P1: cultivos, antimicrobianos, catalogos y backup controlado.

Cada bloque debe pasar `npm run validate`, `npm run audit:legacy` y, cuando toque interfaz, `npm run audit:interfaces`.
