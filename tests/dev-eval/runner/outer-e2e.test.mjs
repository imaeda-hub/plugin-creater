// 外側の EVAL を、本物の Agent SDK と Claude Code の本体、本物の置き換えた版のクリエイター、本物のエクステンションの代わりの MCP サーバーで通す。
// 実際のモデルは使わない：Anthropic API の代わりに、ローカルの偽のサーバー（台本。fake-anthropic.mjs）につなぐ。ユーザー役の呼び出しも同じ偽のサーバーに届く。
// 動かし方（リポジトリの根で）：node --test "tests/dev-eval/runner/outer-e2e.test.mjs"（Python に PyYAML が要る。なければ飛ばす）

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as sdk from '@anthropic-ai/claude-agent-sdk';

import { loadPersona } from '../personas/validate.mjs';
import { guardSdk, startFakeAnthropic } from './fake-anthropic.mjs';
import { REPO_ROOT } from './creator-tools.mjs';
import { convertPlugin, runOuterOnce } from './outer-run.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS = path.join(here, '..', 'personas');
const pythonOk = spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' }).status === 0;
const SKIP = pythonOk ? false : 'Python に PyYAML がありません';
const FAKE_ENV = { ANTHROPIC_API_KEY: 'fake-key', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };

/** 最後の user のメッセージ（role が system のものは飛ばす）にある tool_result の文字の並びと、text ブロックの文字 */
const lastUser = (body) => [...(body?.messages ?? [])].reverse().find((m) => m.role === 'user') ?? null;
function lastToolResults(body) {
  const content = lastUser(body)?.content;
  if (!Array.isArray(content)) return [];
  return content.filter((c) => c.type === 'tool_result').map((c) => (typeof c.content === 'string' ? c.content : (c.content ?? []).map((x) => x.text ?? '').join('\n')));
}
function lastUserText(body) {
  const content = lastUser(body)?.content;
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.filter((c) => c.type === 'text').map((c) => c.text).join('\n') : '';
}

/** クリエイター役とユーザー役の、偽のモデルの台本 */
function script(log) {
  return ({ body, system }) => {
    const isUserRole = system.includes('あなたは営業チームのリーダー');
    const results = lastToolResults(body);
    const text = lastUserText(body);
    log.push({ role: isUserRole ? 'user-role' : 'creator', model: body.model, tools: (body.tools ?? []).map((t) => t.name), text: text.slice(0, 80), results: results.map((r) => r.slice(0, 120)) });
    if (isUserRole) return { blocks: [{ type: 'text', text: 'weekly_report.md という名前の Markdown のファイルです' }] };
    if (results.some((r) => r.includes('The user answered'))) return { blocks: [{ type: 'text', text: 'ほかに伝えておきたいことはありますか？' }] };
    if (results.some((r) => r.includes('クリエイターの画面') || r.includes('段階'))) return { blocks: [{ type: 'text', text: '分かりました。ありがとうございます。' }] };
    if (text.includes('weekly_report.md')) return { blocks: [{ type: 'tool_use', name: 'mcp__plugin-creator__state', input: {} }] };
    return {
      blocks: [
        { type: 'text', text: 'お話を聞かせてください。' },
        { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [{ question: '作業の成果物は、どんなファイルですか？', header: '成果物', multiSelect: false, options: [{ label: 'Markdown', description: 'md のファイル' }, { label: 'Word', description: 'docx のファイル' }] }] } },
      ],
    };
  };
}

test('REQ-015 本物の SDK で通す：質問のツールにユーザー役が答え、文章の問いにも答える。置き換えたクリエイターが読み込まれ、エクステンションの代わりのツールが使える', { skip: SKIP, timeout: 240_000 }, async (t) => {
  const loaded = await loadPersona(path.join(PERSONAS, 'weekly-report'), { allStyles: true });
  const log = [];
  const api = await startFakeAnthropic(script(log));
  t.after(() => api.close());
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'outer-e2e-'));
  t.after(() => fs.rmSync(runRoot, { recursive: true, force: true }));
  // 本物の置き換え（クリエイター全体を Claude Code の形にして、claude plugin validate に通す）
  const converted = convertPlugin(REPO_ROOT, path.join(runRoot, 'converted', 'creator'));
  assert.equal(converted.summary.validate.ok, true);

  // 守り：模擬の API につながっていない query は、始める前に断る（実際のモデルを呼ばないため。ユーザー役の呼び出しも同じ）
  const guarded = guardSdk(sdk, api);
  const record = await runOuterOnce({
    loaded, runRoot, sandbox: false, query: guarded.query, convertedCreator: converted.root, maxExchanges: 2, model: 'claude-opus-5-5',
    envExtra: { ...FAKE_ENV, ANTHROPIC_BASE_URL: api.url },
    runStages: async () => ({ skipped: true, reason: 'x' }),
  });

  // 会話が通った：依頼 → 質問のツール → ユーザー役の答え → 文章の問い → ユーザー役の返事
  assert.equal(record.stopped.reason, 'max_exchanges', JSON.stringify(record.stopped));
  const kinds = record.conversation.map((c) => `${c.role}:${c.via}`);
  assert.deepEqual(kinds.slice(0, 4), ['user:request', 'creator:text', 'creator:AskUserQuestion', 'user:AskUserQuestion']);
  assert.equal(record.conversation[2].question, '作業の成果物は、どんなファイルですか？');
  assert.deepEqual(record.conversation[2].options.map((o) => o.label), ['Markdown', 'Word']);
  assert.equal(record.conversation[3].text, 'weekly_report.md という名前の Markdown のファイルです');
  assert.ok(record.conversation.some((c) => c.role === 'creator' && c.text === 'ほかに伝えておきたいことはありますか？'));
  assert.ok(record.conversation.at(-1).role === 'user' && record.conversation.at(-1).via === 'text');

  // 置き換えたクリエイターのプラグインと、エクステンションの代わりの MCP サーバーが読み込まれた
  const init = record.initInfo[0];
  assert.ok(init.plugins.includes('plugin-creator'), JSON.stringify(init));
  assert.ok(init.mcp.some((s) => s.startsWith('plugin-creator:')), JSON.stringify(init.mcp));
  const creatorRequest = log.find((l) => l.role === 'creator');
  assert.ok(creatorRequest.tools.includes('mcp__plugin-creator__state'), creatorRequest.tools.join(','));
  assert.ok(creatorRequest.tools.includes('mcp__plugin-creator__progress'));
  assert.ok(creatorRequest.tools.includes('AskUserQuestion'));
  assert.ok(creatorRequest.tools.includes('Skill'));
  // クリエイターのモデルは ID で渡った。ユーザー役は固定のモデル
  assert.ok(log.filter((l) => l.role === 'creator').every((l) => l.model === 'claude-opus-5-5'));
  assert.ok(log.filter((l) => l.role === 'user-role').every((l) => l.model === 'claude-sonnet-5-5'));
  // ユーザー役の呼び出しは、道具なし
  assert.ok(log.filter((l) => l.role === 'user-role').every((l) => l.tools.length === 0), JSON.stringify(log.filter((l) => l.role === 'user-role').map((l) => l.tools)));
  // 状態取得ツール（エクステンションの代わり）が呼ばれて、結果が返った
  const state = record.items.find((i) => i.kind === 'tool.use' && i.name === 'mcp__plugin-creator__state');
  assert.ok(state, '状態取得ツールを呼んでいない');
  assert.ok(record.toolEvents.some((e) => e.type === 'tool.result' && e.tool === 'state' && e.isError === false));
  assert.ok(typeof record.sessionId === 'string');
  // 続きの会話（resume）に、ユーザー役の返事が渡った
  assert.ok(log.some((l) => l.role === 'creator' && l.text.includes('weekly_report.md')));
  assert.ok(record.costUsd.creator > 0);
  // 記録する数（testing.md 6.5）が、本物の SDK の流れでも出る：質問のツールの問い 1 つ（1 回に 1 つ）、文章の問い、断りなし
  const counts = record.grading.counts;
  assert.equal(counts.questions.askTool, 1);
  assert.deepEqual(counts.askToolCalls, { calls: 1, maxQuestionsPerCall: 1, callsWithMultiple: 0 });
  assert.ok(counts.questions.text >= 1);
  assert.equal(counts.recordRefusals.total, 0);
  // メインのメッセージのモデルは、指定のモデル（REQ-045）
  assert.deepEqual(record.mainModels, ['claude-opus-5-5']);
  assert.equal(record.grading.grades.find((g) => g.id === 'main-model').ok, true);
});
