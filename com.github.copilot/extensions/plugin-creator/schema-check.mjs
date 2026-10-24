// JSON Schema の確かめ（小さな部分だけ）。外部のパッケージを使わないため、作業の定義の決まり
// （ひな形の core/task.schema.json）に使われている書き方だけを扱う。
// 扱うもの：type、enum、const、required、properties、additionalProperties（false と schema）、items、
//   minItems、maxItems、uniqueItems、minLength、maxLength、minimum、maximum、pattern、allOf、anyOf、if/then/else。
// 知らない書き方は読み飛ばす（確かめが甘くなる方に倒れる。ひな形の 1段目は Python の jsonschema で確かめる）。
// 誤りの文は、画面とモデルに返す前提で、平易な日本語にする。

const typeName = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const TYPE_JA = {
  string: '文字',
  number: '数',
  integer: '整数',
  boolean: '真偽（true か false）',
  array: '一覧',
  object: 'まとまり（{ }）',
  null: 'null',
};

function matchesType(value, type) {
  switch (type) {
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return typeof value === type;
  }
}

const show = (value) => {
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json.length > 40 ? `${json.slice(0, 40)}…` : json;
};

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** value が schema に合うかを調べ、合わない点の文の一覧を返す（合えば空） */
export function checkSchema(value, schema, rootName = 'task.json') {
  const errors = [];

  const walk = (val, sch, where) => {
    if (sch === true || sch === undefined || sch === null || typeof sch !== 'object') return;
    if (sch === false) {
      errors.push(`${where}：ここには書けません`);
      return;
    }

    if (sch.type !== undefined) {
      const types = [].concat(sch.type);
      if (!types.some((t) => matchesType(val, t))) {
        errors.push(`${where}：${types.map((t) => TYPE_JA[t] ?? t).join('か')}で書いてください（今は${TYPE_JA[typeName(val)] ?? typeName(val)}）`);
        return; // 型が違えば、ほかの確かめは意味がない
      }
    }
    if (sch.const !== undefined && !deepEqual(val, sch.const)) errors.push(`${where}：${show(sch.const)} にしてください（今は ${show(val)}）`);
    if (sch.enum !== undefined && !sch.enum.some((e) => deepEqual(e, val))) {
      errors.push(`${where}：使える値は ${sch.enum.map(show).join('、')} です（今は ${show(val)}）`);
    }

    if (typeof val === 'string') {
      if (sch.minLength !== undefined && [...val].length < sch.minLength) errors.push(`${where}：空にできません`);
      if (sch.maxLength !== undefined && [...val].length > sch.maxLength) errors.push(`${where}：${sch.maxLength}文字までです`);
      if (sch.pattern !== undefined && !new RegExp(sch.pattern, 'u').test(val)) {
        errors.push(`${where}：書き方が決まりに合いません（${sch.pattern}。今は ${show(val)}）`);
      }
    }
    if (typeof val === 'number') {
      if (sch.minimum !== undefined && val < sch.minimum) errors.push(`${where}：${sch.minimum} 以上にしてください（今は ${val}）`);
      if (sch.maximum !== undefined && val > sch.maximum) errors.push(`${where}：${sch.maximum} 以下にしてください（今は ${val}）`);
    }

    if (Array.isArray(val)) {
      if (sch.minItems !== undefined && val.length < sch.minItems) errors.push(`${where}：${sch.minItems}個以上入れてください（今は${val.length}個）`);
      if (sch.maxItems !== undefined && val.length > sch.maxItems) errors.push(`${where}：${sch.maxItems}個までです（今は${val.length}個）`);
      if (sch.uniqueItems && new Set(val.map((v) => JSON.stringify(v))).size !== val.length) errors.push(`${where}：同じものが重なっています`);
      if (sch.items !== undefined) val.forEach((item, i) => walk(item, sch.items, `${where}[${i}]`));
    }

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      for (const name of sch.required ?? []) {
        if (!(name in val)) errors.push(`${where}：「${name}」がありません`);
      }
      const props = sch.properties ?? {};
      for (const [name, sub] of Object.entries(props)) {
        if (name in val) walk(val[name], sub, `${where}.${name}`);
      }
      if (sch.additionalProperties !== undefined) {
        for (const name of Object.keys(val)) {
          if (name in props) continue;
          if (sch.additionalProperties === false) errors.push(`${where}：決まりにない名前「${name}」があります`);
          else walk(val[name], sch.additionalProperties, `${where}.${name}`);
        }
      }
    }

    for (const sub of sch.allOf ?? []) walk(val, sub, where);
    if (sch.anyOf && !sch.anyOf.some((sub) => checkSchema(val, sub, where).length === 0)) {
      errors.push(`${where}：決まりのどれにも合いません`);
    }
    if (sch.if !== undefined) {
      const matched = checkSchema(val, sch.if, where).length === 0;
      if (matched && sch.then !== undefined) walk(val, sch.then, where);
      if (!matched && sch.else !== undefined) walk(val, sch.else, where);
    }
  };

  walk(value, schema, rootName);
  return errors;
}
