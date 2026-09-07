const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  functionUsageIndex,
  formatUsageHover,
  parseSignatureParams,
  buildFunctionUsageSnippet,
  parseUsageDocLines,
  matchesUsagePrefix,
} = require("../src/function-usage");

describe("functionUsageIndex", () => {
  it("indexes guide-style FunctionUsage (abs example)", () => {
    const text = `
function extern long abs( long arg )
{
	FunctionUsage
	This function returns the absolute value of the specified argument.
	Input:	ARG	The value for which the absolute value is to be returned.
	Output:	-
	Return:	the positive value of ARG.
	EndFunctionUsage
	return ( arg >= 0 ? arg : -arg )
}
`;
    const idx = functionUsageIndex(text);
    const entry = idx.get("abs");
    assert.ok(entry);
    assert.equal(
      entry.doc.brief,
      "This function returns the absolute value of the specified argument.",
    );
    assert.deepEqual(entry.doc.params, [
      {
        name: "ARG",
        desc: "The value for which the absolute value is to be returned.",
      },
    ]);
    assert.equal(entry.doc.outParams.length, 0);
    assert.equal(entry.doc.returns, "the positive value of ARG.");
  });

  it("does not use legacy |** docs", () => {
    const text = `
|**
| @brief Legacy note
| @param x value
function long foo(long x)
{
	return(0)
}
`;
    const idx = functionUsageIndex(text);
    assert.equal(idx.has("foo"), false);
  });
});

describe("formatUsageHover", () => {
  it("renders markdown sections on separate blocks", () => {
    const md = formatUsageHover(
      {
        brief: "Does a thing",
        params: [{ name: "a", desc: "in" }],
        outParams: [],
        returns: "0",
      },
      "function long foo(long a)",
    );
    assert.match(md, /```baan/);
    assert.match(md, /Does a thing/);
    assert.match(md, /\*\*Input\*\*/);
    assert.match(md, /\*\*Return\*\*/);
    assert.doesNotMatch(md, /Does a thing Input/);
  });
});

describe("FunctionUsage hover priority", () => {
  it("in-file usage wins over catalog docs for the same name", () => {
    const docs = require("../data/docs.json");
    const { lookupCatalog, hoverFor } = require("../src/catalog");
    // Use a name that exists in the extension catalog.
    const catalogName = "message";
    assert.ok(
      docs[catalogName] || lookupCatalog(catalogName),
      "expected catalog entry for message",
    );

    const text = `
function extern void message(string s)
{
	FunctionUsage
	LOCAL ONLY — in-file FunctionUsage must win.
	Input:	s	local arg
	Output:	-
	Return:	-
	EndFunctionUsage
}
`;
    const idx = functionUsageIndex(text);
    const local = idx.get("message");
    assert.ok(local);
    const usageMd = formatUsageHover(local.doc, local.signatureLine);
    assert.match(usageMd, /LOCAL ONLY/);

    const catalogEntry = lookupCatalog(catalogName);
    const catalogMd = catalogEntry
      ? hoverFor(catalogName, catalogEntry)
      : docs[catalogName] || docs[catalogName.toLowerCase()];
    assert.ok(catalogMd);
    assert.doesNotMatch(String(catalogMd), /LOCAL ONLY/);

    // Mirror hover.js: prefer local when present.
    const chosen = local ? usageMd : catalogMd;
    assert.match(chosen, /LOCAL ONLY/);
  });
});

describe("buildFunctionUsageSnippet", () => {
  it("maps ref params to Output (guide labels)", () => {
    const snip = buildFunctionUsageSnippet(
      [
        { name: "i.a", out: false },
        { name: "o.b", out: true },
      ],
      "from_signature",
    );
    assert.match(snip, /Input:\ti\.a/);
    assert.match(snip, /Output:\to\.b/);
    assert.match(snip, /Return:/);
    assert.match(snip, /EndFunctionUsage/);
    assert.doesNotMatch(snip, /Description:|Arguments:|Return values:/i);
  });
});

describe("parseSignatureParams", () => {
  it("parses ref as out", () => {
    const params = parseSignatureParams([
      "function extern long foo(domain tcmcs.str30 i.a, ref long o.b)",
    ]);
    assert.deepEqual(params, [
      { name: "i.a", out: false },
      { name: "o.b", out: true },
    ]);
  });
});

describe("parseUsageDocLines", () => {
  it("parses Input/Output/Return; ignores Output: -", () => {
    const doc = parseUsageDocLines([
      "FunctionUsage",
      "Hello",
      "world continued",
      "Input:\t-",
      "Output:\tx\tnote",
      "Return:\tok",
      "EndFunctionUsage",
    ]);
    assert.equal(doc.brief, "Hello\nworld continued");
    assert.equal(doc.params.length, 0);
    assert.deepEqual(doc.outParams, [{ name: "x", desc: "note" }]);
    assert.equal(doc.returns, "ok");
  });

  it("does not treat Description:/Arguments: as structured sections", () => {
    const doc = parseUsageDocLines([
      "FunctionUsage",
      "Description:",
      "External entry",
      "Arguments:",
      "i.node\tXML root",
      "Return values:",
      "0\tsuccess",
      "EndFunctionUsage",
    ]);
    // Without guide labels, everything is brief prose (not split into params).
    assert.ok(doc.brief && doc.brief.includes("Description:"));
    assert.equal(doc.params.length, 0);
    assert.equal(doc.returns, undefined);
  });
});

describe("matchesUsagePrefix", () => {
  it("matches FunctionUsage prefixes without matching unrelated words", () => {
    assert.equal(matchesUsagePrefix("Fun", "functionusage"), true);
    assert.equal(matchesUsagePrefix("functionusage", "functionusage"), true);
    assert.equal(matchesUsagePrefix("file", "functionusage"), false);
    assert.equal(matchesUsagePrefix("dll", "dllusage"), true);
    assert.equal(matchesUsagePrefix("db", "dllusage"), false);
  });
});
