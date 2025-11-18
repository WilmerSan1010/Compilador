// compiler/lexer.js
import { LexError } from "./errors.js";

// =======================================================
// LÉXICO: COMPILADOR DE FÓRMULAS ARITMÉTICAS
// =======================================================

/**
 * Palabras reservadas del lenguaje (ninguna en este compilador simple).
 */
export const KEYWORDS = {};

/**
 * Símbolos de un solo carácter y su tipo de token.
 */
export const SIMPLE = {
  "(": "LPAREN",
  ")": "RPAREN",
  "+": "PLUS",
  "-": "MINUS",
  "*": "STAR",
  "/": "SLASH",
};

/**
 * Etiquetas en español para mostrar el tipo de token en la UI.
 */
export const TOKEN_LABELS = {
  IDENT: "Identificador",
  NUMBER: "Número",
  LPAREN: "Paréntesis izquierdo '('",
  RPAREN: "Paréntesis derecho ')'",
  PLUS: "Operador '+'",
  MINUS: "Operador '-'",
  STAR: "Operador '*'",
  SLASH: "Operador '/'",
  EOF: "Fin de entrada",
};

/**
 * Devuelve una etiqueta legible en español para un tipo de token.
 */
export function tokenTypeLabel(ttype) {
  return TOKEN_LABELS[ttype] || ttype;
}

/**
 * Tokeniza una fórmula aritmética.
 * Cada token tiene:
 *   - type: tipo de token
 *   - lexeme: texto original del token
 *   - line: ubicación en el código
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

    // Identificadores (letras, números, guiones bajos)
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
      toks.push({ type: "IDENT", lexeme: lex, line });
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

    // Comentarios de línea: // ...
    const two = src.slice(i, i + 2);
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
