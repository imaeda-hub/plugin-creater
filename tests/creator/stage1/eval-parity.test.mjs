// 1段目の EVAL の課題の検査（template/tests/stage1/check_structure.py の check_eval）と、
// 採点（skills/test-plugin/scripts/grade.mjs の validateTask）が、同じ誤りを見つけることの確かめ（片方）。
// 同じ例（eval-cases.json）を Python 側（test_check_structure.py の EvalParity）にも通す。
// ずれる（片方が通し、片方が断る）と、どちらかの試験が落ちる。
// 動かし方：node --test "tests/creator/stage1/*.test.mjs"
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateTask } from '../../../skills/test-plugin/scripts/grade.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const { base, cases } = JSON.parse(fs.readFileSync(path.join(here, 'eval-cases.json'), 'utf8'));

/** 例から課題を作る。値が "$remove" の項目は消す（Python 側 test_check_structure.py の build_task と同じ決まり） */
function buildTask(c) {
  const task = structuredClone(base);
  for (const [key, value] of Object.entries(c.top ?? {})) {
    if (value === '$remove') delete task[key];
    else task[key] = value;
  }
  if (c.criterion) {
    const first = { ...task.criteria[0] };
    for (const [key, value] of Object.entries(c.criterion)) {
      if (value === '$remove') delete first[key];
      else first[key] = value;
    }
    task.criteria[0] = first;
  }
  return task;
}

for (const c of cases) {
  test(`REQ-041 採点の決まり（grade.mjs）が、1段目と同じ判定をする：${c.name}`, () => {
    const problems = validateTask(buildTask(c), 'eval.json');
    if (c.ok) assert.deepEqual(problems, [], '通るはずの課題が断られた');
    else assert.notEqual(problems.length, 0, '断られるはずの課題が通った');
  });
}
