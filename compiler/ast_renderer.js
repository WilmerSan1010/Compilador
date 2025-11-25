export function astLabel(n) {
  switch (n.kind) {
    case "Program":
      return "prog";
    case "Block":
      return "{}";
    case "If":
      return "if";
    case "Assign":
      return "=";
    case "Var":
      return n.name;
    case "Num":
      return String(n.value);
    case "Bool":
      return n.value ? "true" : "false";
    case "Unary":
      return n.op;
    case "Binary":
      return n.op;
    default:
      return n.kind;
  }
}

/**
 * Devuelve los hijos directos de un nodo del AST.
 * Se usa para recorrer el árbol de manera genérica.
 */
export function astChildren(n) {
  switch (n.kind) {
    case "Program":
      return [n.expr];
    case "Unary":
      return [n.right];
    case "Binary":
      return [n.left, n.right];
    default:
      return [];
  }
}

/**
 * Calcula un layout (x, y) lógico para cada nodo del AST.
 * @param {object} node - Nodo AST raíz del subárbol.
 * @param {number} depth - Profundidad actual.
 * @param {number} xoff - Desplazamiento en x.
 * @param {number} xsp - Espaciado horizontal entre nodos.
 * @param {number} ysp - Espaciado vertical entre niveles.
 * @returns {{pos: Map, width: number}}
 */
export function computeLayout(node, depth = 0, xoff = 0, xsp = 120, ysp = 90) {
  const ch = astChildren(node);
  if (ch.length === 0) {
    const pos = new Map([[node, { x: xoff, y: depth * ysp }]]);
    return { pos, width: 1 };
  }

  let pos = new Map();
  let curx = xoff;
  let total = 0;

  for (const c of ch) {
    const r = computeLayout(c, depth + 1, curx, xsp, ysp);
    r.pos.forEach((v, k) => pos.set(k, v));
    curx += r.width + 1;
    total += r.width;
  }

  const center = (xoff + (curx - 1)) / 2;
  pos.set(node, { x: center, y: depth * ysp });
  return { pos, width: Math.max(total, 1) };
}

/**
 * Dibuja el AST en un elemento:
 *
 * @param {object} node - Nodo raíz del AST.
 * @param {SVGElement} svg
 */
export function drawASTInto(node, svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!node) return;

  const { pos } = computeLayout(node, 0, 0);
  const nodes = Array.from(pos.keys());
  const coords = nodes.map((n) => pos.get(n));
  const minX = Math.min(...coords.map((p) => p.x));

  const shiftX = (x) => (x - minX) * 120 + 60;
  const shiftY = (y) => y + 40;

  // --- Dibujo de aristas ---
  for (const parent of nodes) {
    for (const ch of astChildren(parent)) {
      const p = pos.get(parent),
        c = pos.get(ch);
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", shiftX(p.x));
      line.setAttribute("y1", shiftY(p.y));
      line.setAttribute("x2", shiftX(c.x));
      line.setAttribute("y2", shiftY(c.y));
      line.setAttribute("stroke", "#334155");
      line.setAttribute("stroke-width", "1.5");
      svg.appendChild(line);
    }
  }

  // --- Dibujo de nodos ---
  for (const n of nodes) {
    const p = pos.get(n);
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const cx = shiftX(p.x),
      cy = shiftY(p.y);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", cx - 50);
    rect.setAttribute("y", cy - 16);
    rect.setAttribute("rx", 10);
    rect.setAttribute("width", 100);
    rect.setAttribute("height", 32);
    rect.setAttribute("fill", "#e2e8f0");
    rect.setAttribute("stroke", "#64748b");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", cx);
    text.setAttribute("y", cy + 4);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "11");
    text.setAttribute("fill", "#0f172a");
    text.textContent = astLabel(n);

    g.appendChild(rect);
    g.appendChild(text);
    svg.appendChild(g);
  }
  // Ajusta el tamaño al contenido
  const rects = Array.from(svg.querySelectorAll("rect"));
  if (rects.length) {
    const maxX = Math.max(
      ...rects.map(
        (r) =>
          parseFloat(r.getAttribute("x")) + parseFloat(r.getAttribute("width"))
      )
    );
    const maxY = Math.max(
      ...rects.map(
        (r) =>
          parseFloat(r.getAttribute("y")) + parseFloat(r.getAttribute("height"))
      )
    );
    svg.setAttribute("width", Math.max(800, maxX + 60));
    svg.setAttribute("height", Math.max(400, maxY + 60));
  }
}
