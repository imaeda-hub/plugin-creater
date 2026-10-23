// 見込み（estimate.mjs）と、結果の置き場所・集計・前の記録の探し方（results.mjs）の試験。
// 確かめる要件：REQ-040（EVAL の前に、回数と AI クレジットの見込みを示す）、REQ-041（あり・なしの点数とその差、使った AI クレジット）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { cleanupTemp, loadScript, makeTemp, sampleTask, tempWith } from './helpers.mjs';

const estimate = await loadScript('estimate.mjs');
const results = await loadScript('results.mjs');
after(cleanupTemp);

/** 実行の記録の見本 */
const run = (task, variant, n, extra = {}) => ({
  task,
  variant,
  n,
  status: 'completed',
  score: 1,
  credits: 1,
  creditsStatus: 'complete',
  judgments: 0,
  judgeCredits: 0,
  judgeCreditsStatus: 'complete',
  ...extra,
});

const evalResult = (runs, extra = {}) => ({ kind: 'eval', status: 'completed', runs, ...extra });

function pluginWithTasks(taskCount, { modelCriteria = 0 } = {}) {
  const files = {};
  for (let i = 1; i <= taskCount; i += 1) {
    const task = sampleTask({ id: `T-0${i}` });
    for (let k = 0; k < modelCriteria; k += 1) task.criteria.push({ id: `M-0${k + 1}`, text: '読みやすい', grading: 'model' });
    files[`tests/eval/T-0${i}/eval.json`] = JSON.stringify(task);
  }
  return tempWith(files, 'c3-plugin-');
}

function writePrevious(plugin, name, json) {
  const dir = path.join(plugin, 'tests', 'results', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'result.json'), typeof json === 'string' ? json : JSON.stringify(json));
}

describe('結果の置き場所', () => {
  test('REQ-041 結果のフォルダは eval-<日時>（ローカルの時刻）。同じ名前があれば番号を付ける', () => {
    const date = new Date(2026, 9, 22, 9, 5, 7);
    assert.equal(results.evalDirName(date), 'eval-20261022-090507');
    const plugin = makeTemp('c3-plugin-');
    const first = results.createResultsDir(plugin, date);
    const second = results.createResultsDir(plugin, date);
    assert.equal(first, path.join(plugin, 'tests', 'results', 'eval-20261022-090507'));
    assert.equal(second, path.join(plugin, 'tests', 'results', 'eval-20261022-090507-2'));
    assert.ok(fs.statSync(first).isDirectory() && fs.statSync(second).isDirectory());
  });

  test('REQ-041 JSON は、一時ファイルを残さず、読む側が書きかけを見ないように書く', () => {
    const dir = makeTemp();
    const file = path.join(dir, 'sub', 'result.json');
    results.writeJsonAtomic(file, { a: 'あ' });
    results.writeJsonAtomic(file, { a: 'い' });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { a: 'い' });
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['result.json']);
  });

  test('REQ-041 nano-AIU は 10億で割って AI クレジットにする', () => {
    assert.equal(results.nanoAiuToCredits(2_500_000_000), 2.5);
    assert.equal(results.nanoAiuToCredits(0), 0);
  });
});

describe('集計', () => {
  test('REQ-041 あり・なしの点数は実行の平均、差はありからなしを引いた値。課題ごとにも出る', () => {
    const runs = [
      run('T-01', 'with', 1, { score: 1 }),
      run('T-01', 'with', 2, { score: 0.5 }),
      run('T-01', 'without', 1, { score: 0.25 }),
      run('T-01', 'without', 2, { score: 0.25 }),
      run('T-02', 'with', 1, { score: 1 }),
      run('T-02', 'without', 1, { score: 0 }),
    ];
    const s = results.summarizeRuns(runs);
    assert.equal(s.scores.with, results.summarizeRuns(runs.filter((r) => r.variant === 'with')).scores.with);
    assert.equal(s.scores.with, 0.833333);
    assert.equal(s.scores.without, 0.166667);
    assert.equal(s.scores.difference, 0.666667, '差は丸める前の値から出す');
    assert.deepEqual(s.scores.byTask['T-01'], { with: 0.75, without: 0.25, difference: 0.5 });
    assert.deepEqual(s.scores.byTask['T-02'], { with: 1, without: 0, difference: 1 });
  });

  test('REQ-041 試験の仕組みの失敗・試験全体が止まった・始めなかった実行は、点数に入れない。終わりまで動かなかった実行は、できていた分を入れる', () => {
    const runs = [
      run('T-01', 'with', 1, { score: 1 }),
      run('T-01', 'with', 2, { status: 'incomplete', score: 0 }),
      run('T-01', 'with', 3, { status: 'error', score: null }),
      run('T-01', 'with', 4, { status: 'stopped', score: null }),
      run('T-01', 'with', 5, { status: 'skipped', score: null, credits: 0 }),
      run('T-01', 'without', 1, { score: 0.5 }),
    ];
    const s = results.summarizeRuns(runs);
    assert.equal(s.scores.with, 0.5);
    assert.equal(s.scores.without, 0.5);
    assert.equal(s.scores.difference, 0);
    assert.deepEqual(s.counts.byStatus, { completed: 2, incomplete: 1, error: 1, stopped: 1, skipped: 1 });
    assert.equal(s.counts.graded, 3);
  });

  test('REQ-041 なしの実行がまだないとき、差は null になる', () => {
    const s = results.summarizeRuns([run('T-01', 'with', 1)]);
    assert.equal(s.scores.with, 1);
    assert.equal(s.scores.without, null);
    assert.equal(s.scores.difference, null);
  });

  test('REQ-041 使った AI クレジットは、あり・なし・採点にモデルを使った分に分けて足し、合計を出す', () => {
    const runs = [
      run('T-01', 'with', 1, { credits: 10.5, judgeCredits: 0.25, judgments: 2 }),
      run('T-01', 'without', 1, { credits: 2.25, judgeCredits: 0.25, judgments: 2 }),
    ];
    const s = results.summarizeRuns(runs);
    assert.deepEqual(s.creditDetail, { with: 10.5, without: 2.25, grading: 0.5, status: 'complete' });
    assert.equal(s.credits, 13.25);
    assert.equal(s.counts.judgments, 4);
  });

  test('REQ-041 数えきれなかった呼び出しがある実行があれば、AI クレジットの状態は partial になる', () => {
    const runs = [run('T-01', 'with', 1), run('T-01', 'without', 1, { creditsStatus: 'partial' })];
    assert.equal(results.summarizeRuns(runs).creditDetail.status, 'partial');
    assert.equal(results.summarizeRuns([run('T-01', 'with', 1, { judgeCreditsStatus: 'partial' })]).creditDetail.status, 'partial');
  });
});

describe('前の EVAL の記録', () => {
  test('REQ-040 最後まで動いた記録だけを、新しい順に探す（途中で止まった記録・壊れた記録・ほかのフォルダは飛ばす）', () => {
    const plugin = makeTemp('c3-plugin-');
    writePrevious(plugin, 'eval-20261020-100000', evalResult([run('T-01', 'with', 1)]));
    writePrevious(plugin, 'eval-20261021-100000', evalResult([run('T-01', 'with', 1)], { status: 'stopped' }));
    writePrevious(plugin, 'eval-20261022-100000', evalResult([run('T-01', 'with', 1)]));
    writePrevious(plugin, 'eval-20261023-100000', '{ 壊れている');
    writePrevious(plugin, 'latest', evalResult([]));
    writePrevious(plugin, 'eval-20261024-100000', { kind: 'stages', status: 'completed', runs: [] });
    assert.deepEqual(results.findPreviousEvals(plugin).map((p) => p.name), ['eval-20261022-100000', 'eval-20261020-100000']);
    assert.deepEqual(results.findPreviousEvals(makeTemp('c3-empty-')), []);
  });

  test('REQ-040 1回分は、あり・なしそれぞれの実行の平均。モデルの判定1件の分も出す。どちらかの実行がなければ使えない', () => {
    const previous = {
      name: 'eval-1',
      json: evalResult(
        [
          run('T-01', 'with', 1, { credits: 10, judgments: 2, judgeCredits: 0.5 }),
          run('T-01', 'with', 2, { credits: 14, judgments: 2, judgeCredits: 0.5 }),
          run('T-01', 'without', 1, { credits: 2, judgments: 2, judgeCredits: 0.5 }),
          run('T-01', 'without', 2, { status: 'error', credits: 99 }),
        ],
        { creditDetail: { status: 'complete' } },
      ),
    };
    const per = results.perRunCredits(previous);
    assert.deepEqual(per, { from: 'eval-1', withPlugin: 12, withoutPlugin: 2, judgment: 0.25, partial: false, runs: { with: 2, without: 1 } });
    assert.equal(results.perRunCredits({ name: 'x', json: evalResult([run('T-01', 'with', 1)]) }), null);
    const noJudge = results.perRunCredits({ name: 'x', json: evalResult([run('T-01', 'with', 1), run('T-01', 'without', 1)]) });
    assert.equal(noJudge.judgment, null);
  });
});

describe('見込み', () => {
  const taskOf = (id, model = 0) => ({
    id,
    dir: '/x',
    json: sampleTask({ id, criteria: [{ id: 'C-01', text: 'a', grading: 'program', check: { type: 'file_exists', file: 'a' } }, ...Array.from({ length: model }, (_, i) => ({ id: `M-${i}`, text: 'm', grading: 'model' }))] }),
  });

  test('REQ-040 前の記録があれば、（あり ＋ なし）× 課題の数 × 回数 ＋ モデルの判定の分、で出す', () => {
    const previous = { from: 'eval-20261022-100000', withPlugin: 12, withoutPlugin: 2, judgment: 0.25, partial: false };
    const out = estimate.computeEstimate({ tasks: [taskOf('T-01', 2), taskOf('T-02', 1)], runs: 3, previous });
    // (12 + 2) × 2課題 × 3回 = 84、判定は model の基準 3 × 3回 × 2 = 18件 × 0.25 = 4.5
    assert.equal(out.credits.estimate, 88.5);
    assert.equal(out.credits.basis, 'previous');
    assert.equal(out.credits.basisFrom, 'eval-20261022-100000');
    assert.equal(out.credits.complete, true);
    assert.equal(out.credits.isLimit, false);
    assert.deepEqual(out.credits.parts, { runs: 84, judging: 4.5 });
    assert.deepEqual(out.counts.runs, { with: 6, without: 6, total: 12 });
    assert.equal(out.counts.judgments, 18);
    assert.equal(out.counts.modelCriteria, 3);
    assert.equal(out.counts.programCriteria, 2);
    assert.match(out.message, /課題 2 件を、生成プラグインあり・なしのそれぞれで 3 回ずつ、合わせて 12 回動かします。/);
    assert.match(out.message, /eval-20261022-100000/);
    assert.match(out.message, /約 89 AI クレジット/);
    assert.match(out.message, /見込みは上限ではありません/);
  });

  test('REQ-040 前の記録も目安もないとき、見込みは出さず、目安がまだないことが出力で分かる（回数は示す）', () => {
    const out = estimate.computeEstimate({ tasks: [taskOf('T-01')], runs: 3, previous: null, guideline: { measured: false, withPlugin: null, withoutPlugin: null, judgment: null } });
    assert.equal(out.credits.estimate, null);
    assert.equal(out.credits.basis, 'none');
    assert.equal(out.credits.complete, false);
    assert.equal(out.guideline.measured, false);
    assert.deepEqual(out.counts.runs, { with: 3, without: 3, total: 6 });
    assert.match(out.message, /見込みは出せません/);
    assert.match(out.message, /目安もまだ測っていない/);
    assert.match(out.message, /合わせて 6 回動かします/);
  });

  test('REQ-040 前の記録がなくても、目安の値があれば、それで出す', () => {
    const guideline = { measured: true, withPlugin: 20, withoutPlugin: 5, judgment: null };
    const out = estimate.computeEstimate({ tasks: [taskOf('T-01')], runs: 3, previous: null, guideline });
    assert.equal(out.credits.estimate, 75);
    assert.equal(out.credits.basis, 'guideline');
    assert.equal(out.credits.basisFrom, null);
    assert.equal(out.guideline.measured, true);
    assert.match(out.message, /目安をもとにした見込みは、約 75 AI クレジット/);
  });

  test('REQ-040 前の記録があれば、目安より前の記録を使う', () => {
    const previous = { from: 'eval-1', withPlugin: 1, withoutPlugin: 1, judgment: null };
    const guideline = { measured: true, withPlugin: 20, withoutPlugin: 5, judgment: null };
    assert.equal(estimate.computeEstimate({ tasks: [taskOf('T-01')], runs: 2, previous, guideline }).credits.estimate, 4);
  });

  test('REQ-040 モデルの判定の費用を測っていないのに model の基準があるときは、その分を含めず、含めていないことを示す', () => {
    const previous = { from: 'eval-1', withPlugin: 10, withoutPlugin: 0, judgment: null };
    const out = estimate.computeEstimate({ tasks: [taskOf('T-01', 1)], runs: 1, previous });
    assert.equal(out.credits.estimate, 10);
    assert.equal(out.credits.complete, false);
    assert.equal(out.credits.parts.judging, null);
    assert.match(out.message, /採点にモデルを使う分は、1件の判定の費用をまだ測っていないので、見込みに含めていません/);
    const noModel = estimate.computeEstimate({ tasks: [taskOf('T-01', 0)], runs: 1, previous });
    assert.equal(noModel.credits.complete, true, 'model の基準がなければ、判定の費用は要らない');
  });

  test('REQ-040 前の記録が一部しか数えられていないときは、実際より少ないかもしれないと示す', () => {
    const previous = { from: 'eval-1', withPlugin: 10, withoutPlugin: 1, judgment: null, partial: true };
    assert.match(estimate.computeEstimate({ tasks: [taskOf('T-01')], runs: 1, previous }).message, /実際より少ないかもしれません/);
  });

  test('REQ-040 estimatePlugin：生成プラグインの課題を読み、前の記録の中の新しいほうを使う', () => {
    const plugin = pluginWithTasks(2, { modelCriteria: 1 });
    writePrevious(plugin, 'eval-20261020-100000', evalResult([run('T-01', 'with', 1, { credits: 100 }), run('T-01', 'without', 1, { credits: 100 })]));
    writePrevious(
      plugin,
      'eval-20261022-100000',
      evalResult([run('T-01', 'with', 1, { credits: 8, judgments: 1, judgeCredits: 1 }), run('T-01', 'without', 1, { credits: 2, judgments: 1, judgeCredits: 1 })]),
    );
    const out = estimate.estimatePlugin({ pluginDir: plugin, runs: 2 });
    assert.equal(out.ok, true);
    assert.deepEqual(out.tasks.map((t) => [t.id, t.criteria, t.modelCriteria]), [['T-01', 3, 1], ['T-02', 3, 1]]);
    // (8 + 2) × 2課題 × 2回 = 40、判定は 2課題 × 1 × 2回 × 2 = 8件 × 1 = 8
    assert.equal(out.credits.estimate, 48);
    assert.equal(out.credits.basisFrom, 'eval-20261022-100000');
  });

  test('REQ-040 estimatePlugin：記録がなく、目安もまだ測っていない今は、見込みを出さず、そのことが分かる', () => {
    const out = estimate.estimatePlugin({ pluginDir: pluginWithTasks(1), runs: 3 });
    assert.equal(out.ok, true);
    if (estimate.GUIDELINE.measured) {
      assert.equal(out.credits.basis, 'guideline');
    } else {
      assert.equal(out.credits.estimate, null);
      assert.equal(out.credits.basis, 'none');
      assert.equal(out.guideline.measured, false);
    }
    assert.equal(out.counts.runs.total, 6);
  });

  test('REQ-040 estimatePlugin：課題に誤りがあるときは、見込みを出さずに誤りを返す', () => {
    const out = estimate.estimatePlugin({ pluginDir: tempWith({ 'tests/eval/T-01/eval.json': '{"id":"T-01"}' }), runs: 3 });
    assert.equal(out.ok, false);
    assert.match(out.problems.join('\n'), /prompt/);
  });
});
