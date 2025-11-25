/**
 * Controla cómo se abren los modales de detalle (tokens, símbolos, AST, etc.)
 */
export const OPEN_ON_HOVER = false;

/**
 * Atajo para document.querySelector.
 * @param {string} sel
 * @returns {Element|null}
 */
export const $ = (sel) => document.querySelector(sel);

/**
 * Actualiza el indicador visual de las fases de compilación.
 */
export function setPhase(badges) {
  const keys = ["lex", "syn", "sem"];
  const colors = { ok: "badge-green", err: "badge-red", pending: "badge-gray" };
  const labels = {
    lex: "Léxico",
    syn: "Sintáctico",
    sem: "Semántico",
  };

  const container = document.getElementById("phase");
  if (!container) return;

  container.innerHTML = "";
  keys.forEach((k) => {
    const span = document.createElement("span");
    span.className = `badge ${colors[badges[k] || "pending"]}`;
    span.textContent = labels[k] || k;
    container.appendChild(span);
  });
}

/**
 * Crea una tabla HTML a partir de headers y rows.
 * @param {string[]} headers
 * @param {Array<Array<string>>} rows
 * @returns {HTMLTableElement}
 */
export function makeTable(headers, rows) {
  const table = document.createElement("table");
  table.className = "w-full text-sm border-collapse";

  const thead = document.createElement("thead");
  thead.className = "text-left border-b";

  const trh = document.createElement("tr");
  headers.forEach((h) => {
    const th = document.createElement("th");
    th.className = "py-2 pr-4";
    th.textContent = h;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.className = "border-b last:border-0";
    r.forEach((v) => {
      const td = document.createElement("td");
      td.className = "py-2 pr-4";
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

// =======================================================
// SISTEMA DE MODALES (GENÉRICO)
// =======================================================

const modal = document.querySelector("#modalRoot");
const modalTitle = document.querySelector("#modalTitle");
const modalBody = document.querySelector("#modalBody");
const modalClose = document.querySelector("#modalClose");
const modalOk = document.querySelector("#modalOk");

/**
 * Abre el modal usando un nodo ya construido.
 * @param {string} title
 * @param {Node} node
 */
export function openModal(title, node) {
  if (!modal || !modalTitle || !modalBody) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  if (node) modalBody.appendChild(node);
  modal.classList.remove("hidden");

  document.body.classList.add("overflow-hidden");
}

/**
 * Abre el modal generando internamente un div con el HTML que se pasa.
 * @param {string} title
 * @param {string} html
 */
export function openModalHtml(title, html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  openModal(title, div);
}

/**
 * Cierra el modal y restablece el scroll del body.
 */
export function closeModal() {
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

// ---- Inicialización del modal ----
if (modal) {
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOk) modalOk.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target && e.target.hasAttribute?.("data-close-modal")) {
      closeModal();
    }
  });
}
