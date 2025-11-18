import {
  $,
  setPhase,
  makeTable,
  openModal,
  openModalHtml,
  OPEN_ON_HOVER,
} from "./dom/ui.js";

import { tokenize, tokenTypeLabel } from "./compiler/lexer.js";
import { Parser } from "./compiler/parser.js";
import { analyze } from "./compiler/analyzer.js";
import { genTAC } from "./compiler/tac_gen.js";
import { drawASTInto } from "./compiler/ast_renderer.js";
// =======================================================
// PIPELINE DE COMPILACIÓN COMPLETA
// =======================================================

/**
 * LAST guarda siempre el último resultado (completo o parcial)
 * de la compilación, para que los botones (TOK, SYM, AST, etc.)
 * puedan mostrar la información correspondiente.
 */
let LAST = null;

/**
 * Ejecuta la pipeline completa de compilación sobre el código fuente:
 * 1. Léxico
 * 2. Sintáctico
 * 3. Semántico
 * 4. Generación de TAC
 *
 * Actualiza el indicador de fase (setPhase) en cada etapa.
 * Si una fase lanza error, se lanza un objeto "result" con:
 *   - phase: nombre de la fase
 *   - error: mensaje de error
 *   - y los datos que se hayan producido hasta el momento.
 */
export function compileSource(source) {
  const result = {
    phase: null,
    error: null,
    tokens: [],
    ast: null,
    symbols: [],
    types: [],
    tac: [],
  };

  // --- Fase 1: Análisis léxico ---
  try {
    const tokens = tokenize(source);
    result.tokens = tokens;
    setPhase({ lex: "ok", syn: "pending", sem: "pending", tac: "pending" });
  } catch (e) {
    result.phase = "Análisis léxico";
    result.error = e.message;
    throw result;
  }

  // --- Fase 2: Análisis sintáctico (Parser) ---
  let ast;
  try {
    const p = new Parser(result.tokens);
    ast = p.parse();
    result.ast = ast;
    setPhase({ lex: "ok", syn: "ok", sem: "pending", tac: "pending" });
  } catch (e) {
    result.phase = "Análisis sintáctico";
    result.error = e.message;
    result.ast = null;
    throw result;
  }

  // --- Fase 3: Análisis semántico ---
  try {
    const sem = analyze(ast);
    result.symbols = Array.from(sem.symbols.values());
    result.types = sem.types;
    setPhase({ lex: "ok", syn: "ok", sem: "ok", tac: "pending" });
  } catch (e) {
    result.phase = "Análisis semántico";
    result.error = e.message;
    throw result;
  }

  // --- Fase 4: Generación de TAC ---
  const tac = genTAC(ast);
  result.tac = tac;
  setPhase({ lex: "ok", syn: "ok", sem: "ok", tac: "ok" });

  return result;
}

// =======================================================
// UI: BOTONES, EVENTOS Y MODALES
// =======================================================

// Textarea donde el usuario escribe el código
const code = $("#code");

// Botón de ejemplo: sentencia if
function handleIfExampleClick() {
  code.value = "if (3 < 5) { y = 10; } else { y = 0; }";
}

// Botón para limpiar el código y el estado
function handleClearClick() {
  code.value = "";
  $("#phase").innerHTML = "";
  LAST = null;
}

/**
 * Botón principal de ejecución.
 * - Si no hay código, muestra un aviso en modal.
 * - Si hay código, ejecuta compileSource.
 * - Si hay error en alguna fase, muestra un modal con información
 *   y marca la fase correspondiente como error.
 */
function handleRunClick() {
  const src = code.value.trim();
  if (!src) {
    openModalHtml(
      "Atención",
      '<p>Pega una sentencia <code class="mono">if</code>  <code class="mono"></code>  <code class="mono"></code>.</p>'
    );
    return;
  }

  try {
    const res = compileSource(src);
    LAST = res;
  } catch (r) {
    LAST = r; // Resultado parcial (tiene tokens y quizá AST)

    // Determinar qué fase marcamos como error en el indicador
    const st = {
      lex: "pending",
      syn: "pending",
      sem: "pending",
      tac: "pending",
    };
    if (r.phase === "Análisis léxico") st.lex = "err";
    else if (r.phase === "Análisis sintáctico") {
      st.lex = "ok";
      st.syn = "err";
    } else if (r.phase === "Análisis semántico") {
      st.lex = "ok";
      st.syn = "ok";
      st.sem = "err";
    }
    setPhase(st);

    // Modal de error amigable
    openModalHtml(
      "❌ Error",
      `
      <div class="p-3 rounded-xl bg-red-50 text-red-800 ring-1 ring-red-200">
        <p><strong>Fase:</strong> ${r.phase || "Desconocida"}</p>
        <p class="mt-1 mono">${r.error || "Error"}</p>
      </div>
      <p class="mt-3 text-sm text-slate-600">Consejo: inicializa las variables antes de usarlas y revisa paréntesis, llaves y punto y coma.</p>
    `
    );
  }
}

/**
 * Asocia un botón a la apertura de un modal.
 * - Siempre abre al hacer click.
 * - Si OPEN_ON_HOVER está a true, también abre al pasar el mouse.
 *
 * @param {string} btnId - id del botón en el DOM.
 * @param {Function} openFn - función que abre el modal correspondiente.
 */
function attachModalButton(btnId, openFn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const handler = () => openFn();
  btn.addEventListener("click", handler);
  if (OPEN_ON_HOVER) btn.addEventListener("mouseenter", handler);
}

// -------------------- Modales de detalle --------------------

// Tokens (léxico)
function openTokensModal() {
  if (!LAST || !LAST.tokens?.length) {
    openModalHtml("Tokens", "<p>No hay tokens aún. Analiza primero.</p>");
    return;
  }
  const rows = LAST.tokens.map((t, i) => [
    String(i),
    tokenTypeLabel(t.type), // tipo mostrado en español
    t.lexeme ?? "",
  ]);
  const table = makeTable(["#", "Tipo", "Lexema"], rows);
  openModal("Tokens (léxico)", table);
}

// Tabla de símbolos
function openSymbolsModal() {
  if (!LAST || !LAST.symbols) {
    openModalHtml("Símbolos", "<p>No hay datos. Analiza primero.</p>");
    return;
  }
  const rows = LAST.symbols.map((s) => [
    s.name,
    s.type ?? "—",
  ]);
  const table = makeTable(["Identificador", "Tipo"], rows);
  openModal("Tabla de símbolos", table);
}

// Tabla de tipos (anotaciones semánticas)
function openTypesModal() {
  if (!LAST || !LAST.types) {
    openModalHtml("Tipos", "<p>No hay datos. Analiza primero.</p>");
    return;
  }
  const rows = LAST.types.map((t) => [t.node, t.type]);
  const table = makeTable(["Nodo", "Tipo"], rows);
  openModal("Tabla de tipos", table);
}

// AST (con zoom y scroll)
function openASTModal() {
  if (!LAST || !LAST.ast) {
    if (!LAST) {
      openModalHtml("AST", "<p>Analiza primero.</p>");
    } else {
      openModalHtml(
        "AST",
        "<p>No hay AST disponible (probable error de sintaxis).</p>"
      );
    }
    return;
  }

  // Contenido del modal: toolbar de zoom + viewport desplazable
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <button id="zOut" class="btn">−</button>
      <button id="zReset" class="btn">Reset</button>
      <button id="zIn" class="btn">+</button>
    </div>
    <div id="astViewport" class="border rounded-xl bg-slate-50 overflow-auto h-[65vh]">
      <div id="astZoom" style="transform-origin: 0 0;">
        <svg id="astSvg"></svg>
      </div>
    </div>
  `;
  openModal("Árbol AST", wrap);

  const svg = document.getElementById("astSvg");
  drawASTInto(LAST.ast, svg);

  // Control del zoom mediante escala CSS
  const zoomBox = document.getElementById("astZoom");
  let scale = 1;
  const apply = () => (zoomBox.style.transform = `scale(${scale})`);

  $("#zIn").onclick = () => {
    scale = Math.min(3, scale + 0.2);
    apply();
  };
  $("#zOut").onclick = () => {
    scale = Math.max(0.4, scale - 0.2);
    apply();
  };
  $("#zReset").onclick = () => {
    scale = 1;
    apply();
  };
}

// =======================================================
// INICIALIZACIÓN DE LA UI
// =======================================================

function initUI() {
  // Botones principales
  $("#btnIf").addEventListener("click", handleIfExampleClick);
  $("#btnClear").addEventListener("click", handleClearClick);
  $("#btnRun").addEventListener("click", handleRunClick);

  // Botones de modales
  attachModalButton("btnTOK", openTokensModal);
  attachModalButton("btnSYM", openSymbolsModal);
  attachModalButton("btnTYP", openTypesModal);

  attachModalButton("btnAST", openASTModal);

  // Estado inicial de las fases
  setPhase({ lex: "pending", syn: "pending", sem: "pending", tac: "pending" });
}

initUI();
