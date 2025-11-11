// =======================================================
// CONFIGURACIÓN GENERAL
// =======================================================

/**
 * Controla cómo se abren los modales de detalle (tokens, símbolos, AST, etc.)
 * - false → solo se abren al hacer clic.
 * - true  → se abren tanto al hacer clic como al pasar el mouse (hover).
 */
const OPEN_ON_HOVER = false;

// =======================================================
// HELPERS DOM / UI
// =======================================================

/**
 * Atajo para document.querySelector.
 * @param {string} sel - Selector CSS.
 * @returns {Element|null} - Primer elemento que coincide o null.
 */
const $ = (sel) => document.querySelector(sel);

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
    // Si no se especifica estado para una fase, se marca "pending"
    s.className = `badge ${colors[badges[k] || "pending"]}`;
    s.textContent = labels[k];
    frag.appendChild(s);
  }
  const phase = $("#phase");
  phase.innerHTML = "";
  phase.appendChild(frag);
}

/**
 * Crea una tabla HTML a partir de cabeceras y filas.
 * @param {string[]} headers - Textos de la fila de cabecera.
 * @param {string[][]} rows - Matriz de filas; cada fila es un array de celdas.
 * @returns {HTMLTableElement} - Tabla lista para insertar en el DOM.
 */
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

// =======================================================
// SISTEMA DE MODALES (GENÉRICO)
// =======================================================

// Referencias a elementos del modal principal
const modal = $("#modalRoot");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");
const modalClose = $("#modalClose");
const modalOk = $("#modalOk");

/**
 * Abre el modal usando un nodo ya construido (por ejemplo una tabla).
 * @param {string} title - Título a mostrar en la cabecera del modal.
 * @param {Node} node - Nodo DOM que se insertará en el cuerpo del modal.
 */
function openModal(title, node) {
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
function openModalHtml(title, html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  openModal(title, div);
}

/**
 * Cierra el modal y restablece el scroll del body.
 */
function closeModal() {
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

// Eventos básicos de cerrado del modal
modalClose.addEventListener("click", closeModal);
modalOk.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  // Permite cerrar haciendo clic en elementos que tengan data-close-modal
  if (e.target.hasAttribute("data-close-modal")) closeModal();
});

// =======================================================
// CLASES DE ERRORES ESPECÍFICOS
// =======================================================

/**
 * Error léxico: problemas al convertir el texto en tokens.
 */
class LexError extends Error { }

/**
 * Error sintáctico: problemas al estructurar tokens en un AST.
 */
class ParserError extends Error { }

/**
 * Error semántico: problemas de tipos, variables sin inicializar, etc.
 */
class SemanticError extends Error { }

// =======================================================
// LÉXICO: DEFINICIÓN DE TOKENS Y TOKENIZER
// =======================================================

/**
 * Palabras reservadas del lenguaje y su tipo de token.
 */
const KEYWORDS = {
  if: "IF",
  else: "ELSE",
  true: "TRUE",
  false: "FALSE",
};

/**
 * Símbolos de un solo carácter y su tipo de token.
 */
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

/**
 * Etiquetas en español para mostrar el tipo de token en la UI.
 * Se usan principalmente en la tabla de tokens.
 */
const TOKEN_LABELS = {
  IF: "Palabra clave: if",
  ELSE: "Palabra clave: else",
  TRUE: "Booleano: true",
  FALSE: "Booleano: false",
  IDENT: "Identificador",
  NUMBER: "Número",
  LPAREN: "Paréntesis izquierdo '('",
  RPAREN: "Paréntesis derecho ')'",
  LBRACE: "Llave izquierda '{'",
  RBRACE: "Llave derecha '}'",
  SEMI: "Punto y coma ';'",
  PLUS: "Operador '+'",
  MINUS: "Operador '-'",
  STAR: "Operador '*'",
  SLASH: "Operador '/'",
  ASSIGN: "Asignación '='",
  BANG: "Negación '!'",
  LT: "Operador '<'",
  GT: "Operador '>'",
  EQ: "Operador '=='",
  NEQ: "Operador '!='",
  LE: "Operador '<='",
  GE: "Operador '>='",
  EOF: "Fin de entrada",
};

/**
 * Devuelve una etiqueta legible en español para un tipo de token.
 * Si no existe etiqueta en TOKEN_LABELS, devuelve el tipo crudo.
 */
function tokenTypeLabel(ttype) {
  return TOKEN_LABELS[ttype] || ttype;
}

/**
 * Convierte el código fuente (string) en una lista de tokens.
 * Cada token tiene:
 *   - type: tipo de token
 *   - lexeme: texto original del token
 *   - line, col: ubicación en el código (para mensajes de error)
 *
 * Lanza LexError si encuentra un carácter no reconocido.
 */
function tokenize(src) {
  const toks = [];
  let i = 0,
    line = 1,
    col = 1;
  const len = src.length;

  // Avanza n caracteres en la entrada, actualizando columna
  const adv = (n = 1) => {
    i += n;
    col += n;
  };

  while (i < len) {
    const c = src[i];

    // Ignorar espacios, tabuladores y retornos de carro
    if (c === " " || c === "\t" || c === "\r") {
      adv();
      continue;
    }

    // Manejo de salto de línea
    if (c === "\n") {
      i++;
      line++;
      col = 1;
      continue;
    }

    // Identificadores o palabras reservadas
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

    // Números enteros
    if (c >= "0" && c <= "9") {
      const sc = col;
      let s = i;
      adv();
      while (i < len && src[i] >= "0" && src[i] <= "9") adv();
      const lex = src.slice(s, i);
      toks.push({ type: "NUMBER", lexeme: lex, line, col: sc });
      continue;
    }

    // Operadores de dos caracteres: ==, !=, <=, >=
    const two = src.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      const map = { "==": "EQ", "!=": "NEQ", "<=": "LE", ">=": "GE" };
      toks.push({ type: map[two], lexeme: two, line, col });
      adv(2);
      continue;
    }

    // Comentarios de línea: // ...
    if (two === "//") {
      while (i < len && src[i] !== "\n") i++;
      continue;
    }

    // Operadores y símbolos de un carácter
    if (SIMPLE[c]) {
      toks.push({ type: SIMPLE[c], lexeme: c, line, col });
      adv();
      continue;
    }

    // Carácter desconocido → error léxico
    throw new LexError(
      `Error léxico: carácter inválido '${c}' en línea ${line}, columna ${col}.`
    );
  }

  // Token final de fin de entrada
  toks.push({ type: "EOF", lexeme: "", line, col });
  return toks;
}

// =======================================================
// PARSER: CONSTRUCCIÓN DEL AST
// =======================================================

/**
 * Parser recursivo descendente para el lenguaje.
 * Consume la lista de tokens producida por tokenize y construye un AST.
 */
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this._prev = null;
  }

  /** Token actual sin consumir. */
  peek() {
    return this.tokens[this.pos];
  }

  /** Último token consumido (útil para recuperar lexema, línea, col). */
  prev() {
    return this._prev;
  }

  /**
   * Intenta consumir uno de los tipos de token indicados.
   * @param  {...string} types - Tipos de token aceptables.
   * @returns {object|null} - Token consumido o null si no coincide.
   */
  match(...types) {
    const t = this.peek();
    if (types.includes(t.type)) {
      this.pos++;
      this._prev = t;
      return t;
    }
    return null;
  }

  /**
   * Consume obligatoriamente un token de tipo ttype.
   * Si no coincide, lanza ParserError con el mensaje dado.
   */
  expect(ttype, msg) {
    const t = this.peek();
    if (t.type === ttype) {
      this.pos++;
      this._prev = t;
      return t;
    }
    throw new ParserError(
      `Error sintáctico: se esperaba ${msg} en línea ${t.line}, columna ${t.col
      }, pero se encontró '${t.lexeme || t.type}'.`
    );
  }

  /**
   * Punto de entrada al análisis sintáctico.
   * Espera una única sentencia seguida de EOF y la envuelve en un nodo "Program".
   */
  parse() {
    const stmts = [];
    while (this.peek().type !== "EOF") {
      stmts.push(this.statement());
    }
    this.expect("EOF", "fin de entrada");
    return { kind: "Program", stmts };
  }


  /**
   * Analiza una sentencia:
   * - if (...) sentencia o bloque [else ...]
   * - while (...) sentencia o bloque
   * - bloque { ... }
   * - asignación: IDENT = expresión;
   */
  statement() {
    // Sentencia if
    if (this.match("IF")) {
      this.expect("LPAREN", "'(' tras if");
      const cond = this.expression();
      this.expect("RPAREN", ")' tras condición");
      const thenB = this.statementOrBlock();
      let elseB = null;
      if (this.match("ELSE")) elseB = this.statementOrBlock();
      return { kind: "If", cond, then: thenB, else: elseB };
    }


    // Bloque { ... }
    if (this.match("LBRACE")) {
      // Devolvemos el token un paso atrás para que block() pueda leer '{'
      this.pos--;
      return this.block();
    }

    // Asignación: IDENT = expresión;
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

    // Si no encaja nada, error sintáctico genérico
    throw new ParserError(
      `Error sintáctico: sentencia no válida empezando en línea ${t.line
      }, columna ${t.col} con '${t.lexeme || t.type
      }'. Use if/while/bloque o una asignación.`
    );
  }

  /**
   * Permite usar una sentencia simple o un bloque tras if/while.
   * - Si encuentra '{', delega en block().
   * - Si no, interpreta una sentencia sencilla.
   */
  statementOrBlock() {
    if (this.match("LBRACE")) {
      this.pos--;
      return this.block();
    }
    return this.statement();
  }

  /**
   * Analiza un bloque:
   * { sentencia* }
   */
  block() {
    this.expect("LBRACE", "'{' para abrir bloque");
    const stmts = [];
    while (!["RBRACE", "EOF"].includes(this.peek().type)) {
      stmts.push(this.statement());
    }
    this.expect("RBRACE", "'}' para cerrar bloque");
    return { kind: "Block", stmts };
  }

  // -------------------- Expresiones --------------------

  /**
   * Punto de entrada de expresiones.
   * Actualmente solo delega en equality() para estructurar la precedencia.
   */
  expression() {
    return this.equality();
  }

  /**
   * equality → relation ( (== | !=) relation )*
   */
  equality() {
    let n = this.relation();
    for (; ;) {
      if (this.match("EQ"))
        n = { kind: "Binary", op: "==", left: n, right: this.relation() };
      else if (this.match("NEQ"))
        n = { kind: "Binary", op: "!=", left: n, right: this.relation() };
      else break;
    }
    return n;
  }

  /**
   * relation → term ( (< | <= | > | >=) term )*
   */
  relation() {
    let n = this.term();
    for (; ;) {
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

  /**
   * term → factor ( (+ | -) factor )*
   */
  term() {
    let n = this.factor();
    for (; ;) {
      if (this.match("PLUS"))
        n = { kind: "Binary", op: "+", left: n, right: this.factor() };
      else if (this.match("MINUS"))
        n = { kind: "Binary", op: "-", left: n, right: this.factor() };
      else break;
    }
    return n;
  }

  /**
   * factor → unary ( (* | /) unary )*
   */
  factor() {
    let n = this.unary();
    for (; ;) {
      if (this.match("STAR"))
        n = { kind: "Binary", op: "*", left: n, right: this.unary() };
      else if (this.match("SLASH"))
        n = { kind: "Binary", op: "/", left: n, right: this.unary() };
      else break;
    }
    return n;
  }

  /**
   * unary → (- | !) unary | primary
   */
  unary() {
    if (this.match("MINUS"))
      return { kind: "Unary", op: "-", right: this.unary() };
    if (this.match("BANG"))
      return { kind: "Unary", op: "!", right: this.unary() };
    return this.primary();
  }

  /**
   * primary → NUMBER | TRUE | FALSE | IDENT | "(" expression ")"
   */
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

    // Si nada coincide, error de expresión inesperada
    throw new ParserError(
      `Error sintáctico: expresión inesperada en línea ${t.line}, columna ${t.col
      }: '${t.lexeme || t.type}'.`
    );
  }
}

// =======================================================
// ANÁLISIS SEMÁNTICO
// =======================================================

/**
 * Recorre el AST comprobando reglas semánticas:
 * - Variables deben inicializarse antes de usarse.
 * - Operadores deben aplicarse a tipos correctos.
 * - Condiciones de if/while deben ser booleanas.
 *
 * @param {object} ast - AST raíz (Program).
 * @returns {{symbols: Map, types: Array}} - Tabla de símbolos y anotaciones de tipos.
 */
function analyze(ast) {
  const symbols = new Map(); // nombre → info de símbolo
  const types = []; // anotaciones de tipo sobre nodos

  const setType = (label, typ) => types.push({ node: label, type: typ });

  /**
   * Recupera la entrada de símbolo para una variable,
   * creándola si aún no existía.
   */
  const ensure = (name, line) => {
    if (!symbols.has(name))
      symbols.set(name, {
        name,
        type: null,
        firstLine: line,
        scope: "global",
      });
    return symbols.get(name);
  };

  /**
   * Función recursiva de visita de nodos del AST.
   * Devuelve el tipo del nodo cuando aplica (expresiones).
   */
  const visit = (n) => {
    switch (n.kind) {
      case "Program":
        n.stmts.forEach(visit);
        return null;


      case "Block":
        n.stmts.forEach(visit);
        return null;

      case "Assign": {
        const rhs = visit(n.expr); // tipo de la expresión a la derecha
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

        // Operadores aritméticos
        if (["+", "-", "*", "/"].includes(n.op)) {
          if (lt !== "int" || rt !== "int")
            throw new SemanticError(
              "Error semántico: operadores aritméticos requieren enteros."
            );
          setType(`(? ${n.op} ?)`, "int");
          return "int";
        }

        // Comparaciones numéricas
        if (["<", "<=", ">", ">="].includes(n.op)) {
          if (lt !== "int" || rt !== "int")
            throw new SemanticError(
              "Error semántico: comparaciones <,<=,>,>= requieren enteros."
            );
          setType(`(? ${n.op} ?)`, "bool");
          return "bool";
        }

        // Igualdad / desigualdad
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
    }
  };

  // Lanzamos el análisis desde la raíz
  visit(ast);
  return { symbols, types };
}

// =======================================================
// GENERACIÓN DE CÓDIGO TAC (TRES DIRECCIONES)
// =======================================================

/**
 * Genera código TAC (Three Address Code) a partir del AST.
 * Devuelve un array de instrucciones en forma de strings.
 */
function genTAC(ast) {
  const code = [];
  let tid = 0,
    lid = 0;

  // Generador de temporales t1, t2, ...
  const t = () => `t${++tid}`;

  // Generador de etiquetas L1, L2, ...
  const L = () => `L${++lid}`;

  /**
   * Genera código TAC para sentencias.
   */
  const gen = (node) => {
    switch (node.kind) {
      case "Program":
        node.stmts.forEach(gen);
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
    }
  };

  /**
   * Genera código TAC para expresiones y devuelve el "resultado"
   * (nombre de temporal o variable).
   */
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

    // Caso de seguridad para nodos no esperados
    const tmp = t();
    code.push(`${tmp} = <expr>`);
    return tmp;
  };

  gen(ast);
  return code;
}

// =======================================================
// AST → SVG (CÁLCULO DE POSICIONES Y DIBUJO)
// =======================================================

/**
 * Devuelve una etiqueta legible en español según el tipo de nodo AST.
 */
function astLabel(n) {
  switch (n.kind) {
    case "Program":
      return "prog";      
    case "Block":
      return "{}";       
    case "If":
      return "if";
    case "Assign":
      return "=";         
    case "Var":
      return n.name;      
    case "Num":
      return String(n.value);          
    case "Bool":
      return n.value ? "true" : "false";
    case "Unary":
      return n.op;        
    case "Binary":
      return n.op;       
    default:
      return n.kind;      
  }
}

/**
 * Devuelve los hijos directos de un nodo del AST.
 * Se usa para recorrer el árbol de manera genérica.
 */
function astChildren(n) {
  switch (n.kind) {
    case "Program":
      return n.stmts;
    case "Block":
      return n.stmts;
    case "If":
      return [n.cond, n.then, ...(n.else ? [n.else] : [])];
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

/**
 * Calcula un layout (x, y) lógico para cada nodo del AST.
 * @param {object} node - Nodo AST raíz del subárbol.
 * @param {number} depth - Profundidad actual.
 * @param {number} xoff - Desplazamiento en x.
 * @param {number} xsp - Espaciado horizontal entre nodos.
 * @param {number} ysp - Espaciado vertical entre niveles.
 * @returns {{pos: Map, width: number}} - Map de nodo → {x,y} y ancho del subárbol.
 */
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

/**
 * Dibuja el AST en un elemento SVG:
 * - Primero calcula las posiciones de los nodos.
 * - Luego dibuja líneas (edges) y rectángulos con texto (nodes).
 *
 * @param {object} node - Nodo raíz del AST.
 * @param {SVGElement} svg - SVG donde se dibujará el árbol.
 */
function drawASTInto(node, svg) {
  // Limpia el SVG
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!node) return;

  const { pos } = computeLayout(node, 0, 0);
  const nodes = Array.from(pos.keys());
  const coords = nodes.map((n) => pos.get(n));
  const minX = Math.min(...coords.map((p) => p.x));

  const shiftX = (x) => (x - minX) * 120 + 60;
  const shiftY = (y) => y + 40;

  // --- Dibujo de aristas (líneas) ---
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

  // --- Dibujo de nodos (rect + texto) ---
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

  // Ajuste automático del tamaño del SVG según el contenido dibujado
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
$("#btnIf").addEventListener("click", () => {
  code.value = "if (3 < 5) { y = 10; } else { y = 0; }";
});


// Botón para limpiar el código y el estado
$("#btnClear").addEventListener("click", () => {
  code.value = "";
  $("#phase").innerHTML = "";
  LAST = null;
});

/**
 * Botón principal de ejecución.
 * - Si no hay código, muestra un aviso en modal.
 * - Si hay código, ejecuta compileSource.
 * - Si hay error en alguna fase, muestra un modal con información
 *   y marca la fase correspondiente como error.
 */
$("#btnRun").addEventListener("click", () => {
  const src = code.value.trim();
  if (!src) {
    openModalHtml(
      "Atención",
      '<p>Pega una sentencia <code class="mono">if</code> o <code class="mono">while</code> (no hace falta envolver todo entre <code class="mono">{ }</code>).</p>'
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
});

// -------------------- Botones para abrir modales de detalle --------------------

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
  const handler = () => openFn();
  btn.addEventListener("click", handler);
  if (OPEN_ON_HOVER) btn.addEventListener("mouseenter", handler);
}

// --- Modal de tokens (léxico) ---
attachModalButton("btnTOK", () => {
  if (!LAST || !LAST.tokens?.length) {
    openModalHtml("Tokens", "<p>No hay tokens aún. Analiza primero.</p>");
    return;
  }
  const rows = LAST.tokens.map((t, i) => [
    String(i),
    tokenTypeLabel(t.type), // tipo mostrado en español
    t.lexeme ?? "",
    String(t.line),
    String(t.col),
  ]);
  const table = makeTable(["#", "Tipo", "Lexema", "Línea", "Col"], rows);
  openModal("Tokens (léxico)", table);
});

// --- Modal de tabla de símbolos ---
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

// --- Modal de tipos (anotaciones semánticas) ---
attachModalButton("btnTYP", () => {
  if (!LAST || !LAST.types) {
    openModalHtml("Tipos", "<p>No hay datos. Analiza primero.</p>");
    return;
  }
  const rows = LAST.types.map((t) => [t.node, t.type]);
  const table = makeTable(["Nodo", "Tipo"], rows);
  openModal("Tabla de tipos", table);
});

// Nota: el botón de TAC fue eliminado en la UI, pero la función genTAC sigue existiendo.

// --- Modal de AST (con zoom y scroll) ---
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
});

// =======================================================
// ESTADO INICIAL DE LA UI
// =======================================================

// Al cargar la página, todas las fases se muestran como "pendientes".
setPhase({ lex: "pending", syn: "pending", sem: "pending", tac: "pending" });
