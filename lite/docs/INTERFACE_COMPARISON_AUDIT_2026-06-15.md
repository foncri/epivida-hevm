# EPIVIDA Legacy vs Lite - Interface Comparison Audit

Date: 2026-06-15
Branch: feature/epivida-lite-ultrafast-rework
Runner: Playwright Chromium, local static servers and public Cloudflare/GitHub Pages checks

## Scope

This audit compares the legacy root app and EPIVIDA Lite from the user interface layer:

- Public legacy auth gate: `https://foncri.github.io/epivida-hevm/index.html#/dashboard`
- Public Lite login: `https://epivida-hevm.pages.dev/#/login`
- Local legacy auth gate and forced full-app routes
- Local Lite routes with QA mode and 300 synthetic active patients

No real clinical data was used. The Lite local QA run used synthetic patients, devices, IAAS, cultures, antimicrobials, rounds and audit rows.

## Reproducible Command

```bash
npm run audit:interfaces
```

The command starts two local static servers, opens each route in Playwright Chromium, captures scripts, styles, resources, console errors, page errors, interaction results and screenshots, then writes a JSON report under the OS temp directory.

Latest evidence file:

```text
C:\Users\super\AppData\Local\Temp\epivida-ui-audit-oc7PMF\interface-comparison.json
```

## Headline Result

EPIVIDA Lite is objectively superior in web architecture and route-level performance in this audit:

| Metric | Legacy full app average | Lite 300-patient route average | Result |
|---|---:|---:|---|
| Transfer | 1466.8 KB | 128.0 KB | 91.3% less transfer |
| Requests | 50.8 | 26.1 | 48.6% fewer requests |
| Load time | 8854 ms | 2017 ms | 77.2% faster |
| Legacy markers in Lite | N/A | 0 | Clean |
| Page errors in Lite | N/A | 0 | Clean |
| Console errors in Lite | N/A | 0 | Clean |

## Public Initial Load

| Route | Status | Requests | Transfer | Scripts | Styles | Legacy markers | Errors |
|---|---:|---:|---:|---|---|---:|---:|
| Legacy public auth gate | 200 | 5 | 6.4 KB | `epivida-auth-gate.js` | `epivida-auth-gate.css` | 2 | 0 |
| Lite public login | 200 | 13 | 17.5 KB | `epivida-lite-config.js`, `src/main.js` | `src/styles/base.css` | 0 | 0 |

Lite public login loads only the Lite shell, config, main module, deferred auth/PWA helpers and Firebase Auth runtime. It does not load ronda, reportes, IAAS full modules, XLSX, Google Sheets, legacy hotfixes or decorative legacy assets.

## Legacy Full-App Findings

Forced local legacy routes loaded the monolithic stack even when testing one clinical interface:

| Route | Requests | Transfer | Load time | Legacy monolith markers |
|---|---:|---:|---:|---:|
| Dashboard | 52 | 1586.6 KB | 8945 ms | 4 |
| Censo | 49 | 1341.1 KB | 8831 ms | 4 |
| Ronda | 54 | 1664.6 KB | 8799 ms | 4 |
| Seguimiento IAAS | 50 | 1400.7 KB | 8868 ms | 4 |
| Reportes | 49 | 1341.1 KB | 8826 ms | 4 |

Largest repeated legacy resources included:

- `iaas-system-runtime-2026-06-04.js`: 565.9 KB
- `iaas-system.css`: 202.1 KB
- `extra-biomedical-holographic-interface.webp`: 170.3 KB
- Multiple `epivida-pro` WebP icons
- Multiple hotfix and repair scripts

This confirms the legacy interface still behaves as a heavy accumulated runtime.

## Lite Route Findings With 300 Synthetic Patients

| Route | Requests | Transfer | Load time | Errors | Console errors | Legacy markers |
|---|---:|---:|---:|---:|---:|---:|
| Inicio | 21 | 81.3 KB | 1902 ms | 0 | 0 | 0 |
| Censo | 24 | 111.6 KB | 1883 ms | 0 | 0 | 0 |
| Importar censo | 26 | 128.6 KB | 1884 ms | 0 | 0 | 0 |
| Monitoreo | 24 | 107.1 KB | 2411 ms | 0 | 0 | 0 |
| Ronda | 35 | 210.2 KB | 2736 ms | 0 | 0 | 0 |
| EPI-IAAS | 27 | 136.4 KB | 1870 ms | 0 | 0 | 0 |
| Dispositivos | 24 | 117.2 KB | 1873 ms | 0 | 0 | 0 |
| Expediente | 29 | 155.3 KB | 1877 ms | 0 | 0 | 0 |
| Reportes | 27 | 127.1 KB | 1870 ms | 0 | 0 | 0 |
| Admin | 24 | 105.0 KB | 1868 ms | 0 | 0 | 0 |

## Interaction Checks

Monitoreo with 300 patients:

- Rendered 300 active synthetic patients.
- Local search for `riesgo` did not query Firestore per keypress.
- Filtered from 300 active patients to 61 risk rows.
- Did not load ronda, reportes, IAAS full runtime, XLSX, Google Sheets or legacy scripts.

Ronda with 300 patients:

- Rendered the bed board.
- Found 59 bed links in the first route view.
- Opened first bed tile successfully.
- Navigated to `#/ronda/2026-06-15/paciente/qa_patient_0002`.
- Rendered patient round panels and preventive packages.

Expediente:

- Rendered patient header, active and archived device history, rounds, preventive package review, IAAS follow-up, cultures, antimicrobials and related audit rows.
- Uses paginated section loaders instead of loading all history at once.

## Fixes Added During Audit

- Added `npm run audit:interfaces`.
- Added `lite/tools/run-interface-comparison.mjs`.
- Added QA synthetic clinical rows for expediente-level testing.
- Updated test-mode clinical services so QA routes do not wait on Firestore for empty historical collections.
- Added `node_modules/` to `.gitignore`.

## Conclusion

EPIVIDA Lite is clearly superior to EPIVIDA legacy for performance, modular loading and operational maintainability in this audit. The legacy app still loads a broad monolithic runtime with large CSS, WebP assets and many hotfix scripts across clinical routes. Lite keeps route modules isolated, avoids legacy markers, renders 300-patient workflows without page errors and keeps public Cloudflare login minimal.

Remaining qualification: this proves web-performance and interface architecture superiority. Full clinical parity still depends on continuing the documented migration matrix for every legacy feature that remains pending.
