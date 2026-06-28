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
| P0 | Mas fixtures reales anonimizados para conciliacion hospitalaria. | Confirma que las reglas ya migradas cubren formatos locales no vistos. | Ampliar bateria por formato real y mantener confirmacion antes de archivar. |
| P0 | Severidad/gravedad avanzada en monitoreo. | Priorizacion epidemiologica diaria. | `monitorService` con score local sobre pacientes activos y snapshots. |
| P0 | Cedulas IAAS con validacion clinica formal por tipo. | Evita clasificaciones incompletas. | Secciones IAAS lazy y reglas versionadas aprobadas. |
| P0 | Reportes historicos crudos por chunks/cursors. | Evita cargar historicos grandes en memoria. | Exportaciones por rango, lote, cursor y registro en `exports_log`. |
| P0 | Pruebas manuales multirol en Firebase real. | Confirma que reglas desplegadas coinciden con el archivo. | QA admin/epidemiologia/enfermeria/lectura con usuarios reales de prueba. |
| P1 | Timeline visual por episodio. | Facilita auditoria clinica de cambios. | Vista lazy por `episodeId` basada en `audit_logs`. |
| P1 | Drill Firebase real de restauracion JSON. | Recuperacion operativa ya tiene simulacro local automatizado; falta probar permisos, cola y rollback humano contra Firebase real. | Drill admin con datos anonimizados en Firebase de prueba. |
| P2 | QA de importacion masiva de catalogos con fuente oficial. | Cambios grandes de catalogos ya tienen importador controlado; falta validar fuente aprobada y permisos Firebase reales. | Drill admin con fuente oficial anonima/aprobada. |

## Avance 2026-06-16: Omisiones Cerradas En Codigo

| Prioridad | Omision cerrada | Implementacion Lite | Verificacion |
|---|---|---|---|
| P0 | Severidad/gravedad avanzada en monitoreo. | `monitorService.monitorSeverity()` calcula prioridad local por estado clinico, IAAS/riesgo, senales microbiologicas, area critica/aislamiento, invasivos inferidos desde texto, DEIH y OPD pendiente; `monitorSeveritySummary()` deja el motivo visible en `#/monitoreo-epidemiologico`; la pantalla conserva rangos de edad legacy, columnas edad/DEIH, orden por DEIH/estado/prioridad y filtro/conteo de etiquetas legacy IAAS/riesgo/no IAAS/vigilancia/COVID-Influenza/ESAVI/morbimortalidad, incluyendo combinaciones VIG + IAAS sin consultas adicionales. | `npm run validate:patients`; `npm run validate:lite`; `npm run validate:lite:qa`. |
| P0 | Reportes historicos crudos por chunks/cursors. | `reportService.pageHistoricalRows()` exporta bloques paginados por rango para rondas, IAAS archivadas, dispositivos archivados, cultivos, antimicrobianos, auditoria y exportaciones; `#/reportes` descarga el siguiente bloque sin listar historicos completos. | `npm run validate:lite`; `npm run validate:indexes`. |
| P0 | Snapshots mensual/anual sin historicos clinicos completos. | `reconciliationService` escribe `monthly_snapshots` y `yearly_snapshots` al guardar censo; `snapshotService` resume daily/monthly/yearly y `modules/reportes/snapshotExports.js` exporta diarios/mensuales/anuales en CSV/Excel bajo demanda. | `npm run validate:snapshots`; `npm run validate:lite`; `npm run validate:lite:qa`. |
| P1 | Exportacion Excel sin paquete pesado inicial. | `excelExportService` genera Open XML bajo demanda para censo activo, dispositivos, IAAS, cola pendiente, snapshots, cedulas preventivas y bloques historicos; protege formulas, serializa objetos y registra `export_excel`/`exports_log` sin importar librerias de hojas al inicio. | `npm run validate:lite:qa`; QA local `#/reportes` con descarga `epivida-censo-*.xlsx`. |
| P1 | UI completa de cultivos por caso. | `components/clinicalFollowUp.js` agrega/edita tipo, toma, resultado, microorganismo, susceptibilidad, estado y notas desde `#/epi-iaas`, usando `cultureService` y cola offline. | `npm run validate:lite`. |
| P1 | UI completa de antimicrobianos por caso. | `components/clinicalFollowUp.js` agrega/edita farmaco, inicio, fin, indicacion, estado y notas desde `#/epi-iaas`, usando `antimicrobialService` y cola offline. | `npm run validate:lite`. |
| P1 | Catalogos editables/versionados. | `catalogService` incluye semillas legacy ligeras, cache, cola offline y `saveCatalogEntry()`; `#/admin` permite crear, editar, activar/desactivar y versionar catalogos. | `npm run validate:lite`. |
| P2 | Importacion masiva controlada de catalogos. | `catalogService.parseCatalogImportText()` previsualiza CSV/TSV aprobado, valida tipos permitidos, normaliza camas como `servicio|cama`; `importCatalogEntries()` escribe lote limitado en `catalogs/*` con `importBatchId`, cola offline y auditoria `catalog_import`; `#/admin` expone previsualizacion, rechazados e importacion de aceptados. | `npm run validate:lite`; `npm run validate:lite:qa`; QA local `#/admin`. |
| P1 | Backup JSON controlado. | `exportService.downloadJson()` y `reportService.buildOperationalBackup()` generan respaldo operativo de censo activo, dispositivos activos, IAAS activas, catalogos, cola y snapshots acotados. | `npm run validate:lite`; `npm run validate:lite:qa`. |
| P1 | IAAS cerradas sin archivo dedicado. | `closeIaasCase()` ahora escribe `iaas_archive/{iaasId}` y expediente mezcla IAAS activas/cerradas por paciente con limite. | `npm run validate:lite`; `npm run validate:indexes`. |
| P1 | Expediente con secciones, detalle por evento, historial IAAS diario e impresion. | `modules/expediente/index.js` queda como orquestador liviano; `modules/expediente/panels.js` renderiza hero/resumen/tabs/timelines, `modules/expediente/print.js` prepara impresion local desde el expediente ya cargado, y `modules/expediente/eventPanels.js` concentra detalles desplegables, paginacion por cursor y acciones hacia modulos propietarios sin lecturas historicas globales. El expediente adjunta cultivos/antimicrobianos ya paginados por paciente a cada IAAS inicial y muestra un `Historial diario` compacto equivalente al historial de estudios legacy. | `npm run validate:lite`; `npm run validate:lite:qa`; QA local `#/pacientes/p_history/expediente`. |
| P1 | Busqueda avanzada sobre `patients_search`. | `patientService.patientSearchIndexData()` escribe indice minimo con nombre normalizado, `searchText`, `searchTokens`, servicio, cama, estado y diagnosticos; `#/censo` agrega busqueda explicita por indice sin consulta por tecla ni lectura de historicos completos. | `npm run validate:patients`; `npm run validate:lite`; QA local `#/censo`. |
| P1 | Camas conocidas completas fuera de Admin. | `catalogService` ahora siembra `known_beds` legacy completo; `roundHelpers` consume catalogos administrados y mezcla camas conocidas/ocupadas sin lecturas por cama; Admin edita servicio/cama. | `npm run validate:lite`; `npm run validate:round`. |
| P1 | Tablero agregado de cultivos/antimicrobianos. | `microbiologyDashboardService` consulta por estado con limite e indices existentes; `components/microbiologyDashboard.js` resume pendientes, resultados, positivos y antimicrobianos activos en `#/epi-iaas`. | `npm run validate:lite`. |
| P1 | Reglas finas de alerta microbiologica y antimicrobiana. | `microbiologyAlertService` centraliza positivos criticos, cultivos pendientes vencidos por tipo, cultivos negativos vinculados, antimicrobianos activos/ajustados/profilaxis, fin vencido, tratamiento prolongado, amplio espectro sin cultivo, timeout 48h, profilaxis prolongada y revision de desescalamiento por cultivo negativo; `operationalAlertService` y `microbiologyDashboardService` las consumen con consultas limitadas y priorizan accion clinica en Inicio. | `npm run validate:alerts`; `npm run validate:lite`; `npm run validate:lite:qa`; QA local `#/epi-iaas`. |
| P1 | Restauracion JSON administrativa. | `backupRestoreService` y `backupRestorePanel` previsualizan respaldo operativo, planean filas restaurables, omiten datasets no soportados, sanean IDs, escriben por `setDocMergeOrQueue` con `restoreRunId` y auditan el resultado. | `npm run validate:lite`; `npm run validate:lite:qa`. |
| P1 | Detalle editable de dispositivos retirados. | `saveArchivedDeviceEpisode()` actualiza `devices_archive/{episodeId}`; `#/dispositivos` carga historial por paciente y edita sin reactivar. | `npm run validate:lite`. |
| P1 | Reinstalacion guiada de dispositivos como nuevo episodio. | `#/dispositivos` prepara reinstalacion desde `devices_archive`, conserva tipo/subtipo/French/paquete/sitio, guarda un episodio activo nuevo con `previousEpisodeId`, `reinstallationOf`, `isReinstallation` y auditoria `device_reinstallation_create`. | `npm run validate:lite`. |
| P1 | Campos de ventilacion, tendencia, tabla diaria e historial de ediciones IAAS. | `iaasService.normalizeIaasClinicalFollowUp()` y `#/epi-iaas` conservan FiO2 y PEEP en `vitalSigns`; `clinicalTimeline` guarda snapshots ligeros del caso, `clinicalRevisionHistory` conserva las ediciones previas acotadas antes de sobrescribir, `iaasVitalTrendSeries()` muestra tendencia de temperatura, FC, FR, TA sistolica, SpO2, FiO2 y PEEP, y `iaasClinicalTimelineTable()` arma tabla diaria IAAS de vitales, ventilacion, laboratorio, plan, cultivos y antimicrobianos vinculados por `iaasId` sin leer historicos globales. Expediente reutiliza esa tabla para exponer el historial diario del caso en la tarjeta IAAS. | `npm run validate:lite`; `npm run validate:lite:qa`. |
| P1 | Auditoria reciente en Admin. | `auditService.listRecentAuditLogs()` y `adminAuditPanel` cargan `audit_logs` bajo demanda por usuario o modulo, usando indices existentes y sin listar auditoria global. | `npm run validate:lite`; `npm run validate:indexes`. |
| P0 | Cobertura exhaustiva de auditoria clinica. | `auditService.AUDIT_ACTION_CATALOG` clasifica eventos criticos de pacientes, censo, dispositivos, IAAS, rondas, microbiologia, catalogos, usuarios, reportes y restauracion con `auditCoverageVersion`, `auditDomain`, `auditOperation`, `auditSeverity` y `auditClinical`, sin agregar consultas ni peso inicial. | `npm run validate:lite`; `npm run validate:lite:qa`. |
| P1 | OPD sin loader legacy. | `opdService` reemplaza `iaas-system-opd-loader-2026-05-20.js`; Censo captura OPD para vigilancia/morbimortalidad y para COVID/Influenza o ESAVI cuando el paciente esta hospitalizado; EPI-IAAS captura OPD para IAAS confirmada y respeta exclusiones legacy de ambulatorio/hemodialisis/oncologia en Censo; Monitoreo muestra pendientes OPD sin consultas adicionales y el egreso manual de Censo normaliza tipo/fecha/turno legacy, completa fecha OPD elegible y deja `Alta OPD` pendiente cuando corresponde. Si el paciente ya esta archivado, Inicio y Monitoreo conservan el aviso desde `patients_archive.opdPending` con limite e indice Firestore, y Censo puede cerrar esa OPD sin reactivar al paciente. | `npm run validate:lite`; `npm run validate:lite:qa`; QA navegador desktop/movil `#/censo`. |
| P1 | Loader IAAS followup sin `eval`. | `legacyClinicalCatalogs` conserva el catalogo antimicrobiano/cultivos del loader `iaas-system-followup-loader-2026-05-20.js`; `iaasService` normaliza otros estudios como nombre/valor; `clinicalFollowUp` preserva Otro cultivo/Otro farmaco y expediente muestra estudios adicionales. | `npm run validate:lite`. |
| P0 | Cedulas IAAS con validacion de completitud. | `iaasCriteriaService` normaliza alias legacy (`ITS-CVC`, `ITU-CU`, NAV/NAVM, ISQ, COVID/Influenza), calcula `clinicalValidation` versionada por tipo y reconoce evidencia del seguimiento legacy `iaasAssessment` (cultivos, tratamientos, EGO, biometria, panel viral y seguimiento de infecciones/hemodialisis) sin cargar `iaas-system-runtime`; `#/seguimiento-iaas/FECHA/paciente/ID` abre directamente la IAAS del paciente o una cedula nueva prefijada; `iaasService` persiste `clinicalValidationStatus` y `#/epi-iaas` muestra semaforo/faltantes sin aumentar el modulo de ruta por encima del presupuesto. | `npm run validate:lite`; `npm run validate:lite:qa`; fixtures QA de ruta legacy por paciente, ITU con EGO/urocultivo legacy, COVID/Influenza con panel viral e ITS-CVC hemodialisis con `infectionTracking`. |
| P1 | Cedulas preventivas sin Sheets. | `preventiveCedulaService` reemplaza `iaas-system-cedulas-loader-2026-05-21.js` generando CSV diario ITS/ITU/NAVM/ISQ/P.E. y mensual por servicio desde `nursing_rounds`; `#/reportes` exporta bajo demanda con auditoria. | `npm run validate`; prueba QA del servicio con `epividaTest`. |
| P1 | Censo epidemiologico legacy sin Sheets. | `reportService.epidemiologicalCensusSummary()` y `epidemiologicalPrintReportModel()` con `modules/reportes/epidemiologicalExports.js` reemplazan las formulas legacy de `CONFIRMADOS INFLUENZA/COVID`, `ESAVIS`, riesgo/no IAAS, VIG transmisible/no transmisible y morbimortalidad con CSV/Excel y vista imprimible bajo demanda desde `patients_active`, sin cargar runtime ni hojas. | `npm run validate:lite`; `npm run validate:lite:qa`; QA navegador `#/reportes`. |
| P0 | Flujo preventivo ISQ/quirofano. | `preventivePackageService`, `preventiveForms`, `saveRoundFlow` y `patientRoundPanels` reemplazan `preventive-round-workflow-hotfix-2026-06-02.js`: pendientes sanitizados, `pendiente` explicito, autoconfirmacion sin invasivos y campo `surgeryRoom` estructurado en `nursing_rounds`. | `npm run validate:round`; `npm run validate:lite`. |
| P0 | Split dinamico de ronda principal. | `modules/ronda-paquetes/index.js` queda como entrypoint ligero y carga bajo demanda `roundPage.js` para mapa/lista o `patientRound.js` para paciente individual; `dischargeReviewPanel.js` separa altas por verificar para mantener `roundPage.js` bajo presupuesto normal, evitando arrastrar la lista completa cuando solo se abre una cama. | `npm run validate:lite`; QA local `#/ronda/2026-06-04` y `#/ronda/2026-06-04/paciente/p_history`. |
| P0 | Pendientes y alertas del runtime. | `operationalAlertService` reemplaza paneles de `iaas-system-runtime-2026-06-04.js` para altas por investigar, movimientos, rondas pendientes, dispositivos activos para vigilancia con dispositivo-dia diario, senales ISQ, IAAS/riesgo con invasivos, cultivos vencidos, OPD activa, Alta OPD archivada y sync, sin store global ni historicos completos; `#/inicio` muestra los avisos. | `npm run validate:alerts`; `npm run validate:lite`. |
| P1 | Tendencia operativa desde runtime central. | `snapshotService.snapshotTrend()` reemplaza `computeRangeStats(30)` del runtime con una ventana acotada de `daily_snapshots`: calcula deltas, picos y huecos de datos para `#/inicio` sin recorrer pacientes, rondas ni dispositivos historicos. | `npm run validate:snapshots`; `npm run validate:lite`. |
| P0 | Reparador legacy de importacion de censo. | `censusRepairService` reemplaza `import-census-repair.js` como servicio puro: detecta censos hospitalarios humanos, encabezados rotos, filas guia, filas continuadas, camas/servicios inferidos, fechas Excel, RFC/afiliacion, sector, edad neonatal/pediatrica, estados intubados, diagnosticos y observaciones; conserva DX ingreso + DX actual cuando vienen en columnas separadas; `importService` tambien acepta aliases tecnicos del runtime antiguo y fusiona observaciones/pendientes duplicados antes de normalizar; `reconciliationService` deja aviso visible de movimiento de cama/servicio, marca conflicto de mismo paciente en dos ubicaciones, conserva la fila mas completa, separa duplicados activos existentes para revision/auditoria, aplica altas automaticas legacy antes del censo completo y crea estancia hospitalaria acompanante sin mover registros protegidos de hemodialisis/oncologia. | `npm run validate:import`; `npm run validate:lite`; fixtures anonimizados de aliases legacy, movimientos, altas automaticas legacy, conflicto de ubicacion, duplicado activo existente, estancia protegida acompanante, pediatria/neonatos, GYO, Urgencias/AISP y CSV con comillas. |
| P0 | Importacion Excel de censo sin libreria pesada inicial. | `excelImportService` lee la primera hoja Open XML bajo demanda, descomprime localmente, resuelve shared strings y la convierte a TSV para reutilizar `importService`, `censusRepairService` y `reconciliationService` sin cargar dependencias de hojas de calculo en el arranque. | `node lite/tools/validate-census-import.mjs`; `npm run validate:performance`. |
| P0 | Fix de importacion Urgencias/AISP. | `censusRepairService.repairUrgenciasAisPImportText()` reemplaza `import-urgencias-aisp-fix-2026-06-01.js`: normaliza `AISLADO P` a `AIS P`, inserta contexto Urgencias, cose filas partidas y corrige orden legado fecha/RFC/edad antes del preview. | `npm run validate:import`; `npm run validate:lite`. |
| P0 | Conciliacion completa/parcial y altas reportadas. | `reconciliationService` reemplaza la parte critica de `buildImportPlanV2`: resuelve alcance automatico/completo/parcial, evita ausentes falsos en importaciones parciales, marca ausentes de censo completo como alta probable/revision, egresa automaticamente altas probables/reportadas antiguas y ambulatorios simples viejos antes del censo completo, conserva protegidos y detecta altas/egresos/defunciones/traslados reportados desde observaciones. `#/importar-censo` expone selector de modo, preview de altas reportadas y conteo de altas automaticas. | `node lite/tools/validate-census-import.mjs`; `npm run validate:lite`. |
| P0 | Preloader de tablero Urgencias/AISP. | `roundHelpers` y `catalogService` reemplazan `iaas-urgencias-aisp-system-preloader-2026-06-01.js`: `AIS-P`/`AISLADO P` se canonicaliza como `AIS P`, `patientService()` infiere `URGENCIAS` desde cama cuando el servicio legacy viene vacio y el mapa de Urgencias mantiene `AIS P` como cama conocida/vacia sin `eval` ni patchers globales. | `npm run validate:round`; `npm run validate:lite`. |
| P1 | Timeline visual por episodio de dispositivo. | `auditService.listAuditForEntity()` consulta `audit_logs` por `entityId` con limite, indice compuesto y cola offline; `#/dispositivos` agrega boton Timeline para activos e historicos sin listar auditoria global. | `npm run validate`; QA local con `d_cvc_history_removed`. |

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

EPIVIDA Lite es superior en arquitectura y rendimiento, pero no se debe vender como cierre total de paridad clinica. Reinstalacion de dispositivos, FiO2/PEEP, auditoria Admin y OPD base ya quedaron cerradas en codigo; la ruta correcta es continuar por bloques:

1. Ampliar fixtures anonimos reales de censo/conciliacion para validar formatos locales.
2. Cerrar IAAS avanzado por secciones y cedulas.
3. Cerrar reportes historicos por chunks.
4. Completar pruebas manuales multirol contra Firebase real.
5. Pasar a P1: cultivos, antimicrobianos, catalogos y backup controlado.

Cada bloque debe pasar `npm run validate`, `npm run audit:legacy` y, cuando toque interfaz, `npm run audit:interfaces`.
