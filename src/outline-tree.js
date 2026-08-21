/**
 * Pure outline tree from parse nodes (no vscode dependency).
 * @typedef {import("./parse").ParseNode} ParseNode
 * @typedef {{ name: string, kind: string, children: OutlineNode[] }} OutlineNode
 */

/**
 * @param {ParseNode[]} nodes
 * @returns {OutlineNode[]}
 */
function buildOutlineTree(nodes) {
  /** @type {OutlineNode[]} */
  const roots = [];
  /** @type {{ node: ParseNode, outline: OutlineNode } | null} */
  let openParent = null;

  for (const node of nodes) {
    if (node.kind === "parent") {
      openParent = null;
      const outline = { name: node.name, kind: "module", children: [] };
      roots.push(outline);
      openParent = { node, outline };
      continue;
    }

    if (node.kind === "child") {
      const outline = { name: node.name, kind: "event", children: [] };
      if (openParent) {
        openParent.outline.children.push(outline);
      } else {
        roots.push(outline);
      }
      continue;
    }

    const outline = { name: node.name, kind: "function", children: [] };
    if (openParent && /^functions$/i.test(openParent.node.name)) {
      openParent.outline.children.push(outline);
    } else {
      openParent = null;
      roots.push(outline);
    }
  }

  return roots;
}

/**
 * Flatten outline to "name" / "parent>child" paths for assertions.
 * @param {OutlineNode[]} roots
 * @returns {string[]}
 */
function outlinePaths(roots) {
  /** @type {string[]} */
  const out = [];
  /**
   * @param {OutlineNode[]} nodes
   * @param {string} prefix
   */
  function walk(nodes, prefix) {
    for (const n of nodes) {
      const path = prefix ? `${prefix}>${n.name}` : n.name;
      out.push(path);
      walk(n.children, path);
    }
  }
  walk(roots, "");
  return out;
}

module.exports = { buildOutlineTree, outlinePaths };
