// 許可の求めと質問への答え方（skills/test-plugin/scripts/permissions.mjs）の試験。
// 確かめる要件：REQ-041（EVAL の実行）、REQ-005（実行中の確認はチャットで答える。EVAL ではこの関数が人の代わりに答える）。
// 設計：testing.md 10.4「質問と許可の求め」、generated-plugin-structure.md 4.14、R2 3.5・3.11。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { cleanupTemp, loadScript, makeTemp, tempWith } from './helpers.mjs';

const perm = await loadScript('permissions.mjs');
after(cleanupTemp);

const workDir = () => tempWith({ 'out/.keep': '' }, 'c3-work-');
const decide = (request, invocation, dir) => perm.decidePermission(request, invocation, { workDir: dir });

describe('組織の管理設定（managedApprovalRequired）', () => {
  test('REQ-041 人の承認が要る求めは許可せず、答えず（no-result）、EVAL を止める（SDK の第1引数の印）', async () => {
    const dir = workDir();
    const stops = [];
    const handler = perm.createPermissionHandler({ workDir: dir, onManaged: (info) => stops.push(info) });
    const request = { kind: 'shell', fullCommandText: 'npm install left-pad', managedApprovalRequired: true };
    assert.deepEqual(await handler(request, { sessionId: 's' }), { kind: 'no-result' });
    assert.equal(stops.length, 1);
    assert.equal(stops[0].summary, 'コマンドの実行：npm install left-pad');
    assert.equal(stops[0].request, request);
    assert.equal(handler.stats.managed, 1);
    assert.equal(handler.stats.approved, 0);
  });

  test('REQ-041 人の答えが要るかは、invocation.promptRequest の印を先に見て、なければ request の印を見る（SDK 1.0.25 の読み方）', () => {
    const dir = workDir();
    const outcome = (request, invocation) => decide(request, invocation, dir).outcome;
    assert.equal(outcome({ kind: 'read', path: dir, managedApprovalRequired: true }, {}), 'managed');
    assert.equal(outcome({ kind: 'read', path: dir }, { promptRequest: { kind: 'read', managedApprovalRequired: true } }), 'managed');
    assert.equal(outcome({ kind: 'read', path: dir, managedApprovalRequired: true }, { promptRequest: { kind: 'read', managedApprovalRequired: false } }), 'approved', '人の要件が外れた（Assisted の承認の後）');
    assert.equal(outcome({ kind: 'read', path: dir, managedApprovalRequired: true }, { promptRequest: { kind: 'path' } }), 'managed', 'promptRequest に印がなければ、request の印');
    assert.equal(outcome({ kind: 'read', path: dir, managedApprovalRequired: false }, {}), 'approved');
    assert.equal(outcome({ kind: 'read', path: dir }, undefined), 'approved');
  });

  test('REQ-041 人の承認が要る求めは、エクステンションの確認でも、作業フォルダの外への書き込みでも、まず止める', () => {
    const dir = workDir();
    assert.equal(decide({ kind: 'extension-permission-access', extensionName: 'x', managedApprovalRequired: true }, {}, dir).outcome, 'managed');
    assert.equal(decide({ kind: 'write', fileName: '/etc/passwd', managedApprovalRequired: true }, {}, dir).outcome, 'managed');
  });

  test('REQ-041 止める処理が失敗しても、答える関数は例外を投げない', async () => {
    const handler = perm.createPermissionHandler({ workDir: workDir(), onManaged: () => { throw new Error('止められない'); } });
    assert.deepEqual(await handler({ kind: 'url', url: 'https://example.com', managedApprovalRequired: true }, {}), { kind: 'no-result' });
  });
});

describe('エクステンションの確認', () => {
  test('REQ-041 エクステンションの読み込みのときの確認（extension-permission-access）は許可し、名前と権限を記録する', async () => {
    const handler = perm.createPermissionHandler({ workDir: workDir() });
    const request = { kind: 'extension-permission-access', extensionName: 'plugin:weekly:weekly', capabilities: ['skip tool permission prompts', 'register hooks', 'handle permission requests'] };
    assert.deepEqual(await handler(request, { sessionId: 's' }), { kind: 'approve-once' });
    assert.deepEqual(handler.stats.extensionRequests, [{ name: 'plugin:weekly:weekly', capabilities: request.capabilities }]);
    assert.equal(handler.stats.approved, 1);
  });

  test('REQ-041 エクステンションの管理（読み込み直しなど）と環境変数の求めは拒み、理由を返す', async () => {
    const handler = perm.createPermissionHandler({ workDir: workDir() });
    const a = await handler({ kind: 'extension-management' }, {});
    const b = await handler({ kind: 'extension-env-access', extensionName: 'x', environmentVariables: ['GITHUB_TOKEN'] }, {});
    assert.equal(a.kind, 'reject');
    assert.match(a.feedback, /エクステンションの管理/);
    assert.equal(b.kind, 'reject');
    assert.match(b.feedback, /環境変数/);
    assert.deepEqual(handler.stats.rejections.map((r) => r.reason), ['extension_management', 'env_access']);
  });
});

describe('作業フォルダの外への書き込み', () => {
  test('REQ-041 作業フォルダの中への書き込みは許可する（相対の場所も、まだない場所も）', () => {
    const dir = workDir();
    for (const fileName of [path.join(dir, 'out', '週報.md'), path.join(dir, 'new', 'deep', 'a.md'), 'out/relative.md', './x.md', path.join(dir, 'x.md')]) {
      assert.equal(decide({ kind: 'write', fileName }, {}, dir).outcome, 'approved', fileName);
    }
  });

  test('REQ-041 作業フォルダの外への書き込みは拒み、作業フォルダの中に書くよう伝える', async () => {
    const dir = workDir();
    const sibling = `${dir}-sibling`; // 名前の頭が同じ別のフォルダ（頭の文字の比べ合いだけだと間違える）
    const handler = perm.createPermissionHandler({ workDir: dir });
    for (const fileName of ['/etc/hosts', path.join(sibling, 'a.md'), path.join(dir, '..', 'escape.md'), '../escape.md', path.join(makeTemp(), 'other.md')]) {
      const answer = await handler({ kind: 'write', fileName }, {});
      assert.equal(answer.kind, 'reject', fileName);
      assert.ok(answer.feedback.includes(dir), '作業フォルダの場所を伝える');
    }
    assert.equal(handler.stats.rejected, 5);
    assert.equal(handler.stats.rejections[0].summary, 'ファイルの書き込み：/etc/hosts');
  });

  test('REQ-041 作業フォルダの中のシンボリックリンクが外を指しているときも、本当の場所で見て拒む', () => {
    const dir = workDir();
    const outside = makeTemp();
    fs.symlinkSync(outside, path.join(dir, 'linked'));
    fs.symlinkSync(path.join(outside, 'file.md'), path.join(dir, 'out', 'file-link.md'));
    assert.equal(decide({ kind: 'write', fileName: path.join(dir, 'linked', 'new.md') }, {}, dir).outcome, 'outside_write');
    assert.equal(decide({ kind: 'write', fileName: path.join(dir, 'out', 'file-link.md') }, {}, dir).outcome, 'outside_write');
  });

  test('REQ-041 書き込み先が分からない求めは拒む', () => {
    const dir = workDir();
    assert.equal(decide({ kind: 'write' }, {}, dir).outcome, 'outside_write');
    assert.equal(decide({ kind: 'write', fileName: '' }, {}, dir).outcome, 'outside_write');
  });

  test('REQ-041 作業フォルダの外を指す場所を調べる関数 isInsideDir', () => {
    const dir = workDir();
    assert.equal(perm.isInsideDir(dir, dir), true);
    assert.equal(perm.isInsideDir(dir, 'out/a.md'), true);
    assert.equal(perm.isInsideDir(dir, path.dirname(dir)), false);
    assert.equal(perm.isInsideDir(dir, `${dir}-x/a`), false);
  });
});

describe('ほかの求め', () => {
  test('REQ-041 作業フォルダの外への書き込み以外は、許可する（コマンド、読み取り、Web、MCP、追加のツール、記憶、フック、手順）', async () => {
    const dir = workDir();
    const handler = perm.createPermissionHandler({ workDir: dir });
    const requests = [
      { kind: 'shell', fullCommandText: 'python3 /plugin/scripts/x.py > /tmp/log', possiblePaths: ['/tmp/log'], hasWriteFileRedirection: true },
      { kind: 'read', path: '/etc/hosts' },
      { kind: 'url', url: 'https://example.com' },
      { kind: 'mcp', serverName: 's', toolName: 't' },
      { kind: 'custom-tool', toolName: 'weekly_open' },
      { kind: 'memory' },
      { kind: 'hook' },
      { kind: 'workflow' },
      { kind: 'something-new-in-the-future' },
    ];
    for (const request of requests) assert.deepEqual(await handler(request, { sessionId: 's' }), { kind: 'approve-once' }, request.kind);
    assert.equal(handler.stats.approved, requests.length);
    assert.equal(handler.stats.rejected, 0);
  });

  test('REQ-041 求めの形が想定と違っても、答える関数は例外を投げず、拒む答えと理由を返す', async () => {
    const handler = perm.createPermissionHandler({ workDir: workDir() });
    const hostile = { kind: 'write', get fileName() { throw new Error('読めない'); } };
    const answer = await handler(hostile, {});
    assert.equal(answer.kind, 'reject');
    assert.match(answer.feedback, /判定できませんでした（読めない）/);
    assert.equal(handler.stats.rejections[0].reason, 'judge_failed');
    assert.deepEqual(await handler(undefined, undefined), { kind: 'approve-once' });
  });

  test('REQ-041 拒んだ求めの一覧は、50件までにする', async () => {
    const handler = perm.createPermissionHandler({ workDir: workDir() });
    for (let i = 0; i < 60; i += 1) await handler({ kind: 'extension-management' }, {});
    assert.equal(handler.stats.rejected, 60);
    assert.equal(handler.stats.rejections.length, 50);
  });
});

describe('求めの説明', () => {
  test('REQ-041 求めの内容を短い日本語にする（長いコマンドは切る）', () => {
    assert.equal(perm.describeRequest({ kind: 'read', path: '/a/b' }), 'ファイルの読み取り：/a/b');
    assert.equal(perm.describeRequest({ kind: 'url', url: 'https://x' }), 'Web の取得：https://x');
    assert.equal(perm.describeRequest({ kind: 'mcp', serverName: 'srv', toolName: 'tool' }), '外部のツールの利用：srv/tool');
    assert.equal(perm.describeRequest({ kind: 'custom-tool', toolName: 'w_open' }), '追加のツールの利用：w_open');
    assert.equal(perm.describeRequest({ kind: 'extension-management' }), 'エクステンションの管理（読み込み直しなど）');
    assert.equal(perm.describeRequest({ kind: 'extension-env-access', extensionName: 'e' }), 'エクステンションの環境変数の利用：e');
    assert.equal(perm.describeRequest({}), '確認（種類不明）');
    const long = perm.describeRequest({ kind: 'shell', fullCommandText: 'x'.repeat(500) });
    assert.ok([...long].length < 200 && long.endsWith('…'));
  });
});

describe('質問（ask_user）への返事', () => {
  test('REQ-041 いつも決まった返事を返し、質問の数と文を記録する（ユーザー役の AI は使わない）', async () => {
    const handler = perm.createUserInputHandler();
    const a = await handler({ question: '保存先はどこですか？' }, { sessionId: 's' });
    const b = await handler({ question: '文体は？', choices: ['です・ます調', 'だ・である調'], allowFreeform: true });
    assert.deepEqual(a, { answer: '課題に書いたこと以外は決まっていません。判断して進めてください', wasFreeform: true });
    assert.deepEqual(b, a, 'あり・なしで、どの質問にも同じ返事');
    assert.equal(perm.FIXED_ANSWER, a.answer);
    assert.deepEqual(handler.stats, { count: 2, questions: ['保存先はどこですか？', '文体は？'] });
  });

  test('REQ-041 選択肢だけを認める質問には、最初の選択肢で答える（止まらないように）', async () => {
    const handler = perm.createUserInputHandler();
    assert.deepEqual(await handler({ question: '続けますか？', choices: ['はい', 'いいえ'], allowFreeform: false }), { answer: 'はい', wasFreeform: false });
  });

  test('REQ-041 質問の文の一覧は50件までにする', async () => {
    const handler = perm.createUserInputHandler();
    for (let i = 0; i < 55; i += 1) await handler({ question: `Q${i}` });
    assert.equal(handler.stats.count, 55);
    assert.equal(handler.stats.questions.length, 50);
  });
});
