#!/usr/bin/env python3
"""Extract Infor ES runtime error codes from Progguide JSON into data/errors-catalog.json."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "errors-catalog.json"
COMPLETIONS_PATH = ROOT / "data" / "completions.json"
DOCS_PATH = ROOT / "data" / "docs.json"

TITLE_RE = re.compile(r"^\s*(\d+)\s+(\w+)\s*-\s*(.+?)\s*$")


def parse_error_page(path: Path) -> dict | None:
    data = json.loads(path.read_text(encoding="utf-8"))
    title = data.get("title", "")
    m = TITLE_RE.match(title)
    if not m:
        return None
    number, code, summary = m.group(1), m.group(2), m.group(3).strip()
    doc = f"{number} {code} — {summary}"
    return {"code": code, "number": int(number), "summary": summary, "doc": doc}


def load_from_progguide(progguide: Path) -> list[dict]:
    errors_dir = progguide / "pages" / "errors"
    if not errors_dir.is_dir():
        raise SystemExit(f"errors directory not found: {errors_dir}")
    entries: list[dict] = []
    for path in sorted(errors_dir.glob("[0-9]*_*.json")):
        parsed = parse_error_page(path)
        if parsed:
            entries.append(parsed)
    if not entries:
        raise SystemExit(f"no error pages parsed under {errors_dir}")
    entries.sort(key=lambda e: (e["number"], e["code"]))
    return entries


def write_catalog(entries: list[dict]) -> None:
    CATALOG_PATH.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {CATALOG_PATH} ({len(entries)} errors)")


def merge_into_repo(entries: list[dict]) -> None:
    codes = sorted({e["code"] for e in entries}, key=str.lower)
    docs_updates = {e["code"]: e["doc"] for e in entries}

    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    completions["errors"] = codes
    COMPLETIONS_PATH.write_text(json.dumps(completions, indent=2) + "\n", encoding="utf-8")
    print(f"updated {COMPLETIONS_PATH} errors ({len(codes)} codes)")

    docs = json.loads(DOCS_PATH.read_text(encoding="utf-8"))
    docs.update(docs_updates)
    DOCS_PATH.write_text(json.dumps(docs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {DOCS_PATH} ({len(docs_updates)} error entries)")


def check_catalog() -> None:
    if not CATALOG_PATH.is_file():
        raise SystemExit(f"missing committed catalog: {CATALOG_PATH}")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    docs = json.loads(DOCS_PATH.read_text(encoding="utf-8"))

    codes = [e["code"] for e in catalog]
    if completions.get("errors") != sorted(set(codes), key=str.lower):
        raise SystemExit("completions.errors drift from errors-catalog.json")

    for entry in catalog:
        code = entry["code"]
        if code not in docs:
            raise SystemExit(f"missing docs.json entry for {code}")
        if docs[code] != entry["doc"]:
            raise SystemExit(f"docs drift for {code}")

    if len(catalog) < 70:
        raise SystemExit(f"errors catalog too small: {len(catalog)}")
    print(f"check:errors ok ({len(catalog)} codes)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--progguide",
        type=Path,
        help="Path to ln-progguide/dist/data/progguide",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify committed catalog matches completions.json and docs.json",
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="After building catalog, update completions.json and docs.json",
    )
    args = parser.parse_args()

    if args.check:
        check_catalog()
        return

    if not args.progguide:
        parser.error("--progguide is required unless --check")

    entries = load_from_progguide(args.progguide.resolve())
    write_catalog(entries)
    if args.merge:
        merge_into_repo(entries)


if __name__ == "__main__":
    main()
