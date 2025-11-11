import { ParserError } from "./errors.js";
// =======================================================
// PARSER: CONSTRUCCIÓN DEL AST
// =======================================================

/**
 * Parser recursivo descendente para el lenguaje.
 * Consume la lista de tokens producida por tokenize y construye un AST.
 */
export class Parser {
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