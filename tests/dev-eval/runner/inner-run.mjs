// 内側の EVAL の実行1回（testing.md 7章）。生成プラグインあり（with）かなし（without）かで、同じ課題を動かして採点する。
//
// ありの流れ（人と同じ流れ。設定 → 開始 → 監視 → 結果）
//   1. まっさらな作業フォルダに、課題の入力のファイルだけを写す（tasks.mjs の prepareWorkDir）。
//   2. 置き換えた版のプラグインだけを読み込んだ Agent SDK の実行（メインのエージェント）に、課題の頼む言葉を渡す。
//      画面を開くツールは、つなぎ口（inner-adapter.mjs）が同じプロセスの MCP サーバーとして出す。
//   3. チャットに出た URL（assistant のメッセージ。ツールの返り値は数えない）を Playwright で開き、設定を入れて開始し、
//      終わった理由が出るまで見て、結果を読む（C3 の screen.mjs。開発の試験とユーザーの試験で同じものを使う）。
//   4. 成果物を採点する（C3 の grade.mjs。生成プラグインの検証エージェントの合否は使わない。モデルで判定する基準は Agent SDK で判定する）。
// なしの流れ：プラグインを何も読み込まず、同じ課題を渡す。
// どちらも、メインのエージェントがチャットで返事や答えを求めて手番を終えたら、ユーザー役が人の代わりに返事をする（7章）。
//
// 実際のモデルを使うのは Agent SDK の実行とユーザー役と判定だけで、sdk・userRole・judge は引数で受ける（試験は偽物を渡せる）。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { gradeRun } from '../../../skills/test-plugin/scripts/grade.mjs';
import { findScreenUrl } from '../../../skills/test-plugin/scripts/screen.mjs';
import { prepareWorkDir } from '../../../skills/test-plugin/scripts/tasks.mjs';
import { createInnerAdapter, summarizeMessage } from './inner-adapter.mjs';
import { makeQueryOptions } from './isolation.mjs';
import { modelMapOf, readConversionReport, toClaudeModelId } from './model-map.mjs';

export const DEFAULTS = Object.freeze({
  model: 'claude-sonnet-5-5',
  timeoutMs: 30 * 60_000,
  maxReplies: 8,
  mainMaxTurns: 80,
});

/** 画面の欄の id の規則（ui/static/render.js の fieldId）。モデルの選択は model-<役割> の欄である */
const MODEL_ROLES = ['orchestrator', 'worker', 'verifier'];

const REQUEST_ENDINGS =
  /(教えてください|お知らせください|知らせてください|お聞かせください|聞かせてください|ご指定ください|指定してください|選んでください|答えてください|入力してください|ご連絡ください|お願いします|お願いいたします|いかがでしょうか|でしょうか)[。.！!]*\s*$/;

/** 手番を終えたときの最後の文が、返事や答えを求めているか。文の終わりが「？」か、教えてほしいなどの依頼の言い方のとき */
export function asksForReply(text) {
  const tail = String(text ?? '').trim().slice(-200);
  if (tail === '') return false;
  return /[？?]\s*$/.test(tail) || REQUEST_ENDINGS.test(tail);
}

/** 画面の欄に入れるモデルの選択（Copilot の名前）を、screen.mjs の settings.task の形（欄の key → 値）にする */
export function modelFields(models) {
  const fields = {};
  for (const role of MODEL_ROLES) if (models?.[role]) fields[`model-${role}`] = models[role];
  return fields;
}

/**
 * 採点とは別に、動きを確かめる（ありの実行だけ。点数には入れない）。
 * @returns {Array<{ id: string, ok: boolean, detail: string }>}
 */
export function buildChecks({ pluginName, urlShown, mainTools, skillsUsed, screen, finalState, agents, modelMap, serverName }) {
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, ok: Boolean(ok), detail });
  const openTool = `mcp__${serverName}__open`;
  add('skill-used', skillsUsed.some((s) => s === pluginName || s.startsWith(`${pluginName}:`)), `呼んだスキル：${skillsUsed.join('、') || 'なし'}`);
  add('screen-opener-called', mainTools.includes(openTool), `画面を開くツール（${openTool}）を呼んだか`);
  add('url-shown', urlShown, 'チャットに画面の URL が出たか（REQ-005）');
  add('screen-finished', screen?.finished === true, screen?.finished ? `終わった理由：${screen.endReasonText || screen.endReason?.kind}` : '画面に終わった理由が出なかった');
  const snapshots = screen?.snapshots ?? [];
  const phases = new Set(snapshots.map((s) => s.phase).filter(Boolean));
  add('phases-shown', ['plan', 'do', 'study'].every((p) => phases.has(p)), `画面に出たフェーズ：${[...phases].join('、') || 'なし'}（REQ-008）`);
  const seen = new Set(snapshots.flatMap((s) => s.agents ?? []));
  add('worker-shown-running', seen.has('worker:running'), '作業エージェントが「実行中」と画面に出たか');
  add('verifier-shown-running', seen.has('verifier:running'), '検証エージェントが「実行中」と画面に出たか');
  const types = agents.map((a) => a.agentType);
  add('worker-used', types.some((t) => /:worker/.test(t)), '作業エージェントが動いたか');
  add('verifier-used', types.some((t) => /:verifier$/.test(t)), '検証エージェントが動いたか');
  // 画面で選んだモデルで動いたか（REQ-007）。選んだ Copilot の名前を Claude Code の ID にして、実際のモデルと比べる
  const selected = finalState?.settings?.models ?? {};
  for (const role of MODEL_ROLES) {
    const chosen = selected[role];
    const actual = agents.filter((a) => (role === 'orchestrator' ? a.parentAgentId === null : new RegExp(`:${role}(-.+)?$`).test(a.agentType))).map((a) => a.actualClaudeId).filter(Boolean);
    if (!chosen) continue;
    let expected = null;
    try {
      expected = toClaudeModelId(modelMap, chosen);
    } catch {
      expected = null;
    }
    add(`model-${role}`, expected !== null && actual.length > 0 && actual.every((id) => id === expected), `${role}：画面で選んだ ${chosen}（${expected ?? '表にない'}）、実際 ${actual.join('、') || '不明'}（REQ-007）`);
  }
  return checks;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 実行1回。
 * @param {object} o
 * @param {'with'|'without'} o.arm
 * @param {{ id: string, dir: string, json: object }} o.task tasks.mjs の課題の形（dir は eval.json のあるフォルダ。入力はそこからの相対）
 * @param {string} o.runDir この実行の記録の置き場所（作る）
 * @param {{ query: Function }} o.sdk Agent SDK
 * @param {Function} o.userRole ({ question, choices, history }) => Promise<string> チャットでの返事
 * @param {Function} [o.judge] モデルで判定する関数（grade.mjs の judge）
 * @param {object} [o.screen] createScreen() の入れ物（ありのとき。ブラウザーは使い回す）
 * @param {string} [o.pluginRoot] Copilot CLI 向けの生成プラグイン（ありのとき）
 * @param {string} [o.convertedRoot] 置き換えた版（ありのとき）
 * @param {object} [o.taskSettings] 画面の作業ごとの設定に足す値（{ key: 値 }。課題の settings.task より後に入れる）
 * @param {object} [o.models] 画面で選ぶモデル { orchestrator?, worker?, verifier? }（Copilot の名前）。省くと画面の既定のまま
 * @param {object} [o.envExtra] 試すエージェントの環境変数に足すもの
 * @param {boolean} [o.sandbox]
 * @param {AbortSignal} [o.signal]
 */
export async function runInnerArm(o) {
  const {
    arm, task, runDir, sdk, userRole, judge, screen, pluginRoot, convertedRoot, models, taskSettings = {}, envExtra = {}, sandbox = false, signal,
    model = DEFAULTS.model, timeoutMs = DEFAULTS.timeoutMs, maxReplies = DEFAULTS.maxReplies, mainMaxTurns = DEFAULTS.mainMaxTurns, pollMs,
  } = o;
  if (arm !== 'with' && arm !== 'without') throw new Error(`arm は with か without です：${arm}`);
  if (arm === 'with' && (!pluginRoot || !convertedRoot || !screen)) throw new Error('ありの実行には pluginRoot・convertedRoot・screen が要ります。');

  ensureDir(runDir);
  const eventsFile = path.join(runDir, 'events.jsonl');
  const record = (entry) => fs.appendFileSync(eventsFile, `${JSON.stringify({ at: Date.now(), arm, ...entry })}\n`);
  const startedAt = Date.now();
  // 作業フォルダ（試されるエージェントの cwd）は、記録の置き場所と分ける。採点のときに、記録が成果物に混ざらないようにするため
  const { workDir, inputs } = prepareWorkDir({ task, dir: path.join(runDir, 'work') });
  const homeDir = ensureDir(path.join(runDir, 'home-main'));

  const result = {
    arm, task: task.id, status: 'completed', reason: null, runDir, workDir, url: null, replies: 0, history: [], skillsUsed: [], mainTools: [],
    main: { sessionId: null, turns: 0, costUsd: 0, results: [] }, screen: null, finalState: null, agents: [], orchestratorRuns: [],
    checks: [], grading: null, refused: [], subagentModels: {}, limitHit: null,
  };

  let adapter = null;
  let reportInfo = null;
  if (arm === 'with') {
    reportInfo = readConversionReport(convertedRoot);
    adapter = await createInnerAdapter({ sdk, pluginRoot, convertedRoot, workDir, runDir, envExtra, mainModel: model, sandbox, record });
    const names = adapter.checkToolNames();
    if (names.missing.length > 0) {
      result.status = 'error';
      result.reason = `エージェントの定義が使うツール（${names.missing.join('、')}）を、中心の処理が出していません。`;
      await adapter.shutdown();
      return result;
    }
  }

  const rules = arm === 'with' ? readRules(convertedRoot) : '';
  const history = [];
  const refused = [];
  const abort = new AbortController();
  const onOuterAbort = () => abort.abort();
  signal?.addEventListener('abort', onOuterAbort, { once: true });
  const deadline = setTimeout(() => {
    result.timedOut = true;
    abort.abort();
  }, timeoutMs);

  let resolveUrl;
  const urlPromise = new Promise((resolve) => {
    resolveUrl = resolve;
  });
  let currentQuery = null;

  const answerQuestions = async (questions) => {
    const answers = {};
    for (const q of questions) {
      const choices = (q.options ?? []).map((option) => option.label);
      const answer = await userRole({ question: q.question, choices, history: [...history], multiSelect: Boolean(q.multiSelect) });
      history.push({ via: 'AskUserQuestion', question: q.question, choices, answer });
      answers[q.question] = answer;
    }
    return answers;
  };

  async function runMainTurn(prompt, resume) {
    const parts = adapter?.mainParts();
    const options = makeQueryOptions({
      cwd: workDir, home: homeDir, model, plugins: arm === 'with' ? [convertedRoot] : [], mcpServers: parts?.mcpServers, mcpTools: parts?.mcpTools ?? [],
      systemPromptAppend: rules || undefined, sandbox, onQuestion: answerQuestions, refused, envExtra, maxTurns: mainMaxTurns, resume, abortController: abort,
    });
    const query = sdk.query({ prompt, options });
    currentQuery = query;
    const turn = { sessionId: resume ?? null, lastText: '', finalText: '', resultMessage: null };
    try {
      for await (const m of query) {
        record({ t: 'sdk', run: 'main', m: summarizeMessage(m) });
        if (m.session_id) turn.sessionId = m.session_id;
        if (m.type === 'system' && m.subtype === 'init') {
          result.mainInit = {
            model: m.model, plugins: (m.plugins ?? []).map((p) => p.name), pluginErrors: m.plugin_errors ?? [], mcpServers: m.mcp_servers ?? [],
            skills: m.skills ?? [], agents: m.agents ?? [],
          };
        } else if (m.type === 'assistant') {
          const owner = m.agent_id ?? null;
          if (owner) {
            result.subagentModels[m.agent_id] = { type: m.subagent_type ?? null, model: m.message?.model };
            continue;
          }
          for (const block of m.message?.content ?? []) {
            if (block.type === 'text') {
              turn.lastText = block.text;
              const found = findScreenUrl(block.text);
              if (found && !result.url) {
                result.url = found;
                resolveUrl(found);
              }
            } else if (block.type === 'tool_use') {
              result.mainTools.push(block.name);
              if (block.name === 'Skill') result.skillsUsed.push(String(block.input?.skill ?? ''));
            }
          }
        } else if (m.type === 'result') {
          turn.resultMessage = m;
          turn.finalText = typeof m.result === 'string' && m.result !== '' ? m.result : turn.lastText;
          result.main.costUsd = m.total_cost_usd ?? result.main.costUsd;
          result.main.results.push({ subtype: m.subtype, is_error: m.is_error, turns: m.num_turns });
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) throw error;
    }
    result.main.turns += 1;
    result.main.sessionId = turn.sessionId;
    return turn;
  }

  /** メインのエージェントの手番を、返事を求められなくなるまで続ける */
  async function mainLoop() {
    let prompt = task.json.prompt;
    let resume;
    try {
      for (;;) {
        const turn = await runMainTurn(prompt, resume);
        const failed = turn.resultMessage?.is_error === true || String(turn.resultMessage?.subtype ?? '').startsWith('error');
        if (failed) {
          result.mainError = String(turn.resultMessage?.result || (turn.resultMessage?.errors ?? []).join('、') || turn.resultMessage?.subtype);
          const prefixes = sdk.USAGE_LIMIT_ERROR_PREFIXES ?? [];
          if (prefixes.some((p) => result.mainError.startsWith(p))) result.limitHit = { message: result.mainError, where: 'main' };
          return;
        }
        if (abort.signal.aborted) return;
        // ありで URL が出たあとは、人が画面を操作する。チャットの返事は要らない
        if (result.url) return;
        if (!asksForReply(turn.finalText) || result.replies >= maxReplies) return;
        const answer = await userRole({ question: turn.finalText, choices: [], history: [...history] });
        history.push({ via: 'chat', question: turn.finalText, answer });
        result.replies += 1;
        prompt = answer;
        resume = turn.sessionId;
        if (!resume) return;
      }
    } finally {
      resolveUrl(null);
    }
  }

  const screenSettings = () => {
    const base = task.json.settings ?? {};
    return { ...(base.maxIterations !== undefined ? { maxIterations: base.maxIterations } : {}), task: { ...modelFields(models), ...(base.task ?? {}), ...taskSettings } };
  };

  async function screenFlow() {
    const url = await urlPromise;
    if (!url) return null;
    return screen.operate({
      url, settings: screenSettings(), timeoutMs: Math.max(1000, timeoutMs - (Date.now() - startedAt)), pollMs,
      screenshotPath: path.join(runDir, 'screen.png'), signal: abort.signal,
      onSnapshot: (snapshot) => record({ t: 'screen', snapshot }),
    });
  }

  try {
    const main = mainLoop();
    let screenOutcome = null;
    let screenError = null;
    if (arm === 'with') {
      const flow = screenFlow().then(
        (outcome) => { screenOutcome = outcome; },
        (error) => { screenError = error; },
      );
      await Promise.all([main.catch((error) => { result.mainException = error; }), flow.finally(() => { if (arm === 'with') abort.abort(); })]);
    } else {
      await main.catch((error) => { result.mainException = error; });
    }
    if (arm === 'with') {
      result.screen = screenOutcome
        ? { finished: screenOutcome.finished, timedOut: screenOutcome.timedOut, endReason: screenOutcome.endReason, endReasonText: screenOutcome.endReasonText, summary: screenOutcome.summary, snapshots: screenOutcome.snapshots }
        : null;
      if (screenError) result.screenError = screenError.message;
    }
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', onOuterAbort);
    try {
      currentQuery?.close?.();
    } catch {
      // すでに閉じている
    }
  }

  // ---- 記録 ------------------------------------------------------------------------------------------
  result.history = history;
  result.refused = refused;
  if (adapter) {
    try {
      const state = await adapter.core.getState();
      const run = state.run;
      result.finalState = run
        ? {
            status: run.status, endReason: run.endReason, settings: run.settings,
            agents: (run.agents ?? []).map((a) => ({ slot: a.slot, role: a.role, status: a.status, selectedModel: a.selectedModel, actualModel: a.actualModel })),
            iterations: (run.iterations ?? []).map((i) => ({ n: i.n, verdicts: i.verdicts })), summary: run.summary, issues: (run.issues ?? []).length,
          }
        : null;
    } catch (error) {
      result.finalStateError = error.message;
    }
    await adapter.shutdown();
    result.agents = adapter.agents();
    result.orchestratorRuns = adapter.runs();
    result.limitHit ??= adapter.limitHit();
    result.chatLog = adapter.chatLog();
  }

  // ---- 状態の決め方 ---------------------------------------------------------------------------------------
  if (signal?.aborted) {
    result.status = 'stopped';
    result.reason = '試験全体が止まったので、この実行も止めました。';
  } else if (result.limitHit) {
    result.status = 'stopped';
    result.reason = `モデルの利用枠の上限に達しました（${result.limitHit.message}）`;
  } else if (result.mainException) {
    result.status = 'error';
    result.reason = `メインの実行が失敗しました：${result.mainException.message ?? result.mainException}`;
  } else if (arm === 'with' && result.mainInit && !result.mainInit.plugins.includes(reportInfo.plugin)) {
    result.status = 'error';
    result.reason = `プラグイン ${reportInfo.plugin} が読み込まれませんでした${result.mainInit.pluginErrors.length ? `（${result.mainInit.pluginErrors.map((e) => e.message).join('、')}）` : ''}。`;
  } else if (arm === 'with' && result.mainInit && result.mainInit.mcpServers.find((s) => s.name === adapter.serverName)?.status !== 'connected') {
    result.status = 'error';
    result.reason = `画面を開くツールの MCP サーバー（${adapter.serverName}）につながりませんでした（${JSON.stringify(result.mainInit.mcpServers)}）。`;
  } else if (result.mainError) {
    result.status = 'incomplete';
    result.reason = `メインの実行が誤りで終わりました（${result.mainError}）`;
  } else if (arm === 'with') {
    if (!result.url) {
      result.status = 'incomplete';
      result.reason = 'チャットに画面の URL が出ませんでした。';
    } else if (result.timedOut) {
      result.status = 'incomplete';
      result.reason = '時間内に、画面に終わった理由が出ませんでした。';
    } else if (result.screenError) {
      result.status = 'incomplete';
      result.reason = result.screenError;
    } else if (!result.screen?.finished) {
      result.status = 'incomplete';
      result.reason = '画面に終わった理由が出ませんでした。';
    }
  } else if (result.timedOut) {
    result.status = 'incomplete';
    result.reason = '時間内に、エージェントが手番を終えませんでした。';
  }

  if (arm === 'with' && reportInfo) {
    result.checks = buildChecks({
      pluginName: reportInfo.plugin, urlShown: Boolean(result.url), mainTools: result.mainTools, skillsUsed: result.skillsUsed, screen: result.screen,
      finalState: result.finalState, agents: result.agents, modelMap: modelMapOf(reportInfo), serverName: adapter.serverName,
    });
  }

  // ---- 採点 ----------------------------------------------------------------------------------------------
  if (result.status === 'completed' || result.status === 'incomplete') {
    const graded = await gradeRun({ task: task.json, workDir, inputs, judge });
    result.grading = { passed: graded.passed, total: graded.total, score: graded.score, errors: graded.errors, results: graded.results, judgments: graded.judgments };
  }
  result.seconds = Math.round((Date.now() - startedAt) / 1000);
  result.costUsd = {
    main: result.main.costUsd,
    orchestrator: result.orchestratorRuns.reduce((sum, r) => sum + (r.costUsd ?? 0), 0),
  };
  fs.writeFileSync(path.join(runDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function readRules(convertedRoot) {
  try {
    return fs.readFileSync(path.join(convertedRoot, '.eval', 'rules.md'), 'utf8').trim();
  } catch {
    return '';
  }
}

export const tmpRunDir = (prefix = 'inner') => fs.mkdtempSync(path.join(os.tmpdir(), `plugin-creator-dev-eval-${prefix}-`));
