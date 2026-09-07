/**
 * Embedded SQL completion helpers (no vscode dependency).
 */

const completions = require("../data/completions.json");

/**
 * True when the typed token is an embedded-SQL keyword (e.g. `select`),
 * so left-margin typing is not treated as a 4GL section header.
 * @param {string} word
 */
function isSqlKeywordToken(word) {
  if (!word) {
    return false;
  }
  const w = word.toLowerCase();
  const sql = completions.sql || [];
  return sql.some((s) => String(s).toLowerCase() === w);
}

/**
 * Prefix of a typical embedded-SQL statement starter (beats section headers
 * like `selection.filter:` while typing `sel`…`select`).
 * @param {string} word
 */
function looksLikeSqlStarter(word) {
  if (!word || word.length < 2) {
    return false;
  }
  const w = word.toLowerCase();
  const starters = [
    "select",
    "selectdo",
    "selectempty",
    "selecteos",
    "selecterror",
    "endselect",
    "update",
    "endupdate",
    "delete",
    "enddelete",
    "from",
    "where",
  ];
  return starters.some((s) => s.startsWith(w));
}

/**
 * @param {string} wordPrefix
 * @returns {boolean}
 */
function wantsSqlBlockSnippet(wordPrefix) {
  const p = (wordPrefix || "").toLowerCase();
  if (!p || p.length < 2) {
    return false;
  }
  const triggers = ["select", "sel", "selectdo", "endselect"];
  return triggers.some((t) => t.startsWith(p) || p.startsWith(t));
}

/**
 * Body lines for the standard selectdo block (Progguide embedded SQL).
 * @returns {string[]}
 */
function sqlSelectDoBlockLines() {
  return [
    "select ${1:table}.*",
    "from $1",
    "where $1.${2:field} = :${3:value}",
    "selectdo",
    "\t$0",
    "selectempty",
    "\t",
    "endselect",
  ];
}

module.exports = {
  isSqlKeywordToken,
  looksLikeSqlStarter,
  wantsSqlBlockSnippet,
  sqlSelectDoBlockLines,
};
