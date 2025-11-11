// Compiler/tac_gen.js
// =======================================================
// GENERACIÓN DE CÓDIGO TAC (TRES DIRECCIONES)
// =======================================================

export function genTAC(ast) {
  const code = [];
  let tempId = 0;
  let labelId = 0;

  const newTemp = () => `t${++tempId}`;
  const newLabel = () => `L${++labelId}`;
  const emit = (line) => code.push(line);

  const evalExpr = (node) => {
    switch (node.kind) {
      case "Num":
        return String(node.value);
      case "Bool":
        return node.value ? "true" : "false";
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
      case "Program":
        node.stmts.forEach(gen);
        return;
      case "Block":
        node.stmts.forEach(gen);
        return;
      case "Assign": {
        const v = evalExpr(node.expr);
        emit(`${node.name} = ${v}`);
        return;
      }
      case "If": {
        const condTmp = evalExpr(node.cond);
        const lElse = newLabel();
        const lEnd = newLabel();
        emit(`ifFalse ${condTmp} goto ${lElse}`);
        gen(node.then);
        emit(`goto ${lEnd}`);
        emit(`${lElse}:`);
        if (node.else) gen(node.else);
        emit(`${lEnd}:`);
        return;
      }
      default:
        return;
    }
  };

  gen(ast);
  return code;
}
