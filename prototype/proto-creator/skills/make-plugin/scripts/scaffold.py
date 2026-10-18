#!/usr/bin/env python3
"""Create a generated plugin (Copilot CLI / Agent Plugins 1.0.0 layout) from the template.

Usage: scaffold.py --name NAME --title TITLE --description DESC --knowledge-file FILE [--out DIR]
"""
import argparse
import json
import os
import re
import shutil
import sys

TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "template")
NAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$")


def valid_name(name):
    return bool(NAME_RE.match(name)) and "--" not in name and ".." not in name


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True, help="lowercase letters, digits, hyphens")
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", required=True, help="when to use the generated skill")
    parser.add_argument("--knowledge-file", required=True, help="Markdown list of the elicited knowledge")
    parser.add_argument("--out", help="output directory (default: ./<name>)")
    args = parser.parse_args()

    if not valid_name(args.name):
        print(f"名前が正しくありません: {args.name}（英小文字・数字・ハイフンで、64文字まで）", file=sys.stderr)
        return 2
    if len(args.description) > 1024:
        print("description は 1024 文字以内にしてください", file=sys.stderr)
        return 2
    with open(args.knowledge_file, encoding="utf-8") as f:
        knowledge = f.read().strip()
    if not knowledge:
        print("ナレッジのファイルが空です", file=sys.stderr)
        return 2
    out = os.path.abspath(args.out or args.name)
    if os.path.exists(out):
        print(f"出力先がすでにあります: {out}", file=sys.stderr)
        return 2

    shutil.copytree(TEMPLATE, out)
    os.rename(os.path.join(out, "skills", "_skill_"), os.path.join(out, "skills", args.name))

    manifest_path = os.path.join(out, "plugin.json")
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    manifest.update(name=args.name, description=args.description)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    skill_path = os.path.join(out, "skills", args.name, "SKILL.md")
    with open(skill_path, encoding="utf-8") as f:
        text = f.read()
    # A JSON string is also a valid YAML double-quoted scalar, so quotes and colons stay safe.
    for key, value in {"{{NAME}}": args.name, "{{DESCRIPTION_YAML}}": json.dumps(args.description, ensure_ascii=False),
                       "{{TITLE}}": args.title, "{{KNOWLEDGE}}": knowledge}.items():
        text = text.replace(key, value)
    with open(skill_path, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"生成プラグインを作りました: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
