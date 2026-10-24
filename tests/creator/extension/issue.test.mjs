// 2段目 部品の試験（クリエイターのエクステンション）：質問の改善案の起票（plugin-creator_issue）。
// 設計書：creator-structure.md 4.5、generated-plugin-structure.md 4.11、hearing.md 11章。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { EXTENSION_DIR, tempDir, withRun } from './helpers.mjs';

const { fileIssue, runGh, ghArguments, IssueError } = await import(pathToFileURL(path.join(EXTENSION_DIR, 'issue.mjs')).href);
const { GH_TIMEOUT_MS, ISSUE_REPOSITORY } = await import(pathToFileURL(path.join(EXTENSION_DIR, 'constants.mjs')).href);

// 偽物の gh は、拡張子のない shebang の実行ファイル（#!/usr/bin/env node、#!/bin/sh）なので、Windows の spawn では動かせない。
// 偽物の gh を使う試験は、Windows では理由を書いて飛ばす。偽物の gh なしで動く確かめ（gh がない〔ENOENT〕、引数の配列を覚える偽物の関数など）は、Windows でも動かす
const FAKE_GH_SKIP = process.platform === 'win32' ? '偽物の gh（拡張子のない実行ファイル）は Windows の spawn で動かせないため、飛ばす' : false;

const ISSUE_URL = 'https://github.com/imaeda-hub/plugin-creator/issues/7';
const ok = (stdout = `${ISSUE_URL}\n`) => ({ code: 0, stdout, stderr: '', timedOut: false, notFound: false });

/** 呼ばれた引数と標準入力を覚える、偽物の gh の動かし方 */
function recorder(result = ok()) {
  const calls = [];
  const run = async (args, input) => {
    calls.push({ args, input });
    return typeof result === 'function' ? result(args, input) : result;
  };
  return { run, calls };
}

describe('質問の改善案の起票', () => {
  test('REQ-049 gh issue create --repo imaeda-hub/plugin-creator を、題は引数の配列、本文は標準入力で渡す', async () => {
    const { run, calls } = recorder();
    await withRun(
      async (run2) => {
        const text = await run2.call('issue', { title: '項目「進め方」を聞いた後に出てきた決まりが多い', body: '段階：項目の点検\n項目：進め方\n種類：聞いた後に自分から話した\n数：2' });
        assert.equal(text, `起票しました：${ISSUE_URL}`);
      },
      { extra: { runGh: run } },
    );
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, ['issue', 'create', '--repo', 'imaeda-hub/plugin-creator', '--title=項目「進め方」を聞いた後に出てきた決まりが多い', '--body-file', '-']);
    assert.equal(calls[0].input, '段階：項目の点検\n項目：進め方\n種類：聞いた後に自分から話した\n数：2');
    assert.equal(ISSUE_REPOSITORY, 'imaeda-hub/plugin-creator');
  });

  test('REQ-049 題や本文がコマンドの一部として解釈されない：シェルの記号も、- で始まる題も、そのまま渡る', async () => {
    const title = '--web $(touch /tmp/never) `id` "引用" \'単\' ; rm -rf * & |';
    const body = '$(touch /tmp/never)\n`id`\n\n"引用"\n- 箇条書き\n---\n日本語';
    const { run, calls } = recorder();
    await withRun(async (r) => r.call('issue', { title, body }), { extra: { runGh: run } });
    assert.deepEqual(calls[0].args, ['issue', 'create', '--repo', ISSUE_REPOSITORY, `--title=${title}`, '--body-file', '-']);
    assert.equal(calls[0].input, body);
    assert.ok(!fs.existsSync('/tmp/never'));
  });

  test('REQ-049 実際にプロセスを起こしても、シェルを通らない：引数の配列と標準入力のまま gh に届く', { skip: FAKE_GH_SKIP }, async () => {
    const dir = tempDir('fakegh');
    try {
      const log = path.join(dir, 'log.json');
      const gh = path.join(dir, 'gh');
      fs.writeFileSync(
        gh,
        `#!/usr/bin/env node
const fs = require('node:fs');
let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  fs.writeFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ argv: process.argv.slice(2), input, tokens: Object.keys(process.env).filter((k) => /TOKEN/.test(k)) }));
  console.log(${JSON.stringify(ISSUE_URL)});
});
`,
        { mode: 0o755 },
      );
      const title = '$(touch gh-was-here) `id` "x" ; echo hi';
      const body = '本文\n$(touch gh-was-here)\n行3';
      const env = { PATH: process.env.PATH, FAKE_GH_LOG: log };
      // シェルが解釈すると、今のフォルダに touch が走る。試験用の空のフォルダで動かし、リポジトリを汚さない
      const text = await fileIssue({ title, body }, { run: (args, input) => runGh(args, input, { command: gh, env, cwd: dir }) });
      assert.equal(text, `起票しました：${ISSUE_URL}`);
      const seen = JSON.parse(fs.readFileSync(log, 'utf8'));
      assert.deepEqual(seen.argv, ghArguments(title));
      assert.equal(seen.input, body);
      assert.deepEqual(seen.tokens, [], '環境変数（GITHUB_TOKEN など）を求めない・渡さない');
      assert.ok(!fs.existsSync(path.join(dir, 'gh-was-here')), 'シェルが解釈した');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('REQ-049 gh がないときは、入れ方とログインのしかたを返す', async () => {
    // 実際に存在しない gh を呼ぶ（ENOENT）
    const r = await runGh(ghArguments('題'), '本文', { command: path.join(tempDir('nogh'), 'gh-not-installed') });
    assert.equal(r.notFound, true);
    await assert.rejects(
      fileIssue({ title: '題', body: '本文' }, { run: async () => r }),
      (error) => {
        assert.ok(error instanceof IssueError);
        assert.match(error.message, /gh（GitHub の公式のコマンド）が見つかりません。https:\/\/cli\.github\.com\/ から入れて/);
        assert.match(error.message, /gh auth login/);
        return true;
      },
    );
  });

  test('REQ-049 ログインしていないときは、ログインのしかたを返す（環境変数を求めない）', async () => {
    for (const stderr of [
      'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.',
      'HTTP 401: Bad credentials (https://api.github.com/graphql)',
      'You are not logged into any GitHub hosts. Run gh auth login to authenticate.',
    ]) {
      const { run } = recorder({ code: 4, stdout: '', stderr, timedOut: false, notFound: false });
      await assert.rejects(fileIssue({ title: '題', body: '本文' }, { run }), (error) => {
        assert.match(error.message, /gh でログインしていないため、起票できません。ターミナルで「gh auth login」を実行してログインしてください。/);
        assert.ok(!/GITHUB_TOKEN|GH_TOKEN/.test(error.message), '環境変数を求めない');
        return true;
      });
    }
  });

  test('REQ-049 そのほかの失敗は、終了コードと理由を返す。時間切れは「起票したか分からない」と返す', async () => {
    const failed = recorder({ code: 1, stdout: '', stderr: 'GraphQL: Could not resolve to a Repository with the name imaeda-hub/plugin-creator.', timedOut: false, notFound: false });
    await assert.rejects(fileIssue({ title: '題', body: '本文' }, { run: failed.run }), /起票できませんでした（gh の終了コード 1）。理由：GraphQL: Could not resolve to a Repository/);

    const timedOut = recorder({ code: null, stdout: '', stderr: '', timedOut: true, notFound: false });
    await assert.rejects(
      fileIssue({ title: '題', body: '本文' }, { run: timedOut.run }),
      /起票の返事が60秒たっても来ませんでした。起票されたか分かりません。imaeda-hub\/plugin-creator の Issue の一覧を確かめてから、必要なら、もう一度承認してください。/,
    );
  });

  test('REQ-049 60秒の上限を付け、超えたら gh を止める', { skip: FAKE_GH_SKIP }, async () => {
    assert.equal(GH_TIMEOUT_MS, 60_000);
    const dir = tempDir('slowgh');
    try {
      const gh = path.join(dir, 'gh');
      // sh が sleep を起こして待つ形（sh だけを止めても、sleep が管を開けたまま）にして、待たずに返せることも確かめる
      fs.writeFileSync(gh, '#!/bin/sh\nsleep 30\necho done\n', { mode: 0o755 });
      const started = Date.now();
      const result = await runGh(ghArguments('題'), '本文', { command: gh, timeoutMs: 300, env: { PATH: process.env.PATH } });
      assert.equal(result.timedOut, true);
      assert.ok(Date.now() - started < 5000, '上限で止められていない');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('REQ-049 題や本文が空・題が複数行・題が長すぎるときは、gh を動かさずに断る', async () => {
    const { run, calls } = recorder();
    for (const [issue, pattern] of [
      [{ title: '', body: '本文' }, /Issue の題が空です/],
      [{ title: '  ', body: '本文' }, /Issue の題が空です/],
      [{ title: '題', body: '' }, /Issue の本文が空です/],
      [{ title: '1行目\n2行目', body: '本文' }, /題は1行にしてください/],
      [{ title: 'あ'.repeat(257), body: '本文' }, /題が長すぎます/],
      [{ title: 5, body: '本文' }, /Issue の題が空です/],
    ]) {
      await assert.rejects(fileIssue(issue, { run }), pattern);
    }
    assert.equal(calls.length, 0);
  });

  test('REQ-049 起票のツールは、確認を省かず、許可の求めに答えず、環境変数を求めない', async () => {
    await withRun(async (r) => {
      assert.notEqual(r.fake.tool('plugin-creator_issue').skipPermission, true);
      assert.equal(r.fake.config.onPermissionRequest, undefined);
      assert.equal(r.fake.config.requestedEnvironmentVariables, undefined, '断られるとエクステンションごと読み込まれない');
      const text = fs.readFileSync(path.join(EXTENSION_DIR, 'issue.mjs'), 'utf8');
      assert.ok(!/process\.env\.(GITHUB_TOKEN|GH_TOKEN)/.test(text), '環境変数のトークンを読んでいない');
    });
  });

  test('REQ-049 起票の失敗は、ツールの失敗として平易な日本語で返る', async () => {
    const { run } = recorder({ code: 4, stdout: '', stderr: 'gh auth login', timedOut: false, notFound: false });
    await withRun(
      async (r) => {
        const result = await r.callSafe('issue', { title: '題', body: '本文' });
        assert.equal(result.ok, false);
        assert.match(result.error, /gh でログインしていない/);
      },
      { extra: { runGh: run } },
    );
  });
});
