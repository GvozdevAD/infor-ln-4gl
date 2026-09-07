#!/usr/bin/env python3
"""Extract Infor ES API catalog from Progguide function pages."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from baan_guide_lexicon import (  # noqa: E402
    DEFAULT_PROGGUIDE_PAGES,
    DOC_CATEGORIES,
    PAGE_DENY_RE,
)

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "api-catalog.json"
LINKS_PATH = ROOT / "data" / "links.json"
SIGNATURES_PATH = ROOT / "data" / "signatures.json"
COMPLETIONS_PATH = ROOT / "data" / "completions.json"
DAL_NOTES_PATH = ROOT / "data" / "dal-notes.json"
OVERRIDES_PATH = ROOT / "data" / "catalog-overrides.json"

TITLE_RE = re.compile(r"^([\w.$]+)(?:\(\))?$")
INTERNAL_LINK_RE = re.compile(
    r'data-internal="/docs/progguide/[^"]*/([\w.$]+)"',
    re.IGNORECASE,
)
REPLACES_RE = re.compile(
    r"replaces(?:\s+the)?\s+([^.]+?)\s+(?:subsection|section|sections)",
    re.IGNORECASE,
)
PAGE_DENY = re.compile(PAGE_DENY_RE, re.I)
SIG_RE = re.compile(
    r"function(?:&nbsp;|\s)+(?:extern(?:&nbsp;|\s)+)?"
    r"(?:[\w.]+(?:&nbsp;|\s)+)?([\w.]+)\s*\(",
    re.I,
)
# Full `function … name (…)` lines inside a Syntax section (multi-API pages).
SYNTAX_FN_RE = re.compile(
    r"function\s+(?:extern\s+)?"
    r"(?:(?:long|double|void|string|boolean|domain\s+[\w.]+)\s+)?"
    r"([\w.]+\$?)\s*\([^)]*\)",
    re.I,
)
DOUBLE_FUNCTION_RE = re.compile(r"(?i)\bfunction\s+function\b")
# Soft ceiling only (no ellipsis marker). Rare pages exceed this.
DOC_SOFT_LIMIT = 50000
RETURNS_SOFT_LIMIT = 20000
RETURN_SECTION_KEYS = (
    "return-value",
    "return-values",
    "returns",
    "returnvalue",
    "returnvalues",
)

DENY_STEMS = {
    "overview",
    "synopsis",
    "glossary",
    "examples",
    "cookbook",
    "help",
    "object_hooks",
    "dal_hooks",
    "dal_glossary",
    "dal2_overview",
    "dal2_flow",
    "dal2_field_hooks",
    "dal2_field_dependencies",
    "dal2_bm_hooks",
    "dal2_4gle",
    "dal2_test_mode",
    "dal_context",
    "dal_ui_and_stp_interaction",
    "communication_with_stp_and_cdas",
    "query_extensions",
    "property_hooks",
    "property_methods",
    "chm_hooks",
    "dam",
    "transition_issues_baan_iv_to_baanerp",
    # Doc-topic pages that are not callables (D5)
    "constraints",
    "debugging",
    "artm_debugging",
    "sql_subqueries",
}

# Titles / API names that are guide topics, not callables
DOC_TOPIC_NAMES = frozenset(
    {
        "constraints",
        "debugging",
        "subqueries",
        "chm.hooks",
    }
)

UI_OBJECT_RETURNS = "n/a (UI object type; use with create.object / change.object)"

FIELD_HOOK_NAMES = {
    "fieldname.check",
    "fieldname.make.valid",
    "fieldname.set.defaults",
    "field.update",
    "field.is.valid",
    "field.is.readonly",
    "field.is.never.applicable",
    "field.is.derived",
    "field.is.mandatory",
    "field.is.applicable",
    "field.enum.is.applicable",
}


class SectionParser(HTMLParser):
    """Collect text, code/pre blocks, and table rows keyed by subSectionTitle id."""

    def __init__(self) -> None:
        super().__init__()
        self.sections: dict[str, list[str]] = {}
        self._active: str | None = None
        self._in_code = False
        self._in_title = False
        self._buf: list[str] = []
        self._link_targets: list[str] = []
        self._pending_id: str | None = None
        self._in_para = False
        self._in_cell = False
        self._row_cells: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "div" and attr.get("class") == "subSectionTitle":
            self._in_title = True
            self._buf = []
            self._pending_id = attr.get("id")
        elif self._in_title and tag in {"div", "p", "h1", "h2", "h3"}:
            self._flush_title()
        elif tag in {"code", "pre"}:
            self._in_code = True
            self._buf = []
        elif tag == "a" and "data-internal" in attr:
            href = attr.get("data-internal") or ""
            m = INTERNAL_LINK_RE.search(f'data-internal="{href}"')
            if m:
                self._link_targets.append(m.group(1))
        elif tag == "tr" and self._active and not self._in_title:
            self._row_cells = []
        elif tag in {"td", "th"} and self._active and not self._in_title:
            self._in_cell = True
            self._buf = []
        elif tag == "p" and self._active and not self._in_code and not self._in_title:
            self._in_para = True
            self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "div" and self._in_title:
            self._flush_title()
        elif tag in {"code", "pre"} and self._in_code:
            text = html.unescape("".join(self._buf))
            text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
            if self._active and text:
                self.sections.setdefault(self._active, []).append(text)
            self._in_code = False
            self._buf = []
        elif tag in {"td", "th"} and self._in_cell:
            text = html.unescape("".join(self._buf))
            text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
            if text:
                self._row_cells.append(text)
            self._in_cell = False
            self._buf = []
        elif tag == "tr" and self._active and self._row_cells:
            self.sections.setdefault(self._active, []).append(
                " — ".join(self._row_cells)
            )
            self._row_cells = []
        elif tag == "p" and self._in_para:
            text = html.unescape("".join(self._buf))
            text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
            if self._active and text:
                self.sections.setdefault(self._active, []).append(text)
            self._in_para = False
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._in_title or self._in_code or self._in_para or self._in_cell:
            self._buf.append(data)

    def _flush_title(self) -> None:
        if not self._in_title:
            return
        slug = self._pending_id
        if not slug:
            raw = html.unescape("".join(self._buf)).strip()
            slug = raw.lower().replace(" ", "-").replace(":", "")
            slug = re.sub(r"[^a-z0-9-]", "", slug)
        if slug:
            self._active = slug
            self.sections.setdefault(slug, [])
        self._in_title = False
        self._pending_id = None
        self._buf = []


def clean_text(text: str, limit: int | None = None) -> str:
    """Normalize whitespace. Soft-truncate without ellipsis when limit is set."""
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
    if limit is not None and len(text) > limit:
        return text[:limit].rstrip()
    return text


def normalize_context(raw: str) -> list[str]:
    lower = raw.lower()
    tags: set[str] = set()
    if "4gl engine" in lower or "4gl" in lower:
        tags.add("4gl")
    if "dal script" in lower or re.search(r"\bdal\b", lower):
        tags.add("dal")
    if "all script" in lower:
        tags.add("all")
    if "3gl" in lower:
        tags.add("3gl")
    if not tags:
        tags.add("all")
    return sorted(tags)


def parse_parameters(syntax: str) -> list[str]:
    m = re.search(r"\((.*)\)\s*$", syntax)
    if not m:
        return []
    inner = m.group(1).strip()
    if not inner:
        return []
    params: list[str] = []
    for part in inner.split(","):
        part = part.strip()
        part = re.sub(r"^\[?\s*(?:long|double|void|string|boolean|domain\s+[\w.]+)\s+", "", part)
        part = part.strip("[] ")
        if part and part not in {"..."}:
            params.append(part)
    return params


def summarize_returns(sections: dict[str, list[str]], syntax: str = "") -> str:
    chunks: list[str] = []
    for key in RETURN_SECTION_KEYS:
        for chunk in sections.get(key, []):
            text = clean_text(chunk)
            if text:
                chunks.append(text)
    if chunks:
        # Dedupe while preserving order (tables often repeat spacer noise).
        seen: set[str] = set()
        ordered: list[str] = []
        for c in chunks:
            if c not in seen:
                seen.add(c)
                ordered.append(c)
        return clean_text(" ".join(ordered), RETURNS_SOFT_LIMIT)
    if re.search(r"(?i)\bfunction\s+(?:extern\s+)?void\b", syntax or ""):
        return "void"
    return ""


def description_text(sections: dict[str, list[str]]) -> str:
    parts: list[str] = []
    for chunk in sections.get("description", []):
        text = clean_text(chunk)
        if text and not text.startswith("#include"):
            parts.append(text)
    if not parts:
        return ""
    return clean_text("\n\n".join(parts), DOC_SOFT_LIMIT)


def syntax_from_example(name: str, sections: dict[str, list[str]]) -> str:
    """Prefer Example signature when Syntax HTML is broken (e.g. double function)."""
    name_re = re.escape(name)
    pattern = re.compile(
        rf"(?i)function\s+(?:extern\s+)?"
        rf"(?:(?:long|double|void|string|boolean|domain\s+[\w.]+)\s+)?"
        rf"{name_re}\s*\([^)]*\)"
    )
    for key in ("example", "examples"):
        for chunk in sections.get(key, []):
            m = pattern.search(chunk)
            if m:
                return clean_text(m.group(0))
    return ""


def normalize_syntax(syntax: str, name: str, sections: dict[str, list[str]]) -> str:
    raw = clean_text(syntax) if syntax else ""
    had_double = bool(DOUBLE_FUNCTION_RE.search(raw))
    fixed = DOUBLE_FUNCTION_RE.sub("function", raw)
    need_example = (
        had_double
        or not fixed
        or name.lower() not in fixed.lower()
    )
    if need_example:
        alt = syntax_from_example(name, sections)
        if alt:
            return DOUBLE_FUNCTION_RE.sub("function", alt)
    return fixed


def extract_replaces(description: str) -> list[str] | None:
    m = REPLACES_RE.search(description)
    if not m:
        return None
    raw = m.group(1)
    parts = re.findall(r"[\w.]+", raw)
    cleaned = [p.rstrip(".") for p in parts if p]
    return cleaned or None


def classify_kind(name: str, source: str) -> str:
    # Deprecated BW UI object type constants (DsC* / dsc*) — not functions.
    if name.startswith("DsC") or name.lower().startswith("dsc"):
        return "uiObject"
    if source.startswith("functions_dal/"):
        if name in FIELD_HOOK_NAMES or name.startswith("fieldname."):
            return "dalFieldHook"
        return "dalHook"
    if name in FIELD_HOOK_NAMES:
        return "dalFieldHook"
    return "function"


def finalize_entry(entry: dict) -> dict:
    """D5: stub syntax/returns for UI object types so hover + good_depth work."""
    if entry.get("kind") == "uiObject":
        if not entry.get("syntax"):
            entry["syntax"] = f"object type {entry['name']}"
        if not entry.get("returns"):
            entry["returns"] = UI_OBJECT_RETURNS
        if not entry.get("docQuality"):
            entry["docQuality"] = "stub"
        entry["parameters"] = []
    return entry


def should_skip(stem: str, page_id: str) -> bool:
    if stem in DENY_STEMS:
        return True
    if stem.startswith("help_"):
        return True
    if stem.endswith("_overview"):
        return True
    if "/overview" in page_id and stem == "overview":
        return True
    blob = f"{stem} {page_id.replace('/', '_')}"
    if PAGE_DENY.search(stem) or PAGE_DENY.search(blob):
        return True
    return False


def extract_api_name(data: dict, stem: str) -> str | None:
    """Resolve callable name from title, stem, keywords, or function syntax in body.

    Prefer a dotted filesystem stem over keywords when the title lists several APIs
    (e.g. dal.set.error.message(), dal.set.warning.message(), …).
    """
    title = data.get("title") or ""
    m = TITLE_RE.match(title)
    if m:
        return m.group(1)
    if title.endswith("()"):
        candidate = title[:-2].strip()
        if TITLE_RE.match(candidate):
            return candidate

    if "." in stem or stem.endswith("$"):
        return stem

    for k in data.get("keywords") or []:
        if re.match(r"^[\w.]+\$?$", k) and not PAGE_DENY.search(k.replace(".", "_")):
            return k

    body = data.get("bodyHtml") or ""
    sig = SIG_RE.search(body)
    if sig:
        n = sig.group(1)
        if n.lower() not in {
            "long",
            "void",
            "string",
            "double",
            "boolean",
            "domain",
            "ref",
            "extern",
            "const",
        } and re.match(r"^[\w.]+\$?$", n):
            return n

    if "." in stem or stem.endswith("$"):
        return stem
    return None


def split_function_syntaxes(text: str) -> list[tuple[str, str]]:
    """Extract (name, full_syntax) pairs from a Syntax section blob."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in SYNTAX_FN_RE.finditer(text or ""):
        name = m.group(1)
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append((name, clean_text(m.group(0))))
    return out


def is_noise_api_name(name: str) -> bool:
    """True for doc-topic titles mistaken for callables (Operators, AND, Tracing)."""
    if "." in name or name.endswith("$"):
        return False
    if name.startswith("DsC"):
        return False
    if len(name) >= 2 and name.isupper():
        return True
    if name[:1].isupper():
        return True
    return False


def load_dal_notes() -> dict[str, list[str]]:
    if not DAL_NOTES_PATH.is_file():
        return {}
    return json.loads(DAL_NOTES_PATH.read_text(encoding="utf-8"))


def load_overrides() -> dict[str, dict]:
    """Developer-only overrides from D3 enricher (merged into catalog at build)."""
    if not OVERRIDES_PATH.is_file():
        return {}
    data = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"{OVERRIDES_PATH} must be an object keyed by API name")
    return data


def _doc_is_scrapey(doc: str) -> bool:
    return bool(re.match(r"(?i)^[\w.$]+(\s+[\w.$]+){0,4}\s*\.", doc or ""))


def apply_overrides(entries: list[dict], overrides: dict[str, dict]) -> int:
    """Merge overrides onto parsed entries. Fills/improves; can insert missing names."""
    if not overrides:
        return 0
    by_name = {e["name"].lower(): e for e in entries}
    applied = 0
    for key, ov in overrides.items():
        if not isinstance(ov, dict):
            continue
        entry = by_name.get(key.lower())
        if not entry:
            # Insert new callable when override carries enough to hover.
            if not (ov.get("doc") or ov.get("syntax")):
                continue
            syntax = ov.get("syntax") or ""
            entry = {
                "name": key,
                "kind": ov.get("kind") or "function",
                "context": ov.get("context") or ["4gl", "dal"],
                "doc": ov.get("doc") or key,
                "syntax": syntax,
                "parameters": ov.get("parameters")
                or (parse_parameters(syntax) if syntax else []),
                "returns": ov.get("returns") or "",
                "related": ov.get("related") or [],
                "replaces": ov.get("replaces"),
                "source": ov.get("source") or "",
            }
            if ov.get("docQuality"):
                entry["docQuality"] = ov["docQuality"]
            entries.append(entry)
            by_name[key.lower()] = entry
            applied += 1
            continue
        changed = False
        if ov.get("doc"):
            cur = entry.get("doc") or ""
            incoming = ov["doc"]
            if (
                not cur
                or len(incoming) > len(cur)
                or cur.startswith("See syntax:")
                or (_doc_is_scrapey(cur) and not _doc_is_scrapey(incoming))
            ):
                entry["doc"] = incoming
                changed = True
        if ov.get("syntax"):
            # Overrides are intentional — allow fixing wrong multi-API syntax.
            if (
                not entry.get("syntax")
                or DOUBLE_FUNCTION_RE.search(entry.get("syntax") or "")
                or ov["syntax"] != entry.get("syntax")
            ):
                entry["syntax"] = ov["syntax"]
                entry["parameters"] = ov.get("parameters") or parse_parameters(ov["syntax"])
                changed = True
        if ov.get("returns") and ov["returns"] != (entry.get("returns") or ""):
            entry["returns"] = ov["returns"]
            changed = True
        if ov.get("related") and ov["related"] != (entry.get("related") or []):
            entry["related"] = ov["related"]
            changed = True
        if ov.get("docQuality") and ov["docQuality"] != entry.get("docQuality"):
            entry["docQuality"] = ov["docQuality"]
            changed = True
        if ov.get("source") and not entry.get("source"):
            entry["source"] = ov["source"]
            changed = True
        if changed:
            applied += 1
    return applied


def parse_page(path: Path, dal_notes: dict[str, list[str]]) -> list[dict]:
    """Parse one progguide page into one or more catalog entries (multi-syntax pages)."""
    data = json.loads(path.read_text(encoding="utf-8"))
    page_id = data.get("id", path.stem)
    if should_skip(path.stem, page_id):
        return []

    name = extract_api_name(data, path.stem)
    if not name:
        return []
    if name.lower() in DOC_TOPIC_NAMES:
        return []
    # PAGE_DENY targets doc page stems (foo_object), not callables like before.save.object.
    if "." not in name and not name.endswith("$"):
        if PAGE_DENY.search(name.replace(".", "_")):
            return []
    if is_noise_api_name(name):
        return []

    cat = path.parent.name
    if cat in DOC_CATEGORIES and "." not in name and not name.endswith("$"):
        return []

    parser = SectionParser()
    parser.feed(data.get("bodyHtml", ""))
    sections = parser.sections

    syntax_blob = "\n".join(sections.get("syntax", []))
    syn_pairs = split_function_syntaxes(syntax_blob)
    if not syn_pairs:
        syntax_chunks = sections.get("syntax", [])
        syntax = ""
        for chunk in syntax_chunks:
            if "function" in chunk.lower() or name in chunk:
                syntax = chunk
                break
        if not syntax and syntax_chunks:
            syntax = syntax_chunks[-1]
        syntax = normalize_syntax(syntax, name, sections)
        syn_pairs = [(name, syntax)] if syntax else [(name, "")]

    # Ensure primary stem/name is first when present.
    syn_by = {n.lower(): (n, s) for n, s in syn_pairs}
    ordered: list[tuple[str, str]] = []
    if name.lower() in syn_by:
        ordered.append(syn_by.pop(name.lower()))
    ordered.extend(syn_by.values())

    doc = description_text(sections)
    related = sorted(set(parser._link_targets))
    hooks_called = related.copy()
    if "hooks-called" in sections:
        hooks_called = sorted(set(hooks_called + parser._link_targets))
    source = page_id
    sibling_names = [n for n, _ in ordered]

    out: list[dict] = []
    for fname, raw_syntax in ordered:
        syntax = normalize_syntax(raw_syntax, fname, sections)
        entry_doc = doc
        if not entry_doc and syntax:
            entry_doc = f"See syntax: {syntax[:120]}"
        kind = classify_kind(fname, source)
        context = normalize_context(" ".join(sections.get("context", [])))
        replaces = dal_notes.get(fname)
        if not replaces:
            replaces = extract_replaces(" ".join(sections.get("description", [])))
        returns = summarize_returns(sections, syntax)
        # Point siblings at each other + page related links
        entry_related = sorted(
            set(related)
            | {s for s in sibling_names if s.lower() != fname.lower()},
            key=str.lower,
        )
        entry = {
            "name": fname,
            "kind": kind,
            "context": context,
            "doc": entry_doc or fname,
            "syntax": syntax,
            "parameters": parse_parameters(syntax) if syntax else [],
            "returns": returns,
            "related": entry_related,
            "replaces": replaces,
            "source": source,
            "_hooks_called": hooks_called,
            "_related_topics": data.get("related", []),
        }
        out.append(finalize_entry(entry))
    return out


def load_from_progguide(progguide: Path) -> list[dict]:
    pages_dir = progguide if (progguide / "functions_dal").is_dir() else progguide / "pages"
    if not pages_dir.is_dir():
        raise SystemExit(f"pages directory not found: {pages_dir}")
    dal_notes = load_dal_notes()
    entries: list[dict] = []
    seen: set[str] = set()
    patterns = ("functions_*/*.json", "emessage_connector/*.json")
    for pattern in patterns:
        for path in sorted(pages_dir.glob(pattern)):
            for parsed in parse_page(path, dal_notes):
                key = parsed["name"].lower()
                if key in seen:
                    continue
                seen.add(key)
                entries.append(parsed)
    if not entries:
        raise SystemExit("no API pages parsed")
    applied = apply_overrides(entries, load_overrides())
    if applied:
        print(f"applied catalog overrides to {applied} entries")
    entries.sort(key=lambda e: e["name"].lower())
    return entries


def build_signatures(entries: list[dict]) -> dict:
    sigs: dict = {}
    for entry in entries:
        syntax = entry.get("syntax") or ""
        if not syntax:
            continue
        params = entry.get("parameters") or []
        label = syntax
        if not label.lower().startswith("function"):
            label = f"{entry['name']}({', '.join(params)})"
        sigs[entry["name"]] = {
            "label": label,
            "parameters": params if params else ["..."],
        }
    return sigs


def build_links(entries: list[dict]) -> dict:
    links: dict = {}
    for entry in entries:
        hooks = entry.pop("_hooks_called", [])
        topics = entry.pop("_related_topics", [])
        if hooks or topics:
            links[entry["name"]] = {
                "hooksCalled": hooks,
                "relatedTopics": topics,
            }
    return links


def strip_internal(entry: dict) -> dict:
    out = dict(entry)
    out.pop("_hooks_called", None)
    out.pop("_related_topics", None)
    return out


def filter_catalog_related(entries: list[dict]) -> None:
    """Keep related names that resolve to catalog callables/hooks only."""
    names = {e["name"].lower() for e in entries}
    for entry in entries:
        related = entry.get("related") or []
        hooks = entry.get("_hooks_called") or []
        merged = []
        for item in list(related) + list(hooks):
            if not isinstance(item, str):
                continue
            key = item.lower()
            if key in names and key != entry["name"].lower():
                merged.append(item)
        # Prefer canonical casing from catalog when possible
        canon = {e["name"].lower(): e["name"] for e in entries}
        entry["related"] = sorted(
            {canon.get(x.lower(), x) for x in merged},
            key=str.lower,
        )


def write_artifacts(entries: list[dict]) -> None:
    filter_catalog_related(entries)
    catalog = [strip_internal(e) for e in entries]
    # Drop enricher bookkeeping if present on entries
    for e in catalog:
        e.pop("_enrichedFrom", None)
    CATALOG_PATH.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {CATALOG_PATH} ({len(catalog)} entries)")

    links_entries = [dict(e) for e in entries]
    links = build_links(links_entries)
    LINKS_PATH.write_text(json.dumps(links, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {LINKS_PATH} ({len(links)} entries)")

    sigs = build_signatures(catalog)
    SIGNATURES_PATH.write_text(json.dumps(sigs, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {SIGNATURES_PATH} ({len(sigs)} signatures)")

    functions = sorted(
        {e["name"] for e in catalog if e["kind"] in {"function", "dalFieldHook"}},
        key=str.lower,
    )
    dal_hooks = sorted(
        {e["name"] for e in catalog if e["kind"] == "dalHook"},
        key=str.lower,
    )
    ui_objects = sorted(
        {e["name"] for e in catalog if e["kind"] == "uiObject"},
        key=str.lower,
    )

    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    completions["functions"] = functions
    completions["dalHooks"] = dal_hooks
    # Keep DsC* highlightable via constants (grammar also picks them from catalog_names).
    constants = set(completions.get("constants") or [])
    completions["constants"] = sorted(constants | set(ui_objects), key=str.lower)
    COMPLETIONS_PATH.write_text(json.dumps(completions, indent=2) + "\n", encoding="utf-8")
    print(
        f"updated {COMPLETIONS_PATH} "
        f"({len(functions)} functions, {len(dal_hooks)} dalHooks, "
        f"{len(ui_objects)} uiObjects→constants)"
    )


def apply_overrides_to_committed_catalog() -> None:
    """Apply data/catalog-overrides.json onto committed api-catalog.json (no progguide).

    Updates catalog + signatures + completions.functions/dalHooks; leaves links.json.
    """
    if not CATALOG_PATH.is_file():
        raise SystemExit(f"missing {CATALOG_PATH}")
    entries = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    applied = apply_overrides(entries, load_overrides())
    print(f"applied catalog overrides to {applied} entries")
    filter_catalog_related(entries)
    for e in entries:
        e.pop("_enrichedFrom", None)
        e.pop("_hooks_called", None)
        e.pop("_related_topics", None)
    entries.sort(key=lambda e: e["name"].lower())
    CATALOG_PATH.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    sigs = build_signatures(entries)
    SIGNATURES_PATH.write_text(json.dumps(sigs, indent=2) + "\n", encoding="utf-8")

    functions = sorted(
        {e["name"] for e in entries if e["kind"] in {"function", "dalFieldHook"}},
        key=str.lower,
    )
    dal_hooks = sorted(
        {e["name"] for e in entries if e["kind"] == "dalHook"},
        key=str.lower,
    )
    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    completions["functions"] = functions
    completions["dalHooks"] = dal_hooks
    COMPLETIONS_PATH.write_text(json.dumps(completions, indent=2) + "\n", encoding="utf-8")
    print(
        f"wrote {CATALOG_PATH}, {SIGNATURES_PATH}, and updated completions "
        f"({len(functions)} functions)"
    )


def check_catalog() -> None:
    if not CATALOG_PATH.is_file():
        raise SystemExit(f"missing {CATALOG_PATH}")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    signatures = json.loads(SIGNATURES_PATH.read_text(encoding="utf-8"))
    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    links = json.loads(LINKS_PATH.read_text(encoding="utf-8")) if LINKS_PATH.is_file() else {}

    if len(catalog) < 1500:
        raise SystemExit(f"api-catalog too small: {len(catalog)}")

    for entry in catalog:
        for key in ("name", "doc", "kind"):
            if key not in entry:
                raise SystemExit(f"missing {key} in {entry.get('name', '?')}")

    fn_names = {e["name"] for e in catalog if e["kind"] in {"function", "dalFieldHook"}}
    hook_names = {e["name"] for e in catalog if e["kind"] == "dalHook"}

    if set(completions.get("functions", [])) != fn_names:
        raise SystemExit("completions.functions drift from api-catalog.json")
    if set(completions.get("dalHooks", [])) != hook_names:
        raise SystemExit("completions.dalHooks drift from api-catalog.json")

    with_syntax = [e for e in catalog if e.get("syntax")]
    sig_coverage = sum(1 for e in with_syntax if e["name"] in signatures)
    if sig_coverage < len(with_syntax) * 0.8:
        raise SystemExit(
            f"signature coverage too low: {sig_coverage}/{len(with_syntax)}"
        )

    if len(hook_names) < 25:
        raise SystemExit(f"too few dal hooks: {len(hook_names)}")

    if not links:
        raise SystemExit("links.json missing or empty")

    print(
        f"check:catalog ok ({len(catalog)} apis, "
        f"{len(signatures)} signatures, {len(links)} links)"
    )


def check_catalog_quality() -> None:
    """D1 quality gate: no double-function, void returns filled, no soft-clip."""
    if not CATALOG_PATH.is_file():
        raise SystemExit(f"missing {CATALOG_PATH}")
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    double_fn = []
    void_missing = []
    soft_clipped = []
    good = 0
    for entry in catalog:
        name = entry.get("name", "?")
        doc = entry.get("doc") or ""
        syntax = entry.get("syntax") or ""
        returns = entry.get("returns") or ""
        if DOUBLE_FUNCTION_RE.search(syntax):
            double_fn.append(name)
        is_void = bool(re.search(r"(?i)\bfunction\s+(?:extern\s+)?void\b", syntax))
        if is_void and not returns:
            void_missing.append(name)
        # Soft limits must not clip (raise limits or drop ceiling if this fires).
        if len(doc) >= DOC_SOFT_LIMIT or len(returns) >= RETURNS_SOFT_LIMIT:
            soft_clipped.append(name)
        has_returns = bool(returns)
        if (
            doc
            and syntax
            and has_returns
            and not DOUBLE_FUNCTION_RE.search(syntax)
        ):
            good += 1

    errors: list[str] = []
    if double_fn:
        errors.append(f"double function syntax: {double_fn}")
    if void_missing:
        errors.append(f"void without returns: {len(void_missing)} (e.g. {void_missing[:5]})")
    if soft_clipped:
        errors.append(f"soft-limit clipped: {soft_clipped}")
    if errors:
        raise SystemExit("check:catalog-quality failed:\n  - " + "\n  - ".join(errors))

    depth = 100.0 * good / len(catalog) if catalog else 0.0
    if depth < 98.0:
        raise SystemExit(
            f"check:catalog-quality failed: good_depth={good}/{len(catalog)} "
            f"({depth:.1f}%) < 98%"
        )
    print(
        f"check:catalog-quality ok ({len(catalog)} apis, "
        f"good_depth={good}/{len(catalog)} ({depth:.1f}%))"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--progguide",
        type=Path,
        help="Path to progguide data (…/pages parent or the pages dir itself)",
    )
    parser.add_argument("--merge", action="store_true", help="Write catalog artifacts")
    parser.add_argument("--check", action="store_true", help="Verify committed artifacts")
    parser.add_argument(
        "--quality",
        action="store_true",
        help="Verify catalog description depth (D1 gate)",
    )
    parser.add_argument(
        "--apply-overrides",
        action="store_true",
        help="Merge data/catalog-overrides.json into committed api-catalog.json (no progguide)",
    )
    args = parser.parse_args()

    if args.check:
        check_catalog()
        return
    if args.quality:
        check_catalog_quality()
        return
    if args.apply_overrides:
        apply_overrides_to_committed_catalog()
        return

    progguide = args.progguide
    if not progguide:
        default_pages = Path(DEFAULT_PROGGUIDE_PAGES)
        if default_pages.is_dir():
            progguide = default_pages.parent
        else:
            parser.error(
                "--progguide is required unless --check/--quality "
                "(or sibling ln-progguide-rag)"
            )

    entries = load_from_progguide(progguide.resolve())
    if args.merge:
        write_artifacts(entries)
    else:
        print(f"parsed {len(entries)} entries (use --merge to write)")


if __name__ == "__main__":
    main()