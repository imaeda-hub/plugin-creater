"""クリエイター自身の1・2段目の入口（tests/creator/run.py）の試験。

試験の場所を探すこと（新しいフォルダを足しても入口を変えなくてよいこと、見本と heldout を探さないこと）、
道具の確かめ、段階ごとの合否とファイルへの書き出しを、小さな一時フォルダで確かめる。
動かし方（リポジトリの根で）:  python3 -m unittest discover -s tests/creator -p "test_creator_run.py"
結びつく要件の番号がない（クリエイターの開発の試験の入口のため）。
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
RUN = os.path.join(HERE, "run.py")

_spec = importlib.util.spec_from_file_location("creator_run", RUN)
ent = importlib.util.module_from_spec(_spec)
sys.modules["creator_run"] = ent
_spec.loader.exec_module(ent)

HAS_NODE = ent.tr.node_version()[0]

STUB_STAGE1 = """import json, sys
print(json.dumps({"plugin": sys.argv[1], "kind": "creator", "ok": True, "failures": [], "warnings": [],
                  "checks": [{"id": "stub", "title": "見本の1段目", "status": "passed", "problems": []}]}))
"""
PASSING_NODE = "import test from 'node:test';\ntest('通る', () => {});\n"
FAILING_NODE = "import test from 'node:test';\ntest('落ちる', () => { throw new Error('わざと'); });\n"
PASSING_PY = "import unittest\n\n\nclass T(unittest.TestCase):\n    def test_ok(self):\n        pass\n"
FAILING_PY = "import unittest\n\n\nclass T(unittest.TestCase):\n    def test_bad(self):\n        self.assertEqual(1, 2)\n"


class Fixture(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def write(self, rel, text=""):
        path = os.path.join(self.root, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return path

    def rel(self, paths):
        return sorted(os.path.relpath(p, self.root).replace(os.sep, "/") for p in paths)


class Discover(Fixture):
    def test_node_tests_and_unittest_folders_are_found_under_creator_and_dev_eval(self):
        self.write("tests/creator/extension/a.test.mjs")
        self.write("tests/creator/ui-reuse/server-reuse.test.mjs")
        self.write("tests/creator/stage1/test_x.py")
        self.write("tests/creator/test_top.py")
        self.write("tests/dev-eval/runner/r.test.mjs")
        self.write("tests/dev-eval/test_convert.py")
        node_files, python_dirs = ent.discover(self.root)
        self.assertEqual(["tests/creator/extension/a.test.mjs", "tests/creator/ui-reuse/server-reuse.test.mjs", "tests/dev-eval/runner/r.test.mjs"],
                         self.rel(node_files))
        self.assertEqual(["tests/creator", "tests/creator/stage1", "tests/dev-eval"], self.rel(python_dirs))

    def test_a_new_folder_is_found_without_changing_the_entry(self):
        self.write("tests/creator/a-folder-added-later/new.test.mjs")
        self.write("tests/creator/another-one/test_new.py")
        node_files, python_dirs = ent.discover(self.root)
        self.assertEqual(["tests/creator/a-folder-added-later/new.test.mjs"], self.rel(node_files))
        self.assertEqual(["tests/creator/another-one"], self.rel(python_dirs))

    def test_samples_copies_dependencies_and_heldout_are_not_searched(self):
        for folder in ("sample", "samples", "fixture-template", "fixtures", "node_modules", ".venv", "__pycache__", "heldout"):
            self.write("tests/creator/%s/x.test.mjs" % folder)
            self.write("tests/creator/%s/test_x.py" % folder)
            self.write("tests/dev-eval/%s/y.test.mjs" % folder)
        self.write("tests/creator/stage1/samples/good/tests/stage2/core/s.test.mjs")
        self.write("tests/creator/scaffold/sample/parts/files/tests/stage2/task/test_s.py")
        self.assertEqual(([], []), ent.discover(self.root))

    def test_files_that_are_not_tests_are_not_picked_up(self):
        self.write("tests/creator/extension/helpers.mjs")
        self.write("tests/creator/extension/notes.test.mjs.bak")
        self.write("tests/creator/check_creator.py")
        self.assertEqual(([], []), ent.discover(self.root))

    def test_missing_folders_are_fine(self):
        self.assertEqual(([], []), ent.discover(self.root))

    def test_the_real_repository_ui_reuse_stage1_scaffold_and_dev_eval_tests_are_found(self):
        node_files, python_dirs = ent.discover(REPO)
        nodes, pys = self.relFrom(node_files), self.relFrom(python_dirs)
        for expected in ("tests/creator/ui-reuse/server-reuse.test.mjs", "tests/creator/ui-reuse/screen-reuse.test.mjs",
                         "tests/creator/stage1/eval-parity.test.mjs"):
            self.assertIn(expected, nodes)
        for expected in ("tests/creator", "tests/creator/stage1", "tests/creator/scaffold", "tests/creator/test-plugin", "tests/dev-eval"):
            self.assertIn(expected, pys)
        self.assertTrue(any(n.startswith("tests/creator/extension/") for n in nodes))
        self.assertTrue(any(n.startswith("tests/creator/test-plugin/") for n in nodes))
        self.assertTrue(any(n.startswith("tests/dev-eval/runner/") for n in nodes))
        for found in nodes + pys:
            self.assertNotIn("heldout", found.split("/"))
            self.assertNotIn("samples", found.split("/"))

    @staticmethod
    def relFrom(paths):
        return sorted(os.path.relpath(p, REPO).replace(os.sep, "/") for p in paths)


class Tools(Fixture):
    def item(self, items, item_id):
        return [i for i in items if i["id"] == item_id][0]

    def test_dev_eval_npm_parts_are_checked_against_package_json(self):
        self.write("tests/dev-eval/package.json", json.dumps({"dependencies": {"zod": "1", "@scope/pkg": "2"}}))
        item = ent.dev_eval_modules(self.root)
        self.assertFalse(item["ok"])
        self.assertIn("zod", item["found"])
        self.assertIn("@scope/pkg", item["found"])
        self.assertIn("npm install --ignore-scripts", item["howToInstall"])
        self.write("tests/dev-eval/node_modules/zod/package.json", "{}")
        self.write("tests/dev-eval/node_modules/@scope/pkg/package.json", "{}")
        self.assertTrue(ent.dev_eval_modules(self.root)["ok"])

    def test_dev_eval_npm_item_is_only_added_when_dev_eval_has_node_tests(self):
        self.write("tests/dev-eval/package.json", json.dumps({"dependencies": {"zod": "1"}}))
        only_creator = self.write("tests/creator/a.test.mjs")
        self.assertNotIn("dev-eval-npm", [i["id"] for i in ent.creator_tools(self.root, [only_creator])])
        in_dev_eval = self.write("tests/dev-eval/runner/r.test.mjs")
        self.assertIn("dev-eval-npm", [i["id"] for i in ent.creator_tools(self.root, [only_creator, in_dev_eval])])

    @unittest.skipUnless(HAS_NODE, "node がない")
    def test_playwright_is_needed_when_a_creator_test_imports_it_but_not_for_dev_eval_tests(self):
        dev = self.write("tests/dev-eval/runner/p.test.mjs", "import { chromium } from 'playwright';\n")
        ids = [i["id"] for i in ent.creator_tools(self.root, [dev])]
        self.assertNotIn("playwright", ids)
        ui = self.write("tests/creator/ui-reuse/screen-reuse.test.mjs", "const m = await import('playwright');\n")
        ids = [i["id"] for i in ent.creator_tools(self.root, [dev, ui])]
        self.assertIn("playwright", ids)
        self.assertIn("browser", ids)

    @unittest.skipUnless(HAS_NODE, "node がない")
    def test_playwright_found_through_node_path_counts_because_the_tests_search_it_themselves(self):
        ui = self.write("tests/creator/ui-reuse/screen-reuse.test.mjs", "const m = await import('playwright');\n")
        modules = os.path.join(self.root, "global_modules")
        os.makedirs(os.path.join(modules, "playwright"))
        with mock.patch.dict(os.environ, {"NODE_PATH": modules}):
            item = self.item(ent.creator_tools(self.root, [ui]), "playwright")
        self.assertTrue(item["ok"], item)
        self.assertIn(modules, item["found"])
        with mock.patch.dict(os.environ, {"NODE_PATH": os.path.join(self.root, "nothing")}):
            self.assertFalse(self.item(ent.creator_tools(self.root, [ui]), "playwright")["ok"])

    def test_tiktoken_is_always_needed_because_the_first_stage_counts_tokens(self):
        items = ent.creator_tools(self.root, [])
        self.assertEqual(["python", "pyyaml", "jsonschema", "tiktoken"], [i["id"] for i in items])


@unittest.skipUnless(HAS_NODE, "node がない")
class Entry(Fixture):
    def setUp(self):
        super().setUp()
        self.stage1 = self.write("stage1_stub.py", STUB_STAGE1)
        self.results = os.path.join(self.root, "tests", "results", "latest.json")

    def run_cli(self, *extra):
        cmd = [sys.executable, RUN, "--root", self.root, "--stage1-script", self.stage1] + list(extra)
        return subprocess.run(cmd, capture_output=True)

    def saved(self):
        with open(self.results, encoding="utf-8") as f:
            return json.load(f)

    def stage(self, result, stage_id):
        return [s for s in result["stages"] if s["id"] == stage_id][0]

    def test_all_places_are_run_and_both_runners_are_counted(self):
        self.write("tests/creator/a/ok.test.mjs", PASSING_NODE)
        self.write("tests/creator/ui-reuse/server-reuse.test.mjs", PASSING_NODE)
        self.write("tests/creator/p/test_ok.py", PASSING_PY)
        self.write("tests/dev-eval/test_ok2.py", PASSING_PY)
        proc = self.run_cli()
        self.assertEqual(0, proc.returncode, proc.stdout.decode("utf-8"))
        result = self.saved()
        stage2 = self.stage(result, "stage2")
        self.assertEqual("passed", result["status"])
        self.assertEqual(4, stage2["counts"]["passed"])
        self.assertEqual({"node", "unittest"}, {t["runner"] for t in stage2["tests"]})
        self.assertEqual("passed", self.stage(result, "stage1")["status"])

    def test_failures_are_listed_with_their_place_and_the_exit_code_is_1(self):
        self.write("tests/creator/a/bad.test.mjs", FAILING_NODE)
        self.write("tests/creator/p/test_bad.py", FAILING_PY)
        self.write("tests/dev-eval/q/test_ok.py", PASSING_PY)
        proc = self.run_cli()
        self.assertEqual(1, proc.returncode)
        text = proc.stdout.decode("utf-8")
        self.assertIn("2段目 部品の試験: 不合格", text)
        self.assertIn("わざと", text)
        self.assertIn("場所: tests/creator/a/bad.test.mjs", text)
        self.assertIn("tests/creator/p: test_bad.T.test_bad", text)
        self.assertIn("tests/dev-eval/q: test_ok.T.test_ok", [t["name"] for t in self.stage(self.saved(), "stage2")["tests"]])
        failures = self.stage(self.saved(), "stage2")["failures"]
        self.assertEqual(2, len(failures), failures)

    def test_a_failing_first_stage_fails_the_run_but_the_second_stage_still_runs(self):
        self.write("stage1_stub.py", "import json, sys\nprint(json.dumps({'ok': False, 'failures': [{'test': '見本の試験', 'reason': '見本の理由'}], 'warnings': [], 'checks': []}))\nsys.exit(1)\n")
        self.write("tests/creator/a/ok.test.mjs", PASSING_NODE)
        proc = self.run_cli()
        self.assertEqual(1, proc.returncode)
        result = self.saved()
        self.assertEqual("failed", self.stage(result, "stage1")["status"])
        self.assertEqual("passed", self.stage(result, "stage2")["status"])
        self.assertIn("見本の理由", proc.stdout.decode("utf-8"))

    def test_no_tests_at_all_is_reported_as_no_tests_and_is_not_a_failure(self):
        proc = self.run_cli()
        self.assertEqual(0, proc.returncode, proc.stdout.decode("utf-8"))
        self.assertEqual("none", self.stage(self.saved(), "stage2")["status"])
        self.assertIn("2段目 部品の試験: 試験なし", proc.stdout.decode("utf-8"))

    def test_missing_tool_stops_the_run_before_any_test(self):
        self.write("tests/creator/a/bad.test.mjs", FAILING_NODE)
        original = ent.tr.module_found
        with mock.patch.object(ent.tr, "module_found", lambda name: (False, "") if name == "tiktoken" else original(name)):
            result = ent.run(self.root, self.stage1, self.results)
        self.assertEqual("stopped", result["status"])
        self.assertEqual(2, result["exitCode"])
        self.assertEqual([], result["stages"])
        self.assertEqual(["tiktoken"], [m["id"] for m in result["tools"]["missing"]])
        self.assertIn("pip install tiktoken", result["tools"]["missing"][0]["howToInstall"])
        self.assertEqual("stopped", self.saved()["status"])

    def test_a_new_test_folder_added_under_creator_is_run_without_changing_the_entry(self):
        self.write("tests/creator/brand-new/new.test.mjs", PASSING_NODE)
        proc = self.run_cli("--json")
        self.assertEqual(0, proc.returncode)
        names = [t["name"] for t in json.loads(proc.stdout.decode("utf-8"))["stages"][1]["tests"]]
        self.assertEqual(["通る"], names)


if __name__ == "__main__":
    unittest.main()
