// compiler/errors.js

/**
 * Error léxico: problemas al convertir el texto en tokens.
 */
export class LexError extends Error {}

/**
 * Error sintáctico: problemas al estructurar tokens en un AST.
 */
export class ParserError extends Error {}

/**
 * Error semántico: problemas de tipos, variables sin inicializar, etc.
 */
export class SemanticError extends Error {}
