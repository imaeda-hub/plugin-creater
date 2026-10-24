// モデルの名前の対応（testing.md 4章）。Copilot のモデルの名前 → Claude Code の ID。
// 表は変換スクリプト（tests/dev-eval/convert.py の MODEL_MAP）が1か所だけ持ち、置き換えた版の
// .eval/conversion-report.json の model_map に出る。EVAL の仕組みは、ここから読む（表を二重に持たない）。
//   画面で選ぶモデルは Copilot の名前（例：gpt-6-luna）で出るので、Agent SDK に渡す前に、この表で ID にする。

import fs from 'node:fs';
import path from 'node:path';

/** 変換レポートの場所（置き換えた版の中） */
export function reportPathOf(convertedRoot) {
  return path.join(convertedRoot, '.eval', 'conversion-report.json');
}

/** 変換レポートを読む。なければ（変換していない）、平易な日本語の Error */
export function readConversionReport(convertedRoot) {
  const file = reportPathOf(convertedRoot);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      error?.code === 'ENOENT'
        ? `変換レポートがありません（${file}）。convert.py で置き換えた版を渡してください。`
        : `変換レポートを読めません（${file}）：${error.message}`,
    );
  }
}

/** 変換レポートから、モデルの対応の表（{ Copilot の名前: Claude Code の ID }）を取り出す */
export function modelMapOf(report) {
  const map = report?.model_map;
  if (map === null || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length === 0) {
    throw new Error('変換レポートに model_map（モデルの対応の表）がありません。');
  }
  return map;
}

/** Copilot の名前 → Claude Code の ID。表にない名前は Error（黙って別のモデルにしない）。ID がそのまま渡されたら、そのまま返す */
export function toClaudeModelId(map, name) {
  if (typeof name !== 'string' || name === '') throw new Error('モデルの名前が空です。');
  if (Object.hasOwn(map, name)) return map[name];
  if (Object.values(map).includes(name)) return name;
  throw new Error(`モデル「${name}」は、対応の表にありません（選べるのは ${Object.keys(map).join('、')}）。`);
}

/** Claude Code の ID → Copilot の名前。同じ ID の名前が複数あるときは、claude- で始まるものを先にする。なければ null */
export function toCopilotName(map, id) {
  const names = Object.keys(map).filter((name) => map[name] === id);
  return names.find((name) => name.startsWith('claude-')) ?? names[0] ?? null;
}

/** 画面の選択肢（core の port.listModels の返り値）。表の Copilot の名前を、そのまま ID と名前にする */
export function copilotModelList(map) {
  return Object.keys(map).map((id) => ({ id, name: id }));
}
