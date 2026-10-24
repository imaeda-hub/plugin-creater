// ヒアリングの記録の置き場所と読み書き（hearing.md 7.1、BLUEPRINT 4.4）。
//
//   <COPILOT_HOME（なければ ~/.copilot）>/plugin-data/plugin-creator/hearings/<セッションの番号>/
//     state.json     ヒアリングの状態のただ1つの元。エクステンションだけが書く。一時ファイルに書いてから名前を変えて置く
//     qa.jsonl       問答の記録。追記だけをする
//     results.json   _results で知らされた試験の結果のファイルの場所
//
// 自動では消さない（ユーザーの答え6）。作業フォルダには何も作らない（REQ-021）。
// 外へ送らない。記録にはユーザーの仕事の中身が入る。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CREATOR_NAME } from './constants.mjs';

/** COPILOT_HOME（環境変数）か ~/.copilot */
export function copilotHome(env = process.env, homedir = os.homedir()) {
  return env.COPILOT_HOME ? env.COPILOT_HOME : path.join(homedir, '.copilot');
}

/** フォルダの名前にできる形にする。英数字・ドット・ハイフン・アンダースコア以外は _ にする */
export function safeSegment(value) {
  const text = String(value ?? '').replace(/[^\w.-]/g, '_');
  return text === '' || /^\.+$/.test(text) ? '_' : text;
}

export function hearingDir(home, sessionId) {
  return path.join(home, 'plugin-data', CREATOR_NAME, 'hearings', safeSegment(sessionId));
}

/** 記録のファイルを読めなかったとき。上書きして消してしまわないよう、書く側はこれを見て断る */
export class RecordUnreadable extends Error {
  constructor(file, cause) {
    super(`お話を聞くことの記録（${file}）を読めません。ファイルを確かめてください。${cause ? `（${cause}）` : ''}`);
    this.name = 'RecordUnreadable';
    this.file = file;
  }
}

function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temp, file);
  } catch (error) {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // 一時ファイルを消せなくても、元の失敗を返す
    }
    throw error;
  }
}

function readJson(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new RecordUnreadable(file, error.message);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new RecordUnreadable(file, error.message);
  }
}

/**
 * このセッションの記録の置き場所を扱う。
 * @param {object} options
 * @param {string} options.home COPILOT_HOME
 * @param {string} options.sessionId セッションの番号
 */
export function createStore({ home, sessionId }) {
  const dir = hearingDir(home, sessionId);
  const statePath = path.join(dir, 'state.json');
  const qaPath = path.join(dir, 'qa.jsonl');
  const resultsPath = path.join(dir, 'results.json');

  return {
    dir,
    statePath,
    qaPath,
    resultsPath,

    /** state.json を読む。なければ null。壊れていれば RecordUnreadable */
    readState: () => readJson(statePath),
    writeState: (state) => writeJsonAtomic(statePath, state),

    /** 問答を1行追記する。ヒアリングの最中の記録のフォルダがすでにあるときだけ呼ぶ */
    appendQa(entry) {
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(qaPath, `${JSON.stringify(entry)}\n`, 'utf8');
    },

    /** 問答の記録のすべて。書きかけの行など、読めない行は飛ばす */
    readQa() {
      let text;
      try {
        text = fs.readFileSync(qaPath, 'utf8');
      } catch {
        return [];
      }
      const entries = [];
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          entries.push(JSON.parse(line));
        } catch {
          // 書きかけの行
        }
      }
      return entries;
    },

    /** _results で知らされたファイルの場所。なければ空 */
    readResults() {
      try {
        const value = readJson(resultsPath);
        return Array.isArray(value?.paths) ? value.paths.filter((p) => typeof p === 'string') : [];
      } catch {
        return [];
      }
    },
    writeResults: (paths) => writeJsonAtomic(resultsPath, { paths }),
  };
}
