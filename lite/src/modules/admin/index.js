import { button, checkboxInput, el, field, link, notice, selectInput, table, textInput } from "../../components/dom.js";
import { firebaseConfigStatus } from "../../lib/config.js";
import { modulePage } from "../../components/moduleLayout.js";
import { loadCatalogs } from "../../services/catalogService.js";
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
  ["reportes", "Reportes"],
  ["admin", "Admin"]
];

export async function render({ app }) {
  const [catalogs, initialUsers] = await Promise.all([loadCatalogs(), listUserProfiles()]);
  const firebaseStatus = firebaseConfigStatus();
  let pending = await listPendingWrites();
  let users = initialUsers;
  let editingUser = null;
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
      el("section", { class: "row-card" }, [
        el("strong", {}, ["Catalogos detectados"]),
        el("span", { class: "muted" }, [String(catalogs.length)]),
        el("span", { class: "muted" }, ["No hay datos clinicos seed en la app Lite."])
      ]),
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
      table(["Modulo", "Entidad", "Estado", "Creado", "Intentos", "Error"], pending.map(item =>
        el("tr", {}, [
          el("td", {}, [item.module || item.collection || ""]),
          el("td", {}, [item.entityType || item.kind || ""]),
          el("td", {}, [item.status || "local_pending"]),
          el("td", {}, [item.createdAt || ""]),
          el("td", {}, [String(item.attempts || 0)]),
          el("td", {}, [item.error || ""])
        ])
      ))
    );
  }

  redraw();
  return modulePage("Admin", "Administracion minima: usuarios, roles y catalogos se integran por fases.", [
    body
  ]);
}

function renderUsersPanel(app, users, editingUser, onEdit, onSaved) {
  return el("section", { class: "row-card" }, [
    el("strong", {}, ["Usuarios y roles"]),
    el("span", { class: "muted" }, ["Alta y ajuste de perfiles Firestore. No crea cuentas Google; usa el UID de Firebase Auth."]),
    button("Nuevo perfil", () => onEdit({ active: true, role: "lectura", defaultRoute: "monitoreo-epidemiologico" }), { class: "ghost" }),
    editingUser ? userForm(app, editingUser, onSaved, () => onEdit(null)) : "",
    table(["Correo", "Nombre", "Rol", "Activo", "Inicio", "Sync", "Acciones"], users.map(user =>
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
    ))
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
