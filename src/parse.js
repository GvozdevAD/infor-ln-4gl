/**
 * Line-oriented parse of LN 3GL/4GL source into sections and functions.
 * Pure text → nodes; no vscode dependency.
 */

const PROGRAM_PARENT =
  /^(declaration|functions|before\.program|on\.error|after\.program|after\.update\.db\.commit|before\.display\.object|on\.display\.total\.line|before\.new\.object|after\.new\.object|after\.form\.read|after\.receive\.data)$/i;

const REPORT_PARENT =
  /^(?:before\.report|after\.report|header|footer|detail|before\.field|after\.field)\.\d+$/i;
const REPORT_CHILD = /^(?:before|after)\.layout$/i;

const FORM_PARENT = /^form\.(?:\d+|all|other)$/i;
const FORM_CHILD = /^(?:init|before|after)\.form$/i;

const GROUP_PARENT = /^group\.\d+$/i;
const GROUP_CHILD = /^(?:init|before|after)\.group$/i;

const CHOICE_PARENT =
  /^choice\.(?:start\.set|first\.view|next\.view|prev\.view|last\.view|def\.find|find\.data|first\.set|next\.set|display\.set|prev\.set|rotate\.curr|last\.set|add\.set|update\.db|dupl\.occur|recover\.set|mark\.delete|mark\.occur|change\.order|modify\.set|restart\.input|print\.data|create\.job|form\.tab\.change|first\.frm|next\.frm|prev\.frm|last\.frm|resize\.frm|cmd\.options|zoom|interrupt|end\.program|abort\.program|cont\.process|text\.manager|run\.job|global\.delete|global\.copy|save\.defaults|get\.defaults|start\.chart|start\.query|user\.\d+|ask\.helpinfo|calculator|calendar|bms|cmd\.whats\.this|help\.index)$/i;
const CHOICE_CHILD = /^(?:before|on|after)\.choice$/i;

const FIELD_PARENT = /^field\.(?:all|other|[A-Za-z0-9_.]+)$/i;
const FIELD_CHILD =
  /^(?:init\.field|before\.field|before\.input|before\.display|selection\.filter|before\.zoom|before\.checks|domain\.error|ref\.input|ref\.display|check\.input|on\.input|when\.field\.changes|after\.zoom|after\.input|after\.display|after\.field)$/i;

const ZOOM_PARENT = /^zoom\.from\.[A-Za-z0-9_.]+$/i;
const ZOOM_CHILD = /^on\.(?:entry|exit)$/i;

const MAIN_TABLE_PARENT = /^main\.table\.io$/i;
const MAIN_TABLE_CHILD =
  /^(?:before\.read|after\.read|before\.write|after\.write|after\.skip\.write|before\.rewrite|after\.rewrite|after\.skip\.rewrite|before\.delete|after\.delete|after\.skip\.delete|read\.view)$/i;

const SECTION_LINE = /^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*$/;

const FUNCTION_LINE =
  /^\s*function\s+(?:extern\s+)?(?:(?:long|double|void|string|boolean|domain\s+[\w.]+)\s+)?([\w.]+)\s*\(/i;

/**
 * @typedef {"parent" | "child" | "function"} NodeKind
 * @typedef {{
 *   kind: NodeKind,
 *   name: string,
 *   line: number,
 *   nameStart: number,
 *   nameEnd: number,
 *   endLine: number,
 * }} ParseNode
 */

/**
 * @param {string} name
 * @returns {"parent" | "child" | null}
 */
function classifySection(name) {
  if (
    PROGRAM_PARENT.test(name) ||
    REPORT_PARENT.test(name) ||
    FORM_PARENT.test(name) ||
    GROUP_PARENT.test(name) ||
    CHOICE_PARENT.test(name) ||
    FIELD_PARENT.test(name) ||
    ZOOM_PARENT.test(name) ||
    MAIN_TABLE_PARENT.test(name)
  ) {
    return "parent";
  }
  if (
    REPORT_CHILD.test(name) ||
    FORM_CHILD.test(name) ||
    GROUP_CHILD.test(name) ||
    CHOICE_CHILD.test(name) ||
    FIELD_CHILD.test(name) ||
    ZOOM_CHILD.test(name) ||
    MAIN_TABLE_CHILD.test(name)
  ) {
    return "child";
  }
  return null;
}

/**
 * @param {string} text
 * @returns {ParseNode[]}
 */
function parseDocument(text) {
  const lines = text.split(/\r?\n/);
  /** @type {ParseNode[]} */
  const nodes = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      continue;
    }

    const sectionMatch = line.match(SECTION_LINE);
    if (sectionMatch) {
      const name = sectionMatch[1];
      const role = classifySection(name);
      if (role) {
        const nameStart = line.indexOf(name);
        nodes.push({
          kind: role,
          name,
          line: i,
          nameStart,
          nameEnd: nameStart + name.length,
          endLine: i,
        });
      }
      continue;
    }

    const fnMatch = line.match(FUNCTION_LINE);
    if (fnMatch) {
      const name = fnMatch[1];
      const nameStart = line.indexOf(name);
      nodes.push({
        kind: "function",
        name,
        line: i,
        nameStart,
        nameEnd: nameStart + name.length,
        endLine: i,
      });
    }
  }

  assignEndLines(nodes, lines.length);
  return nodes;
}

/**
 * Extend each node's endLine to the line before the next sibling-level boundary.
 * Parents include children (and functions under `functions:`) until the next parent
 * or a top-level function. Children/functions end at the next node.
 * @param {ParseNode[]} nodes
 * @param {number} lineCount
 */
function assignEndLines(nodes, lineCount) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let end = lineCount - 1;
    for (let j = i + 1; j < nodes.length; j++) {
      const next = nodes[j];
      if (node.kind === "parent") {
        if (next.kind === "parent") {
          end = next.line - 1;
          break;
        }
        if (
          next.kind === "function" &&
          !/^functions$/i.test(node.name)
        ) {
          end = next.line - 1;
          break;
        }
      } else {
        end = next.line - 1;
        break;
      }
    }
    node.endLine = Math.max(node.line, end);
  }
}

/**
 * @param {string} text
 * @returns {Map<string, ParseNode>}
 */
function functionIndex(text) {
  const map = new Map();
  for (const node of parseDocument(text)) {
    if (node.kind === "function") {
      const key = node.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, node);
      }
    }
  }
  return map;
}

module.exports = {
  parseDocument,
  functionIndex,
  classifySection,
  SECTION_LINE,
  FUNCTION_LINE,
};
