// 試験の道具：ESM の解決の拡張。@github/copilot-sdk/extension を、環境変数 TEST_SDK_EXTENSION の指すファイルにする。
import { pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@github/copilot-sdk/extension' && process.env.TEST_SDK_EXTENSION) {
    return { url: pathToFileURL(process.env.TEST_SDK_EXTENSION).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
