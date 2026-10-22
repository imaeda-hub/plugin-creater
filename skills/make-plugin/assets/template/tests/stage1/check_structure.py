#!/usr/bin/env python3
"""1段目 構造の検査。

使い方:
    python3 -I check_structure.py プラグインのフォルダ [--kind generated|plugin] [--json]

  --kind generated  生成プラグイン（既定）。公式仕様の検査に、作業の定義・EVAL の課題・ナレッジの番号・
                    エージェントの tools・要件の追跡の表の検査を足す。
  --kind plugin     公式仕様の検査だけ（クリエイター自身の1段目が、この関数を読み込んで使う）。
  --json            結果を JSON で標準出力に出す。

終了コード: 0 全部合格、1 不合格あり、2 道具が足りない・使い方の誤り。
モデルも外のネットワークも使わない。公式スキーマは schemas/ の写しを使う。
"""
from __future__ import annotations

import argparse
import ast
import glob
import ipaddress
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlsplit

if sys.version_info < (3, 9):
    sys.stderr.write("Python 3.9 以上が要ります（今は %s）。\n" % sys.version.split()[0])
    raise SystemExit(2)

try:
    import jsonschema
    import yaml
except ImportError as _e:  # 道具が足りないときは、足りないものを示して止まる
    sys.stderr.write(
        "1段目の検査に要る Python のパッケージが足りません（%s）。\n"
        "仮想環境の中で次を実行してください: python3 -m pip install PyYAML jsonschema\n" % _e
    )
    raise SystemExit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_DIR = os.path.join(HERE, "schemas", "agent-plugins-1.0.0")

PLUGIN_SCHEMA_ID = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"

# 試験の一覧。(番号, 確かめる要件, 名前)。名前には要件の番号を入れる（追跡の表の突き合わせにも使う）。
CATALOG: Dict[str, Tuple[List[str], str]] = {
    "manifest": (["REQ-004"], "plugin.json が公式スキーマ（Agent Plugins 1.0.0）に合う"),
    "mcp": (["REQ-004"], "mcp.json が公式スキーマと決まりに合う"),
    "skills": (["REQ-004"], "スキルのフロントマターが Agent Skills の決まりに合う"),
    "agents": (["REQ-004"], "カスタムエージェントのフロントマターが決まりに合う"),
    "layout": (["REQ-004"], "ファイルの置き場所が Agent Plugins の形式に合う"),
    "symlinks": (["REQ-004"], "根の外に出るシンボリックリンクがない"),
    "task": (["REQ-011"], "作業の定義（task.json）が task.schema.json に合う"),
    "eval": (["REQ-011"], "EVAL の課題の基準の番号と文が作業の定義の写しと同じ"),
    "knowledge": (["REQ-039"], "ナレッジの番号がそれぞれの置き場所にある"),
    "agent-tools": (["REQ-010"], "エージェントの tools が決まりに合う（検証に書き込みとコマンドがなく、スキルがない）"),
    "tool-names": ([], "記録のツールの名前の頭がプラグインの名前"),
    "trace": (["REQ-003"], "要件の追跡の表がそろっている"),
}


def check_title(check_id: str) -> str:
    reqs, text = CATALOG[check_id]
    return " ".join(reqs + [text]) if reqs else text


def stage1_requirement_numbers() -> Set[str]:
    """1段目の試験の名前に入っている要件の番号（追跡の表の「自動のテスト」の突き合わせに使う）。"""
    return {r for reqs, _ in CATALOG.values() for r in reqs}


# ---------------------------------------------------------------- 報告

class Check:
    """1つの試験。errors があれば不合格。"""

    def __init__(self, check_id: str, title: str) -> None:
        self.id = check_id
        self.title = title
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.skipped: Optional[str] = None

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def skip(self, reason: str) -> None:
        self.skipped = reason

    @property
    def status(self) -> str:
        if self.errors:
            return "failed"
        return "skipped" if self.skipped else "passed"

    def to_dict(self) -> Dict[str, Any]:
        return {"id": self.id, "title": self.title, "status": self.status, "problems": list(self.errors),
                "warnings": list(self.warnings), "skipped": self.skipped}


class Report:
    def __init__(self, root: str, kind: str) -> None:
        self.root = root
        self.kind = kind
        self.checks: List[Check] = []

    def new(self, check_id: str, title: Optional[str] = None) -> Check:
        check = Check(check_id, title or check_title(check_id))
        self.checks.append(check)
        return check

    @property
    def ok(self) -> bool:
        return not any(c.errors for c in self.checks)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "plugin": self.root,
            "kind": self.kind,
            "ok": self.ok,
            "checks": [c.to_dict() for c in self.checks],
            "failures": [{"test": c.title, "reason": m} for c in self.checks for m in c.errors],
            "warnings": [{"test": c.title, "message": m} for c in self.checks for m in c.warnings],
        }


class Context:
    """検査の間で分け合う、読み込み済みの値。"""

    def __init__(self, root: str) -> None:
        self.root = os.path.abspath(root)
        self.real_root = os.path.realpath(self.root)
        self.manifest: Optional[Dict[str, Any]] = None
        self.plugin_name: Optional[str] = None
        self.agents: Dict[str, Tuple[Dict[str, Any], str]] = {}   # ファイル名（.agent.md を除く）-> (フロントマター, 本文)
        self.task: Optional[Dict[str, Any]] = None
        self.task_path: Optional[str] = None


# ---------------------------------------------------------------- 読み込みの部品

def rel(ctx: Context, path: str) -> str:
    return os.path.relpath(path, ctx.root).replace(os.sep, "/")


def is_within(path: str, base: str) -> bool:
    """path が base の中（base 自身を含む）か。どちらも本当の場所（realpath か normpath 済み）で渡す。"""
    try:
        return os.path.commonpath([os.path.abspath(path), os.path.abspath(base)]) == os.path.abspath(base)
    except ValueError:  # ドライブが違う
        return False


def short(value: Any, limit: int = 60) -> str:
    text = repr(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def read_json_file(path: str, label: str, check: Check) -> Any:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except OSError as e:
        check.error("%s: 読めない（%s）" % (label, e.strerror or e))
    except UnicodeDecodeError:
        check.error("%s: UTF-8 の文字として読めない" % label)
    except ValueError as e:
        check.error("%s: JSON として読めない（%s）" % (label, e))
    return None


def load_schema(directory: str, name: str) -> Dict[str, Any]:
    with open(os.path.join(directory, name), encoding="utf-8") as f:
        return json.load(f)


def describe_schema_error(error: "jsonschema.ValidationError") -> str:
    """jsonschema の英語の文を、平易な日本語にする。"""
    # oneOf / anyOf は、いちばん近い選択肢の誤りを示す
    if error.validator in ("oneOf", "anyOf") and error.context:
        best = jsonschema.exceptions.best_match(error.context)
        if best is not None:
            error = best
    where = "/".join(str(p) for p in error.absolute_path) or "(全体)"
    v, want, inst = error.validator, error.validator_value, error.instance
    if v == "required" and isinstance(inst, dict):
        message = "必須の項目がない: " + "、".join(k for k in want if k not in inst)
    elif v == "additionalProperties" and isinstance(inst, dict):
        known = error.schema.get("properties", {})
        message = "決まりにない項目がある: " + "、".join(k for k in inst if k not in known)
    elif v == "const":
        message = "%s でなければならない（今は %s）" % (short(want, 90), short(inst, 90))
    elif v == "enum":
        message = "次のどれかでなければならない: %s（今は %s）" % ("、".join(map(str, want)), short(inst))
    elif v == "type":
        message = "型が %s でない（今は %s）" % (want if isinstance(want, str) else "または".join(want), short(inst))
    elif v == "pattern":
        message = "%s が形の決まり %s に合わない" % (short(inst), want)
    elif v == "minLength":
        message = "%d 文字以上でなければならない" % want
    elif v == "maxLength":
        message = "%d 文字以内でなければならない" % want
    elif v == "minItems":
        message = "%d 個以上の要素が要る" % want
    elif v == "minimum":
        message = "%s 以上でなければならない（今は %s）" % (want, short(inst))
    elif v == "uniqueItems":
        message = "同じ要素が重なっている"
    else:
        message = error.message
    return "%s: %s" % (where, message)


def schema_problems(instance: Any, schema: Dict[str, Any], label: str, hints: Optional[Dict[str, str]] = None) -> List[str]:
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(instance), key=lambda e: [str(p) for p in e.absolute_path])
    out = []
    for e in errors:
        text = describe_schema_error(e)
        where = "/".join(str(p) for p in e.absolute_path)
        if hints and where in hints:
            text += hints[where]
        out.append("%s %s" % (label, text))
    return out


FRONTMATTER = re.compile(r"\A---[ \t]*\r?\n(?:(.*?)\r?\n)?---[ \t]*(?:\r?\n|\Z)", re.S)


def parse_frontmatter(path: str, label: str, check: Check) -> Tuple[Optional[Dict[str, Any]], str]:
    """(フロントマターの辞書, 本文)。読めなければ error を足して (None, 本文) を返す。"""
    try:
        with open(path, encoding="utf-8") as f:
            text = f.read()
    except (OSError, UnicodeDecodeError) as e:
        check.error("%s: 読めない（%s）" % (label, e))
        return None, ""
    match = FRONTMATTER.match(text)
    if not match:
        check.error("%s: 先頭にフロントマター（--- で囲んだ YAML）がない" % label)
        return None, text
    body = text[match.end():]
    try:
        meta = yaml.safe_load(match.group(1) or "")
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        line = " %d 行目:" % (mark.line + 2) if mark else ""
        check.error("%s: フロントマターが YAML として読めない（%s %s）" % (label, line, getattr(e, "problem", e)))
        return None, body
    if not isinstance(meta, dict):
        check.error("%s: フロントマターが項目の集まり（キーと値）になっていない" % label)
        return None, body
    return meta, body


# ---------------------------------------------------------------- 公式仕様の検査

def check_manifest(ctx: Context, c: Check) -> None:
    path = os.path.join(ctx.root, "plugin.json")
    if not os.path.isfile(path):
        c.error("plugin.json がない（プラグインの根に置く）")
        return
    data = read_json_file(path, "plugin.json", c)
    if data is None:
        return
    hints = {"$schema": "。書き間違えると、Copilot CLI は何も言わずに以前の形式として読み、com.github.copilot/ と mcp.json を読まない"}
    for problem in schema_problems(data, load_schema(SCHEMA_DIR, "plugin.schema.json"), "plugin.json:", hints):
        c.error(problem)
    if isinstance(data, dict):
        ctx.manifest = data
        if isinstance(data.get("name"), str):
            ctx.plugin_name = data["name"]


def schema_version(url: Any) -> Optional[str]:
    match = re.search(r"/schemas/([^/]+)/", url) if isinstance(url, str) else None
    return match.group(1) if match else None


def is_loopback(host: str) -> bool:
    if host.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def check_mcp_url(name: str, url: str, c: Check) -> None:
    try:
        parts = urlsplit(url)
        host = parts.hostname
    except ValueError as e:
        c.error("mcp.json: %s の url が読めない（%s）" % (name, e))
        return
    if parts.scheme not in ("http", "https") or not host:
        c.error("mcp.json: %s の url %s は絶対の http か https の URL でなければならない" % (name, short(url)))
        return
    if parts.username is not None or parts.password is not None or "@" in parts.netloc:
        c.error("mcp.json: %s の url にユーザー情報（名前:パスワード@）を含めない" % name)
    if parts.fragment or "#" in url:
        c.error("mcp.json: %s の url に断片（# 以降）を含めない" % name)
    if parts.scheme == "http" and not is_loopback(host):
        c.error("mcp.json: %s の url はループバック（localhost、127.0.0.1、::1）以外では https にする" % name)


def check_mcp_stdio(ctx: Context, name: str, server: Dict[str, Any], c: Check) -> None:
    command = server.get("command")
    if isinstance(command, str):
        if re.search(r"\s", command):
            c.error("mcp.json: %s の command %s は実行ファイル1語だけにする（引数は args に分ける）" % (name, short(command)))
        elif "${" in command:
            c.error("mcp.json: %s の command では ${...} が展開されない" % name)
        elif command.startswith("./"):
            check_inside_root(ctx, name, "command", command, c, must_exist=True)
        elif "/" in command or "\\" in command:
            c.error("mcp.json: %s の command %s は素の名前か ./ で始まるプラグイン相対パスにする" % (name, short(command)))
    for arg in server.get("args") or []:
        if isinstance(arg, str) and "${PLUGIN_ROOT}/" in arg:
            check_inside_root(ctx, name, "args", arg.split("${PLUGIN_ROOT}/", 1)[1], c, must_exist=True, shown=arg)
    cwd = server.get("cwd")
    if isinstance(cwd, str):
        for prefix, base in (("${PLUGIN_DATA}", None), ("${PLUGIN_ROOT}", ctx.root), ("./", ctx.root)):
            if cwd.startswith(prefix):
                rest = cwd[len(prefix):] if prefix != "./" else cwd
                if base is None:   # PLUGIN_DATA は実際の場所が分からないので、書き方だけで閉じ込めを見る
                    resolved = os.path.normpath(os.path.join("/data", rest.lstrip("/")))
                    if not is_within(resolved, "/data"):
                        c.error("mcp.json: %s の cwd %s が PLUGIN_DATA の外に出る" % (name, short(cwd)))
                else:
                    check_inside_root(ctx, name, "cwd", rest.lstrip("/") or ".", c, must_exist=False, shown=cwd)
                break


def check_inside_root(ctx: Context, server: str, field: str, relative: str, c: Check, must_exist: bool,
                      shown: Optional[str] = None) -> None:
    """根からの相対パスが、本当の場所でも根の中に収まるか、あるかを見る。"""
    shown = shown or relative
    target = os.path.normpath(os.path.join(ctx.root, relative))
    if not is_within(target, ctx.root) or not is_within(os.path.realpath(target), ctx.real_root):
        c.error("mcp.json: %s の %s %s が根の外に出る" % (server, field, short(shown)))
    elif must_exist and not os.path.exists(target):
        c.error("mcp.json: %s の %s %s が見つからない" % (server, field, short(shown)))


def check_mcp(ctx: Context, c: Check) -> None:
    path = os.path.join(ctx.root, "mcp.json")
    if not os.path.exists(path):
        c.skip("mcp.json がない")
        return
    data = read_json_file(path, "mcp.json", c)
    if data is None:
        return
    for problem in schema_problems(data, load_schema(SCHEMA_DIR, "mcp.schema.json"), "mcp.json:"):
        c.error(problem)
    if not isinstance(data, dict):
        return
    plugin_version = schema_version(ctx.manifest.get("$schema")) if ctx.manifest else None
    mcp_version = schema_version(data.get("$schema"))
    if plugin_version and mcp_version and plugin_version != mcp_version:
        c.error("mcp.json: $schema の版 %s が plugin.json の版 %s と違う（食い違うと MCP だけが無効になる）" % (mcp_version, plugin_version))
    servers = data.get("mcpServers")
    for name, server in (servers.items() if isinstance(servers, dict) else []):
        if not isinstance(server, dict):
            continue
        if server.get("type") == "stdio":
            check_mcp_stdio(ctx, name, server, c)
        elif server.get("type") in ("streamable-http", "sse"):
            if isinstance(server.get("url"), str):
                check_mcp_url(name, server["url"], c)
            headers = server.get("headers")
            if isinstance(headers, dict):
                seen: Dict[str, str] = {}
                for header in headers:
                    if header.lower() in seen:
                        c.error("mcp.json: %s の headers の名前 %s と %s が（大文字小文字を除くと）重なっている" % (name, seen[header.lower()], header))
                    seen[header.lower()] = header


SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SKILL_FIELDS = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}


def check_skill_file(path: str, folder: str, c: Check) -> None:
    label = "skills/%s/SKILL.md:" % folder
    meta, _ = parse_frontmatter(path, label[:-1], c)
    if meta is None:
        return
    name, description = meta.get("name"), meta.get("description")
    if not isinstance(name, str) or not name:
        c.error("%s name がない" % label)
    elif not SKILL_NAME.match(name) or len(name) > 64:
        c.error("%s name %s は小文字の英数字とハイフンだけ（先頭と末尾はハイフン不可、-- 不可）で64文字以内にする" % (label, short(name)))
    elif name != folder:
        c.error("%s name %s がフォルダの名前 %s と違う" % (label, short(name), folder))
    if not isinstance(description, str) or not description.strip():
        c.error("%s description がない（何をするかと、いつ使うかを書く）" % label)
    elif len(description) > 1024:
        c.error("%s description が %d 文字ある（1024 文字以内）" % (label, len(description)))
    if "license" in meta and not isinstance(meta["license"], str):
        c.error("%s license は文字にする" % label)
    comp = meta.get("compatibility")
    if "compatibility" in meta and (not isinstance(comp, str) or not 1 <= len(comp) <= 500):
        c.error("%s compatibility は1〜500文字の文字にする" % label)
    md = meta.get("metadata")
    if "metadata" in meta and (not isinstance(md, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in md.items())):
        c.error("%s metadata は文字から文字への表にする" % label)
    tools = meta.get("allowed-tools")
    if "allowed-tools" in meta and not (isinstance(tools, str) or (isinstance(tools, list) and all(isinstance(t, str) for t in tools))):
        c.error("%s allowed-tools は文字（空白区切り）にする" % label)
    for key in meta:
        if key not in SKILL_FIELDS:
            c.warn("%s %s は Agent Skills の項目にない（公式の参照実装 skills-ref は不合格にする）" % (label, key))


def check_skills(ctx: Context, c: Check, kind: str) -> None:
    base = os.path.join(ctx.root, "skills")
    if not os.path.isdir(base):
        if kind == "generated":
            c.error("skills/ がない（入口のスキルが要る）")
        else:
            c.skip("skills/ がない")
        return
    count = 0
    for folder in sorted(os.listdir(base)):
        directory = os.path.join(base, folder)
        if not os.path.isdir(directory):
            continue
        path = os.path.join(directory, "SKILL.md")
        if not os.path.isfile(path):
            c.warn("skills/%s/: SKILL.md がない（スキルとして読まれない）" % folder)
            continue
        count += 1
        check_skill_file(path, folder, c)
    if kind == "generated" and count == 0:
        c.error("skills/ に入口のスキル（skills/<名前>/SKILL.md）がない")


AGENT_FIELDS = {"description", "name", "model", "models", "model-policy", "modelPolicy", "tools", "mcp-servers",
                "include-custom-instructions", "infer", "reasoningEffort", "target", "disable-model-invocation",
                "user-invocable", "metadata"}
AGENT_BODY_MAX = 30000


def string_or_list(value: Any) -> bool:
    return (isinstance(value, str) and bool(value.strip())) or (
        isinstance(value, list) and bool(value) and all(isinstance(v, str) and v.strip() for v in value))


def agent_tools(meta: Dict[str, Any]) -> Optional[List[str]]:
    """tools を文字のリストにする。書かれていなければ None。"""
    value = meta.get("tools")
    if value is None:
        return None
    if isinstance(value, str):
        return [t for t in re.split(r"[,\s]+", value) if t]
    if isinstance(value, list):
        return [t.strip() for t in value if isinstance(t, str) and t.strip()]
    return []


def check_agents(ctx: Context, c: Check) -> None:
    base = os.path.join(ctx.root, "com.github.copilot", "agents")
    if not os.path.isdir(base):
        c.skip("com.github.copilot/agents/ がない")
        return
    for file in sorted(os.listdir(base)):
        path = os.path.join(base, file)
        if os.path.isdir(path):
            continue
        label = "com.github.copilot/agents/%s:" % file
        if not file.endswith(".agent.md"):
            c.warn("%s ファイル名が *.agent.md ではない（エージェントとして読まれないことがある）" % label)
            continue
        meta, body = parse_frontmatter(path, label[:-1], c)
        if meta is None:
            continue
        ctx.agents[file[: -len(".agent.md")]] = (meta, body)
        if not isinstance(meta.get("description"), str) or not meta["description"].strip():
            c.error("%s description がない（必須）" % label)
        if "name" in meta and not isinstance(meta["name"], str):
            c.error("%s name は文字にする" % label)
        for key in ("model", "models"):   # 1つでも、優先する順のリストでもよい
            if key in meta and not string_or_list(meta[key]):
                c.error("%s %s はモデルの名前（1つ）か、優先する順の名前のリストにする" % (label, key))
        if "tools" in meta and not (isinstance(meta["tools"], str) or (
                isinstance(meta["tools"], list) and all(isinstance(t, str) for t in meta["tools"]))):
            c.error("%s tools は文字か、文字のリストにする" % label)
        for key in meta:
            if key not in AGENT_FIELDS:
                c.warn("%s %s は公式ドキュメントにない項目" % (label, key))
        if len(body) > AGENT_BODY_MAX:
            c.error("%s 本文が %d 文字ある（%d 文字以内）" % (label, len(body), AGENT_BODY_MAX))


LEGACY_PATHS = [
    ("agents", "com.github.copilot/agents/ に移す"), ("commands", "com.github.copilot/commands/ に移す"),
    ("rules", "com.github.copilot/rules/ に移す"), ("hooks", "com.github.copilot/hooks/ に移す"),
    ("hooks.json", "com.github.copilot/hooks/hooks.json に移す"), ("lsp.json", "com.github.copilot/lsp.json に移す"),
    (".mcp.json", "mcp.json に直す"), ("extensions", "com.github.copilot/extensions/ に移す"),
    (".claude-plugin", "plugin.json は根に置く"), (".github/plugin/plugin.json", "plugin.json は根に置く"),
]
COPILOT_ENTRIES = {"agents", "commands", "rules", "hooks", "extensions", "lsp.json"}
EXTENSION_FILES = ("extension.mjs", "extension.cjs", "extension.js")


def check_layout(ctx: Context, c: Check) -> None:
    for name, fix in LEGACY_PATHS:
        if os.path.lexists(os.path.join(ctx.root, *name.split("/"))):
            c.error("%s: 以前の形式の置き場所で、Agent Plugins の形式では読まれない（%s）" % (name, fix))
    base = os.path.join(ctx.root, "com.github.copilot")
    if not os.path.isdir(base):
        return
    for entry in sorted(os.listdir(base)):
        if entry not in COPILOT_ENTRIES:
            c.error("com.github.copilot/%s: この場所は決まりにない（使えるのは %s）" % (entry, "、".join(sorted(COPILOT_ENTRIES))))
    ext_base = os.path.join(base, "extensions")
    if os.path.isdir(ext_base):
        for entry in sorted(os.listdir(ext_base)):
            path = os.path.join(ext_base, entry)
            if not os.path.isdir(path):
                c.error("com.github.copilot/extensions/%s: エクステンションはフォルダにして、中に extension.mjs を置く" % entry)
            elif not any(os.path.isfile(os.path.join(path, f)) for f in EXTENSION_FILES):
                c.error("com.github.copilot/extensions/%s/: 入口のファイル（extension.mjs）がない" % entry)


def check_symlinks(ctx: Context, c: Check) -> None:
    for directory, dirs, files in os.walk(ctx.root):
        dirs[:] = [d for d in dirs if d != ".git"]
        for entry in dirs + files:
            path = os.path.join(directory, entry)
            if os.path.islink(path) and not is_within(os.path.realpath(path), ctx.real_root):
                c.error("%s: 根の外を指すシンボリックリンク（読み込みで拒まれる）" % rel(ctx, path))


# ---------------------------------------------------------------- 生成プラグインの検査

def extension_dir(ctx: Context) -> Optional[str]:
    if not ctx.plugin_name:
        return None
    return os.path.join(ctx.root, "com.github.copilot", "extensions", ctx.plugin_name)


def task_criteria(task: Any) -> Dict[str, Dict[str, Any]]:
    """作業の定義の合否の基準を、番号 -> 基準 の表にする（形が崩れていても読める分だけ）。"""
    items = task.get("criteria") if isinstance(task, dict) else None
    return {i["id"]: i for i in items if isinstance(i, dict) and isinstance(i.get("id"), str)} if isinstance(items, list) else {}


def check_task(ctx: Context, c: Check) -> None:
    folder = extension_dir(ctx)
    if folder is None:
        c.error("plugin.json の name が読めないので、作業の定義の場所（com.github.copilot/extensions/<名前>/）が分からない")
        return
    shown = rel(ctx, folder)
    task_path = os.path.join(folder, "task.json")
    schema_path = os.path.join(folder, "core", "task.schema.json")
    for path in (task_path, schema_path):
        if not os.path.isfile(path):
            c.error("%s がない" % rel(ctx, path))
    if not (os.path.isfile(task_path) and os.path.isfile(schema_path)):
        return
    schema = read_json_file(schema_path, rel(ctx, schema_path), c)
    task = read_json_file(task_path, rel(ctx, task_path), c)
    if schema is None or task is None:
        return
    try:
        jsonschema.Draft202012Validator.check_schema(schema)
    except jsonschema.SchemaError as e:
        c.error("%s: スキーマ自体が誤っている（%s）" % (rel(ctx, schema_path), e.message))
        return
    ctx.task, ctx.task_path = task, task_path
    label = "%s/task.json:" % shown
    for problem in schema_problems(task, schema, label):
        c.error(problem)
    if not isinstance(task, dict):
        return
    # JSON Schema では書けない決まり：番号が重ならない、作業エージェントのファイルがある、選択肢に初めの値がある
    for field, items_key in (("criteria", "id"), ("workers", "agent"), ("settings", "key"), ("displays", "key")):
        seen: Set[str] = set()
        for item in task.get(field) if isinstance(task.get(field), list) else []:
            value = item.get(items_key) if isinstance(item, dict) else None
            if isinstance(value, str):
                if value in seen:
                    c.error("%s %s の %s %s が重なっている" % (label, field, items_key, value))
                seen.add(value)
    for worker in task.get("workers") if isinstance(task.get("workers"), list) else []:
        agent = worker.get("agent") if isinstance(worker, dict) else None
        if isinstance(agent, str) and not os.path.isfile(os.path.join(ctx.root, "com.github.copilot", "agents", agent + ".agent.md")):
            c.error("%s workers の %s に対応する com.github.copilot/agents/%s.agent.md がない" % (label, agent, agent))
    for setting in task.get("settings") if isinstance(task.get("settings"), list) else []:
        if isinstance(setting, dict) and setting.get("type") == "select" and isinstance(setting.get("options"), list):
            if isinstance(setting.get("default"), str) and setting["default"] and setting["default"] not in setting["options"]:
                c.error("%s settings の %s の初めの値 %s が選択肢にない" % (label, setting.get("key"), short(setting["default"])))


def check_eval(ctx: Context, c: Check) -> None:
    base = os.path.join(ctx.root, "tests", "eval")
    files = sorted(glob.glob(os.path.join(base, "*", "eval.json")))
    if not files:
        c.error("tests/eval/<課題>/eval.json がない（EVAL の課題が1つも入っていない）")
        return
    criteria = task_criteria(ctx.task)
    if ctx.task is None:
        c.error("作業の定義が読めないので、基準の写しを比べられない")
    used: Set[str] = set()
    for path in files:
        label = rel(ctx, path)
        data = read_json_file(path, label, c)
        if data is None:
            continue
        if not isinstance(data, dict):
            c.error("%s: 項目の集まりになっていない" % label)
            continue
        for key in ("id", "prompt"):
            if not isinstance(data.get(key), str) or not data[key].strip():
                c.error("%s: %s がない" % (label, key))
        for item in data.get("inputs") if isinstance(data.get("inputs"), list) else []:
            if isinstance(item, str) and not os.path.exists(os.path.join(os.path.dirname(path), item)):
                c.error("%s: 入力のファイル %s がない" % (label, item))
        items = data.get("criteria")
        if not isinstance(items, list) or not items:
            c.error("%s: criteria（基準の番号と文の写し）がない" % label)
            continue
        for item in items:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                c.error("%s: criteria の要素に id がない" % label)
                continue
            cid = item["id"]
            if item.get("grading") not in ("program", "model"):
                c.error("%s: 基準 %s の grading は program か model にする" % (label, cid))
            elif item["grading"] == "program" and not (isinstance(item.get("check"), dict) and isinstance(item["check"].get("type"), str)):
                c.error("%s: 基準 %s は grading が program なので、check（type つき）が要る" % (label, cid))
            if ctx.task is None:
                continue
            original = criteria.get(cid)
            if original is None:
                c.error("%s: 基準 %s が作業の定義にない" % (label, cid))
            elif item.get("text") != original.get("text"):
                c.error("%s: 基準 %s の文が作業の定義と違う（EVAL: %s／作業の定義: %s）" % (label, cid, short(item.get("text"), 80), short(original.get("text"), 80)))
            else:
                used.add(cid)
    for cid, original in criteria.items():
        if ctx.task is not None and cid not in used:
            c.error("作業の定義の基準 %s（%s）が、どの EVAL の課題にも写されていない" % (cid, short(original.get("text"), 80)))


KNOWLEDGE_ID = re.compile(r"^K-[0-9]+$")
KNOWLEDGE_TOKEN = re.compile(r"(?<![A-Za-z0-9_-])K-[0-9]+(?![0-9])")
SKIP_DIRS = {".git", "node_modules", "__pycache__"}


def knowledge_tokens_outside_tests(ctx: Context) -> Set[str]:
    """作業の定義とテストのフォルダを除くファイルに書かれたナレッジの番号。"""
    found: Set[str] = set()
    for directory, dirs, files in os.walk(ctx.root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (directory == ctx.root and d == "tests")]
        for file in files:
            path = os.path.join(directory, file)
            if path == ctx.task_path or os.path.islink(path):
                continue
            try:
                with open(path, "rb") as f:
                    text = f.read(5 * 1024 * 1024).decode("utf-8", errors="ignore")
            except OSError:
                continue
            found.update(KNOWLEDGE_TOKEN.findall(text))
    return found


def check_knowledge(ctx: Context, c: Check) -> None:
    path = os.path.join(ctx.root, "tests", "knowledge.json")
    if not os.path.isfile(path):
        c.error("tests/knowledge.json がない（番号と種類つきのナレッジの一覧）")
        return
    data = read_json_file(path, "tests/knowledge.json", c)
    if data is None:
        return
    if not isinstance(data, list):
        c.error("tests/knowledge.json: ナレッジの並び（リスト）になっていない")
        return
    entries = []
    seen: Set[str] = set()
    for i, item in enumerate(data):
        where = "tests/knowledge.json の %d 番目" % (i + 1)
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not KNOWLEDGE_ID.match(item["id"]):
            c.error("%s: id は K-数字 の形にする（例：K-01）" % where)
            continue
        if item.get("kind") not in ("criterion", "other"):
            c.error("%s（%s）: kind は criterion か other にする" % (where, item["id"]))
            continue
        if not isinstance(item.get("text"), str) or not item["text"].strip():
            c.error("%s（%s）: text（ナレッジの文）がない" % (where, item["id"]))
            continue
        if item["id"] in seen:
            c.error("%s: 番号 %s が重なっている" % (where, item["id"]))
        seen.add(item["id"])
        entries.append(item)
    if ctx.task is None:
        c.error("作業の定義が読めないので、番号を突き合わせられない")
        return
    in_criteria = {i.get("knowledge") for i in task_criteria(ctx.task).values()}
    by_id = {e["id"]: e for e in entries}
    outside = knowledge_tokens_outside_tests(ctx)
    for e in entries:
        if e["kind"] == "criterion" and e["id"] not in in_criteria:
            c.error("%s（合否の決め方）が作業の定義の合否の基準（criteria の knowledge）にない: 「%s」" % (e["id"], e["text"]))
        elif e["kind"] == "other" and e["id"] not in outside:
            c.error("%s がエージェントの指示などのファイル（作業の定義とテストのフォルダを除く）にない: 「%s」" % (e["id"], e["text"]))
    for cid, criterion in task_criteria(ctx.task).items():
        k = criterion.get("knowledge")
        if k is not None and (k not in by_id or by_id[k]["kind"] != "criterion"):
            c.error("基準 %s の knowledge %s が、ナレッジの一覧にある「合否の決め方」の番号でない" % (cid, short(k)))


ROLE_FILES = (("orchestrator", "統括"), ("worker", "作業"), ("verifier", "検証"))
WRITE_TOOLS = {"edit", "write", "multiedit", "notebookedit", "create"}
EXEC_TOOLS = {"execute", "shell", "bash", "powershell"}


def agents_of(ctx: Context, role: str) -> List[str]:
    if role == "worker":
        return sorted(n for n in ctx.agents if n == "worker" or n.startswith("worker-"))
    return [role] if role in ctx.agents else []


def check_agent_tools(ctx: Context, c: Check) -> None:
    for role, label in ROLE_FILES:
        names = agents_of(ctx, role)
        if not names:
            c.error("%s エージェントの com.github.copilot/agents/%s.agent.md がない" % (label, role))
        for name in names:
            where = "com.github.copilot/agents/%s.agent.md（%s）:" % (name, label)
            tools = agent_tools(ctx.agents[name][0])
            if tools is None:
                c.error("%s tools が書かれていない（書かないと、すべてのツールとスキルが使える）" % where)
                continue
            lowered = [t.lower() for t in tools]
            if "*" in tools:
                c.error("%s tools に * がある（すべてのツールが使える）" % where)
            if "skill" in lowered:
                c.error("%s tools に skill がある（サブエージェントがスキルを呼んでしまう）" % where)
            if role == "verifier":
                for tool in tools:
                    if tool.lower() in WRITE_TOOLS:
                        c.error("%s tools に書き込みのツール %s がある（検証エージェントは成果物を直せない）" % (where, tool))
                    if tool.lower() in EXEC_TOOLS:
                        c.error("%s tools にコマンドのツール %s がある（検証エージェントはコマンドを動かせない）" % (where, tool))


RECORD_SUFFIXES = "open|plan|verdict|show|review|issue|finish"
RECORD_TOOL = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*?)_(%s)$" % RECORD_SUFFIXES)
BACKTICKED = re.compile(r"`([^`\s]+)`")


def check_tool_names(ctx: Context, c: Check) -> None:
    if not ctx.plugin_name:
        c.error("plugin.json の name が読めないので、ツール名の頭を比べられない")
        return
    for name in sorted(ctx.agents):
        meta, body = ctx.agents[name]
        where = "com.github.copilot/agents/%s.agent.md" % name
        found = [("tools", t) for t in agent_tools(meta) or []] + [("本文", t) for t in BACKTICKED.findall(body)]
        for place, token in found:
            m = RECORD_TOOL.match(token)
            if m and m.group(1) != ctx.plugin_name:
                c.error("%s の%s: 記録のツール %s の頭がプラグインの名前 %s ではない" % (where, place, token, ctx.plugin_name))


REQ_IN_NAME = re.compile(r"(?<![A-Za-z0-9])req[-_]?(\d+)(?!\d)", re.I)
NODE_TEST_CALL = re.compile(r"""\b(?:test|it|describe|suite)(?:\.\w+)*\s*\(\s*(['"`])((?:\\.|(?!\1).)*?)\1""", re.S)


def req_number(digits: str) -> str:
    return "REQ-%03d" % int(digits)


def requirement_numbers_in(text: str) -> List[str]:
    return [req_number(d) for d in re.findall(r"REQ-(\d+)", text)]


def collect_test_requirements(ctx: Context) -> Set[str]:
    """テストの名前（node:test の test/it/describe の第1引数、Python の test 関数の名前と docstring）に入っている要件の番号。
    tests/stage1/（この検査自身の試験と見本）は、生成プラグインの要件の試験ではないので数えない。"""
    found: Set[str] = set()
    base = os.path.join(ctx.root, "tests")
    for directory, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (directory == base and d == "stage1")]
        for file in files:
            path = os.path.join(directory, file)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
            except (OSError, UnicodeDecodeError):
                continue
            if re.search(r"\.test\.(mjs|cjs|js)$", file):
                for m in NODE_TEST_CALL.finditer(text):
                    found.update(req_number(d) for d in REQ_IN_NAME.findall(m.group(2)))
            elif re.match(r"test_.*\.py$", file):
                try:
                    tree = ast.parse(text)
                except SyntaxError:
                    continue
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test"):
                        names = node.name + "\n" + (ast.get_docstring(node) or "")
                        found.update(req_number(d) for d in REQ_IN_NAME.findall(names))
    return found


def markdown_tables(text: str) -> List[List[List[str]]]:
    """Markdown の表を、行のリスト（各行は、セルの文字のリスト）のリストにする。コードのかこみの中は読まない。"""
    tables: List[List[List[str]]] = []
    current: List[List[str]] = []
    fenced = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            fenced = not fenced
        if not fenced and stripped.startswith("|"):
            body = stripped[1:]
            if body.endswith("|") and not body.endswith("\\|"):
                body = body[:-1]
            current.append([cell.replace("\\|", "|").strip() for cell in re.split(r"(?<!\\)\|", body)])
        elif current:
            tables.append(current)
            current = []
    if current:
        tables.append(current)
    return tables


TRACE_COLUMNS = (("req", "要件"), ("section", "設計書"), ("files", "ファイル"), ("method", "確かめ方"), ("test", "テスト"))
EMPTY_CELL = {"", "-", "–", "—", "なし"}


def find_trace_table(text: str) -> Optional[Tuple[Dict[str, int], List[List[str]]]]:
    for table in markdown_tables(text):
        header = table[0]
        index = {}
        for key, word in TRACE_COLUMNS:
            for i, cell in enumerate(header):
                if cell.startswith(word):
                    index[key] = i
                    break
        if len(index) == len(TRACE_COLUMNS):
            return index, [r for r in table[2:] if len(r) > max(index.values())]
    return None


def cell_paths(cell: str) -> List[str]:
    ticked = re.findall(r"`([^`]+)`", cell)
    tokens = ticked or [t for t in re.split(r"(?:<br\s*/?>|[、,，;；\s])+", cell) if t]
    paths = []
    for token in tokens:
        token = re.sub(r":\d+(-\d+)?$", "", token.split("#", 1)[0].strip())
        if token not in EMPTY_CELL:
            paths.append(token[2:] if token.startswith("./") else token)
    return paths


def check_trace(ctx: Context, c: Check) -> None:
    spec_path = os.path.join(ctx.root, "docs", "specs", "requirements.md")
    design_path = os.path.join(ctx.root, "docs", "design", "design.md")
    for path in (spec_path, design_path):
        if not os.path.isfile(path):
            c.error("%s がない" % rel(ctx, path))
    if not (os.path.isfile(spec_path) and os.path.isfile(design_path)):
        return
    with open(spec_path, encoding="utf-8") as f:
        spec = f.read()
    with open(design_path, encoding="utf-8") as f:
        design = f.read()
    requirements = {}
    for m in re.finditer(r"^#{1,6}[ \t]+(REQ-(\d+))[ \t]*(.*)$", spec, re.M):
        requirements.setdefault(req_number(m.group(2)), m.group(3).strip())
    if not requirements:
        c.error("docs/specs/requirements.md に要件（見出し「### REQ-001 題」）が1つもない")
    found = find_trace_table(design)
    if found is None:
        c.error("docs/design/design.md に追跡の表がない（列：要件の番号｜設計書の節｜ファイル｜確かめ方｜テスト）")
        return
    index, rows = found
    tests = collect_test_requirements(ctx) | stage1_requirement_numbers()
    rows_of: Dict[str, List[List[str]]] = {}
    for row in rows:
        for number in requirement_numbers_in(row[index["req"]]):
            rows_of.setdefault(number, []).append(row)
    for number, title in requirements.items():
        if number not in rows_of:
            c.error("%s（%s）が追跡の表にない" % (number, title))
            continue
        for row in rows_of[number]:
            check_trace_row(ctx, c, number, row, index, tests)


def check_trace_row(ctx: Context, c: Check, number: str, row: List[str], index: Dict[str, int], tests: Set[str]) -> None:
    where = "追跡の表の %s:" % number
    if row[index["section"]].strip() in EMPTY_CELL:
        c.error("%s 設計書の節が書かれていない" % where)
    paths = cell_paths(row[index["files"]])
    if not paths:
        c.error("%s ファイルが書かれていない" % where)
    for path in paths:
        full = os.path.normpath(os.path.join(ctx.root, path))
        if not is_within(full, ctx.root) or not (glob.glob(full) if re.search(r"[*?\[]", path) else os.path.exists(full)):
            c.error("%s 書かれたファイル %s がない" % (where, path))
    method = row[index["method"]]
    automatic, evaluated, human = "自動のテスト" in method, "eval" in method.lower(), "人が確かめる" in method
    if not (automatic or evaluated or human):
        c.error("%s 確かめ方が「自動のテスト」「EVAL」「人が確かめる」のどれでもない: %s" % (where, short(method)))
    if automatic and number not in tests:
        c.error("%s 確かめ方が自動のテストだが、名前に %s を持つテストがない（node:test の test('%s …')、Python の test 関数の名前か docstring に書く）"
                % (where, number, number))


# ---------------------------------------------------------------- 入口

def run_checks(root: str, kind: str = "generated") -> Report:
    """公式仕様の検査（plugin）に、生成プラグインの検査（generated）を足して動かす。"""
    ctx = Context(root)
    report = Report(ctx.root, kind)
    check_manifest(ctx, report.new("manifest"))
    check_mcp(ctx, report.new("mcp"))
    check_skills(ctx, report.new("skills"), kind)
    check_agents(ctx, report.new("agents"))
    check_layout(ctx, report.new("layout"))
    check_symlinks(ctx, report.new("symlinks"))
    if kind == "generated":
        check_task(ctx, report.new("task"))
        check_eval(ctx, report.new("eval"))
        check_knowledge(ctx, report.new("knowledge"))
        check_agent_tools(ctx, report.new("agent-tools"))
        check_tool_names(ctx, report.new("tool-names"))
        check_trace(ctx, report.new("trace"))
    return report


MARK = {"passed": "合格", "failed": "不合格", "skipped": "対象外"}


def format_report(report: Report) -> str:
    lines = ["構造の検査: %s" % report.root]
    for c in report.checks:
        lines.append("  [%s] %s%s" % (MARK[c.status], c.title, "（%s）" % c.skipped if c.skipped else ""))
        lines.extend("      - %s" % m for m in c.errors)
        lines.extend("      注意: %s" % m for m in c.warnings)
    count = sum(len(c.errors) for c in report.checks)
    lines.append("結果: 合格" if report.ok else "結果: 不合格（%d 件）" % count)
    return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="1段目 構造の検査")
    parser.add_argument("plugin_dir", help="検査するプラグインのフォルダ")
    parser.add_argument("--kind", choices=["generated", "plugin"], default="generated")
    parser.add_argument("--json", action="store_true", help="結果を JSON で出す")
    args = parser.parse_args(argv)
    if not os.path.isdir(args.plugin_dir):
        sys.stderr.write("フォルダがない: %s\n" % args.plugin_dir)
        return 2
    report = run_checks(args.plugin_dir, args.kind)
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2) if args.json else format_report(report))
    return 0 if report.ok else 1


if __name__ == "__main__":
    sys.exit(main())
