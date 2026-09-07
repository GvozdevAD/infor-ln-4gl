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

const FIELD_HOOK_SUFFIX = [
  { re: /\.enum\.is\.applicable$/i, catalog: "field.enum.is.applicable" },
  { re: /\.is\.never\.applicable$/i, catalog: "field.is.never.applicable" },
  { re: /\.is\.applicable$/i, catalog: "field.is.applicable" },
  { re: /\.is\.readonly$/i, catalog: "field.is.readonly" },
  { re: /\.is\.derived$/i, catalog: "field.is.derived" },
  { re: /\.is\.mandatory$/i, catalog: "field.is.mandatory" },
  { re: /\.is\.valid$/i, catalog: "field.is.valid" },
  // Require table.field.update — avoid matching db.update / dal.update
  { re: /^[A-Za-z_]\w*\.[A-Za-z_]\w*\.update$/i, catalog: "field.update" },
];

/**
 * Map `table.field.is.valid` style names to catalog `field.is.valid` entries.
 * @param {string} word
 * @returns {object | undefined}
 */
function lookupFieldHookCatalog(word) {
  for (const { re, catalog } of FIELD_HOOK_SUFFIX) {
    if (re.test(word)) {
      return lookupCatalog(catalog);
    }
  }
  return undefined;
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
 * Resolve the Returns line for hover (always present for catalog entries).
 * @param {object} entry
 * @returns {string}
 */
function returnsForHover(entry) {
  const ret = (entry.returns || "").trim();
  if (ret) {
    return ret;
  }
  const syntax = entry.syntax || "";
  if (/\bfunction\s+(?:extern\s+)?void\b/i.test(syntax)) {
    return "void";
  }
  return "n/a";
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
  const parts = [];
  parts.push(entry.doc || entry.name);
  if (entry.syntax) {
    parts.push(`\`${entry.syntax}\``);
  }
  // D4: always show Returns (including void / n/a).
  parts.push(`**Returns:** ${returnsForHover(entry)}`);
  if (entry.replaces && entry.replaces.length) {
    const sections = entry.replaces.map((s) => `\`${s}:\``).join(", ");
    parts.push(`**Replaces UI:** ${sections}`);
  }
  if (entry.related && entry.related.length) {
    const related = entry.related.map((s) => `\`${s}\``).join(", ");
    parts.push(`**See also:** ${related}`);
  }
  return parts.join("\n\n");
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

  if (scriptKind === "report") {
    if (lower.startsWith("lattr.") || lower.startsWith("layout.")) {
      return "0-";
    }
    if (contexts.includes("4gl") || contexts.includes("all")) {
      return "1-";
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
  lookupFieldHookCatalog,
  detailFor,
  hoverFor,
  returnsForHover,
  sortPrefixFor,
  functionsForKind,
};
