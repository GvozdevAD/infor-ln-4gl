#!/usr/bin/env python3
"""Unit tests for enrich-catalog.py helpers."""

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "enrich-catalog.py"

spec = importlib.util.spec_from_file_location("enrich_catalog", SCRIPT)
assert spec and spec.loader
enrich = importlib.util.module_from_spec(spec)
sys.modules["enrich_catalog"] = enrich
spec.loader.exec_module(enrich)


class EnrichCatalogTests(unittest.TestCase):
    def test_exact_doc_hit_accepts_id_and_title(self) -> None:
        hit = enrich.exact_doc_hit(
            "db.error",
            [
                {
                    "id": "functions_db_operations/db.error",
                    "title": "db.error()",
                    "text": "x",
                }
            ],
        )
        self.assertIsNotNone(hit)

    def test_exact_doc_hit_rejects_neighbor(self) -> None:
        hit = enrich.exact_doc_hit(
            "db.error",
            [
                {
                    "id": "functions_db_operations/db.error.message",
                    "title": "db.error.message()",
                    "text": "x",
                }
            ],
        )
        self.assertIsNone(hit)

    def test_parse_doc_hit_text_sections(self) -> None:
        parsed = enrich.parse_doc_hit_text(
            "Page: argc()\n\n## Syntax\n`function long argc ()`\n\n"
            "## Description\nThis returns the number of arguments.\n\n"
            "## Return values\nThe argument count.\n"
        )
        self.assertIn("argc", parsed["syntax"])
        self.assertIn("number of arguments", parsed["doc"])
        self.assertIn("argument count", parsed["returns"])

    def test_returns_from_description_prefers_returns_sentence(self) -> None:
        doc = (
            "Returns a copy of string$ with replacements. "
            "As this function returns a string value that can become larger, pad the buffer."
        )
        got = enrich.returns_from_description(doc)
        self.assertTrue(got.startswith("Returns a copy"))
        self.assertNotIn("As this function", got)


if __name__ == "__main__":
    unittest.main()
