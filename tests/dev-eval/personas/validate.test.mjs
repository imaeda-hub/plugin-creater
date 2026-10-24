// 模擬ユーザーの形を確かめるスクリプト（validate.mjs）と、模擬ユーザーそのものの試験。
// 動かし方：node --test "tests/dev-eval/personas/*.test.mjs"
// make_files.py の試験は、python-docx と openpyxl が入った Python があるときだけ動く（環境変数 PERSONA_PYTHON で場所を渡す。なければ python3）。

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { documentText } from '../../../com.github.copilot/extensions/plugin-creator/doc-text.mjs';
import { CONFIRM_ANSWERS, CONFIRM_CHOICES, KIND_ANSWER, STYLE_KEYS, loadPersona, validatePersona } from './validate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PERSONAS = ['weekly-report', 'meeting-minutes', 'training-survey'];
const dirOf = (id) => path.join(HERE, id);
const readPersona = (id) => JSON.parse(fs.readFileSync(path.join(dirOf(id), 'persona.json'), 'utf8'));

/** 模擬ユーザーを一時のフォルダに写し、persona.json（と任意のファイル）を書き換えて確かめる */
async function mutate(id, change, { allStyles = false, files = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-test-'));
  try {
    const dir = path.join(root, id);
    fs.cpSync(dirOf(id), dir, { recursive: true });
    const persona = readPersona(id);
    change(persona, dir);
    fs.writeFileSync(path.join(dir, 'persona.json'), JSON.stringify(persona, null, 2));
    if (files) files(dir);
    return await validatePersona(dir, { allStyles });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const hasError = (result, part) => result.errors.some((e) => e.includes(part));
const knowledgeOf = (persona, id) => persona.knowledge.find((k) => k.id === id);

// ---- 模擬ユーザーそのもの ------------------------------------------------------------------------------------

for (const id of PERSONAS) {
  test(`REQ-017 模擬ユーザー ${id} が形の決まりに合う`, async () => {
    const result = await validatePersona(dirOf(id), { allStyles: id === 'weekly-report' });
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });
}

test('REQ-017 示すファイルのある 2 人の模擬ユーザーに、docx か xlsx が入っていて、3 種類の決まりがある', () => {
  for (const id of ['weekly-report', 'meeting-minutes']) {
    const persona = readPersona(id);
    assert.ok(persona.files.some((f) => /\.(docx|xlsx)$/.test(f.src)), `${id}: docx か xlsx がない`);
    const kinds = new Set(persona.knowledge.filter((k) => k.from === 'file').map((k) => k.file.kind));
    for (const kind of ['rule', 'exception', 'incidental']) assert.ok(kinds.has(kind), `${id}: ${kind} がない`);
  }
});

test('REQ-017 決まりの確かめの 4 つの答えが、少なくとも 1 人の模擬ユーザーで使われている', () => {
  const used = new Set();
  for (const id of PERSONAS) for (const k of readPersona(id).knowledge) if (k.file) used.add(k.file.answer);
  assert.deepEqual([...used].sort(), [...CONFIRM_ANSWERS].sort());
  assert.deepEqual(Object.values(KIND_ANSWER).sort(), [...CONFIRM_ANSWERS].sort());
  assert.equal(CONFIRM_CHOICES.at(-1), 'このとおり');
});

test('REQ-015 週報の模擬ユーザーは、話し方の 6 つがそろい、急いでいるは合図を持つ', () => {
  const styles = readPersona('weekly-report').styles;
  assert.deepEqual(Object.keys(styles).sort(), [...STYLE_KEYS].sort());
  assert.equal(styles.hurry.signal.afterAnswers >= 1, true);
  for (const key of ['vague', 'dont-know', 'nothing-special']) assert.equal(styles[key].reask, true);
});

test('REQ-016 まだやったことのない模擬ユーザーは、ファイルがなく、想定の 1 回のナレッジを持つ', () => {
  const persona = readPersona('training-survey');
  assert.equal(persona.experience, 'never');
  assert.deepEqual(persona.files, []);
  const firstRun = knowledgeOf(persona, 'first-run');
  assert.ok(firstRun);
  assert.match('初めてやるとしたら、最初に何をしますか？', new RegExp(firstRun.markers.asked));
  assert.equal(fs.existsSync(path.join(dirOf('training-survey'), 'files')), false);
});

test('REQ-015 聞かれないと話さないナレッジが、どの模擬ユーザーにもある', () => {
  for (const id of PERSONAS) assert.ok(readPersona(id).knowledge.some((k) => k.volunteer === false), id);
});

test('REQ-038 内側の EVAL の見本の成果物が、program の基準にすべて合格する（validate.mjs が確かめている）', async () => {
  for (const id of PERSONAS) {
    const task = JSON.parse(fs.readFileSync(path.join(dirOf(id), 'inner', 'eval.json'), 'utf8'));
    assert.ok(task.criteria.some((c) => c.grading === 'program'), id);
    assert.ok(fs.readdirSync(path.join(dirOf(id), 'inner', 'golden')).length > 0, id);
  }
});

test('REQ-017 loadPersona が、示すファイルの元の絶対の場所と置き場所を返す', async () => {
  const { persona, files, dir } = await loadPersona(dirOf('weekly-report'), { allStyles: true });
  assert.equal(persona.id, 'weekly-report');
  assert.equal(dir, dirOf('weekly-report'));
  assert.equal(files.length, 3);
  for (const f of files) {
    assert.ok(path.isAbsolute(f.src));
    assert.ok(fs.existsSync(f.src));
    assert.ok(!f.place.startsWith('/') && !f.place.includes('..'));
  }
  assert.deepEqual(files.map((f) => f.role).sort(), ['input', 'output', 'template']);
});

test('REQ-017 loadPersona は、形に合わない模擬ユーザーでは Error を投げる', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-test-'));
  try {
    const dir = path.join(root, 'broken');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'persona.json'), '{}');
    await assert.rejects(() => loadPersona(dir), /形が決まりに合わない/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---- 確かめるスクリプトが、誤りを見つけること --------------------------------------------------------------------------

test('REQ-017 示すファイルの evidence が文書の文字にないと不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    knowledgeOf(p, 'ijou').file.evidence = 'ファイルにない文字';
  });
  assert.equal(r.ok, false);
  assert.ok(hasError(r, 'evidence'));
});

test('REQ-017 xlsx の数式の evidence も、文書をテキストにした結果で確かめる', async () => {
  const r = await mutate('weekly-report', (p) => {
    knowledgeOf(p, 'man-yen').file.evidence = 'SUMPRODUCT';
  });
  assert.ok(hasError(r, 'evidence'));
});

test('REQ-017 たまたまの書き方がないと不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    p.knowledge = p.knowledge.filter((k) => k.id !== 'title-date');
    p.userRoleTests.recall = p.userRoleTests.recall.filter((x) => x.knowledge !== 'title-date');
    p.userRoleTests.confirm = p.userRoleTests.confirm.filter((x) => x.knowledge !== 'title-date');
  });
  assert.ok(hasError(r, 'incidental'));
});

test('REQ-017 例外のある決まりがないと不合格になる', async () => {
  const r = await mutate('meeting-minutes', (p) => {
    knowledgeOf(p, 'todo-owner').file.kind = 'rule';
    knowledgeOf(p, 'todo-owner').file.answer = 'このとおり';
  });
  assert.ok(hasError(r, 'exception'));
});

test('REQ-017 kind と answer が食い違うと不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    knowledgeOf(p, 'ijou').file.answer = '違う';
  });
  assert.ok(hasError(r, 'file.answer'));
});

test('REQ-017 例外と「違う」に detail がないと不合格になる', async () => {
  const r1 = await mutate('weekly-report', (p) => {
    delete knowledgeOf(p, 'man-yen').file.detail;
  });
  assert.ok(hasError(r1, 'file.detail'));
  const r2 = await mutate('meeting-minutes', (p) => {
    delete knowledgeOf(p, 'style').file.detail;
  });
  assert.ok(hasError(r2, 'file.detail'));
});

test('REQ-017 たまたまの書き方を自分から話す設定にすると不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    knowledgeOf(p, 'title-date').volunteer = true;
    delete knowledgeOf(p, 'title-date').markers.leak;
  });
  assert.ok(hasError(r, 'incidental'));
});

test('REQ-017 たまたまの書き方に excluded がないと不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    delete knowledgeOf(p, 'title-date').markers.excluded;
  });
  assert.ok(hasError(r, 'excluded'));
});

test('REQ-017 ファイルの決まりの確かめ（confirm）がないと不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    p.userRoleTests.confirm = p.userRoleTests.confirm.filter((x) => x.knowledge !== 'ijou');
  });
  assert.ok(hasError(r, '決まりの確かめ'));
});

test('REQ-015 聞かれないと話さないナレッジに leak がないと不合格になる', async () => {
  const r = await mutate('meeting-minutes', (p) => {
    delete knowledgeOf(p, 'decision-mark').markers.leak;
  });
  assert.ok(hasError(r, 'markers.leak'));
});

test('REQ-015 leak と answered が、ナレッジの文にない言葉だと不合格になる', async () => {
  const r = await mutate('meeting-minutes', (p) => {
    knowledgeOf(p, 'decision-mark').markers.leak = '存在しない言葉';
    knowledgeOf(p, 'output').markers.answered = '存在しない言葉';
  });
  assert.ok(hasError(r, 'markers.leak が'));
  assert.ok(hasError(r, 'markers.answered が'));
});

test('REQ-015 読めない正規表現があると不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    knowledgeOf(p, 'output').markers.asked = '(';
    p.userRoleTests.abstain = '[';
  });
  assert.ok(hasError(r, 'markers.asked'));
  assert.ok(hasError(r, 'abstain'));
});

test('REQ-017 知らない項目（書き間違い）があると不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    knowledgeOf(p, 'output').volunteerr = true;
    p.stlyes = {};
  });
  assert.ok(hasError(r, '知らない項目「volunteerr」'));
  assert.ok(hasError(r, '知らない項目「stlyes」'));
});

test('REQ-017 id がフォルダの名前と違う、knowledge の id が重なると不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    p.id = 'other-name';
    p.knowledge[1].id = 'output';
  });
  assert.ok(hasError(r, 'フォルダの名前'));
  assert.ok(hasError(r, '重なっている'));
});

test('REQ-017 docx も xlsx もない、置き場所が危ない、元のファイルがないと不合格になる', async () => {
  const r1 = await mutate('weekly-report', (p) => {
    p.files = p.files.filter((f) => f.src.endsWith('.csv'));
    p.knowledge = p.knowledge.filter((k) => k.from !== 'file');
    p.userRoleTests.recall = p.userRoleTests.recall.filter((x) => x.knowledge === 'output');
    p.userRoleTests.compound = [];
    p.userRoleTests.confirm = [];
  });
  assert.ok(hasError(r1, 'docx か xlsx'));
  const r2 = await mutate('weekly-report', (p) => {
    p.files[0].place = '../外/先週の週報.docx';
    p.files[1].src = 'files/ない.xlsx';
  });
  assert.ok(hasError(r2, '.. は使えない'));
  assert.ok(hasError(r2, 'のファイルがない'));
});

test('REQ-016 まだやったことのない作業は、ファイルがあると不合格になり、first-run がないと不合格になる', async () => {
  const r1 = await mutate('training-survey', (p) => {
    p.files = [{ src: 'inner/inputs/survey.csv', place: '資料/survey.csv', role: 'input', describe: 'x', reveal: 'y' }];
  });
  assert.ok(hasError(r1, 'files は [] にする'));
  const r2 = await mutate('training-survey', (p) => {
    p.knowledge = p.knowledge.filter((k) => k.id !== 'first-run');
    p.userRoleTests.recall = p.userRoleTests.recall.filter((x) => x.knowledge !== 'first-run');
  });
  assert.ok(hasError(r2, 'first-run'));
});

test('REQ-015 話し方：normal がない、キーが違う、hurry に合図がない、vague に reask がないと不合格になる', async () => {
  const r1 = await mutate('weekly-report', (p) => {
    delete p.styles.normal;
    p.styles.angry = { label: 'x', instruction: 'y' };
    delete p.styles.hurry.signal;
    p.styles.vague.reask = false;
  });
  assert.ok(hasError(r1, 'styles.normal がない'));
  assert.ok(hasError(r1, '使えないキー「angry」'));
  assert.ok(hasError(r1, 'styles.hurry.signal'));
  assert.ok(hasError(r1, 'styles.vague.reask'));
  const r2 = await mutate('weekly-report', (p) => {
    delete p.styles['dont-know'];
  }, { allStyles: true });
  assert.ok(hasError(r2, 'styles.dont-know がない'));
});

test('REQ-015 ユーザー役の試験の質問が足りない（compound の対象が 1 つ、context が空など）と不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    p.userRoleTests.generic = ['1つだけ'];
    p.userRoleTests.compound[0].expect = ['ijou'];
    p.userRoleTests.context = [];
    p.userRoleTests.options[0].choices = ['Markdown'];
    p.userRoleTests.unknown = ['1つだけ'];
  });
  assert.ok(hasError(r, 'userRoleTests.generic'));
  assert.ok(hasError(r, 'userRoleTests.compound[0].expect'));
  assert.ok(hasError(r, 'userRoleTests.context'));
  assert.ok(hasError(r, 'userRoleTests.options[0].choices'));
  assert.ok(hasError(r, 'userRoleTests.unknown'));
});

test('REQ-015 recall と confirm と compound の質問が、そのナレッジの asked に当たらないと不合格になる', async () => {
  const r = await mutate('weekly-report', (p) => {
    p.userRoleTests.recall[2].questions[0] = 'あのことは、どうですか？';
    p.userRoleTests.confirm[0].question = 'あのことは、決まりですか？';
    p.userRoleTests.compound[0].question = 'ルールはありますか？';
  });
  assert.ok(hasError(r, 'ナレッジ「ijou」の markers.asked'));
  assert.ok(hasError(r, 'ナレッジ「headings」の markers.asked'));
  assert.ok(hasError(r, 'ナレッジ「man-yen」の markers.asked'));
});

test('REQ-015 ナレッジごとの具体的な質問（recall か confirm）がないと不合格になる', async () => {
  const r = await mutate('meeting-minutes', (p) => {
    p.userRoleTests.recall = p.userRoleTests.recall.filter((x) => x.knowledge !== 'output');
  });
  assert.ok(hasError(r, 'ナレッジ「output」の具体的な質問'));
});

// ---- 内側の EVAL ---------------------------------------------------------------------------------------------

test('REQ-038 見本の成果物が基準に合格しないと不合格になる（見出しを消した見本）', async () => {
  const r = await mutate('weekly-report', () => {}, {
    files: (dir) => {
      const file = path.join(dir, 'inner', 'golden', 'weekly_report.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('■来週の予定', '来週の予定'));
    },
  });
  assert.ok(hasError(r, '基準「C-03」'));
  assert.equal(r.errors.length, 1);
});

test('REQ-038 氏名を出した見本は、氏名を出さない基準に合格しない', async () => {
  const r = await mutate('training-survey', () => {}, {
    files: (dir) => {
      const file = path.join(dir, 'inner', 'golden', 'survey_summary.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('受講者B', '佐々木'));
    },
  });
  assert.ok(hasError(r, '基準「C-03」'));
});

test('REQ-038 最後の行が「以上」でない見本は、最後の行の基準に合格しない', async () => {
  const r = await mutate('weekly-report', () => {}, {
    files: (dir) => {
      const file = path.join(dir, 'inner', 'golden', 'weekly_report.md');
      fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8').trimEnd()}\n以上です\n`);
    },
  });
  assert.ok(hasError(r, '基準「C-07」'));
});

test('REQ-038 見本のフォルダがない、eval.json がない、入力がないと不合格になる', async () => {
  const r1 = await mutate('weekly-report', () => {}, { files: (dir) => fs.rmSync(path.join(dir, 'inner', 'golden'), { recursive: true }) });
  assert.ok(hasError(r1, 'inner/golden/'));
  const r2 = await mutate('weekly-report', () => {}, { files: (dir) => fs.rmSync(path.join(dir, 'inner', 'eval.json')) });
  assert.ok(hasError(r2, 'inner/eval.json がない'));
  const r3 = await mutate('weekly-report', () => {}, { files: (dir) => fs.rmSync(path.join(dir, 'inner', 'inputs', 'sales.csv')) });
  assert.ok(hasError(r3, '入力「inputs/sales.csv」が見つからない'));
});

test('REQ-038 基準の knowledge が模擬ユーザーにない、markers.task のあるナレッジに基準がないと不合格になる', async () => {
  const r = await mutate('meeting-minutes', () => {}, {
    files: (dir) => {
      const file = path.join(dir, 'inner', 'eval.json');
      const task = JSON.parse(fs.readFileSync(file, 'utf8'));
      task.criteria[0].knowledge = 'ない-id';
      task.criteria = task.criteria.filter((c) => c.knowledge !== 'decision-mark');
      fs.writeFileSync(file, JSON.stringify(task, null, 2));
    },
  });
  assert.ok(hasError(r, 'knowledge「ない-id」'));
  assert.ok(hasError(r, 'ナレッジ「decision-mark」は markers.task を持つが'));
});

test('REQ-038 eval.json が grade.mjs の決まりに合わない（grading が違う）と不合格になる', async () => {
  const r = await mutate('weekly-report', () => {}, {
    files: (dir) => {
      const file = path.join(dir, 'inner', 'eval.json');
      const task = JSON.parse(fs.readFileSync(file, 'utf8'));
      task.criteria[0].grading = 'human';
      fs.writeFileSync(file, JSON.stringify(task, null, 2));
    },
  });
  assert.ok(hasError(r, 'grading'));
});

// ---- コマンド ---------------------------------------------------------------------------------------------------

test('REQ-017 コマンドは、合格なら終了コード 0、不合格なら 1 を返す', () => {
  const ok = spawnSync(process.execPath, [path.join(HERE, 'validate.mjs'), dirOf('meeting-minutes'), dirOf('training-survey')], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /合格 {2}meeting-minutes/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-test-'));
  try {
    const dir = path.join(root, 'weekly-report');
    fs.cpSync(dirOf('weekly-report'), dir, { recursive: true });
    const persona = readPersona('weekly-report');
    delete persona.styles.hurry;
    fs.writeFileSync(path.join(dir, 'persona.json'), JSON.stringify(persona));
    const ng = spawnSync(process.execPath, [path.join(HERE, 'validate.mjs'), dir, '--all-styles'], { encoding: 'utf8' });
    assert.equal(ng.status, 1);
    assert.match(ng.stdout, /不合格/);
    assert.match(ng.stdout, /styles\.hurry がない/);
    const none = spawnSync(process.execPath, [path.join(HERE, 'validate.mjs')], { encoding: 'utf8' });
    assert.equal(none.status, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---- docx・xlsx を作るスクリプト -------------------------------------------------------------------------------------

const PYTHON = process.env.PERSONA_PYTHON || 'python3';
const pythonHasParts = spawnSync(PYTHON, ['-I', '-c', 'import docx, openpyxl'], { encoding: 'utf8' }).status === 0;

for (const id of ['weekly-report', 'meeting-minutes']) {
  test(`REQ-017 ${id} の make_files.py が作る docx・xlsx の中の文字が、置いてあるファイルと同じ`, { skip: !pythonHasParts && 'python-docx と openpyxl が入った Python がない（PERSONA_PYTHON）' }, () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-make-'));
    try {
      const run = spawnSync(PYTHON, [path.join(dirOf(id), 'make_files.py'), '--out', out], { encoding: 'utf8' });
      assert.equal(run.status, 0, run.stderr);
      const made = fs.readdirSync(out).filter((n) => /\.(docx|xlsx)$/.test(n));
      assert.ok(made.length > 0);
      for (const name of made) {
        const have = path.join(dirOf(id), 'files', name);
        assert.ok(fs.existsSync(have), `${name} が置いてない`);
        assert.equal(documentText(path.join(out, name)).text, documentText(have).text, name);
      }
      const placed = fs.readdirSync(path.join(dirOf(id), 'files')).filter((n) => /\.(docx|xlsx)$/.test(n));
      assert.deepEqual(placed.sort(), made.sort());
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
}
