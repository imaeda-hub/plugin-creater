// Level 2 (component test) of the web dashboard with a headless browser. No agent and no model run:
// the agents' state changes are posted to the dashboard by this script.
// Usage: node ui_test.mjs PLUGIN_DIR SCREENSHOT_DIR
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { globSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const [pluginDir, shotDir] = process.argv.slice(2);
const server = globSync(path.join(pluginDir, 'skills', '*', 'scripts', 'server.py'))[0];
const results = [];
const check = (test, ok, detail = '') => results.push({ test, ok: Boolean(ok), detail });

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
async function startServer() {
  const port = await freePort();
  const child = spawn('python3', [server, '--port', String(port)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(url + 'status'); return { child, url, port }; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('dashboard did not start');
}
const post = (url, p, data) => fetch(url + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const agentState = (page, agent) => page.getAttribute(`#agents li[data-agent="${agent}"]`, 'data-state');

const browser = await chromium.launch();
try {
  // Scenario 1: settings -> start -> live view -> result
  {
    const { child, url } = await startServer();
    const page = await browser.newPage();
    let navigations = 0;
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++; });
    await page.goto(url);
    await page.selectOption('#model', 'haiku');
    await page.fill('#limit', '2');
    await page.click('#start');
    await page.waitForFunction(() => document.querySelector('#start').disabled);
    const s = await (await fetch(url + 'status')).json();
    check('開始前の設定：画面で選んだ設定で開始される', s.started && s.settings.model === 'haiku' && s.settings.limit === 2, JSON.stringify(s.settings));

    await post(url, 'event', { kind: 'phase', phase: '作業' });
    await post(url, 'event', { kind: 'agent', agent: 'worker', state: '実行中' });
    await page.waitForFunction(() => document.querySelector('#agents li[data-agent="worker"]')?.dataset.state === '実行中');
    check('実行中の表示：フェーズとエージェントの状態が出る', (await page.textContent('#phase')) === '作業' && (await agentState(page, 'worker')) === '実行中');
    await post(url, 'event', { kind: 'agent', agent: 'worker', state: '完了' });
    await post(url, 'event', { kind: 'phase', phase: '検証' });
    await page.waitForFunction(() => document.querySelector('#phase').textContent === '検証');
    check('実行中の表示：再読み込みせずに表示が変わる', navigations === 1, `navigations=${navigations}`);
    await page.screenshot({ path: path.join(shotDir, 'l2-running.png'), fullPage: true });

    await post(url, 'result', { reason: '評価基準をすべて満たした', summary: '週報を作った' });
    await page.waitForFunction(() => document.querySelector('#result').textContent.includes('評価基準をすべて満たした'));
    const text = await page.textContent('#result');
    check('結果の確認：終わった理由と使った設定が出る', text.includes('作業のモデル=haiku') && text.includes('繰り返しの上限=2'), text);
    await page.screenshot({ path: path.join(shotDir, 'l2-result.png'), fullPage: true });
    child.kill();
  }
  // Scenario 2: stop button
  {
    const { child, url, port } = await startServer();
    const page = await browser.newPage();
    await page.goto(url);
    await page.click('#start');
    await post(url, 'event', { kind: 'agent', agent: 'worker', state: '実行中' });
    await page.click('#stop');
    await page.waitForFunction(() => [...document.querySelectorAll('#agents li')].every((li) => li.dataset.state === '停止'));
    check('止める：すべてのエージェントが停止と表示される', true);
    check('止める：終わった理由に「ユーザーが止めた」と出る', (await page.textContent('#result')).includes('ユーザーが止めた'));

    // Connection limit: reachable from this machine only.
    const other = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
    let reachable = false;
    if (other) { try { await fetch(`http://${other.address}:${port}/status`); reachable = true; } catch { reachable = false; } }
    check('接続の制限：ほかのアドレスからは開けない', other && !reachable, other ? other.address : 'no external address');
    child.kill();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ ok: failed.length === 0, passed: results.length - failed.length, failed, results }, null, 2));
process.exit(failed.length ? 1 : 0);
