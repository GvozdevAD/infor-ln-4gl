#!/usr/bin/env python3
"""Build the TextMate grammar from keyword lists extracted from Vim's baan.vim."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "data" / "baan-vim-keywords.json").read_text())


def alt(words: list[str]) -> str:
    escaped = []
    for word in sorted(set(words), key=lambda w: (-len(w), w.lower())):
        escaped.append(
            word.replace("\\", "\\\\")
            .replace("$", r"\$")
            .replace(".", r"\.")
            .replace("+", r"\+")
        )
    return "(?:" + "|".join(escaped) + ")"


def word(words: list[str]) -> str:
    return r"(?i)(?<![\w.$])" + alt(words) + r"(?![\w.$])"


def chunked(words: list[str], size: int = 90):
    ordered = sorted(set(words), key=str.lower)
    for i in range(0, len(ordered), size):
        yield ordered[i : i + size]


def main() -> None:
    types = DATA["types"] + ["function"]
    storage = DATA["storage"]
    # empty → constants; fixed → storage; function → types / function-header only
    keywords_3gl = [
        w
        for w in DATA["keywords3gl"]
        if w.lower()
        not in {
            "and",
            "or",
            "not",
            "in",
            "to",
            "wherebind",
            "empty",
            "fixed",
            "function",
            "global",
        }
    ]
    keywords_3gl += [
        "if",
        "then",
        "else",
        "endif",
        "while",
        "endwhile",
        "for",
        "endfor",
        "case",
        "endcase",
        "default",
        "on case",
        "repeat",
        "until",
        "goto",
        "break",
        "continue",
        "return",
        "and",
        "or",
        "not",
    ]
    sql = DATA["sql"] + [
        "select",
        "selectdo",
        "selectempty",
        "selecteos",
        "selecterror",
        "endselect",
        "delete",
        "enddelete",
        "update",
        "endupdate",
        "insert",
        "order by",
        "group by",
        "for update",
        "refers to",
        "inner join",
        "exists",
        "as set with",
        "from",
        "where",
        "in",
        "as",
    ]
    # Keep vim's typo out of the grammar; LN spelling is "exists".
    sql = [w for w in sql if w.lower() != "exsists"]

    dal_named = DATA["dalHooks"]
    extra_4gl_runtime = [
        "abort.transaction",
        "choice.again",
        "commit.transaction",
        "dal.count.error.messages",
        "dal.destroy",
        "dal.get.error.message",
        "dal.get.first.error.message",
        "dal.new",
        "dal.reset.error.messages",
        "dal.set.error.message",
        "dal.update",
        "disable.commands",
        "disable.fields",
        "display",
        "display.all",
        "display.fld",
        "do.all.occ",
        "do.occ",
        "enable.commands",
        "enable.fields",
        "execute",
        "get.compnr",
        "get.screen.defaults",
        "get.var",
        "input.again",
        "mark.occ",
        "mess",
        "message",
        "put.var",
        "refresh",
        "remove.mark",
        "rprt_close",
        "rprt_open",
        "rprt_send",
        "set.input.error",
        "start.session",
        "stpapi.delete",
        "stpapi.end.session",
        "stpapi.get.field",
        "stpapi.insert",
        "stpapi.put.field",
        "stpapi.update",
        "switch.to.company",
        "zoom.to$",
    ]
    bshell = DATA["bshell"] + DATA["bshellDollar"] + extra_4gl_runtime

    highlight_constants = [
        "true",
        "false",
        "empty",
        "pi",
        "DALHOOKERROR",
        "DALNOQUERYID",
        "DAL_DESTROY",
        "DAL_FIND",
        "DAL_GET_CURR",
        "DAL_GET_FIRST",
        "DAL_GET_LAST",
        "DAL_GET_NEXT",
        "DAL_GET_PREV",
        "DAL_GET_SPECIFIED",
        "DAL_NEW",
        "DAL_UPDATE",
        "HOOK_IS_APPLICABLE",
        "HOOK_IS_READONLY",
        "HOOK_IS_DERIVED",
        "HOOK_IS_VALID",
        "HOOK_MANDATORY",
        "HOOK_UPDATE",
        "DB.RETRY",
        "DB.LOCK",
        "DB.DELAYED.LOCK",
        "__function__",
        "__object__",
        "__file__",
        "__line__",
        "PRINT.DATA",
        "ADD.SET",
        "UPDATE.DB",
        "MARK.DELETE",
        "END.PROGRAM",
        "ABORT.PROGRAM",
        "CONT.PROCESS",
        "SAVE.DEFAULTS",
        "GET.DEFAULTS",
        "FIND.DATA",
        "DEF.FIND",
    ]
    highlight_constants += [
        c
        for c in DATA["constants"]
        if c.startswith("APPL.") or c.startswith("AUTG_")
    ]

    # Named 4GL session/runtime vars (db.retry lives only in constants as DB.RETRY).
    session_named = [
        "zoomreturn$",
        "main.table$",
        "curr.key",
        "marked",
        "choice",
        "parent",
        "pid",
        "prog.name$",
    ]

    grammar = {
        "$schema": "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json",
        "name": "Infor LN 4GL",
        "scopeName": "source.ln4gl",
        "comment": (
            "Keyword lists derived from Vim runtime syntax/baan.vim "
            "(Erik Remmelzwaal / Erwin Smit / Her van de Vliert). "
            "Pattern structure inspired by masal/SublimeBaan. "
            "Baan strings have no backslash escapes (embedded quotes are doubled); "
            "#strings must precede #comments so | inside quotes is not a comment."
        ),
        "patterns": [
            {"include": "#strings"},
            {"include": "#comments"},
            {"include": "#dll-usage"},
            {"include": "#preprocessor"},
            {"include": "#sections-4gl"},
            {"include": "#sql"},
            {"include": "#dal-hooks"},
            {"include": "#function-header"},
            {"include": "#session-vars"},
            # Table.field / :host before builtins; table segment must contain a digit
            # so dal.update / db.insert stay for #builtins.
            {"include": "#identifiers"},
            {"include": "#types"},
            {"include": "#storage"},
            {"include": "#keywords-3gl"},
            {"include": "#constants"},
            {"include": "#builtins"},
            {"include": "#numbers"},
            {"include": "#operators"},
        ],
        "repository": {
            "comments": {
                "patterns": [
                    {
                        "name": "comment.line.vertical-bar.ln4gl",
                        "match": r"\|.*$",
                    }
                ]
            },
            "dll-usage": {
                "patterns": [
                    {
                        "name": "comment.block.documentation.ln4gl",
                        "begin": r"(?i)^\s*(dllusage|functionusage)\b",
                        "end": r"(?i)^\s*(enddllusage|endfunctionusage)\b",
                        "beginCaptures": {
                            "1": {"name": "keyword.other.documentation.ln4gl"}
                        },
                        "endCaptures": {
                            "1": {"name": "keyword.other.documentation.ln4gl"}
                        },
                    }
                ]
            },
            "strings": {
                "name": "string.quoted.double.ln4gl",
                "begin": r'"',
                # No backslash escapes: \ is a plain character (e.g. "C:\temp\file").
                # Do not end on the first quote of an LN "" escape (vscode-textmate
                # prefers the end pattern over inner matches for a single ").
                "end": r'"(?!")',
                "beginCaptures": {
                    "0": {"name": "punctuation.definition.string.begin.ln4gl"}
                },
                "endCaptures": {
                    "0": {"name": "punctuation.definition.string.end.ln4gl"}
                },
                "patterns": [{"name": "constant.character.escape.ln4gl", "match": r'""'}],
            },
            "preprocessor": {
                "name": "meta.preprocessor.ln4gl",
                "begin": r"^\s*(#(include|define|undef|pragma|ident|if|ifdef|ifndef|elif|else|endif))\b",
                "end": r"$",
                "beginCaptures": {"1": {"name": "keyword.control.directive.ln4gl"}},
                "patterns": [
                    {"include": "#strings"},
                    {"include": "#comments"},
                    {"include": "#numbers"},
                ],
            },
            "sections-4gl": {
                "patterns": [
                    {
                        "name": "entity.name.section.program.ln4gl",
                        "match": r"(?i)^\s*(declaration|functions|before\.program|on\.error|after\.program|after\.update\.db\.commit|before\.display\.object|before\.new\.object)\s*:",
                    },
                    {
                        "name": "entity.name.section.form.ln4gl",
                        "match": r"(?i)^\s*(form\.(?:\d+|all|other)|(?:init|before|after)\.form)\s*:",
                    },
                    {
                        "name": "entity.name.section.group.ln4gl",
                        "match": r"(?i)^\s*(group\.\d+|(?:init|before|after)\.group)\s*:",
                    },
                    {
                        "name": "entity.name.section.choice.ln4gl",
                        "match": r"(?i)^\s*(choice\.(?:start\.set|first\.view|next\.view|prev\.view|last\.view|def\.find|find\.data|first\.set|next\.set|display\.set|prev\.set|rotate\.curr|last\.set|add\.set|update\.db|dupl\.occur|recover\.set|mark\.delete|mark\.occur|change\.order|modify\.set|restart\.input|print\.data|create\.job|form\.tab\.change|first\.frm|next\.frm|prev\.frm|last\.frm|resize\.frm|cmd\.options|zoom|interrupt|end\.program|abort\.program|cont\.process|text\.manager|run\.job|global\.delete|global\.copy|save\.defaults|get\.defaults|start\.chart|start\.query|user\.\d+|ask\.helpinfo|calculator|calendar|bms|cmd\.whats\.this|help\.index)|(?:before|on|after)\.choice)\s*:",
                    },
                    {
                        "name": "entity.name.section.field.ln4gl",
                        "match": r"(?i)^\s*(field\.(?:all|other|[A-Za-z0-9_.]+)|init\.field|before\.field|before\.input|before\.display|selection\.filter|before\.zoom|before\.checks|domain\.error|ref\.input|ref\.display|check\.input|on\.input|when\.field\.changes|after\.zoom|after\.input|after\.display|after\.field)\s*:",
                    },
                    {
                        "name": "entity.name.section.zoom.ln4gl",
                        "match": r"(?i)^\s*(zoom\.from\.[A-Za-z0-9_.]+|on\.(?:entry|exit))\s*:",
                    },
                    {
                        "name": "entity.name.section.main-table.ln4gl",
                        "match": r"(?i)^\s*(main\.table\.io|before\.read|after\.read|before\.write|after\.write|after\.skip\.write|before\.rewrite|after\.rewrite|after\.skip\.rewrite|before\.delete|after\.delete|after\.skip\.delete|read\.view)\s*:",
                    },
                ]
            },
            "sql": {
                "patterns": [
                    {
                        "name": "keyword.control.sql.ln4gl",
                        "match": r"(?i)(?<![\w.$])as set with\s+\d+\s+rows(?![\w.$])",
                    },
                    {
                        "name": "keyword.control.sql.ln4gl",
                        "match": word(sql),
                    },
                ]
            },
            "dal-hooks": {
                "patterns": [
                    {
                        "name": "support.function.hook.dal.ln4gl",
                        "match": word(dal_named),
                    },
                    {
                        "name": "support.function.hook.dal.ln4gl",
                        "match": r"(?i)(?<![\w.$])[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*\.(?:check|is\.valid|is\.applicable|is\.never\.applicable|is\.derived|is\.readonly|is\.mandatory|make\.valid|update|filter)(?![\w.$])",
                    },
                ]
            },
            "function-header": {
                "match": r"(?i)\b(function)\s+(?:(extern)\s+)?(?:(?:(long|double|void|string|boolean)|(?:(domain)\s+([\w.]+)))\s+)?([\w.]+)\s*\(",
                "captures": {
                    "1": {"name": "storage.type.function.ln4gl"},
                    "2": {"name": "storage.modifier.ln4gl"},
                    "3": {"name": "storage.type.ln4gl"},
                    "4": {"name": "storage.type.ln4gl"},
                    "5": {"name": "entity.name.type.domain.ln4gl"},
                    "6": {"name": "entity.name.function.ln4gl"},
                },
            },
            "session-vars": {
                "patterns": [
                    {
                        "name": "variable.language.attribute.ln4gl",
                        "match": r"(?i)(?<![\w.$])(?:attr|fattr|sattr)\.[A-Za-z_][\w.$]*(?![\w.$])",
                    },
                    {
                        "name": "variable.language.session.ln4gl",
                        "match": word(session_named),
                    },
                ]
            },
            "identifiers": {
                "patterns": [
                    {
                        "name": "variable.parameter.host.ln4gl",
                        "match": r"(?<![\w.$]):[A-Za-z_][\w.$]*",
                    },
                    {
                        # tdsls401.orno / cxoes021._index1 (digit in table id)
                        "name": "variable.other.property.ln4gl",
                        "match": (
                            r"(?i)(?<![\w.$:])"
                            r"[A-Za-z][A-Za-z0-9_]*\d[A-Za-z0-9_]*"
                            r"\.[A-Za-z_][A-Za-z0-9_]*"
                            r"(?![\w.$])"
                        ),
                    },
                    {
                        # cxoes021.* in select lists
                        "name": "variable.other.property.ln4gl",
                        "match": (
                            r"(?i)(?<![\w.$:])"
                            r"[A-Za-z][A-Za-z0-9_]*\d[A-Za-z0-9_]*"
                            r"\.\*"
                        ),
                    },
                    {
                        # Bare table id: from cxoes021 / refers to cxoes031
                        # (digit required; suno.f stays uncolored)
                        "name": "entity.name.type.table.ln4gl",
                        "match": (
                            r"(?i)(?<![\w.$:])"
                            r"[A-Za-z][A-Za-z0-9_]*\d[A-Za-z0-9_]*"
                            r"(?![\w.$])"
                        ),
                    },
                ]
            },
            "types": {"name": "storage.type.ln4gl", "match": word(types)},
            "storage": {"name": "storage.modifier.ln4gl", "match": word(storage)},
            "keywords-3gl": {
                "name": "keyword.control.ln4gl",
                "match": word(keywords_3gl),
            },
            "constants": {
                "name": "constant.language.ln4gl",
                "match": word(highlight_constants),
            },
            "builtins": {
                "patterns": [
                    {
                        "name": "support.function.builtin.ln4gl",
                        "match": word(chunk),
                    }
                    for chunk in chunked(bshell)
                ]
            },
            "numbers": {
                "patterns": [
                    {
                        "name": "constant.numeric.float.ln4gl",
                        "match": r"(?<![\w.])-?\d+\.\d+(?![\w.])",
                    },
                    {
                        "name": "constant.numeric.integer.ln4gl",
                        "match": r"(?<![\w.])-?\d+(?![\w.])",
                    },
                ]
            },
            "operators": {
                "name": "keyword.operator.ln4gl",
                "match": r"=|<>|<=|>=|<|>|\+|-|\*|/|\?|&",
            },
        },
    }

    out = ROOT / "syntaxes" / "ln-4gl.tmLanguage.json"
    out.write_text(json.dumps(grammar, indent=2) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes)")

    common_functions = [
        "message",
        "mess",
        "expr.compile",
        "expr.free",
        "dal.new",
        "dal.update",
        "dal.destroy",
        "dal.set.error.message",
        "dal.get.error.message",
        "dal.new.object",
        "dal.change.object",
        "dal.save.object",
        "dal.destroy.object",
        "dal.set.field",
        "get.var",
        "put.var",
        "rprt_open",
        "rprt_close",
        "rprt_send",
        "zoom.to$",
        "execute",
        "choice.again",
        "get.screen.defaults",
        "display",
        "display.fld",
        "display.all",
        "enable.fields",
        "disable.fields",
        "enable.commands",
        "disable.commands",
        "set.input.error",
        "abort.transaction",
        "commit.transaction",
        "db.insert",
        "db.update",
        "db.delete",
        "db.retry.point",
        "db.eq",
        "db.first",
        "db.next",
        "db.prev",
        "db.last",
        "db.error",
        "db.error.message",
        "db.set.to.default",
        "do.occ",
        "do.all.occ",
        "sprintf$",
        "strip$",
        "tolower$",
        "toupper$",
        "len",
        "lval",
        "val",
        "str$",
        "pos",
        "shiftl$",
        "shiftr$",
        "enum.descr$",
        "date.num",
        "date.to.num",
        "num.to.date$",
        "get.compnr",
        "switch.to.company",
        "start.session",
        "query.extend.select",
        "query.extend.from",
        "query.extend.where",
        "query.extend.select.in.zoom",
        "query.extend.from.in.zoom",
        "query.extend.where.in.zoom",
        "stpapi.put.field",
        "stpapi.get.field",
        "stpapi.insert",
        "stpapi.update",
        "stpapi.delete",
        "stpapi.save",
        "stpapi.find",
        "stpapi.browse.set",
        "stpapi.print.report",
        "stpapi.end.session",
    ]

    error_codes = [
        "ELOCKED",
        "EDUPL",
        "ENOREC",
        "EREFERENCE",
        "EENDFILE",
        "ENOCURR",
        "EPERMISSION",
        "EBUSY",
    ]

    completions = {
        "keywords": sorted(set(keywords_3gl + types + storage)),
        "sql": sorted(set(sql)),
        "sections": [
            "declaration:",
            "functions:",
            "before.program:",
            "after.program:",
            "on.error:",
            "before.input:",
            "after.field:",
            "when.field.changes:",
            "check.input:",
            "on.choice:",
            "before.choice:",
            "after.choice:",
            "init.form:",
            "init.group:",
            "selection.filter:",
        ],
        "dalHooks": sorted(set(dal_named)),
        "constants": sorted(set(highlight_constants + session_named)),
        "functions": sorted(set(common_functions)),
        "errors": sorted(set(error_codes)),
    }
    cpath = ROOT / "data" / "completions.json"
    cpath.write_text(json.dumps(completions, indent=2) + "\n")
    print(f"wrote {cpath}")


if __name__ == "__main__":
    main()
