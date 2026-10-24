// 内側の EVAL の試験の道具（実際のモデルは使わない）。
//   buildSamplePlugin … C2 の組み立ての見本（tests/creator/scaffold/sample）から生成プラグインを組み立て、変換スクリプトで置き換える。
//   scriptedModel     … 偽の Anthropic API の台本。メインのエージェント・統括・作業・検証の役割を、システムプロンプトで見分けて、
//                       決まった順にツールを呼ぶ（本物の Agent SDK と Claude Code の本体を動かすため）。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { firstUserText, lastToolResults } from './fake-anthropic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..', '..');
const SCAFFOLD = path.join(REPO, 'skills', 'make-plugin', 'scripts', 'scaffold.py');
const SAMPLE = path.join(REPO, 'tests', 'creator', 'scaffold', 'sample');
const CONVERT = path.join(REPO, 'tests', 'dev-eval', 'convert.py');

export function pythonHasModules() {
  return spawnSync('python3', ['-c', 'import yaml, jsonschema'], { encoding: 'utf8' }).status === 0;
}

export const tmpDir = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `dev-eval-${prefix}-`)));

/** 見本から生成プラグインを組み立て、Claude Code 向けに置き換える。@returns {{ root, pluginRoot, convertedRoot, taskDir, task }} */
export function buildSamplePlugin() {
  const root = tmpDir('sample');
  const work = path.join(root, 'folder', '.plugin-creator-work');
  fs.mkdirSync(work, { recursive: true });
  fs.cpSync(path.join(SAMPLE, 'parts'), path.join(work, 'parts'), { recursive: true });
  const pluginRoot = path.join(root, 'folder', 'sample-plugin');
  const build = spawnSync('python3', ['-I', SCAFFOLD, 'build', '--hearing', path.join(SAMPLE, 'state.json'), '--work', work, '--out', pluginRoot], { encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`組み立てに失敗しました：${build.stdout}\n${build.stderr}`);
  const convertedRoot = path.join(root, 'converted');
  const convert = spawnSync('python3', ['-I', CONVERT, pluginRoot, convertedRoot, '--skip-validate'], { encoding: 'utf8' });
  if (convert.status !== 0) throw new Error(`変換に失敗しました：${convert.stdout}\n${convert.stderr}`);
  const taskDir = path.join(pluginRoot, 'tests', 'eval', 'T-01');
  const json = JSON.parse(fs.readFileSync(path.join(taskDir, 'eval.json'), 'utf8'));
  return { root, pluginRoot, convertedRoot, task: { id: json.id, dir: taskDir, json } };
}

// ---- 偽のモデルの台本 -------------------------------------------------------------------------------------

const toolNamesIn = (body) =>
  (body.messages ?? [])
    .filter((m) => m.role === 'assistant' && Array.isArray(m.content))
    .flatMap((m) => m.content.filter((c) => c.type === 'tool_use').map((c) => c.name));

export function roleOf(body) {
  const system = JSON.stringify(body.system ?? '');
  if (system.includes('あなたが知っていること')) return 'user-role';
  if (system.includes('作業の成果物を採点する人です')) return 'judge';
  if (system.includes('の統括エージェントで')) return 'orchestrator';
  if (system.includes('の作業エージェントで')) return 'worker';
  if (system.includes('の検証エージェントで')) return 'verifier';
  return 'main';
}

const WEEKLY = '# 週報\n\n## 今週やったこと\n- 3件の問い合わせに対応した\n\n## 来週やること\n- 2件の資料を作る\n';
const workDirOf = (body) => /Primary working directory: ([^\\\n"]+)/.exec(JSON.stringify(body))?.[1]?.trim();
const criteriaOf = (text) => [...String(text).matchAll(/^- ([A-Z]-\d+)：(.+)$/gm)].map((m) => ({ id: m[1], text: m[2].trim() }));
const textBlock = (text) => ({ type: 'text', text });
const tool = (name, input, extra = {}) => ({ type: 'tool_use', name, input, ...extra });

/**
 * 偽の Anthropic API の台本を作る。
 * @param {object} [scenario]
 * @param {string} [scenario.server] MCP のサーバー名（既定 weekly-report）
 * @param {boolean} [scenario.workerWrites] 作業が成果物を書くか（既定 true）
 * @param {boolean} [scenario.verifierPass] 検証が全部合格にするか（既定 true）
 * @param {number} [scenario.verifierDelayMs] 検証の返事を遅らせる（止める試験や、画面の状態を拾う試験用）
 * @param {number} [scenario.workerDelayMs] 作業の最初の返事を遅らせる
 * @param {boolean} [scenario.askFirst] メインが最初にチャットで質問して手番を終える（ユーザー役の試験用）
 * @param {boolean} [scenario.background] 統括が作業・検証を裏で呼ぶ（run_in_background を指定しない）
 * @param {boolean} [scenario.useSkill] メインが最初に入口のスキルを呼ぶか（既定 true）
 * @param {boolean} [scenario.plain] メインが、プラグインなしの実行のように、自分で成果物を書く。省くと、画面を開くツールがあるかで決める
 * @param {string} [scenario.deliverable] 成果物の相対の場所（既定 out/weekly.md）
 * @param {string} [scenario.content] 作業エージェントが書く成果物の中身
 * @param {string} [scenario.plainContent] プラグインなしのメインが書く成果物の中身（省くと content と同じ）
 * @param {boolean} [scenario.askTool] メインが質問のツール（AskUserQuestion）で週を聞く
 * @param {(role: string, body: object) => void} [scenario.onRequest]
 */
export function scriptedModel(scenario = {}) {
  const { server = 'weekly-report', workerWrites = true, verifierPass = true, verifierDelayMs = 0, workerDelayMs = 0, askFirst = false, background = false, useSkill = true, plain: forcedPlain, askTool = false, deliverable = 'out/weekly.md', content: workerContent = WEEKLY, plainContent = workerContent, onRequest } = scenario;
  const mcp = (name) => `mcp__${server}__${name}`;
  return async ({ body }) => {
    const role = roleOf(body);
    onRequest?.(role, body);
    const used = toolNamesIn(body);
    const model = body.model;
    if (role === 'user-role') return { model, blocks: [textBlock('はい、お願いします')] };
    if (role === 'judge') return { model, blocks: [textBlock('{"pass": true, "reason": "満たしている"}')] };
    const plain = forcedPlain ?? !(body.tools ?? []).some((t) => t.name === mcp('open'));
    if (role === 'main') {
      const answered = JSON.stringify(body.messages).includes('はい、お願いします');
      if (askTool && !used.includes('AskUserQuestion')) {
        const questions = [{ question: 'どの週の週報ですか？', header: '対象の週', multiSelect: false, options: [{ label: '今週', description: '今週の分' }, { label: '先週', description: '先週の分' }] }];
        return { model, blocks: [tool('AskUserQuestion', { questions })] };
      }
      if (plain) {
        if (askFirst && !answered) return { model, blocks: [textBlock('どの週の週報ですか？')] };
        if (!used.includes('Write')) {
          return { model, blocks: [tool('Write', { file_path: path.join(workDirOf(body), deliverable), content: plainContent })] };
        }
        return { model, blocks: [textBlock('週報を out/weekly.md に書きました。')] };
      }
      if (askFirst && !used.includes(mcp('open')) && !answered) {
        return { model, blocks: [textBlock('どの週の週報ですか？')] };
      }
      if (useSkill && !used.includes('Skill')) return { model, blocks: [tool('Skill', { skill: `${server}:${server}` })] };
      if (!used.includes(mcp('open'))) return { model, blocks: [tool(mcp('open'), { requestText: firstUserText(body) })] };
      const shown = lastToolResults(body).join('\n');
      return { model, blocks: [textBlock(`画面を開きました。\n${shown}\n画面で設定して、開始ボタンを押してください。`)] };
    }
    if (role === 'orchestrator') {
      const instruction = firstUserText(body);
      const criteria = criteriaOf(instruction);
      const agentCalls = used.filter((n) => n === 'Agent').length;
      const agentArgs = (type, description) => ({ description, subagent_type: type, prompt: `${description}。評価基準：\n${criteria.map((c) => `- ${c.id}：${c.text}`).join('\n')}\n作業フォルダ：${workDirOf(body)}`, ...(background ? {} : { run_in_background: false }) });
      if (!used.includes(mcp('plan'))) return { model, blocks: [tool(mcp('plan'), { iteration: 1, criteria, plan: '週報を書いて確かめる' })] };
      if (agentCalls === 0) return { model, blocks: [tool('Agent', agentArgs('weekly-report:worker', '試行 1 の作業'))] };
      if (agentCalls === 1) return { model, blocks: [tool('Agent', agentArgs('weekly-report:verifier', '試行 1 の確かめ'))] };
      if (!used.includes(mcp('review'))) return { model, blocks: [tool(mcp('review'), {})] };
      if (!used.includes(mcp('finish'))) return { model, blocks: [tool(mcp('finish'), { summary: '1回の試行で、すべての評価基準を満たした。成果物は out/weekly.md。' })] };
      return { model, blocks: [textBlock('実行の番号：1\n結果：すべての評価基準を満たした（試行 1 回）\n成果物：out/weekly.md\nまとめ：週報を作った。')] };
    }
    if (role === 'worker') {
      const cwd = workDirOf(body);
      if (workerDelayMs && used.length === 0) await new Promise((resolve) => setTimeout(resolve, workerDelayMs).unref());
      if (workerWrites && !used.includes('Write')) {
        return { model, blocks: [tool('Write', { file_path: path.join(cwd, deliverable), content: workerContent })] };
      }
      if (!used.includes(mcp('show'))) return { model, blocks: [tool(mcp('show'), { key: 'draft', value: '下書きを書きました' })] };
      return { model, blocks: [textBlock(`成果物：${path.join(cwd, deliverable)}\nしたこと：週報を書いた\nできなかったこと：なし`)] };
    }
    // verifier
    if (!used.includes(mcp('verdict'))) {
      if (verifierDelayMs) await new Promise((resolve) => setTimeout(resolve, verifierDelayMs).unref());
      const criteria = criteriaOf(firstUserText(body));
      const verdicts = criteria.map((c) => ({ criterionId: c.id, pass: verifierPass, note: verifierPass ? '確かめた' : '直してください' }));
      return { model, blocks: [tool(mcp('verdict'), { iteration: 1, verdicts })] };
    }
    return { model, blocks: [textBlock('試行：1\n記録：記録した')] };
  };
}
