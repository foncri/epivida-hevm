# EPIVIDA Lite QA Checklist

## Preflight

- `git status`
- `git branch --show-current`
- `git pull --ff-only origin feature/epivida-lite-ultrafast-rework`
- `npm run validate`

## Carga Inicial

- Abrir `#/login` con cache desactivado.
- Confirmar scripts iniciales: `epivida-lite-config.js`, `src/main.js`.
- Confirmar CSS inicial: `src/styles/base.css`.
- Confirmar que no carga legacy, ronda, IAAS completo, reportes, Sheets ni XLSX.

## Auth

- Login admin.
- Usuario inactivo queda bloqueado.
- Usuario sin perfil muestra instruccion de alta.
- Dominio autorizado en Firebase Auth.

## Monitoreo

- Entrar a `#/monitoreo-epidemiologico`.
- Confirmar que no carga `ronda-paquetes/index.js`, `epi-iaas/index.js`, `reportes/index.js`, `iaas-system-runtime`, `epivida-auth-gate`, Sheets ni XLSX.
- Filtrar por servicio, sexo, estado, diagnostico epidemiologico y texto.
- Con 300 pacientes sinteticos no debe haber lag perceptible.

## Censo

- Crear paciente falso.
- Editar servicio/cama/estado/diagnostico.
- Egresar con confirmacion.
- Ver badge `local_pending` si Firestore falla.
- No recargar toda la app.

## Importacion

- Entrar a `#/importar-censo`.
- Pegar CSV/TSV anonimo con encabezados.
- Confirmar preview antes de guardar.
- Confirmar nuevos, movidos/actualizados, duplicados y ausentes.
- Confirmar que ausentes no se archivan sin marcar confirmacion.
- Guardar y verificar `census_days/{date}`, `patients_active`, `patients_search`, `daily_snapshots` y auditoria.

## Ronda

- Entrar a `#/ronda-paquetes`.
- Filtrar servicio.
- Abrir paciente.
- Confirmar que el mapa de camas se renderiza desde `bedBoard.js` y no depende de consultas DOM.
- Confirmar que paciente individual carga desde `patientRound.js`, resumen/historial preventivo renderiza desde `patientRoundPanels.js`, formularios preventivos y alta rapida renderizan desde `preventiveForms.js`, navegacion/guardar desde `roundNavigation.js`, y que guardar/retirar/alta rapida sigue pasando por `saveRoundFlow.js` sin recargar la app.
- Agregar paquete/dispositivo.
- Guardar y siguiente.
- Retirar dispositivo.
- Confirmar que el retiro escribe `devices_archive/{episodeId}` y deja el episodio fuera de listados activos.
- Abrir expediente del paciente y confirmar que el episodio retirado aparece desde historial por paciente, no por lectura global de archivo.
- Confirmar alta probable.
- Ver historial solo en expediente/paciente.
- Abrir expediente y confirmar que carga `patients_active/{id}` o `patients_archive/{id}` e IAAS por `patientId`, no listados globales de pacientes/IAAS.

## Reportes

- Entrar a `#/reportes`.
- Exportar CSV.
- Exportar snapshots diarios por rango y confirmar limite de seguridad para rangos largos.
- Confirmar proteccion contra formulas.
- Confirmar `exports_log` y `audit_logs` para cada CSV.
- Confirmar que XLSX no carga al inicio.

## IAAS, Cultivos Y Antimicrobianos

- Entrar a `#/epi-iaas`.
- Crear/editar IAAS con cultivo inicial.
- Crear/editar IAAS con antimicrobiano inicial.
- Abrir expediente del paciente y confirmar cultivos/antimicrobianos sin lecturas globales.
- Confirmar que el expediente muestra IAAS del paciente sin cargar `iaas_active` completo.

## Seguridad

- Enfermeria puede ronda y dispositivos.
- Epidemiologia puede censo, monitoreo, IAAS, dispositivos y reportes.
- Lectura puede monitoreo, censo y reportes.
- Admin puede todo.
- Deletes bloqueados por reglas.
