import { button, el } from "../../components/dom.js";
import { modulePage } from "../../components/moduleLayout.js";
import { signInWithGoogle } from "../../services/authService.js";

export async function render() {
  return modulePage("Login", "Acceso protegido para EPIVIDA.", [
    el("section", { class: "row-card" }, [
      el("strong", {}, ["Autenticacion Firebase"]),
      el("span", { class: "muted" }, ["La carga clinica no inicia hasta validar usuario y rol."]),
      button("Iniciar sesion con Google", signInWithGoogle, { class: "primary" })
    ])
  ]);
}
