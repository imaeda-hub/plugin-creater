// Agent SDK の隔離（testing.md 5章）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { agentEnv, allowedToolsFor, ENV_ALLOW, isInsideDir, makeCanUseTool, makeQueryOptions, makeSandboxOptions, sandboxStatus } from './isolation.mjs';

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'isolation-test-')));

test('testing.md 5章 環境変数は許可の一覧のものだけを渡し、一時的なホームを使う', () => {
  const base = { PATH: '/bin', LANG: 'ja_JP.UTF-8', GITHUB_TOKEN: 'secret', AWS_SECRET_ACCESS_KEY: 'secret', CLAUDE_EFFORT: 'high', CLAUDE_AUTO_BACKGROUND_TASKS: 'true', HOME: '/home/real', ANTHROPIC_BASE_URL: 'https://api.example' };
  const env = agentEnv({ home: '/tmp/h', base });
  assert.equal(env.HOME, '/tmp/h');
  assert.equal(env.PATH, '/bin');
  assert.equal(env.ANTHROPIC_BASE_URL, 'https://api.example');
  assert.equal(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  for (const leaked of ['GITHUB_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'CLAUDE_EFFORT', 'CLAUDE_AUTO_BACKGROUND_TASKS']) assert.equal(env[leaked], undefined, leaked);
  assert.deepEqual(Object.keys(env).filter((k) => !ENV_ALLOW.includes(k)).sort(), ['CLAUDE_CODE_DISABLE_AUTO_MEMORY', 'HOME']);
  assert.throws(() => agentEnv({ base }), /home/);
});

test('testing.md 5章 追加の環境変数は extra で明示したものだけが入る', () => {
  const env = agentEnv({ home: '/tmp/h', base: { PATH: '/bin' }, extra: { ANTHROPIC_API_KEY: 'k', CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' } });
  assert.equal(env.ANTHROPIC_API_KEY, 'k');
  assert.equal(env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS, '1');
});

test('testing.md 11.1 サンドボックスの道具：Linux は bwrap と socat の両方が要る', () => {
  const have = new Set(['bwrap', 'socat']);
  assert.deepEqual(sandboxStatus({ platform: 'linux', which: (c) => have.has(c) }), { available: true, missing: [] });
  assert.deepEqual(sandboxStatus({ platform: 'linux', which: (c) => c === 'bwrap' }), { available: false, missing: ['socat'] });
  assert.deepEqual(sandboxStatus({ platform: 'linux', which: () => false }), { available: false, missing: ['bwrap', 'socat'] });
  assert.equal(sandboxStatus({ platform: 'darwin' }).available, true);
  const win = sandboxStatus({ platform: 'win32' });
  assert.equal(win.available, false);
  assert.match(win.missing[0], /win32/);
});

test('testing.md 5章 サンドボックスは使えないとき失敗にする（黙って外で動かさない）', () => {
  assert.deepEqual(makeSandboxOptions({ enabled: true }), { enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false });
  assert.equal(makeSandboxOptions({ enabled: false }), undefined);
});

test('testing.md 5章 作業フォルダの中か：シンボリックリンクをたどった本当の場所で見る', () => {
  const root = tmp();
  const cwd = path.join(root, 'work');
  const outside = path.join(root, 'outside');
  fs.mkdirSync(cwd);
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(cwd, 'link'));
  assert.equal(isInsideDir(cwd, 'out/a.md'), true);
  assert.equal(isInsideDir(cwd, path.join(cwd, 'deep', 'a', 'b.md')), true);
  assert.equal(isInsideDir(cwd, '.'), true);
  assert.equal(isInsideDir(cwd, '../outside/a.md'), false);
  assert.equal(isInsideDir(cwd, path.join(outside, 'a.md')), false);
  assert.equal(isInsideDir(cwd, 'link/a.md'), false);
  assert.equal(isInsideDir(cwd, ''), false);
  assert.equal(isInsideDir(cwd, undefined), false);
});

test('testing.md 5章 canUseTool：作業フォルダの外への書き込みは断って記録し、中は許可する', async () => {
  const cwd = tmp();
  const refused = [];
  const canUse = makeCanUseTool({ cwd, refused });
  assert.deepEqual(await canUse('Write', { file_path: path.join(cwd, 'a.md') }), { behavior: 'allow', updatedInput: { file_path: path.join(cwd, 'a.md') } });
  const denied = await canUse('Edit', { file_path: '/etc/passwd' });
  assert.equal(denied.behavior, 'deny');
  assert.match(denied.message, /作業フォルダの外/);
  assert.deepEqual(refused, [{ toolName: 'Edit', path: '/etc/passwd' }]);
  assert.equal((await canUse('NotebookEdit', { notebook_path: '/tmp/x.ipynb' })).behavior, 'deny');
  assert.equal((await canUse('Bash', { command: 'ls' })).behavior, 'allow');
});

test('testing.md 5章 canUseTool：AskUserQuestion は onQuestion の答えを返す。答え手がなければ断る', async () => {
  const cwd = tmp();
  const questions = [{ question: '週は？', options: [{ label: 'A' }] }];
  const canUse = makeCanUseTool({ cwd, onQuestion: async (qs) => Object.fromEntries(qs.map((q) => [q.question, '2026-W42'])) });
  assert.deepEqual(await canUse('AskUserQuestion', { questions }), { behavior: 'allow', updatedInput: { questions, answers: { '週は？': '2026-W42' } } });
  const none = makeCanUseTool({ cwd });
  assert.equal((await none('AskUserQuestion', { questions })).behavior, 'deny');
});

test('testing.md 5章 普段のツールはあらかじめ許可し、書き込みは作業フォルダの中だけにする', () => {
  const allowed = allowedToolsFor({ mcpTools: ['mcp__p__open'] });
  assert.ok(allowed.includes('Write(./**)') && allowed.includes('Edit(./**)') && allowed.includes('mcp__p__open'));
  assert.ok(!allowed.includes('Write') && !allowed.includes('Edit') && !allowed.includes('AskUserQuestion'));
});

test('testing.md 5章 query の options：設定は読ませず、本体は同梱のもの、プラグインは渡したものだけ', () => {
  const base = { PATH: '/bin', GITHUB_TOKEN: 'x' };
  const cwd = tmp();
  const options = makeQueryOptions({ cwd, home: '/tmp/h', model: 'claude-sonnet-5-5', plugins: ['/p/one'], agent: 'one:orchestrator', maxTurns: 9, sandbox: false, base });
  assert.deepEqual(options.settingSources, []);
  assert.deepEqual(options.plugins, [{ type: 'local', path: '/p/one' }]);
  assert.equal(options.pathToClaudeCodeExecutable, undefined);
  assert.equal(options.sandbox, undefined);
  assert.equal(options.agent, 'one:orchestrator');
  assert.equal(options.model, 'claude-sonnet-5-5');
  assert.equal(options.maxTurns, 9);
  assert.equal(options.env.GITHUB_TOKEN, undefined);
  assert.deepEqual(options.systemPrompt, { type: 'preset', preset: 'claude_code' });
  const sandboxed = makeQueryOptions({ cwd, home: '/tmp/h', model: 'claude-sonnet-5-5', sandbox: true, systemPromptAppend: '追加の指示', base });
  assert.equal(sandboxed.sandbox.enabled, true);
  assert.equal(sandboxed.systemPrompt.append, '追加の指示');
  assert.deepEqual(sandboxed.plugins, []);
  assert.throws(() => makeQueryOptions({ cwd, home: '/tmp/h' }), /model/);
});
