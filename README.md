# EpiVida HEVM

Sistema estatico y gratuito para vigilancia epidemiologica hospitalaria, censo diario, ronda IAAS movil, episodios de dispositivos invasivos, reportes y respaldos.

Sitio publicado: https://foncri.github.io/epivida-hevm/

## Arquitectura $0

- GitHub Pages para hosting estatico.
- Firebase Auth con Google como acceso clinico.
- Cloud Firestore para censo, rondas, invasivos, auditoria y usuarios.
- Persistencia offline de Firestore cuando el navegador la soporte.
- Importacion CSV/XLSX y calculos en navegador.
- Exportacion local CSV/JSON para respaldo diario.

No usa Cloud Functions, BigQuery, Firebase App Hosting, Cloud Storage clinico, APIs pagadas ni backend propio.

## Flujo principal

1. `Importar censo`: pegar desde Excel/Sheets o cargar CSV/XLSX.
2. Validar columnas, errores, duplicados, conflictos de cama/servicio y pacientes ausentes.
3. Confirmar importacion para crear/actualizar pacientes sin duplicarlos.
4. `Ronda IAAS`: enfermeria revisa por servicio y cama desde movil.
5. Capturar invasivos como episodios historicos, retiros, reinstalaciones, curacion, cuidado y signos de infeccion.
6. Consultar dashboard, seguimiento de paciente, reporte diario y exportaciones.

## Modelo Firestore

- `patients/{patientId}`
- `patients/{patientId}/deviceEpisodes/{episodeId}`
- `dailyCensus/{YYYY-MM-DD}`
- `dailyCensus/{YYYY-MM-DD}/patients/{patientId}`
- `dailyRounds/{YYYY-MM-DD}`
- `dailyRounds/{YYYY-MM-DD}/entries/{entryId}`
- `auditLogs/{logId}`
- `users/{uid}`

Los dispositivos invasivos se guardan como episodios. Un retiro cierra el episodio con `removalDate`; una reinstalacion crea un episodio nuevo con `isReinstallation = true`.

## Seguridad

Publica `firestore.rules` en Firebase. El correo bootstrap incluido es `todofoncri@gmail.com`; despues crea documentos `users/{uid}` para roles:

- `admin`
- `epidemiologia`
- `enfermeria`
- `lectura`

Los usuarios no pueden modificarse su propio rol. Los borrados destructivos estan bloqueados por reglas.

## Desarrollo local

Desde la carpeta del repo:

```powershell
python -m http.server 5188
```

Abrir `http://localhost:5188/`. No uses `127.0.0.1` para probar Google Auth; Firebase Auth puede rechazarlo como dominio no autorizado.

## Respaldo operativo

Aunque Firestore este activo, generar diariamente:

- respaldo JSON
- censo CSV
- ronda CSV
- invasivos CSV
- impresion del reporte

El cierre de ronda se bloquea si quedan pacientes pendientes, errores, escrituras sin sincronizar o fechas criticas invalidas.
