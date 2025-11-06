// ===== Config opcional: abrir modales al pasar el mouse =====
const OPEN_ON_HOVER = false; // ponlo en true si quieres abrir al pasar el mouse

// ===== Helpers DOM/UI =====
const $ = (sel) => document.querySelector(sel);

function setPhase(badges) {
  const keys = ["lex", "syn", "sem", "tac"];
  const colors = { ok: "badge-green", err: "badge-red", pending: "badge-gray" };
  const labels = {
    lex: "Léxico",
    syn: "Sintáctico",
    sem: "Semántico",
    tac: "TAC",
  };
  const frag = document.createDocumentFragment();
  for (const k of keys) {
    const s = document.createElement("span");
    s.className = `badge ${colors[badges[k] || "pending"]}`;
    s.textContent = labels[k];
    frag.appendChild(s);
  }
  const phase = $("#phase");
  phase.innerHTML = "";
  phase.appendChild(frag);
}

function makeTable(headers, rows) {
  const table = document.createElement("table");
  table.className = "min-w-full text-sm";
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

// ===== Modal genérico =====
const modal = $("#modalRoot");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");
const modalClose = $("#modalClose");
const modalOk = $("#modalOk");

function openModal(title, node) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  if (node) modalBody.appendChild(node);
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}
function openModalHtml(title, html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  openModal(title, div);
}
function closeModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}
modalClose.addEventListener("click", closeModal);
modalOk.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close-modal")) closeModal();
});

// ===== Errores =====
class LexError extends Error {}
class ParserError extends Error {}
class SemanticError extends Error {}

// ===== Léxico =====
const KEYWORDS = {
  if: "IF",
  else: "ELSE",
  while: "WHILE",
  true: "TRUE",
  false: "FALSE",
};
const SIMPLE = {
  "(": "LPAREN",
  ")": "RPAREN",
  "{": "LBRACE",
  "}": "RBRACE",
  ";": "SEMI",
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
  "=": "ASSIGN",
  "!": "BANG",
  "<": "LT",
  ">": "GT",
};

function tokenize(src) {
  const toks = [];
  let i = 0,
    line = 1,
    col = 1;
  const len = src.length;
  const adv = (n = 1) => {
    i += n;
    col += n;
  };
  while (i < len) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\r") {
      adv();
      continue;
    }
    if (c === "\n") {
      i++;
      line++;
      col = 1;
      continue;
    }
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") {
      const sc = col;
      let s = i;
      adv();
      while (i < len) {
        const ch = src[i];
        if (
          (ch >= "A" && ch <= "Z") ||
          (ch >= "a" && ch <= "z") ||
          (ch >= "0" && ch <= "9") ||
          ch === "_"
        )
          adv();
        else break;
      }
      const lex = src.slice(s, i);
      const ttype = KEYWORDS[lex] || "IDENT";
      toks.push({ type: ttype, lexeme: lex, line, col: sc });
      continue;
    }
    if (c >= "0" && c <= "9") {
      const sc = col;
      let s = i;
      adv();
      while (i < len && src[i] >= "0" && src[i] <= "9") adv();
      const lex = src.slice(s, i);
      toks.push({ type: "NUMBER", lexeme: lex, line, col: sc });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      const map = { "==": "EQ", "!=": "NEQ", "<=": "LE", ">=": "GE" };
      toks.push({ type: map[two], lexeme: two, line, col });
      adv(2);
      continue;
    }
    if (two === "//") {
      while (i < len && src[i] !== "\n") i++;
      continue;
    }
    if (SIMPLE[c]) {
      toks.push({ type: SIMPLE[c], lexeme: c, line, col });
      adv();
      continue;
    }
    throw new LexError(
      `Error léxico: carácter inválido '${c}' en línea ${line}, columna ${col}.`
    );
  }
  toks.push({ type: "EOF", lexeme: "", line, col });
  return toks;
}

// ===== Parser =====
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this._prev = null;
  }
  peek() {
    return this.tokens[this.pos];
  }
  prev() {
    return this._prev;
  }
  match(...types) {
    const t = this.peek();
    if (types.includes(t.type)) {
      this.pos++;
      this._prev = t;
      return t;
    }
    return null;
  }
  expect(ttype, msg) {
    const t = this.peek();
    if (t.type === ttype) {
      this.pos++;
      this._prev = t;
      return t;
    }
    throw new ParserError(
      `Error sintáctico: se esperaba ${msg} en línea ${t.line}, columna ${
        t.col
      }, pero se encontró '${t.lexeme || t.type}'.`
    );
  }

  parse() {
    const stmt = this.statement();
    this.expect("EOF", "fin de entrada");
    return { kind: "Program", stmt };
  }

  statement() {
    if (this.match("IF")) {
      this.expect("LPAREN", "'(' tras if");
      const cond = this.expression();
      this.expect("RPAREN", ")' tras condición");
      const thenB = this.statementOrBlock();
      let elseB = null;
      if (this.match("ELSE")) elseB = this.statementOrBlock();
      return { kind: "If", cond, then: thenB, else: elseB };
    }
    if (this.match("WHILE")) {
      this.expect("LPAREN", "'(' tras while");
      const cond = self.expression ? this.expression() : this.expression(); // seguro
      this.expect("RPAREN", ")' tras condición");
      const body = this.statementOrBlock();
      return { kind: "While", cond, body };
    }
    if (this.match("LBRACE")) {
      this.pos--;
      return this.block();
    }
    const t = this.peek();
    if (t.type === "IDENT") {
      const nameTok = this.expect("IDENT", "un identificador");
      this.expect("ASSIGN", "'=' en asignación");
      const expr = this.expression();
      this.expect("SEMI", "';' al final de la asignación");
      return {
        kind: "Assign",
        name: nameTok.lexeme,
        line: nameTok.line,
        col: nameTok.col,
        expr,
      };
    }
    throw new ParserError(
      `Error sintáctico: sentencia no válida empezando en línea ${
        t.line
      }, columna ${t.col} con '${
        t.lexeme || t.type
      }'. Use if/while/bloque o una asignación.`
    );
  }

  statementOrBlock() {
    if (this.match("LBRACE")) {
      this.pos--;
      return this.block();
    }
    return this.statement();
  }

  block() {
    this.expect("LBRACE", "'{' para abrir bloque");
    const stmts = [];
    while (!["RBRACE", "EOF"].includes(this.peek().type)) {
      stmts.push(this.statement());
    }
    this.expect("RBRACE", "'}' para cerrar bloque");
    return { kind: "Block", stmts };
  }

  expression() {
    return this.equality();
  }
  equality() {
    let n = this.relation();
    for (;;) {
      if (this.match("EQ"))
        n = { kind: "Binary", op: "==", left: n, right: this.relation() };
      else if (this.match("NEQ"))
        n = { kind: "Binary", op: "!=", left: n, right: this.relation() };
      else break;
    }
    return n;
  }
  relation() {
    let n = this.term();
    for (;;) {
      if (this.match("LT"))
        n = { kind: "Binary", op: "<", left: n, right: this.term() };
      else if (this.match("LE"))
        n = { kind: "Binary", op: "<=", left: n, right: this.term() };
      else if (this.match("GT"))
        n = { kind: "Binary", op: ">", left: n, right: this.term() };
      else if (this.match("GE"))
        n = { kind: "Binary", op: ">=", left: n, right: this.term() };
      else break;
    }
    return n;
  }
  term() {
    let n = this.factor();
    for (;;) {
      if (this.match("PLUS"))
        n = { kind: "Binary", op: "+", left: n, right: this.factor() };
      else if (this.match("MINUS"))
        n = { kind: "Binary", op: "-", left: n, right: this.factor() };
      else break;
    }
    return n;
  }
  factor() {
    let n = this.unary();
    for (;;) {
      if (this.match("STAR"))
        n = { kind: "Binary", op: "*", left: n, right: this.unary() };
      else if (this.match("SLASH"))
        n = { kind: "Binary", op: "/", left: n, right: this.unary() };
      else break;
    }
    return n;
  }
  unary() {
    if (this.match("MINUS"))
      return { kind: "Unary", op: "-", right: this.unary() };
    if (this.match("BANG"))
      return { kind: "Unary", op: "!", right: this.unary() };
    return this.primary();
  }
  primary() {
    const t = this.peek();
    if (this.match("NUMBER"))
      return { kind: "Num", value: parseInt(this.prev().lexeme, 10) };
    if (this.match("TRUE")) return { kind: "Bool", value: true };
    if (this.match("FALSE")) return { kind: "Bool", value: false };
    if (this.match("IDENT")) {
      const p = this.prev();
      return { kind: "Var", name: p.lexeme, line: p.line, col: p.col };
    }
    if (this.match("LPAREN")) {
      const e = this.expression();
      this.expect("RPAREN", ")' para cerrar la expresión");
      return e;
    }
    throw new ParserError(
      `Error sintáctico: expresión inesperada en línea ${t.line}, columna ${
        t.col
      }: '${t.lexeme || t.type}'.`
    );
  }
}

// ===== Semántica =====
function analyze(ast) {
  const symbols = new Map();
  const types = [];
  const setType = (label, typ) => types.push({ node: label, type: typ });
  const ensure = (name, line) => {
    if (!symbols.has(name))
      symbols.set(name, { name, type: null, firstLine: line, scope: "global" });
    return symbols.get(name);
  };

  const visit = (n) => {
    switch (n.kind) {
      case "Program":
        return visit(n.stmt);
      case "Block":
        n.stmts.forEach(visit);
        return null;
      case "Assign": {
        const rhs = visit(n.expr);
        const sym = ensure(n.name, n.line);
        if (sym.type == null) sym.type = rhs;
        else if (sym.type !== rhs)
          throw new SemanticError(
            `Error semántico: asignación incompatible a '${n.name}' en línea ${n.line}. Se esperaba ${sym.type} pero se obtuvo ${rhs}.`
          );
        return null;
      }
      case "Var": {
        const sym = ensure(n.name, n.line || 0);
        if (sym.type == null)
          throw new SemanticError(
            `Error semántico: variable '${n.name}' usada antes de ser inicializada (línea ${n.line}, col ${n.col}).`
          );
        setType(`var ${n.name}`, sym.type);
        return sym.type;
      }
      case "Num":
        setType(String(n.value), "int");
        return "int";
      case "Bool":
        setType(String(n.value), "bool");
        return "bool";
      case "Unary": {
        const rt = visit(n.right);
        if (n.op === "-") {
          if (rt !== "int")
            throw new SemanticError(
              "Error semántico: '-' sólo se aplica a enteros."
            );
          setType("(- ?)", "int");
          return "int";
        }
        if (n.op === "!") {
          if (rt !== "bool")
            throw new SemanticError(
              "Error semántico: '!' sólo se aplica a booleanos."
            );
          setType("(! ?)", "bool");
          return "bool";
        }
        return rt;
      }
      case "Binary": {
        const lt = visit(n.left);
        const rt = visit(n.right);
        if (["+", "-", "*", "/"].includes(n.op)) {
          if (lt !== "int" || rt !== "int")
            throw new SemanticError(
              "Error semántico: operadores aritméticos requieren enteros."
            );
          setType(`(? ${n.op} ?)`, "int");
          return "int";
        }
        if (["<", "<=", ">", ">="].includes(n.op)) {
          if (lt !== "int" || rt !== "int")
            throw new SemanticError(
              "Error semántico: comparaciones <,<=,>,>= requieren enteros."
            );
          setType(`(? ${n.op} ?)`, "bool");
          return "bool";
        }
        if (["==", "!="].includes(n.op)) {
          if (lt !== rt)
            throw new SemanticError(
              "'==' y '!=' requieren operandos del mismo tipo."
            );
          setType(`(? ${n.op} ?)`, "bool");
          return "bool";
        }
        return null;
      }
      case "If": {
        const ct = visit(n.cond);
        if (ct !== "bool")
          throw new SemanticError(
            "Error semántico: la condición del if debe ser booleana."
          );
        visit(n.then);
        if (n.else) visit(n.else);
        return null;
      }
      case "While": {
        const ct = visit(n.cond);
        if (ct !== "bool")
          throw new SemanticError(
            "Error semántico: la condición del while debe ser booleana."
          );
        visit(n.body);
        return null;
      }
    }
  };
  visit(ast);
  return { symbols, types };
}

// ===== TAC =====
function genTAC(ast) {
  const code = [];
  let tid = 0,
    lid = 0;
  const t = () => `t${++tid}`;
  const L = () => `L${++lid}`;
  const gen = (node) => {
    switch (node.kind) {
      case "Program":
        gen(node.stmt);
        return;
      case "Block":
        node.stmts.forEach(gen);
        return;
      case "Assign": {
        const p = genExpr(node.expr);
        code.push(`${node.name} = ${p}`);
        return;
      }
      case "If": {
        const c = genExpr(node.cond);
        const Ltrue = L(),
          Lfalse = L();
        const Lend = node.else ? L() : Lfalse;
        code.push(`if ${c} goto ${Ltrue}`);
        code.push(`goto ${Lfalse}`);
        code.push(`${Ltrue}:`);
        gen(node.then);
        if (node.else) {
          code.push(`goto ${Lend}`);
          code.push(`${Lfalse}:`);
          gen(node.else);
          code.push(`${Lend}:`);
        } else {
          code.push(`${Lfalse}:`);
        }
        return;
      }
      case "While": {
        const Lstart = L(),
          Lbody = L(),
          Lend = L();
        code.push(`${Lstart}:`);
        const c = genExpr(node.cond);
        code.push(`if ${c} goto ${Lbody}`);
        code.push(`goto ${Lend}`);
        code.push(`${Lbody}:`);
        gen(node.body);
        code.push(`goto ${Lstart}`);
        code.push(`${Lend}:`);
        return;
      }
    }
  };
  const genExpr = (node) => {
    switch (node.kind) {
      case "Num": {
        const tmp = t();
        code.push(`${tmp} = ${node.value}`);
        return tmp;
      }
      case "Bool": {
        const tmp = t();
        code.push(`${tmp} = ${node.value ? 1 : 0}`);
        return tmp;
      }
      case "Var":
        return node.name;
      case "Unary": {
        const r = genExpr(node.right);
        const tmp = t();
        code.push(`${tmp} = ${node.op} ${r}`);
        return tmp;
      }
      case "Binary": {
        const l = genExpr(node.left),
          r = genExpr(node.right);
        const tmp = t();
        code.push(`${tmp} = ${l} ${node.op} ${r}`);
        return tmp;
      }
    }
    const tmp = t();
    code.push(`${tmp} = <expr>`);
    return tmp;
  };
  gen(ast);
  return code;
}

// ===== AST → SVG (con target y zoom) =====
function astLabel(n) {
  switch (n.kind) {
    case "Program":
      return "Program";
    case "Block":
      return "Block";
    case "If":
      return "If";
    case "While":
      return "While";
    case "Assign":
      return `Assign(${n.name})`;
    case "Var":
      return `Var(${n.name})`;
    case "Num":
      return `Num(${n.value})`;
    case "Bool":
      return `Bool(${n.value})`;
    case "Unary":
      return `Unary(${n.op})`;
    case "Binary":
      return `Binary(${n.op})`;
  }
}
function astChildren(n) {
  switch (n.kind) {
    case "Program":
      return [n.stmt];
    case "Block":
      return n.stmts;
    case "If":
      return [n.cond, n.then, ...(n.else ? [n.else] : [])];
    case "While":
      return [n.cond, n.body];
    case "Assign":
      return [n.expr];
    case "Unary":
      return [n.right];
    case "Binary":
      return [n.left, n.right];
    default:
      return [];
  }
}
function computeLayout(node, depth = 0, xoff = 0, xsp = 120, ysp = 90) {
  const ch = astChildren(node);
  if (ch.length === 0) {
    const pos = new Map([[node, { x: xoff, y: depth * ysp }]]);
    return { pos, width: 1 };
  }
  let pos = new Map();
  let curx = xoff;
  let total = 0;
  for (const c of ch) {
    const r = computeLayout(c, depth + 1, curx, xsp, ysp);
    r.pos.forEach((v, k) => pos.set(k, v));
    curx += r.width + 1;
    total += r.width;
  }
  const center = (xoff + (curx - 1)) / 2;
  pos.set(node, { x: center, y: depth * ysp });
  return { pos, width: Math.max(total, 1) };
}
function drawASTInto(node, svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!node) return;
  const { pos } = computeLayout(node, 0, 0);
  const nodes = Array.from(pos.keys());
  const coords = nodes.map((n) => pos.get(n));
  const minX = Math.min(...coords.map((p) => p.x));
  const shiftX = (x) => (x - minX) * 120 + 60;
  const shiftY = (y) => y + 40;

  // edges
  for (const parent of nodes) {
    for (const ch of astChildren(parent)) {
      const p = pos.get(parent),
        c = pos.get(ch);
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", shiftX(p.x));
      line.setAttribute("y1", shiftY(p.y));
      line.setAttribute("x2", shiftX(c.x));
      line.setAttribute("y2", shiftY(c.y));
      line.setAttribute("stroke", "#334155");
      line.setAttribute("stroke-width", "1.5");
      svg.appendChild(line);
    }
  }
  // nodes
  for (const n of nodes) {
    const p = pos.get(n);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const cx = shiftX(p.x),
      cy = shiftY(p.y);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", cx - 50);
    rect.setAttribute("y", cy - 16);
    rect.setAttribute("rx", 10);
    rect.setAttribute("width", 100);
    rect.setAttribute("height", 32);
    rect.setAttribute("fill", "#e2e8f0");
    rect.setAttribute("stroke", "#64748b");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", cx);
    text.setAttribute("y", cy + 4);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#0f172a");
    text.textContent = astLabel(n);
    g.appendChild(rect);
    g.appendChild(text);
    svg.appendChild(g);
  }
  const rects = Array.from(svg.querySelectorAll("rect"));
  if (rects.length) {
    const maxX = Math.max(
      ...rects.map(
        (r) =>
          parseFloat(r.getAttribute("x")) + parseFloat(r.getAttribute("width"))
      )
    );
    const maxY = Math.max(
      ...rects.map(
        (r) =>
          parseFloat(r.getAttribute("y")) + parseFloat(r.getAttribute("height"))
      )
    );
    svg.setAttribute("width", Math.max(800, maxX + 60));
    svg.setAttribute("height", Math.max(400, maxY + 60));
  }
}

// ===== Pipeline =====
let LAST = null; // último resultado o parcial

function compileSource(source) {
  const result = {
    phase: null,
    error: null,
    tokens: [],
    ast: null,
    symbols: [],
    types: [],
    tac: [],
  };
  try {
    const tokens = tokenize(source);
    result.tokens = tokens;
    setPhase({ lex: "ok", syn: "pending", sem: "pending", tac: "pending" });
  } catch (e) {
    result.phase = "Análisis léxico";
    result.error = e.message;
    throw result;
  }

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

  const tac = genTAC(ast);
  result.tac = tac;
  setPhase({ lex: "ok", syn: "ok", sem: "ok", tac: "ok" });
  return result;
}

// ===== UI =====
const code = $("#code");
$("#btnIf").addEventListener("click", () => {
  code.value = "{ x = 0; if (x < 10) { y = x + 1; } else { y = 0; } }";
});
$("#btnWhile").addEventListener("click", () => {
  code.value = "{ x = 0; while (x < 5) { x = x + 1; } }";
});
$("#btnClear").addEventListener("click", () => {
  code.value = "";
  $("#phase").innerHTML = "";
  LAST = null;
});

$("#btnRun").addEventListener("click", () => {
  const src = code.value.trim();
  if (!src) {
    openModalHtml(
      "Atención",
      '<p>Pega una sentencia <code class="mono">if</code> o <code class="mono">while</code>.</p>'
    );
    return;
  }
  try {
    const res = compileSource(src);
    LAST = res;
  } catch (r) {
    LAST = r; // parcial (tiene tokens y quizá AST)
    // marcar fase
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
    // Modal de error
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
});

// ——— Botones de modales ———
function attachModalButton(btnId, openFn) {
  const btn = document.getElementById(btnId);
  const handler = () => openFn();
  btn.addEventListener("click", handler);
  if (OPEN_ON_HOVER) btn.addEventListener("mouseenter", handler);
}

attachModalButton("btnTOK", () => {
  if (!LAST || !LAST.tokens?.length) {
    openModalHtml("Tokens", "<p>No hay tokens aún. Analiza primero.</p>");
    return;
  }
  const rows = LAST.tokens.map((t, i) => [
    String(i),
    t.type,
    t.lexeme ?? "",
    String(t.line),
    String(t.col),
  ]);
  const table = makeTable(["#", "Tipo", "Lexema", "Línea", "Col"], rows);
  openModal("Tokens (léxico)", table);
});

attachModalButton("btnSYM", () => {
  if (!LAST || !LAST.symbols) {
    openModalHtml("Símbolos", "<p>No hay datos. Analiza primero.</p>");
    return;
  }
  const rows = LAST.symbols.map((s) => [
    s.name,
    s.type ?? "—",
    String(s.firstLine ?? "—"),
    s.scope || "global",
  ]);
  const table = makeTable(["Identificador", "Tipo", "Línea", "Ámbito"], rows);
  openModal("Tabla de símbolos", table);
});

attachModalButton("btnTYP", () => {
  if (!LAST || !LAST.types) {
    openModalHtml("Tipos", "<p>No hay datos. Analiza primero.</p>");
    return;
  }
  const rows = LAST.types.map((t) => [t.node, t.type]);
  const table = makeTable(["Nodo", "Tipo"], rows);
  openModal("Tabla de tipos", table);
});

attachModalButton("btnTAC", () => {
  if (!LAST || !LAST.tac?.length) {
    if (!LAST) openModalHtml("TAC", "<p>Analiza primero.</p>");
    else
      openModalHtml(
        "TAC",
        "<p>No se generó TAC (puede haber error semántico o sintáctico).</p>"
      );
    return;
  }
  const pre = document.createElement("pre");
  pre.className = "mono text-sm bg-slate-50 p-3 rounded-xl overflow-auto";
  pre.textContent = LAST.tac.join("\n");
  openModal("Código a 3 direcciones (TAC)", pre);
});

attachModalButton("btnAST", () => {
  if (!LAST || !LAST.ast) {
    if (!LAST) openModalHtml("AST", "<p>Analiza primero.</p>");
    else
      openModalHtml(
        "AST",
        "<p>No hay AST disponible (probable error de sintaxis).</p>"
      );
    return;
  }
  // Contenido AST con toolbar
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
  // Zoom
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
});

// Estado inicial
setPhase({ lex: "pending", syn: "pending", sem: "pending", tac: "pending" });
