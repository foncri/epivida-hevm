# EPIVIDA Lite Migration Plan

## Fase 1: Auditoria Y Paridad

- Inventariar legacy.
- Crear matriz de paridad funcional.
- Definir arquitectura de rendimiento y modelo Firestore.
- Agregar validadores de paridad, no-legacy, performance, indices y escalabilidad.

## Fase 2: P0 Clinico

- Endurecimiento de `importar-censo` con fixtures hospitalarios anonimizados.
- Ampliacion de `importService` y `reconciliationService` para excepciones locales.
- `monitorService`.
- Mantener `ronda-paquetes` modular despues de separar `bedBoard.js`, `roundPatientUtils.js`, `patientRound.js`, `patientRoundPanels.js`, `preventiveForms.js`, `roundNavigation.js` y `saveRoundFlow.js`; separar `roundPage.js` solo si la pagina/lista principal vuelve a crecer.
- Ampliar `expedienteService` con cursores visibles por seccion; ya lee primera pagina de `devices_archive` por paciente.
- IAAS con seguimiento clinico heredado.
- Reportes historicos por rango/chunk; CSV basico ya registra `exports_log`.
- Auditoria exhaustiva.
- Reglas Firestore para nuevas colecciones.

## Fase 3: P1

- Cultivos.
- Antimicrobianos.
- Catalogos editables.
- Snapshots diarios/mensuales.
- Expediente historico paginado.
- Backup JSON controlado.

## Fase 4: P2

- Analitica ligera.
- Reportes mensuales.
- Busqueda avanzada.
- Excel dinamico si se aprueba.

## Criterios De Merge Por Fase

- `npm run validate` pasa.
- `npm run validate:parity` pasa.
- `npm run validate:no-legacy` pasa.
- `npm run validate:performance` pasa.
- `npm run validate:indexes` pasa.
- `npm run validate:scalability` pasa.
- No hay datos clinicos reales ni credenciales.
- Cada commit es pequeno y reversible.

## Decision Sobre Repositorio

No mover a repo propio todavia. El rendimiento depende de que Cloudflare sirva `lite/`, no de borrar legacy. Legacy se conserva como referencia hasta completar paridad funcional critica.
