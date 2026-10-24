#!/usr/bin/env python3
"""Copilot CLI 向けのプラグインを、開発の試験（EVAL）のために Claude Code 向けに置き換える変換スクリプト。

置き換える対象は、クリエイター自身と、クリエイターが組み立てた生成プラグイン。
置き換えの決まりは docs/design/testing.md 4章にある。毎回同じ結果になるよう、変換はこのスクリプトだけで行う。

使い方（-I で、環境変数とカレントフォルダの影響を受けずに動かす）:
    python3 -I tests/dev-eval/convert.py SRC OUT [--skip-validate]

  SRC  Copilot CLI 向けのプラグインのフォルダ（直下に plugin.json がある）
  OUT  置き換えた版を書き出すフォルダ。まだないか、前の変換の出力（OUT/.eval/conversion-report.json がある）のときだけ使える
  --skip-validate  変換の直後の `claude plugin validate` を飛ばす（既定は動かす。通らなければ終了コード 1）

終了コード: 0 = 変換でき、検証にも通った／1 = 変換はできたが検証に通らなかった／2 = 変換を断った
標準出力に結果の要点を JSON で出す。全文は OUT/.eval/conversion-report.json に書く。

OUT/.eval/ には次を書く（置き換えた版の一部だが、Claude Code は読まない）。
  conversion-report.json  変更、警告、外したエクステンション、置き換えたエクステンションのツール名、
                          エージェントのモデル、モデルの対応の表、検証の結果
  rules.md                com.github.copilot/rules/ の中身（EVAL の課題の側で、指示として足す）

Python 3 と PyYAML が要る。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys

import yaml

sys.dont_write_bytecode = True

COPILOT = "com.github.copilot"
EVAL_DIR = ".eval"
REPORT = "conversion-report.json"
VALIDATE_TIMEOUT_SEC = 180
VALIDATE_OUTPUT_LIMIT = 20000


class Refusal(Exception):
    """変換を断る。メッセージは平易な日本語。"""


# ---------------------------------------------------------------------------
# 表（testing.md 4章）
# ---------------------------------------------------------------------------

# モデル。Copilot の名前 → Claude Code の ID。Claude 以外は、Copilot の価格表で同じ値段の Claude にする。
# 別名（sonnet など）は、プロバイダーで解決先が変わるので使わない（R4）。
# 画面で選ぶモデル（Copilot の名前）を ID にするときも、この表を使う（変換レポートの model_map）。
MODEL_MAP = {
    "claude-haiku-5.5": "claude-haiku-5-5",
    "gpt-6-luna": "claude-haiku-5-5",
    "claude-sonnet-5.5": "claude-sonnet-5-5",
    "gpt-6.1-sol": "claude-sonnet-5-5",
    "claude-opus-5.5": "claude-opus-5-5",
}
CLAUDE_ID = re.compile(r"^claude-[a-z]+-[0-9]+(?:-[0-9]+)?$")
EFFORTS = ("low", "medium", "high", "xhigh", "max")

# 実行時のツール名 → Claude Code のツール名。Copilot CLI のフックのリファレンスの対応表。
# skill は表にないが、Claude Code のスキルを読み込むツールの名前が Skill で、働きが同じなので足す。
# 表にないもの（task_complete など）は、Claude Code に同じ働きのツールがないので、そのまま残す。
RUNTIME_TOOLS = {
    "bash": "Bash", "powershell": "Bash", "view": "Read", "create": "Write", "edit": "Edit",
    "str_replace_editor": "Edit", "apply_patch": "Edit", "grep": "Grep", "rg": "Grep", "glob": "Glob",
    "web_fetch": "WebFetch", "web_search": "WebSearch", "ask_user": "AskUserQuestion",
    "update_todo": "TodoWrite", "task": "Agent", "skill": "Skill",
}
# カスタムエージェントの tools の別名（小文字で引く）。1つの別名が複数の Claude Code のツールになる。
AGENT_ALIASES = {
    "execute": ["Bash"], "shell": ["Bash"], "bash": ["Bash"], "powershell": ["Bash"],
    "read": ["Read"], "view": ["Read"], "notebookread": ["Read"],
    "edit": ["Edit", "Write"], "multiedit": ["Edit"], "write": ["Write"], "create": ["Write"],
    "notebookedit": ["NotebookEdit"],
    "search": ["Grep", "Glob"], "grep": ["Grep"], "glob": ["Glob"],
    "agent": ["Agent"], "custom-agent": ["Agent"], "task": ["Agent"],
    "web": ["WebFetch", "WebSearch"], "webfetch": ["WebFetch"], "websearch": ["WebSearch"],
    "todo": ["TodoWrite"], "todowrite": ["TodoWrite"], "skill": ["Skill"],
}
CLAUDE_TOOL_NAMES = set(RUNTIME_TOOLS.values()) | {t for names in AGENT_ALIASES.values() for t in names}
# 普通の単語と紛れない名前（下線を含む）。本文のどこにあっても置き換える。それ以外は、バッククォートで囲んだものだけ。
BARE_TOOLS = {name: claude for name, claude in RUNTIME_TOOLS.items() if "_" in name}

# task（Agent）の引数。Copilot CLI の task と Claude Code の Agent で名前も意味も違う。
#   agent_type: "<名前>"      → subagent_type（Agent の入力の型の項目）
#   mode: "sync" / "background" → run_in_background: false / true（Claude Code の mode は別の意味で、使わない）
# 引数の名前を示す本文（バッククォートの `agent_type`、`"sync"`、`"background"` がある本文）でだけ置き換える。
AGENT_ARG_TOKENS = {"agent_type": "subagent_type", '"sync"': "false", '"background"': "true"}
AGENT_ARG_MODE = ("mode", "run_in_background")  # 上のどれかがある本文でだけ置き換える（mode は普通の単語のため）

HOOK_EVENTS = {
    "sessionStart": "SessionStart", "sessionEnd": "SessionEnd", "userPromptSubmitted": "UserPromptSubmit",
    "preToolUse": "PreToolUse", "postToolUse": "PostToolUse", "postToolUseFailure": "PostToolUseFailure",
    "agentStop": "Stop", "subagentStart": "SubagentStart", "subagentStop": "SubagentStop",
    "preCompact": "PreCompact", "notification": "Notification", "permissionRequest": "PermissionRequest",
}
TOOL_HOOK_EVENTS = {"preToolUse", "postToolUse", "postToolUseFailure", "permissionRequest"}
VARIABLES = {
    "${PLUGIN_ROOT}": "${CLAUDE_PLUGIN_ROOT}", "${PLUGIN_DATA}": "${CLAUDE_PLUGIN_DATA}",
    "${COPILOT_PLUGIN_ROOT}": "${CLAUDE_PLUGIN_ROOT}", "${COPILOT_PLUGIN_DATA}": "${CLAUDE_PLUGIN_DATA}",
}
MANIFEST_FIELDS = ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"]
# Claude Code のサブエージェントにない項目（外して警告する）
AGENT_DROP = {"infer", "mcp-servers", "include-custom-instructions", "target", "disable-model-invocation",
              "user-invocable", "metadata", "model-policy", "modelPolicy"}
MCP_TYPES = {"stdio": "stdio", "streamable-http": "http", "sse": "sse"}

# 置き換えた版に写さないもの（プラグインとして動くのに要らない、または試される側に見せないもの）。
# 見ない模擬ユーザー（tests/dev-eval/heldout/）は tests/ の下にあり、ここで入り口から外れる。降りて見ることもしない。
EXCLUDE_TOP_DIRS = {".git", ".github", ".claude", ".venv", "node_modules", "__pycache__", "wip", "docs", "tests",
                    "examples", ".plugin-creator-work", EVAL_DIR, COPILOT}
EXCLUDE_TOP_FILES = {"plugin.json", "mcp.json", "CLAUDE.md", "AGENTS.md", ".gitignore"}
EXCLUDE_ANYWHERE = {".git", "node_modules", "__pycache__", ".venv", ".DS_Store", "heldout"}


# ---------------------------------------------------------------------------
# 文脈（1回の変換）
# ---------------------------------------------------------------------------

class Context:
    def __init__(self, src: str, out: str, plugin_name: str, extensions: list[str]):
        self.src = src
        self.out = out
        self.plugin = plugin_name
        self.extensions = sorted(extensions, key=len, reverse=True)  # 長い名前から照合する
        self.changes: list[str] = []
        self.warnings: list[str] = []
        self.extension_tools: dict[tuple[str, str], dict] = {}
        self.agents: list[dict] = []

    def change(self, text: str) -> None:
        self.changes.append(text)

    def warn(self, text: str) -> None:
        if text not in self.warnings:
            self.warnings.append(text)


def server_name(extension: str) -> str:
    """エクステンションの名前 → Agent SDK の MCP サーバー名。使えない文字は下線にする。"""
    return re.sub(r"[^A-Za-z0-9_-]", "_", extension)


def extension_tool(name: str, ctx: Context) -> tuple[str, str] | None:
    """`<エクステンション>_<ツール>` なら (エクステンション, ツール)。"""
    for ext in ctx.extensions:
        prefix = ext + "_"
        if name.startswith(prefix) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", name[len(prefix):]):
            return ext, name[len(prefix):]
    return None


def to_mcp_name(name: str, ctx: Context, where: str) -> str | None:
    """エクステンションのツール名なら MCP のツール名に置き換え、レポートに残す。そうでなければ None。"""
    found = extension_tool(name, ctx)
    if not found:
        return None
    ext, tool = found
    server = server_name(ext)
    if server != ext:
        ctx.warn(f"{where}: エクステンション {ext!r} の名前に MCP のサーバー名に使えない文字があるため、サーバー名を {server!r} にした")
    mcp = f"mcp__{server}__{tool}"
    row = ctx.extension_tools.setdefault((name, mcp), {"from": name, "to": mcp, "extension": ext, "server": server,
                                                        "tool": tool, "where": []})
    if where not in row["where"]:
        row["where"].append(where)
    return mcp


def convert_model(value, where: str, ctx: Context) -> str:
    """model（1つ、または優先する順のリスト）→ Claude Code の ID 1つ。"""
    candidates = [value] if isinstance(value, str) else [v for v in (value or []) if isinstance(v, str)]
    for name in candidates:  # 1) Claude のモデルがあれば、最初のもの
        if name in MODEL_MAP and name.startswith("claude-"):
            return MODEL_MAP[name]
        if CLAUDE_ID.match(name):
            return name
    for name in candidates:  # 2) なければ、価格表で同じ値段の Claude
        if name in MODEL_MAP:
            return MODEL_MAP[name]
    ctx.warn(f"{where}: モデル {value!r} に対応する Claude Code のモデルが表にない。inherit にした")
    return "inherit"


# ---------------------------------------------------------------------------
# 変数・ツール名・本文
# ---------------------------------------------------------------------------

def substitute_variables(value):
    """設定ファイル（mcp.json、フック）の ${PLUGIN_ROOT} などを Claude Code の変数にする。本文では置き換えない（convert_body）。"""
    if isinstance(value, str):
        for old, new in VARIABLES.items():
            value = value.replace(old, new)
        return value
    if isinstance(value, list):
        return [substitute_variables(v) for v in value]
    if isinstance(value, dict):
        return {k: substitute_variables(v) for k, v in value.items()}
    return value


def convert_tool(item: str, ctx: Context, where: str) -> list[str]:
    """エージェントの tools の1つ分（別名、実行時の名前、サーバー/ツール、エクステンションのツール）→ Claude Code の名前。"""
    item = item.strip()
    mcp = to_mcp_name(item, ctx, where)
    if mcp:
        return [mcp]
    if "/" in item:  # プラグイン自身の mcp.json のサーバー: サーバー名/ツール名、サーバー名/*
        server, _, tool = item.partition("/")
        if re.search(r"[^A-Za-z0-9_-]", ctx.plugin + server):
            ctx.warn(f"{where}: {item!r} のプラグイン名かサーバー名に、MCP の名前に使えない文字がある（そのまま使うと合わない）")
        return [f"mcp__plugin_{ctx.plugin}_{server}__{'*' if tool == '*' else tool}"]
    lower = item.lower()
    if lower in AGENT_ALIASES:
        return list(AGENT_ALIASES[lower])
    if item in RUNTIME_TOOLS:
        return [RUNTIME_TOOLS[item]]
    if item in CLAUDE_TOOL_NAMES:  # Copilot CLI は Claude Code の名前も別名として受け付ける
        return [item]
    ctx.warn(f"{where}: ツール {item!r} に対応する Claude Code の名前がない（そのまま残した）")
    return [item]


def convert_tools(tools, ctx: Context, where: str) -> list[str] | None:
    """tools の並び（リストか、カンマ区切りの文字列）→ Claude Code の tools のリスト。全部を許す指定は None。"""
    if tools is None:
        return None
    if isinstance(tools, str):
        tools = [t for t in tools.split(",") if t.strip()]
    if not isinstance(tools, list):
        ctx.warn(f"{where}: tools の形が分からないため、tools を書かなかった")
        return None
    if any(str(t).strip() == "*" for t in tools):
        return None
    if not tools:
        ctx.warn(f"{where}: tools が空（Copilot CLI ではツールなし）。Claude Code では空の指定の扱いが分からないため、tools を書かなかった（要確認）")
        return None
    mapped: list[str] = []
    for item in tools:
        mapped.extend(convert_tool(str(item), ctx, where))
    return list(dict.fromkeys(mapped))


_INLINE_CODE = re.compile(r"(?<!`)`([^`\n]+)`(?!`)")


def convert_body(text: str, ctx: Context, where: str) -> str:
    """本文のツール名を Claude Code の名前にする（testing.md 4章）。

    - バッククォートで囲んだ名前: 実行時のツール名、エクステンションのツール名（`<エクステンション>_` だけの、名前の頭の言い方も）
    - 下線を含む名前（ask_user など）: 本文のどこにあっても
    - task の引数の名前（agent_type、mode）と値（"sync"、"background"）: バッククォートで囲んだものを、引数の名前を示す本文でだけ
    変数（${PLUGIN_ROOT}）は置き換えない。Copilot CLI は本文で展開せず、Claude Code は本文の ${CLAUDE_PLUGIN_ROOT} を
    読み込みのときに実際のパスにするため、クリエイターの手順の中の「生成プラグインに書く例」まで変わってしまう。
    """
    inner = {m.group(1) for m in _INLINE_CODE.finditer(text)}
    talks_about_task_args = bool(inner & set(AGENT_ARG_TOKENS))

    def one(inside: str) -> str | None:
        if inside in RUNTIME_TOOLS:
            return RUNTIME_TOOLS[inside]
        if inside in AGENT_ARG_TOKENS:
            return AGENT_ARG_TOKENS[inside]
        if inside == AGENT_ARG_MODE[0] and talks_about_task_args:
            return AGENT_ARG_MODE[1]
        for ext in ctx.extensions:  # 「名前が `<エクステンション>_` で始まるもの」のような、名前の頭だけの言い方
            if inside == ext + "_":
                return f"mcp__{server_name(ext)}__"
        return to_mcp_name(inside, ctx, where)

    def span(match: re.Match) -> str:
        new = one(match.group(1))
        return match.group(0) if new is None else f"`{new}`"

    text = _INLINE_CODE.sub(span, text)

    def bare(match: re.Match) -> str:
        return BARE_TOOLS[match.group(0)]

    boundary = r"(?<![A-Za-z0-9_-])(?:%s)(?![A-Za-z0-9_-])"
    text = re.sub(boundary % "|".join(sorted(map(re.escape, BARE_TOOLS), key=len, reverse=True)), bare, text)
    if ctx.extensions:  # 下線でつながる名前は紛れないので、バッククォートの外でも置き換える
        names = "|".join(re.escape(e) for e in ctx.extensions)
        pattern = re.compile(r"(?<![A-Za-z0-9_-])((?:%s)_[A-Za-z][A-Za-z0-9_]*)(?![A-Za-z0-9_-])" % names)
        text = pattern.sub(lambda m: to_mcp_name(m.group(1), ctx, where) or m.group(1), text)
    return text


# ---------------------------------------------------------------------------
# フロントマター
# ---------------------------------------------------------------------------

_FRONT = re.compile(r"^---\n(.*?)\n---[ \t]*(?:\n|$)(.*)$", re.S)


def split_frontmatter(text: str):
    """(フロントマターの文字, 辞書, 本文)。フロントマターがなければ (None, None, text)。"""
    text = text.replace("\r\n", "\n")
    match = _FRONT.match(text)
    if not match:
        return None, None, text
    raw = match.group(1)
    meta = yaml.safe_load(raw)
    return raw, (meta if isinstance(meta, dict) else {}), match.group(2)


def join_frontmatter(meta: dict, body: str) -> str:
    dumped = yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=100000)
    return "---\n" + dumped + "---\n" + body


def read_text(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def write_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def write_json(path: str, data) -> None:
    write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


# ---------------------------------------------------------------------------
# 部品ごとの置き換え
# ---------------------------------------------------------------------------

def copy_plugin_files(ctx: Context) -> None:
    """プラグインの部品を写す。写さないものは EXCLUDE_*。シンボリックリンクは追わず、写さない。"""
    copied = 0
    for dirpath, dirnames, filenames in os.walk(ctx.src):
        rel = os.path.relpath(dirpath, ctx.src)
        top = rel == "."
        kept = []
        for name in sorted(dirnames):
            full = os.path.join(dirpath, name)
            if name in EXCLUDE_ANYWHERE or (top and name in EXCLUDE_TOP_DIRS):
                continue
            if os.path.islink(full):
                ctx.warn(f"{os.path.relpath(full, ctx.src)}: シンボリックリンクなので写さなかった")
                continue
            kept.append(name)
        dirnames[:] = kept
        for name in sorted(filenames):
            full = os.path.join(dirpath, name)
            if name in EXCLUDE_ANYWHERE or name.endswith(".pyc") or (top and name in EXCLUDE_TOP_FILES):
                continue
            if os.path.islink(full):
                ctx.warn(f"{os.path.relpath(full, ctx.src)}: シンボリックリンクなので写さなかった")
                continue
            dest = os.path.join(ctx.out, rel if not top else "", name)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copy2(full, dest)
            copied += 1
    ctx.change(f"プラグインのファイル {copied} 個を写した（docs、tests、examples、wip、.git などは写さない）")


def convert_manifest(ctx: Context, manifest: dict) -> None:
    claude = {k: manifest[k] for k in MANIFEST_FIELDS if k in manifest}
    for key in manifest:
        if key not in MANIFEST_FIELDS and key != "$schema":
            ctx.warn(f"plugin.json: {key} は Claude Code のマニフェストに移さなかった")
    write_json(os.path.join(ctx.out, ".claude-plugin", "plugin.json"), claude)
    ctx.change("plugin.json -> .claude-plugin/plugin.json")


def convert_mcp(ctx: Context) -> None:
    path = os.path.join(ctx.src, "mcp.json")
    if not os.path.isfile(path):
        return
    servers = json.loads(read_text(path)).get("mcpServers", {})
    claude = {}
    for name, server in servers.items():
        server = substitute_variables(dict(server))
        kind = server.get("type")
        if kind in MCP_TYPES:
            server["type"] = MCP_TYPES[kind]
        else:
            ctx.warn(f"mcp.json: サーバー {name} の type {kind!r} を Claude Code の種類に置き換えられなかった")
        if "cwd" in server:
            ctx.warn(f"mcp.json: サーバー {name} の cwd は、Claude Code の .mcp.json の項目として確かめていない（効かないかもしれない。要確認）")
        claude[name] = server
    write_json(os.path.join(ctx.out, ".mcp.json"), {"mcpServers": claude})
    ctx.change("mcp.json -> .mcp.json（type と ${PLUGIN_ROOT} などを Claude Code の書き方に置き換え）")


def convert_agents(ctx: Context) -> None:
    base = os.path.join(ctx.src, COPILOT, "agents")
    if not os.path.isdir(base):
        return
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames.sort()
        for file in sorted(filenames):
            if not file.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, file), base)
            agent_id = re.sub(r"(\.agent)?\.md$", "", rel).replace(os.sep, "--")
            where = f"agents/{rel}"
            _, meta, body = split_frontmatter(read_text(os.path.join(dirpath, file)))
            if meta is None:
                ctx.warn(f"{where}: フロントマターがないため移さなかった")
                continue
            claude: dict = {"name": meta.get("name") or agent_id, "description": meta.get("description", "")}
            tools = convert_tools(meta.get("tools"), ctx, where)
            if tools:
                claude["tools"] = ", ".join(tools)
            original = meta.get("model", meta.get("models"))
            claude["model"] = convert_model(original, where, ctx) if original else "inherit"
            effort = meta.get("reasoningEffort")
            if effort:
                if effort in EFFORTS:
                    claude["effort"] = effort
                else:
                    ctx.warn(f"{where}: reasoningEffort {effort!r} は Claude Code の effort の値にない。外した")
            for key in meta:
                if key in AGENT_DROP:
                    ctx.warn(f"{where}: {key} は Claude Code のサブエージェントにないため外した")
                elif key not in ("name", "description", "tools", "model", "models", "reasoningEffort"):
                    ctx.warn(f"{where}: {key} は分からない項目のため外した")
            dest = os.path.join("agents", agent_id + ".md")
            write_text(os.path.join(ctx.out, dest), join_frontmatter(claude, convert_body(body, ctx, where)))
            ctx.change(f"{COPILOT}/{where} -> {dest}")
            ctx.agents.append({"name": claude["name"], "file": dest.replace(os.sep, "/"),
                               "copilot_model": original, "model": claude["model"]})


def split_allowed_tools(value) -> list[str]:
    """allowed-tools（リスト、またはカンマか空白で区切った文字）を1つずつに分ける。括弧の中の区切りでは分けない。"""
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    items, current, depth = [], "", 0
    for ch in str(value):
        depth += (ch == "(") - (ch == ")")
        if depth <= 0 and (ch == "," or ch.isspace()):
            if current:
                items.append(current)
            current = ""
        else:
            current += ch
    return items + ([current] if current else [])


def convert_allowed_tools(value, ctx: Context, where: str) -> list[str]:
    mapped: list[str] = []
    for item in split_allowed_tools(value):
        head, paren, rest = item.partition("(")  # Bash(git add:*) のような指定は、名前の部分だけ置き換える
        names = convert_tool(head, ctx, where)
        if paren and len(names) == 1:
            names = [names[0] + paren + rest]
        mapped.extend(names)
    return list(dict.fromkeys(mapped))


def convert_skill_file(path: str, rel: str, ctx: Context) -> None:
    """スキルのフォルダの中の Markdown 1つ。SKILL.md はフロントマターの allowed-tools も置き換える。"""
    raw, meta, body = split_frontmatter(read_text(path))
    new_body = convert_body(body, ctx, rel)
    allowed = meta.get("allowed-tools") if meta else None
    if allowed:
        meta["allowed-tools"] = convert_allowed_tools(allowed, ctx, rel)
        write_text(path, join_frontmatter(meta, new_body))
    elif new_body != body:
        write_text(path, ("---\n" + raw + "\n---\n" if raw is not None else "") + new_body)  # フロントマターは元の文字のまま
    else:
        return
    ctx.change(f"{rel} のツール名を置き換え")


def convert_skills(ctx: Context) -> None:
    """スキルの本文（SKILL.md と、スキルのフォルダの中の Markdown）のツール名を置き換える。

    assets/ と scripts/ の中は置き換えない（素材とスクリプトで、スキルの本文ではないため）。
    クリエイターのひな形（直下の template/）は、Copilot CLI 向けの生成プラグインの元で、クリエイターが写して使う。
    スキルのフォルダの外にあるので、ここでは扱わず、そのまま写される（copy_plugin_files）。
    """
    base = os.path.join(ctx.out, "skills")
    if not os.path.isdir(base):
        return
    for name in sorted(os.listdir(base)):
        folder = os.path.join(base, name)
        if not os.path.isfile(os.path.join(folder, "SKILL.md")):
            continue
        for dirpath, dirnames, filenames in os.walk(folder):
            dirnames[:] = sorted(d for d in dirnames if not (dirpath == folder and d in ("assets", "scripts")))
            for file in sorted(filenames):
                if file.endswith(".md"):
                    path = os.path.join(dirpath, file)
                    convert_skill_file(path, os.path.relpath(path, ctx.out).replace(os.sep, "/"), ctx)


def convert_hooks(ctx: Context) -> None:
    path = os.path.join(ctx.src, COPILOT, "hooks", "hooks.json")
    if not os.path.isfile(path):
        return
    config = json.loads(read_text(path))
    claude: dict = {}
    for event, entries in config.get("hooks", {}).items():
        target = HOOK_EVENTS.get(event, event if event[:1].isupper() else None)
        if target is None:
            ctx.warn(f"hooks.json: イベント {event} に対応する Claude Code のイベントがないため外した")
            continue
        for entry in entries:
            kind = entry.get("type", "command")
            if kind != "command":
                ctx.warn(f"hooks.json: {event} の {kind} 型のフックは置き換えなかった（command 型だけ置き換える）")
                continue
            hook: dict = {"type": "command"}
            if "exec" in entry:
                hook["command"] = substitute_variables(entry["exec"])
                hook["args"] = substitute_variables(entry.get("args", []))
            else:
                command = entry.get("bash") or entry.get("command") or entry.get("powershell") or ""
                hook["command"] = substitute_variables(command)
                if not (entry.get("bash") or entry.get("command")) and entry.get("powershell"):
                    hook["shell"] = "powershell"
            timeout = entry.get("timeoutSec", entry.get("timeout"))
            if timeout is not None:
                hook["timeout"] = timeout
            if entry.get("env") or entry.get("cwd"):
                ctx.warn(f"hooks.json: {event} の env や cwd は移さなかった")
            group: dict = {"hooks": [hook]}
            matcher = entry.get("matcher")
            if matcher and event in TOOL_HOOK_EVENTS:
                group["matcher"] = "|".join(RUNTIME_TOOLS.get(t, t) for t in matcher.split("|"))
            elif matcher:
                group["matcher"] = matcher
            claude.setdefault(target, []).append(group)
    write_json(os.path.join(ctx.out, "hooks", "hooks.json"), {"hooks": claude})
    ctx.change(f"{COPILOT}/hooks/hooks.json -> hooks/hooks.json")


def convert_commands_and_lsp(ctx: Context) -> None:
    commands = os.path.join(ctx.src, COPILOT, "commands")
    if os.path.isdir(commands):
        shutil.copytree(commands, os.path.join(ctx.out, "commands"), dirs_exist_ok=True)
        ctx.change(f"{COPILOT}/commands -> commands")
        ctx.warn("commands: Copilot CLI のコマンドのファイルの形は公式の資料にないため、中身は置き換えず写しただけ（要確認）")
    lsp = os.path.join(ctx.src, COPILOT, "lsp.json")
    if os.path.isfile(lsp):
        write_json(os.path.join(ctx.out, ".lsp.json"), substitute_variables(json.loads(read_text(lsp))))
        ctx.change(f"{COPILOT}/lsp.json -> .lsp.json")


def convert_rules(ctx: Context) -> str | None:
    base = os.path.join(ctx.src, COPILOT, "rules")
    texts = []
    if os.path.isdir(base):
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames.sort()
            for file in sorted(filenames):
                if file.endswith(".md"):
                    texts.append(read_text(os.path.join(dirpath, file)).strip())
    if not texts:
        return None
    write_text(os.path.join(ctx.out, EVAL_DIR, "rules.md"), "\n\n".join(texts) + "\n")
    ctx.change(f"{COPILOT}/rules -> {EVAL_DIR}/rules.md（EVAL の課題の側で、指示として足す）")
    return f"{EVAL_DIR}/rules.md"


def list_extensions(src: str) -> list[str]:
    base = os.path.join(src, COPILOT, "extensions")
    if not os.path.isdir(base):
        return []
    return sorted(n for n in os.listdir(base) if os.path.isdir(os.path.join(base, n)))


# ---------------------------------------------------------------------------
# 検証と全体
# ---------------------------------------------------------------------------

def run_validate(out: str) -> dict:
    """claude plugin validate。警告は不合格にしない（終了コード 0 なら合格）。"""
    claude = shutil.which("claude")
    if not claude:
        return {"ran": False, "ok": False, "reason": "claude コマンドが見つからない"}
    try:
        done = subprocess.run([claude, "plugin", "validate", out], capture_output=True, text=True, encoding="utf-8",
                              timeout=VALIDATE_TIMEOUT_SEC)
    except subprocess.TimeoutExpired:
        return {"ran": True, "ok": False, "reason": f"{VALIDATE_TIMEOUT_SEC} 秒で終わらなかった"}
    output = (done.stdout + done.stderr)[:VALIDATE_OUTPUT_LIMIT]
    return {"ran": True, "ok": done.returncode == 0, "exit_code": done.returncode, "output": output}


def check_clean(out: str) -> None:
    """置き換えた版に、見せてはいけないものが入っていないことを確かめる（会話例、見ない模擬ユーザー）。"""
    for dirpath, dirnames, _ in os.walk(out):
        if "heldout" in dirnames:
            raise Refusal("置き換えた版に heldout が入っている。写さない決まりに反する")
    if os.path.exists(os.path.join(out, "examples")):
        raise Refusal("置き換えた版に examples（会話例）が入っている。外す決まりに反する")


def check_paths(src: str, out: str) -> None:
    real_src, real_out = os.path.realpath(src), os.path.realpath(out)
    if real_src == real_out or real_out.startswith(real_src + os.sep) or real_src.startswith(real_out + os.sep):
        raise Refusal("SRC と OUT が同じか、片方がもう片方の中にある")
    if os.path.lexists(out):
        if not os.path.isfile(os.path.join(out, EVAL_DIR, REPORT)):
            raise Refusal(f"OUT（{out}）がすでにあり、前の変換の出力ではない。消さずに断る")
        shutil.rmtree(out)


def convert(src: str, out: str, validate: bool = True) -> dict:
    """SRC を OUT に置き換えて、変換レポート（辞書）を返す。断るときは Refusal を投げる。"""
    src, out = os.path.abspath(src), os.path.abspath(out)
    manifest_path = os.path.join(src, "plugin.json")
    if not os.path.isfile(manifest_path):
        raise Refusal(f"{src} の直下に plugin.json がない")
    try:
        manifest = json.loads(read_text(manifest_path))
    except ValueError as error:
        raise Refusal(f"plugin.json を読めない: {error}")
    if not isinstance(manifest.get("name"), str) or not manifest["name"]:
        raise Refusal("plugin.json に name がない")
    check_paths(src, out)

    ctx = Context(src, out, manifest["name"], list_extensions(src))
    os.makedirs(out)
    copy_plugin_files(ctx)
    os.makedirs(os.path.join(out, EVAL_DIR), exist_ok=True)
    convert_manifest(ctx, manifest)
    convert_mcp(ctx)
    convert_agents(ctx)
    convert_skills(ctx)
    convert_hooks(ctx)
    convert_commands_and_lsp(ctx)
    rules_file = convert_rules(ctx)
    for ext in ctx.extensions:
        ctx.change(f"{COPILOT}/extensions/{ext}/ を外した（EVAL の仕組みが同じ中心の処理を MCP サーバー {server_name(ext)!r} のツールとして出す）")
    check_clean(out)

    report = {
        "plugin": ctx.plugin,
        "changes": ctx.changes,
        "warnings": ctx.warnings,
        "extensions": [{"name": e, "server": server_name(e)} for e in sorted(ctx.extensions)],
        "extension_tools": sorted(ctx.extension_tools.values(), key=lambda r: r["from"]),
        "agents": ctx.agents,
        "model_map": MODEL_MAP,
        "rules_file": rules_file,
        "validate": {"ran": False, "ok": None},
    }
    write_json(os.path.join(out, EVAL_DIR, REPORT), report)
    if validate:
        report["validate"] = run_validate(out)
        write_json(os.path.join(out, EVAL_DIR, REPORT), report)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Copilot CLI 向けのプラグインを、開発の試験のために Claude Code 向けに置き換える。")
    parser.add_argument("src", help="Copilot CLI 向けのプラグインのフォルダ")
    parser.add_argument("out", help="置き換えた版を書き出すフォルダ")
    parser.add_argument("--skip-validate", action="store_true", help="変換の直後の claude plugin validate を飛ばす")
    args = parser.parse_args(argv)
    try:
        report = convert(args.src, args.out, validate=not args.skip_validate)
    except Refusal as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 2
    check = report["validate"]
    ok = (not check["ran"] and args.skip_validate) or bool(check.get("ok"))
    summary = {
        "ok": ok,
        "out": os.path.abspath(args.out),
        "plugin": report["plugin"],
        "changes": len(report["changes"]),
        "warnings": report["warnings"],
        "validate": {k: v for k, v in check.items() if k != "output"},
    }
    if check.get("ran") and not check.get("ok"):
        summary["validate_output"] = check.get("output", "")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
