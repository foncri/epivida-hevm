import { button, el, field, notice, pagedTable, selectInput } from "./dom.js";
import { listRecentAuditLogs } from "../services/auditService.js";

const MODULE_OPTIONS = [
  ["", "Seleccionar"],
  ["admin", "Admin"],
  ["censo", "Censo"],
  ["importar-censo", "Importar censo"],
  ["ronda-paquetes", "Ronda paquetes"],
  ["epi-iaas", "EPI-IAAS"],
  ["dispositivos", "Dispositivos"],
  ["reportes", "Reportes"],
  ["backup", "Backup"],
  ["audit", "Auditoria"]
];

export function renderAdminAuditPanel(app, state, users = [], redraw = () => undefined) {
  return el("section", { class: "row-card" }, [
    el("strong", {}, ["Auditoria reciente"]),
    el("span", { class: "muted" }, ["Carga bajo demanda por modulo o usuario. Evita listar auditoria global."]),
    state.message ? notice(state.message, state.message.includes("Selecciona") ? "warn" : "ok") : "",
    el("div", { class: "form-grid compact" }, [
      field("Modulo", selectInput(MODULE_OPTIONS, {
        value: state.module || "",
        onchange: event => { state.module = event.target.value; }
      })),
      field("Usuario", selectInput(userOptions(users, state.userId), {
        value: state.userId || "",
        onchange: event => { state.userId = event.target.value; }
      }))
    ]),
    el("div", { class: "toolbar" }, [
      button(state.loading ? "Cargando" : "Cargar auditoria", async () => {
        if (!state.module && !state.userId) {
          state.message = "Selecciona modulo o usuario para cargar auditoria.";
          redraw();
          return;
        }
        state.loading = true;
        state.message = "";
        redraw();
        state.rows = await listRecentAuditLogs({
          module: state.module,
          userId: state.userId,
          limit: 50
        });
        state.loading = false;
        state.message = `${state.rows.length} evento(s) de auditoria cargado(s).`;
        redraw();
      }, { class: "ghost", disabled: state.loading === true })
    ]),
    pagedTable(["Fecha", "Modulo", "Accion", "Usuario", "Paciente", "Entidad"], state.rows || [], row =>
      el("tr", {}, [
        el("td", {}, [row.createdAt || ""]),
        el("td", {}, [row.module || ""]),
        el("td", {}, [row.actionType || ""]),
        el("td", {}, [row.userEmail || row.userId || ""]),
        el("td", {}, [row.patientId || ""]),
        el("td", {}, [row.entityType || row.entityId || ""])
      ]),
      { pageSize: 25, threshold: 40 }
    )
  ]);
}

function userOptions(users = [], current = "") {
  const options = users
    .filter(user => user.uid || user.userId)
    .map(user => [user.uid || user.userId, user.email || user.displayName || user.uid || user.userId]);
  if (current && !options.some(([value]) => value === current)) options.unshift([current, current]);
  return [["", "Seleccionar"], ...options];
}
