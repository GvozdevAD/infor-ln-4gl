#!/usr/bin/env python3
"""Offline catalog enricher for D3 gaps (developer-only).

Sources (exact-id only — never fuzzy):
  1. Local Progguide page JSON keyed by gap ``source``.
  2. Optional doc-hit dump (--doc-hits JSONL) from offline guide search sessions.

Writes data/catalog-overrides.json. Runtime extension never looks up docs over the
network; build-catalog.py merges overrides into api-catalog.json.

Do not commit raw hit dumps — only the compact overrides file.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from baan_guide_lexicon import DEFAULT_PROGGUIDE_PAGES  # noqa: E402

import importlib.util

_bc_path = Path(__file__).resolve().parent / "build-catalog.py"
_bc_spec = importlib.util.spec_from_file_location("build_catalog", _bc_path)
assert _bc_spec and _bc_spec.loader
build_catalog = importlib.util.module_from_spec(_bc_spec)
sys.modules["build_catalog"] = build_catalog
_bc_spec.loader.exec_module(build_catalog)

SectionParser = build_catalog.SectionParser
clean_text = build_catalog.clean_text
description_text = build_catalog.description_text
normalize_syntax = build_catalog.normalize_syntax
summarize_returns = build_catalog.summarize_returns
parse_parameters = build_catalog.parse_parameters


ROOT = Path(__file__).resolve().parents[1]
GAPS_PATH = ROOT / "data" / "gaps.jsonl"
OVERRIDES_PATH = ROOT / "data" / "catalog-overrides.json"
CATALOG_PATH = ROOT / "data" / "api-catalog.json"

NO_RETURN_MARK = "n/a (no Return section in guide)"
DOC_SECTION_RE = re.compile(
    r"^##\s+(Syntax|Description|Arguments|Return values?|Context|Example)\s*$",
    re.I | re.M,
)
RETURNS_FROM_DOC_RE = re.compile(
    r"(?is)^\s*((?:This|The (?:function|hook))\s+returns\b.*?(?:\.|$)"
    r"|Returns\b.*?(?:\.|$))",
)


def load_jsonl(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def resolve_progguide_page(pages_dir: Path, source: str, name: str) -> Path | None:
    """Resolve exact page path from catalog source id."""
    if not source:
        return None
    candidates: list[Path] = [
        pages_dir / f"{source}.json",
    ]
    stem = source.split("/")[-1]
    folder = "/".join(source.split("/")[:-1])
    if folder:
        base = pages_dir / folder
        candidates.extend(
            [
                base / f"{stem}.json",
                base / f"{stem.rstrip('$')}.json",
                base / f"{name}.json",
                base / f"{name.rstrip('$')}.json",
            ]
        )
    for c in candidates:
        if c.is_file():
            return c
    return None


def normalize_api_key(value: str) -> str:
    v = value.strip().lower()
    v = re.sub(r"\(\)\s*$", "", v)
    return v


def exact_doc_hit(name: str, hits: list[dict]) -> dict | None:
    """Accept only hits whose id/title matches the API name exactly."""
    want = normalize_api_key(name)
    for hit in hits:
        hid = normalize_api_key((hit.get("id") or "").split("/")[-1])
        title = normalize_api_key(hit.get("title") or "")
        if hid == want or title == want:
            return hit
    return None


def parse_doc_hit_text(text: str) -> dict[str, str]:
    """Split guide-chunk markdown into syntax / doc / returns."""
    out: dict[str, str] = {"syntax": "", "doc": "", "returns": ""}
    if not text:
        return out
    # Drop page header line
    body = re.sub(r"^Page:.*\n+", "", text.strip(), count=1)
    parts = DOC_SECTION_RE.split(body)
    # parts: [preamble, heading, content, heading, content, ...]
    if len(parts) == 1:
        # no ## headings — treat whole as doc
        out["doc"] = clean_text(body, 50000)
        return out
    i = 1
    while i + 1 < len(parts):
        heading = parts[i].strip().lower()
        content = parts[i + 1].strip()
        content = re.sub(r"^`+|`+$", "", content.strip())
        content = clean_text(content, 50000)
        if heading == "syntax":
            # keep fenced code contents
            m = re.search(r"`([^`]+)`", parts[i + 1])
            out["syntax"] = clean_text(m.group(1) if m else content)
        elif heading == "description":
            out["doc"] = content
        elif heading.startswith("return"):
            out["returns"] = content
        i += 2
    return out


def returns_from_description(doc: str) -> str:
    if not doc:
        return ""
    m = RETURNS_FROM_DOC_RE.match(doc)
    if m:
        return clean_text(m.group(1))
    # Prefer a sentence that *starts* with Returns / This returns
    for sent in re.split(r"(?<=\.)\s+", doc):
        if re.match(r"(?i)^(?:This returns|Returns)\b", sent.strip()):
            return clean_text(sent)
    return ""


def extract_from_progguide_page(path: Path, name: str) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    parser = SectionParser()
    parser.feed(data.get("bodyHtml", ""))
    sections = parser.sections

    syntax_chunks = sections.get("syntax", [])
    syntax = ""
    for chunk in syntax_chunks:
        if "function" in chunk.lower() or name in chunk:
            syntax = chunk
            break
    if not syntax and syntax_chunks:
        syntax = syntax_chunks[-1]
    syntax = normalize_syntax(syntax, name, sections)

    doc = description_text(sections)
    returns = summarize_returns(sections, syntax)
    if not returns:
        returns = returns_from_description(doc)

    return {
        "syntax": syntax,
        "doc": doc,
        "returns": returns,
        "source": f"progguide:{data.get('id', path.stem)}",
    }


def merge_field(
    current: str,
    incoming: str,
    *,
    field: str,
    reasons: list[str],
) -> str | None:
    """Return new value if incoming improves current; else None."""
    incoming = (incoming or "").strip()
    current = (current or "").strip()
    if not incoming:
        return None
    if field == "returns":
        if not current:
            return incoming
        if current == NO_RETURN_MARK and incoming != NO_RETURN_MARK:
            return incoming
        return None
    if field == "syntax":
        if not current:
            return incoming
        if re.search(r"(?i)function\s+function", current) and not re.search(
            r"(?i)function\s+function", incoming
        ):
            return incoming
        return None
    if field == "doc":
        if not current:
            return incoming
        if "short_doc" in reasons or "doc_stub" in reasons:
            if len(incoming) > len(current):
                return incoming
        # Prefer real prose over argument-name scrapes from HTML
        prose = bool(re.match(r"(?i)^(returns|use this|this |the |with |when )", incoming))
        scrapey = bool(re.match(r"(?i)^[\w.$]+(\s+[\w.$]+){0,4}\s*\.", current))
        if prose and (scrapey or len(incoming) > len(current) + 40):
            return incoming
        if not current or current.lower() == incoming.split("\n")[0].lower():
            if len(incoming) > len(current):
                return incoming
        return None
    return None


def build_override_for_gap(
    gap: dict,
    catalog_by_name: dict[str, dict],
    pages_dir: Path,
    hits_by_name: dict[str, dict],
) -> dict | None:
    name = gap["name"]
    entry = catalog_by_name.get(name.lower())
    if not entry:
        return None
    reasons = gap.get("reasons") or []

    candidates: list[dict[str, str]] = []

    # 1) Exact doc hit (preferred when present)
    if name.lower() in hits_by_name:
        hit = hits_by_name[name.lower()]
        parsed = parse_doc_hit_text(hit.get("text") or "")
        parsed["source"] = f"hits:{hit.get('id') or name}"
        candidates.append(parsed)

    # 2) Local progguide exact page
    page = resolve_progguide_page(pages_dir, gap.get("source") or "", name)
    if page:
        candidates.append(extract_from_progguide_page(page, name))

    override: dict = {}
    src_bits: list[str] = []
    working = {
        "doc": entry.get("doc") or "",
        "syntax": entry.get("syntax") or "",
        "returns": entry.get("returns") or "",
    }

    for cand in candidates:
        for field in ("doc", "syntax", "returns"):
            improved = merge_field(
                working[field],
                cand.get(field) or "",
                field=field,
                reasons=reasons,
            )
            if improved:
                working[field] = improved
                override[field] = improved
                if cand.get("source"):
                    src_bits.append(cand["source"])

    # Documented n/a for typed gaps still missing returns
    need_returns = "typed_missing_returns" in reasons or (
        "no_returns" in reasons and bool(entry.get("syntax"))
    )
    if need_returns and not working["returns"]:
        derived = returns_from_description(working["doc"])
        working["returns"] = derived or NO_RETURN_MARK
        override["returns"] = working["returns"]
        src_bits.append("heuristic:returns")

    if not override:
        return None

    if "syntax" in override:
        override["parameters"] = parse_parameters(override["syntax"])

    override["docQuality"] = "partial"
    override["_enrichedFrom"] = sorted(set(src_bits))
    return override


def load_doc_hits(path: Path | None) -> dict[str, dict]:
    """Map lower(name) -> accepted hit dict."""
    if not path or not path.is_file():
        return {}
    by_name: dict[str, dict] = {}
    for row in load_jsonl(path):
        name = row.get("name") or ""
        hits = row.get("hits") or []
        if row.get("hit"):
            hits = [row["hit"]]
        accepted = exact_doc_hit(name, hits)
        if accepted:
            by_name[name.lower()] = accepted
    return by_name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gaps", type=Path, default=GAPS_PATH)
    parser.add_argument("--catalog", type=Path, default=CATALOG_PATH)
    parser.add_argument("--out", type=Path, default=OVERRIDES_PATH)
    parser.add_argument(
        "--progguide-pages",
        type=Path,
        default=None,
        help="Progguide pages dir (default: sibling ln-progguide-rag)",
    )
    parser.add_argument(
        "--doc-hits",
        type=Path,
        default=None,
        help="Optional JSONL of {name, hits:[...]} from offline guide search (not committed)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Process only first N gaps (after priority sort; 0 = all)",
    )
    parser.add_argument(
        "--merge-existing",
        action="store_true",
        help="Merge into existing overrides file instead of replacing",
    )
    args = parser.parse_args()

    pages_dir = args.progguide_pages
    if pages_dir is None:
        pages_dir = Path(DEFAULT_PROGGUIDE_PAGES)
    if not pages_dir.is_dir():
        raise SystemExit(
            f"progguide pages not found: {pages_dir}\n"
            "Pass --progguide-pages or set LN_PROGGUIDE_PAGES"
        )

    gaps = load_jsonl(args.gaps)
    if not gaps:
        raise SystemExit(f"no gaps in {args.gaps}; run audit-catalog-docs.py first")
    if args.limit and args.limit > 0:
        gaps = gaps[: args.limit]

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    catalog_by_name = {e["name"].lower(): e for e in catalog}
    hits_by_name = load_doc_hits(args.doc_hits)

    overrides: dict[str, dict] = {}
    if args.merge_existing and args.out.is_file():
        overrides = json.loads(args.out.read_text(encoding="utf-8"))

    filled = 0
    for gap in gaps:
        ov = build_override_for_gap(gap, catalog_by_name, pages_dir, hits_by_name)
        if not ov:
            continue
        name = gap["name"]
        overrides[name] = ov
        filled += 1

    # Stable key order
    ordered = {k: overrides[k] for k in sorted(overrides, key=str.lower)}
    args.out.write_text(
        json.dumps(ordered, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"wrote {args.out} ({len(ordered)} overrides; "
        f"updated {filled} from {len(gaps)} gaps; "
        f"doc hits loaded: {len(hits_by_name)})"
    )


if __name__ == "__main__":
    main()
