# EPIVIDA Lite

Base modular estatica para reconstruir EPIVIDA sin cargar el runtime legacy.

## Estado

Fase 1 inicial:

- Shell minimo.
- Router hash con carga diferida por modulo.
- Firebase Auth como puerta de acceso.
- Firestore como fuente de verdad objetivo.
- Modulos separados: inicio, censo, monitoreo, ronda-paquetes, EPI-IAAS, dispositivos, reportes y admin.
- CSS base unico, sobrio y pequeno.
- Service worker minimo.
- Google Sheets no se carga en el arranque.
- XLSX no se carga en el arranque.
- No hay datos clinicos seed.

## Ejecutar local

Desde la raiz del repositorio:

```powershell
python -m http.server 5199
```

Abrir:

```text
http://localhost:5199/lite/index.html#/inicio
```

## Configurar Firebase

Antes de publicar en produccion, cargar una configuracion equivalente a:

```html
<script>
  window.EPIVIDA_LITE_FIREBASE_CONFIG = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  };
</script>
```

La API key de Firebase no es secreto absoluto, pero la proteccion real depende de Auth, reglas Firestore y dominios autorizados.

## Cloudflare Pages

Configuracion recomendada para esta fase estatica:

- Build command: vacio.
- Output directory: `lite`.
- Variables: ninguna obligatoria si se inyecta la configuracion por script seguro. En una fase posterior con Vite, usar `VITE_FIREBASE_*`.

`lite/_headers` ya incluye headers de cache para HTML, JS, CSS, assets y manifest.

## Rutas

- `#/login`
- `#/inicio`
- `#/censo`
- `#/monitoreo-epidemiologico`
- `#/ronda-paquetes`
- `#/epi-iaas`
- `#/dispositivos`
- `#/reportes`
- `#/admin`

## Firestore

Reglas e indices iniciales:

- `lite/firebase/firestore.rules`
- `lite/firebase/firestore.indexes.json`

Colecciones objetivo:

- `users`
- `patients_active`
- `patients_archive`
- `census_days`
- `nursing_rounds`
- `devices_active`
- `devices_archive`
- `iaas_active`
- `iaas_archive`
- `daily_snapshots`
- `audit_logs`
- `catalogs`
- `sync_queue`
- `exports_log`

## Reglas de trabajo

- No borrar legacy todavia.
- No subir datos clinicos reales.
- No usar Google Sheets como base principal.
- No usar localStorage como fuente de verdad.
- No agregar assets decorativos a la carga inicial.
- No convertir esta base nueva en otro monolito.
