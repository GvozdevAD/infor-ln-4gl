#!/usr/bin/env python3
"""Extract Infor ES API catalog from Progguide function pages."""

from __future__ import annotations

import argparse
import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "api-catalog.json"
LINKS_PATH = ROOT / "data" / "links.json"
SIGNATURES_PATH = ROOT / "data" / "signatures.json"
COMPLETIONS_PATH = ROOT / "data" / "completions.json"
DAL_NOTES_PATH = ROOT / "data" / "dal-notes.json"

TITLE_RE = re.compile(r"^([\w.$]+)(?:\(\))?$")
INTERNAL_LINK_RE = re.compile(
    r'data-internal="/docs/progguide/[^"]*/([\w.$]+)"',
    re.IGNORECASE,
)
REPLACES_RE = re.compile(
    r"replaces(?:\s+the)?\s+([^.]+?)\s+(?:subsection|section|sections)",
    re.IGNORECASE,
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
}

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
    """Collect text and code blocks keyed by subSectionTitle id."""

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

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "div" and attr.get("class") == "subSectionTitle":
            self._in_title = True
            self._buf = []
            self._pending_id = attr.get("id")
        elif self._in_title and tag in {"div", "p", "h1", "h2", "h3"}:
            self._flush_title()
        elif tag == "code":
            self._in_code = True
            self._buf = []
        elif tag == "a" and "data-internal" in attr:
            href = attr.get("data-internal") or ""
            m = INTERNAL_LINK_RE.search(f'data-internal="{href}"')
            if m:
                self._link_targets.append(m.group(1))
        elif tag == "p" and self._active and not self._in_code and not self._in_title:
            self._in_para = True
            self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "div" and self._in_title:
            self._flush_title()
        elif tag == "code" and self._in_code:
            text = html.unescape("".join(self._buf))
            text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
            if self._active and text:
                self.sections.setdefault(self._active, []).append(text)
            self._in_code = False
            self._buf = []
        elif tag == "p" and self._in_para:
            text = html.unescape("".join(self._buf))
            text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
            if self._active and text:
                self.sections.setdefault(self._active, []).append(text)
            self._in_para = False
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._in_title or self._in_code or self._in_para:
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


def clean_text(text: str, limit: int = 300) -> str:
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()
    if len(text) > limit:
        return text[: limit - 1].rstrip() + "…"
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


def summarize_returns(sections: dict[str, list[str]]) -> str:
    for key in ("return-value", "return-values"):
        chunks = sections.get(key, [])
        if chunks:
            return clean_text(" ".join(chunks), 200)
    return ""


def first_paragraph(sections: dict[str, list[str]]) -> str:
    for key in ("description",):
        for chunk in sections.get(key, []):
            text = clean_text(chunk)
            if text and not text.startswith("#include"):
                return text
    return ""


def extract_replaces(description: str) -> list[str] | None:
    m = REPLACES_RE.search(description)
    if not m:
        return None
    raw = m.group(1)
    parts = re.findall(r"[\w.]+", raw)
    cleaned = [p.rstrip(".") for p in parts if p]
    return cleaned or None


def classify_kind(name: str, source: str) -> str:
    if source.startswith("functions_dal/"):
        if name in FIELD_HOOK_NAMES or name.startswith("fieldname."):
            return "dalFieldHook"
        return "dalHook"
    if name in FIELD_HOOK_NAMES:
        return "dalFieldHook"
    return "function"


def should_skip(stem: str, page_id: str) -> bool:
    if stem in DENY_STEMS:
        return True
    if stem.startswith("help_"):
        return True
    if stem.endswith("_overview"):
        return True
    if "/overview" in page_id and stem == "overview":
        return True
    return False


def load_dal_notes() -> dict[str, list[str]]:
    if not DAL_NOTES_PATH.is_file():
        return {}
    return json.loads(DAL_NOTES_PATH.read_text(encoding="utf-8"))


def parse_page(path: Path, dal_notes: dict[str, list[str]]) -> dict | None:
    data = json.loads(path.read_text(encoding="utf-8"))
    title = data.get("title", "")
    m = TITLE_RE.match(title)
    if not m:
        return None
    name = m.group(1)
    page_id = data.get("id", path.stem)
    if should_skip(path.stem, page_id):
        return None

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

    doc = first_paragraph(sections)
    if not doc and syntax:
        doc = f"See syntax: {syntax[:120]}"

    source = page_id
    kind = classify_kind(name, source)
    context = normalize_context(" ".join(sections.get("context", [])))

    related = sorted(set(parser._link_targets))
    hooks_called = related.copy()
    if "hooks-called" in sections:
        hooks_called = sorted(set(hooks_called + parser._link_targets))

    replaces = dal_notes.get(name)
    if not replaces:
        replaces = extract_replaces(" ".join(sections.get("description", [])))

    returns = summarize_returns(sections)

    return {
        "name": name,
        "kind": kind,
        "context": context,
        "doc": doc or name,
        "syntax": syntax,
        "parameters": parse_parameters(syntax) if syntax else [],
        "returns": returns,
        "related": related,
        "replaces": replaces,
        "source": source,
        "_hooks_called": hooks_called,
        "_related_topics": data.get("related", []),
    }


def load_from_progguide(progguide: Path) -> list[dict]:
    pages_dir = progguide / "pages"
    if not pages_dir.is_dir():
        raise SystemExit(f"pages directory not found: {pages_dir}")
    dal_notes = load_dal_notes()
    entries: list[dict] = []
    for path in sorted(pages_dir.glob("functions_*/*.json")):
        parsed = parse_page(path, dal_notes)
        if parsed:
            entries.append(parsed)
    if not entries:
        raise SystemExit("no API pages parsed")
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


def write_artifacts(entries: list[dict]) -> None:
    catalog = [strip_internal(e) for e in entries]
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

    completions = json.loads(COMPLETIONS_PATH.read_text(encoding="utf-8"))
    completions["functions"] = functions
    completions["dalHooks"] = dal_hooks
    COMPLETIONS_PATH.write_text(json.dumps(completions, indent=2) + "\n", encoding="utf-8")
    print(
        f"updated {COMPLETIONS_PATH} "
        f"({len(functions)} functions, {len(dal_hooks)} dalHooks)"
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--progguide", type=Path, help="Path to progguide dist/data/progguide")
    parser.add_argument("--merge", action="store_true", help="Write catalog artifacts")
    parser.add_argument("--check", action="store_true", help="Verify committed artifacts")
    args = parser.parse_args()

    if args.check:
        check_catalog()
        return

    if not args.progguide:
        parser.error("--progguide is required unless --check")

    entries = load_from_progguide(args.progguide.resolve())
    if args.merge:
        write_artifacts(entries)
    else:
        print(f"parsed {len(entries)} entries (use --merge to write)")


if __name__ == "__main__":
    main()
