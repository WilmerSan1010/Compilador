// compiler/lexer.js
import { LexError } from "./errors.js";

// =======================================================
// LÉXICO: DEFINICIÓN DE TOKENS Y TOKENIZER
// =======================================================

/**
 * Palabras reservadas del lenguaje y su tipo de token.
 */
export const KEYWORDS = {
  if: "IF",
  else: "ELSE",
  true: "TRUE",
  false: "FALSE",
};

/**
 * Símbolos de un solo carácter y su tipo de token.
 */
export const SIMPLE = {
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
export const TOKEN_LABELS = {
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
  ASSIGN: "Operador '='",
  BANG: "Operador '!'",
  LT: "Operador '<'",
  GT: "Operador '>'",
  LE: "Operador '<='",
  GE: "Operador '>='",
  EQ: "Operador '=='",
  NEQ: "Operador '!='",
  EOF: "Fin de entrada",
};

/**
 * Devuelve una etiqueta legible en español para un tipo de token.
 * Si no existe etiqueta en TOKEN_LABELS, devuelve el tipo crudo.
 */
export function tokenTypeLabel(ttype) {
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
export function tokenize(src) {
  const toks = [];
  let i = 0,
    line = 1;
  const len = src.length;

  // Avanza n caracteres en la entrada
  const adv = (n = 1) => {
    i += n;
  };

  while (i < len) {
    const c = src[i];

    // Espacios en blanco (excepto salto de línea)
    if (c === " " || c === "\t" || c === "\r") {
      adv();
      continue;
    }

    // Manejo de salto de línea
    if (c === "\n") {
      i++;
      line++;
      continue;
    }

    // Identificadores o palabras reservadas
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") {
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
      toks.push({ type: ttype, lexeme: lex, line });
      continue;
    }

    // Números (enteros)
    if (c >= "0" && c <= "9") {
      let s = i;
      adv();
      while (i < len && src[i] >= "0" && src[i] <= "9") adv();
      const lex = src.slice(s, i);
      toks.push({ type: "NUMBER", lexeme: lex, line });
      continue;
    }

    // Operadores de dos caracteres: ==, !=, <=, >=
    const two = src.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=") {
      let type;
      if (two === "==") type = "EQ";
      else if (two === "!=") type = "NEQ";
      else if (two === "<=") type = "LE";
      else type = "GE";
      toks.push({ type, lexeme: two, line });
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
      toks.push({ type: SIMPLE[c], lexeme: c, line });
      adv();
      
      continue;
    }

    // Carácter desconocido → error léxico
    throw new LexError(
      `Error léxico: carácter inválido '${c}' en línea ${line}.`
    );
  }

  // Token final de fin de entrada
  toks.push({ type: "EOF", lexeme: "", line });
  return toks;
}
