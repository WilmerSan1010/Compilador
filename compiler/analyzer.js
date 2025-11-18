import { SemanticError } from "./errors.js";
// =======================================================
// ANÁLISIS SEMÁNTICO
// =======================================================

/**
 * Recorre el AST comprobando reglas semánticas:
 * - Variables deben inicializarse antes de usarse.
 * - Operadores deben aplicarse a tipos correctos.
 * - Condiciones de if deben ser booleanas.
 *
 * @param {object} ast - AST raíz (Program).
 * @returns {{symbols: Map, types: Array}} - Tabla de símbolos y anotaciones de tipos.
 */
export function analyze(ast) {
  const symbols = new Map(); // nombre → info de símbolo
  const types = []; // anotaciones de tipo sobre nodos

  const setType = (label, typ) => types.push({ node: label, type: typ });

  const ensure = (name, line) => {
    if (!symbols.has(name)) {
      symbols.set(name, {
        name,
        type: null,
        firstLine: line,
        scope: "global",
      });
    }
    return symbols.get(name);
  };

  const visit = (n) => {
    switch (n.kind) {
      case "Program":
        n.stmts.forEach(visit);
        return null;

      case "Block":
        n.stmts.forEach(visit);
        return null;

      case "Assign": {
        const rhs = visit(n.expr);
        const sym = ensure(n.name, n.line);
        if (sym.type == null) {
          sym.type = rhs;
        } else if (sym.type !== rhs) {
          throw new SemanticError(
            `Error semántico: asignación incompatible a '${n.name}' en línea ${n.line}. Se esperaba ${sym.type} pero se obtuvo ${rhs}.`
          );
        }
        return null;
      }

      case "Var": {
        const sym = ensure(n.name, n.line || 0);
        if (sym.type == null) {
          throw new SemanticError(
            `Error semántico: variable '${n.name}' usada antes de ser inicializada (línea ${n.line}).`
          );
        }
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
          if (rt !== "int") {
            throw new SemanticError(
              "Error semántico: '-' sólo se aplica a enteros."
            );
          }
          setType("(- ?)", "int");
          return "int";
        }
        if (n.op === "!") {
          if (rt !== "bool") {
            throw new SemanticError(
              "Error semántico: '!' sólo se aplica a booleanos."
            );
          }
          setType("(! ?)", "bool");
          return "bool";
        }
        return rt;
      }

      case "Binary": {
        const lt = visit(n.left);
        const rt = visit(n.right);

        if (["+", "-", "*", "/"].includes(n.op)) {
          if (lt !== "int" || rt !== "int") {
            throw new SemanticError(
              "Error semántico: operadores aritméticos requieren enteros."
            );
          }
          setType(`(? ${n.op} ?)`, "int");
          return "int";
        }

        if (["<", "<=", ">", ">="].includes(n.op)) {
          if (lt !== "int" || rt !== "int") {
            throw new SemanticError(
              "Error semántico: comparaciones <,<=,>,>= requieren enteros."
            );
          }
          setType(`(? ${n.op} ?)`, "bool");
          return "bool";
        }

        if (["==", "!="].includes(n.op)) {
          if (lt !== rt) {
            throw new SemanticError(
              "'==' y '!=' requieren operandos del mismo tipo."
            );
          }
          setType(`(? ${n.op} ?)`, "bool");
          return "bool";
        }
        return null;
      }

      case "If": {
        const ct = visit(n.cond);
        if (ct !== "bool") {
          throw new SemanticError(
            "Error semántico: la condición del if debe ser booleana."
          );
        }
        visit(n.then);
        if (n.else) visit(n.else);
        return null;
      }
    }
  };

  visit(ast);
  return { symbols, types };
}
