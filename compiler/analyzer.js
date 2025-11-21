import { SemanticError } from "./errors.js";

// =======================================================
// ANÁLISIS SEMÁNTICO: FÓRMULAS ARITMÉTICAS
// =======================================================

/**
 * Recorre el AST comprobando reglas semánticas:
 * - Variables deben tener tipos consistentes.
 * - Operadores se aplican a tipos correctos.
 *
 * @param {object} ast - AST raíz (Program).
 * @returns {{symbols: Map, types: Array}} - Tabla de símbolos y anotaciones de tipos.
 */
export function analyze(ast) {
  const symbols = new Map(); // nombre → info de símbolo
  const types = []; // anotaciones de tipo sobre nodos
  const declaredVars = new Set(); // variables explícitamente declaradas

  const setType = (label, typ) => types.push({ node: label, type: typ });

  const ensure = (name, line) => {
    if (!symbols.has(name)) {
      symbols.set(name, {
        name,
        type: "int",
        firstLine: line,
        scope: "global",
      });
    }
    return symbols.get(name);
  };

  const visit = (n) => {
    switch (n.kind) {
      case "Program": {
        const exprType = visit(n.expr);
        return exprType;
      }

      case "Var": {
        const sym = ensure(n.name, n.line || 0);
        setType(`var ${n.name}`, sym.type);
        return sym.type;
      }

      case "Num":
        setType(String(n.value), "int");
        return "int";

      case "Unary": {
        const rt = visit(n.right);
        if (n.op === "-") {
          if (rt !== "int") {
            throw new SemanticError(
              "Error semántico: '-' sólo se aplica a enteros."
            );
          }
          setType(`(${n.op} )`, "int");
          return "int";
        }
        return rt;
      }

      case "Binary": {
        const lt = visit(n.left);
        const rt = visit(n.right);

        if (["+", "-", "*", "/"].includes(n.op)) {
          if (lt !== "int" || rt !== "int") {
            throw new SemanticError(
              `Error semántico: el operador '${n.op}' requiere operandos enteros.`
            );
          }
          
          // Rechaza división por cero si el operando derecho es una constante 0
          if (n.op === "/" && n.right.kind === "Num" && n.right.value === 0) {
            throw new SemanticError(
              "Error semántico: división por cero no permitida."
            );
          }
          
          setType(`( ${n.op} )`, "int");
          return "int";
        }
        return null;
      }

      default:
        return null;
    }
  };

  visit(ast);
  return { symbols, types };
}
