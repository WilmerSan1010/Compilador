// Compiler/tac_gen.js
// =======================================================
// GENERACIÓN DE CÓDIGO TAC (TRES DIRECCIONES)
// =======================================================

export function genTAC(ast) {
  const code = [];
  let tempId = 0;

  const newTemp = () => `t${++tempId}`;
  const emit = (line) => code.push(line);

  const evalExpr = (node) => {
    switch (node.kind) {
      case "Num":
        return String(node.value);
      case "Var":
        return node.name;
      case "Unary": {
        const r = evalExpr(node.right);
        const tmp = newTemp();
        emit(`${tmp} = ${node.op}${r}`);
        return tmp;
      }
      case "Binary": {
        const l = evalExpr(node.left);
        const r = evalExpr(node.right);
        const tmp = newTemp();
        emit(`${tmp} = ${l} ${node.op} ${r}`);
        return tmp;
      }
      default:
        return "??";
    }
  };

  const gen = (node) => {
    switch (node.kind) {
      case "Program": {
        const result = evalExpr(node.expr);
        emit(`result = ${result}`);
        return;
      }
      default:
        return;
    }
  };

  gen(ast);
  return code;
}
