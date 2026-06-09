# One Million Patient Strategy

## Regla Maxima

Nunca cargar 1,000,000 de pacientes al navegador.

## Separacion De Datos

- `patients_active`: solo hospitalizados activos.
- `patients_archive`: historico completo, siempre por rango/cursor.
- `patients_search`: indice minimo para busqueda.
- `census_days/{date}/patients`: snapshot diario.
- `daily_snapshots`, `monthly_snapshots`, `yearly_snapshots`: agregados.

## Lecturas Permitidas

- Lista activa: `patients_active where active == true`.
- Expediente: un `patientId` y secciones bajo demanda.
- Historico: fecha/rango + `limit` + cursor.
- Reportes: rango controlado y exportacion por chunks.
- Busqueda: tokens limitados o nombre normalizado con limite.

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

## Snapshots

El dashboard no calcula sobre colecciones completas. Lee:

- `daily_snapshots/{date}`
- `monthly_snapshots/{yyyyMM}`
- `yearly_snapshots/{yyyy}`

Los snapshots guardan agregados, no listas crudas de pacientes.
