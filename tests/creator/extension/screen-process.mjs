// 試験の道具：クリエイターのエクステンションを、別のプロセスとして動かす（偽物のセッションにつなぐ）。
// 画面のサーバーは、このプロセスの中で動く。プロセスが終われば、サーバーも終わる（REQ-043）。
// 使い方：node screen-process.mjs <COPILOT_HOME> <作業フォルダ>。起動したら、標準出力に { url, pid } を1行で出す。
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createFakeSession } from './fake-session.mjs';
import { EXTENSION_DIR } from './helpers.mjs';

const [home, cwd] = process.argv.slice(2);
const { startCreator } = await import(pathToFileURL(path.join(EXTENSION_DIR, 'creator.mjs')).href);
const fake = createFakeSession({ sessionId: 'session-process-1', cwd });
await startCreator({ joinSession: fake.joinSession, env: { SESSION_ID: 'session-process-1', COPILOT_HOME: home }, cwd, warn: () => {} });
const text = await fake.callTool('plugin-creator_open', {});
const url = /(http:\/\/127\.0\.0\.1:\d+\/\?k=\S+)/.exec(text)[1];
process.stdout.write(`${JSON.stringify({ url, pid: process.pid })}\n`);
// Copilot CLI がつなぎ続ける代わりに、標準入力が閉じても終わらずに待つ（終わらせるのは、親の試験が SIGTERM で行う）
setInterval(() => {}, 60_000);
