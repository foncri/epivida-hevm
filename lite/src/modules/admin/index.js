import { button, checkboxInput, el, field, link, notice, numberInput, pagedTable, selectInput, textInput } from "../../components/dom.js";
import { renderBackupRestorePanel } from "../../components/backupRestorePanel.js";
import { firebaseConfigStatus } from "../../lib/config.js";
import { modulePage } from "../../components/moduleLayout.js";
import { loadCatalogs, saveCatalogEntry } from "../../services/catalogService.js";
import { clearBlockedWrites, flushPendingWrites, listPendingWrites, syncQueueSummary } from "../../services/offlineQueueService.js";
import { listUserProfiles, saveUserProfile } from "../../services/userService.js";

const ROLE_OPTIONS = [
  ["admin_epidemiologia", "Admin epidemiologia"],
  ["epidemiologia", "Epidemiologia"],
  ["enfermeria", "Enfermeria"],
  ["lectura", "Lectura"]
];

const ROUTE_OPTIONS = [
  ["inicio", "Inicio"],
  ["monitoreo-epidemiologico", "Monitoreo"],
  ["ronda-paquetes", "Ronda paquetes"],
  ["censo", "Censo"],
  ["importar-censo", "Importar censo"],
  ["reportes", "Reportes"],
  ["admin", "Admin"]
];

const CATALOG_TYPE_OPTIONS = [
  ["services", "Servicios"],
  ["known_beds", "Camas por servicio"],
  ["device_types", "Dispositivos"],
  ["culture_types", "Cultivos"],
  ["culture_status", "Estados de cultivo"],
  ["antimicrobials", "Antimicrobianos"],
  ["antimicrobial_status", "Estados de antimicrobiano"]
];

export async function render({ app }) {
  let [catalogs, initialUsers] = await Promise.all([loadCatalogs(), listUserProfiles()]);
  const firebaseStatus = firebaseConfigStatus();
  let pending = await listPendingWrites();
  let users = initialUsers;
  let editingUser = null;
  let editingCatalog = null;
  let message = "";
  const body = el("div", { class: "stack" });

  function redraw() {
    const summary = syncQueueSummary(pending);
    body.replaceChildren(
      message ? notice(message, summary.pending || summary.blocked ? "warn" : "ok") : "",
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Firebase"]),
        el("span", { class: "muted" }, [firebaseStatus.ready ? `Configurado: ${firebaseStatus.projectId}` : "Pendiente de configuracion productiva."]),
        firebaseStatus.missing.length ? el("span", { class: "muted" }, [`Faltan: ${firebaseStatus.missing.join(", ")}`]) : "",
      ]),
      renderCatalogsPanel(app, catalogs, editingCatalog, nextEditing => {
        editingCatalog = nextEditing;
        redraw();
      }, async saved => {
        catalogs = upsertCatalog(catalogs, saved);
        editingCatalog = null;
        pending = await listPendingWrites();
        message = saved.syncStatus === "local_pending"
          ? "Catalogo guardado localmente; queda pendiente de sincronizar."
          : "Catalogo sincronizado.";
        redraw();
      }),
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Sincronizacion pendiente"]),
        el("span", { class: "muted" }, [`${summary.pending} reintentable(s). ${summary.blocked} bloqueada(s).`]),
        button("Reintentar sincronizacion", async () => {
          const result = await flushPendingWrites();
          pending = await listPendingWrites();
          message = `Intentos: ${result.attempted}. Sincronizadas: ${result.synced}. Pendientes: ${result.pending}. Bloqueadas: ${result.blocked}.`;
          redraw();
        }, { class: "ghost", disabled: summary.pending === 0 }),
        button("Descartar bloqueadas revisadas", async () => {
          if (!globalThis.confirm("Esto elimina solo errores bloqueados locales. Las escrituras pendientes reintentables se conservan. Continuar?")) return;
          const result = await clearBlockedWrites();
          pending = await listPendingWrites();
          message = `Bloqueadas descartadas: ${result.removed}. Restantes: ${result.remaining}.`;
          redraw();
        }, { class: "ghost", disabled: summary.blocked === 0 })
      ]),
      renderUsersPanel(app, users, editingUser, nextEditing => {
        editingUser = nextEditing;
        redraw();
      }, async saved => {
        users = upsertUser(users, saved);
        editingUser = null;
        pending = await listPendingWrites();
        message = saved.syncStatus === "local_pending"
          ? "Perfil de usuario guardado localmente; queda pendiente de sincronizar."
          : "Perfil de usuario sincronizado.";
        redraw();
      }),
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Migracion legacy"]),
        el("span", { class: "muted" }, ["Prepara un paquete JSON desde el store legacy sin subir datos al servidor."]),
        link("./tools/legacy-export/index.html", "Abrir herramienta", { class: "button ghost" })
      ]),
      renderBackupRestorePanel(app, async result => {
        pending = await listPendingWrites();
        message = `Restauracion JSON registrada: ${result.results.map(item => `${item.label} ${item.written}/${item.total}`).join(" | ")}.`;
        redraw();
      }),
      pagedTable(["Modulo", "Entidad", "Estado", "Creado", "Intentos", "Error"], pending, item =>
        el("tr", {}, [
          el("td", {}, [item.module || item.collection || ""]),
          el("td", {}, [item.entityType || item.kind || ""]),
          el("td", {}, [item.status || "local_pending"]),
          el("td", {}, [item.createdAt || ""]),
          el("td", {}, [String(item.attempts || 0)]),
          el("td", {}, [item.error || ""])
        ])
      )
    );
  }

  redraw();
  return modulePage("Admin", "Administracion minima: usuarios, roles y catalogos se integran por fases.", [
    body
  ]);
}

function renderCatalogsPanel(app, catalogs, editingCatalog, onEdit, onSaved) {
  const counts = catalogs.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  return el("section", { class: "row-card" }, [
    el("strong", {}, ["Catalogos clinicos versionados"]),
    el("span", { class: "muted" }, [
      CATALOG_TYPE_OPTIONS.map(([type, label]) => `${label}: ${counts[type] || 0}`).join(" / ")
    ]),
    button("Nuevo catalogo", () => onEdit({ type: "services", active: true, version: "local" }), { class: "ghost" }),
    editingCatalog ? catalogForm(app, editingCatalog, onSaved, () => onEdit(null)) : "",
    pagedTable(["Tipo", "Valor", "Etiqueta", "Orden", "Version", "Activo", "Sync", "Acciones"], catalogs, item =>
      el("tr", {}, [
        el("td", {}, [catalogTypeLabel(item.type)]),
        el("td", {}, [item.value || ""]),
        el("td", {}, [item.label || ""]),
        el("td", {}, [String(item.order ?? "")]),
        el("td", {}, [item.version || ""]),
        el("td", {}, [item.active === false ? "No" : "Si"]),
        el("td", {}, [item.syncStatus || ""]),
        el("td", { class: "actions-cell" }, [
          button("Editar", () => onEdit(item), { class: "small ghost" }),
          button(item.active === false ? "Activar" : "Desactivar", async () => {
            const saved = await saveCatalogEntry(app, { ...item, active: item.active === false });
            onSaved(saved);
          }, { class: "small ghost" })
        ])
      ]),
      { pageSize: 40, threshold: 60 }
    )
  ]);
}

function catalogForm(app, item, onSaved, onCancel) {
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const bedValue = data.type === "known_beds" && data.service && data.bed
        ? `${data.service}|${data.bed}`
        : data.value;
      const saved = await saveCatalogEntry(app, {
        ...item,
        type: data.type,
        value: bedValue,
        label: data.type === "known_beds" ? (data.label || data.bed) : data.label,
        service: data.type === "known_beds" ? data.service : undefined,
        bed: data.type === "known_beds" ? data.bed : undefined,
        order: Number(data.order || 9990),
        version: data.version,
        active: data.active === "on"
      });
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("Tipo", selectInput(CATALOG_TYPE_OPTIONS, { name: "type", value: item.type || "services" })),
      field("Valor interno", textInput({ name: "value", value: item.value || "" })),
      field("Etiqueta visible", textInput({ name: "label", value: item.label || item.value || "" })),
      field("Servicio cama", textInput({ name: "service", value: item.service || "" })),
      field("Cama", textInput({ name: "bed", value: item.bed || "" })),
      field("Orden", numberInput({ name: "order", min: "0", step: "1", value: item.order ?? 9990 })),
      field("Version", textInput({ name: "version", value: item.version || "local" })),
      field("Activo", checkboxInput({ name: "active", checked: item.active !== false }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Guardar catalogo", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function renderUsersPanel(app, users, editingUser, onEdit, onSaved) {
  return el("section", { class: "row-card" }, [
    el("strong", {}, ["Usuarios y roles"]),
    el("span", { class: "muted" }, ["Alta y ajuste de perfiles Firestore. No crea cuentas Google; usa el UID de Firebase Auth."]),
    button("Nuevo perfil", () => onEdit({ active: true, role: "lectura", defaultRoute: "monitoreo-epidemiologico" }), { class: "ghost" }),
    editingUser ? userForm(app, editingUser, onSaved, () => onEdit(null)) : "",
    pagedTable(["Correo", "Nombre", "Rol", "Activo", "Inicio", "Sync", "Acciones"], users, user =>
      el("tr", {}, [
        el("td", {}, [user.email || user.uid || ""]),
        el("td", {}, [user.displayName || ""]),
        el("td", {}, [user.role || ""]),
        el("td", {}, [user.active === true ? "Si" : "No"]),
        el("td", {}, [user.defaultRoute || ""]),
        el("td", {}, [user.syncStatus || ""]),
        el("td", { class: "actions-cell" }, [
          button("Editar", () => onEdit(user), { class: "small ghost" }),
          button(user.active === true ? "Desactivar" : "Activar", async () => {
            const saved = await saveUserProfile(app, { ...user, active: user.active !== true });
            onSaved(saved);
          }, { class: "small ghost" })
        ])
      ])
    )
  ]);
}

function userForm(app, user, onSaved, onCancel) {
  return el("form", {
    class: "form-card",
    onsubmit: async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const saved = await saveUserProfile(app, {
        ...user,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        active: data.active === "on",
        defaultRoute: data.defaultRoute
      });
      onSaved(saved);
    }
  }, [
    el("div", { class: "form-grid" }, [
      field("UID Firebase Auth", textInput({ name: "uid", required: true, value: user.uid || "" })),
      field("Correo", textInput({ name: "email", required: true, value: user.email || "" })),
      field("Nombre", textInput({ name: "displayName", value: user.displayName || "" })),
      field("Rol", selectInput(ROLE_OPTIONS, { name: "role", value: user.role || "lectura" })),
      field("Ruta inicial", selectInput(ROUTE_OPTIONS, { name: "defaultRoute", value: user.defaultRoute || "monitoreo-epidemiologico" })),
      field("Activo", checkboxInput({ name: "active", checked: user.active === true }))
    ]),
    el("div", { class: "toolbar" }, [
      button("Guardar perfil", null, { type: "submit" }),
      button("Cancelar", onCancel, { class: "ghost" })
    ])
  ]);
}

function upsertUser(users, user) {
  const next = users.filter(row => row.uid !== user.uid);
  next.unshift(user);
  return next.sort((a, b) => String(a.email || a.uid || "").localeCompare(String(b.email || b.uid || ""), "es"));
}

function upsertCatalog(catalogs, item) {
  const next = catalogs.filter(row => (row.catalogId || row.id) !== (item.catalogId || item.id));
  next.unshift(item);
  return next.sort((a, b) =>
    String(a.type || "").localeCompare(String(b.type || ""), "es")
    || Number(a.order || 9990) - Number(b.order || 9990)
    || String(a.label || a.value || "").localeCompare(String(b.label || b.value || ""), "es")
  );
}

function catalogTypeLabel(type) {
  return CATALOG_TYPE_OPTIONS.find(([value]) => value === type)?.[1] || type || "";
}
