// dom/ui.js

// =======================================================
// CONFIGURACIÓN GENERAL
// =======================================================

/**
 * Controla cómo se abren los modales de detalle (tokens, símbolos, AST, etc.)
 * - false → solo se abren al hacer clic.
 * - true  → se abren tanto al hacer clic como al pasar el mouse (hover).
 */
export const OPEN_ON_HOVER = false;

// =======================================================
// HELPERS DOM / UI
// =======================================================

/**
 * Atajo para document.querySelector.
 * @param {string} sel - Selector CSS.
 * @returns {Element|null} - Primer elemento que coincide o null.
 */
export const $ = (sel) => document.querySelector(sel);

/**
 * Actualiza el indicador visual de las fases de compilación.
 * Recibe un objeto con claves: lex, syn, sem, tac y valores:
 *   - "ok"      → fase completada correctamente
 *   - "err"     → fase con error
 *   - "pending" → fase pendiente (por defecto)
 *
 * Ejemplo:
 * setPhase({ lex: "ok", syn: "err", sem: "pending", tac: "pending" });
 */
export function setPhase(badges) {
  const keys = ["lex", "syn", "sem", "tac"];
  const colors = { ok: "badge-green", err: "badge-red", pending: "badge-gray" };
  const labels = {
    lex: "Léxico",
    syn: "Sintáctico",
    sem: "Semántico",
    tac: "TAC",
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
 * @param {string[]} headers - Encabezados de la tabla.
 * @param {Array<Array<string>>} rows - Filas de la tabla.
 * @returns {HTMLTableElement} - Tabla lista para insertar en el DOM.
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

// Referencias a elementos del modal principal
const modal = document.querySelector("#modalRoot");
const modalTitle = document.querySelector("#modalTitle");
const modalBody = document.querySelector("#modalBody");
const modalClose = document.querySelector("#modalClose");
const modalOk = document.querySelector("#modalOk");

/**
 * Abre el modal usando un nodo ya construido (por ejemplo una tabla).
 * @param {string} title - Título a mostrar en la cabecera del modal.
 * @param {Node} node - Nodo DOM que se insertará en el cuerpo del modal.
 */
export function openModal(title, node) {
  if (!modal || !modalTitle || !modalBody) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  if (node) modalBody.appendChild(node);
  modal.classList.remove("hidden");

  // Evita que la página de fondo se desplace mientras el modal está abierto
  document.body.classList.add("overflow-hidden");
}

/**
 * Abre el modal generando internamente un div con el HTML que se pasa.
 * @param {string} title - Título del modal.
 * @param {string} html - Contenido HTML a insertar como innerHTML.
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

// ---- Inicialización de listeners del modal (al final del archivo) ----
if (modal) {
  if (modalClose) modalClose.addEventListener("click", closeModal);
  if (modalOk) modalOk.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    // Permite cerrar haciendo clic en elementos que tengan data-close-modal
    if (e.target && e.target.hasAttribute?.("data-close-modal")) {
      closeModal();
    }
  });
}
