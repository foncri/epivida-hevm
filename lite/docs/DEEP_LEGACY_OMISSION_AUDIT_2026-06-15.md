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
| P1 | UI completa de cultivos por caso/paciente. | Seguimiento microbiologico profundo. | Formulario lazy en IAAS/expediente sobre `cultures`. |
| P1 | UI completa de antimicrobianos por caso/paciente. | Seguimiento de tratamientos. | Formulario lazy y catalogo versionado sobre `antimicrobials`. |
| P1 | Catalogos editables/versionados. | Cambios operativos sin redeploy. | `catalogs` con cache, version, auditoria y Admin. |
| P1 | Backup JSON/restauracion controlada. | Recuperacion operativa. | `migrationService` auditado, solo admin, sin convertir JSON/local en verdad principal. |
| P1 | Detalle editable de episodios archivados. | Trazabilidad de dispositivos retirados. | Ruta/modal por `episodeId` bajo demanda. |

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
