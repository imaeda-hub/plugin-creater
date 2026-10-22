"""試験の入口（tests/run.py）の試験。

動かし方（この selftest フォルダで）:  python3 -m unittest discover -s . -p "test_*.py"
node が入っていない環境では、node を使う試験は飛ばす。
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
STAGE1 = os.path.dirname(HERE)
TESTS = os.path.dirname(STAGE1)
TASK_SCHEMA = os.path.join(os.path.dirname(TESTS), "com.github.copilot", "extensions", "_plugin_", "core", "task.schema.json")
GOOD = os.path.join(HERE, "samples", "good")
CHECK = os.path.join(STAGE1, "check_structure.py")
RUN = os.path.join(TESTS, "run.py")

sys.path.insert(0, TESTS)
import run as entry  # noqa: E402

HAS_NODE = entry.node_version()[0]


class Plugin(unittest.TestCase):
    """見本を一時フォルダに写して、入口を動かす土台。"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.root = os.path.join(self.tmp, "plugin")
        shutil.copytree(GOOD, self.root)
        ext = os.path.join(self.root, "com.github.copilot", "extensions", "sample-plugin", "core")
        os.makedirs(ext)
        shutil.copy(TASK_SCHEMA, ext)
        self.stage2 = os.path.join(self.root, "tests", "stage2")
        self.results = os.path.join(self.root, "tests", "results", "latest.json")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write(self, rel, text):
        path = os.path.join(self.root, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    def run_entry(self, needs=None):
        return entry.run(self.root, CHECK, self.stage2, self.results, needs or [])

    def run_cli(self, *extra):
        cmd = [sys.executable, RUN, "--root", self.root, "--stage1-script", CHECK, "--stage2-dir", self.stage2] + list(extra)
        return subprocess.run(cmd, capture_output=True)

    def stage(self, result, stage_id):
        return [s for s in result["stages"] if s["id"] == stage_id][0]


class Tools(unittest.TestCase):
    def test_REQ_048_node_versions_the_copilot_sdk_needs(self):
        for version, ok in (((20, 18), False), ((20, 19), True), ((21, 9), False), ((22, 11), False), ((22, 12), True), ((23, 0), True), ((24, 1), True)):
            self.assertEqual(ok, entry.node_supported(*version), version)

    def test_REQ_048_python_is_checked_against_3_9(self):
        ok, found = entry.python_version()
        self.assertEqual(sys.version_info >= (3, 9), ok)
        self.assertTrue(found.startswith("%d.%d" % sys.version_info[:2]))

    def test_REQ_048_node_and_playwright_are_needed_only_when_such_tests_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual((["python", "pyyaml", "jsonschema"], tmp), entry.gather_needs(tmp, []))
            os.makedirs(os.path.join(tmp, "core"))
            with open(os.path.join(tmp, "core", "a.test.mjs"), "w") as f:
                f.write("import test from 'node:test';\n")
            self.assertEqual(["python", "pyyaml", "jsonschema", "node"], entry.gather_needs(tmp, [])[0])
            os.makedirs(os.path.join(tmp, "ui"))
            with open(os.path.join(tmp, "ui", "screen.test.mjs"), "w") as f:
                f.write("import { chromium } from 'playwright';\n")
            needs, probe = entry.gather_needs(tmp, ["tiktoken"])
            self.assertEqual(["python", "pyyaml", "jsonschema", "node", "playwright", "browser", "tiktoken"], needs)
            self.assertEqual(os.path.join(tmp, "ui"), probe)

    def test_REQ_048_test_files_under_node_modules_are_not_ours(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "node_modules", "pkg"))
            with open(os.path.join(tmp, "node_modules", "pkg", "x.test.mjs"), "w") as f:
                f.write("")
            self.assertEqual([], entry.find_node_tests(tmp))


class ParseTap(unittest.TestCase):
    SAMPLE = """TAP version 13
# Subtest: REQ-009 通る
ok 1 - REQ-009 通る
  ---
  duration_ms: 1.2
  type: 'test'
  ...
# Subtest: REQ-010 落ちる
not ok 2 - REQ-010 落ちる
  ---
  duration_ms: 1.3
  type: 'test'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:

    1 !== 2

  code: 'ERR_ASSERTION'
  stack: |-
    at somewhere
  ...
# Subtest: グループ
    # Subtest: REQ-011 入れ子の通る
    ok 1 - REQ-011 入れ子の通る
      ---
      type: 'test'
      ...
    # Subtest: REQ-012 入れ子の落ちる
    not ok 2 - REQ-012 入れ子の落ちる
      ---
      type: 'test'
      failureType: 'testCodeFailure'
      error: '壊れた'
      ...
    # Subtest: REQ-013 飛ばす
    ok 3 - REQ-013 飛ばす # SKIP
      ---
      type: 'test'
      ...
    1..3
not ok 3 - グループ
  ---
  type: 'suite'
  failureType: 'subtestsFailed'
  error: '1 subtest failed'
  ...
# Subtest: REQ-014 あとで
ok 4 - REQ-014 あとで # TODO
  ---
  type: 'test'
  ...
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/x/nonexistent.mjs'
#     at finalizeResolution
# Subtest: b.test.mjs
not ok 5 - b.test.mjs
  ---
  type: 'test'
  failureType: 'testCodeFailure'
  exitCode: 1
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..5
# tests 7
"""

    def test_REQ_039_results_are_read_with_their_reasons(self):
        tests = {t["name"]: t for t in entry.parse_tap(self.SAMPLE)}
        self.assertEqual("passed", tests["REQ-009 通る"]["status"])
        self.assertEqual("failed", tests["REQ-010 落ちる"]["status"])
        self.assertIn("1 !== 2", tests["REQ-010 落ちる"]["reason"])
        self.assertEqual("passed", tests["グループ > REQ-011 入れ子の通る"]["status"])
        self.assertEqual("壊れた", tests["グループ > REQ-012 入れ子の落ちる"]["reason"])
        self.assertEqual("skipped", tests["グループ > REQ-013 飛ばす"]["status"])
        self.assertEqual("skipped", tests["REQ-014 あとで"]["status"])

    def test_REQ_039_a_suite_that_only_reports_failed_children_is_not_counted(self):
        self.assertNotIn("グループ", [t["name"] for t in entry.parse_tap(self.SAMPLE)])

    def test_REQ_039_a_file_that_cannot_load_is_reported_with_the_error_line(self):
        failed = [t for t in entry.parse_tap(self.SAMPLE) if t["name"] == "b.test.mjs"][0]
        self.assertEqual("failed", failed["status"])
        self.assertIn("ERR_MODULE_NOT_FOUND", failed["reason"])
        self.assertIn("終了コード 1", failed["reason"])

    @unittest.skipUnless(HAS_NODE, "node がない")
    def test_REQ_039_real_node_output_is_parsed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "a.test.mjs")
            with open(path, "w", encoding="utf-8") as f:
                f.write("import test, { describe, it } from 'node:test';\nimport assert from 'node:assert/strict';\n"
                        "test('REQ-001 通る', () => {});\n"
                        "test('REQ-002 落ちる', () => { assert.equal(1, 2); });\n"
                        "describe('組', () => { it('REQ-003 入れ子の落ちる', () => { throw new Error('壊れた'); }); it.skip('REQ-004 飛ばす', () => {}); });\n")
            with open(os.path.join(tmp, "b.test.mjs"), "w", encoding="utf-8") as f:
                f.write("import x from './nothing.mjs';\n")
            tests = {t["name"]: t for t in entry.run_node_tests(tmp, [path, os.path.join(tmp, "b.test.mjs")])}   # 名前は根からの相対になる
        self.assertEqual("passed", tests["REQ-001 通る"]["status"])
        self.assertEqual("failed", tests["REQ-002 落ちる"]["status"])
        self.assertEqual("壊れた", tests["組 > REQ-003 入れ子の落ちる"]["reason"])
        self.assertEqual("skipped", tests["組 > REQ-004 飛ばす"]["status"])
        self.assertEqual("failed", tests["b.test.mjs"]["status"])
        self.assertNotIn("組", tests)


@unittest.skipUnless(HAS_NODE, "node がない")
class Entry(Plugin):
    def test_REQ_042_good_plugin_passes_both_stages_and_the_result_file_is_written(self):
        result = self.run_entry()
        self.assertEqual("passed", result["status"], result["stages"])
        self.assertEqual(0, result["exitCode"])
        self.assertEqual("passed", self.stage(result, "stage1")["status"])
        stage2 = self.stage(result, "stage2")
        self.assertEqual("passed", stage2["status"])
        self.assertEqual(2, stage2["counts"]["passed"])   # node:test が1件、unittest が1件
        with open(self.results, encoding="utf-8") as f:
            saved = json.load(f)
        self.assertEqual(result["status"], saved["status"])
        self.assertEqual(result["stages"], saved["stages"])

    def test_REQ_039_failures_are_listed_by_stage_with_their_reasons_and_the_exit_code_is_1(self):
        self.write("tests/stage2/core/bad.test.mjs", "import test from 'node:test';\ntest('REQ-007 落ちる', () => { throw new Error('わざと'); });\n")
        self.write("tests/stage2/task/test_bad.py", "import unittest\n\n\nclass T(unittest.TestCase):\n    def test_req_008_bad(self):\n        self.assertEqual(1, 2)\n"
                   "    def test_req_009_error(self):\n        raise RuntimeError('壊れた')\n    @unittest.skip('今は飛ばす')\n    def test_req_010_skip(self):\n        pass\n")
        proc = self.run_cli()
        self.assertEqual(1, proc.returncode, proc.stdout.decode("utf-8"))
        text = proc.stdout.decode("utf-8")
        self.assertIn("2段目 部品の試験: 不合格", text)
        self.assertIn("REQ-007 落ちる", text)
        self.assertIn("わざと", text)
        self.assertIn("test_req_008_bad", text)
        self.assertIn("1 != 2", text)
        self.assertIn("RuntimeError: 壊れた", text)
        with open(self.results, encoding="utf-8") as f:
            saved = json.load(f)
        self.assertEqual("failed", saved["status"])
        self.assertEqual(1, saved["exitCode"])
        failed = [f["test"] for f in self.stage(saved, "stage2")["failures"]]
        self.assertEqual(3, len(failed), failed)
        self.assertEqual(1, self.stage(saved, "stage2")["counts"]["skipped"])
        self.assertEqual("passed", self.stage(saved, "stage1")["status"])

    def test_REQ_039_stage1_failure_shows_the_test_and_the_reason(self):
        os.remove(os.path.join(self.root, "plugin.json"))
        proc = self.run_cli()
        self.assertEqual(1, proc.returncode)
        text = proc.stdout.decode("utf-8")
        self.assertIn("1段目 構造の検査: 不合格", text)
        self.assertIn("REQ-004 plugin.json が公式スキーマ", text)
        self.assertIn("plugin.json がない", text)
        self.assertIn("2段目 部品の試験: 合格", text)   # 1段目が落ちても2段目は動かす

    def test_REQ_042_stage_without_tests_is_reported_as_no_tests_and_is_not_a_failure(self):
        self.stage2 = os.path.join(self.tmp, "empty-stage2")   # 試験のない段階（追跡の表は、元の tests/stage2 を見る）
        os.makedirs(self.stage2)
        proc = self.run_cli()
        self.assertEqual(0, proc.returncode, proc.stdout.decode("utf-8"))
        self.assertIn("2段目 部品の試験: 試験なし", proc.stdout.decode("utf-8"))
        with open(self.results, encoding="utf-8") as f:
            self.assertEqual("none", self.stage(json.load(f), "stage2")["status"])

    def test_REQ_048_missing_tools_stop_the_run_and_are_listed_with_how_to_install(self):
        original = entry.module_found
        entry.module_found = lambda name: (False, "") if name == "jsonschema" else original(name)
        try:
            result = self.run_entry()
        finally:
            entry.module_found = original
        self.assertEqual("stopped", result["status"])
        self.assertEqual(2, result["exitCode"])
        self.assertEqual([], result["stages"])
        self.assertEqual(["jsonschema"], [m["id"] for m in result["tools"]["missing"]])
        self.assertIn("pip install jsonschema", result["tools"]["missing"][0]["howToInstall"])
        self.assertIn("足りない道具があるので止まりました", entry.format_text(result))
        with open(self.results, encoding="utf-8") as f:
            self.assertEqual("stopped", json.load(f)["status"])

    def test_REQ_048_unknown_extra_tool_stops_the_run(self):
        proc = self.run_cli("--need", "nonexistent-tool")
        self.assertEqual(2, proc.returncode)

    def test_REQ_042_json_flag_prints_the_same_result_as_the_file(self):
        proc = self.run_cli("--json")
        printed = json.loads(proc.stdout.decode("utf-8"))
        with open(self.results, encoding="utf-8") as f:
            self.assertEqual(printed, json.load(f))

    def test_REQ_042_results_path_can_be_chosen(self):
        other = os.path.join(self.tmp, "elsewhere", "r.json")
        self.assertEqual(0, self.run_cli("--results", other).returncode)
        self.assertTrue(os.path.isfile(other))
        self.assertFalse(os.path.exists(self.results))

    def test_REQ_042_node_tests_are_found_in_nested_folders_and_run_from_the_plugin_root(self):
        self.write("tests/stage2/ui/deep/cwd.test.mjs",
                   "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n"
                   "test('REQ-005 作業フォルダは根', () => { assert.ok(fs.existsSync('plugin.json')); });\n")
        result = self.run_entry()
        self.assertEqual("passed", self.stage(result, "stage2")["status"], self.stage(result, "stage2")["failures"])
        self.assertEqual(3, self.stage(result, "stage2")["counts"]["passed"])

    def test_REQ_039_a_python_test_file_that_cannot_be_imported_is_a_failure(self):
        self.write("tests/stage2/task/test_broken.py", "import module_that_does_not_exist\n")
        result = self.run_entry()
        stage2 = self.stage(result, "stage2")
        self.assertEqual("failed", stage2["status"])
        self.assertTrue(any("module_that_does_not_exist" in f["reason"] for f in stage2["failures"]), stage2["failures"])


if __name__ == "__main__":
    unittest.main()
