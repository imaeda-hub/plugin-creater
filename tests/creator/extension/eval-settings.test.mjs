// 2段目 部品の試験（クリエイターのエクステンション）：課題の作業ごとの設定の値が、作業の定義の案の設定に合うかの確かめ（eval-settings.mjs。X4-04）。
// 1段目（template/tests/stage1/check_structure.py の settings_problems）と同じ決まりを重ねて持つので、同じ場合分けを両方に渡して、誤りの数を比べる（ずれを見張る）。
// 設計書：REQ-038、hearing.md 6.5。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { EXTENSION_DIR, REPO_ROOT } from './helpers.mjs';
import { leftWordsIn } from './words.mjs';

const { evalSettingsProblems, evalTaskSettingsProblems, settingLabels } = await import(pathToFileURL(path.join(EXTENSION_DIR, 'eval-settings.mjs')).href);

const STAGE1 = path.join(REPO_ROOT, 'template', 'tests', 'stage1', 'check_structure.py');

const WEEK = { key: 'week', label: '対象の週', type: 'text', default: '', required: true };
const STYLE = { key: 'style', label: '書き方', type: 'select', default: '簡易', options: ['簡易', '詳細'] };
const STRICT = { key: 'strict', label: '厳しく見る', type: 'checkbox', default: false, required: true };
const COUNT = { key: 'count', label: '件数', type: 'number', default: 3 };
const REPORT = { key: 'report', label: '週報の場所', type: 'path', default: '' };
const ALL = [WEEK, STYLE, STRICT, COUNT, REPORT];

// [名前, 案の設定の一覧, 課題の作業ごとの設定の値, 誤りの数]
const CASES = [
  ['値も設定もない', [], {}, 0],
  ['設定はあるが、必須でないものだけ', [STYLE, COUNT], {}, 0],
  ['全部合っている', ALL, { week: 'W42', style: '詳細', strict: true, count: 2, report: 'a.docx' }, 0],
  ['案にない名前', ALL, { week: 'W42', weeks: 'x' }, 1],
  ['案に設定が1つもなく、名前がある', [], { week: 'x' }, 1],
  ['案にない名前が2つ', ALL, { week: 'W42', a: 1, b: 2 }, 2],
  ['text に数', ALL, { week: 42 }, 1],
  ['text に真偽', ALL, { week: true }, 1],
  ['path に数', ALL, { week: 'W42', report: 5 }, 1],
  ['number に文字', ALL, { week: 'W42', count: '3' }, 1],
  ['number に真偽（真偽は数ではない）', ALL, { week: 'W42', count: true }, 1],
  ['checkbox に文字', ALL, { week: 'W42', strict: 'true' }, 1],
  ['checkbox に数', ALL, { week: 'W42', strict: 1 }, 1],
  ['select の選択肢にない', ALL, { week: 'W42', style: '超詳細' }, 1],
  ['select に数', ALL, { week: 'W42', style: 1 }, 1],
  ['select の選択肢が { value } の形', [WEEK, { ...STYLE, options: [{ value: '簡易' }, { value: '詳細' }] }], { week: 'W42', style: '詳細' }, 0],
  ['select の選択肢が { value } の形で、ない値', [WEEK, { ...STYLE, options: [{ value: '簡易' }] }], { week: 'W42', style: '詳細' }, 1],
  ['必須で初めの値がなく、値もない', ALL, {}, 1],
  ['必須で初めの値がなく、値が空の文字', ALL, { week: '' }, 1],
  ['必須で初めの値がなく、値が空白だけ', ALL, { week: '   ' }, 1],
  ['必須で初めの値がなく、値が null', ALL, { week: null }, 2],
  ['必須で初めの値があるものは、値がなくてよい', [{ ...WEEK, default: '2026-W01' }], {}, 0],
  ['必須で初めの値が空白だけなら、値が要る', [{ ...WEEK, default: '  ' }], {}, 1],
  ['必須の number で初めの値が 0 なら、値がなくてよい', [{ key: 'n', label: '数', type: 'number', default: 0, required: true }], {}, 0],
  ['必須の number で初めの値がなく、値もない', [{ key: 'n', label: '数', type: 'number', required: true }], {}, 1],
  ['必須の number で初めの値がなく、値が文字（型の誤りと値なしではない）', [{ key: 'n', label: '数', type: 'number', required: true }], { n: 'x' }, 1],
  ['必須の number で初めの値がなく、値が空の文字（型の誤りと値なし）', [{ key: 'n', label: '数', type: 'number', required: true }], { n: '' }, 2],
  ['必須の checkbox は、値がなくてよい', [STRICT], {}, 0],
  ['必須でない設定は、値がなくてよい', [{ ...WEEK, required: false }], {}, 0],
  ['誤りが重なる（案にない名前、型、選択肢、必須）', ALL, { weeks: 'x', style: '超詳細', count: 'x' }, 4],
  ['key が文字でない設定は、ないものとして扱う', [WEEK, { key: 5, label: 'x', type: 'text' }, 'x', null], { week: 'W42' }, 0],
];

describe('作業ごとの設定の値の確かめ（eval-settings.mjs）', () => {
  test('REQ-038 課題の作業ごとの設定の値は、案の設定の名前・種類・選択肢・必須に合うかを確かめる。誤りの数は表のとおり', () => {
    for (const [name, settings, given, count] of CASES) {
      const problems = evalSettingsProblems(settings, given, '課題 1 ');
      assert.equal(problems.length, count, `${name}：${problems.join(' / ')}`);
      for (const problem of problems) {
        assert.ok(problem.startsWith('課題 1 の作業ごとの設定'), problem);
        assert.deepEqual(leftWordsIn(problem), [], problem);
      }
    }
  });

  test('REQ-038 作業ごとの設定（task）を省いた課題は、空の値として比べる：必須で初めの値のない設定があれば誤りになる（X4-04 の続き）', () => {
    for (const evalSettings of [undefined, {}, { maxIterations: 2 }, { task: {} }]) {
      const problems = evalTaskSettingsProblems(ALL, evalSettings, 'T ');
      assert.equal(problems.length, 1, JSON.stringify(evalSettings));
      assert.match(problems[0], /^T の作業ごとの設定に、必須の設定「対象の週」（week）の値がありません/);
      // 必須で初めの値のある設定、必須でない設定、チェックの設定だけなら、省いてよい
      assert.deepEqual(evalTaskSettingsProblems([{ ...WEEK, default: '2026-W01' }, STYLE, STRICT, COUNT], evalSettings, 'T '), []);
      assert.deepEqual(evalTaskSettingsProblems([], evalSettings, 'T '), []);
    }
  });

  test('REQ-038 案にない名前の文は、案にある設定の名前（key）を、案の並びのまま示す。なければ「なし」', () => {
    assert.deepEqual(evalSettingsProblems(ALL, { weeks: 'x', week: 'W42' }, '課題 1 '), [
      '課題 1 の作業ごとの設定「weeks」が、画面と合格の条件の設定の案の設定にありません（案にある設定の名前：week、style、strict、count、report）。',
    ]);
    assert.match(evalSettingsProblems([], { a: 1 }, '課題 1 ')[0], /（案にある設定の名前：（なし））。$/);
    assert.match(evalSettingsProblems(undefined, { a: 1 }, '課題 1 ')[0], /（案にある設定の名前：（なし））。$/);
    assert.match(evalSettingsProblems('設定', { a: 1 }, '課題 1 ')[0], /（案にある設定の名前：（なし））。$/);
  });

  test('REQ-038 型と選択肢と必須の文は、何がどう違うかを言う', () => {
    const one = (settings, given) => evalSettingsProblems(settings, given, 'T ')[0];
    assert.equal(one(ALL, { week: 5 }), 'T の作業ごとの設定「week」の値は、文字で渡してください。');
    assert.equal(one(ALL, { week: 'W', count: 'x' }), 'T の作業ごとの設定「count」の値は、数で渡してください。');
    assert.equal(one(ALL, { week: 'W', strict: 'x' }), 'T の作業ごとの設定「strict」の値は、true か false で渡してください。');
    assert.equal(one(ALL, { week: 'W', style: '超詳細' }), 'T の作業ごとの設定「style」の値 「超詳細」 が、案の選択肢（簡易、詳細）にありません。');
    assert.equal(one(ALL, {}), 'T の作業ごとの設定に、必須の設定「対象の週」（week）の値がありません（案に初めの値がないので、画面で開始できません）。');
  });

  test('REQ-038 X4-13 案の設定の見出し（label）を、名前（key）から引ける。見出しが空・ない設定は含めない', () => {
    assert.deepEqual(settingLabels(ALL), { week: '対象の週', style: '書き方', strict: '厳しく見る', count: '件数', report: '週報の場所' });
    assert.deepEqual(settingLabels([{ key: 'a', type: 'text' }, { key: 'b', label: '  ', type: 'text' }, { key: 'c', label: 'C', type: 'text' }, null, 'x', { key: 3, label: 'y' }]), { c: 'C' });
    assert.deepEqual(settingLabels(undefined), {});
  });
});

/** python3 と 1段目のスクリプトがあれば false、なければ飛ばす理由（node:test の skip に渡す） */
function stage1Missing() {
  if (!fs.existsSync(STAGE1)) return `${STAGE1} がない`;
  const r = spawnSync('python3', ['-I', '-c', 'import sys'], { encoding: 'utf8' });
  return r.status === 0 ? false : 'python3 がない';
}

describe('1段目との食い違いの見張り', { skip: stage1Missing() }, () => {
  test('REQ-038 同じ場合分けを 1段目の settings_problems に渡して、誤りの数が同じである（重ねて持つ決まりがずれていない）', () => {
    const script = [
      'import importlib.util, json, sys',
      `spec = importlib.util.spec_from_file_location("check_structure", ${JSON.stringify(STAGE1)})`,
      'module = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(module)',
      'cases = json.load(sys.stdin)',
      'print(json.dumps([len(module.settings_problems({"settings": c["settings"]}, c["given"], "eval.json")) for c in cases]))',
    ].join('\n');
    const python = spawnSync('python3', ['-I', '-c', script], {
      input: JSON.stringify(CASES.map(([, settings, given]) => ({ settings, given }))),
      encoding: 'utf8',
    });
    assert.equal(python.status, 0, python.stderr);
    const counts = JSON.parse(python.stdout);
    CASES.forEach(([name, settings, given], i) => {
      assert.equal(evalSettingsProblems(settings, given, 'T ').length, counts[i], `${name}：1段目は ${counts[i]} 件`);
    });
    assert.equal(counts.length, CASES.length);
  });

  test('REQ-038 作業ごとの設定を省いた課題も、1段目の check_eval と誤りの数が同じである（省き方：settings なし、settings のみ、task が空）', () => {
    // 課題の settings の書き方の違い。"$absent" は settings 自体を書かない
    const variants = (given) =>
      Object.keys(given).length === 0 ? ['$absent', {}, { maxIterations: 2 }, { task: {} }] : [{ task: given }, { maxIterations: 2, task: given }];
    // 値が null の例は除く（confirm は形の誤りとして先に断り、1段目は check_eval の形の検査が別の誤りを足すため、数が合わない）
    const combos = CASES.filter(([, , given]) => !Object.values(given).includes(null)).flatMap(([name, settings, given]) => variants(given).map((evalSettings) => ({ name, settings, evalSettings })));
    const script = [
      'import importlib.util, json, os, sys, tempfile',
      `spec = importlib.util.spec_from_file_location("check_structure", ${JSON.stringify(STAGE1)})`,
      'cs = importlib.util.module_from_spec(spec)',
      'spec.loader.exec_module(cs)',
      'combos = json.load(sys.stdin)',
      'root = tempfile.mkdtemp()',
      'os.makedirs(os.path.join(root, "tests", "eval", "T-01"))',
      'counts = []',
      'for c in combos:',
      '    task = {"id": "T-01", "prompt": "x", "criteria": []}',
      '    if c["evalSettings"] != "$absent":',
      '        task["settings"] = c["evalSettings"]',
      '    with open(os.path.join(root, "tests", "eval", "T-01", "eval.json"), "w", encoding="utf-8") as f:',
      '        json.dump(task, f)',
      '    ctx = cs.Context(root)',
      '    ctx.task = {"settings": c["settings"], "criteria": []}',
      '    check = cs.Check("eval", "eval")',
      '    cs.check_eval(ctx, check)',
      '    counts.append(len([e for e in check.errors if ".settings.task" in e]))',
      'print(json.dumps(counts))',
    ].join('\n');
    const python = spawnSync('python3', ['-I', '-c', script], { input: JSON.stringify(combos), encoding: 'utf8' });
    assert.equal(python.status, 0, python.stderr);
    const counts = JSON.parse(python.stdout);
    assert.equal(counts.length, combos.length);
    combos.forEach(({ name, settings, evalSettings }, i) => {
      const js = evalTaskSettingsProblems(settings, evalSettings === '$absent' ? undefined : evalSettings, 'T ').length;
      assert.equal(js, counts[i], `${name}／課題の settings：${JSON.stringify(evalSettings)}：1段目は ${counts[i]} 件`);
    });
    // 省いた課題が空振りでないこと：必須で初めの値のない設定のある案では、省くと誤りになる
    const omitted = combos.map((c, i) => [c, counts[i]]).filter(([c]) => c.name === '必須で初めの値がなく、値もない');
    assert.equal(omitted.length, 4);
    for (const [, count] of omitted) assert.equal(count, 1);
  });
});

