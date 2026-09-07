/**
 * Live cache of functionIndex across open ln-4gl tabs (+ optional sessionFolder).
 */

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const {
  buildOpenDocsIndex,
  lookupDefinition,
  knownFunctionNames,
} = require("./open-docs-index");
const { findOccurrences } = require("./idents");

const LANG = "ln-4gl";
const SCRIPT_EXT = /\.(bc|cln|ln4gl)$/i;
const SESSION_FILE_CAP = 100;

/** @type {vscode.EventEmitter<void> | undefined} */
let changeEmitter;
/** @type {vscode.Disposable[]} */
let subs = [];
/** @type {Map<string, FunctionDefLoc[]> | null} */
let cachedIndex = null;
/** @type {{ uri: string, text: string }[] | null} */
let cachedSources = null;
/** @type {Map<string, { mtimeMs: number, text: string }>} */
const sessionFileCache = new Map();
/** @type {ReturnType<typeof setTimeout> | undefined} */
let bumpTimer;

/**
 * @typedef {import("./open-docs-index").FunctionDefLoc} FunctionDefLoc
 */

function invalidateCache() {
  cachedIndex = null;
  cachedSources = null;
}

/**
 * Drop cache immediately; debounce only the semantic-token event.
 * @param {number} [delayMs]
 */
function scheduleBump(delayMs = 0) {
  invalidateCache();
  if (bumpTimer) {
    clearTimeout(bumpTimer);
  }
  if (delayMs <= 0) {
    bumpTimer = undefined;
    if (changeEmitter) {
      changeEmitter.fire();
    }
    return;
  }
  bumpTimer = setTimeout(() => {
    bumpTimer = undefined;
    if (changeEmitter) {
      changeEmitter.fire();
    }
  }, delayMs);
}

/**
 * @returns {string}
 */
function sessionFolderSetting() {
  const raw = vscode.workspace.getConfiguration("ln-4gl").get("sessionFolder");
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Non-recursive list of script files under sessionFolder (capped).
 * @param {string} folder
 * @returns {string[]}
 */
function listSessionScripts(folder) {
  try {
    if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
      return [];
    }
    const names = fs.readdirSync(folder);
    /** @type {string[]} */
    const out = [];
    for (const name of names) {
      if (!SCRIPT_EXT.test(name)) {
        continue;
      }
      const full = path.join(folder, name);
      try {
        if (fs.statSync(full).isFile()) {
          out.push(full);
        }
      } catch {
        // ignore
      }
      if (out.length >= SESSION_FILE_CAP) {
        break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * @param {string} fsPath
 * @returns {string | undefined}
 */
function readSessionFile(fsPath) {
  try {
    const st = fs.statSync(fsPath);
    const prev = sessionFileCache.get(fsPath);
    if (prev && prev.mtimeMs === st.mtimeMs) {
      return prev.text;
    }
    const text = fs.readFileSync(fsPath, "utf8");
    sessionFileCache.set(fsPath, { mtimeMs: st.mtimeMs, text });
    return text;
  } catch {
    sessionFileCache.delete(fsPath);
    return undefined;
  }
}

/**
 * @returns {{ uri: string, text: string }[]}
 */
function collectSources() {
  if (cachedSources) {
    return cachedSources;
  }

  /** @type {Map<string, { uri: string, text: string }>} */
  const byUri = new Map();

  for (const doc of vscode.workspace.textDocuments) {
    if (doc.languageId !== LANG || doc.isClosed) {
      continue;
    }
    const uri = doc.uri.toString();
    byUri.set(uri, { uri, text: doc.getText() });
  }

  const folder = sessionFolderSetting();
  if (folder) {
    const openFs = new Set(
      [...byUri.values()]
        .map((s) => {
          try {
            return vscode.Uri.parse(s.uri).fsPath;
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );
    for (const fsPath of listSessionScripts(folder)) {
      if (openFs.has(fsPath)) {
        continue;
      }
      const text = readSessionFile(fsPath);
      if (text == null) {
        continue;
      }
      const uri = vscode.Uri.file(fsPath).toString();
      byUri.set(uri, { uri, text });
    }
  }

  cachedSources = [...byUri.values()];
  return cachedSources;
}

/**
 * @returns {Map<string, FunctionDefLoc[]>}
 */
function getIndex() {
  if (!cachedIndex) {
    cachedIndex = buildOpenDocsIndex(collectSources());
  }
  return cachedIndex;
}

/**
 * @returns {Set<string>}
 */
function getKnownNames() {
  return knownFunctionNames(getIndex());
}

/**
 * @param {string} name
 * @param {string} [preferUri]
 * @returns {FunctionDefLoc | undefined}
 */
function findDefinition(name, preferUri) {
  return lookupDefinition(getIndex(), name, preferUri);
}

/**
 * Occurrences of `name` across open docs (+ sessionFolder sources).
 * @param {string} name
 * @returns {{ uri: string, line: number, start: number, end: number }[]}
 */
function findReferences(name) {
  if (!name) {
    return [];
  }
  /** @type {{ uri: string, line: number, start: number, end: number }[]} */
  const out = [];
  for (const src of collectSources()) {
    for (const occ of findOccurrences(src.text, name)) {
      out.push({
        uri: src.uri,
        line: occ.line,
        start: occ.start,
        end: occ.end,
      });
    }
  }
  return out;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activateOpenDocsStore(context) {
  changeEmitter = new vscode.EventEmitter();
  context.subscriptions.push(changeEmitter);

  const bump = () => scheduleBump(0);
  const bumpSoon = () => scheduleBump(200);

  subs = [
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.languageId === LANG) {
        bump();
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.languageId === LANG) {
        bump();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === LANG) {
        bumpSoon();
      }
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === LANG) {
        sessionFileCache.delete(doc.uri.fsPath);
        bump();
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("ln-4gl.sessionFolder")) {
        sessionFileCache.clear();
        bump();
      }
    }),
  ];
  context.subscriptions.push(...subs);
  bump();
}

function deactivateOpenDocsStore() {
  if (bumpTimer) {
    clearTimeout(bumpTimer);
    bumpTimer = undefined;
  }
  for (const d of subs) {
    d.dispose();
  }
  subs = [];
  if (changeEmitter) {
    changeEmitter.dispose();
    changeEmitter = undefined;
  }
  cachedIndex = null;
  cachedSources = null;
  sessionFileCache.clear();
}

/**
 * @returns {vscode.Event<void> | undefined}
 */
function onDidChangeOpenDocsIndex() {
  return changeEmitter ? changeEmitter.event : undefined;
}

module.exports = {
  activateOpenDocsStore,
  deactivateOpenDocsStore,
  getIndex,
  getKnownNames,
  findDefinition,
  findReferences,
  onDidChangeOpenDocsIndex,
  collectSources,
  listSessionScripts,
  SESSION_FILE_CAP,
};
