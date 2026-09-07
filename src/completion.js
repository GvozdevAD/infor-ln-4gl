const vscode = require("vscode");
const completions = require("../data/completions.json");
const docs = require("../data/docs.json");
const { codePart } = require("./text");
const { isInsideEmbeddedSql } = require("./sql-context");
const { detailFor, sortPrefixFor } = require("./catalog");
const { detectScriptKind } = require("./script-context");
const {
  findEnclosingFunctionLine,
  collectSignatureLines,
  parseSignatureParams,
  buildFunctionUsageSnippet,
  buildDllUsageSnippet,
  matchesUsagePrefix,
} = require("./function-usage");
const {
  COMPLETION_CAP,
  shouldCapCompletions,
} = require("./completion-cap");
const {
  isSqlKeywordToken,
  looksLikeSqlStarter,
  wantsSqlBlockSnippet,
  sqlSelectDoBlockLines,
} = require("./sql-completion");

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
 * High-priority FunctionUsage / DllUsage templates (nvim-style).
 * @param {vscode.TextDocument} document
 * @param {vscode.Position} position
 * @param {string} wordPrefix
 * @returns {vscode.CompletionItem[]}
 */
function usageTemplateItems(document, position, wordPrefix) {
  /** @type {vscode.CompletionItem[]} */
  const items = [];
  const p = wordPrefix || "";

  const wantFun = matchesUsagePrefix(p, "functionusage");
  const wantDll = matchesUsagePrefix(p, "dllusage");

  if (wantFun) {
    const lines = document.getText().split(/\r?\n/);
    const enc = findEnclosingFunctionLine(lines, position.line);
    let params = [];
    if (enc != null) {
      params = parseSignatureParams(collectSignatureLines(lines, enc));
    }

    const fromSig = new vscode.CompletionItem(
      "FunctionUsage ← from signature",
      vscode.CompletionItemKind.Snippet,
    );
    fromSig.detail = "Input/Output from enclosing function(…)";
    fromSig.sortText = "0-functionusage-0-from-sig";
    fromSig.filterText = "FunctionUsage from signature functionusage";
    fromSig.insertText = new vscode.SnippetString(
      buildFunctionUsageSnippet(params, "from_signature"),
    );
    items.push(fromSig);

    const full = new vscode.CompletionItem(
      "FunctionUsage ← full template",
      vscode.CompletionItemKind.Snippet,
    );
    full.detail = "Empty Input/Output/Return skeleton";
    full.sortText = "0-functionusage-1-full";
    full.filterText = "FunctionUsage full template functionusage";
    full.insertText = new vscode.SnippetString(
      buildFunctionUsageSnippet([], "full"),
    );
    items.push(full);

    const brief = new vscode.CompletionItem(
      "FunctionUsage ← description only",
      vscode.CompletionItemKind.Snippet,
    );
    brief.detail = "FunctionUsage + text + EndFunctionUsage";
    brief.sortText = "0-functionusage-2-brief";
    brief.filterText = "FunctionUsage brief description functionusage";
    brief.insertText = new vscode.SnippetString(
      buildFunctionUsageSnippet([], "brief"),
    );
    items.push(brief);
  }

  if (wantDll) {
    const dll = new vscode.CompletionItem(
      "DllUsage ← object description",
      vscode.CompletionItemKind.Snippet,
    );
    dll.detail = "DllUsage … EndDllUsage — general usage of the object";
    dll.sortText = "0-dllusage-0";
    dll.filterText = "DllUsage dllusage object description";
    dll.insertText = new vscode.SnippetString(buildDllUsageSnippet("guide"));
    items.push(dll);

    const dlls = new vscode.CompletionItem(
      "DllUsage ← structured description",
      vscode.CompletionItemKind.Snippet,
    );
    dlls.detail = "DllUsage … EndDllUsage (guide)";
    dlls.sortText = "0-dllusage-1";
    dlls.filterText = "DllUsage dllusage";
    dlls.insertText = new vscode.SnippetString(
      buildDllUsageSnippet("structured"),
    );
    items.push(dlls);
  }

  return items;
}

/**
 * High-priority embedded SQL block when typing select / sel / …
 * @param {string} wordPrefix
 * @returns {vscode.CompletionItem[]}
 */
function sqlBlockSnippetItems(wordPrefix) {
  if (!wantsSqlBlockSnippet(wordPrefix)) {
    return [];
  }

  const block = new vscode.CompletionItem(
    "select … from … selectdo … endselect",
    vscode.CompletionItemKind.Snippet,
  );
  block.detail = "Embedded SQL selectdo block";
  block.sortText = "0-sql-block-0";
  block.filterText = "select from where selectdo selectempty endselect sel";
  block.insertText = new vscode.SnippetString(
    sqlSelectDoBlockLines().join("\n"),
  );
  return [block];
}

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
 * Do not steal SQL starters like `select` / `update` / `delete`.
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
  if (!/^\s*$/.test(before) && !/^\s*[A-Za-z_][\w.]*$/.test(before)) {
    return false;
  }
  const word = before.trim();
  if (isSqlKeywordToken(word) || looksLikeSqlStarter(word)) {
    return false;
  }
  return true;
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

    // Always offer Usage templates early (nvim blink behavior); skip SQL / preprocessor.
    if (ctx !== "sql" && ctx !== "preprocessor") {
      items.push(...usageTemplateItems(document, position, prefix));
    }

    if (ctx === "sql") {
      items = itemsFor(
        completions.sql,
        vscode.CompletionItemKind.Keyword,
        "0-",
        prefix,
      );
    } else if (ctx === "sectionLine") {
      items.push(
        ...itemsFor(
          completions.sections,
          vscode.CompletionItemKind.Snippet,
          "0-",
          prefix,
        ),
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
      items.push(
        ...itemsFor(types, vscode.CompletionItemKind.Keyword, "0-", prefix),
        ...itemsFor(
          completions.dalHooks,
          vscode.CompletionItemKind.Method,
          "0-",
          prefix,
          { scriptKind: "dal", dalHook: true },
        ),
      );
    } else {
      const scriptKind = detectScriptKind(document);
      // `select` lives in completions.sql (not keywords) and SQL context only
      // applies *inside* an open select…endselect — so offer SQL keywords here
      // when the user is starting a query.
      if ((prefix || "").length >= 2) {
        items.push(...sqlBlockSnippetItems(prefix));
        items.push(
          ...itemsFor(
            completions.sql,
            vscode.CompletionItemKind.Keyword,
            "0-",
            prefix,
          ),
        );
      }
      items.push(
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
      );
    }

    if (shouldCapCompletions(prefix, items.length)) {
      items.sort((a, b) =>
        (a.sortText || String(a.label)).localeCompare(
          b.sortText || String(b.label),
          undefined,
          { sensitivity: "base" },
        ),
      );
      items = items.slice(0, COMPLETION_CAP);
    }

    return items;
  },
};

module.exports = {
  completionProvider,
  detectContext,
  isInSql,
  isSqlKeywordToken,
  isSectionLine,
  sqlBlockSnippetItems,
  usageTemplateItems,
};
