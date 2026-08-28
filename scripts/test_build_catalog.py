#!/usr/bin/env python3
"""Unit tests for build-catalog.py parsing."""

from __future__ import annotations

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

PROGGUIDE = Path(
    "/Users/loop/Downloads/Attachments_gvozdev_ad@hms-it/ln-progguide/dist/data/progguide"
)
PAGES = PROGGUIDE / "pages"


@unittest.skipUnless(PAGES.is_dir(), "progguide not available locally")
class BuildCatalogTests(unittest.TestCase):
    def test_dal_save_object(self) -> None:
        path = PAGES / "functions_db_operations" / "dal.save.object.json"
        entry = parse_page(path, {})
        assert entry is not None
        self.assertEqual(entry["name"], "dal.save.object")
        self.assertEqual(entry["kind"], "function")
        self.assertIn("4gl", entry["context"])
        self.assertTrue(entry["syntax"])
        self.assertTrue(entry["doc"])

    def test_before_save_object_hook(self) -> None:
        path = PAGES / "functions_dal" / "before.save.object.json"
        notes = json.loads((ROOT / "data" / "dal-notes.json").read_text())
        entry = parse_page(path, notes)
        assert entry is not None
        self.assertEqual(entry["name"], "before.save.object")
        self.assertEqual(entry["kind"], "dalHook")
        self.assertEqual(entry["replaces"], ["before.write", "before.rewrite"])

    def test_overview_skipped(self) -> None:
        self.assertTrue(should_skip("overview", "functions_dal/overview"))


if __name__ == "__main__":
    unittest.main()
