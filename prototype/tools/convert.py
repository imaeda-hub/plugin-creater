#!/usr/bin/env python3
"""Convert a Copilot CLI plugin (Agent Plugins 1.0.0 + com.github.copilot/) into a Claude Code plugin for EVAL.

Usage: convert.py SRC OUT
Writes OUT/.eval/conversion-report.json with every change and warning, and OUT/.eval/rules.md
(the Copilot rules, to be appended to the system prompt by the EVAL runner).
"""
import json
import os
import re
import shutil
import sys

import yaml

# Copilot CLI runtime tool name -> Claude Code tool name (Copilot CLI hooks reference, "Claude-format matchers").
TOOLS = {"bash": "Bash", "powershell": "Bash", "view": "Read", "create": "Write", "edit": "Edit",
         "str_replace_editor": "Edit", "apply_patch": "Edit", "grep": "Grep", "rg": "Grep", "glob": "Glob",
         "web_fetch": "WebFetch", "web_search": "WebSearch", "ask_user": "AskUserQuestion",
         "update_todo": "TodoWrite", "task": "Agent", "skill": "Skill"}
# Custom agent tool aliases (Copilot custom agents configuration reference). Aliases are case-insensitive, and the
# Claude Code names (Read, Edit, Bash, ...) are accepted by Copilot CLI as compatible aliases.
ALIASES = {"execute": ["Bash"], "shell": ["Bash"], "bash": ["Bash"], "powershell": ["Bash"], "read": ["Read"],
           "notebookread": ["Read"], "edit": ["Edit", "Write"], "multiedit": ["Edit"], "write": ["Write"],
           "notebookedit": ["Edit"], "search": ["Grep", "Glob"], "grep": ["Grep"], "glob": ["Glob"],
           "agent": ["Agent"], "custom-agent": ["Agent"], "task": ["Agent"], "web": ["WebSearch", "WebFetch"],
           "websearch": ["WebSearch"], "webfetch": ["WebFetch"], "todo": ["TodoWrite"], "todowrite": ["TodoWrite"],
           "view": ["Read"], "create": ["Write"]}
# Names that never occur as ordinary words, so they are replaced anywhere in Markdown bodies.
UNIQUE = [name for name in TOOLS if "_" in name]
EVENTS = {"sessionStart": "SessionStart", "sessionEnd": "SessionEnd", "userPromptSubmitted": "UserPromptSubmit",
          "preToolUse": "PreToolUse", "postToolUse": "PostToolUse", "postToolUseFailure": "PostToolUseFailure",
          "agentStop": "Stop", "subagentStart": "SubagentStart", "subagentStop": "SubagentStop",
          "preCompact": "PreCompact", "notification": "Notification", "permissionRequest": "PermissionRequest"}
TOOL_EVENTS = {"preToolUse", "postToolUse", "postToolUseFailure", "permissionRequest"}
VARS = {"${PLUGIN_ROOT}": "${CLAUDE_PLUGIN_ROOT}", "${PLUGIN_DATA}": "${CLAUDE_PLUGIN_DATA}",
        "${COPILOT_PLUGIN_ROOT}": "${CLAUDE_PLUGIN_ROOT}", "${COPILOT_PLUGIN_DATA}": "${CLAUDE_PLUGIN_DATA}"}
MANIFEST_FIELDS = ["name", "version", "description", "author", "homepage", "repository", "license", "keywords"]
AGENT_DROP = ["infer", "mcp-servers", "models", "modelPolicy", "include-custom-instructions", "target",
              "disable-model-invocation", "user-invocable", "metadata"]
report = {"changes": [], "warnings": []}


def note(kind, text):
    report[kind].append(text)


def subst_vars(value):
    if isinstance(value, str):
        for old, new in VARS.items():
            value = value.replace(old, new)
        return value
    if isinstance(value, list):
        return [subst_vars(v) for v in value]
    if isinstance(value, dict):
        return {k: subst_vars(v) for k, v in value.items()}
    return value


def map_tool(name, where):
    if name in TOOLS:
        return TOOLS[name]
    note("warnings", f"{where}: ツール名 {name!r} に対応する Claude Code の名前がない（そのまま残した）")
    return name


def map_agent_tools(tools, plugin, where):
    """Copilot agent tools (aliases, runtime names, server/tool) -> Claude Code subagent tools."""
    mapped = []
    for tool in tools:
        if "/" in tool:
            server, _, name = tool.partition("/")
            mapped.append(f"mcp__plugin_{plugin}_{server}__{name}")
        elif tool.lower() in ALIASES:
            mapped.extend(ALIASES[tool.lower()])
        else:
            mapped.append(map_tool(tool, where))
    return list(dict.fromkeys(mapped))


def map_body(text):
    for name in UNIQUE:
        text = re.sub(rf"\b{name}\b", TOOLS[name], text)
    return re.sub(r"`([a-z_]+)`", lambda m: f"`{TOOLS.get(m.group(1), m.group(1))}`", text)


def map_model(model, where):
    for family in ("haiku", "sonnet", "opus", "fable"):
        if isinstance(model, str) and model.startswith(f"claude-{family}"):
            return family
    note("warnings", f"{where}: モデル {model!r} は Claude Code で使えないため inherit にした")
    return "inherit"


def split_frontmatter(text):
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not match:
        return None, text
    return yaml.safe_load(match.group(1)) or {}, match.group(2)


def join_frontmatter(meta, body):
    return "---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=1000) + "---\n" + body


def convert_manifest(src, out):
    with open(os.path.join(src, "plugin.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    claude = {k: manifest[k] for k in MANIFEST_FIELDS if k in manifest}
    for key in manifest:
        if key not in MANIFEST_FIELDS and key != "$schema":
            note("warnings", f"plugin.json: {key} は Claude Code のマニフェストに移さなかった")
    os.makedirs(os.path.join(out, ".claude-plugin"), exist_ok=True)
    with open(os.path.join(out, ".claude-plugin", "plugin.json"), "w", encoding="utf-8") as f:
        json.dump(claude, f, ensure_ascii=False, indent=2)
    note("changes", "plugin.json -> .claude-plugin/plugin.json")


def convert_mcp(src, out):
    path = os.path.join(src, "mcp.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        servers = json.load(f).get("mcpServers", {})
    claude = {}
    for name, server in servers.items():
        server = subst_vars(dict(server))
        server["type"] = {"stdio": "stdio", "streamable-http": "http", "sse": "sse"}.get(server.get("type"), server.get("type"))
        claude[name] = server
    with open(os.path.join(out, ".mcp.json"), "w", encoding="utf-8") as f:
        json.dump({"mcpServers": claude}, f, ensure_ascii=False, indent=2)
    note("changes", "mcp.json -> .mcp.json（${PLUGIN_ROOT} などを Claude Code の変数に置き換え）")


def convert_agents(src, out):
    base = os.path.join(src, "com.github.copilot", "agents")
    if not os.path.isdir(base):
        return
    with open(os.path.join(src, "plugin.json"), encoding="utf-8") as f:
        plugin = json.load(f)["name"]
    for root, _, files in os.walk(base):
        for file in sorted(files):
            if not file.endswith(".md"):
                continue
            rel = os.path.relpath(os.path.join(root, file), base)
            agent_id = re.sub(r"(\.agent)?\.md$", "", rel).replace(os.sep, "--")
            with open(os.path.join(root, file), encoding="utf-8") as f:
                meta, body = split_frontmatter(f.read())
            where = f"agents/{rel}"
            if meta is None:
                note("warnings", f"{where}: フロントマターがないため移さなかった")
                continue
            claude = {"name": meta.get("name") or agent_id, "description": meta.get("description", "")}
            tools = meta.get("tools")
            if tools and "*" not in tools:
                claude["tools"] = ", ".join(map_agent_tools(tools, plugin, where))
            if meta.get("model") or meta.get("models"):
                claude["model"] = map_model(meta.get("model") or meta["models"][0], where)
            if meta.get("reasoningEffort"):
                claude["effort"] = meta["reasoningEffort"]
            for key in meta:
                if key in AGENT_DROP:
                    note("warnings", f"{where}: {key} は Claude Code のサブエージェントにないため外した")
            os.makedirs(os.path.join(out, "agents"), exist_ok=True)
            with open(os.path.join(out, "agents", agent_id + ".md"), "w", encoding="utf-8") as f:
                f.write(join_frontmatter(claude, map_body(body)))
            note("changes", f"{where} -> agents/{agent_id}.md")


def convert_hooks(src, out):
    path = os.path.join(src, "com.github.copilot", "hooks", "hooks.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        config = json.load(f)
    claude = {}
    for event, entries in config.get("hooks", {}).items():
        target = EVENTS.get(event, event if event[:1].isupper() else None)
        if target is None:
            note("warnings", f"hooks.json: イベント {event} に対応する Claude Code のイベントがないため外した")
            continue
        for entry in entries:
            hook = {"type": "command"}
            if "exec" in entry:
                hook["command"] = subst_vars(entry["exec"])
                hook["args"] = subst_vars(entry.get("args", []))
            else:
                hook["command"] = subst_vars(entry.get("bash") or entry.get("command") or "")
            if "timeoutSec" in entry:
                hook["timeout"] = entry["timeoutSec"]
            if entry.get("env") or entry.get("cwd"):
                note("warnings", f"hooks.json: {event} の env や cwd は移さなかった")
            group = {"hooks": [hook]}
            matcher = entry.get("matcher")
            if matcher and event in TOOL_EVENTS:
                group["matcher"] = "|".join(map_tool(t, "hooks.json") for t in matcher.split("|"))
            elif matcher:
                group["matcher"] = matcher
            claude.setdefault(target, []).append(group)
    os.makedirs(os.path.join(out, "hooks"), exist_ok=True)
    with open(os.path.join(out, "hooks", "hooks.json"), "w", encoding="utf-8") as f:
        json.dump({"hooks": claude}, f, ensure_ascii=False, indent=2)
    note("changes", "com.github.copilot/hooks/hooks.json -> hooks/hooks.json")


def convert_skills(out):
    base = os.path.join(out, "skills")
    if not os.path.isdir(base):
        return
    for name in sorted(os.listdir(base)):
        path = os.path.join(base, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        with open(path, encoding="utf-8") as f:
            meta, body = split_frontmatter(f.read())
        if meta is None:
            continue
        tools = meta.get("allowed-tools")
        if tools:
            items = tools if isinstance(tools, list) else re.split(r"[,\s]+", tools.strip())
            meta["allowed-tools"] = ", ".join(map_tool(t, f"skills/{name}") for t in items if t)
        mapped = map_body(body)
        if mapped != body or tools:
            note("changes", f"skills/{name}/SKILL.md のツール名を置き換え")
        with open(path, "w", encoding="utf-8") as f:
            f.write(join_frontmatter(meta, mapped))


def copy_rest(src, out):
    def ignore(directory, names):
        if os.path.abspath(directory) == os.path.abspath(src):
            return [n for n in names if n in ("plugin.json", "mcp.json", "com.github.copilot", ".eval")]
        return []
    shutil.copytree(src, out, ignore=ignore)
    copilot = os.path.join(src, "com.github.copilot")
    for sub, dest in (("commands", "commands"),):
        if os.path.isdir(os.path.join(copilot, sub)):
            shutil.copytree(os.path.join(copilot, sub), os.path.join(out, dest), dirs_exist_ok=True)
            note("changes", f"com.github.copilot/{sub} -> {dest}")
    if os.path.exists(os.path.join(copilot, "lsp.json")):
        with open(os.path.join(copilot, "lsp.json"), encoding="utf-8") as f:
            lsp = subst_vars(json.load(f))
        with open(os.path.join(out, ".lsp.json"), "w", encoding="utf-8") as f:
            json.dump(lsp, f, ensure_ascii=False, indent=2)
        note("changes", "com.github.copilot/lsp.json -> .lsp.json")


def collect_rules(src, out):
    base = os.path.join(src, "com.github.copilot", "rules")
    texts = []
    if os.path.isdir(base):
        for root, _, files in os.walk(base):
            for file in sorted(files):
                if file.endswith(".md"):
                    with open(os.path.join(root, file), encoding="utf-8") as f:
                        texts.append(f.read().strip())
    with open(os.path.join(out, ".eval", "rules.md"), "w", encoding="utf-8") as f:
        f.write("\n\n".join(texts))
    if texts:
        note("changes", "com.github.copilot/rules -> .eval/rules.md（EVAL の実行時にシステムプロンプトへ足す）")


def main():
    src, out = (os.path.abspath(p) for p in sys.argv[1:3])
    if os.path.exists(out):
        shutil.rmtree(out)
    copy_rest(src, out)
    os.makedirs(os.path.join(out, ".eval"), exist_ok=True)
    convert_manifest(src, out)
    convert_mcp(src, out)
    convert_agents(src, out)
    convert_hooks(src, out)
    convert_skills(out)
    collect_rules(src, out)
    with open(os.path.join(out, ".eval", "conversion-report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    for text in report["warnings"]:
        print("warning:", text)
    print(f"converted: {len(report['changes'])} changes, {len(report['warnings'])} warnings -> {out}")


if __name__ == "__main__":
    main()
