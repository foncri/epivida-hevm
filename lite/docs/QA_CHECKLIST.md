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

## Ronda

- Entrar a `#/ronda-paquetes`.
- Filtrar servicio.
- Abrir paciente.
- Agregar paquete/dispositivo.
- Guardar y siguiente.
- Retirar dispositivo.
- Confirmar alta probable.
- Ver historial solo en expediente/paciente.

## Reportes

- Entrar a `#/reportes`.
- Exportar CSV.
- Confirmar proteccion contra formulas.
- Confirmar `exports_log` cuando este habilitado.
- Confirmar que XLSX no carga al inicio.

## Seguridad

- Enfermeria puede ronda y dispositivos.
- Epidemiologia puede censo, monitoreo, IAAS, dispositivos y reportes.
- Lectura puede monitoreo, censo y reportes.
- Admin puede todo.
- Deletes bloqueados por reglas.
