const vscode = require("vscode");
const completions = require("../data/completions.json");
const docs = require("../data/docs.json");

const FUNCTION_DOCS = docs;

const TYPE_WORDS = new Set([
  "long",
  "double",
  "void",
  "string",
  "boolean",
  "domain",
]);

/**
 * Strip trailing | comment from a line for scanning.
 * @param {string} line
 */
function codePart(line) {
  const pipe = line.indexOf("|");
  return pipe === -1 ? line : line.slice(0, pipe);
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {"sql" | "sectionLine" | "dalHeader" | "general"}
 */
function detectContext(document, position) {
  if (isInSql(document, position)) {
    return "sql";
  }
  if (isDalHeader(document, position)) {
    return "dalHeader";
  }
  if (isSectionLine(document, position)) {
    return "sectionLine";
  }
  return "general";
}

/**
 * 4GL sections sit at the left margin; indented lines are body code.
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 */
function isSectionLine(document, position) {
  const line = document.lineAt(position.line).text;
  const before = line.slice(0, position.character);
  if (/^\t/.test(line) || /^\s{4,}/.test(line)) {
    return false;
  }
  if (/[("'=]/.test(before)) {
    return false;
  }
  return /^\s*$/.test(before) || /^\s*[A-Za-z_][\w.]*$/.test(before);
}

/**
 * Unclosed select…endselect looking backward from position.
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 */
function isInSql(document, position) {
  let depth = 0;
  for (let i = position.line; i >= 0; i--) {
    let text = codePart(document.lineAt(i).text);
    if (i === position.line) {
      text = text.slice(0, position.character);
    }
    const lower = text.toLowerCase();
    // Count endselect then select on the same line carefully (right to left tokens)
    const tokens = [];
    const re = /\b(endselect|selectdo|selectempty|selecteos|selecterror|select)\b/gi;
    let m;
    while ((m = re.exec(lower)) !== null) {
      tokens.push(m[1].toLowerCase());
    }
    for (let t = tokens.length - 1; t >= 0; t--) {
      const tok = tokens[t];
      if (tok === "endselect") {
        depth--;
      } else if (tok === "select") {
        depth++;
      }
    }
    if (depth > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Inside `function extern …` header before opening `{`.
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 */
function isDalHeader(document, position) {
  for (let i = position.line; i >= Math.max(0, position.line - 5); i--) {
    let text = codePart(document.lineAt(i).text);
    if (i === position.line) {
      text = text.slice(0, position.character);
    }
    if (/\{/.test(text) && i < position.line) {
      return false;
    }
    if (/^\s*function\s+extern\b/i.test(text)) {
      // Still before `{` on this or following lines up to cursor
      for (let j = i; j <= position.line; j++) {
        let chunk = codePart(document.lineAt(j).text);
        if (j === position.line) {
          chunk = chunk.slice(0, position.character);
        }
        if (/\{/.test(chunk)) {
          return false;
        }
      }
      return true;
    }
    if (/^\s*function\b/i.test(text) && !/extern/i.test(text)) {
      return false;
    }
  }
  return false;
}

/**
 * @param {string} label
 * @param {string} prefix
 */
function matchesPrefix(label, prefix) {
  if (!prefix) {
    return true;
  }
  return label.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * @param {string[]} list
 * @param {vscode.CompletionItemKind} kind
 * @param {string} sortPrefix
 * @param {string} wordPrefix
 * @param {{ functions?: boolean }} [opts]
 */
function itemsFor(list, kind, sortPrefix, wordPrefix, opts = {}) {
  const out = [];
  for (const label of list) {
    if (!matchesPrefix(label, wordPrefix)) {
      continue;
    }
    const item = new vscode.CompletionItem(label, kind);
    item.sortText = `${sortPrefix}${label.toLowerCase()}`;
    if (opts.functions) {
      const doc = FUNCTION_DOCS[label] || FUNCTION_DOCS[label.toLowerCase()];
      if (doc) {
        item.detail = doc;
        item.documentation = doc;
      }
      if (label.endsWith("$")) {
        item.insertText = new vscode.SnippetString(`${label}($0)`);
      } else {
        item.insertText = new vscode.SnippetString(`${label}($0)`);
      }
    } else if (kind === vscode.CompletionItemKind.Snippet && label.endsWith(":")) {
      item.insertText = new vscode.SnippetString(`${label}\n\t$0`);
    }
    out.push(item);
  }
  return out;
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 */
function wordPrefixAt(document, position) {
  const range = document.getWordRangeAtPosition(position);
  if (!range) {
    return "";
  }
  return document.getText(range);
}

const completionProvider = {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   */
  provideCompletionItems(document, position) {
    const ctx = detectContext(document, position);
    const prefix = wordPrefixAt(document, position);
    /** @type {vscode.CompletionItem[]} */
    let items = [];

    if (ctx === "sql") {
      items = itemsFor(
        completions.sql,
        vscode.CompletionItemKind.Keyword,
        "0-",
        prefix,
      );
    } else if (ctx === "sectionLine") {
      items = itemsFor(
        completions.sections,
        vscode.CompletionItemKind.Snippet,
        "0-",
        prefix,
      );
    } else if (ctx === "dalHeader") {
      const types = completions.keywords.filter((k) => TYPE_WORDS.has(k.toLowerCase()));
      items = [
        ...itemsFor(types, vscode.CompletionItemKind.Keyword, "0-", prefix),
        ...itemsFor(
          completions.dalHooks,
          vscode.CompletionItemKind.Method,
          "0-",
          prefix,
        ),
      ];
    } else {
      items = [
        ...itemsFor(
          completions.keywords,
          vscode.CompletionItemKind.Keyword,
          "1-",
          prefix,
        ),
        ...itemsFor(
          completions.functions,
          vscode.CompletionItemKind.Function,
          "1-",
          prefix,
          { functions: true },
        ),
        ...itemsFor(
          completions.dalHooks,
          vscode.CompletionItemKind.Method,
          "1-",
          prefix,
        ),
        ...itemsFor(
          completions.constants,
          vscode.CompletionItemKind.Constant,
          "2-",
          prefix,
        ),
      ];
    }

    return items;
  },
};

module.exports = {
  completionProvider,
  detectContext,
  isInSql,
};
