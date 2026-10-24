// エクステンションの子プロセスで、`@github/copilot-sdk` と `@github/copilot-sdk/extension` の読み込みを、
// 道具のフォルダの SDK（環境変数 COPILOT_SDK_PATH＝ランタイムがセッションの extensionSdkPath から渡す場所）に向ける
// Node.js の読み込みの仕組み（ESM の resolve フック）。extension-bootstrap.mjs が登録する。
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const sdkPath = process.env.COPILOT_SDK_PATH;

export async function resolve(specifier, context, nextResolve) {
  if (sdkPath && specifier === '@github/copilot-sdk') return { url: pathToFileURL(resolvePath(sdkPath, 'index.js')).href, shortCircuit: true };
  if (sdkPath && specifier === '@github/copilot-sdk/extension') return { url: pathToFileURL(resolvePath(sdkPath, 'extension.js')).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
