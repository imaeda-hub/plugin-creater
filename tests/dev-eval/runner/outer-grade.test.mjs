// 外側の EVAL の採点（outer-grade.mjs）の試験。会話の記録は、試験の中で組み立てる。実際のモデルは使わない。
// 動かし方（リポジトリの根で）：node --test "tests/dev-eval/runner/*.test.mjs"

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadPersona } from '../personas/validate.mjs';
import {
  HAIKU_REQUIRED,
  collectGeneratedFiles,
  gradeAllItemsHeard,
  gradeFirstRun,
  gradeHurryOptions,
  gradeNoGenerationBeforeApproval,
  gradeOuter,
  knowledgeTrace,
  normalizeQuote,
  quoteFound,
  scopes,
  sha256OfBuffer,
} from './outer-grade.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS = path.join(here, '..', 'personas');
const weekly = await loadPersona(path.join(PERSONAS, 'weekly-report'), { allStyles: true });
const training = await loadPersona(path.join(PERSONAS, 'training-survey'));

const ITEM_NAMES = ['作業の目的', '頼む場面と言い方', '受け取るもの', '進め方', '成果物', '合否の決め方', '決まった書き方やルール', '守らないと困ること', '使う道具と環境', 'いつもと違うとき', '前回の1回', '資産', '標準機能と公開のプラグイン', '開始前に設定したいこと', '実行中に見たいこと', '終わった後に見たい結果と見せ方'];
const ITEM_KEYS = ['purpose', 'trigger', 'input', 'procedure', 'output', 'criteria', 'rules', 'must_not_break', 'tools', 'exceptions', 'last_case', 'assets', 'oss', 'settings', 'running_view', 'result_view'];

/** 会話の記録を組み立てる道具 */
function script() {
  let seq = 0;
  let index = 0;
  let callId = 0;
  const items = [];
  const toolEvents = [];
  return {
    items,
    toolEvents,
    question(question, { header = '', options = [] } = {}) {
      items.push({ seq: (seq += 1), kind: 'creator.question', header, question, options, multiSelect: false });
    },
    answer(question, answer, { via = 'AskUserQuestion', signal = false, header = '' } = {}) {
      items.push({ seq: (seq += 1), kind: 'user.answer', index: index++, via, question, header, choices: [], answer, signal });
    },
    use(name, input) {
      items.push({ seq: (seq += 1), kind: 'tool.use', owner: 'main', id: `t${seq}`, name, input });
    },
    progress(args, { isError = false } = {}) {
      callId += 1;
      toolEvents.push({ seq: (seq += 1), type: 'tool.call', callId, tool: 'progress', args });
      toolEvents.push({ seq: (seq += 1), type: 'tool.result', callId, tool: 'progress', isError, result: isError ? '断った' : '記録しました' });
    },
  };
}

const allItemsState = (overrides = {}) => ({ stage: 'confirm', rebuild: false, items: Object.fromEntries(ITEM_KEYS.map((k) => [k, { status: 'asked' }])), ...overrides });

const file = (rel, text, extra = {}) => ({ rel, size: text?.length ?? 0, sha256: sha256OfBuffer(Buffer.from(text ?? '')), text, ...extra });

test('REQ-015 抜き書きの比べ方：空白と句読点の違いを無視し、「…」で区切った断片はすべて同じ答えの中にあればよい', () => {
  assert.equal(normalizeQuote(' 「見出し は、 2つ」。'), '見出しは2つ');
  assert.ok(quoteFound('見出しは2つだけ', ['はい、見出しは 2つだけ です']));
  assert.ok(quoteFound('見出し…2つだけ', ['見出しは、まあ、2つだけです']));
  assert.ok(!quoteFound('見出し…3つだけ', ['見出しは2つだけです']));
  assert.ok(!quoteFound('', ['何か']));
  assert.ok(!quoteFound('金曜の17時', ['月曜です', '火曜です']));
});

test('REQ-015 全項目をヒアリングしたか：すべての項目に、それより前の答えの中の抜き書きがあれば合格', () => {
  const s = script();
  s.answer('進め方を教えてください。', '毎週月曜に売上データを集計して週報にします', { via: 'text' });
  s.progress({ items: ITEM_NAMES.map((item) => ({ item, status: '聞いた', quote: '毎週月曜に売上データを集計' })) });
  const r = gradeAllItemsHeard({ state: allItemsState(), items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, true, r.detail);
});

test('REQ-015 全項目をヒアリングしたか：答えの中にない抜き書きがあれば不合格（モデルが作った抜き書き）', () => {
  const s = script();
  s.answer('進め方を教えてください。', '毎週月曜に集計します', { via: 'text' });
  s.progress({ items: [{ item: '進め方', status: '聞いた', quote: '毎週月曜に集計' }, { item: '成果物', status: '聞いた', quote: 'ユーザーが言っていない言葉' }] });
  const r = gradeAllItemsHeard({ state: allItemsState(), items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, false);
  assert.match(r.detail, /項目「成果物」の抜き書き/);
});

test('REQ-015 全項目をヒアリングしたか：抜き書きの後に出た答えは、その抜き書きの証拠にならない', () => {
  const s = script();
  s.progress({ items: [{ item: '進め方', status: '聞いた', quote: '毎週月曜に集計' }] });
  s.answer('進め方は？', '毎週月曜に集計します', { via: 'text' });
  const r = gradeAllItemsHeard({ state: allItemsState(), items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, false);
});

test('REQ-015 全項目をヒアリングしたか：未着手の項目が残っていれば不合格。断られた呼び出しは数えない', () => {
  const s = script();
  s.answer('q', '成果物は weekly_report.md です', { via: 'text' });
  s.progress({ items: [{ item: '成果物', status: '聞いた', quote: 'weekly_report.md' }] });
  const state = allItemsState();
  state.items.input = { status: 'todo' };
  const r = gradeAllItemsHeard({ state, items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, false);
  assert.match(r.detail, /未着手の項目が残っている：受け取るもの/);
  // 断られた呼び出しの抜き書きは見ない
  const s2 = script();
  s2.progress({ items: [{ item: '成果物', status: '聞いた', quote: 'でたらめ' }] }, { isError: true });
  assert.equal(gradeAllItemsHeard({ state: allItemsState(), items: s2.items, toolEvents: s2.toolEvents }).ok, true);
  assert.equal(gradeAllItemsHeard({ state: null, items: [], toolEvents: [] }).ok, false);
});

test('REQ-015 作り直しのときだけ、項目「できていたことの確認」も未着手であってはならない', () => {
  const state = allItemsState({ rebuild: true });
  const r = gradeAllItemsHeard({ state, items: [], toolEvents: [] });
  assert.equal(r.ok, false);
  assert.match(r.detail, /できていたことの確認/);
});

test('REQ-020 承認の前に生成しなかったか：承認の抜き書きが直前の答えにあり、それより前の書き込みが作業の定義の案だけなら合格', () => {
  const s = script();
  s.use('Write', { file_path: '/w/.plugin-creator-work/draft/task.json', content: '{}' });
  s.question('この内容で作ってよいですか？', { options: [{ label: '作る' }, { label: '直す' }] });
  s.answer('この内容で作ってよいですか？', '作ってください、お願いします');
  s.progress({ stage: '生成', approvalQuote: '作ってください' });
  s.use('Bash', { command: 'python3 -I skills/make-plugin/scripts/scaffold.py build --hearing s.json --work w --out o' });
  const r = gradeNoGenerationBeforeApproval({ items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.approved, true);
});

test('REQ-020 承認の前に生成しなかったか：承認の前に組み立てのスクリプトが動いたら不合格', () => {
  const s = script();
  s.use('Bash', { command: 'python3 -I /x/scaffold.py build --out o' });
  s.answer('作ってよいですか？', '作ってください');
  s.progress({ stage: '生成', approvalQuote: '作ってください' });
  const r = gradeNoGenerationBeforeApproval({ items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, false);
  assert.match(r.detail, /承認の前に組み立てのスクリプトが動いた/);
});

test('REQ-020 承認の前に生成しなかったか：承認の前に、作業の定義の案のほかのファイルが書かれたら不合格（サブエージェントを含む）', () => {
  const s = script();
  s.use('Write', { file_path: '/w/plugin.json', content: '{}' });
  s.answer('作ってよいですか？', '作ってください');
  s.progress({ stage: '生成', approvalQuote: '作ってください' });
  const r = gradeNoGenerationBeforeApproval({ items: s.items, toolEvents: s.toolEvents });
  assert.equal(r.ok, false);
  assert.match(r.detail, /作業の定義の案のほかのファイルが書かれた：\/w\/plugin\.json/);
});

test('REQ-020 承認の前に生成しなかったか：承認の抜き書きが、直前の質問のツールへの答えの中になければ不合格', () => {
  const s = script();
  s.answer('作ってよいですか？', 'ちょっと待ってください、直したい所があります');
  s.progress({ stage: '生成', approvalQuote: '作ってください' });
  assert.equal(gradeNoGenerationBeforeApproval({ items: s.items, toolEvents: s.toolEvents }).ok, false);
  // 文章の返事は「質問のツールへの答え」ではない
  const t = script();
  t.answer('作ってよいですか？', '作ってください', { via: 'text' });
  t.progress({ stage: '生成', approvalQuote: '作ってください' });
  assert.equal(gradeNoGenerationBeforeApproval({ items: t.items, toolEvents: t.toolEvents }).ok, false);
});

test('REQ-020 承認の記録がなくて、組み立てのスクリプトが動いたら不合格。何も生成していなければ合格', () => {
  const s = script();
  assert.equal(gradeNoGenerationBeforeApproval({ items: s.items, toolEvents: s.toolEvents }).ok, true);
  s.use('Bash', { command: 'python3 scaffold.py build --out o' });
  assert.equal(gradeNoGenerationBeforeApproval({ items: s.items, toolEvents: s.toolEvents }).ok, false);
});

test('REQ-015 急ぐ合図の後に、残りの項目と 3 つの進め方の問いがあるか', () => {
  const three = [{ label: 'このまま続ける' }, { label: '残りを手早く聞く' }, { label: 'ここでやめて後で続ける' }];
  const s = script();
  s.answer('q1', '短い答え。早くしてください', { signal: true });
  s.question('まだ聞いていないことが残り5件あります。どう進めますか？', { options: three });
  assert.equal(gradeHurryOptions({ items: s.items, userSignals: [{ answerIndex: 0 }] }).ok, true);

  // 合図の前の問いは数えない
  const before = script();
  before.question('残りがあります。どう進めますか？', { options: three });
  before.answer('q', '急いでいます', { signal: true });
  assert.equal(gradeHurryOptions({ items: before.items, userSignals: [{ answerIndex: 0 }] }).ok, false);

  // 進め方が欠けている
  const lacking = script();
  lacking.answer('q', '急いでいます', { signal: true });
  lacking.question('残りがあります。続けますか？', { options: [{ label: 'はい' }, { label: 'いいえ' }] });
  assert.equal(gradeHurryOptions({ items: lacking.items, userSignals: [{ answerIndex: 0 }] }).ok, false);

  // 合図を出していなければ、この観点はない
  assert.equal(gradeHurryOptions({ items: s.items, userSignals: [] }), null);
});

test('REQ-016 まだやったことのない作業：「初めてやるとしたら」の問いの後に、前回の 1 回（想定の 1 回）を記録していれば合格', () => {
  const s = script();
  s.answer('この作業を初めてやるとしたら、最初に何をしますか？', 'survey.csv を開いて平均を出します');
  s.progress({ items: [{ item: '前回の1回', status: '聞いた', quote: 'survey.csv を開いて' }] });
  const ok = gradeFirstRun({ persona: training.persona, exchanges: s.items.filter((i) => i.kind === 'user.answer'), toolEvents: s.toolEvents });
  assert.equal(ok.ok, true, ok.detail);

  const none = script();
  none.answer('成果物は？', 'survey_summary.md です');
  assert.equal(gradeFirstRun({ persona: training.persona, exchanges: none.items.filter((i) => i.kind === 'user.answer'), toolEvents: none.toolEvents }).ok, false);

  const noWalk = script();
  noWalk.answer('この作業を初めてやるとしたら、最初に何をしますか？', 'まず CSV を見ます');
  assert.equal(gradeFirstRun({ persona: training.persona, exchanges: noWalk.items.filter((i) => i.kind === 'user.answer'), toolEvents: noWalk.toolEvents }).ok, false);
});

test('REQ-015 ナレッジごとの記録：聞いた・答えた・組み込まれた・聞かれずに話した・漏れた', () => {
  const { persona } = weekly;
  const s = script();
  s.answer('成果物はどんなファイルですか？', '成果物は weekly_report.md です');
  s.answer('テンプレートや見出しの決まりはありますか？', '見出しは「■今週の売上」と「■来週の予定」の2つです');
  // 「以上」は、聞かれずに話した（ユーザー役の誤り）
  s.answer('守らないと困ることはありますか？', '最後の行は必ず「以上」にします');
  const exchanges = s.items.filter((i) => i.kind === 'user.answer');
  const generated = [
    file('skills/w/SKILL.md', '成果物は weekly_report.md。見出しは ■今週の売上 と ■来週の予定。'),
    file('tests/knowledge.json', '["最後の行は「以上」"]'),
    file('docs/x.md', '題名の日付は 10/5〜10/9 の形で書く'),
  ];
  const scope = scopes(generated, []);
  const trace = knowledgeTrace({ persona, exchanges, scope });
  const by = Object.fromEntries(trace.map((t) => [t.id, t]));
  assert.deepEqual([by.output.asked, by.output.answered, by.output.embedded, by.output.verdict], [true, true, true, 'ok']);
  assert.deepEqual([by.headings.asked, by.headings.answered, by.headings.embedded, by.headings.verdict], [true, true, true, 'ok']);
  // 「以上」：聞かれていない質問に話した。一覧にしかないので、組み込みの証拠にならない
  assert.equal(by.ijou.unprompted, true);
  assert.equal(by.ijou.leaked, true);
  assert.equal(by.ijou.embedded, false);
  assert.equal(by.ijou.verdict, 'not-written');
  // たまたまの書き方が決まりとして入った
  assert.equal(by['title-date'].excludedHit, true);
  assert.equal(by['title-date'].verdict, 'wrongly-embedded');
  // 聞かれても答えてもいない
  assert.equal(by['man-yen'].asked, false);
  assert.equal(by['man-yen'].verdict, 'not-asked');
});

test('REQ-017 たまたまの書き方が入っていない：入っていなければ ok。入力の写しにある手がかりの文字は、組み込みに数えない', () => {
  const { persona } = weekly;
  const inputCopy = file('tests/eval/T-01/inputs/先週の売上.csv', '10/5〜10/9 の売上', { text: '10/5〜10/9 の売上' });
  const hashed = [{ role: 'input', place: '資料/先週の売上.csv', sha256: inputCopy.sha256 }];
  const scope = scopes([file('skills/w/SKILL.md', '見出しは2つ'), inputCopy], hashed);
  const trace = knowledgeTrace({ persona, exchanges: [], scope });
  assert.equal(trace.find((t) => t.id === 'title-date').excludedHit, false);
  assert.equal(trace.find((t) => t.id === 'title-date').verdict, 'ok');
});

test('REQ-038 見る範囲：課題と基準のファイルは、tests/eval の eval.json と task.json。knowledge.json は組み込みの範囲に入れない', () => {
  const files = [
    file('tests/eval/T-01/eval.json', '{"criteria":[{"text":"■今週の売上"}]}'),
    file('tests/eval/T-01/inputs/a.txt', '■今週の売上'),
    file('com.github.copilot/extensions/w/task.json', '{"criteria":[{"text":"weekly_report.md"}]}'),
    file('tests/knowledge.json', '["万円"]'),
    file('README.md', '説明'),
    { rel: 'x.bin', size: 3, sha256: 'z', text: null },
  ];
  const s = scopes(files, []);
  assert.match(s.task, /■今週の売上/);
  assert.match(s.task, /weekly_report\.md/);
  assert.ok(!s.embedded.includes('万円'));
  assert.ok(s.excluded.includes('万円'));
  assert.ok(!s.embedded.includes('weekly_report.md') || files.some((f) => f.rel === 'com.github.copilot/extensions/w/task.json'), '課題と基準のファイルの文字は、組み込みの範囲にも入る（knowledge.json だけが外れる）');
});

test('REQ-039 生成プラグインのファイルを読む：.git・tests/results・node_modules は読まない。バイナリは文字なし', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-files-'));
  const put = (rel, content) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  };
  put('plugin.json', '{"name":"x"}');
  put('skills/x/SKILL.md', '本文');
  put('.git/config', 'git');
  put('tests/results/latest.json', '{}');
  put('tests/node_modules/playwright/index.js', 'x');
  put('docs/a.docx', Buffer.from([0x50, 0x4b, 0x00, 0x01]));
  const files = collectGeneratedFiles(dir);
  const rels = files.map((f) => f.rel).sort();
  assert.deepEqual(rels, ['docs/a.docx', 'plugin.json', 'skills/x/SKILL.md']);
  assert.equal(files.find((f) => f.rel === 'docs/a.docx').text, null);
  assert.equal(files.find((f) => f.rel === 'plugin.json').text, '{"name":"x"}');
  fs.rmSync(dir, { recursive: true, force: true });
});

/** 全部の観点に合格する会話と生成物 */
function passingRun() {
  const s = script();
  s.use('Write', { file_path: '/w/.plugin-creator-work/draft/task.json', content: '{}' });
  s.answer('成果物は？ ファイルの名前を教えてください', '成果物は weekly_report.md です', { via: 'text' });
  s.progress({ items: ITEM_NAMES.map((item) => ({ item, status: '聞いた', quote: 'weekly_report.md' })) });
  s.answer('この内容で作ってよいですか？', '作ってください');
  s.progress({ stage: '生成', approvalQuote: '作ってください' });
  s.use('Bash', { command: 'python3 -I scaffold.py build --out o' });
  return s;
}

const goodFiles = () => [
  file('skills/w/SKILL.md', 'weekly_report.md を作る。■今週の売上 と ■来週の予定。最後の行は 「以上」。万円で書き、切り捨て、1万円未満と書く。'),
  file('tests/eval/T-01/eval.json', 'weekly_report.md ■今週の売上 ■来週の予定 「以上」 万円 1万円未満'),
  file('tests/eval/T-01/inputs/先週の売上.csv', 'date,rep,amount', { text: 'date,rep,amount' }),
];

test('REQ-015 全体の採点：すべての観点に合格する会話と生成物なら、思考力の高いモデルでも Haiku でも合格', () => {
  const s = passingRun();
  const files = goodFiles();
  const personaFiles = weekly.files.map((f) => ({ src: f.src, place: f.place, role: f.role }));
  // 入力のファイルの写しは、元のファイルと同じ中身にする
  const inputSrc = weekly.files.find((f) => f.role === 'input').src;
  files[2] = file('tests/eval/T-01/inputs/先週の売上.csv', fs.readFileSync(inputSrc, 'utf8'));
  // 聞かれずに話すナレッジは、この会話では出ない。ここでは markers を絞った模擬ユーザーで見る
  const persona = JSON.parse(JSON.stringify(weekly.persona));
  persona.knowledge = persona.knowledge.filter((k) => k.id === 'output');
  const r = gradeOuter({ persona, personaFiles, items: s.items, toolEvents: s.toolEvents, state: allItemsState({ stage: 'generate' }), generatedCount: 1, generatedFiles: files, stages: { stage1: { ok: true }, stage2: { ok: true } }, inner: { withScore: 1 }, userSignals: [], model: 'claude-opus-5-5' });
  const failed = r.grades.filter((g) => !g.ok);
  assert.deepEqual(failed.map((g) => g.id), [], JSON.stringify(failed));
  assert.equal(r.verdict.ok, true);
  assert.equal(r.score, 1);
  assert.equal(r.exampleCandidate, true);
  assert.ok(r.grades.some((g) => g.id === 'input-files-in-repo' && g.ok));
  assert.ok(r.grades.some((g) => g.id === 'inner-deliverable' && g.ok));
  const h = gradeOuter({ persona, personaFiles, items: s.items, toolEvents: s.toolEvents, state: allItemsState({ stage: 'generate' }), generatedCount: 1, generatedFiles: files, stages: null, inner: null, userSignals: [], model: 'claude-haiku-5-5' });
  assert.deepEqual(h.verdict.required, HAIKU_REQUIRED);
  assert.equal(h.verdict.ok, true, '1・2段目を動かしていなくても、Haiku は 2 点だけを見る');
  assert.equal(h.exampleCandidate, false, 'Haiku の会話は会話例にしない');
});

test('REQ-015 全体の採点：聞かれないと話すナレッジが組み込まれていなければ不合格（クリエイターが聞かなかったとき）', () => {
  const s = passingRun();
  const personaFiles = weekly.files.map((f) => ({ src: f.src, place: f.place, role: f.role }));
  const r = gradeOuter({ persona: weekly.persona, personaFiles, items: s.items, toolEvents: s.toolEvents, state: allItemsState({ stage: 'generate' }), generatedCount: 1, generatedFiles: goodFiles(), stages: { stage1: { ok: true }, stage2: { ok: true } }, inner: null, userSignals: [], model: 'claude-opus-5-5' });
  // ijou・headings は、会話に出ていないが、生成プラグインの本文にはある（偶然）。落ちるのは、入力のファイルがないことと、man-yen の例外など
  const trace = Object.fromEntries(r.trace.map((t) => [t.id, t]));
  assert.equal(trace.headings.asked, false);
  assert.equal(trace.headings.answered, false);
  assert.equal(trace.ijou.asked, false);
  assert.equal(r.grades.find((g) => g.id === 'input-files-in-repo').ok, false);
  assert.equal(r.verdict.ok, false);
  assert.ok(r.verdict.failed.includes('input-files-in-repo'));
});

test('REQ-015 全体の採点：生成プラグインが 2 つ見つかれば不合格。Without の腕は、ヒアリングの観点を採点しない', () => {
  const personaFiles = [];
  const persona = { ...weekly.persona, knowledge: [], files: [] };
  const r = gradeOuter({ persona, personaFiles, items: [], toolEvents: [], state: null, generatedCount: 2, generatedFiles: null, stages: null, inner: null, userSignals: [], model: 'claude-opus-5-5', arm: 'without' });
  assert.equal(r.grades.find((g) => g.id === 'one-plugin-generated').ok, false);
  assert.ok(!r.grades.some((g) => g.id === 'all-items-heard'));
  assert.ok(!r.grades.some((g) => g.id === 'no-generation-before-approval'));
  const control = gradeOuter({ persona, personaFiles, items: [], toolEvents: [], state: null, generatedCount: 1, generatedFiles: [], stages: { skipped: true, reason: 'x' }, inner: null, userSignals: [], model: 'claude-opus-5-5', arm: 'control' });
  assert.equal(control.grades.find((g) => g.id === 'all-items-heard').ok, false, '対照のクリエイターは、全項目を聞かないので、落ちる');
  assert.equal(control.grades.find((g) => g.id === 'stage1').ok, false);
});

test('REQ-015 ユーザー役の誤り：聞かれていないのに隠すべきナレッジを話した・指示の言葉を話した答えを、見つける', () => {
  const s = script();
  s.answer('ほかに伝えたいことはありますか？', '見出しは「■今週の売上」の2つです');
  s.answer('進め方は？', '答える条件に当てはまるので答えます。月曜に集計します');
  const persona = JSON.parse(JSON.stringify(weekly.persona));
  const r = gradeOuter({ persona, personaFiles: [], items: s.items, toolEvents: [], state: null, generatedCount: 0, generatedFiles: null, stages: null, inner: null, userSignals: [], model: 'claude-opus-5-5', arm: 'without' });
  assert.ok(r.faults.some((f) => f.kind === 'instruction-words' && f.answerIndex === 1), JSON.stringify(r.faults));
  assert.equal(r.exampleCandidate, false);
});
