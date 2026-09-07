const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const completions = JSON.parse(
  fs.readFileSync(path.join(root, "data", "completions.json"), "utf8"),
);
const docs = JSON.parse(fs.readFileSync(path.join(root, "data", "docs.json"), "utf8"));
const errorsCatalog = JSON.parse(
  fs.readFileSync(path.join(root, "data", "errors-catalog.json"), "utf8"),
);
const apiCatalog = JSON.parse(
  fs.readFileSync(path.join(root, "data", "api-catalog.json"), "utf8"),
);
const signatures = JSON.parse(
  fs.readFileSync(path.join(root, "data", "signatures.json"), "utf8"),
);
const links = JSON.parse(
  fs.readFileSync(path.join(root, "data", "links.json"), "utf8"),
);

const docsLower = new Map(
  Object.keys(docs).map((k) => [k.toLowerCase(), k]),
);

describe("API catalog", () => {
  it("includes everyday db.* helpers in completions.functions", () => {
    assert.ok(completions.functions.includes("db.eq"));
    assert.ok(completions.functions.includes("db.first"));
    assert.ok(completions.functions.includes("pos"));
    assert.ok(completions.functions.includes("date.num"));
  });

  it("includes common error codes in completions.errors", () => {
    assert.ok(Array.isArray(completions.errors));
    assert.ok(completions.errors.includes("ELOCKED"));
    assert.ok(completions.errors.includes("EDUPL"));
    assert.ok(completions.errors.includes("ENOREC"));
  });

  it("has docs for every error code (case-insensitive)", () => {
    for (const code of completions.errors) {
      assert.ok(
        docsLower.has(code.toLowerCase()),
        `missing docs.json entry for ${code}`,
      );
    }
  });

  it("includes elif keyword and preprocessor directives", () => {
    assert.ok(completions.keywords.includes("elif"));
    assert.ok(Array.isArray(completions.preprocessor));
    assert.ok(completions.preprocessor.includes("#include"));
    assert.ok(completions.preprocessor.includes("#ifndef"));
  });

  it("has at least 40 4GL section labels", () => {
    assert.ok(completions.sections.length >= 40);
    assert.ok(completions.sections.includes("main.table.io:"));
    assert.ok(completions.sections.includes("before.read:"));
  });

  it("errors catalog matches completions.errors", () => {
    assert.ok(completions.errors.length >= 70);
    const catalogCodes = errorsCatalog.map((e) => e.code).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    const completionCodes = [...completions.errors].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
    assert.deepEqual(completionCodes, catalogCodes);
  });

  it("has hover docs for control-flow keywords", () => {
    for (const key of ["on case", "default", "break", "continue", "elif"]) {
      assert.ok(docsLower.has(key), `missing docs for ${key}`);
    }
  });

  it("api-catalog has at least 1500 entries with required fields", () => {
    assert.ok(apiCatalog.length >= 1500, `catalog size ${apiCatalog.length}`);
    for (const entry of apiCatalog) {
      assert.ok(entry.name, "missing name");
      assert.ok(entry.doc, `missing doc for ${entry.name}`);
      assert.ok(entry.kind, `missing kind for ${entry.name}`);
    }
  });

  it("completions.functions matches api-catalog function names", () => {
    const fnNames = new Set(
      apiCatalog
        .filter((e) => e.kind === "function" || e.kind === "dalFieldHook")
        .map((e) => e.name),
    );
    assert.equal(completions.functions.length, fnNames.size);
    for (const name of fnNames) {
      assert.ok(
        completions.functions.includes(name),
        `missing completion for ${name}`,
      );
    }
  });

  it("signatures cover most catalog entries with syntax", () => {
    const withSyntax = apiCatalog.filter((e) => e.syntax);
    const covered = withSyntax.filter((e) => signatures[e.name]);
    const ratio = covered.length / withSyntax.length;
    assert.ok(ratio >= 0.8, `signature coverage ${ratio}`);
    for (const entry of covered) {
      assert.ok(signatures[entry.name].label, `${entry.name} missing label`);
    }
  });

  it("links.json has hook relations for DAL APIs", () => {
    assert.ok(Object.keys(links).length >= 1000);
    assert.ok(links["dal.save.object"]);
    assert.ok(Array.isArray(links["dal.save.object"].hooksCalled));
  });

  it("marks DsC* as uiObject stubs, not functions", () => {
    const entry = apiCatalog.find((e) => e.name === "DsCbarMenu");
    assert.ok(entry, "DsCbarMenu missing from catalog");
    assert.equal(entry.kind, "uiObject");
    assert.ok(entry.syntax);
    assert.ok(entry.returns);
    assert.ok(!completions.functions.includes("DsCbarMenu"));
  });

  it("excludes doc-topic non-callables", () => {
    const names = new Set(apiCatalog.map((e) => e.name.toLowerCase()));
    for (const bad of ["constraints", "debugging", "subqueries", "chm.hooks"]) {
      assert.ok(!names.has(bad), `${bad} should not be in catalog`);
    }
  });
});

describe("hoverFor (D4)", () => {
  const { hoverFor, lookupCatalog, returnsForHover } = require("../src/catalog");

  it("always includes Returns for void APIs (mess)", () => {
    const entry = lookupCatalog("mess");
    assert.ok(entry);
    assert.equal(returnsForHover(entry), "void");
    const md = hoverFor("mess", entry);
    assert.match(md, /\*\*Returns:\*\* void/);
    assert.match(md, /`function void mess/);
    assert.match(md, /\*\*See also:\*\*.*`clean\.mess`/);
  });

  it("db.eq: description, syntax, returns, see also", () => {
    const entry = lookupCatalog("db.eq");
    assert.ok(entry);
    const md = hoverFor("db.eq", entry);
    assert.match(md, /key value|equals|record/i);
    assert.match(md, /`function long db\.eq/);
    assert.match(md, /\*\*Returns:\*\*.*Success/i);
    assert.match(md, /\*\*See also:\*\*.*`db\.bind`/);
    // Order: doc before syntax before Returns
    const iDoc = md.search(/key value|equals|record/i);
    const iSyn = md.indexOf("`function long db.eq");
    const iRet = md.indexOf("**Returns:**");
    assert.ok(iDoc >= 0 && iSyn > iDoc && iRet > iSyn);
  });

  it("before.save.object: returns + replaces UI", () => {
    const entry = lookupCatalog("before.save.object");
    assert.ok(entry);
    const md = hoverFor("before.save.object", entry);
    assert.match(md, /\*\*Returns:\*\*.*DALHOOKERROR|permitted/i);
    assert.match(md, /\*\*Replaces UI:\*\*.*`before\.write:`/);
    assert.match(md, /`before\.rewrite:`/);
    assert.match(md, /`function extern long before\.save\.object/);
  });

  it("alloc.mem: returns success codes", () => {
    const entry = lookupCatalog("alloc.mem");
    assert.ok(entry);
    const md = hoverFor("alloc.mem", entry);
    assert.match(md, /BASED|memory|allocat/i);
    assert.match(md, /`function long alloc\.mem/);
    assert.match(md, /\*\*Returns:\*\*.*0 success/i);
    assert.match(md, /\*\*See also:\*\*.*`free\.mem`/);
  });

  it("infers void Returns when returns field empty but syntax is void", () => {
    const md = hoverFor("x", {
      name: "x",
      doc: "Demo.",
      syntax: "function void x ()",
      returns: "",
    });
    assert.match(md, /\*\*Returns:\*\* void/);
  });

  it("uses n/a when no returns and not void", () => {
    const md = hoverFor("y", {
      name: "y",
      doc: "Demo.",
      syntax: "function long y ()",
      returns: "",
    });
    assert.match(md, /\*\*Returns:\*\* n\/a/);
  });
});
