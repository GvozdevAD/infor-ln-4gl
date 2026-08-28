const vscode = require("vscode");
const completions = require("../data/completions.json");
const docs = require("../data/docs.json");
const { codePart } = require("./text");
const { isInsideEmbeddedSql } = require("./sql-context");
const { detailFor, sortPrefixFor } = require("./catalog");
const { detectScriptKind } = require("./script-context");

const FUNCTION_DOCS = docs;
const COMPLETION_CAP = 200;

const TYPE_WORDS = new Set([
  "long",
  "double",
  "void",
  "string",
  "boolean",
  "domain",
]);

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @returns {"sql" | "sectionLine" | "dalHeader" | "preprocessor" | "general"}
 */
function detectContext(document, position) {
  if (isInSql(document, position)) {
    return "sql";
  }
  if (isPreprocessorContext(document, position)) {
    return "preprocessor";
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
  return isInsideEmbeddedSql(
    document.getText(),
    position.line,
    position.character,
  );
}

/**
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 */
function isPreprocessorContext(document, position) {
  const line = document.lineAt(position.line).text;
  const code = codePart(line);
  if (!/^\s*#/.test(code)) {
    return false;
  }
  const pipe = line.indexOf("|");
  const limit = pipe >= 0 ? pipe : line.length;
  return position.character <= limit;
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
 * @param {{ functions?: boolean, scriptKind?: string, dalHook?: boolean }} [opts]
 */
function itemsFor(list, kind, sortPrefix, wordPrefix, opts = {}) {
  const out = [];
  const scriptKind = opts.scriptKind || "general";
  for (const label of list) {
    if (!matchesPrefix(label, wordPrefix)) {
      continue;
    }
    const item = new vscode.CompletionItem(label, kind);
    const prefix =
      opts.functions || opts.dalHook
        ? sortPrefixFor(label, /** @type any */ (scriptKind), opts.dalHook)
        : sortPrefix;
    item.sortText = `${prefix}${label.toLowerCase()}`;
    if (opts.functions) {
      const doc =
        detailFor(label) ||
        FUNCTION_DOCS[label] ||
        FUNCTION_DOCS[label.toLowerCase()];
      if (doc) {
        item.detail = doc;
        item.documentation = doc;
      }
      item.insertText = new vscode.SnippetString(`${label}($0)`);
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
    } else if (ctx === "preprocessor") {
      items = itemsFor(
        completions.preprocessor || [],
        vscode.CompletionItemKind.Keyword,
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
          { scriptKind: "dal", dalHook: true },
        ),
      ];
    } else {
      const scriptKind = detectScriptKind(document);
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
          { functions: true, scriptKind },
        ),
        ...itemsFor(
          completions.dalHooks,
          vscode.CompletionItemKind.Method,
          "1-",
          prefix,
          { scriptKind, dalHook: true },
        ),
        ...itemsFor(
          completions.constants,
          vscode.CompletionItemKind.Constant,
          "2-",
          prefix,
        ),
        ...itemsFor(
          completions.errors || [],
          vscode.CompletionItemKind.Constant,
          "2-",
          prefix,
        ),
      ];
      if (items.length > COMPLETION_CAP) {
        items.sort((a, b) =>
          (a.sortText || a.label).localeCompare(
            b.sortText || b.label,
            undefined,
            { sensitivity: "base" },
          ),
        );
        items = items.slice(0, COMPLETION_CAP);
      }
    }

    return items;
  },
};

module.exports = {
  completionProvider,
  detectContext,
  isInSql,
};
