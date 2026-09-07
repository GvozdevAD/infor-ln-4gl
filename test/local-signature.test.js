const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  localSignatureFor,
  resolveSignature,
} = require("../src/local-signature");

describe("localSignatureFor", () => {
  it("parses in-file function extern parameters", () => {
    const text = [
      "function extern long foo(long a, ref string b)",
      "{",
      "\treturn(0)",
      "}",
      "",
      "function main()",
      "{",
      "\tfoo(1, s)",
      "}",
      "",
    ].join("\n");
    const sig = localSignatureFor(text, "foo");
    assert.ok(sig);
    assert.match(sig.label, /function extern long foo/i);
    assert.equal(sig.parameters.length, 2);
    assert.match(sig.parameters[0], /long\s+a/i);
    assert.match(sig.parameters[1], /ref\s+string\s+b/i);
  });

  it("handles multi-line signatures", () => {
    const text = [
      "function extern long bar(",
      "\tlong x,",
      "\tlong y)",
      "{",
      "\treturn(0)",
      "}",
      "",
    ].join("\n");
    const sig = localSignatureFor(text, "bar");
    assert.ok(sig);
    assert.equal(sig.parameters.length, 2);
  });

  it("returns undefined for unknown names", () => {
    assert.equal(localSignatureFor("function main()\n{\n}\n", "nope"), undefined);
  });
});

describe("resolveSignature", () => {
  it("prefers local declaration over catalog", () => {
    // message exists in catalog; local wins with different arity
    const text = [
      "function extern void message(long only.one)",
      "{",
      "}",
      "",
    ].join("\n");
    const sig = resolveSignature(text, "message");
    assert.ok(sig);
    assert.match(sig.label, /only\.one/);
    assert.equal(sig.parameters.length, 1);
  });
});
