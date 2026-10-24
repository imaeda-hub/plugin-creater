// ユーザー役の部品の試験。実際のモデルは使わない（偽物の Agent SDK）。
// 動かし方（リポジトリの根で）：node --test "tests/dev-eval/runner/*.test.mjs"

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadPersona } from '../personas/validate.mjs';
import { createFakeSdk } from './outer-fake-sdk.mjs';
import {
  HISTORY_LIMITS,
  INSTRUCTION_WORDS,
  USER_ROLE_MODEL,
  USER_RULES,
  askUserRole,
  buildSystemPrompt,
  buildUserPrompt,
  createUserRole,
  joinNotes,
} from './user-role.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS = path.join(here, '..', 'personas');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'user-role-test-'));

const weekly = (await loadPersona(path.join(PERSONAS, 'weekly-report'), { allStyles: true })).persona;
const training = (await loadPersona(path.join(PERSONAS, 'training-survey'))).persona;

test('REQ-015 ユーザー役のモデルは ID で固定されている（別名ではない）', () => {
  assert.equal(USER_ROLE_MODEL, 'claude-sonnet-5-5');
  assert.match(USER_ROLE_MODEL, /^claude-[a-z]+-\d+-\d+$/);
});

test('REQ-017 ユーザー役に渡すもの：profile・ファイル・ナレッジ・決まりの確かめの答え。渡さないもの：markers・id・ほかの模擬ユーザー', () => {
  const system = buildSystemPrompt(weekly);
  assert.ok(system.includes(weekly.profile));
  for (const f of weekly.files) {
    assert.ok(system.includes(f.place), f.place);
    assert.ok(system.includes(f.describe));
    assert.ok(system.includes(f.reveal));
  }
  for (const k of weekly.knowledge) {
    assert.ok(system.includes(k.fact), k.id);
    assert.ok(system.includes(k.reveal));
  }
  // 決まりの確かめ：答えの選択肢と、足す中身
  const man = weekly.knowledge.find((k) => k.id === 'man-yen');
  assert.ok(system.includes('「そうしないときもある」を選ぶ（名前だけを書く）'));
  assert.ok(!system.includes('そうしないときもある（どんなときか）'), '選択肢の説明まで写させない');
  assert.ok(system.includes(man.file.detail));
  assert.ok(system.includes('「決まりではなく、たまたま」を選ぶ'));
  // 渡さない：言葉の見分け（正規表現の文字）は、指示に入らない
  for (const k of weekly.knowledge) {
    for (const value of Object.values(k.markers).flat()) {
      if (/[|\\]/.test(value)) assert.ok(!system.includes(value), `${k.id} の見分けが指示に入っている：${value}`);
    }
    assert.ok(!system.includes(`id：${k.id}`));
  }
  assert.ok(!system.includes('userRoleTests'));
  assert.ok(!system.includes('weekly-report'));
  assert.ok(!system.includes(training.profile));
});

test('REQ-015 話し方：normal は指示なし。ほかは話し方を優先すると書き、何を話してよいかは答え方の決まりに従うと書く', () => {
  assert.ok(!buildSystemPrompt(weekly, { styleName: 'normal' }).includes('話し方：'));
  const terse = buildSystemPrompt(weekly, { styleName: 'terse' });
  assert.ok(terse.includes(`話し方：${weekly.styles.terse.instruction}`));
  assert.ok(terse.includes('答えの長さと言い方は、答え方の決まりより、この話し方を優先する。何を話してよいかは、答え方の決まりに従う。'));
  // hurry のときだけ、進め方の選び方を足す
  assert.ok(buildSystemPrompt(weekly, { styleName: 'hurry' }).includes('残りを手早く聞く'));
  assert.ok(!terse.includes('残りを手早く聞く」を選ぶ'));
});

test('REQ-016 まだやったことのない作業では、ファイルを示さない（「ありません。まだやったことがないので」）', () => {
  const system = buildSystemPrompt(training);
  assert.ok(system.includes('持っているファイルはありません'));
  assert.ok(system.includes('ありません。まだやったことがないので'));
  assert.ok(!system.includes('あなたが持っているファイル'));
});

test('REQ-015 質問のプロンプトに、それまでのやり取りと選択肢が入り、長い履歴は新しい側が残る', () => {
  const history = Array.from({ length: HISTORY_LIMITS.exchanges + 5 }, (_, i) => ({ question: `質問${i}`, answer: `答え${i}` }));
  const p = buildUserPrompt({ question: '今の質問', choices: [{ label: 'はい', description: '進める' }, 'いいえ'], history });
  assert.ok(p.includes('AI：質問44') && p.includes('あなた：答え44'));
  assert.ok(!p.includes('AI：質問0\n'));
  assert.ok(p.includes('AI からの質問：今の質問'));
  assert.ok(p.includes('- はい（進める）') && p.includes('- いいえ'));
  const none = buildUserPrompt({ question: 'q' });
  assert.ok(!none.includes('これまでのやり取り') && !none.includes('選択肢'));
});

test('REQ-015 askUserRole は Agent SDK を道具なし・1手番・設定なしで呼び、答えを返す', async () => {
  const seen = [];
  const sdk = createFakeSdk({ userRole: (req) => { seen.push(req); return '  weekly_report.md です  '; } });
  const r = await askUserRole(weekly, '成果物は？', [], { query: sdk.query });
  assert.equal(r.text, 'weekly_report.md です');
  assert.equal(seen.length, 1);
  const o = seen[0].options;
  assert.equal(o.model, 'claude-sonnet-5-5');
  assert.equal(o.maxTurns, 1);
  assert.deepEqual(o.tools, []);
  assert.deepEqual(o.settingSources, []);
  assert.equal(typeof o.systemPrompt, 'string');
  // 環境変数は許可リストと一時 HOME だけ
  assert.ok(o.env.HOME && o.env.HOME.includes('user-role-home'));
  assert.equal(o.env.GITHUB_TOKEN, undefined);
});

test('REQ-015 askUserRole は呼び出しが失敗したら、平易な日本語の Error を投げる', async () => {
  const sdk = createFakeSdk({ userRole: () => new Error('limit') });
  await assert.rejects(() => askUserRole(weekly, 'q', [], { query: sdk.query }), /ユーザー役の呼び出しに失敗しました/);
});

test('REQ-015 createUserRole は答えとやり取りを記録し、次の質問に履歴を渡す', async () => {
  const prompts = [];
  const sdk = createFakeSdk({ userRole: ({ prompt }) => { prompts.push(prompt); return `答え${prompts.length}`; } });
  const home = tmp();
  const role = createUserRole({ persona: weekly, query: sdk.query, home });
  const a1 = await role.answer('1つ目', [], 'text');
  await role.answer('2つ目', [{ label: 'A', description: '' }], 'AskUserQuestion');
  assert.equal(a1.answer, '答え1');
  assert.equal(role.answerCount, 2);
  assert.ok(prompts[1].includes('AI：1つ目') && prompts[1].includes('あなた：答え1'));
  assert.equal(role.answers[1].via, 'AskUserQuestion');
  assert.deepEqual(role.answers[1].choices, [{ label: 'A', description: '' }]);
  assert.ok(role.cost > 0);
  assert.equal(role.signals.length, 0);
  fs.rmSync(home, { recursive: true, force: true });
});

test('REQ-015 順に答える：同時に聞いても、履歴の並びが崩れない', async () => {
  const sdk = createFakeSdk({ userRole: async ({ prompt }) => { await new Promise((r) => setTimeout(r, prompt.includes('遅い') ? 30 : 1)); return 'ok'; } });
  const home = tmp();
  const role = createUserRole({ persona: weekly, query: sdk.query, home });
  await Promise.all([role.answer('遅い質問'), role.answer('速い質問')]);
  assert.deepEqual(role.history.map((h) => h.question), ['遅い質問', '速い質問']);
  fs.rmSync(home, { recursive: true, force: true });
});

test('REQ-015 話し方 hurry：afterAnswers 回答えた後の次の答えに text を足し、その位置を記録する', async () => {
  const sdk = createFakeSdk({ userRole: () => '短い答え' });
  const home = tmp();
  const role = createUserRole({ persona: weekly, styleName: 'hurry', query: sdk.query, home });
  const n = weekly.styles.hurry.signal.afterAnswers;
  for (let i = 0; i < n + 2; i += 1) await role.answer(`質問${i}`);
  assert.equal(role.signals.length, 1, '合図は 1 回だけ');
  assert.equal(role.signals[0].answerIndex, n);
  assert.equal(role.signals[0].text, weekly.styles.hurry.signal.text);
  assert.ok(role.answers[n].answer.endsWith(weekly.styles.hurry.signal.text));
  assert.equal(role.answers[n].signal, true);
  assert.equal(role.answers[n].rawAnswer, '短い答え');
  assert.ok(!role.answers[n - 1].answer.includes(weekly.styles.hurry.signal.text));
  assert.ok(!role.answers[n + 1].answer.includes(weekly.styles.hurry.signal.text));
  // 履歴には合図つきの答えが入る（次の質問のユーザー役が、急ぐ合図を出したことを覚えている）
  assert.ok(role.history[n].answer.includes(weekly.styles.hurry.signal.text));
  fs.rmSync(home, { recursive: true, force: true });
});

test('REQ-015 話し方 hurry 以外には signal がなく、合図は足されない', async () => {
  const sdk = createFakeSdk({ userRole: () => 'ok' });
  const home = tmp();
  const role = createUserRole({ persona: weekly, styleName: 'terse', query: sdk.query, home });
  for (let i = 0; i < 10; i += 1) await role.answer(`q${i}`);
  assert.equal(role.signals.length, 0);
  fs.rmSync(home, { recursive: true, force: true });
});

test('REQ-015 知らない話し方は断る', () => {
  assert.throws(() => createUserRole({ persona: weekly, styleName: 'rude', home: tmp() }), /話し方「rude」/);
});

test('REQ-015 指示のことを話さない：見張る言葉は、指示の言葉に当たり、ふつうの答えには当たらない', () => {
  for (const bad of ['答える条件に当てはまるので答えます', '自分から話すかどうかは「いいえ」です', '答え方の決まりでは言えません', '聞かれているので答えます', 'ユーザー役として答えます']) {
    assert.ok(INSTRUCTION_WORDS.test(bad), bad);
  }
  for (const ok of ['weekly_report.md です', '見出しは2つだけです', '特に決まっていません', '金額は万円で書きます', '以上、です。']) {
    assert.ok(!INSTRUCTION_WORDS.test(ok), ok);
  }
});

// ---- 会話例の下読みの直し（E1）：クリエイターがチャットに書いた文、答え方 -----------------------------------------------

test('REQ-015 質問のプロンプトに、クリエイターが質問の前にチャットに書いた文が入る（「上のまとめ」に答えるため。testing.md 6.1）', () => {
  const p = buildUserPrompt({ question: '上のまとめで、違うところはどこですか？', notes: ['確かめた決まりは次のとおりです。\n・金額は万円', '足りなければ教えてください。'] });
  const at = (text) => p.indexOf(text);
  assert.ok(at('AI が質問の前にチャットに書いた文：') >= 0);
  assert.ok(at('・金額は万円') > at('AI が質問の前にチャットに書いた文：'));
  assert.ok(at('AI からの質問：上のまとめで') > at('足りなければ教えてください。'), '前の文は、質問より前');
  // 文がないときは、見出しも出さない
  for (const none of [undefined, '', [], ['', '  ']]) assert.ok(!buildUserPrompt({ question: 'q', notes: none }).includes('チャットに書いた文'));
  assert.equal(joinNotes(['a', ' ', 'b ']), 'a\n\nb');
  // 長いときは後ろ（質問に近い側）を残す
  const long = buildUserPrompt({ question: 'q', notes: `${'あ'.repeat(HISTORY_LIMITS.noteChars)}末尾` });
  assert.ok(long.includes('末尾') && long.includes('…'));
});

test('REQ-015 createUserRole は、前の文を次の質問に付け、履歴にも残す。後の質問は、前の質問と一緒に前の文も読める', async () => {
  const prompts = [];
  const sdk = createFakeSdk({ userRole: ({ prompt }) => { prompts.push(prompt); return '答え'; } });
  const home = tmp();
  const role = createUserRole({ persona: weekly, query: sdk.query, home });
  const first = await role.answer('上のまとめで、違うところは？', [], 'AskUserQuestion', {}, ['まとめ：金額は万円']);
  await role.answer('次の質問', [], 'AskUserQuestion');
  assert.ok(prompts[0].includes('AI が質問の前にチャットに書いた文：\nまとめ：金額は万円'));
  assert.equal(first.notes, 'まとめ：金額は万円', '何を見せたかを、答えの記録に残す');
  // 2 つ目：今回の前の文はないが、履歴には 1 つ目の前の文が入っている
  assert.ok(!prompts[1].includes('AI が質問の前にチャットに書いた文：\n'));
  assert.ok(prompts[1].includes('AI がチャットに書いた文：まとめ：金額は万円\nAI：上のまとめで、違うところは？'));
  assert.equal(role.answers[1].notes, undefined);
  fs.rmSync(home, { recursive: true, force: true });
});

test('REQ-015 答え方の決まり：選択肢は名前だけを書き、「名前（説明）」と写さない。見えないものを指す問いには聞き返し、「見えません」と言わない', () => {
  const rules = USER_ROLE_RULES_TEXT();
  assert.match(rules, /名前（説明）」の形にしない/);
  assert.match(rules, /説明の部分は写さない/);
  assert.match(rules, /「上の〜とは、どれのことですか？」のように聞き返す/);
  assert.match(rules, /「違いはない」「特にない」と答えない/);
  assert.match(rules, /「見えません」「表示されていません」のような、機械の言い方はしない/);
  assert.match(rules, /「（　）」で重ねて書かない/);
  assert.match(rules, /AI が質問の前にチャットに書いた文も、読んだものとして踏まえる/);
  assert.match(rules, /最初に書いてある自分の立場と仕事（誰として、何のために、何をしているか）は、自分のこととして答えてよい/);
  // 選択肢の見出しにも、名前だけを使うと書く（説明は手がかり）
  const p = buildUserPrompt({ question: 'q', choices: [{ label: '違いも不足もない', description: 'このままでよい' }] });
  assert.ok(p.includes('選ぶときは名前だけを使う'));
  assert.ok(p.includes('- 違いも不足もない（このままでよい）'));
  // 指示の言葉の見張り（INSTRUCTION_WORDS）に、足した決まりの文が当たらないように、決まりの文は口に出さない側に書いてある
  assert.ok(USER_RULES.some((r) => r.includes('口に出さない')));
});

test('REQ-017 決まりの確かめ：足す中身（例外・本当のやり方）そのものを確かめられたときは「このとおり」。足す中身のないものには付けない', () => {
  const system = buildSystemPrompt(weekly);
  const rule = weekly.knowledge.find((k) => k.id === 'headings');
  assert.ok(rule && !rule.file.detail);
  const blocks = system.split('\n- ').filter((b) => b.includes('これはファイル「'));
  const withDetail = blocks.filter((b) => b.includes('ただし、相手が確かめてきた文の中に、すでにこの具体的な中身が書いてあるときは'));
  assert.equal(withDetail.length, weekly.knowledge.filter((k) => k.from === 'file' && k.file.detail).length);
  assert.ok(withDetail.every((b) => b.includes('「このとおり」を選ぶ')));
  assert.ok(blocks.length > withDetail.length, '足す中身のない決まり（このとおり・たまたま）には付かない');
});

function USER_ROLE_RULES_TEXT() {
  return USER_RULES.join('\n');
}
