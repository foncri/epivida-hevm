# One Million Patient Strategy

## Regla Maxima

Nunca cargar 1,000,000 de pacientes al navegador.

## Separacion De Datos

- `patients_active`: solo hospitalizados activos.
- `patients_archive`: historico completo, siempre por rango/cursor; Alta OPD pendiente usa solo `opdPending == true` + `archivedAt desc` con limite.
- `patients_search`: indice minimo para busqueda.
- `census_days/{date}/patients`: snapshot diario.
- `daily_snapshots`, `monthly_snapshots`, `yearly_snapshots`: agregados.

## Lecturas Permitidas

- Lista activa: `patients_active where active == true`.
- Expediente: un `patientId` y secciones bajo demanda.
- Historico: fecha/rango + `limit` + cursor.
- Alta OPD archivada: `patients_archive where opdPending == true order by archivedAt desc limit <= 100`.
- Reportes: rango controlado y exportacion por chunks.
- Busqueda: `patients_search` con `searchTokens array-contains`, resultado limitado y accion explicita del usuario; nunca por cada tecla.

## Lecturas Prohibidas

- `listCollection("patients_archive")` sin filtros.
- Descargar historico completo para filtrar en cliente.
- Consultar Firestore por cada tecla.
- Exportar 1M registros en memoria.
- Renderizar todos los nodos si hay mas de 300 filas.

## Paginacion

Los servicios historicos deben usar:

- `paginateQuery(collection, filters, order, pageSize, cursorState)`
- `loadNextPage()`
- `loadPreviousPage()`
- `getCursorState()`
- `resetPagination()`

`pageSize` recomendado: 50. Maximo de seguridad frontend: 100.

## Expediente

El expediente debe renderizar resumen primero y dividir historicos en tabs/tarjetas por seccion. Cada seccion usa `loadExpedienteSectionPage(patientId, section, cursorState)` y acciones hacia el modulo propietario; no debe montar todas las tablas clinicas extensas como una sola superficie.

## Snapshots

El dashboard no calcula sobre colecciones completas. Lee:

- `daily_snapshots/{date}`
- `monthly_snapshots/{yyyy-MM}`
- `yearly_snapshots/{yyyy}`

Los snapshots guardan agregados, no listas crudas de pacientes.
