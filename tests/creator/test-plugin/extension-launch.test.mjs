// エクステンションの起動（skills/test-plugin/scripts/extension-launch.mjs、extension-bootstrap.mjs、extension-sdk-resolver.mjs）の試験。
// Copilot SDK でセッションを作るときは、エクステンションの起動のしかたを EVAL の仕組みが決める。ここは、本物の Node.js の子プロセスで確かめる。
// 本物のランタイムとつないだ確かめは、使い捨ての環境で行った（作業のメモ）。最終確認で、本物のアカウントで人が確かめる。
// 確かめる要件：REQ-041（生成プラグインありの EVAL でエクステンションを動かす）。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { after, describe, test } from 'node:test';

import { SCRIPTS_DIR, cleanupTemp, loadScript, tempWith } from './helpers.mjs';

const { createExtensionLaunchProvider, safeEnv } = await loadScript('extension-launch.mjs');
after(cleanupTemp);

const BOOTSTRAP = path.join(SCRIPTS_DIR, 'extension-bootstrap.mjs');
const request = (id, source = 'plugin') => ({ id, name: id, modulePath: `/e/${id}/extension.mjs`, source });

describe('起動のしかたを答える', () => {
  test('REQ-041 引き受けるエクステンションには、Node.js で extension-bootstrap.mjs を動かすコマンドと、入口の場所（EXTENSION_PATH）を答える', async () => {
    const provider = createExtensionLaunchProvider({ accept: () => true, node: '/usr/bin/node', bootstrap: '/s/extension-bootstrap.mjs', env: { PATH: '/bin', HOME: '/h' } });
    assert.deepEqual(await provider.resolve(request('plugin:a:a')), {
      launch: { executable: '/usr/bin/node', args: ['/s/extension-bootstrap.mjs'], env: { PATH: '/bin', HOME: '/h', EXTENSION_PATH: '/e/plugin:a:a/extension.mjs' } },
    });
    assert.deepEqual(provider.launched, ['plugin:a:a']);
  });

  test('REQ-041 引き受けないエクステンション、入口の場所のない求めには、launch を付けずに答える（起動されない）。断った名前は残る', async () => {
    const logs = [];
    const provider = createExtensionLaunchProvider({ accept: (r) => r.source === 'plugin', log: (t) => logs.push(t) });
    assert.deepEqual(await provider.resolve(request('user:x', 'user')), {});
    assert.deepEqual(await provider.resolve({ id: 'plugin:y:y', source: 'plugin' }), {}, '入口の場所がない');
    assert.deepEqual(provider.skipped, ['user:x', 'plugin:y:y']);
    assert.deepEqual(provider.launched, []);
    assert.match(logs[0], /user:x は起動しません/);
  });

  test('REQ-041 既定では、今の Node.js と、同じフォルダの起動用のファイルを使う', async () => {
    const provider = createExtensionLaunchProvider({ accept: () => true });
    const { launch } = await provider.resolve(request('plugin:a:a'));
    assert.equal(launch.executable, process.execPath);
    assert.equal(launch.args[0], BOOTSTRAP);
  });

  test('REQ-041 子プロセスには、トークン・秘密・パスワード・API キーなどの名前の環境変数を渡さない（Copilot CLI が外すのと同じ考え方）', () => {
    const env = { PATH: '/bin', GITHUB_TOKEN: 'x', GH_TOKEN: 'x', MY_SECRET: 'x', DB_PASSWORD: 'x', ANTHROPIC_API_KEY: 'x', openai_api_key: 'x', AWS_CREDENTIALS: 'x', COPILOT_HOME: '/h', NOT_SET: undefined, NUM: 1 };
    assert.deepEqual(safeEnv(env), { PATH: '/bin', COPILOT_HOME: '/h' });
  });
});

describe('起動用のファイル（本物の Node.js の子プロセスで）', () => {
  /** 子プロセスを動かして、標準出力・標準エラー出力・終了コードを集める */
  function launch({ env, args = [BOOTSTRAP], keepAlive = false }) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, args, { env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      const finish = (code) => resolve({ code, out, err, child });
      child.on('exit', finish);
      if (keepAlive) setTimeout(() => child.kill(), 1500);
    });
  }

  /** SDK のフォルダの見本（extension.js と index.js があるだけ）と、それを読み込むエクステンション */
  function fixture() {
    const dir = tempWith({
      'sdk/index.js': "export const marker = 'sdk-index';\n",
      'sdk/extension.js': "export const marker = 'sdk-extension';\nexport const joinSession = () => 'joined';\n",
      'ext/extension.mjs': "import { marker, joinSession } from '@github/copilot-sdk/extension';\nimport * as index from '@github/copilot-sdk';\nconsole.log(JSON.stringify({ marker, index: index.marker, joined: joinSession(), cwd: process.cwd() === process.cwd() }));\nprocess.exit(0);\n",
      'ext/commonjs.cjs': "const sdk = require('@github/copilot-sdk');\nconsole.log(JSON.stringify({ cjs: typeof sdk }));\nprocess.exit(0);\n",
      'ext/broken.mjs': "throw new Error('エクステンションの中の失敗');\n",
    }, 'c3-ext-');
    return { dir, sdk: path.join(dir, 'sdk'), ext: path.join(dir, 'ext', 'extension.mjs'), cjs: path.join(dir, 'ext', 'commonjs.cjs'), broken: path.join(dir, 'ext', 'broken.mjs') };
  }

  test('REQ-041 エクステンションの `import "@github/copilot-sdk/extension"` と `"@github/copilot-sdk"` を、COPILOT_SDK_PATH のフォルダに向けて読み込む', async () => {
    const f = fixture();
    const { code, out, err } = await launch({ env: { EXTENSION_PATH: f.ext, COPILOT_SDK_PATH: f.sdk, COPILOT_EXTENSION_PARENT_PID: String(process.pid) } });
    assert.equal(code, 0, err);
    assert.deepEqual(JSON.parse(out.trim()), { marker: 'sdk-extension', index: 'sdk-index', joined: 'joined', cwd: true });
  });

  test('REQ-041 CommonJS のエクステンションの require("@github/copilot-sdk") も、同じフォルダに向ける', async () => {
    const f = fixture();
    // 見本の index.js は ES モジュール。require で読める Node.js（20.19 以上、22.12 以上）では読めて、読めないときは SDK のフォルダの index.js の名前で失敗する
    const { out, err } = await launch({ env: { EXTENSION_PATH: f.cjs, COPILOT_SDK_PATH: f.sdk, COPILOT_EXTENSION_PARENT_PID: String(process.pid) } });
    assert.ok(/"cjs":"object"/.test(out) || /sdk[\\/]index\.js/.test(err), `${out}${err}`);
  });

  test('REQ-041 入口の場所がないとき、入口が読み込めないときは、理由を標準エラー出力に出して、終了コード 1 で終わる', async () => {
    const f = fixture();
    const none = await launch({ env: { COPILOT_SDK_PATH: f.sdk, COPILOT_EXTENSION_PARENT_PID: String(process.pid) } });
    assert.equal(none.code, 1);
    assert.match(none.err, /EXTENSION_PATH がありません/);
    const broken = await launch({ env: { EXTENSION_PATH: f.broken, COPILOT_SDK_PATH: f.sdk, COPILOT_EXTENSION_PARENT_PID: String(process.pid) } });
    assert.equal(broken.code, 1);
    assert.match(broken.err, /エクステンションを読み込めませんでした.*エクステンションの中の失敗/s);
  });

  test('REQ-041 ランタイム（親のプロセス）がいなくなったら、エクステンションのプロセスも自分で終わる（画面のサーバーを残さない）', async () => {
    const f = fixture();
    const keep = tempWith({ 'keep.mjs': "setInterval(() => {}, 1000);\n" }, 'c3-keep-');
    // 親のふり：短く生きて死ぬプロセス
    const parent = spawn(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 300)'], { stdio: 'ignore' });
    const stay = path.join(keep, 'keep.mjs');
    const started = Date.now();
    const result = await launch({ env: { EXTENSION_PATH: stay, COPILOT_SDK_PATH: f.sdk, COPILOT_EXTENSION_PARENT_PID: String(parent.pid) }, keepAlive: true });
    // 親が300ミリ秒で終わる。1秒おきの見張りで気づいて終わる（1.5秒の打ち切りより前）
    assert.equal(result.code, 0, `終わったのは${Date.now() - started}ミリ秒後。打ち切り（kill）ではなく、自分で終わった`);
  });
});
