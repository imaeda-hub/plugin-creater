#!/usr/bin/env node
// EVAL（試験の3段目）の入口。ユーザーの手元の Copilot CLI で、生成プラグインあり・なしで課題を実行して採点する（testing.md 10章）。
//
// 使い方
//   node eval.mjs estimate --plugin <生成プラグインのフォルダ> --runs <回数>
//     回数と AI クレジットの見込みを JSON で出す。モデルは使わない。EVAL を始める前に示し、ユーザーがよいと答えてから run を動かす（REQ-040）。
//   node eval.mjs run --plugin <生成プラグインのフォルダ> --runs <回数> [--model <モデル>] [--judge-model <モデル>] [--timeout-minutes <分>]
//     EVAL を行い、結果を <生成プラグイン>/tests/results/eval-<日時>/result.json に書き、同じ JSON を標準出力に出す。進み具合は標準エラー出力に出す。
//     --runs は、課題ごと、あり・なしのそれぞれの回数。--timeout-minutes は、1回の実行の上限（既定 30 分）。
//
// 道具（@github/copilot-sdk と playwright）は <COPILOT_HOME>/plugin-data/plugin-creator/tools/ から読む。足りなければ check_tools.py --scope eval --install で入れる。
//
// 終了コード：0 最後まで動いた（点数が低くても 0）、1 途中で止まった（結果の stopped に理由）、2 始められなかった（使い方の誤り、課題の誤り、道具が足りない）。
// 始められなかったときの標準出力は { "ok": false, "error": "<種類>", "message": "…" }。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { estimatePlugin } from './estimate.mjs';
import { createCopilotJudge } from './judge.mjs';
import { readPluginInfo, runEval } from './run.mjs';
import { createScreen } from './screen.mjs';
import { loadTasks } from './tasks.mjs';
import { ToolsMissingError, loadEvalTools } from './tools.mjs';

const USAGE = [
  'node eval.mjs estimate --plugin <生成プラグインのフォルダ> --runs <回数>',
  'node eval.mjs run --plugin <生成プラグインのフォルダ> --runs <回数> [--model <モデル>] [--judge-model <モデル>] [--timeout-minutes <分>]',
];

const VALUE_OPTIONS = { plugin: 'string', runs: 'integer', model: 'string', 'judge-model': 'string', 'timeout-minutes': 'number' };
const ALLOWED = { estimate: ['plugin', 'runs'], run: ['plugin', 'runs', 'model', 'judge-model', 'timeout-minutes'] };

/** 引数を読む。@returns {{ command?: string, options: object, errors: string[] }} */
export function parseArgs(argv) {
  const errors = [];
  const options = {};
  const [command, ...rest] = argv;
  if (!ALLOWED[command]) {
    return { command, options, errors: [command ? `サブコマンド「${command}」は使えません（estimate か run）` : 'サブコマンド（estimate か run）がありません'] };
  }
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(token);
    if (!match || !(match[1] in VALUE_OPTIONS)) {
      errors.push(`「${token}」は使えません`);
      continue;
    }
    const [, name, inline] = match;
    if (!ALLOWED[command].includes(name)) {
      errors.push(`--${name} は ${command} では使えません`);
      continue;
    }
    const value = inline !== undefined ? inline : rest[++i];
    if (value === undefined || (inline === undefined && value.startsWith('--'))) {
      errors.push(`--${name} に値がありません`);
      continue;
    }
    if (VALUE_OPTIONS[name] === 'integer') {
      if (!/^[1-9]\d*$/.test(value)) errors.push(`--${name} は1以上の整数で書いてください（「${value}」）`);
      else options[name] = Number(value);
    } else if (VALUE_OPTIONS[name] === 'number') {
      if (!(Number(value) > 0)) errors.push(`--${name} は0より大きい数で書いてください（「${value}」）`);
      else options[name] = Number(value);
    } else {
      options[name] = value;
    }
  }
  for (const name of ['plugin', 'runs']) if (!(name in options) && !errors.some((e) => e.startsWith(`--${name}`))) errors.push(`--${name} がありません`);
  return { command, options, errors };
}

/**
 * 入口。結果は deps.stdout に JSON で出す。
 * @param {string[]} argv 引数（node eval.mjs の後ろ）
 * @param {object} [deps] 試験で差し替える部品
 * @returns {Promise<number>} 終了コード
 */
export async function main(argv, deps = {}) {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
    env = process.env,
    signal,
    loadTools = loadEvalTools,
    makeScreen = createScreen,
    makeJudge = createCopilotJudge,
    run = runEval,
  } = deps;
  const print = (value) => stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  const fail = (error, message, extra = {}) => {
    print({ ok: false, error, message, ...extra });
    return 2;
  };

  try {
    const { command, options, errors } = parseArgs(argv);
    if (errors.length > 0) return fail('usage', errors.join('。'), { usage: USAGE });
    const pluginDir = path.resolve(options.plugin);
    if (!fs.existsSync(path.join(pluginDir, 'plugin.json'))) return fail('plugin_not_found', `生成プラグインのフォルダに plugin.json がありません（${pluginDir}）`);
    const plugin = readPluginInfo(pluginDir);

    if (command === 'estimate') {
      const out = estimatePlugin({ pluginDir, runs: options.runs });
      if (!out.ok) return fail('tasks_invalid', `課題に誤りがあります：${out.problems.join(' / ')}`, { problems: out.problems });
      print({ ...out, plugin });
      return 0;
    }

    const loaded = loadTasks(pluginDir);
    if (loaded.problems.length > 0) return fail('tasks_invalid', `課題に誤りがあります：${loaded.problems.join(' / ')}`, { problems: loaded.problems });

    let tools;
    try {
      tools = await loadTools(env);
    } catch (error) {
      if (error instanceof ToolsMissingError) return fail('tools_missing', error.message, { toolsDir: error.dir, missing: error.missing });
      throw error;
    }

    const screen = makeScreen({ chromium: tools.chromium, env });
    const needsJudge = loaded.tasks.some((t) => t.json.criteria.some((c) => c.grading === 'model'));
    const judgeModel = options['judge-model'] ?? options.model;
    const judge = needsJudge ? makeJudge({ sdk: tools.sdk, env, model: judgeModel }) : undefined;
    let result;
    try {
      result = await run({
        pluginDir,
        runs: options.runs,
        tasks: loaded.tasks,
        sdk: tools.sdk,
        screen,
        judge,
        model: options.model,
        versions: tools.versions,
        options: { judgeModel: judgeModel ?? null },
        timing: options['timeout-minutes'] ? { timeoutMs: Math.round(options['timeout-minutes'] * 60_000) } : undefined,
        env,
        signal,
        log: (text) => stderr.write(`${text}\n`),
      });
    } finally {
      await screen.close?.();
      await judge?.close?.();
    }
    print(result);
    return result.status === 'completed' ? 0 : 1;
  } catch (error) {
    return fail('failed', error?.message ?? String(error));
  }
}

// 直接動かされたときだけ、入口を動かす。Ctrl+C（SIGINT）と SIGTERM では、動いているものを閉じてから終わる。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => controller.abort());
  process.exitCode = await main(process.argv.slice(2), { signal: controller.signal });
}
