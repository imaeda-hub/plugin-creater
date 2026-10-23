#!/usr/bin/env python3
"""生成プラグインの組み立て（build）と、土台がひな形と同じかの確かめ（check-base）。

使い方（標準出力には JSON を1つだけ出す）:

  python3 scaffold.py build --hearing <state.json> --work <作業フォルダ>/.plugin-creator-work --out <作業フォルダ>/<名前>
  python3 scaffold.py check-base --out <生成プラグインのフォルダ> [--restore]

build がすること（creator-structure.md 2章・4.1、BLUEPRINT 8章・9章）
  1. 入力を確かめる。ヒアリングの記録の段階が「生成」で、承認の時刻があること（生成前の確認の関門。hearing.md 6.3）。
     parts/ の形。--out がまだないフォルダで、作業フォルダの中にあること（REQ-021、REQ-036）。足りないときは断る。
  2. ひな形（このスクリプトから見て ../assets/template/）を --out に写し、_plugin_ と _entry_ の名前を変える。
     作業エージェントが2体以上なら、worker.agent.md から worker-<名前>.agent.md を作る。
  3. 差し込み口 {{slot:名前}} を parts/slots/名前.md の文で置き換え、そのあとで決まった値 {{plugin_name}} などを入れる。
     埋まらない差し込み口が残ったら断り、どの差し込み口かを示す。
  4. 作業の定義（task.json）に、合否の決め方のナレッジから合否の基準を書き込む（番号は C-01 から。文はナレッジのまま）。
  5. ナレッジの一覧（tests/knowledge.json）を書く。
  6. parts/files/ を写し、EVAL の課題（tests/eval/*/eval.json）の基準の番号と文を、作業の定義の写しで埋める。
  7. 土台がひな形と同じかを確かめる（check-base と同じ）。
  8. git のリポジトリにして、最初のコミットをする。
  9. 作業用の一時フォルダ（.plugin-creator-work/）を消す。
 10. 作ったフォルダと結果を JSON で出す。
     断ったとき・失敗したときは {"ok": false, "problems": [平易な日本語の文, ...]} を出し、終了コードを 1 にし、
     途中まで作ったフォルダは消す（作業用の一時フォルダは、直して作り直せるよう残す）。

check-base
  土台のファイル（ひな形の extensions/_plugin_/ にあるもの。extension.mjs、adapter.mjs、core/、ui/）が、
  ひな形と中身が同じかを比べ、違うファイルを示す。--restore で、ひな形から入れ直す（creator-structure.md 4.1）。

終了コード: 0 成功、1 断った・失敗した（違いが残っている）、2 使い方の誤り。
Python 3.9 以上で動く。PyYAML と jsonschema がなくても動く（jsonschema があれば task.json の形も確かめる）。
"""
from __future__ import annotations

import sys

sys.dont_write_bytecode = True   # スキルのフォルダやひな形に __pycache__ を作らない

if sys.version_info < (3, 9):
    sys.stderr.write("Python 3.9 以上が要ります（今は %s）。\n" % sys.version.split()[0])
    raise SystemExit(2)

import argparse  # noqa: E402
import datetime  # noqa: E402
import importlib.util  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import re  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
from typing import Any, Callable, Dict, List, Optional, Set, Tuple  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_TEMPLATE = os.path.normpath(os.path.join(HERE, "..", "assets", "template"))
CHECKS_PATH = os.path.join(DEFAULT_TEMPLATE, "tests", "stage1", "check_structure.py")   # task.json の形の誤りを日本語で示すのに使う

WORK_NAME = ".plugin-creator-work"                    # 作業用の一時フォルダの名前（ユーザーの答え7）
EXT_PARENT = ("com.github.copilot", "extensions")
EXT_PLACEHOLDER = "_plugin_"                          # ひな形のエクステンションのフォルダ。生成プラグインの名前にする
ENTRY_PLACEHOLDER = "_entry_"                         # ひな形の入口のスキルのフォルダ。入口のスキルの名前にする
AGENTS_REL = "com.github.copilot/agents"
WORKER_FILE = "worker.agent.md"
SKIP_NAMES = {"__pycache__", ".git", "node_modules", ".venv", ".DS_Store"}   # ひな形から写さない・比べないもの

NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")          # プラグインとスキルの名前（R3 の勧め：a-z0-9 とハイフン）
WORKER_RE = re.compile(r"^worker(?:-[a-z0-9]+)*$")           # worker か worker-<名前>（task.schema.json と同じ）
KNOWLEDGE_ID = re.compile(r"^K-[0-9]+$")
TOOL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]*$")      # extra_tools の各要素（サーバー名/ツール名 など）
PLACEHOLDER = re.compile(r"(?<!\$)\{\{(slot:)?([A-Za-z][A-Za-z0-9_.-]*)\}\}")   # ${{…}}（シェルなどの書き方）は差し込み口にしない
SLOT_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]*$")
WORKER_SLOT = re.compile(r"\{\{slot:worker-task(?:\.[A-Za-z0-9._-]*)?\}\}")
EVAL_REL = re.compile(r"^tests/eval/[^/]+/eval\.json$")
YAML_PLAIN = re.compile(r"^[A-Za-z][A-Za-z0-9._-]*$")        # 引用符なしで YAML に置いてよい値
YAML_RESERVED = {"y", "n", "yes", "no", "true", "false", "on", "off", "null"}   # YAML が真偽や null に読む言葉

# ヒアリングの記録（C1 のエクステンション。names.mjs）の記号。日本語の名前でも読めるようにしておく
STAGE_GENERATE = ("generate", "生成")
STATUS_DECIDED = ("decided", "決まった")
KIND_ALIASES = {"criterion": "criterion", "合否の決め方": "criterion", "other": "other", "それ以外": "other"}

MANIFEST_KEYS = ("plugin_name", "plugin_description", "entry_skill", "workers", "verifier", "orchestrator")
DESCRIPTION_MAX = 1024

# tools の作業ごとの分を入れる差し込み口（B2 のひな形の名前に合わせる。BLUEPRINT 8章に名前の決まりはない）
TOOL_TOKENS = {"orchestrator": "orchestrator_extra_tools", "worker": "worker_extra_tools", "verifier": "verifier_extra_tools"}

FALLBACK_GIT_NAME = "plugin-creator"
FALLBACK_GIT_EMAIL = "plugin-creator@localhost"


class Refusal(Exception):
    """組み立てを断る。problems は、何が足りないかを書いた平易な日本語の文の一覧。"""

    def __init__(self, problems: Any) -> None:
        if isinstance(problems, str):
            problems = [problems]
        super().__init__("\n".join(problems))
        self.problems: List[str] = list(problems)


# ---------------------------------------------------------------- 小さな部品

def show(value: Any, limit: int = 60) -> str:
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def real(path: str) -> str:
    return os.path.normcase(os.path.realpath(os.path.abspath(path)))


def is_inside(path: str, base: str) -> bool:
    """path が base の中にある（base 自身は含まない）。シンボリックリンクをたどった本当の場所で比べる。"""
    p, b = real(path), real(base)
    try:
        return p != b and os.path.commonpath([p, b]) == b
    except ValueError:   # ドライブが違う
        return False


def posix_rel(path: str, base: str) -> str:
    return os.path.relpath(path, base).replace(os.sep, "/")


def json_text(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def json_escape(value: str) -> str:
    """JSON の文字列の中に置ける形（前後の二重引用符なし）。YAML の二重引用符の中にも置ける。"""
    return json.dumps(value, ensure_ascii=False)[1:-1]


def write_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def read_json(path: str, label: str, problems: List[str]) -> Any:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        problems.append("%s がありません。" % label)
    except (OSError, UnicodeDecodeError) as e:
        problems.append("%s を読めません（%s）。" % (label, e))
    except ValueError as e:
        problems.append("%s が JSON として読めません（%s）。" % (label, e))
    return None


def make_ignore(template: str) -> Callable[[str, List[str]], Set[str]]:
    """ひな形を写すとき・比べるときに飛ばすもの（キャッシュ、道具、試験の結果）。"""
    tests_dir = os.path.normpath(os.path.join(template, "tests"))

    def ignore(directory: str, names: List[str]) -> Set[str]:
        skipped = {n for n in names if n in SKIP_NAMES or n.endswith(".pyc")}
        if os.path.normpath(directory) == tests_dir and "results" in names:
            skipped.add("results")
        return skipped

    return ignore


# ---------------------------------------------------------------- 入力：ヒアリングの記録

def load_state(path: str) -> Dict[str, Any]:
    """ヒアリングの記録を読み、生成前の確認の関門（段階が「生成」で、承認の時刻がある）を確かめる。"""
    problems: List[str] = []
    state = read_json(path, "ヒアリングの記録（%s）" % path, problems)
    if problems:
        raise Refusal(problems)
    if not isinstance(state, dict):
        raise Refusal("ヒアリングの記録（%s）の形が違います（項目の集まりではありません）。" % path)
    if state.get("stage") not in STAGE_GENERATE:
        raise Refusal(
            "ヒアリングの記録の段階が「生成」ではありません（今は %s）。生成前の確認でユーザーがよいと答え、"
            "記録のツールで段階を「生成」に進めてから、組み立ててください。" % show(state.get("stage")))
    approved = state.get("approvedAt")
    if not isinstance(approved, str) or not approved.strip():
        raise Refusal("ヒアリングの記録に承認の時刻（approvedAt）がありません。ユーザーが生成前の確認でよいと答える前には、組み立てられません。")
    return state


def decided_knowledge(state: Dict[str, Any], problems: List[str]) -> List[Dict[str, str]]:
    """状態が「決まった」のナレッジを、記録の順に返す。候補と外したものは入れない。"""
    rows = state.get("knowledge")
    if rows is None:
        rows = []
    if not isinstance(rows, list):
        problems.append("ヒアリングの記録の knowledge が一覧ではありません。")
        return []
    found: List[Dict[str, str]] = []
    seen: Set[str] = set()
    for index, row in enumerate(rows, 1):
        if not isinstance(row, dict) or row.get("status") not in STATUS_DECIDED:
            continue
        where = "ヒアリングの記録のナレッジ（%d 件目）" % index
        ident = row.get("id")
        if not isinstance(ident, str) or not KNOWLEDGE_ID.match(ident):
            problems.append("%sの番号 %s が K-数字 の形ではありません。" % (where, show(ident)))
            continue
        where = "ナレッジ %s" % ident
        kind = KIND_ALIASES.get(row.get("kind")) if isinstance(row.get("kind"), str) else None
        if kind is None:
            problems.append("%sの種類 %s は、合否の決め方（criterion）かそれ以外（other）のどちらかにしてください。" % (where, show(row.get("kind"))))
            continue
        text = row.get("text")
        if not isinstance(text, str) or not text.strip():
            problems.append("%sの文が空です。" % where)
            continue
        if ident in seen:
            problems.append("%sの番号が重なっています。" % where)
            continue
        seen.add(ident)
        item = row.get("itemName")
        if not isinstance(item, str) or not item.strip():
            item = row.get("item") if isinstance(row.get("item"), str) else ""
        found.append({"id": ident, "kind": kind, "item": item, "text": text})
    return found


def make_criteria(knowledge: List[Dict[str, str]], problems: List[str]) -> List[Dict[str, str]]:
    """合否の決め方のナレッジから、合否の基準を作る。番号は C-01 から。文はナレッジの文のまま（ユーザーの答え4）。"""
    criteria = [
        {"id": "C-%02d" % number, "text": row["text"], "knowledge": row["id"]}
        for number, row in enumerate((r for r in knowledge if r["kind"] == "criterion"), 1)
    ]
    if not criteria:
        problems.append("ヒアリングの記録に、状態が「決まった」の合否の決め方のナレッジが1件もありません。"
                        "作業の定義の合否の基準は、これをもとに作るので、1件以上が要ります。")
    return criteria


# ---------------------------------------------------------------- 入力：parts/

def check_description(value: Any, label: str, problems: List[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        problems.append("%s が空か、文字ではありません。" % label)
    elif "\n" in value or "\r" in value:
        problems.append("%s は1行で書いてください。" % label)
    elif len(value) > DESCRIPTION_MAX:
        problems.append("%s は %d 文字以内にしてください（今は %d 文字）。" % (label, DESCRIPTION_MAX, len(value)))


def check_tools(value: Any, label: str, problems: List[str]) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        problems.append("%s は、ツールの名前の一覧にしてください。" % label)
        return []
    tools: List[str] = []
    for tool in value:
        if isinstance(tool, str) and TOOL_RE.match(tool):
            tools.append(tool)
        else:
            problems.append("%s の %s は、ツールの名前として使えません（英数字と . _ : / - だけ。例：サーバー名/ツール名）。" % (label, show(tool)))
    return tools


def load_manifest(work: str, problems: List[str]) -> Optional[Dict[str, Any]]:
    """parts/manifest.json（組み立ての設定。BLUEPRINT 8章）を確かめて、使いやすい形にする。"""
    label = "組み立ての設定（parts/manifest.json）"
    data = read_json(os.path.join(work, "parts", "manifest.json"), label, problems)
    if data is None:
        return None
    if not isinstance(data, dict):
        problems.append("%s の形が違います（項目の集まりではありません）。" % label)
        return None
    before = len(problems)
    unknown = [k for k in data if k not in MANIFEST_KEYS]
    if unknown:
        problems.append("%s に知らない項目があります：%s。使える項目：%s。" % (label, "、".join(unknown), "、".join(MANIFEST_KEYS)))

    name = data.get("plugin_name")
    if not isinstance(name, str) or not NAME_RE.match(name) or len(name) > 64:
        problems.append("%s の plugin_name は、小文字の英数字とハイフンだけの64文字以内の名前にしてください（今は %s）。" % (label, show(name)))
        name = None
    check_description(data.get("plugin_description"), "%s の plugin_description" % label, problems)

    entry = data.get("entry_skill")
    entry_name = entry_description = None
    if not isinstance(entry, dict):
        problems.append("%s の entry_skill は、name と description を持つ項目の集まりにしてください。" % label)
    else:
        extra = [k for k in entry if k not in ("name", "description")]
        if extra:
            problems.append("%s の entry_skill に知らない項目があります：%s。" % (label, "、".join(extra)))
        entry_name = entry.get("name")
        if not isinstance(entry_name, str) or not NAME_RE.match(entry_name) or len(entry_name) > 64:
            problems.append("%s の entry_skill.name は、小文字の英数字とハイフンだけの64文字以内の名前にしてください（今は %s）。" % (label, show(entry_name)))
            entry_name = None
        entry_description = entry.get("description")
        check_description(entry_description, "%s の entry_skill.description" % label, problems)

    workers: List[Dict[str, Any]] = []
    raw_workers = data.get("workers")
    if not isinstance(raw_workers, list) or not raw_workers:
        problems.append("%s の workers は、作業エージェントを1体以上、一覧にしてください。" % label)
    else:
        seen: Set[str] = set()
        for number, worker in enumerate(raw_workers, 1):
            where = "%s の workers の %d 番目" % (label, number)
            if not isinstance(worker, dict):
                problems.append("%sは、agent と label を持つ項目の集まりにしてください。" % where)
                continue
            extra = [k for k in worker if k not in ("agent", "label", "extra_tools")]
            if extra:
                problems.append("%sに知らない項目があります：%s。" % (where, "、".join(extra)))
            agent, tag = worker.get("agent"), worker.get("label")
            if not isinstance(agent, str) or not WORKER_RE.match(agent):
                problems.append("%sの agent は、worker か worker-<名前>（小文字の英数字とハイフン）にしてください（今は %s）。" % (where, show(agent)))
                continue
            if agent in seen:
                problems.append("%sの agent %s が重なっています。" % (where, agent))
                continue
            seen.add(agent)
            if not isinstance(tag, str) or not tag.strip():
                problems.append("%sの label（画面での呼び名）が空です。" % where)
            workers.append({"agent": agent, "label": tag, "extra_tools": check_tools(worker.get("extra_tools"), "%sの extra_tools" % where, problems)})

    roles: Dict[str, List[str]] = {}
    for role in ("verifier", "orchestrator"):
        part = data.get(role)
        if part is None:
            roles[role] = []
        elif not isinstance(part, dict) or any(k != "extra_tools" for k in part):
            problems.append("%s の %s は、extra_tools だけを持つ項目の集まりにしてください。" % (label, role))
            roles[role] = []
        else:
            roles[role] = check_tools(part.get("extra_tools"), "%s の %s.extra_tools" % (label, role), problems)

    if len(problems) > before or None in (name, entry_name):
        return None
    return {
        "plugin_name": name,
        "plugin_description": data["plugin_description"],
        "entry_name": entry_name,
        "entry_description": entry_description,
        "workers": workers,
        "verifier_tools": roles["verifier"],
        "orchestrator_tools": roles["orchestrator"],
    }


_checks_module: Any = False   # False：まだ読んでいない、None：使えない


def load_checks() -> Any:
    """1段目の検査（ひな形の check_structure.py）を読み込む。task.json の形の誤りを、日本語の文で示すために使う。
    PyYAML か jsonschema がなければ None（組み立ての時点では、まだ試験の道具を入れていないことがある）。"""
    global _checks_module
    if _checks_module is not False:
        return _checks_module
    _checks_module = None
    try:
        import jsonschema  # noqa: F401
        import yaml  # noqa: F401
        if not os.path.isfile(CHECKS_PATH):
            return None
        spec = importlib.util.spec_from_file_location("plugin_creator_check_structure", CHECKS_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)   # 道具が古いときは SystemExit で止まる
        _checks_module = module
    except (ImportError, Exception, SystemExit):
        _checks_module = None
    return _checks_module


def load_task(work: str, template: str, manifest: Optional[Dict[str, Any]], criteria: List[Dict[str, str]],
              problems: List[str], warnings: List[str]) -> Optional[Dict[str, Any]]:
    """parts/task.json に合否の基準を足して、作業の定義の形（core/task.schema.json）で確かめる。"""
    label = "作業の定義（parts/task.json）"
    data = read_json(os.path.join(work, "parts", "task.json"), label, problems)
    if data is None:
        return None
    if not isinstance(data, dict):
        problems.append("%s の形が違います（項目の集まりではありません）。" % label)
        return None
    if data.get("criteria") not in (None, []):
        problems.append("%s に criteria があります。合否の基準は、ユーザーと確かめたナレッジから組み立てのスクリプトが書くので、"
                        "作業エージェントは書きません。criteria を取り除いてください。" % label)
        return None
    task: Dict[str, Any] = {}
    for key in ("name", "maxIterationsDefault"):
        if key in data:
            task[key] = data[key]
    task["criteria"] = [dict(c) for c in criteria]
    for key, value in data.items():
        if key not in task and key != "criteria":
            task[key] = value

    schema_path = os.path.join(template, *EXT_PARENT, EXT_PLACEHOLDER, "core", "task.schema.json")
    checks = load_checks()
    if checks is None:
        warnings.append("jsonschema か PyYAML が入っていないので、task.json の形の確かめは、1段目（構造の検査）に任せました。")
    else:
        try:
            with open(schema_path, encoding="utf-8") as f:
                schema = json.load(f)
        except (OSError, ValueError) as e:
            problems.append("ひな形の core/task.schema.json を読めません（%s）。" % e)
            return None
        for message in checks.schema_problems(task, schema, "作業の定義 task.json:"):
            problems.append("%s（直す場所：parts/task.json）" % message)

    listed = task.get("workers")
    if manifest is not None and isinstance(listed, list) and all(isinstance(w, dict) for w in listed):
        in_task = sorted(str(w.get("agent")) for w in listed)
        in_manifest = sorted(w["agent"] for w in manifest["workers"])
        if in_task != in_manifest:
            problems.append("作業エージェントの名前が、parts/manifest.json の workers（%s）と parts/task.json の workers（%s）で合っていません。"
                            % ("、".join(in_manifest), "、".join(in_task)))
    return task


def load_slots(work: str, problems: List[str]) -> Dict[str, str]:
    """parts/slots/<差し込み口の名前>.md を読む。空のものと、名前の形が違うものは断る。"""
    base = os.path.join(work, "parts", "slots")
    slots: Dict[str, str] = {}
    if not os.path.isdir(base):
        return slots
    for entry in sorted(os.listdir(base)):
        path = os.path.join(base, entry)
        if entry in SKIP_NAMES:
            continue
        name = entry[:-3] if entry.endswith(".md") else ""
        if os.path.isdir(path) or not SLOT_NAME.match(name):
            problems.append("parts/slots/%s は差し込み口の文ではありません。ファイル名は <差し込み口の名前>.md にしてください。" % entry)
            continue
        try:
            with open(path, encoding="utf-8") as f:
                text = f.read()
        except (OSError, UnicodeDecodeError) as e:
            problems.append("parts/slots/%s を読めません（%s）。" % (entry, e))
            continue
        text = text.replace("\r\n", "\n").replace("\r", "\n").strip("\n")
        if not text.strip():
            problems.append("parts/slots/%s の中身が空です。差し込み口 %s に入れる文を書いてください。" % (entry, "{{slot:%s}}" % name))
            continue
        slots[name] = text
    return slots


def list_parts_files(work: str, problems: List[str]) -> List[str]:
    """parts/files/ の下のファイルを、生成プラグインの中のパス（/ 区切り）で返す。"""
    base = os.path.join(work, "parts", "files")
    found: List[str] = []
    if not os.path.isdir(base):
        return found
    for directory, dirs, names in os.walk(base):
        keep = []
        for d in sorted(dirs):
            path = os.path.join(directory, d)
            if d in SKIP_NAMES and d != ".git":
                continue
            if d in (".git", WORK_NAME):
                problems.append("parts/files/%s は置けません（%s）。" % (posix_rel(path, base), d))
            elif os.path.islink(path):
                problems.append("parts/files/%s はシンボリックリンクです。そのまま足すファイルに、リンクは使えません。" % posix_rel(path, base))
            else:
                keep.append(d)
        dirs[:] = keep
        for n in sorted(names):
            path = os.path.join(directory, n)
            if n in SKIP_NAMES or n.endswith(".pyc"):
                continue
            if os.path.islink(path):
                problems.append("parts/files/%s はシンボリックリンクです。そのまま足すファイルに、リンクは使えません。" % posix_rel(path, base))
            else:
                found.append(posix_rel(path, base))
    return sorted(found)


def resolve_criterion(item: Dict[str, Any], by_id: Dict[str, Dict[str, str]], by_knowledge: Dict[str, Dict[str, str]],
                      where: str, problems: List[str]) -> Optional[Dict[str, str]]:
    cid, kid = item.get("id"), item.get("knowledge")
    if cid is not None:
        found = by_id.get(cid) if isinstance(cid, str) else None
        if found is None:
            problems.append("%sの id %s は、作業の定義の基準の番号にありません（今ある番号：%s）。" % (where, show(cid), "、".join(by_id)))
            return None
        if kid is not None and kid != found["knowledge"]:
            problems.append("%sの id %s と knowledge %s が合っていません（%s のもとのナレッジは %s）。" % (where, cid, show(kid), cid, found["knowledge"]))
            return None
        return found
    if kid is not None:
        found = by_knowledge.get(kid) if isinstance(kid, str) else None
        if found is None:
            problems.append("%sの knowledge %s は、合否の決め方のナレッジの番号ではありません（使える番号：%s）。" % (where, show(kid), "、".join(by_knowledge)))
        return found
    problems.append("%sに、どの基準の採点かを示す knowledge（もとのナレッジの番号）がありません。" % where)
    return None


def prepare_eval(base: str, rels: List[str], criteria: List[Dict[str, str]], problems: List[str], warnings: List[str]) -> Dict[str, str]:
    """EVAL の課題（tests/eval/*/eval.json）の criteria に、作業の定義の基準の番号と文の写しを入れる（BLUEPRINT 4.3）。
    作業エージェントは、基準ごとの採点のしかた（grading と check）と、どの基準かを示す knowledge（か id）だけを書く。
    返すのは、書き直した eval.json の中身（生成プラグインの中のパス -> 文）。"""
    by_id = {c["id"]: c for c in criteria}
    by_knowledge = {c["knowledge"]: c for c in criteria}
    filled: Dict[str, str] = {}
    covered: Set[str] = set()
    eval_rels = [r for r in rels if EVAL_REL.match(r)]
    for rel in eval_rels:
        label = "parts/files/" + rel
        data = read_json(os.path.join(base, *rel.split("/")), label, problems)
        if data is None:
            continue
        if not isinstance(data, dict):
            problems.append("%s の形が違います（項目の集まりではありません）。" % label)
            continue
        items = data.get("criteria")
        if not isinstance(items, list) or not items:
            problems.append("%s に criteria（基準ごとの採点のしかた）がありません。" % label)
            continue
        new_items = []
        for number, item in enumerate(items, 1):
            where = "%s の criteria の %d 番目" % (label, number)
            if not isinstance(item, dict):
                problems.append("%sは、項目の集まりにしてください。" % where)
                continue
            found = resolve_criterion(item, by_id, by_knowledge, where, problems)
            if found is None:
                continue
            covered.add(found["id"])
            rest = {k: v for k, v in item.items() if k not in ("id", "text", "knowledge")}
            new_items.append(dict([("id", found["id"]), ("text", found["text"])] + list(rest.items())))
        data["criteria"] = new_items
        filled[rel] = json_text(data)
    if not eval_rels:
        warnings.append("EVAL の課題（tests/eval/<課題>/eval.json）が1つもありません。構造の検査で不合格になります。")
    else:
        for c in criteria:
            if c["id"] not in covered:
                warnings.append("基準 %s（ナレッジ %s）が、どの EVAL の課題にも入っていません。構造の検査で不合格になります。" % (c["id"], c["knowledge"]))
    return filled


def check_output_path(work: str, out: str, problems: List[str]) -> None:
    """--out は、まだないフォルダで、作業フォルダ（--work の親）の中にあること（REQ-021、REQ-036）。"""
    if os.path.basename(os.path.normpath(work)) != WORK_NAME:
        problems.append("--work は、作業フォルダの中の %s にしてください（今は %s）。" % (WORK_NAME, work))
        return
    if not os.path.isdir(work):
        problems.append("作業用の一時フォルダ（%s）がありません。" % work)
        return
    work_folder = os.path.dirname(work)
    if os.path.lexists(out):
        problems.append("出力先 %s がすでにあります。作り直しのときも、まだないフォルダに作ります。別のフォルダの名前を指定してください"
                        "（今あるフォルダは変えません）。" % out)
    elif not is_inside(out, work_folder):
        problems.append("出力先 %s が作業フォルダ %s の中にありません。生成プラグインは、作業フォルダの中の新しいフォルダに作ります。" % (out, work_folder))
    elif is_inside(out, work):
        problems.append("出力先 %s が作業用の一時フォルダ %s の中です。組み立ての最後にそのフォルダを消すので、別の場所にしてください。" % (out, work))
    elif not os.path.isdir(os.path.dirname(out)):
        problems.append("出力先 %s の親のフォルダがありません。" % out)


# ---------------------------------------------------------------- ひな形の加工

def frontmatter_span(text: str) -> Optional[Tuple[int, int]]:
    """先頭の --- と --- の間（フロントマター）の範囲 [始まり, 終わり)。なければ None。"""
    first = text.find("\n")
    if first < 0 or text[:first].strip() != "---":
        return None
    pos = first + 1
    while pos <= len(text):
        end = text.find("\n", pos)
        line_end = len(text) if end < 0 else end
        if text[pos:line_end].strip() == "---":
            return first + 1, pos
        if end < 0:
            return None
        pos = end + 1
    return None


def worker_copy(text: str, agent: str) -> str:
    """worker.agent.md を元に、作業エージェント agent のファイルの中身を作る。"""
    text = WORKER_SLOT.sub("{{slot:worker-task.%s}}" % agent, text)
    span = frontmatter_span(text)
    if span:
        head = re.sub(r"(?m)^name:[ \t]*.*$", lambda _m: "name: %s" % agent, text[span[0]:span[1]])
        text = text[:span[0]] + head + text[span[1]:]
    return text


def apply_slots(text: str, slots: Dict[str, str], used: Set[str]) -> str:
    """{{slot:名前}} を文で置き換える。単独の行なら行ごと（字下げを引き継ぐ）、行の途中ならその場で。"""
    def inline(m: "re.Match[str]") -> str:
        name = m.group(2)
        if not m.group(1) or name not in slots:
            return m.group(0)
        used.add(name)
        return slots[name]

    out: List[str] = []
    for line in text.splitlines(keepends=True):
        body = line.rstrip("\r\n")
        newline = line[len(body):] or "\n"
        m = PLACEHOLDER.fullmatch(body.strip())
        if m and m.group(1) and m.group(2) in slots:
            used.add(m.group(2))
            indent = body[: len(body) - len(body.lstrip())]
            for piece in slots[m.group(2)].split("\n"):
                out.append((indent + piece if piece else piece) + newline)
        elif "{{slot:" in line:
            out.append(PLACEHOLDER.sub(inline, line))
        else:
            out.append(line)
    return "".join(out)


def apply_tool_lists(text: str, lists: Dict[str, List[str]], consumed: Set[str]) -> str:
    """tools の作業ごとの分。単独の行なら '- 名前' の行（なければ行ごと消す）、行の途中なら ', 名前' をつなげたもの。"""
    if not lists:
        return text

    def inline(m: "re.Match[str]") -> str:
        name = m.group(2)
        if m.group(1) or name not in lists:
            return m.group(0)
        consumed.add(name)
        return "".join(", " + tool for tool in lists[name])

    out: List[str] = []
    for line in text.splitlines(keepends=True):
        body = line.rstrip("\r\n")
        newline = line[len(body):] or "\n"
        m = PLACEHOLDER.fullmatch(body.strip())
        if m and not m.group(1) and m.group(2) in lists:
            consumed.add(m.group(2))
            indent = body[: len(body) - len(body.lstrip())]
            out.extend("%s- %s%s" % (indent, tool, newline) for tool in lists[m.group(2)])
        elif "{{" in line:
            out.append(PLACEHOLDER.sub(inline, line))
        else:
            out.append(line)
    return "".join(out)


def yaml_value(text: str, m: "re.Match[str]", value: str) -> str:
    """YAML のフロントマターの中の値。二重引用符の中なら中身だけ、`キー: {{名前}}` の形なら二重引用符つきの文字列、
    それ以外（長い文字の一部など）はそのまま入れる。"""
    before = text[m.start() - 1] if m.start() > 0 else ""
    after = text[m.end()] if m.end() < len(text) else ""
    if before == '"' and after == '"':
        return json_escape(value)
    line_start = text.rfind("\n", 0, m.start()) + 1
    line_end = text.find("\n", m.end())
    line = text[line_start:(len(text) if line_end < 0 else line_end)]
    if re.fullmatch(r"[ \t]*[A-Za-z_][\w-]*:[ \t]+" + re.escape(m.group(0)) + r"[ \t]*\r?", line):
        if YAML_PLAIN.match(value) and value.lower() not in YAML_RESERVED:
            return value   # 名前など。引用符なしでも、数や真偽に読まれない
        return json.dumps(value, ensure_ascii=False)
    return value


def apply_values(text: str, rel: str, values: Dict[str, str]) -> str:
    """{{名前}} を決まった値で置き換える。JSON のファイルでは JSON の文字列の中身として、
    SKILL.md やエージェントの定義のフロントマターでは YAML の値として、そのほかはそのまま入れる。"""
    span = frontmatter_span(text) if rel.endswith(".md") else None

    def repl(m: "re.Match[str]") -> str:
        if m.group(1) or m.group(2) not in values:
            return m.group(0)
        value = values[m.group(2)]
        if rel.endswith(".json"):
            return json_escape(value)
        if span and span[0] <= m.start() < span[1]:
            return yaml_value(text, m, value)
        return value

    return PLACEHOLDER.sub(repl, text)


def fill_template(out: str, plugin_name: str, slots: Dict[str, str], values: Dict[str, str],
                  tool_lists: Dict[str, Dict[str, List[str]]], problems: List[str], warnings: List[str]) -> None:
    """ひな形から写したファイルの差し込み口を埋める。土台のファイル（エクステンションのフォルダ）は書き換えない。"""
    base_prefix = "%s/%s/" % ("/".join(EXT_PARENT), plugin_name)
    used: Set[str] = set()
    consumed: Set[Tuple[str, str]] = set()
    leftovers: List[Tuple[str, int, str]] = []
    for directory, dirs, names in os.walk(out):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_NAMES)
        for name in sorted(names):
            path = os.path.join(directory, name)
            rel = posix_rel(path, out)
            try:
                with open(path, "rb") as f:
                    text = f.read().decode("utf-8")
            except (OSError, UnicodeDecodeError):
                continue   # 文字のファイルではない
            if "{{" not in text:
                continue
            if not rel.startswith(base_prefix):
                done: Set[str] = set()
                new = apply_slots(text, slots, used)
                new = apply_tool_lists(new, tool_lists.get(rel, {}), done)
                new = apply_values(new, rel, values)
                consumed.update((rel, token) for token in done)
                if new != text:
                    write_text(path, new)
                    text = new
            for m in PLACEHOLDER.finditer(text):
                leftovers.append((rel, text.count("\n", 0, m.start()) + 1, m.group(0)))

    reported: Set[Tuple[str, str]] = set()
    for rel, line, token in leftovers:
        if (rel, token) in reported:
            continue
        reported.add((rel, token))
        if token.startswith("{{slot:"):
            name = token[len("{{slot:"):-2]
            if name in slots:
                problems.append("差し込み口 %s が、%s の %d 行目に残っています。差し込み口の文（parts/slots/）の中に、別の差し込み口は書けません。"
                                % (token, rel, line))
            else:
                problems.append("差し込み口 %s（%s の %d 行目）が埋まっていません。parts/slots/%s.md に入れる文を書いてください。" % (token, rel, line, name))
        elif rel.startswith(base_prefix):
            problems.append("土台のファイル %s の %d 行目に差し込み口 %s があります。土台は書き換えないので、ひな形の誤りです。" % (rel, line, token))
        else:
            problems.append("差し込み口 %s（%s の %d 行目）に入れる値が決まっていません。ひな形が使う名前と、組み立てのスクリプトが入れる名前が合っていません。"
                            % (token, rel, line))
    for rel, lists in sorted(tool_lists.items()):
        for token, tools in lists.items():
            if tools and (rel, token) not in consumed:
                problems.append("%s に、parts/manifest.json の extra_tools（%s）を入れる場所 {{%s}} がありません。ひな形のエージェントの定義を直してください。"
                                % (rel, "、".join(tools), token))
    for name in sorted(set(slots) - used):
        warnings.append("parts/slots/%s.md は、ひな形のどの差し込み口にも使われていません（文は入っていません）。" % name)


def tool_list_map(manifest: Dict[str, Any]) -> Dict[str, Dict[str, List[str]]]:
    """エージェントの定義のファイル -> {tools の差し込み口の名前: 足すツール}。"""
    lists = {
        "%s/orchestrator.agent.md" % AGENTS_REL: {TOOL_TOKENS["orchestrator"]: manifest["orchestrator_tools"]},
        "%s/verifier.agent.md" % AGENTS_REL: {TOOL_TOKENS["verifier"]: manifest["verifier_tools"]},
    }
    for worker in manifest["workers"]:
        lists["%s/%s.agent.md" % (AGENTS_REL, worker["agent"])] = {TOOL_TOKENS["worker"]: worker["extra_tools"]}
    return lists


# ---------------------------------------------------------------- 土台の確かめ

def read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def template_base(template: str) -> Tuple[str, Dict[str, str]]:
    """ひな形の土台（extensions/_plugin_/ の下のファイル）。(フォルダ, {その中のパス: 本当のパス})。"""
    root = os.path.join(template, *EXT_PARENT, EXT_PLACEHOLDER)
    files: Dict[str, str] = {}
    if not os.path.isdir(root):
        return root, files
    ignore = make_ignore(template)
    for directory, dirs, names in os.walk(root):
        skipped = ignore(directory, dirs + names)
        dirs[:] = sorted(d for d in dirs if d not in skipped)
        for n in sorted(names):
            if n not in skipped:
                path = os.path.join(directory, n)
                files[posix_rel(path, root)] = path
    return root, files


def compare_base(out: str, template: str) -> Tuple[str, str, List[Dict[str, str]]]:
    """生成プラグイン out の土台を、ひな形と比べる。(プラグインの名前, エクステンションのフォルダ, 違いの一覧)。
    違い：{"file", "kind", "message"}。kind は changed（中身が違う）・missing（ない）・extra（ひな形にない）。"""
    problems: List[str] = []
    manifest = read_json(os.path.join(out, "plugin.json"), "plugin.json", problems)
    name = manifest.get("name") if isinstance(manifest, dict) else None
    if problems or not isinstance(name, str) or not name or "/" in name or "\\" in name or name in (".", ".."):
        raise Refusal(problems or ["plugin.json の name が読めないので、土台のフォルダ（com.github.copilot/extensions/<名前>/）を探せません。"])
    ext = os.path.join(out, *EXT_PARENT, name)
    if not os.path.isdir(ext):
        raise Refusal("土台のフォルダ %s がありません。plugin.json の name（%s）とフォルダの名前を合わせてください。" % (posix_rel(ext, out), name))
    root, expected = template_base(template)
    if not expected:
        raise Refusal("ひな形の土台（%s）が見つかりません。" % root)
    differences: List[Dict[str, str]] = []

    def add(rel: str, kind: str, message: str) -> None:
        differences.append({"file": posix_rel(os.path.join(ext, *rel.split("/")), out), "kind": kind, "message": message})

    for rel, source in expected.items():
        target = os.path.join(ext, *rel.split("/"))
        if not os.path.isfile(target):
            add(rel, "missing", "ひな形にあるファイルがありません")
        elif read_bytes(source) != read_bytes(target):
            add(rel, "changed", "中身がひな形と違います")
    # 土台のフォルダ（core/、ui/ など、ひな形のフォルダ）の中は、すべて土台。ひな形にないファイルも違いにする
    for sub in sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and d not in SKIP_NAMES):
        for directory, dirs, names in os.walk(os.path.join(ext, sub)):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_NAMES)
            for n in sorted(names):
                if n.endswith(".pyc"):
                    continue
                rel = posix_rel(os.path.join(directory, n), ext)
                if rel not in expected:
                    add(rel, "extra", "ひな形にないファイルがあります")
    differences.sort(key=lambda d: d["file"])
    return name, ext, differences


def restore_base(ext: str, template: str, differences: List[Dict[str, str]], out: str) -> List[str]:
    """違うファイルをひな形から入れ直す。ひな形にないファイルは消す。入れ直したファイルの一覧を返す。"""
    _root, expected = template_base(template)
    restored: List[str] = []
    for d in differences:
        rel = posix_rel(os.path.join(out, *d["file"].split("/")), ext)
        target = os.path.join(ext, *rel.split("/"))
        if d["kind"] == "extra":
            os.remove(target)
            parent = os.path.dirname(target)
            while parent != ext and is_inside(parent, ext):   # 空になったフォルダも片付ける
                try:
                    os.rmdir(parent)
                except OSError:
                    break
                parent = os.path.dirname(parent)
        else:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy2(expected[rel], target)
        restored.append(d["file"])
    return restored


def check_base(out: str, restore: bool = False, template: Optional[str] = None) -> Dict[str, Any]:
    template = template or DEFAULT_TEMPLATE
    out = os.path.abspath(out)
    if not os.path.isdir(out):
        raise Refusal("生成プラグインのフォルダ %s がありません。" % out)
    name, ext, differences = compare_base(out, template)
    restored: List[str] = []
    remaining = differences
    if restore and differences:
        restored = restore_base(ext, template, differences, out)
        _name, _ext, remaining = compare_base(out, template)
    return {"ok": not remaining, "plugin": name, "differences": differences, "restored": restored, "remaining": remaining}


# ---------------------------------------------------------------- git

def git_verb(args: List[str]) -> str:
    """git の引数から、サブコマンドの名前（init、add、commit など）を取り出す。-c の設定は飛ばす。"""
    skip = False
    for arg in args:
        if skip:
            skip = False
        elif arg == "-c":
            skip = True
        elif not arg.startswith("-"):
            return arg
    return ""


def git(args: List[str], cwd: str) -> "subprocess.CompletedProcess[str]":
    env = {k: v for k, v in os.environ.items() if k not in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE")}
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        return subprocess.run(["git"] + args, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=120)
    except FileNotFoundError:
        raise Refusal("git が見つかりません。生成プラグインは git のリポジトリとして作るので、git を入れてください。")
    except subprocess.TimeoutExpired:
        raise Refusal("git の処理（git %s）が120秒で終わりませんでした。" % git_verb(args))


def git_ok(args: List[str], cwd: str) -> str:
    done = git(args, cwd)
    if done.returncode != 0:
        raise Refusal("git %s に失敗しました：%s" % (git_verb(args), (done.stderr or done.stdout).strip()))
    return done.stdout


def first_commit(out: str, plugin_name: str) -> str:
    """git のリポジトリにして、全部を add して最初のコミットをする。コミットの番号を返す。"""
    git_ok(["init", "-q"], out)
    git_ok(["add", "-A"], out)
    # 署名も、コミット前のフック（--no-verify）も、ユーザーの設定にかかわらず使わない（人の操作を待たないため）
    command = ["-c", "commit.gpgsign=false"]
    if not git(["config", "user.name"], out).stdout.strip() or not git(["config", "user.email"], out).stdout.strip():
        command += ["-c", "user.name=%s" % FALLBACK_GIT_NAME, "-c", "user.email=%s" % FALLBACK_GIT_EMAIL]
    git_ok(command + ["commit", "-q", "--no-verify", "-m", "生成プラグイン %s を plugin-creator で組み立てた" % plugin_name], out)
    return git_ok(["rev-parse", "HEAD"], out).strip()


# ---------------------------------------------------------------- build

def build(hearing: str, work: str, out: str, template: Optional[str] = None, today: Optional[str] = None) -> Dict[str, Any]:
    """生成プラグインを組み立てる。断るときは Refusal を投げる。template と today は試験のために替えられる。"""
    hearing, work, out = os.path.abspath(hearing), os.path.abspath(work), os.path.abspath(out)
    template = template or DEFAULT_TEMPLATE
    today = today or datetime.date.today().isoformat()

    state = load_state(hearing)   # 関門。通らなければ、ここで断る（hearing.md 6.3）
    problems: List[str] = []
    warnings: List[str] = []
    knowledge = decided_knowledge(state, problems)
    criteria = make_criteria(knowledge, problems)
    manifest = load_manifest(work, problems)
    task = load_task(work, template, manifest, criteria, problems, warnings)
    slots = load_slots(work, problems)
    parts_files = list_parts_files(work, problems)
    filled_eval = prepare_eval(os.path.join(work, "parts", "files"), parts_files, criteria, problems, warnings)
    check_output_path(work, out, problems)
    if problems or manifest is None or task is None:
        raise Refusal(problems or ["組み立ての設定を読めませんでした。"])

    plugin_name = manifest["plugin_name"]
    values = {
        "plugin_name": plugin_name,
        "plugin_description": manifest["plugin_description"],
        "marketplace_name": plugin_name,     # 手元のフォルダのマーケットプレイスの名前は、プラグインの名前と同じにする
        "generated_date": today,
        "entry_skill_name": manifest["entry_name"],
        "entry_skill_description": manifest["entry_description"],
    }

    try:
        os.mkdir(out)   # すでにあれば失敗する（今あるフォルダを、失敗のときに消さないため）
    except FileExistsError:
        raise Refusal("出力先 %s がすでにあります。別のフォルダの名前を指定してください。" % out)
    try:
        shutil.copytree(template, out, ignore=make_ignore(template), dirs_exist_ok=True)

        # _plugin_ と _entry_ の名前を変える
        ext_parent = os.path.join(out, *EXT_PARENT)
        for parent, old, new, label in ((ext_parent, EXT_PLACEHOLDER, plugin_name, "com.github.copilot/extensions/_plugin_/"),
                                        (os.path.join(out, "skills"), ENTRY_PLACEHOLDER, manifest["entry_name"], "skills/_entry_/")):
            if not os.path.isdir(os.path.join(parent, old)):
                raise Refusal("ひな形に %s がありません（ひな形が足りません）。" % label)
            os.rename(os.path.join(parent, old), os.path.join(parent, new))

        # 作業エージェントごとに、worker.agent.md を元にしたファイルを作る
        agents_dir = os.path.join(out, *AGENTS_REL.split("/"))
        source = os.path.join(agents_dir, WORKER_FILE)
        if not os.path.isfile(source):
            raise Refusal("ひな形に %s/%s がありません（ひな形が足りません）。" % (AGENTS_REL, WORKER_FILE))
        worker_text = read_bytes(source).decode("utf-8")
        agents = [w["agent"] for w in manifest["workers"]]
        for agent in agents:
            write_text(os.path.join(agents_dir, agent + ".agent.md"), worker_copy(worker_text, agent))
        if "worker" not in agents:
            os.remove(source)

        # 差し込み口を埋める：文、tools の作業ごとの分、決まった値の順
        fill_template(out, plugin_name, slots, values, tool_list_map(manifest), problems, warnings)
        if problems:
            raise Refusal(problems)

        # 作業の定義とナレッジの一覧
        ext = os.path.join(ext_parent, plugin_name)
        write_text(os.path.join(ext, "task.json"), json_text(task))
        write_text(os.path.join(out, "tests", "knowledge.json"),
                   json_text([{"id": r["id"], "kind": r["kind"], "item": r["item"], "text": r["text"]} for r in knowledge]))

        # 作業エージェントが書いたファイルをそのまま足す。ひな形や組み立てのファイルは書き換えさせない
        base = os.path.join(work, "parts", "files")
        collisions = [r for r in parts_files if os.path.lexists(os.path.join(out, *r.split("/")))]
        if collisions:
            raise Refusal(["作業エージェントが書いたファイル %s は、ひな形か組み立てが作るファイルと同じ場所です。"
                           "ひな形のファイル（土台と文書、task.json、tests/knowledge.json など）は書き換えられません。置き場所を変えてください。" % r
                           for r in collisions])
        for rel in parts_files:
            target = os.path.join(out, *rel.split("/"))
            if rel in filled_eval:
                write_text(target, filled_eval[rel])
            else:
                os.makedirs(os.path.dirname(target), exist_ok=True)
                shutil.copy2(os.path.join(base, *rel.split("/")), target)

        # 土台がひな形と同じか
        _name, _ext, differences = compare_base(out, template)
        if differences:
            raise Refusal(["組み立てた土台がひな形と違います（%s）。ひな形か組み立てのスクリプトの誤りです。" % "、".join(d["file"] for d in differences)])

        commit = first_commit(out, plugin_name)
    except BaseException:
        shutil.rmtree(out, ignore_errors=True)   # 途中まで作ったフォルダは消す（作業用の一時フォルダは残す）
        raise

    removed = True
    try:
        shutil.rmtree(work)
    except OSError as e:
        removed = False
        warnings.append("作業用の一時フォルダ（%s）を消せませんでした（%s）。手で消してください。" % (work, e))

    counts = {kind: sum(1 for r in knowledge if r["kind"] == kind) for kind in ("criterion", "other")}
    return {
        "ok": True,
        "out": out,
        "plugin_name": plugin_name,
        "marketplace_name": plugin_name,
        "entry_skill": manifest["entry_name"],
        "workers": agents,
        "criteria": [{"id": c["id"], "knowledge": c["knowledge"]} for c in criteria],
        "knowledge": counts,
        "commit": commit,
        "work_folder_removed": removed,
        "warnings": warnings,
    }


# ---------------------------------------------------------------- 入口

def emit(result: Dict[str, Any]) -> None:
    print(json.dumps(result, ensure_ascii=False, indent=2))


def main(argv: Optional[List[str]] = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="生成プラグインの組み立てと、土台の確かめ。結果は標準出力に JSON で出す。")
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("build", help="生成プラグインを組み立てる")
    b.add_argument("--hearing", required=True, help="ヒアリングの記録 state.json のパス")
    b.add_argument("--work", required=True, help="作業用の一時フォルダ <作業フォルダ>/.plugin-creator-work")
    b.add_argument("--out", required=True, help="作る生成プラグインのフォルダ（作業フォルダの中の、まだないフォルダ）")
    c = sub.add_parser("check-base", help="土台のファイルがひな形と同じかを確かめる")
    c.add_argument("--out", required=True, help="生成プラグインのフォルダ")
    c.add_argument("--restore", action="store_true", help="違うファイルをひな形から入れ直す")
    args = parser.parse_args(argv)
    try:
        if args.command == "build":
            result = build(args.hearing, args.work, args.out)
        else:
            result = check_base(args.out, args.restore)
    except Refusal as e:
        emit({"ok": False, "problems": e.problems})
        return 1
    except Exception as e:   # 想定していない誤り。理由を示して止まる
        import traceback
        traceback.print_exc(file=sys.stderr)
        emit({"ok": False, "problems": ["予期しない誤りで止まりました（%s: %s）。" % (type(e).__name__, e)]})
        return 1
    emit(result)
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
