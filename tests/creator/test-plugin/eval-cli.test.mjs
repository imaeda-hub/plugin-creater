// EVAL の入口（skills/test-plugin/scripts/eval.mjs）の試験。estimate と run の引数、出力、終了コード。
// run は偽物の Copilot SDK・偽物の画面の操作で動かす。入口そのもの（node eval.mjs）は、道具が足りない場合と estimate を実際に動かして確かめる。
// 確かめる要件：REQ-040（EVAL の前に、回数と AI クレジットの見込みを示す）、REQ-041（結果を標準出力にも出す）、REQ-048（道具の置き場所）。
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { FAST_TIMING, createWorld } from './fake-sdk.mjs';
import { SCRIPTS_DIR, cleanupTemp, loadScript, makeTemp, sampleTask, tempWith } from './helpers.mjs';

const evalMod = await loadScript('eval.mjs');
const { ToolsMissingError } = await loadScript('tools.mjs');
const { ScreenError } = await loadScript('screen.mjs');
const { runEval } = await loadScript('run.mjs');
after(cleanupTemp);

const GOOD = { with: { 'out/週報.md': '売上は52万円でした' }, without: { 'out/週報.md': '売上は52万でした' } };

/** 出力を集める入れ物 */
const sink = () => {
  const chunks = [];
  return { write: (text) => chunks.push(text), text: () => chunks.join(''), json: () => JSON.parse(chunks.join('')) };
};

/** 偽物の部品をつないだ入口を動かす */
async function runMain(world, argv, extra = {}) {
  const stdout = sink();
  const stderr = sink();
  const made = { screens: [], judges: [], runOptions: [] };
  const code = await evalMod.main(argv, {
    stdout,
    stderr,
    env: { PATH: '/usr/bin' },
    loadTools: async () => ({ sdk: world.sdk, chromium: { fake: true }, extensionSdkPath: '/tools/node_modules/@github/copilot-sdk/dist', versions: { copilotSdk: '1.0.25', playwright: '1.56.1', node: process.version }, dir: '/tools' }),
    makeScreen: (args) => {
      made.screens.push(args);
      return world.screen;
    },
    makeJudge: (args) => {
      const judge = async () => ({ pass: true, reason: 'ok', credits: 0.1 });
      judge.close = async () => { judge.closed = true; };
      made.judges.push({ args, judge });
      return judge;
    },
    run: (opts) => {
      made.runOptions.push(opts);
      return runEval({ ...opts, timing: { ...FAST_TIMING, ...(opts.timing ?? {}) }, workRoot: makeTemp('c3-work-') });
    },
    ...extra,
  });
  return { code, stdout, stderr, made };
}

describe('引数', () => {
  const parse = evalMod.parseArgs;

  test('REQ-040 estimate と run の引数を読む（--名前 値 と --名前=値 のどちらでも）', () => {
    assert.deepEqual(parse(['estimate', '--plugin', '/p', '--runs', '3']), { command: 'estimate', options: { plugin: '/p', runs: 3 }, errors: [] });
    assert.deepEqual(parse(['run', '--plugin=/p', '--runs=2', '--model', 'gpt-6-luna', '--judge-model=claude-haiku-5.5', '--timeout-minutes', '0.5']), {
      command: 'run',
      options: { plugin: '/p', runs: 2, model: 'gpt-6-luna', 'judge-model': 'claude-haiku-5.5', 'timeout-minutes': 0.5 },
      errors: [],
    });
  });

  test('REQ-040 引数の誤りは、何が誤りかの文で返す', () => {
    const errors = (argv) => parse(argv).errors.join(' / ');
    assert.match(errors([]), /サブコマンド（estimate か run）がありません/);
    assert.match(errors(['start']), /「start」は使えません/);
    assert.match(errors(['estimate']), /--plugin がありません.*--runs がありません/);
    assert.match(errors(['estimate', '--plugin', '/p', '--runs', '0']), /--runs は1以上の整数/);
    assert.match(errors(['estimate', '--plugin', '/p', '--runs', '1.5']), /--runs は1以上の整数/);
    assert.match(errors(['estimate', '--plugin', '/p', '--runs', 'x']), /--runs は1以上の整数/);
    assert.match(errors(['estimate', '--plugin', '/p', '--runs', '3', '--model', 'm']), /--model は estimate では使えません/);
    assert.match(errors(['run', '--plugin', '/p', '--runs', '3', '--timeout-minutes', '-1']), /--timeout-minutes は0より大きい数/);
    assert.match(errors(['run', '--plugin', '/p', '--runs']), /--runs に値がありません/);
    assert.match(errors(['run', '--plugin', '--runs', '3']), /--plugin に値がありません/);
    assert.match(errors(['run', '--plugin', '/p', '--runs', '3', '--force']), /「--force」は使えません/);
    assert.match(errors(['run', '--plugin', '/p', '--runs', '3', 'extra']), /「extra」は使えません/);
  });
});

describe('estimate', () => {
  test('REQ-040 回数と AI クレジットの見込みを JSON で出す（モデルは使わない）。終了コードは 0', async () => {
    const plugin = tempWith({ 'plugin.json': JSON.stringify({ name: 'weekly-report', version: '1.0.0' }), 'tests/eval/T-01/eval.json': JSON.stringify(sampleTask()) });
    const { code, stdout } = await runMain(createWorld(), ['estimate', '--plugin', plugin, '--runs', '3']);
    assert.equal(code, 0);
    const out = stdout.json();
    assert.equal(out.ok, true);
    assert.equal(out.runsPerTask, 3);
    assert.deepEqual(out.counts.runs, { with: 3, without: 3, total: 6 });
    assert.equal(out.plugin.name, 'weekly-report');
    assert.equal(typeof out.message, 'string');
    assert.equal(out.credits.basis, 'none', '前の記録も目安もまだない');
    assert.equal(out.credits.estimate, null);
    assert.equal(out.guideline.measured, false);
  });

  test('REQ-040 前の EVAL の記録があれば、その値から見込みを出す', async () => {
    const plugin = tempWith({ 'plugin.json': JSON.stringify({ name: 'weekly-report' }), 'tests/eval/T-01/eval.json': JSON.stringify(sampleTask()) });
    const prev = path.join(plugin, 'tests', 'results', 'eval-20261022-100000');
    fs.mkdirSync(prev, { recursive: true });
    const run = (variant, credits) => ({ task: 'T-01', variant, n: 1, status: 'completed', score: 1, credits, creditsStatus: 'complete' });
    fs.writeFileSync(path.join(prev, 'result.json'), JSON.stringify({ kind: 'eval', status: 'completed', runs: [run('with', 8), run('without', 2)] }));
    const { code, stdout } = await runMain(createWorld(), ['estimate', '--plugin', plugin, '--runs', '2']);
    assert.equal(code, 0);
    assert.equal(stdout.json().credits.estimate, 20);
    assert.equal(stdout.json().credits.basisFrom, 'eval-20261022-100000');
  });

  test('REQ-040 課題に誤りがあるとき、plugin.json がないとき、引数の誤りのときは、見込みを出さず、終了コード 2 で理由を出す', async () => {
    const bad = tempWith({ 'plugin.json': JSON.stringify({ name: 'x' }), 'tests/eval/T-01/eval.json': '{"id":"T-01"}' });
    const a = await runMain(createWorld(), ['estimate', '--plugin', bad, '--runs', '3']);
    assert.equal(a.code, 2);
    assert.equal(a.stdout.json().ok, false);
    assert.equal(a.stdout.json().error, 'tasks_invalid');
    assert.match(a.stdout.json().message, /prompt/);
    const b = await runMain(createWorld(), ['estimate', '--plugin', makeTemp('c3-none-'), '--runs', '3']);
    assert.equal(b.code, 2);
    assert.equal(b.stdout.json().error, 'plugin_not_found');
    const c = await runMain(createWorld(), ['estimate', '--runs', '3']);
    assert.equal(c.code, 2);
    assert.equal(c.stdout.json().error, 'usage');
    assert.ok(c.stdout.json().usage.length === 2);
  });
});

describe('run', () => {
  test('REQ-041 EVAL を動かし、結果の JSON を標準出力にも出す（result.json と同じ）。進み具合は標準エラー出力。終了コードは 0', async () => {
    const world = createWorld({ outputs: GOOD });
    const { code, stdout, stderr, made } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '1', '--model', 'gpt-6-luna']);
    assert.equal(code, 0);
    const out = stdout.json();
    assert.equal(out.kind, 'eval');
    assert.equal(out.status, 'completed');
    assert.deepEqual(out.scores, { with: 1, without: 0.5, difference: 0.5, byTask: { 'T-01': { with: 1, without: 0.5, difference: 0.5 } } });
    assert.equal(out.credits, 1.5);
    assert.deepEqual(JSON.parse(fs.readFileSync(out.resultFile, 'utf8')), out);
    assert.equal(out.options.model, 'gpt-6-luna');
    assert.equal(out.versions.copilotSdk, '1.0.25');
    assert.equal(out.versions.playwright, '1.56.1');
    assert.match(stderr.text(), /\[T-01 あり 1\/1\] 実行します/);
    assert.match(stderr.text(), /\[T-01 なし 1\/1\] completed（1\/2 合格）/);
    assert.equal(world.sdk.sessions[0].config.model, 'gpt-6-luna');
    assert.equal(world.sdk.sessions[0].config.extensionSdkPath, '/tools/node_modules/@github/copilot-sdk/dist', 'ありの実行に、SDK のフォルダを渡す');
    assert.equal('extensionSdkPath' in world.sdk.sessions[1].config, false, 'なしの実行には渡さない');
    assert.equal(made.screens.length, 1);
    assert.deepEqual(made.screens[0].chromium, { fake: true });
    assert.equal(made.judges.length, 0, 'model の基準がなければ、判定の関数は作らない');
    assert.equal(world.screen.closed, 1, '終わったら画面の部品を閉じる');
  });

  test('REQ-041 model の基準があるときだけ、判定の関数を作る。判定のモデルは --judge-model、なければ --model。終わったら閉じる', async () => {
    const task = sampleTask({ criteria: [{ id: 'C-01', text: '読みやすい', grading: 'model' }] });
    const a = createWorld({ tasks: [task], outputs: GOOD });
    const ra = await runMain(a, ['run', '--plugin', a.pluginDir, '--runs', '1', '--model', 'm1']);
    assert.equal(ra.made.judges.length, 1);
    assert.equal(ra.made.judges[0].args.model, 'm1');
    assert.equal(ra.made.judges[0].judge.closed, true);
    assert.equal(ra.stdout.json().options.judgeModel, 'm1');
    assert.equal(ra.stdout.json().creditDetail.grading, 0.2, '偽物の判定が返した 0.1 × あり・なし');
    const b = createWorld({ tasks: [task], outputs: GOOD });
    const rb = await runMain(b, ['run', '--plugin', b.pluginDir, '--runs', '1', '--model', 'm1', '--judge-model', 'm2']);
    assert.equal(rb.made.judges[0].args.model, 'm2');
  });

  test('REQ-041 --timeout-minutes は、1回の実行の上限（ミリ秒に直して渡す）', async () => {
    const world = createWorld({ outputs: GOOD });
    const { made } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '1', '--timeout-minutes', '0.5']);
    assert.equal(made.runOptions[0].timing.timeoutMs, 30_000);
    const other = createWorld({ outputs: GOOD });
    const second = await runMain(other, ['run', '--plugin', other.pluginDir, '--runs', '1']);
    assert.equal(second.made.runOptions[0].timing, undefined, '指定しなければ既定（30分）');
  });

  test('REQ-041 途中で止まったときは、結果に理由を入れ、終了コード 1。画面の部品も閉じる', async () => {
    const world = createWorld({
      outputs: GOOD,
      behavior: { plugins: () => [] },
    });
    const { code, stdout } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '1']);
    assert.equal(code, 1);
    assert.equal(stdout.json().status, 'stopped');
    assert.equal(stdout.json().stopped.reason, 'plugin_not_loaded');
    assert.equal(world.screen.closed, 1);
  });

  test('REQ-041 外からの中断の合図（Ctrl+C など）で、動いているものを閉じて、interrupted で止まる', async () => {
    const controller = new AbortController();
    const world = createWorld({
      outputs: GOOD,
      screen: {
        operate: ({ signal }) =>
          new Promise((_, reject) => {
            setTimeout(() => controller.abort(), 30);
            signal.addEventListener('abort', () => reject(new ScreenError('試験が止まったので、画面の操作をやめました。')), { once: true });
          }),
      },
    });
    const { code, stdout } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '2'], { signal: controller.signal });
    assert.equal(code, 1);
    const out = stdout.json();
    assert.equal(out.stopped.reason, 'interrupted');
    assert.deepEqual(out.runs.map((r) => r.status), ['stopped', 'skipped', 'skipped', 'skipped']);
    assert.equal(world.sdk.clients.length, 1);
    assert.equal(world.sdk.clients[0].stopped, true, '動いていたランタイムは止める');
    assert.equal(world.screen.closed, 1);
  });

  test('REQ-048 道具が足りないときは、始めずに、足りないものと入れる場所を出して終了コード 2', async () => {
    const world = createWorld({ outputs: GOOD });
    const { code, stdout, made } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '1'], {
      loadTools: async () => {
        throw new ToolsMissingError('/h/.copilot/plugin-data/plugin-creator/tools', [{ name: 'playwright', reason: '入っていません' }]);
      },
    });
    assert.equal(code, 2);
    const out = stdout.json();
    assert.equal(out.ok, false);
    assert.equal(out.error, 'tools_missing');
    assert.equal(out.toolsDir, '/h/.copilot/plugin-data/plugin-creator/tools');
    assert.deepEqual(out.missing, [{ name: 'playwright', reason: '入っていません' }]);
    assert.match(out.message, /check_tools\.py/);
    assert.equal(made.screens.length, 0);
    assert.equal(world.sdk.clients.length, 0);
  });

  test('REQ-041 課題に誤りがあるときは、道具を読み込む前に、何も始めずに終了コード 2', async () => {
    const world = createWorld({ tasks: [{ id: 'T-01', prompt: 'p', criteria: [] }] });
    let loaded = false;
    const { code, stdout } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '1'], { loadTools: async () => { loaded = true; } });
    assert.equal(code, 2);
    assert.equal(stdout.json().error, 'tasks_invalid');
    assert.equal(loaded, false);
  });

  test('REQ-041 想定外の失敗は、終了コード 2 と理由を出す（例外で終わらない）', async () => {
    const world = createWorld({ outputs: GOOD });
    const { code, stdout } = await runMain(world, ['run', '--plugin', world.pluginDir, '--runs', '1'], { run: async () => { throw new Error('想定外'); } });
    assert.equal(code, 2);
    assert.deepEqual(stdout.json(), { ok: false, error: 'failed', message: '想定外' });
    assert.equal(world.screen.closed, 1, '失敗しても画面の部品は閉じる');
  });
});

describe('node eval.mjs を実際に動かす', () => {
  const script = path.join(SCRIPTS_DIR, 'eval.mjs');
  const exec = (args, env = {}) => {
    const proc = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
    return { code: proc.status, out: proc.stdout, err: proc.stderr };
  };

  test('REQ-040 estimate は、そのまま動き、標準出力は JSON だけ', () => {
    const plugin = tempWith({ 'plugin.json': JSON.stringify({ name: 'weekly-report' }), 'tests/eval/T-01/eval.json': JSON.stringify(sampleTask()) });
    const { code, out } = exec(['estimate', '--plugin', plugin, '--runs', '2']);
    assert.equal(code, 0);
    assert.equal(JSON.parse(out).counts.runs.total, 4);
  });

  test('REQ-048 run は、道具のフォルダ（COPILOT_HOME の下）に道具がなければ、入れる場所を出して終了コード 2', () => {
    const plugin = tempWith({ 'plugin.json': JSON.stringify({ name: 'weekly-report' }), 'tests/eval/T-01/eval.json': JSON.stringify(sampleTask()) });
    const home = makeTemp('c3-home-');
    const { code, out } = exec(['run', '--plugin', plugin, '--runs', '1'], { COPILOT_HOME: home });
    assert.equal(code, 2);
    const result = JSON.parse(out);
    assert.equal(result.error, 'tools_missing');
    assert.equal(result.toolsDir, path.join(home, 'plugin-data', 'plugin-creator', 'tools'));
    assert.deepEqual(result.missing.map((m) => m.name), ['@github/copilot-sdk', 'playwright']);
    assert.equal(fs.existsSync(path.join(plugin, 'tests', 'results')), false, '何も始めていない');
  });

  test('REQ-040 引数がなければ、使い方を JSON で出して終了コード 2', () => {
    const { code, out } = exec([]);
    assert.equal(code, 2);
    assert.equal(JSON.parse(out).error, 'usage');
  });
});
