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
import { drawASTInto } from "./compiler/ast_renderer.js";

let LAST = null;

/**
 * Evalúa el AST y retorna el resultado numérico
 */

function evaluateAST(node) {
  switch (node.kind) {
    case "Num":
      return node.value;
    case "Unary":
      if (node.op === "-") {
        return -evaluateAST(node.right);
      }
      return evaluateAST(node.right);
    case "Binary":
      const left = evaluateAST(node.left);
      const right = evaluateAST(node.right);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return Math.floor(left / right);
        default:
          return 0;
      }
    default:
      return 0;
  }
}

export function compileSource(source) {
  const result = {
    phase: null,
    error: null,
    tokens: [],
    ast: null,
    symbols: [],
    types: [],
  };

  // --- Fase 1: Análisis léxico ---
  try {
    const tokens = tokenize(source);
    result.tokens = tokens;
    setPhase({ lex: "ok", syn: "pending", sem: "pending" });
  } catch (e) {
    result.phase = "Análisis léxico";
    result.error = e.message;
    throw result;
  }

  // --- Fase 2: Análisis sintáctico ---
  let ast;
  try {
    const p = new Parser(result.tokens);
    ast = p.parse();
    result.ast = ast;
    setPhase({ lex: "ok", syn: "ok", sem: "pending" });
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
    setPhase({ lex: "ok", syn: "ok", sem: "ok" });
  } catch (e) {
    result.phase = "Análisis semántico";
    result.error = e.message;
    throw result;
  }

  return result;
}

// =======================================================
// UI: BOTONES, EVENTOS Y MODALES
// =======================================================

const code = $("#code");

// Botón de ejemplo: fórmula 1
function handleFormula1Click() {
  code.value = "10 + 5 * 2";
}

// Botón de ejemplo: fórmula 2
function handleFormula2Click() {
  code.value = "(10 + 5) * 3";
}

// Botón para limpiar el código y el estado
function handleClearClick() {
  code.value = "";
  $("#phase").innerHTML = "";
  $("#resultSection").classList.add("hidden");
  LAST = null;
}

/**
 * Botón principal de ejecución.
 */
function handleRunClick() {
  const src = code.value.trim();
  if (!src) {
    openModalHtml(
      "Atención",
      '<p>Ingresa una expresión matemática, por ejemplo: <code class="mono">10 + 5 * 2</code></p>'
    );
    return;
  }

  try {
    const res = compileSource(src);
    LAST = res;

    // Calcular y mostrar el resultado
    const result = evaluateAST(res.ast.expr);
    $("#resultSection").classList.remove("hidden");
    $("#resultValue").textContent = result;
  } catch (r) {
    $("#resultSection").classList.add("hidden");
    LAST = r;

    // Determinar qué fase marcamos como error en el indicador
    const st = {
      lex: "pending",
      syn: "pending",
      sem: "pending",
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

    // Modal de error
    openModalHtml(
      "❌ Error",
      `
      <div class="p-3 rounded-xl bg-red-50 text-red-800 ring-1 ring-red-200">
        <p><strong>Fase:</strong> ${r.phase || "Desconocida"}</p>
        <p class="mt-1 mono">${r.error || "Error"}</p>
      </div>
      <p class="mt-3 text-sm text-slate-600">Consejo: usa solo números y operadores (+, -, *, /). Revisa paréntesis y operadores.</p>
    `
    );
  }
}

/**
 * Asocia el botón a la apertura de cualuier modal.
 *
 * @param {string} btnId
 * @param {Function} openFn
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
    tokenTypeLabel(t.type),
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
  const rows = LAST.symbols.map((s) => [s.name, s.address ?? "—"]);
  const table = makeTable(["Símbolo (Número)", "Dirección"], rows);
  openModal("Tabla de símbolos", table);
}

// Tabla de tipos
function openTypesModal() {
  if (!LAST || !LAST.types) {
    openModalHtml("Tipos", "<p>No hay datos. Analiza primero.</p>");
    return;
  }
  const rows = LAST.types.map((t) => [t.node, t.type]);
  const table = makeTable(["Nodo", "Tipo"], rows);
  openModal("Tabla de tipos", table);
}

// AST
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

  // Contenido del modal
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
  $("#btnFormula").addEventListener("click", handleFormula1Click);
  $("#btnFormula2").addEventListener("click", handleFormula2Click);
  $("#btnClear").addEventListener("click", handleClearClick);
  $("#btnRun").addEventListener("click", handleRunClick);

  // Botones de modales
  attachModalButton("btnTOK", openTokensModal);
  attachModalButton("btnSYM", openSymbolsModal);
  attachModalButton("btnTYP", openTypesModal);
  attachModalButton("btnAST", openASTModal);

  // Estado inicial de las fases
  setPhase({ lex: "pending", syn: "pending", sem: "pending" });
}

initUI();
