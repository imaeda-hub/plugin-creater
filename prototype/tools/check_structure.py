#!/usr/bin/env python3
"""Level 1 (structure check) for a Copilot CLI plugin in the Agent Plugins 1.0.0 layout.

Usage: check_structure.py PLUGIN_DIR   -> prints a JSON report; exit 1 when there are errors.
Uses local copies of the official schemas (clients must not fetch schemas while loading).
"""
import json
import os
import re
import sys

import jsonschema
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
PLUGIN_SCHEMA_ID = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
MCP_SCHEMA_ID = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json"
# Custom agent frontmatter fields: the Copilot CLI command reference and the custom agents configuration reference
# list slightly different sets, so both are accepted.
AGENT_FIELDS = {"description", "include-custom-instructions", "infer", "mcp-servers", "model", "models",
                "modelPolicy", "name", "reasoningEffort", "tools",
                "target", "disable-model-invocation", "user-invocable", "metadata"}
AGENT_PROMPT_MAX = 30000
HOOK_EVENTS = {"sessionStart", "sessionEnd", "userPromptSubmitted", "userPromptTransformed", "preToolUse",
               "postToolUse", "postToolUseFailure", "agentStop", "subagentStart", "subagentStop",
               "errorOccurred", "preCompact", "permissionRequest", "notification",
               "SessionStart", "SessionEnd", "UserPromptSubmit", "PreToolUse", "PostToolUse",
               "PostToolUseFailure", "Stop", "SubagentStop", "ErrorOccurred", "PreCompact", "PermissionRequest"}
SKILL_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
errors, warnings = [], []


def load_schema(name):
    with open(os.path.join(HERE, "schemas", "1.0.0", name), encoding="utf-8") as f:
        return json.load(f)


def read_json(path, label):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        errors.append(f"{label}: JSON として読めない（{e}）")
        return None


def schema_errors(instance, schema, label):
    for e in jsonschema.Draft202012Validator(schema).iter_errors(instance):
        where = "/".join(str(p) for p in e.absolute_path) or "(root)"
        errors.append(f"{label}: {where}: {e.message}")


def frontmatter(path, label):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        errors.append(f"{label}: フロントマターがない")
        return None
    try:
        meta = yaml.safe_load(match.group(1))
    except yaml.YAMLError as e:
        errors.append(f"{label}: フロントマターが YAML として読めない（{e}）")
        return None
    if not isinstance(meta, dict):
        errors.append(f"{label}: フロントマターが項目の集まりになっていない")
        return None
    return meta


def check_manifest(root):
    manifest = read_json(os.path.join(root, "plugin.json"), "plugin.json")
    if manifest is None:
        return
    if manifest.get("$schema") != PLUGIN_SCHEMA_ID:
        errors.append(f"plugin.json: $schema が {PLUGIN_SCHEMA_ID} ではない")
    schema_errors(manifest, load_schema("plugin.schema.json"), "plugin.json")
    name = manifest.get("name", "")
    if not re.match(r"^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$", name) or "--" in name or ".." in name:
        errors.append(f"plugin.json: name {name!r} が命名の決まりに合わない")


def check_mcp(root):
    path = os.path.join(root, "mcp.json")
    if not os.path.exists(path):
        return
    config = read_json(path, "mcp.json")
    if config is None:
        return
    if config.get("$schema") != MCP_SCHEMA_ID:
        errors.append("mcp.json: $schema が plugin.json と同じ版（1.0.0）ではない")
    schema_errors(config, load_schema("mcp.schema.json"), "mcp.json")
    for name, server in (config.get("mcpServers") or {}).items():
        if server.get("type") == "stdio":
            for arg in server.get("args", []):
                if "${PLUGIN_ROOT}/" in arg:
                    target = os.path.join(root, arg.split("${PLUGIN_ROOT}/", 1)[1])
                    if not os.path.exists(target):
                        errors.append(f"mcp.json: {name} の {arg} が見つからない")


def check_skills(root):
    base = os.path.join(root, "skills")
    if not os.path.isdir(base):
        warnings.append("skills/ がない")
        return
    for name in sorted(os.listdir(base)):
        path = os.path.join(base, name, "SKILL.md")
        if not os.path.isfile(path):
            continue
        label = f"skills/{name}/SKILL.md"
        meta = frontmatter(path, label)
        if meta is None:
            continue
        skill_name, description = meta.get("name"), meta.get("description")
        if not isinstance(skill_name, str) or not SKILL_NAME.match(skill_name) or len(skill_name) > 64:
            errors.append(f"{label}: name {skill_name!r} が Agent Skills の決まりに合わない")
        elif skill_name != name:
            errors.append(f"{label}: name {skill_name!r} がフォルダ名 {name!r} と違う")
        if not isinstance(description, str) or not description.strip():
            errors.append(f"{label}: description がない")
        elif len(description) > 1024:
            errors.append(f"{label}: description が 1024 文字を超える")


def check_agents(root):
    base = os.path.join(root, "com.github.copilot", "agents")
    if not os.path.isdir(base):
        return
    for file in sorted(os.listdir(base)):
        if not file.endswith(".md"):
            continue
        label = f"com.github.copilot/agents/{file}"
        meta = frontmatter(os.path.join(base, file), label)
        if meta is None:
            continue
        if not isinstance(meta.get("description"), str) or not meta["description"].strip():
            errors.append(f"{label}: description がない")
        for key in meta:
            if key not in AGENT_FIELDS:
                warnings.append(f"{label}: {key} は公式ドキュメントにない項目")
        tools = meta.get("tools")
        if tools is not None and not isinstance(tools, str) and (not isinstance(tools, list) or not all(isinstance(t, str) for t in tools)):
            errors.append(f"{label}: tools が文字列、または文字列のリストではない")
        with open(os.path.join(base, file), encoding="utf-8") as f:
            body = f.read().split("\n---\n", 1)[-1]
        if len(body) > AGENT_PROMPT_MAX:
            errors.append(f"{label}: 本文が {AGENT_PROMPT_MAX} 文字を超える")


def check_hooks(root):
    path = os.path.join(root, "com.github.copilot", "hooks", "hooks.json")
    if not os.path.exists(path):
        return
    config = read_json(path, "hooks.json")
    if config is None:
        return
    if config.get("version") != 1:
        errors.append("hooks.json: version が 1 ではない")
    hooks = config.get("hooks")
    if not isinstance(hooks, dict):
        errors.append("hooks.json: hooks が項目の集まりになっていない")
        return
    for event, entries in hooks.items():
        if event not in HOOK_EVENTS:
            errors.append(f"hooks.json: {event} は公式ドキュメントにないイベント")
        if not isinstance(entries, list):
            errors.append(f"hooks.json: {event} がリストではない")
            continue
        for i, entry in enumerate(entries):
            if entry.get("type", "command") == "command" and not any(k in entry for k in ("bash", "command", "powershell", "exec")):
                errors.append(f"hooks.json: {event}[{i}] に実行するコマンドがない")


def main():
    root = os.path.abspath(sys.argv[1])
    check_manifest(root)
    check_mcp(root)
    check_skills(root)
    check_agents(root)
    check_hooks(root)
    print(json.dumps({"plugin": root, "ok": not errors, "errors": errors, "warnings": warnings},
                     ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
