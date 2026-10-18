import fs from 'node:fs';
import path from 'node:path';
import { freshDir, runAgent, sleep } from './lib.mjs';
const dash = process.argv[2];
const cwd = freshDir('sbx');
const prompt = `次の3つのコマンドを、それぞれ別の Bash の呼び出しで順に実行し、それぞれの出力をそのまま報告してください。失敗しても別の方法は試さないでください。
1. mkdir -p /tmp/outside-sbx-test && echo MADE-OUTSIDE
2. echo hi > inside.txt && cat inside.txt
3. python3 ${dash} start`;
const watcher = (async () => {
  for (let i = 0; i < 240; i++) {
    try {
      const { url } = JSON.parse(fs.readFileSync(path.join(cwd, '.dashboard.json'), 'utf8'));
      await sleep(500);
      try { const s = await (await fetch(url + 'status')).json(); return `reachable from the host: started=${s.started}`; }
      catch (e) { return `NOT reachable from the host: ${e.cause?.code ?? e.message}`; }
    } catch { await sleep(500); }
  }
  return 'dashboard not started';
})();
const { record } = await runAgent({ prompt, cwd, model: 'haiku', maxTurns: 8, onQuestion: async () => ({}) });
console.log('host check:', await watcher);
console.log('outside dir exists:', fs.existsSync('/tmp/outside-sbx-test'), '| inside.txt:', fs.existsSync(path.join(cwd, 'inside.txt')));
console.log('agent said:', record.results.at(-1)?.text?.slice(0, 900));
try { process.kill(JSON.parse(fs.readFileSync(path.join(cwd, '.dashboard.json'), 'utf8')).pid); } catch {}
