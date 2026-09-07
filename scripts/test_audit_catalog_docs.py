#!/usr/bin/env python3
"""Unit tests for audit-catalog-docs.py."""

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "audit-catalog-docs.py"

spec = importlib.util.spec_from_file_location("audit_catalog_docs", SCRIPT)
assert spec and spec.loader
audit_mod = importlib.util.module_from_spec(spec)
sys.modules["audit_catalog_docs"] = audit_mod
spec.loader.exec_module(audit_mod)


class AuditCatalogDocsTests(unittest.TestCase):
    def test_typed_missing_returns(self) -> None:
        reasons = audit_mod.classify_gap(
            {
                "name": "argc",
                "doc": "Returns the number of command-line arguments.",
                "syntax": "function long argc ()",
                "returns": "",
            }
        )
        self.assertIn("no_returns", reasons)
        self.assertIn("typed_missing_returns", reasons)

    def test_void_without_returns_flagged_only_no_returns(self) -> None:
        reasons = audit_mod.classify_gap(
            {
                "name": "message",
                "doc": "Displays a message string.",
                "syntax": "function void message (string mess_str)",
                "returns": "",
            }
        )
        self.assertIn("no_returns", reasons)
        self.assertNotIn("typed_missing_returns", reasons)

    def test_complete_entry_no_gap(self) -> None:
        reasons = audit_mod.classify_gap(
            {
                "name": "db.eq",
                "doc": "Reads a record whose key equals a predefined value.",
                "syntax": "function long db.eq (long table_id [, long lock])",
                "returns": "0 Success.",
            }
        )
        self.assertEqual(reasons, [])

    def test_priority_db_before_generic(self) -> None:
        self.assertLess(audit_mod.priority_for("db.eq"), audit_mod.priority_for("zipinfo.new"))
        self.assertLess(audit_mod.priority_for("mess"), audit_mod.priority_for("zipinfo.new"))

    def test_audit_sorts_by_priority(self) -> None:
        gaps = audit_mod.audit(
            [
                {
                    "name": "zzz.generic",
                    "doc": "x",
                    "syntax": "function long zzz.generic ()",
                    "returns": "",
                    "source": "functions_x/zzz.generic",
                    "kind": "function",
                },
                {
                    "name": "db.eq",
                    "doc": "x",
                    "syntax": "function long db.eq ()",
                    "returns": "",
                    "source": "functions_db_operations/db.eq",
                    "kind": "function",
                },
            ]
        )
        self.assertEqual(gaps[0]["name"], "db.eq")
        self.assertEqual(gaps[0]["priority"], 10)

    def test_write_and_roundtrip(self) -> None:
        catalog = [
            {
                "name": "argc",
                "doc": "Returns argc.",
                "syntax": "function long argc ()",
                "returns": "",
                "source": "functions_processes/argc",
                "kind": "function",
            }
        ]
        gaps = audit_mod.audit(catalog)
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "gaps.jsonl"
            audit_mod.write_jsonl(out, gaps)
            lines = [json.loads(l) for l in out.read_text().splitlines() if l.strip()]
            self.assertEqual(len(lines), 1)
            self.assertEqual(lines[0]["name"], "argc")
            self.assertIn("typed_missing_returns", lines[0]["reasons"])


if __name__ == "__main__":
    unittest.main()
