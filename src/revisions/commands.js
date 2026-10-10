const vscode = require("vscode");
const path = require("path");
const { tryParseEdDiff } = require("./parse-ed-diff");
const {
  materializeFromEdDiff,
  materializeFromFullTexts,
} = require("./materialize");
const { openRevisionDiff } = require("./open-diff");

/**
 * @typedef {'sideBySide' | 'inline' | 'fullInline'} ReviewMode
 * @typedef {{
 *   kind: 'edDiff',
 *   text: string,
 *   label: string,
 * } | {
 *   kind: 'full',
 *   oldText: string,
 *   newText: string,
 *   oldLabel: string,
 *   newLabel: string,
 * }} ReviewSource
 */

/**
 * @param {import('./content-provider').RevisionContentProvider} provider
 */
function registerRevisionCommands(context, provider) {
  context.subscriptions.push(
    vscode.commands.registerCommand("ln-4gl.revisions.review", async () => {
      await runReviewRevisions(provider);
    }),
  );
}

/**
 * @param {import('./content-provider').RevisionContentProvider} provider
 */
async function runReviewRevisions(provider) {
  const source = await pickSource();
  if (!source) {
    return;
  }

  const mode = await pickMode(source.kind === "full");
  if (!mode) {
    return;
  }

  if (source.kind === "edDiff") {
    const report = tryParseEdDiff(source.text);
    if (!report) {
      const pick = await vscode.window.showErrorMessage(
        "This file does not look like an Infor Differences report (ed-diff).",
        "Pick two files…",
      );
      if (pick) {
        const full = await pickTwoFiles();
        if (full) {
          await openFromMaterialized(
            provider,
            materializeFromFullTexts(
              full.oldText,
              full.newText,
              full.oldLabel,
              full.newLabel,
            ),
            mode === "sideBySide",
          );
        }
      }
      return;
    }
    const materialized = materializeFromEdDiff(report, source.label);
    await openFromMaterialized(provider, materialized, mode === "sideBySide");
    return;
  }

  const materialized = materializeFromFullTexts(
    source.oldText,
    source.newText,
    source.oldLabel,
    source.newLabel,
  );
  // Mode 3 and mode 2 both use inline; mode 1 side-by-side
  await openFromMaterialized(
    provider,
    materialized,
    mode === "sideBySide",
  );
}

/**
 * @param {import('./content-provider').RevisionContentProvider} provider
 * @param {import('./materialize').MaterializedRevision} materialized
 * @param {boolean} sideBySide
 */
async function openFromMaterialized(provider, materialized, sideBySide) {
  const left = provider.publish("old", materialized.oldText, "old.bc");
  const right = provider.publish("new", materialized.newText, "new.bc");
  await openRevisionDiff(left, right, materialized.title, sideBySide);
}

/**
 * @returns {Promise<ReviewSource | undefined>}
 */
async function pickSource() {
  const active = vscode.window.activeTextEditor;
  const items = [
    {
      label: "$(file) Current file as Differences report",
      description: active
        ? path.basename(active.document.fileName)
        : "No active editor",
      source: "currentEd",
    },
    {
      label: "$(split-horizontal) Two open editors",
      description: "Older left · newer right (you confirm order)",
      source: "twoEditors",
    },
    {
      label: "$(files) Pick two files…",
      description: "Full revisions for side-by-side / inline / whole-file",
      source: "twoFiles",
    },
  ];

  const chosen = await vscode.window.showQuickPick(items, {
    title: "Infor LN: Review Revisions — source",
    placeHolder: "What do you want to compare?",
  });
  if (!chosen) {
    return undefined;
  }

  if (chosen.source === "currentEd") {
    if (!active) {
      vscode.window.showErrorMessage("No active editor.");
      return undefined;
    }
    return {
      kind: "edDiff",
      text: active.document.getText(),
      label: path.basename(active.document.fileName),
    };
  }

  if (chosen.source === "twoEditors") {
    return pickTwoEditors();
  }

  return pickTwoFiles();
}

/**
 * @param {boolean} allowFullInline
 * @returns {Promise<ReviewMode | undefined>}
 */
async function pickMode(allowFullInline) {
  const config = vscode.workspace.getConfiguration("ln-4gl.revisions");
  const defaultMode = config.get("defaultMode", "ask");

  /** @type {{ label: string, description: string, mode: ReviewMode }[]} */
  const items = [
    {
      label: "$(split-horizontal) Side by side",
      description: "Old left · new right (like git / WinMerge)",
      mode: "sideBySide",
    },
    {
      label: "$(list-flat) Inline / unified",
      description: "What changed and where (like GitLab)",
      mode: "inline",
    },
  ];

  if (allowFullInline) {
    items.push({
      label: "$(file-code) Whole file inline",
      description: "Full scripts with red/green changes (like Cursor review)",
      mode: "fullInline",
    });
  }

  if (defaultMode === "sideBySide") {
    return "sideBySide";
  }
  if (defaultMode === "inline") {
    return "inline";
  }
  if (defaultMode === "fullInline" && allowFullInline) {
    return "fullInline";
  }

  const chosen = await vscode.window.showQuickPick(items, {
    title: "Infor LN: Review Revisions — view mode",
    placeHolder: "How should the diff look?",
  });
  return chosen?.mode;
}

/**
 * @returns {Promise<ReviewSource | undefined>}
 */
async function pickTwoEditors() {
  const editors = vscode.window.visibleTextEditors.filter(
    (e) => !e.document.uri.scheme.startsWith("ln4gl"),
  );
  // Prefer unique documents from visible editors; fall back to all tab docs
  /** @type {vscode.TextDocument[]} */
  let docs = [];
  const seen = new Set();
  for (const e of editors) {
    const key = e.document.uri.toString();
    if (!seen.has(key)) {
      seen.add(key);
      docs.push(e.document);
    }
  }
  if (docs.length < 2) {
    docs = vscode.workspace.textDocuments.filter(
      (d) =>
        !d.isUntitled &&
        (d.languageId === "ln-4gl" ||
          /\.(bc|cln|ln4gl)$/i.test(d.fileName)),
    );
  }
  // unique by uri
  const unique = [];
  const keys = new Set();
  for (const d of docs) {
    const k = d.uri.toString();
    if (!keys.has(k)) {
      keys.add(k);
      unique.push(d);
    }
  }
  docs = unique;

  if (docs.length < 2) {
    vscode.window.showErrorMessage(
      "Need two open editors or ln-4gl tabs. Open both revisions, or pick two files.",
    );
    return undefined;
  }

  const docItems = docs.map((d) => ({
    label: path.basename(d.fileName),
    description: d.uri.fsPath,
    doc: d,
  }));

  const oldPick = await vscode.window.showQuickPick(docItems, {
    title: "Older revision (left)",
    placeHolder: "Select the old version",
  });
  if (!oldPick) {
    return undefined;
  }

  const newItems = docItems.filter((i) => i.doc !== oldPick.doc);
  const newPick = await vscode.window.showQuickPick(newItems, {
    title: "Newer revision (right)",
    placeHolder: "Select the new version",
  });
  if (!newPick) {
    return undefined;
  }

  return {
    kind: "full",
    oldText: oldPick.doc.getText(),
    newText: newPick.doc.getText(),
    oldLabel: oldPick.label,
    newLabel: newPick.label,
  };
}

/**
 * @returns {Promise<ReviewSource | undefined>}
 */
async function pickTwoFiles() {
  const oldUris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Older revision",
    filters: { "LN scripts": ["bc", "cln", "ln4gl"], "All files": ["*"] },
  });
  if (!oldUris?.[0]) {
    return undefined;
  }

  const newUris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "Newer revision",
    filters: { "LN scripts": ["bc", "cln", "ln4gl"], "All files": ["*"] },
  });
  if (!newUris?.[0]) {
    return undefined;
  }

  const oldDoc = await vscode.workspace.openTextDocument(oldUris[0]);
  const newDoc = await vscode.workspace.openTextDocument(newUris[0]);
  return {
    kind: "full",
    oldText: oldDoc.getText(),
    newText: newDoc.getText(),
    oldLabel: path.basename(oldUris[0].fsPath),
    newLabel: path.basename(newUris[0].fsPath),
  };
}

module.exports = {
  registerRevisionCommands,
  runReviewRevisions,
};
