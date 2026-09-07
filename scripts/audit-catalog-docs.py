#!/usr/bin/env python3
"""Audit api-catalog.json for description-depth gaps (D2).

Writes JSONL for the offline catalog enricher (D3). Does not call external services.
Runtime extension never reads this file.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "api-catalog.json"
DEFAULT_OUT = ROOT / "data" / "gaps.jsonl"

VOID_RE = re.compile(r"(?i)\bfunction\s+(?:extern\s+)?void\b")
DOUBLE_FN_RE = re.compile(r"(?i)\bfunction\s+function\b")
SHORT_DOC = 40

# D3 batch priority (lower = sooner). Exact prefixes / names first.
PRIORITY_RULES: list[tuple[int, re.Pattern[str]]] = [
    (10, re.compile(r"(?i)^(db\.|dal\.|mess$|message$)")),
    (20, re.compile(r"(?i)^(before\.|after\.|field\.|fieldname\.)")),
    (30, re.compile(r"(?i)^(str\.|sprintf|expr\.|date\.|utc\.)")),
    (40, re.compile(r"(?i)^DsC")),  # often non-callable / no syntax
]


def priority_for(name: str) -> int:
    for prio, pat in PRIORITY_RULES:
        if pat.search(name):
            return prio
    return 100


def classify_gap(entry: dict) -> list[str]:
    """Return reason codes for one catalog entry (empty = OK for D2)."""
    name = entry.get("name") or ""
    doc = entry.get("doc") or ""
    syntax = entry.get("syntax") or ""
    returns = entry.get("returns") or ""
    reasons: list[str] = []

    if not syntax:
        reasons.append("no_syntax")
    if DOUBLE_FN_RE.search(syntax):
        reasons.append("double_fn")
    if not returns:
        reasons.append("no_returns")
        if syntax and not VOID_RE.search(syntax):
            reasons.append("typed_missing_returns")
    if len(doc) < SHORT_DOC:
        reasons.append("short_doc")
    if doc.strip().lower() == name.lower() or doc.startswith("See syntax:"):
        reasons.append("doc_stub")

    return reasons


def audit(catalog: list[dict]) -> list[dict]:
    gaps: list[dict] = []
    for entry in catalog:
        reasons = classify_gap(entry)
        if not reasons:
            continue
        name = entry["name"]
        gaps.append(
            {
                "name": name,
                "source": entry.get("source") or "",
                "kind": entry.get("kind") or "",
                "reasons": reasons,
                "priority": priority_for(name),
                "syntax": entry.get("syntax") or "",
                "docLen": len(entry.get("doc") or ""),
                "hasReturns": bool(entry.get("returns")),
            }
        )
    gaps.sort(key=lambda g: (g["priority"], g["name"].lower()))
    return gaps


def write_jsonl(path: Path, gaps: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(g, ensure_ascii=False) for g in gaps]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def print_summary(gaps: list[dict], catalog_len: int) -> None:
    reason_counts: Counter[str] = Counter()
    for g in gaps:
        for r in g["reasons"]:
            reason_counts[r] += 1
    print(f"catalog entries: {catalog_len}")
    print(f"gap entries:     {len(gaps)}")
    print("reasons:")
    for reason, count in reason_counts.most_common():
        print(f"  {reason}: {count}")
    by_prio: Counter[int] = Counter(g["priority"] for g in gaps)
    print("by priority:")
    for prio in sorted(by_prio):
        print(f"  p{prio}: {by_prio[prio]}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--catalog",
        type=Path,
        default=CATALOG_PATH,
        help="Path to api-catalog.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Output JSONL path (default: data/gaps.jsonl)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify committed gaps.jsonl matches catalog (CI)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary only; do not write",
    )
    args = parser.parse_args()

    if not args.catalog.is_file():
        raise SystemExit(f"missing catalog: {args.catalog}")

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise SystemExit("api-catalog.json must be a list")

    gaps = audit(catalog)
    print_summary(gaps, len(catalog))

    if args.check:
        if not args.out.is_file():
            raise SystemExit(f"missing {args.out}; run without --check to generate")
        existing = [
            json.loads(line)
            for line in args.out.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        # Compare name + reasons + priority (ignore docLen churn from soft limits)
        def key(rows: list[dict]) -> list[tuple]:
            return sorted(
                (
                    r["name"],
                    tuple(r.get("reasons") or []),
                    r.get("priority"),
                )
                for r in rows
            )

        if key(existing) != key(gaps):
            raise SystemExit(
                f"{args.out} drift from catalog; run: "
                "python3 scripts/audit-catalog-docs.py"
            )
        print(f"check:audit-catalog-docs ok ({len(existing)} gaps)")
        return

    if args.dry_run:
        return

    write_jsonl(args.out, gaps)
    print(f"wrote {args.out} ({len(gaps)} lines)")


if __name__ == "__main__":
    main()
    sys.exit(0)
