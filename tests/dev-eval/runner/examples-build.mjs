// 会話例の作成（testing.md 6.6、REQ-037）。外側の EVAL の記録（outer.mjs が書く records/ の JSON）から、
// 模擬ユーザーごとに 1 つ、Markdown の会話例を作る。会話例のために EVAL を足すことはしない。
//
// 選ぶ条件（点数の高さだけでは選ばない。ユーザー役が隠すべきことを漏らすと、点数が上がるため）
//   - クリエイター（with の腕）の会話で、生成まで進んだ（stopped が generated）
//   - 採点の観点（6.5）にすべて合格した（思考力の高いモデルのもの。Claude Haiku 5.5 の会話は使わない）
//   - ユーザー役の誤りがない（聞かれていないのに隠すべきナレッジを話した、自分への指示のことを話した）。6.3 の記録で機械的に除く。最後は全文を読んで確かめる
//   - 話し方は normal（既定。--style で変えられる）
//   - クリエイターの版が、今の plugin.json の版と同じ（版を上げるたびに、その版の会話から作り直す）
//   - 見ない模擬ユーザー（heldout）の会話は載せない（読めば、見ない模擬ユーザーではなくなるため）
// 冒頭に、AI が演じたユーザーとの会話であることと、クリエイターの版と日付を書く（冒頭 30 行に「クリエイターの版：x.y.z」。A3 の 1段目が突き合わせる）。
// 聞かれないと話さないナレッジを引き出した質問には印を付ける（6.3 の記録：ナレッジごとの聞いたか・答えたか）。
// 置き場所はクリエイターのスキルのフォルダの外（既定は examples/）。変換スクリプトが、置き換えた版から外す。
//
// 使い方（リポジトリの根から）:
//   node tests/dev-eval/runner/examples-build.mjs --records <records のフォルダ>… [--out examples] [--style normal] [--version x.y.z] [--clean] [--dry-run]
//   終了コード：0 作った（または --dry-run）、1 作れる会話がなかった、2 始められなかった。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadPersona } from '../personas/validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const PERSONAS_DIR = path.resolve(HERE, '..', 'personas');

/** 会話例のファイルに入れる印。--clean は、この印のあるファイルだけを消す（人が書いたファイルは消さない） */
export const GENERATED_MARK = '<!-- 会話例の作成のスクリプト（tests/dev-eval/runner/examples-build.mjs）が作ったファイル。直接直さず、外側の EVAL の記録から作り直す -->';
const EXAMPLE_HEAD_LINES = 30;

export class ExamplesError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ExamplesError';
    this.code = code;
  }
}

// ---- 記録の読み込み ------------------------------------------------------------------------------------------

/** フォルダ（またはファイル）の中の、外側の EVAL の記録（schema が outer-record/1 の JSON）を読む */
export function readRecords(inputs) {
  const records = [];
  const visit = (target) => {
    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      throw new ExamplesError('not_found', `記録が見つかりません：${target}`);
    }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name));
    } else if (target.endsWith('.json')) {
      try {
        const json = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (json?.schema === 'outer-record/1') records.push({ file: target, record: json });
      } catch {
        // JSON でないファイル（結果の要約など）は飛ばす
      }
    }
  };
  for (const input of inputs) visit(path.resolve(input));
  return records;
}

// ---- 選ぶ ---------------------------------------------------------------------------------------------------

/**
 * 会話例にできる会話を選ぶ。模擬ユーザーごとに、条件を満たす中で点数が最も高いもの（同点なら新しいもの）。
 * @returns {{ selected: Map<string, { file: string, record: object }>, skipped: Array<{ file: string, persona: string, reason: string }> }}
 */
export function selectRecords(items, { pluginVersion, style = 'normal' }) {
  const selected = new Map();
  const skipped = [];
  const skip = (item, reason) => skipped.push({ file: item.file, persona: item.record.persona?.id ?? '?', reason });
  for (const item of items) {
    const r = item.record;
    if (r.heldout || item.file.split(path.sep).includes('records-heldout')) { skip(item, '見ない模擬ユーザーの会話は載せない（6.6）'); continue; }
    if (r.arm !== 'with') { skip(item, `クリエイターの会話ではない（腕：${r.arm}）`); continue; }
    if (r.style !== style) { skip(item, `話し方が ${style} ではない（${r.style}）`); continue; }
    if (r.stopped?.reason !== 'generated') { skip(item, `生成まで進んでいない（${r.stopped?.reason ?? '不明'}）`); continue; }
    if (!r.grading?.exampleCandidate) {
      const why = !r.grading ? '採点がない' : r.grading.verdict?.failed?.length ? `採点の観点に不合格がある（${r.grading.verdict.failed.join('、')}）` : r.grading.faults?.length ? `ユーザー役の誤りがある（${r.grading.faults.map((f) => f.kind).join('、')}）` : 'Claude Haiku 5.5 の会話は使わない';
      skip(item, why);
      continue;
    }
    if (pluginVersion && r.creator?.version !== pluginVersion) { skip(item, `クリエイターの版が違う（記録 ${r.creator?.version ?? '不明'}、今 ${pluginVersion}）`); continue; }
    const id = r.persona.id;
    const current = selected.get(id);
    if (!current || r.grading.score > current.record.grading.score || (r.grading.score === current.record.grading.score && r.finishedAt > current.record.finishedAt)) selected.set(id, item);
  }
  return { selected, skipped };
}

// ---- 書く ---------------------------------------------------------------------------------------------------

const quote = (text) => String(text).split('\n').map((l) => (l === '' ? '>' : `> ${l}`)).join('\n');
const regexOf = (p) => new RegExp(p);
const listOf = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** 聞かれないと話さないナレッジを引き出した質問（その質問が asked に、答えが answered に当たる）を持つ答えの番号の集まり */
export function markedAnswers(record, persona) {
  const marked = new Set();
  if (!persona) return marked;
  const hidden = persona.knowledge.filter((k) => !k.volunteer && k.id !== 'first-run' && k.markers?.asked && k.markers?.answered);
  for (const item of record.items ?? []) {
    if (item.kind !== 'user.answer') continue;
    const hit = hidden.some((k) => listOf(k.markers.asked).some((p) => regexOf(p).test(`${item.header ?? ''} ${item.question}`)) && listOf(k.markers.answered).some((p) => regexOf(p).test(item.answer)));
    if (hit) marked.add(item.index);
  }
  return marked;
}

/** 会話例の Markdown */
export function renderExample({ record, persona, date, pluginVersion }) {
  const version = pluginVersion ?? record.creator?.version;
  if (!version) throw new ExamplesError('no_version', 'クリエイターの版が分かりません。');
  const marked = markedAnswers(record, persona);
  const lines = [
    `# 会話例：${record.persona.title}`,
    '',
    GENERATED_MARK,
    '',
    `クリエイターの版：${version}`,
    `会話を行った日：${date ?? record.startedAt?.slice(0, 10)}`,
    '',
    'この会話は、AI が演じたユーザーと plugin-creator の会話です。人と話すと、質問の数や順番が変わります。',
    '「聞かれたときだけ話す」ことにしてあるユーザーが、どんな質問で話し始めたかが分かるように、その質問の答えの前に印（★）を付けています。',
    '',
    '---',
    '',
  ];
  for (const c of record.conversation) {
    if (c.role === 'user') {
      if (c.via === 'request') {
        lines.push('**ユーザー（最初の依頼）**', '', quote(c.text), '');
      } else {
        if (marked.has(c.index)) lines.push('★ この質問で、聞かれないと話さない決まりが出ました。', '');
        lines.push('**ユーザー**', '', quote(c.text), '');
      }
    } else if (c.via === 'AskUserQuestion') {
      const options = (c.options ?? []).map((o) => `- ${o.label}${o.description ? `：${o.description}` : ''}`);
      lines.push('**クリエイター（選んで答える質問）**', '', quote([c.question, ...(options.length ? ['', ...options] : [])].join('\n')), '');
    } else {
      lines.push('**クリエイター**', '', quote(c.text), '');
    }
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** 会話例の冒頭 30 行に、クリエイターの版があるか（A3 の 1段目の見方と同じ） */
export function hasVersionInHead(markdown, version) {
  const head = markdown.split('\n').slice(0, EXAMPLE_HEAD_LINES).join('\n');
  const m = /クリエイターの版[：:]\s*`?v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/.exec(head);
  return m !== null && (version === undefined || m[1] === version);
}

/**
 * 記録から会話例を作って書く。
 * @param {object} o
 * @param {string[]} o.recordInputs 記録のフォルダ（またはファイル）
 * @param {string} o.outDir 会話例の置き場所
 * @param {string} o.pluginVersion 今の plugin.json の版
 * @param {(id: string) => Promise<object|null>} [o.loadPersonaById]
 */
export async function buildExamples({ recordInputs, outDir, pluginVersion, style = 'normal', clean = false, dryRun = false, loadPersonaById = defaultLoadPersona }) {
  const items = readRecords(recordInputs);
  if (items.length === 0) throw new ExamplesError('no_records', '外側の EVAL の記録（schema が outer-record/1 の JSON）が見つかりません。');
  const { selected, skipped } = selectRecords(items, { pluginVersion, style });
  const written = [];
  for (const [id, item] of selected) {
    const persona = await loadPersonaById(id);
    const markdown = renderExample({ record: item.record, persona, pluginVersion, date: item.record.startedAt?.slice(0, 10) });
    if (!hasVersionInHead(markdown, pluginVersion)) throw new ExamplesError('no_version', `会話例 ${id} の冒頭に、クリエイターの版が書かれていません。`);
    const file = path.join(outDir, `${id}.md`);
    if (!dryRun) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(file, markdown);
    }
    written.push({ persona: id, file, record: item.file, score: item.record.grading.score, marked: [...markedAnswers(item.record, persona)].length });
  }
  const removed = [];
  if (clean && !dryRun && fs.existsSync(outDir)) {
    for (const name of fs.readdirSync(outDir)) {
      const file = path.join(outDir, name);
      if (!name.endsWith('.md') || written.some((w) => w.file === file)) continue;
      if (fs.readFileSync(file, 'utf8').includes(GENERATED_MARK)) {
        fs.rmSync(file);
        removed.push(file);
      }
    }
  }
  return { written, skipped, removed, dryRun };
}

async function defaultLoadPersona(id) {
  try {
    return (await loadPersona(path.join(PERSONAS_DIR, id))).persona;
  } catch {
    return null;
  }
}

// ---- コマンド ---------------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const out = { records: [], style: 'normal', clean: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const need = () => {
      if (i + 1 >= argv.length) throw new ExamplesError('usage', `${flag} には値が要ります。`);
      i += 1;
      return argv[i];
    };
    if (flag === '--records') out.records.push(need());
    else if (flag === '--out') out.out = need();
    else if (flag === '--style') out.style = need();
    else if (flag === '--version') out.version = need();
    else if (flag === '--clean') out.clean = true;
    else if (flag === '--dry-run') out.dryRun = true;
    else throw new ExamplesError('usage', `知らない引数です：${flag}`);
  }
  if (out.records.length === 0) throw new ExamplesError('usage', '--records（外側の EVAL の記録のフォルダ）が要ります。');
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const pluginVersion = args.version ?? JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'plugin.json'), 'utf8')).version;
    const result = await buildExamples({ recordInputs: args.records, outDir: path.resolve(args.out ?? path.join(REPO_ROOT, 'examples')), pluginVersion, style: args.style, clean: args.clean, dryRun: args.dryRun });
    console.log(JSON.stringify({ ok: true, pluginVersion, ...result, note: '最後は、会話の全文を読んで、ユーザー役の誤り（ナレッジにない決まりを作った、など）がないことを確かめてください。作ったら、README の「置きます」を「あります」に直してください。' }, null, 2));
    return result.written.length > 0 || result.dryRun ? 0 : 1;
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: error.code ?? 'failed', message: error.message }));
    return 2;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main();
}
