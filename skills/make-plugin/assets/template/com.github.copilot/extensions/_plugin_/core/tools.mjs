// 記録のツールの定義（6.2）。つなぎ口は、これを登録するだけにする。
// name は名前の後ろの部分。登録する名前は toolFullName() で作る（例：weekly-report_plan）。
// description は仮の文。モデルの振る舞いを決める自然言語の部品なので、別の担当が仕上げる（BLUEPRINT 6章）。
// 記録のツールは、画面の状態を書くだけで外を変えないので、許可の確認を省いて登録する（4.14）。

const integerSchema = { type: 'integer', minimum: 1 };

export const TOOL_DEFS = Object.freeze([
  {
    name: 'open',
    caller: 'main',
    skipPermission: true,
    description:
      '【仮】ユーザーから作業を頼まれたときに呼ぶ。Web管理画面を開き、その URL を返す。実行中なら、新しく始めず今の URL を返す。',
    parameters: {
      type: 'object',
      properties: {
        requestText: { type: 'string', description: 'ユーザーが頼んだ作業の文。ユーザーの言葉のまま渡す。' },
      },
      required: ['requestText'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan',
    caller: 'orchestrator',
    skipPermission: true,
    description:
      '【仮】統括エージェントが、試行ごとの計画を記録する。評価基準には、ユーザーと確かめた基準を番号と文のまま、すべて入れる。',
    parameters: {
      type: 'object',
      properties: {
        iteration: { ...integerSchema, description: '試行の番号。1 から始め、前の試行の次の番号にする。' },
        criteria: {
          type: 'array',
          minItems: 1,
          description: '評価基準の一覧。ユーザーと確かめた基準は番号と文を変えずに入れる。足した基準は入れてよい。',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '基準の番号（例：C-01）' },
              text: { type: 'string', description: '基準の文' },
            },
            required: ['id', 'text'],
            additionalProperties: false,
          },
        },
        plan: { type: 'string', minLength: 1, description: 'この試行の計画。2回目からは、前の試行の指摘への対応を入れる。' },
      },
      required: ['iteration', 'criteria', 'plan'],
      additionalProperties: false,
    },
  },
  {
    name: 'verdict',
    caller: 'verifier',
    skipPermission: true,
    description:
      '【仮】検証エージェントが、評価基準ごとの合否と指摘を記録する。その試行の評価基準のすべてについて記録する。',
    parameters: {
      type: 'object',
      properties: {
        iteration: { ...integerSchema, description: '合否を記録する試行の番号。' },
        verdicts: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              criterionId: { type: 'string', description: '評価基準の番号' },
              pass: { type: 'boolean', description: '合格なら true' },
              note: { type: 'string', description: '指摘。不合格のときは、直す点を書く。' },
            },
            required: ['criterionId', 'pass'],
            additionalProperties: false,
          },
        },
      },
      required: ['iteration', 'verdicts'],
      additionalProperties: false,
    },
  },
  {
    name: 'show',
    caller: 'orchestrator,worker',
    skipPermission: true,
    description:
      '【仮】作業ごとの画面の表示に、値を送る。key は作業の定義にある表示の番号。画像とファイルは、作業フォルダの中の場所を渡す。',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: '表示の番号（作業の定義の displays の key）' },
        value: {
          description:
            '表示の種類に合う値。text は文字列、kv は { 見出し: 値 }、table は { columns: [見出し], rows: [[値]] }、progress は { value, max, label? }、image と file は場所の文字列。',
        },
      },
      required: ['key', 'value'],
      additionalProperties: false,
    },
  },
  {
    name: 'review',
    caller: 'orchestrator',
    skipPermission: true,
    description:
      '【仮】繰り返しが終わった後に、統括エージェントが呼ぶ。機械的に洗い出した課題と、記録の要点を返す。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'issue',
    caller: 'orchestrator',
    skipPermission: true,
    description:
      '【仮】振り返りで見つけた、このプラグイン自身を改善する Issue の案（題と本文）を足す。起票はユーザーが画面で承認したときだけ行われる。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, description: 'Issue の題' },
        body: { type: 'string', minLength: 1, description: 'Issue の本文' },
      },
      required: ['title', 'body'],
      additionalProperties: false,
    },
  },
  {
    name: 'finish',
    caller: 'orchestrator',
    skipPermission: true,
    description: '【仮】実行全体のまとめを記録する。最後に 1 回だけ呼ぶ。',
    parameters: {
      type: 'object',
      properties: { summary: { type: 'string', minLength: 1, description: '実行全体のまとめ' } },
      required: ['summary'],
      additionalProperties: false,
    },
  },
]);

export const RECORD_TOOL_NAMES = Object.freeze(TOOL_DEFS.map((t) => t.name));

export function toolFullName(pluginName, shortName) {
  return `${pluginName}_${shortName}`;
}

// 登録する名前から、名前の後ろの部分を取り出す。合わなければ null。
export function toolShortName(pluginName, fullName) {
  const prefix = `${pluginName}_`;
  if (typeof fullName !== 'string' || !fullName.startsWith(prefix)) return null;
  const short = fullName.slice(prefix.length);
  return RECORD_TOOL_NAMES.includes(short) ? short : null;
}

// つなぎ口が登録する形（名前に生成プラグインの名前を付けたもの）
export function buildToolDefinitions(pluginName) {
  return TOOL_DEFS.map((t) => ({
    name: toolFullName(pluginName, t.name),
    shortName: t.name,
    description: t.description,
    parameters: t.parameters,
    skipPermission: t.skipPermission,
  }));
}
