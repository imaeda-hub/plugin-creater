#!/usr/bin/env python3
"""クリエイター自身の1・2段目を、1つのコマンドで動かす入口。

使い方（リポジトリの根で）:
    python3 tests/creator/run.py [--json] [--results ファイル]

生成プラグインの入口（template/tests/run.py）と同じ部品（道具の確かめ、node:test、unittest、結果のファイル、終了コード）を
読み込んで使い、クリエイターの試験の場所を探して並べる。

  1段目  tests/creator/check_creator.py（ひな形の構造の検査に、SKILL.md の大きさと会話例の版を足したもの）
  2段目  tests/creator/ と tests/dev-eval/ の下の
           *.test.mjs   → node --test（Node.js の試験。ブラウザーを使うものは Playwright が要る）
           test_*.py    → unittest（見つけたフォルダごと）
         見本や写しのフォルダ（sample、samples、fixture-template、fixtures）、node_modules、.venv、
         heldout（クリエイターを直すときに見ない模擬ユーザーのフォルダ。中を読まない）は探さない。

フォルダは探して動かすので、新しい試験のフォルダを tests/creator/ の下に足しても、この入口は変えなくてよい。
段階ごとの合否と、不合格の試験とその理由を出し、同じ内容を tests/results/latest.json にも書く。
終了コード: 0 合格、1 不合格あり、2 道具が足りなくて止まった。モデルは使わない。

必要な道具: Python 3.9 以上と PyYAML・jsonschema・tiktoken、Node.js、tests/dev-eval の npm の部品
（tests/dev-eval で `npm install --ignore-scripts`）、画面の試験のための Playwright とブラウザー。
Playwright は、tests/node_modules に入れる（`npm install --prefix tests --no-save --no-package-lock playwright@1.56.1`）。
開発の環境では、別のフォルダに入れたものを環境変数 NODE_PATH で指定してもよい（試験が自分で探す）。
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
TEMPLATE_RUN = os.path.join(REPO, "template", "tests", "run.py")
CHECK_CREATOR = os.path.join(HERE, "check_creator.py")

SEARCH_ROOTS = (("tests", "creator"), ("tests", "dev-eval"))
DEV_EVAL = os.path.join("tests", "dev-eval")
PRUNE = {"node_modules", ".venv", ".git", "__pycache__", "heldout", "sample", "samples", "fixture-template", "fixtures"}


def load_template_run() -> Any:
    spec = importlib.util.spec_from_file_location("template_run", TEMPLATE_RUN)
    module = importlib.util.module_from_spec(spec)
    sys.modules["template_run"] = module
    spec.loader.exec_module(module)
    return module


tr = load_template_run()


def discover(root: str) -> Tuple[List[str], List[str]]:
    """(node の試験のファイル, unittest のフォルダ)。クリエイターの試験の場所を、フォルダを歩いて探す。"""
    node_files: List[str] = []
    python_dirs: List[str] = []
    for parts in SEARCH_ROOTS:
        base = os.path.join(root, *parts)
        for directory, dirs, files in os.walk(base):
            dirs[:] = sorted(d for d in dirs if d not in PRUNE)
            node_files += [os.path.join(directory, f) for f in sorted(files) if f.endswith(".test.mjs")]
            if any(f.startswith("test_") and f.endswith(".py") for f in files):
                python_dirs.append(directory)
    return node_files, python_dirs


# ---------------------------------------------------------------- 道具

def node_path_dirs() -> List[str]:
    return [d for d in os.environ.get("NODE_PATH", "").split(os.pathsep) if d]


def playwright_in_node_path() -> Tuple[bool, str]:
    """開発の環境の補い：ES モジュールの import は NODE_PATH を見ないので、試験は NODE_PATH の Playwright を自分で探す。同じ探し方をする。"""
    for directory in node_path_dirs():
        if os.path.isdir(os.path.join(directory, "playwright")):
            return True, "NODE_PATH の " + directory
    return False, ""


def chromium_in_node_path() -> Tuple[bool, str]:
    node = shutil.which("node")
    script = ("const fs = require('fs'); const {chromium} = require(process.argv[1]); "
              "process.exit(fs.existsSync(chromium.executablePath()) ? 0 : 1)")
    for directory in node_path_dirs():
        target = os.path.join(directory, "playwright")
        if node and os.path.isdir(target):
            try:
                if subprocess.run([node, "-e", script, target], capture_output=True, timeout=60).returncode == 0:
                    return True, "NODE_PATH の Playwright の Chromium"
            except (OSError, subprocess.SubprocessError):
                pass
    return False, ""


def dev_eval_modules(root: str) -> Dict[str, Any]:
    """tests/dev-eval の npm の部品（package.json の dependencies）が入っているか。"""
    base = os.path.join(root, DEV_EVAL)
    try:
        with open(os.path.join(base, "package.json"), encoding="utf-8") as f:
            names = sorted(json.load(f).get("dependencies", {}))
    except (OSError, ValueError):
        names = []
    missing = [n for n in names if not os.path.isfile(os.path.join(base, "node_modules", *n.split("/"), "package.json"))]
    return {"id": "dev-eval-npm", "name": "tests/dev-eval の npm の部品", "ok": not missing,
            "found": "足りない: " + "、".join(missing) if missing else "",
            "howToInstall": "tests/dev-eval で `npm install --ignore-scripts` を実行する（node_modules は git に入れない）"}


def creator_tools(root: str, node_files: List[str]) -> List[Dict[str, Any]]:
    needs = ["python", "pyyaml", "jsonschema", "tiktoken"]
    probe_dir = HERE
    dev_eval_prefix = os.path.join(root, DEV_EVAL) + os.sep
    if node_files:
        needs.append("node")
        for path in node_files:   # dev-eval の試験は、自分の node_modules の Playwright を使うので、ここでは数えない
            if not path.startswith(dev_eval_prefix) and tr.imports_playwright(path):
                needs += ["playwright", "browser"]
                probe_dir = os.path.dirname(path)
                break
    items = tr.check_tools(needs, probe_dir)
    for item in items:   # NODE_PATH に置いた Playwright でも、試験は動く
        if not item["ok"] and item["id"] == "playwright":
            item["ok"], item["found"] = playwright_in_node_path()
        elif not item["ok"] and item["id"] == "browser":
            item["ok"], item["found"] = chromium_in_node_path()
    if any(p.startswith(dev_eval_prefix) for p in node_files):
        items.append(dev_eval_modules(root))
    return items


# ---------------------------------------------------------------- 入口

def run(root: str, stage1_script: str, results_path: str) -> Dict[str, Any]:
    node_files, python_dirs = discover(root)
    note = "試験なし（tests/creator と tests/dev-eval に *.test.mjs も test_*.py もない）"
    return tr.run_with(root, creator_tools(root, node_files), results_path, lambda: [
        tr.run_stage1(root, stage1_script),
        tr.run_stage2_tests(root, node_files, python_dirs, note),
    ])


def main(argv: Optional[List[str]] = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="クリエイター自身の1・2段目を1つのコマンドで動かす入口")
    parser.add_argument("--root", default=REPO, help="クリエイターのフォルダ（既定はこのリポジトリ。試験の試験のために変えられる）")
    parser.add_argument("--results", help="結果を書くファイル（既定は <root>/tests/results/latest.json）")
    parser.add_argument("--stage1-script", default=CHECK_CREATOR, help="1段目のスクリプト（`<root> --json` で動き、JSON を出すもの）")
    parser.add_argument("--json", action="store_true", help="結果を JSON で標準出力に出す")
    args = parser.parse_args(argv)
    root = os.path.abspath(args.root)
    results = os.path.abspath(args.results or os.path.join(root, "tests", "results", "latest.json"))
    result = run(root, os.path.abspath(args.stage1_script), results)
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else tr.format_text(result))
    return result["exitCode"]


if __name__ == "__main__":
    sys.exit(main())
