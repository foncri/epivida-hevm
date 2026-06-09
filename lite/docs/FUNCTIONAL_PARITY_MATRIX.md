# EPIVIDA Lite Functional Parity Matrix

Fecha de corte: 2026-06-09

Esta matriz fija la paridad funcional esperada entre EPIVIDA antigua y EPIVIDA Lite. La columna "En Lite actual" describe el estado del codigo en `lite/` al momento del corte, no una garantia clinica final.

| Dominio | Feature antigua | En Lite actual | Brecha | Prioridad | Implementacion propuesta | Prueba |
|---|---|---|---|---|---|---|
| Auth | Login Google, dominio autorizado, persistencia y usuario activo. | `authService` usa `firebaseAuthRuntime`, popup con redirect fallback y perfil activo; bootstrap cliente retirado. | Falta verificar manualmente dominios Auth y flujo de provision por Admin/seed. | P0 | Mantener creacion de usuarios solo por Admin/seed controlado y auditar altas. | `npm run validate:security`; login admin; usuario no activo queda bloqueado. |
| Usuarios | Roles admin, epidemiologia, enfermeria y lectura. | `security.js`, `admin/index.js`, reglas `users`. | Falta auditoria de cambios de rol mas completa. | P0 | Auditar `saveUserProfile` con before/after y mostrar historial simple. | Cambiar rol en admin y verificar `audit_logs`. |
| Censo | Alta, edicion, egreso, cama, servicio, estado, sexo, DEIH, diagnosticos. | `modules/censo`, `patientService`, `patients_active`, `patients_archive`. | Falta conciliacion avanzada de pacientes movidos/ausentes desde importacion. | P0 | Implementar `importar-censo` + `reconciliationService`. | Fixture con nuevos, movidos, ausentes y egreso confirmado. |
| Importacion | Pegar Excel/Sheets/CSV, detectar encabezados, normalizar servicio/cama y preview. | `modules/importar-censo`, `importService` y `reconciliationService` parsean texto/CSV, generan preview y guardan solo tras confirmacion. | Falta conciliacion clinica avanzada para excepciones locales y soporte Excel dinamico opcional. | P0 | Endurecer reglas de importacion con fixtures hospitalarios y split por casos especiales. | `npm run validate:import`; importar fixture CSV sin guardar automatico. |
| Monitoreo | Filtros por servicio, sexo, estado, diagnostico, busqueda y conteos. | `modules/monitoreo` filtra localmente pacientes activos y pagina tabla. | Falta servicio `monitorService` para snapshots/metricas y gravedad. | P0 | Extraer metricas a `monitorService` y usar `daily_snapshots` para dashboard. | 300 pacientes activos: filtro sin consulta por tecla. |
| Ronda | Ronda por fecha, mapa de camas, paciente individual, guardar y siguiente. | `modules/ronda-paquetes` implementa flujo completo con cola offline; `bedBoard.js`, `patientRound.js`, `patientRoundPanels.js`, `preventiveForms.js`, `roundNavigation.js`, `saveRoundFlow.js`, `roundHelpers.js` y `roundPatientUtils.js` separan mapa, paciente individual, paneles, formularios, navegacion, guardado/drafts y logica pura. | Archivo principal aun concentra la pagina/lista principal de ronda. | P0 | Continuar split en `roundPage` si el modulo vuelve a crecer; medir en movil. | `npm run validate:round`; entrar a monitoreo no carga ronda. |
| Paquetes preventivos | CVC/ITS, ITU-CU, NAVM, ISQ, PE/PBMT, especiales, SI/NO/NA. | `preventivePackageService` y UI de ronda. | Reglas de ISQ y especiales deben pasar a catalogos/servicio. | P0 | Catalogos versionados y pruebas unitarias de paquetes. | Fixture de dispositivos activa paquetes correctos. |
| Dispositivos | Episodios, instalacion, retiro, sitio, French, curacion, infeccion. | `deviceService`, `modules/dispositivos`, uso en ronda; el retiro marca `devices_active` inactivo, escribe copia en `devices_archive` y `expedienteService` lee archivo por paciente con limite. | Falta UI de paginacion/next page para historico largo. | P0 | Ampliar expediente con paginacion por seccion y cursores visibles. | Retiro crea `devices_archive/{episodeId}`, deja activo fuera de listados activos y visible en expediente. |
| IAAS | Sospecha, confirmacion, tipo, estado, cierre y relacion con dispositivos. | `iaasService`, `modules/epi-iaas`; el formulario puede adjuntar cultivo y antimicrobiano inicial y expediente lee IAAS por paciente sin cargar todo el hospital. | Falta seguimiento por secciones y criterios heredados. | P0 | Expandir `iaasService` con criterios, origen, followUp y relacion device. | Crear/cerrar IAAS y verificar reglas por rol. |
| Cultivos | Tipos de cultivo, resultados y alertas. | `cultureService` consulta por paciente/caso con limite y cola offline; expediente muestra cultivos del paciente. | Falta UI avanzada por caso, resultados seriados y filtros por estado. | P1 | Crear seccion lazy en IAAS/expediente con edicion y seguimiento. | Agregar cultivo a caso IAAS y verlo solo al abrir caso/paciente. |
| Antibioticos | Catalogo antimicrobiano, inicio, fin, indicacion. | `antimicrobialService` consulta por paciente/caso con limite y cola offline; expediente muestra antimicrobianos. | Falta catalogo, cierre/fin de tratamiento y filtros por estado. | P1 | Crear formulario bajo demanda y catalogo de farmacos. | Agregar antibiotico y verlo en expediente sin cargar todo el hospital. |
| Expediente | Vista por paciente con censos, rondas, dispositivos, IAAS y auditoria. | `modules/expediente` usa `expedienteService`; lee paciente por ID desde activo/archivo, mezcla dispositivos activos, primera pagina de `devices_archive`, IAAS, cultivos y antimicrobianos por paciente. | Falta carga bajo demanda por tabs y paginacion visible de rondas/auditoria/IAAS historicas. | P0 | Ampliar `expedienteService` con cursores por seccion y auditoria filtrada. | Abrir expediente no carga historicos globales ni archivos sin filtro. |
| Reportes | Diario, censo, ronda, dispositivos, IAAS, CSV/XLSX/JSON. | `modules/reportes`, `exportService` CSV protegido/auditado, `exports_log` y `reportService` para snapshots diarios por rango acotado. | Falta chunking avanzado para historicos crudos y Excel dinamico opcional. | P0 | Extender `reportService` con cursores por coleccion historica aprobada. | Exportar CSV registra `exports_log`; XLSX no carga al inicio; snapshots por rango no listan historicos. |
| Auditoria | `auditLogs` para cambios clinicos y sync. | `auditService` append-only y reglas `audit_logs`. | Falta cobertura exhaustiva de todos los dominios. | P0 | Envolver acciones criticas con `writeAudit`. | Alta/edicion/egreso/dispositivo/IAAS/ronda generan log. |
| Offline | Mirror local, drafts, writeQueue, respaldo. | IndexedDB cache + `offlineQueueService`, Firestore persistence y `sync_blocked`. | Falta UX de restauracion/export JSON y retry por lote. | P1 | Admin muestra cola, reintento, limpieza bloqueada y backup controlado. | Simular permiso denegado y ver `sync_blocked`. |
| Exportacion | CSV, respaldo, Sheets opcional. | CSV protegido, sin XLSX inicial. | Falta export por rango con cursor y JSON backup. | P1 | `exportService` paginado y `migrationService` para backup. | Exportar rango de 30 dias sin cargar 1M. |
| Dashboard | Dashboard visual/operativo. | `inicio` usa snapshot minimo. | Falta snapshot diario robusto y metricas operativas. | P1 | `snapshotService` con `daily_snapshots`, mensual y anual. | Inicio lee un snapshot, no colecciones clinicas completas. |
| Catalogos | Servicios, camas, dispositivos, antimicrobianos, cultivos. | `catalogService` basico y constantes dispersas. | Falta normalizacion central y catalogos editables. | P1 | `catalogs` con cache y versionado; `normalize.js`. | Cambiar catalogo en Admin se refleja sin redeploy. |
| Rendimiento | App monolitica con todos los scripts. | `index.html` minimo, router dinamico, SW Lite, tablas paginadas. | Falta medir Cloudflare final y split de ronda. | P0 | Validadores de performance, Lighthouse y Network. | `#/monitoreo` no carga ronda, IAAS completo, reportes, XLSX ni legacy. |
| Seguridad | Reglas por rol, deletes bloqueados. | `lite/firebase/firestore.rules` exige usuario activo y roles. | Faltan reglas para `cultures`, `antimicrobials`, snapshots mensuales y busqueda. | P0 | Ampliar rules al nuevo modelo antes de activar modulos. | `npm run validate:security` y pruebas manuales por rol. |
| Escalabilidad | Store local completo. | Colecciones activas separadas de archive. | Falta paginacion/cursor en servicios historicos y busqueda limitada. | P0 | `paginateQuery`, `patients_search`, snapshots y indices. | Validador de escalabilidad bloquea lecturas historicas globales. |

## Brechas P0

- Endurecer `#/importar-censo` con fixtures hospitalarios reales anonimizados.
- Ampliar `reconciliationService` para excepciones clinicas locales.
- Continuar split de `ronda-paquetes/index.js` solo si la pagina/lista principal vuelve a crecer; paciente individual, formularios, navegacion e historial ya viven en modulos dedicados.
- Paginacion visible por seccion en expediente para rondas, auditoria e historicos largos.
- `iaasService` con seguimiento clinico heredado y UI avanzada de cultivos/antimicrobianos.
- `reportService` con chunking avanzado para historicos crudos aprobados.
- Reglas Firestore para culturas, antimicrobianos, busqueda y snapshots agregados.

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
