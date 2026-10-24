// 課題の「作業の画面に入れる設定の値」（evalTasks[].settings.task）が、作業の定義の案（draft/task.json）の設定（画面の欄）に合うかの確かめ（X4-04）。
// 名前が違うまま確認に進むと、生成の後の1段目で初めて落ち、直すとユーザーが確かめた値と違うものになるため、確認のときに断る。
//
// 1段目（template/tests/stage1/check_structure.py の settings_problems）と同じ決まりを、重ねて持つ：
//   - 値の名前（key）が、案の設定にある
//   - 値の型が、案の設定の種類に合う（text・path は文字、number は数、checkbox は true か false、select は選択肢のどれか）
//   - 必須で、初めの値がなく、種類が checkbox でない設定には、値がある
// ずれは tests/creator/extension/eval-settings.test.mjs が見張る（同じ場合分けを Python の関数にも渡して、誤りの数を比べる）。
// 返す文は、モデルが読む。words.md の表の言葉で書く。

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isBlank = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const show = (value) => {
  const text = typeof value === 'string' ? `「${value}」` : String(value);
  return text.length <= 60 ? text : `${text.slice(0, 59)}…`;
};

/** 案の設定の一覧から、名前（key）→ 設定の定義。key が文字でないものは無い扱い */
function definitions(settings) {
  const defs = new Map();
  for (const def of Array.isArray(settings) ? settings : []) {
    if (isObject(def) && typeof def.key === 'string') defs.set(def.key, def);
  }
  return defs;
}

/**
 * 課題1つの、作業ごとの設定の値を、案の設定と突き合わせる。
 * @param {unknown} settings 作業の定義の案の settings（画面の欄の一覧）
 * @param {Record<string, string|number|boolean>} given 課題の settings.task
 * @param {string} label 文の頭につける課題の呼び名
 * @returns {string[]} 合わない点の文。合えば空
 */
export function evalSettingsProblems(settings, given, label) {
  const defs = definitions(settings);
  const out = [];
  for (const [key, value] of Object.entries(given)) {
    const def = defs.get(key);
    if (def === undefined) {
      const names = [...defs.keys()].join('、') || '（なし）';
      out.push(`${label}の作業ごとの設定「${key}」が、画面と合格の条件の設定の案の設定にありません（案にある設定の名前：${names}）。`);
      continue;
    }
    const kind = def.type;
    const options = Array.isArray(def.options) ? def.options.map((o) => (isObject(o) ? o.value : o)) : [];
    if ((kind === 'text' || kind === 'path') && typeof value !== 'string') {
      out.push(`${label}の作業ごとの設定「${key}」の値は、文字で渡してください。`);
    } else if (kind === 'number' && !isNumber(value)) {
      out.push(`${label}の作業ごとの設定「${key}」の値は、数で渡してください。`);
    } else if (kind === 'checkbox' && typeof value !== 'boolean') {
      out.push(`${label}の作業ごとの設定「${key}」の値は、true か false で渡してください。`);
    } else if (kind === 'select' && !options.includes(value)) {
      out.push(`${label}の作業ごとの設定「${key}」の値 ${show(value)} が、案の選択肢（${options.join('、')}）にありません。`);
    }
  }
  // 必須で、初めの値がない設定は、課題が値を入れないと、画面で開始できない
  for (const [key, def] of defs) {
    if (def.required && def.type !== 'checkbox' && isBlank(def.default) && isBlank(given[key])) {
      out.push(`${label}の作業ごとの設定に、必須の設定「${def.label ?? key}」（${key}）の値がありません（案に初めの値がないので、画面で開始できません）。`);
    }
  }
  return out;
}

/** 案の設定の、名前（key）→ 画面の見出し（label）。画面に出すとき、見出しを引く */
export function settingLabels(settings) {
  const labels = {};
  for (const [key, def] of definitions(settings)) {
    if (typeof def.label === 'string' && def.label.trim() !== '') labels[key] = def.label;
  }
  return labels;
}
