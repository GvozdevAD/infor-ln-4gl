#!/usr/bin/env python3
"""Unit tests for build-catalog.py parsing."""

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build-catalog.py"

spec = importlib.util.spec_from_file_location("build_catalog", SCRIPT)
assert spec and spec.loader
build_catalog = importlib.util.module_from_spec(spec)
sys.modules["build_catalog"] = build_catalog
spec.loader.exec_module(build_catalog)

parse_page = build_catalog.parse_page
should_skip = build_catalog.should_skip
split_function_syntaxes = build_catalog.split_function_syntaxes
extract_api_name = build_catalog.extract_api_name
apply_overrides = build_catalog.apply_overrides

PAGES = Path(build_catalog.DEFAULT_PROGGUIDE_PAGES)


def _first(entries):
    assert entries, "expected catalog entries"
    return entries[0]


@unittest.skipUnless(PAGES.is_dir(), "progguide not available locally")
class BuildCatalogTests(unittest.TestCase):
    def test_dal_save_object(self) -> None:
        path = PAGES / "functions_db_operations" / "dal.save.object.json"
        entry = _first(parse_page(path, {}))
        self.assertEqual(entry["name"], "dal.save.object")
        self.assertEqual(entry["kind"], "function")
        self.assertIn("4gl", entry["context"])
        self.assertTrue(entry["syntax"])
        self.assertTrue(entry["doc"])

    def test_before_save_object_hook(self) -> None:
        path = PAGES / "functions_dal" / "before.save.object.json"
        notes = json.loads((ROOT / "data" / "dal-notes.json").read_text())
        entry = _first(parse_page(path, notes))
        self.assertEqual(entry["name"], "before.save.object")
        self.assertEqual(entry["kind"], "dalHook")
        self.assertEqual(entry["replaces"], ["before.write", "before.rewrite"])
        self.assertNotRegex(entry["syntax"], r"(?i)function\s+function")
        self.assertIn("before.save.object", entry["syntax"])
        self.assertTrue(entry["returns"])
        self.assertNotIn("…", entry["doc"])
        self.assertGreater(len(entry["doc"]), 80)

    def test_void_message_returns(self) -> None:
        path = PAGES / "functions_message_handling" / "message.json"
        entry = _first(parse_page(path, {}))
        self.assertEqual(entry["returns"], "void")

    def test_abort_transaction_table_returns(self) -> None:
        path = PAGES / "functions_db_operations" / "abort.transaction.json"
        entry = _first(parse_page(path, {}))
        self.assertIn("Success", entry["returns"])
        self.assertNotIn("…", entry["returns"])

    def test_overview_skipped(self) -> None:
        self.assertTrue(should_skip("overview", "functions_dal/overview"))

    def test_doc_topics_skipped(self) -> None:
        path = PAGES / "functions_xml" / "constraints.json"
        if path.is_file():
            self.assertEqual(parse_page(path, {}), [])

    def test_dsc_ui_object_stub(self) -> None:
        path = PAGES / "functions_user_interface_objects" / "dscbarmenu.json"
        if not path.is_file():
            self.skipTest("progguide page missing")
        entry = _first(parse_page(path, {}))
        self.assertEqual(entry["kind"], "uiObject")
        self.assertTrue(entry["syntax"])
        self.assertIn("UI object", entry["returns"])

    def test_dal_set_error_message_multi(self) -> None:
        path = PAGES / "functions_message_handling" / "dal.set.error.message.json"
        if not path.is_file():
            self.skipTest("progguide page missing")
        entries = parse_page(path, {})
        names = {e["name"] for e in entries}
        self.assertIn("dal.set.error.message", names)
        self.assertIn("dal.set.warning.message", names)
        self.assertIn("dal.set.info.message", names)
        err = next(e for e in entries if e["name"] == "dal.set.error.message")
        self.assertIn("dal.set.error.message", err["syntax"])
        self.assertNotIn("dal.set.warning.message", err["syntax"])


class BuildCatalogUnitTests(unittest.TestCase):
    def test_split_function_syntaxes_multi(self) -> None:
        blob = (
            "function void dal.set.error.message (string mess.or.code [, void arg ...])\n"
            "function void dal.set.warning.message (string mess.or.code [, void arg ...])\n"
            "function void dal.set.info.message (string mess.or.code [, void arg ...])\n"
        )
        pairs = split_function_syntaxes(blob)
        self.assertEqual(
            [n for n, _ in pairs],
            [
                "dal.set.error.message",
                "dal.set.warning.message",
                "dal.set.info.message",
            ],
        )

    def test_extract_api_name_prefers_stem_over_keywords(self) -> None:
        name = extract_api_name(
            {
                "title": "dal.set.error.message(), dal.set.warning.message(), dal.set.info.message()",
                "keywords": ["dal.set.warning.message", "dal.set.error.message"],
            },
            "dal.set.error.message",
        )
        self.assertEqual(name, "dal.set.error.message")

    def test_apply_overrides_inserts_missing(self) -> None:
        entries = []
        n = apply_overrides(
            entries,
            {
                "dal.set.error.message": {
                    "doc": "Adds MSG.ERROR to the DAL message buffer.",
                    "syntax": "function void dal.set.error.message (string mess.or.code)",
                    "returns": "void",
                }
            },
        )
        self.assertEqual(n, 1)
        self.assertEqual(entries[0]["name"], "dal.set.error.message")
        self.assertEqual(entries[0]["returns"], "void")


if __name__ == "__main__":
    unittest.main()
