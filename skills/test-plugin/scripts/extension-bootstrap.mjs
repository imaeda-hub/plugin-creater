// エクステンションの子プロセスの入口（EVAL の仕組みが、ランタイムに「このコマンドで起動して」と教える。extension-launch.mjs）。
// Copilot CLI は自分でエクステンションを起動するが、Copilot SDK でセッションを作るときは、起動のしかたを SDK を使う側が決める。
// 環境変数：EXTENSION_PATH（エクステンションの入口のファイル）、COPILOT_SDK_PATH（SDK のフォルダ）、COPILOT_EXTENSION_PARENT_PID（ランタイムのプロセスの番号）。
import Module from 'node:module';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

// ランタイムがいなくなったら、このプロセスも終わる（エクステンションの中の画面のサーバーを、残さないため）
const parentPid = Number(process.env.COPILOT_EXTENSION_PARENT_PID);
if (Number.isSafeInteger(parentPid) && parentPid > 0) {
  const firstParent = process.ppid;
  setInterval(() => {
    try {
      if (process.ppid !== firstParent) process.exit(0);
      process.kill(parentPid, 0);
    } catch {
      process.exit(0);
    }
  }, 1000);
}

// ESM の `import "@github/copilot-sdk/extension"` を、SDK のフォルダに向ける
Module.register('./extension-sdk-resolver.mjs', import.meta.url);

// CommonJS の `require("@github/copilot-sdk")` も向ける
const sdkPath = process.env.COPILOT_SDK_PATH;
if (sdkPath) {
  const original = Module._resolveFilename;
  Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
    if (request === '@github/copilot-sdk') return resolvePath(sdkPath, 'index.js');
    if (request === '@github/copilot-sdk/extension') return resolvePath(sdkPath, 'extension.js');
    return original.call(this, request, parent, isMain, options);
  };
}

const extensionPath = process.env.EXTENSION_PATH;
if (!extensionPath) {
  console.error('[extension-bootstrap] EXTENSION_PATH がありません');
  process.exit(1);
}
try {
  await import(pathToFileURL(extensionPath).href);
} catch (error) {
  console.error(`[extension-bootstrap] エクステンションを読み込めませんでした：${error?.stack ?? error}`);
  process.exit(1);
}
