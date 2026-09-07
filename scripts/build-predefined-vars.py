#!/usr/bin/env python3
"""Extract attr.*/lattr.*/fattr.*/session predefined vars from Progguide into data/predefined-vars.json."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "predefined-vars.json"
COMPLETIONS_PATH = ROOT / "data" / "completions.json"
DOCS_PATH = ROOT / "data" / "docs.json"

DEFAULT_PROGGUIDE_PAGES = os.environ.get(
    "LN_PROGGUIDE_PAGES",
    str(ROOT.parent / "ln-progguide-rag" / "data" / "pages"),
)

NAME_RE = re.compile(r"^([A-Za-z_][\w.$]*?)(?:\(|$)")
ATTR_FLAG_RE = re.compile(r"^[4RD/\s]+$", re.I)


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_td = False
        self.cell = ""
        self.row: list[str] = []
        self.rows: list[list[str]] = []
        self.in_tr = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self.in_tr = True
            self.row = []
        elif tag == "td" and self.in_tr:
            self.in_td = True
            self.cell = ""

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self.in_td:
            self.in_td = False
            text = re.sub(r"\s+", " ", self.cell).strip()
            self.row.append(text)
        elif tag == "tr" and self.in_tr:
            self.in_tr = False
            if self.row:
                self.rows.append(self.row)

    def handle_data(self, data: str) -> None:
        if self.in_td:
            self.cell += data


def basename(raw: str) -> str | None:
    m = NAME_RE.match(raw.strip())
    return m.group(1) if m else None


def kind_for(name: str) -> str:
    lower = name.lower()
    if lower.startswith("lattr."):
        return "lattr"
    if lower.startswith("fattr."):
        return "fattr"
    if lower.startswith("attr.") or lower.startswith("sattr."):
        return "attr"
    return "session"


def load_deprecated(pages: Path) -> set[str]:
    path = pages / "webtop" / "other_deprecated.json"
    if not path.is_file():
        return set()
    html = json.loads(path.read_text(encoding="utf-8")).get("bodyHtml", "")
    names = set()
    for raw in re.findall(r"(?:attr|fattr|sattr|lattr)\.[\w.$]+", html, flags=re.I):
        base = basename(raw)
        if base:
            names.add(base.lower())
            # guide lists attr.bitset / attr.enum.mask without suffix
            if base.lower() == "attr.bitset":
                names.add("attr.bitset.mask")
            if base.lower() == "attr.enum.mask":
                names.add("attr.enum.mask$")
    return names


def parse_misc_rows(html: str) -> list[dict]:
    tp = TableParser()
    tp.feed(html)
    entries: list[dict] = []
    seen: set[str] = set()
    for row in tp.rows:
        if len(row) < 4:
            continue
        typ, name_raw, flags, desc = row[0], row[1], row[2], row[3]
        if name_raw.lower() in {"name", "type"}:
            continue
        name = basename(name_raw)
        if not name or name.lower() in seen:
            continue
        # Skip enum-value pseudo-rows that leaked into Name
        if not re.match(r"^[A-Za-z_]", name):
            continue
        if flags and not ATTR_FLAG_RE.match(flags.replace(" ", "")) and flags not in {
            "4",
            "4R",
            "4 D",
            "4R D",
            "R",
            "R/W",
            "4RW",
        }:
            # still accept if Name looks like a variable
            if "." not in name and name.lower() not in {
                "actual.occ",
                "choice",
                "curr.key",
                "date",
                "e",
            }:
                pass
        deprecated = "D" in flags.upper().split() or " D" in f" {flags.upper()}"
        if "D" in flags.upper():
            deprecated = True
        doc = desc.strip() or f"Predefined variable ({typ})"
        entries.append(
            {
                "name": name,
                "doc": doc,
                "deprecated": deprecated,
                "kind": kind_for(name),
                "type": typ,
            }
        )
        seen.add(name.lower())
    return entries


def parse_lattr_rows(html: str) -> list[dict]:
    tp = TableParser()
    tp.feed(html)
    entries: list[dict] = []
    seen: set[str] = set()
    for row in tp.rows:
        if len(row) < 3:
            continue
        name_raw, access, desc = row[0], row[1], row[2]
        name = basename(name_raw)
        if not name or not name.lower().startswith("lattr."):
            continue
        if name.lower() in seen:
            continue
        doc = desc.strip()
        if access:
            doc = f"{doc} ({access})" if doc else access
        entries.append(
            {
                "name": name,
                "doc": doc or "Report predefined variable",
                "deprecated": False,
                "kind": "lattr",
            }
        )
        seen.add(name.lower())
    return entries


def recover_missing_attr(html: str, have: set[str]) -> list[dict]:
    """Recover attr.* names lost when nested enum tables break 4-col rows."""
    names = sorted(set(re.findall(r">(attr\.[\w.$]+)(?:\([^)]*\))?<", html, flags=re.I)))
    out: list[dict] = []
    for raw in names:
        name = basename(raw)
        if not name or name.lower() in have:
            continue
        # Grab a short description snippet after the name cell when possible
        pat = re.compile(
            re.escape(raw) + r"</td>\s*<td[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>",
            re.I | re.S,
        )
        m = pat.search(html)
        desc = ""
        if m:
            desc = re.sub(r"<[^>]+>", " ", m.group(1))
            desc = re.sub(r"\s+", " ", desc).strip()
        out.append(
            {
                "name": name,
                "doc": desc or f"Session attribute {name}",
                "deprecated": False,
                "kind": "attr",
            }
        )
        have.add(name.lower())
    return out


def load_from_progguide(pages: Path) -> list[dict]:
    misc = pages / "misc" / "predefined_variables.json"
    report = pages / "report_scripts" / "predefined_variables.json"
    if not misc.is_file():
        raise SystemExit(f"missing {misc}")
    if not report.is_file():
        raise SystemExit(f"missing {report}")

    deprecated = load_deprecated(pages)
    misc_html = json.loads(misc.read_text(encoding="utf-8"))["bodyHtml"]
    report_html = json.loads(report.read_text(encoding="utf-8"))["bodyHtml"]

    entries = parse_misc_rows(misc_html)
    have = {e["name"].lower() for e in entries}
    entries.extend(recover_missing_attr(misc_html, have))
    have = {e["name"].lower() for e in entries}
    for e in parse_lattr_rows(report_html):
        if e["name"].lower() not in have:
            entries.append(e)
            have.add(e["name"].lower())

    for e in entries:
        if e["name"].lower() in deprecated or e.get("deprecated"):
            e["deprecated"] = True
            if "(deprecated)" not in e["doc"].lower():
                e["doc"] = f"{e['doc']} (deprecated)"

    # Keep attr/lattr/fattr plus a few high-value session vars already used in UI scripts
    keep_session = {
        "actual.occ",
        "curr.key",
        "filled.occ",
        "form.curr",
        "form.next",
        "form.prev",
        "choice",
        "date",
        "date$",
        "e",
    }
    filtered = [
        e
        for e in entries
        if e["kind"] in {"attr", "lattr", "fattr"}
        or e["name"].lower() in keep_session
    ]
    filtered.sort(key=lambda e: e["name"].lower())
    # Drop internal type field from snapshot
    for e in filtered:
        e.pop("type", None)
    return filtered


def write_catalog(entries: list[dict]) -> None:
    CATALOG_PATH.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {CATALOG_PATH} ({len(entries)} vars)")


def merge_into_repo(entries: list[dict]) -> None:
    names = sorted({e["name"] for e in entries}, key=str.lower)
    docs_updates = {e["name"]: e["doc"] for e in entries}

    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    constants = list(completions.get("constants") or [])
    existing = {c.lower() for c in constants}
    for name in names:
        if name.lower() not in existing:
            constants.append(name)
            existing.add(name.lower())
    completions["constants"] = sorted(constants, key=str.lower)
    COMPLETIONS_PATH.write_text(
        json.dumps(completions, indent=2) + "\n", encoding="utf-8"
    )
    print(f"updated {COMPLETIONS_PATH} constants (+predefined vars)")

    docs = json.loads(DOCS_PATH.read_text(encoding="utf-8"))
    docs.update(docs_updates)
    DOCS_PATH.write_text(
        json.dumps(docs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"updated {DOCS_PATH} ({len(docs_updates)} predefined entries)")


def check_catalog() -> None:
    if not CATALOG_PATH.is_file():
        raise SystemExit(f"missing committed catalog: {CATALOG_PATH}")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    docs = json.loads(DOCS_PATH.read_text(encoding="utf-8"))

    if len(catalog) < 40:
        raise SystemExit(f"predefined-vars catalog too small: {len(catalog)}")

    constants = {c.lower() for c in completions.get("constants") or []}
    for entry in catalog:
        name = entry["name"]
        if name.lower() not in constants:
            raise SystemExit(f"missing completions.constants entry for {name}")
        if name not in docs:
            raise SystemExit(f"missing docs.json entry for {name}")
        if docs[name] != entry["doc"]:
            raise SystemExit(f"docs drift for {name}")
        if entry.get("deprecated") and "(deprecated)" not in entry["doc"].lower():
            raise SystemExit(f"deprecated without marker: {name}")

    print(f"check:predefined-vars ok ({len(catalog)} vars)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--progguide",
        type=Path,
        help="Path to progguide pages directory",
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

    pages = (args.progguide or Path(DEFAULT_PROGGUIDE_PAGES)).resolve()
    if not pages.is_dir():
        raise SystemExit(
            f"progguide pages not found: {pages} "
            "(set LN_PROGGUIDE_PAGES or pass --progguide; use --check for snapshot-only)"
        )

    entries = load_from_progguide(pages)
    write_catalog(entries)
    if args.merge:
        merge_into_repo(entries)


if __name__ == "__main__":
    main()
