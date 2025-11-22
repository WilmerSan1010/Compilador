import { ParserError } from "./errors.js";

// =======================================================
// PARSER: EXPRESIONES ARITMÉTICAS
// =======================================================

/**
 * Parser recursivo descendente para expresiones aritméticas.
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

  /** Último token consumido. */
  prev() {
    return this._prev;
  }

  /**
   * Intenta consumir uno de los tipos de token indicados.
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
   */
  expect(ttype, msg) {
    const t = this.peek();
    if (t.type === ttype) {
      this.pos++;
      this._prev = t;
      return t;
    }
    throw new ParserError(
      `Error sintáctico: se esperaba ${msg} en línea ${t.line}, pero se encontró '${t.lexeme || t.type}'.`
    );
  }

  /**
   * Punto de entrada: parsea una expresión aritmética.
   */
  parse() {
    const expr = this.expression();
    this.expect("EOF", "fin de entrada");
    return { kind: "Program", expr };
  }

  /**
   * expression → term ( (+ | -) term )*
   */
  expression() {
    let n = this.term();
    for (; ;) {
      if (this.match("PLUS")) {
        const opLine = this.prev().line;
        if (this.peek().type === "EOF") {
          throw new ParserError(
            `Error sintáctico: se esperaba un operando después de '+' en línea ${opLine}.`
          );
        }
        n = { kind: "Binary", op: "+", left: n, right: this.term() };
      } else if (this.match("MINUS")) {
        const opLine = this.prev().line;
        if (this.peek().type === "EOF") {
          throw new ParserError(
            `Error sintáctico: se esperaba un operando después de '-' en línea ${opLine}.`
          );
        }
        n = { kind: "Binary", op: "-", left: n, right: this.term() };
      } else break;
    }
    return n;
  }

  /**
   * term → factor ( (* | /) factor )*
   */
  term() {
    let n = this.factor();
    for (; ;) {
      if (this.match("STAR")) {
        const opLine = this.prev().line;
        if (this.peek().type === "EOF") {
          throw new ParserError(
            `Error sintáctico: se esperaba un operando después de '*' en línea ${opLine}.`
          );
        }
        n = { kind: "Binary", op: "*", left: n, right: this.factor() };
      } else if (this.match("SLASH")) {
        const opLine = this.prev().line;
        if (this.peek().type === "EOF") {
          throw new ParserError(
            `Error sintáctico: se esperaba un operando después de '/' en línea ${opLine}.`
          );
        }
        n = { kind: "Binary", op: "/", left: n, right: this.factor() };
      } else break;
    }
    return n;
  }

  /**
   * factor → unary
   */
  factor() {
    return this.unary();
  }

  /**
   * unary → (-) unary | primary
   */
  unary() {
    if (this.match("MINUS"))
      return { kind: "Unary", op: "-", right: this.unary() };
    return this.primary();
  }

  /**
   * primary → NUMBER | IDENT | "(" expression ")"
   */
  primary() {
    const t = this.peek();

    if (this.match("NUMBER"))
      return { kind: "Num", value: parseInt(this.prev().lexeme, 10) };

    if (this.match("IDENT")) {
      const p = this.prev();
      return { kind: "Var", name: p.lexeme, line: p.line };
    }

    if (this.match("LPAREN")) {
      const e = this.expression();
      this.expect("RPAREN", ")' para cerrar la expresión");
      return e;
    }

    // Si nada coincide, error de expresión inesperada
    throw new ParserError(
      `Error sintáctico: expresión inesperada en línea ${t.line}: '${t.lexeme || t.type}'.`
    );
  }
}