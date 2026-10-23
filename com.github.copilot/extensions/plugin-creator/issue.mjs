// 質問の改善案の起票（creator-structure.md 4.5、generated-plugin-structure.md 4.11）。
//
// - gh issue create --repo imaeda-hub/plugin-creator を、シェルを通さず動かす。題は引数の配列に、本文は標準入力で渡す。
//   題や本文がコマンドの一部として解釈されないようにするため。
// - 起票は gh のログイン（gh 自身が持つ資格情報）に任せる。環境変数（GITHUB_TOKEN など）を求めない。
// - 60秒の上限を付ける。上限を超えたときは、送信は済んで返事だけ遅れたことがあるので、起票したか分からないと示す。
// - gh がないとき、ログインしていないときは、入れ方とログインのしかたを返す。

import { spawn } from 'node:child_process';

import { GH_TIMEOUT_MS, ISSUE_REPOSITORY } from './constants.mjs';

const INSTALL_HELP =
  'gh（GitHub の公式のコマンド）が見つかりません。https://cli.github.com/ から入れて、入れたら「gh auth login」でログインしてください。そのあと、もう一度承認して起票します。';
const LOGIN_HELP =
  'gh でログインしていないため、起票できません。ターミナルで「gh auth login」を実行してログインしてください。そのあと、もう一度承認して起票します。';

export class IssueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IssueError';
  }
}

/** gh の引数。題は --title=<題> の形で渡す（題が - で始まっても、別の旗と取り違えられない） */
export function ghArguments(title, repository = ISSUE_REPOSITORY) {
  return ['issue', 'create', '--repo', repository, `--title=${title}`, '--body-file', '-'];
}

/**
 * gh を動かす（シェルを通さない）。標準入力に本文を書いて閉じる。
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string, timedOut: boolean, notFound: boolean }>}
 */
export function runGh(args, input, { timeoutMs = GH_TIMEOUT_MS, command = 'gh', env = process.env } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut, notFound: false, ...result });
    };
    let child;
    try {
      child = spawn(command, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'], env, windowsHide: true });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: String(error.message), timedOut: false, notFound: error.code === 'ENOENT' });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // すでに終わっていた
      }
      // gh が起こした別のプロセスが出力の管を開けたままでも、待たずに返す
      child.stdout.destroy();
      child.stderr.destroy();
      done({ code: null });
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => done({ code: null, stderr: stderr || String(error.message), notFound: error.code === 'ENOENT' }));
    child.on('close', (code) => done({ code }));
    child.stdin.on('error', () => {
      // 終わった後の書き込みの失敗は、close の結果で扱う
    });
    child.stdin.end(input);
  });
}

const looksLikeLoginProblem = (text) =>
  /gh auth login|not logged in|authentication required|HTTP 401|bad credentials|requires authentication|GH_TOKEN|GITHUB_TOKEN/i.test(text);

/**
 * 起票する。承認された案ごとに呼ぶ。
 * @param {{ title: string, body: string }} issue
 * @param {object} [options]
 * @param {typeof runGh} [options.run] gh を動かす関数（試験で差し替える）
 * @returns {Promise<string>} ユーザーに見せる 1 行（できた Issue の URL を含む）
 */
export async function fileIssue({ title, body }, { run = runGh, repository = ISSUE_REPOSITORY } = {}) {
  const t = typeof title === 'string' ? title.trim() : '';
  const b = typeof body === 'string' ? body : '';
  if (!t) throw new IssueError('Issue の題が空です。');
  if (!b.trim()) throw new IssueError('Issue の本文が空です。');
  if ([...t].length > 256) throw new IssueError('Issue の題が長すぎます（256文字まで）。');
  if (/[\r\n]/.test(t)) throw new IssueError('Issue の題は1行にしてください。');

  const result = await run(ghArguments(t, repository), b);
  if (result.notFound) throw new IssueError(INSTALL_HELP);
  if (result.timedOut) {
    throw new IssueError(
      `起票の返事が${Math.round(GH_TIMEOUT_MS / 1000)}秒たっても来ませんでした。起票されたか分かりません。${repository} の Issue の一覧を確かめてから、必要なら、もう一度承認してください。`,
    );
  }
  const detail = `${result.stderr}\n${result.stdout}`.trim();
  if (result.code !== 0) {
    if (looksLikeLoginProblem(detail)) throw new IssueError(LOGIN_HELP);
    const reason = detail.split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 300);
    throw new IssueError(`起票できませんでした（gh の終了コード ${result.code}）。${reason ? `理由：${reason}` : ''}`.trim());
  }
  const url = /https?:\/\/\S+/.exec(result.stdout)?.[0];
  return url ? `起票しました：${url}` : '起票しました。';
}
