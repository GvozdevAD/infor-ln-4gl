/**
 * Parse FunctionUsage / DllUsage blocks (Object Information Tool / bic_info6.2).
 * Guide format only — see dynamic_link_libraries/object_information_tool.
 *
 *   FunctionUsage
 *   <description lines>
 *   Input:  NAME   description   |  Input: -
 *   Output: NAME   description   |  Output: -
 *   Return: …
 *   EndFunctionUsage
 */

const { FUNCTION_LINE } = require("./parse");
const { codePart } = require("./text");

/**
 * @typedef {{ name: string, desc: string }} UsageParam
 * @typedef {{
 *   brief?: string,
 *   params: UsageParam[],
 *   outParams: UsageParam[],
 *   returns?: string,
 * }} FunctionUsageDoc
 * @typedef {{
 *   name: string,
 *   signatureLine: string,
 *   functionLine: number,
 *   doc: FunctionUsageDoc,
 * }} FunctionUsageEntry
 */

/**
 * Split "NAME desc" or "NAME\tdesc" after an Input:/Output: label.
 * @param {string} rest
 * @returns {{ name: string, desc: string } | null}
 */
function splitNameDesc(rest) {
  const trimmed = rest.trim();
  if (!trimmed || trimmed === "-") {
    return null;
  }
  const m = trimmed.match(/^(\S+)\s+(.*)$/);
  if (m) {
    return { name: m[1], desc: m[2].trim() };
  }
  return { name: trimmed, desc: "" };
}

/**
 * @param {string[]} lines
 * @returns {FunctionUsageDoc}
 */
function parseUsageDocLines(lines) {
  /** @type {FunctionUsageDoc} */
  const doc = { params: [], outParams: [] };
  /** @type {string[]} */
  const briefParts = [];
  /** @type {string[]} */
  const returnParts = [];
  /** @type {"brief" | "input" | "output" | "return" | null} */
  let section = "brief";

  for (const raw of lines) {
    const text = raw.trim();
    const lower = text.toLowerCase();
    if (
      lower === "functionusage" ||
      lower === "endfunctionusage" ||
      lower === "dllusage" ||
      lower === "enddllusage"
    ) {
      continue;
    }
    if (text === "") {
      continue;
    }

    let m = text.match(/^input:\s*(.*)$/i);
    if (m) {
      section = "input";
      const pair = splitNameDesc(m[1]);
      if (pair) {
        doc.params.push(pair);
      }
      continue;
    }
    m = text.match(/^output:\s*(.*)$/i);
    if (m) {
      section = "output";
      const pair = splitNameDesc(m[1]);
      if (pair) {
        doc.outParams.push(pair);
      }
      continue;
    }
    m = text.match(/^return:\s*(.*)$/i);
    if (m) {
      section = "return";
      const rest = m[1].trim();
      if (rest) {
        returnParts.push(rest);
      }
      continue;
    }

    // Continuation lines under the current section (indented prose / extra args).
    if (section === "input") {
      const pair = splitNameDesc(text);
      if (pair) {
        doc.params.push(pair);
      }
      continue;
    }
    if (section === "output") {
      const pair = splitNameDesc(text);
      if (pair) {
        doc.outParams.push(pair);
      }
      continue;
    }
    if (section === "return") {
      returnParts.push(text);
      continue;
    }

    briefParts.push(text);
  }

  if (briefParts.length) {
    doc.brief = briefParts.join("\n");
  }
  if (returnParts.length) {
    doc.returns = returnParts.join("\n");
  }
  return doc;
}

/**
 * @param {string[]} lines
 * @param {number} funcLineIdx 0-based
 * @returns {number | null}
 */
function findOpeningBrace(lines, funcLineIdx) {
  for (let i = funcLineIdx; i < Math.min(funcLineIdx + 30, lines.length); i++) {
    if (lines[i].includes("{")) {
      return i;
    }
  }
  return null;
}

/**
 * Collect FunctionUsage…EndFunctionUsage inside the function body after `{`.
 * @param {string[]} lines
 * @param {number} braceLineIdx 0-based
 * @returns {string[] | null}
 */
function extractFunctionUsageBlock(lines, braceLineIdx) {
  let depth = 0;
  let collecting = false;
  /** @type {string[]} */
  let block = [];

  for (let i = braceLineIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
      }
    }

    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "functionusage") {
      collecting = true;
      block = [line];
    } else if (collecting) {
      block.push(line);
      if (lower === "endfunctionusage") {
        return block;
      }
    }

    if (i > braceLineIdx && depth <= 0) {
      break;
    }
  }
  return null;
}

/**
 * Index FunctionUsage docs by function name (lowercase).
 * Guide only: blocks inside `{ … }`, no legacy |** comments.
 * @param {string} text
 * @returns {Map<string, FunctionUsageEntry>}
 */
function functionUsageIndex(text) {
  const lines = text.split(/\r?\n/);
  /** @type {Map<string, FunctionUsageEntry>} */
  const map = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      continue;
    }
    const m = line.match(FUNCTION_LINE);
    if (!m) {
      continue;
    }
    const name = m[1];
    const brace = findOpeningBrace(lines, i);
    if (brace == null) {
      continue;
    }
    const docLines = extractFunctionUsageBlock(lines, brace);
    if (!docLines) {
      continue;
    }
    const key = name.toLowerCase();
    if (map.has(key)) {
      continue;
    }
    map.set(key, {
      name,
      signatureLine: line.trim(),
      functionLine: i,
      doc: parseUsageDocLines(docLines),
    });
  }
  return map;
}

/**
 * @param {FunctionUsageDoc} doc
 * @param {string} [signatureLine]
 * @returns {string}
 */
function formatUsageHover(doc, signatureLine) {
  /** @type {string[]} */
  const parts = [];
  if (signatureLine) {
    parts.push("```baan\n" + signatureLine + "\n```");
  }
  if (doc.brief) {
    parts.push(doc.brief);
  }
  if (doc.params.length) {
    parts.push(
      "**Input**\n" +
        doc.params
          .map((p) => `- \`${p.name}\`${p.desc ? ` — ${p.desc}` : ""}`)
          .join("\n"),
    );
  }
  if (doc.outParams.length) {
    parts.push(
      "**Output**\n" +
        doc.outParams
          .map((p) => `- \`${p.name}\`${p.desc ? ` — ${p.desc}` : ""}`)
          .join("\n"),
    );
  }
  if (doc.returns) {
    const retLines = doc.returns.split("\n");
    if (retLines.length === 1) {
      parts.push(`**Return** — ${retLines[0]}`);
    } else {
      parts.push("**Return**\n" + retLines.map((l) => `- ${l}`).join("\n"));
    }
  }
  return parts.join("\n\n");
}

/**
 * @param {string} paramPart
 * @returns {{ name: string, out: boolean } | null}
 */
function parseParamPart(paramPart) {
  const part = paramPart.replace(/\s*\)\s*$/, "").trim();
  if (!part) {
    return null;
  }
  const out = /^ref\s+/i.test(part);
  const name = part.match(/(\S+)$/)?.[1];
  if (!name || name === "(" || name === ")") {
    return null;
  }
  return { name, out };
}

/**
 * @param {string[]} signatureLines
 * @returns {{ name: string, out: boolean }[]}
 */
function parseSignatureParams(signatureLines) {
  const text = signatureLines.join(" ");
  const inner = text.match(/\((.*)\)/)?.[1];
  if (inner == null) {
    return [];
  }
  /** @type {{ name: string, out: boolean }[]} */
  const params = [];
  for (const part of inner.split(",")) {
    const p = parseParamPart(part);
    if (p) {
      params.push(p);
    }
  }
  return params;
}

/**
 * @param {string[]} lines
 * @param {number} cursorLine
 * @returns {number | null}
 */
function findEnclosingFunctionLine(lines, cursorLine) {
  for (let i = cursorLine; i >= 0; i--) {
    if (FUNCTION_LINE.test(codePart(lines[i]))) {
      return i;
    }
  }
  return null;
}

/**
 * @param {string[]} lines
 * @param {number} startLine
 * @returns {string[]}
 */
function collectSignatureLines(lines, startLine) {
  /** @type {string[]} */
  const out = [];
  for (let i = startLine; i < lines.length; i++) {
    out.push(lines[i]);
    if (lines[i].includes(")")) {
      break;
    }
  }
  return out;
}

/**
 * Guide-style FunctionUsage snippet.
 * @param {{ name: string, out: boolean }[]} params
 * @param {"full" | "from_signature" | "brief"} kind
 * @returns {string}
 */
function buildFunctionUsageSnippet(params, kind) {
  if (kind === "brief") {
    return [
      "FunctionUsage",
      "${1:description}",
      "EndFunctionUsage",
    ].join("\n");
  }

  const lines = ["FunctionUsage", "${1:description}"];
  let tab = 1;

  const inputs = (params || []).filter((p) => !p.out);
  const outputs = (params || []).filter((p) => p.out);

  if (kind === "full" && inputs.length === 0 && outputs.length === 0) {
    lines.push("Input:\t-");
    lines.push("Output:\t-");
    tab++;
    lines.push(`Return:\t\${${tab}:description}`);
    lines.push("EndFunctionUsage");
    return lines.join("\n");
  }

  if (inputs.length === 0) {
    lines.push("Input:\t-");
  } else {
    for (const p of inputs) {
      tab++;
      lines.push(`Input:\t${p.name}\t\${${tab}:description}`);
    }
  }
  if (outputs.length === 0) {
    lines.push("Output:\t-");
  } else {
    for (const p of outputs) {
      tab++;
      lines.push(`Output:\t${p.name}\t\${${tab}:description}`);
    }
  }
  tab++;
  lines.push(`Return:\t\${${tab}:description}`);
  lines.push("EndFunctionUsage");
  return lines.join("\n");
}

/**
 * Guide-style DllUsage snippet (free-form object description).
 * @param {"guide" | "structured"} kind
 * @returns {string}
 */
function buildDllUsageSnippet(kind) {
  if (kind === "structured") {
    // Still plain prose — guide has no Purpose:/Typical headers.
    return [
      "DllUsage",
      "${1:Object description}",
      "EndDllUsage",
    ].join("\n");
  }
  return ["DllUsage", "${1:Object description}", "EndDllUsage"].join("\n");
}

/**
 * @param {string} prefix
 * @param {string} keyword
 */
function matchesUsagePrefix(prefix, keyword) {
  if (!prefix) {
    return true;
  }
  const p = prefix.toLowerCase();
  const k = keyword.toLowerCase();
  return k.startsWith(p) || p.startsWith(k);
}

module.exports = {
  parseUsageDocLines,
  functionUsageIndex,
  formatUsageHover,
  parseSignatureParams,
  findEnclosingFunctionLine,
  collectSignatureLines,
  buildFunctionUsageSnippet,
  buildDllUsageSnippet,
  extractFunctionUsageBlock,
  findOpeningBrace,
  matchesUsagePrefix,
  splitNameDesc,
};
