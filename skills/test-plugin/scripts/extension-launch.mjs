// Copilot SDK でセッションを作るとき、プラグインのエクステンションの起動のしかたは、SDK を使う側（EVAL の仕組み）が決める。
// ランタイムが見つけたエクステンションごとに resolve を呼ぶので、起動のコマンド（Node.js で extension-bootstrap.mjs）を答える。
// 答えなければ（launch を省く）、そのエクステンションは起動されない。
//   → 生成プラグインのエクステンションだけを起動し、ユーザーの ~/.copilot/extensions/ など、ほかのエクステンションを混ぜない。
// 起動したプロセスには、機微な環境変数（トークンなど）を渡さない（Copilot CLI が、エクステンションに渡す前に外すのと同じ考え方）。

import { fileURLToPath } from 'node:url';

const BOOTSTRAP = fileURLToPath(new URL('./extension-bootstrap.mjs', import.meta.url));
const SECRET_NAME = /(TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_?KEY|PRIVATE_?KEY)/i;

/** 環境変数から、文字の値だけを取り、機微な名前のものを除く */
export function safeEnv(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) if (typeof value === 'string' && !SECRET_NAME.test(key)) out[key] = value;
  return out;
}

/**
 * @param {object} args
 * @param {(request: { id: string, name: string, modulePath: string, source: string }) => boolean} args.accept 起動してよいエクステンションか
 * @param {string} [args.node] Node.js の実行ファイル（既定は今の Node.js）
 * @param {string} [args.bootstrap] 起動用のファイル
 * @param {object} [args.env] 子プロセスの環境のもと（機微なものは除く）
 * @param {(text: string) => void} [args.log]
 * @returns {{ resolve: (request: object) => Promise<{ launch?: object }>, launched: string[], skipped: string[] }}
 */
export function createExtensionLaunchProvider({ accept, node = process.execPath, bootstrap = BOOTSTRAP, env = process.env, log = () => {} }) {
  const launched = [];
  const skipped = [];
  return {
    launched,
    skipped,
    async resolve(request) {
      const id = request?.id ?? '';
      if (!request?.modulePath || !accept(request)) {
        skipped.push(id);
        log(`エクステンション ${id} は起動しません`);
        return {};
      }
      launched.push(id);
      return { launch: { executable: node, args: [bootstrap], env: { ...safeEnv(env), EXTENSION_PATH: request.modulePath } } };
    },
  };
}
