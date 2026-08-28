const catalog = require("../data/api-catalog.json");

/** @type {Map<string, object>} */
const BY_NAME = new Map(catalog.map((e) => [e.name.toLowerCase(), e]));

/** @type {Map<string, object[]>} */
const BY_CONTEXT = new Map();
for (const entry of catalog) {
  for (const ctx of entry.context || ["all"]) {
    const list = BY_CONTEXT.get(ctx) || [];
    list.push(entry);
    BY_CONTEXT.set(ctx, list);
  }
}

const UI_PRIORITY = new Set([
  "execute",
  "display",
  "display.fld",
  "display.all",
  "get.var",
  "put.var",
  "choice.again",
  "get.screen.defaults",
  "enable.fields",
  "disable.fields",
  "enable.commands",
  "disable.commands",
  "set.input.error",
  "input.again",
  "refresh",
  "mark.occ",
  "remove.mark",
  "do.occ",
  "do.all.occ",
]);

const UI_DEPRIORITIZE = /^(xml\.|java\.|curl\.|sig\.|client\.)/i;
const DAL_DEPRIORITIZE =
  /^(display|choice\.again|enable\.|disable\.|set\.input\.error)/i;

/**
 * @param {string} name
 * @returns {object | undefined}
 */
function lookupCatalog(name) {
  return BY_NAME.get(name.toLowerCase());
}

/**
 * @param {string} name
 * @returns {string | undefined}
 */
function detailFor(name) {
  const entry = lookupCatalog(name);
  if (!entry) {
    return undefined;
  }
  const ctx =
    entry.context && entry.context.length
      ? ` [${entry.context.join(", ")}]`
      : "";
  return `${entry.doc || entry.name}${ctx}`;
}

/**
 * @param {string} name
 * @param {object | undefined} entry
 * @returns {string | undefined}
 */
function hoverFor(name, entry = lookupCatalog(name)) {
  if (!entry) {
    return undefined;
  }
  let text = entry.doc || entry.name;
  if (entry.syntax) {
    text += `\n\n\`${entry.syntax}\``;
  }
  if (entry.returns) {
    text += `\n\nReturns: ${entry.returns}`;
  }
  if (entry.replaces && entry.replaces.length) {
    const sections = entry.replaces.map((s) => `\`${s}:\``).join(", ");
    text += `\n\n**Replaces UI:** ${sections}`;
  }
  return text;
}

/**
 * Sort prefix for completion ordering by script kind and catalog context.
 * @param {string} label
 * @param {"ui" | "dal" | "3gl" | "general"} scriptKind
 * @param {boolean} [isDalHook]
 * @returns {string}
 */
function sortPrefixFor(label, scriptKind, isDalHook = false) {
  const entry = lookupCatalog(label);
  const contexts = entry?.context || ["all"];
  const lower = label.toLowerCase();

  if (scriptKind === "ui") {
    if (UI_PRIORITY.has(lower) || lower.startsWith("attr.")) {
      return "0-";
    }
    if (contexts.includes("4gl") || contexts.includes("all")) {
      return "1-";
    }
    if (UI_DEPRIORITIZE.test(label)) {
      return "9-";
    }
    return "2-";
  }

  if (scriptKind === "dal") {
    if (isDalHook || lower.startsWith("dal.")) {
      return "0-";
    }
    if (contexts.includes("dal") || contexts.includes("all")) {
      return "1-";
    }
    if (DAL_DEPRIORITIZE.test(label)) {
      return "9-";
    }
    return "2-";
  }

  if (scriptKind === "3gl") {
    if (
      lower.startsWith("db.") ||
      lower === "select" ||
      lower.startsWith("#")
    ) {
      return "0-";
    }
    if (contexts.includes("3gl") || contexts.includes("all")) {
      return "1-";
    }
    if (contexts.includes("4gl") && !contexts.includes("all")) {
      return "9-";
    }
    return "2-";
  }

  return "1-";
}

/**
 * @param {"ui" | "dal" | "3gl" | "general"} scriptKind
 * @returns {object[]}
 */
function functionsForKind(scriptKind) {
  if (scriptKind === "general") {
    return catalog;
  }
  const allowed = new Set(["all"]);
  if (scriptKind === "ui") {
    allowed.add("4gl");
  } else if (scriptKind === "dal") {
    allowed.add("dal");
  } else if (scriptKind === "3gl") {
    allowed.add("3gl");
  }
  return catalog.filter((e) =>
    (e.context || ["all"]).some((c) => allowed.has(c)),
  );
}

module.exports = {
  catalog,
  BY_NAME,
  lookupCatalog,
  detailFor,
  hoverFor,
  sortPrefixFor,
  functionsForKind,
};
