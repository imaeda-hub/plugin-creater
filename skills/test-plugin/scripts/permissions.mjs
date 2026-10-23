// EVAL のセッションが受ける、許可の求めと質問への答え方（testing.md 10.4「質問と許可の求め」、R2 3.5・3.11）。
//
// 許可の求め（onPermissionRequest）の決まり。上から順に当てはめる。
//   1. 組織の管理設定で人の承認が要る求め（managedApprovalRequired）は、自動では許可しない。EVAL を止めて理由を示す。
//      人の答えが要るかは invocation.promptRequest?.managedApprovalRequired を先に見て、なければ request.managedApprovalRequired を見る（SDK 1.0.25）。
//   2. エクステンションの読み込みのときの確認（extension-permission-access）は許可する。拒むと、ツールもフックも登録されず、エクステンションが読み込まれない。
//   3. 作業フォルダの外への書き込み（kind が write で、書き込み先が作業フォルダの外）は拒む。
//   4. エクステンションの管理（extension-management。読み込み直しなど）と、環境変数の求め（extension-env-access）は拒む。
//      EVAL の途中でエクステンションを入れ替えると実行が途中で切れる。環境変数には機微なものが入りうる。
//   5. ほかは許可する（1回だけ）。
// シェルのコマンドがどこに書くかまでは、許可の求めでは見分けきれない（testing.md 10.4）。そのため、コマンドは許可する。
// 生成プラグインのエクステンションは、許可の求めに答えない（no-result）ので、答えの取り合いにならず、ここでの答えが効く。

import fs from 'node:fs';
import path from 'node:path';

/** 質問（ask_user）への決まった返事。あり・なしで同じにし、ユーザー役の AI は使わない（testing.md 10.4） */
export const FIXED_ANSWER = '課題に書いたこと以外は決まっていません。判断して進めてください';

const MAX_LISTED = 50;
const clip = (text, max = 160) => {
  const chars = [...String(text ?? '')];
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max).join('')}…`;
};

/** 求めの内容を、短い日本語にする（止めた理由や記録に使う）。読めない形でも例外は投げない */
export function describeRequest(request) {
  try {
    return describe(request);
  } catch {
    return '確認（内容を読めませんでした）';
  }
}

function describe(request) {
  const kind = request?.kind;
  switch (kind) {
    case 'shell':
      return `コマンドの実行：${clip(request.fullCommandText)}`;
    case 'write':
      return `ファイルの書き込み：${clip(request.fileName)}`;
    case 'read':
      return `ファイルの読み取り：${clip(request.path)}`;
    case 'url':
      return `Web の取得：${clip(request.url)}`;
    case 'mcp':
      return `外部のツールの利用：${clip(`${request.serverName ?? ''}/${request.toolName ?? ''}`)}`;
    case 'custom-tool':
      return `追加のツールの利用：${clip(request.toolName)}`;
    case 'extension-permission-access':
      return `エクステンションの権限：${clip(request.extensionName)}（${clip((request.capabilities ?? []).join('、'))}）`;
    case 'extension-env-access':
      return `エクステンションの環境変数の利用：${clip(request.extensionName)}`;
    case 'extension-management':
      return 'エクステンションの管理（読み込み直しなど）';
    default:
      return `確認（${clip(kind ?? '種類不明')}）`;
  }
}

/**
 * 存在する一番近い親の本当の場所（シンボリックリンクをたどった後）に、残りの名前をつなぐ。
 * まだない書き込み先でも、外を指すリンクを見抜くためである。行き先のないリンク（書くと行き先が作られる）も、行き先をたどる。
 */
function realPathOf(target, depth = 0) {
  let current = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...rest.reverse());
    } catch {
      let isLink = false;
      try {
        isLink = fs.lstatSync(current).isSymbolicLink();
      } catch {
        // なければ、親をたどる
      }
      if (isLink && depth < 16) {
        const destination = path.resolve(path.dirname(current), fs.readlinkSync(current));
        return realPathOf(path.join(destination, ...rest.reverse()), depth + 1);
      }
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/** target が root の中（root 自身を含む）か。シンボリックリンクをたどった本当の場所で調べる */
export function isInsideDir(root, target) {
  const realRoot = realPathOf(root);
  const realTarget = realPathOf(path.isAbsolute(target) ? target : path.join(root, target));
  const relative = path.relative(realRoot, realTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * 許可の求め1件への答えを決める（決めるだけ。副作用はない）。
 * @returns {{ decision: object, outcome: string, summary: string }}
 *   outcome：managed（止める）、extension_permission（許可）、outside_write（拒む）、extension_management（拒む）、env_access（拒む）、approved（許可）
 */
export function decidePermission(request, invocation, { workDir }) {
  const summary = describeRequest(request);
  const managed = invocation?.promptRequest?.managedApprovalRequired ?? request?.managedApprovalRequired;
  if (managed === true) return { decision: { kind: 'no-result' }, outcome: 'managed', summary };
  if (request?.kind === 'extension-permission-access') return { decision: { kind: 'approve-once' }, outcome: 'extension_permission', summary };
  if (request?.kind === 'write') {
    const fileName = typeof request.fileName === 'string' ? request.fileName : '';
    if (fileName === '' || !isInsideDir(workDir, fileName)) {
      return {
        decision: { kind: 'reject', feedback: `この試験では、作業フォルダ（${workDir}）の外には書き込めません。作業フォルダの中に書いてください。` },
        outcome: 'outside_write',
        summary,
      };
    }
  }
  if (request?.kind === 'extension-management') {
    return { decision: { kind: 'reject', feedback: 'この試験では、エクステンションの管理（読み込み直しなど）はできません。' }, outcome: 'extension_management', summary };
  }
  if (request?.kind === 'extension-env-access') {
    return { decision: { kind: 'reject', feedback: 'この試験では、環境変数は渡せません。' }, outcome: 'env_access', summary };
  }
  return { decision: { kind: 'approve-once' }, outcome: 'approved', summary };
}

/**
 * onPermissionRequest に渡す関数を作る。
 * @param {object} args
 * @param {string} args.workDir 実行の作業フォルダ
 * @param {(info: { request: object, summary: string }) => void} args.onManaged 人の承認が要る求めが来たときに呼ぶ（EVAL を止める）
 * @returns {Function & { stats: object }} stats：答えの数と、拒んだ求めの一覧、エクステンションの権限の求めの一覧
 */
export function createPermissionHandler({ workDir, onManaged }) {
  const stats = { approved: 0, rejected: 0, managed: 0, rejections: [], extensionRequests: [] };
  const handler = async (request, invocation) => {
    let verdict;
    try {
      verdict = decidePermission(request, invocation, { workDir });
    } catch (error) {
      // 例外を投げると SDK が user-not-available で答える。何が起きたか分かるよう、拒む答えと理由にする
      verdict = {
        decision: { kind: 'reject', feedback: `この試験の仕組みが求めを判定できませんでした（${error?.message ?? error}）。` },
        outcome: 'judge_failed',
        summary: describeRequest(request),
      };
    }
    if (verdict.outcome === 'managed') {
      stats.managed += 1;
      try {
        onManaged?.({ request, summary: verdict.summary });
      } catch {
        // 止める処理の失敗で、ここから例外を投げない（SDK が user-not-available で答えてしまう）
      }
      // 答えない（人の確認に任せる）。試験は止まるので、この求めは残る
    } else if (verdict.decision.kind === 'reject') {
      stats.rejected += 1;
      if (stats.rejections.length < MAX_LISTED) stats.rejections.push({ kind: request?.kind ?? null, summary: verdict.summary, reason: verdict.outcome });
    } else {
      stats.approved += 1;
      if (verdict.outcome === 'extension_permission' && stats.extensionRequests.length < MAX_LISTED) {
        stats.extensionRequests.push({ name: request.extensionName ?? null, capabilities: request.capabilities ?? [] });
      }
    }
    return verdict.decision;
  };
  handler.stats = stats;
  return handler;
}

/**
 * onUserInputRequest に渡す関数を作る。いつも決まった返事を返す。
 * 選択肢だけを認める質問（allowFreeform が偽）には、返事の文では答えられないので、最初の選択肢で答える。
 * @returns {Function & { stats: object }} stats：質問の数と、質問の文の一覧
 */
export function createUserInputHandler() {
  const stats = { count: 0, questions: [] };
  const handler = async (request) => {
    stats.count += 1;
    if (stats.questions.length < MAX_LISTED) stats.questions.push(clip(request?.question, 300));
    if (request?.allowFreeform === false && Array.isArray(request.choices) && request.choices.length > 0) {
      return { answer: request.choices[0], wasFreeform: false };
    }
    return { answer: FIXED_ANSWER, wasFreeform: true };
  };
  handler.stats = stats;
  return handler;
}
