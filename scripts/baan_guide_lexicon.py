"""Canonical Baan / Infor ES Programmers Guide 10.8.0 lexicon for syntax + generator.

Sources:
  - 3gl_features/vocabulary
  - functions_database_handling/sql_reserved_words
  - 4gl_features/* sections
  - dynamic_link_libraries/object_information_tool
  - 3gl_features/*preprocessor*
"""

from __future__ import annotations

from pathlib import Path

# --- 3GL reserved words (vocabulary) ---
RESERVED_3GL = frozenset(
    """
    and at base based boolean break bset call case common const continue
    default delete deleteempty deleteerror dim dllusage domain double else
    empty end endcase endfor endfunctionusage enddelete endif endupdate
    endwhile endselect enddllusage eq extern false fixed for function
    functionusage ge global goto gt if in input le long lt mb multibyte
    ne not on or print prompt ref reference repeat return select selectbind
    selectdo selectempty selecteos selecterror static step stop string
    table then to true until update updateempty updateerror void wherebind
    whereused while
    """.split()
)

# Stock syntax typo / non-guide token to suppress when redefining
STOCK_FALSE_3GL = frozenset({"ofr"})

# --- SQL reserved words (sql_reserved_words) ---
RESERVED_SQL = frozenset(
    """
    alike all and array as asc avg between both buffer by case cast clear
    clearunref count cross current_date current_timestamp date date.num
    date.to.num delete desc distinct else empty end endcase enum_description
    escape exists false fetching first fixctl for from full group having
    hint hints in index inner inrange integer is join last leading left like
    max min no not null on or order ordered outer path prepared raw real
    refers repeat retry right row rows select set setunref skip size string
    subhint sum text_content then timestamp to trailing trim true union
    unref update use when where with
    """.split()
)

# SQL tokens commonly used in embedded SQL that stock missed (gap from audit)
SQL_GAP = frozenset(
    """
    alike alike exists like join inner outer distinct null escape both cross
    leading trailing subhint alike alike fetch fetching prepared refers
    clearunref setunref
    """.split()
)
# dedupe
SQL_GAP = frozenset(SQL_GAP)

# Embedded-SQL section keywords (stock + guide)
SQL_SECTION = frozenset(
    """
    select selectdo selectempty selecterror selecteos endselect
    update updateempty updateerror updateeos endupdate
    deleteempty deleteerror deleteeos enddelete
    from where wherebind whereused between inrange having
    hint ordered asc desc set
    """.split()
)

# --- API prefix allow-list (safe; no 4GL collision) ---
API_PREFIX_ALLOW = frozenset(
    """
    dal db dbcm json http xml sql gbf seq rdi curl aud plcm chm pcm ims par
    mb java uuid cipher digest sha zip soap utc bms prcm spool chart pipe ue
    bse artm cps rsc query client appl cmf tt sec brp zipfile zipinfo hmac
    ssl uuid
    """.split()
)

# Prefix roots that collide with 4GL sections or are too generic
API_PREFIX_DENY = frozenset(
    """
    before after on field choice form group main zoom init when check domain
    ref read selection do to is get set add start copy put display file path
    str text bit remove change enable disable load publish store map date
    dialog dir create refresh sig
    """.split()
)

# Vim syntax group names currently emitted for deny prefixes (to clear in local)
API_SYNTAX_GROUPS_DENY = (
    "baanApiBefore",
    "baanApiAfter",
    "baanApiField",
    "baanApiDo",
    "baanApiTo",
    "baanApiIs",
    "baanApiGet",
    "baanApiSet",
    "baanApiAdd",
    "baanApiStart",
    "baanApiCopy",
    "baanApiPut",
    "baanApiDisplay",
    "baanApiFile",
    "baanApiPath",
    "baanApiStr",
    "baanApiText",
    "baanApiBit",
    "baanApiRemove",
    "baanApiChange",
    "baanApiEnable",
    "baanApiDisable",
    "baanApiLoad",
    "baanApiPublish",
    "baanApiStore",
    "baanApiMap",
    "baanApiDate",
    "baanApiDialog",
    "baanApiDir",
    "baanApiCreate",
    "baanApiRefresh",
    "baanApiSig",
)

# Minimum functions with same prefix before emitting a prefix rule
API_PREFIX_MIN_COUNT = 8

# --- Generator deny-list for page stems / ids (doc pages, not callables) ---
PAGE_DENY_RE = (
    r"(overview|synopsis|example|illustration|glossary|getting[_]?started|"
    r"cookbook|^programming$|^types$|^functions$|hints_for|transition_|"
    r"typical_usage|comparable_datatypes|_pred$|_hint$|_constant$|_object$|"
    r"_namespace$|_expression$|_specification$|_statement$|_feature$|"
    r"sample_program|document_information|^progguide$|_interface$|"
    r"ibucket|ibaanvm|annotation|reserved_words|identifier$|data_types$|"
    r"vocabulary$|preprocessor$|iterations$|transfer_of_control|"
    r"long_expressions|macro_definition|include_files|pragma_codes|"
    r"conditional_compilation|token_pasting|object_identifications|"
    r"error_codes$|error_handling$|^errors$|^welcome$|^misc$)"
)

# Categories skipped unless name looks like API (has '.' or ends with $)
DOC_CATEGORIES = frozenset(
    {
        "3gl_features",
        "4gl_features",
        "welcome",
        "misc",
        "bol",
        "debugger",
        "considerations_on_doubles",
        "tiv",
        "events",
    }
)

# Default progguide pages root (sibling checkout; override via env/CLI)
_ROOT = Path(__file__).resolve().parents[1]
_SIBLING_RAG = _ROOT.parent / "ln-progguide-rag" / "data"
DEFAULT_PROGGUIDE_PAGES = str(
    Path(__import__("os").environ.get("LN_PROGGUIDE_PAGES", _SIBLING_RAG / "pages"))
)
DEFAULT_PROGGUIDE_META = str(
    Path(__import__("os").environ.get("LN_PROGGUIDE_META", _SIBLING_RAG / "meta.json"))
)

# Completion extras beyond RESERVED / SQL (project + common)
COMPLETION_EXTRAS = (
    "call",
    "exists",
    "like",
    "alike",
    "selectdo",
    "endselect",
    "selectempty",
    "selecterror",
    "extern",
    "domain",
    "ref",
)
