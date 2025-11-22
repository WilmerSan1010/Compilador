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
  const symbols = new Map(); // valor → info de símbolo (para números)
  const types = []; // anotaciones de tipo sobre nodos
  let dirCounter = 1; // contador para direcciones de memoria simuladas

  const setType = (label, typ) => types.push({ node: label, type: typ });

  const addSymbol = (value) => {
    const key = String(value);
    if (!symbols.has(key)) {
      symbols.set(key, {
        name: key,
        type: "int",
        address: `dir_${dirCounter++}`,
      });
    }
    return symbols.get(key);
  };

  const visit = (n) => {
    switch (n.kind) {
      case "Program": {
        const exprType = visit(n.expr);
        return exprType;
      }

      case "Var": {
        // No deberían existir variables en una calculadora
        throw new SemanticError(
          `Error semántico: no se permiten variables. Solo números.`
        );
      }

      case "Num":
        addSymbol(n.value); // Registrar el número en la tabla de símbolos
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
          // No registrar operadores en la tabla de tipos
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
          
          // No registrar operadores en la tabla de tipos
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
