// 決まった値。

/** クリエイターの名前。ツールの名前の頭と、記録の置き場所に使う */
export const CREATOR_NAME = 'plugin-creator';

/** 質問の改善案を起票するリポジトリ（ユーザーの答え5。GitHub の名前の変更は、実装を main に取り込んだ後にユーザーが行う） */
export const ISSUE_REPOSITORY = 'imaeda-hub/plugin-creator';

/** gh issue create の待ち時間の上限（ミリ秒。generated-plugin-structure.md 4.11） */
export const GH_TIMEOUT_MS = 60_000;

/** コンパクションの後の差し込みの上限（バイト。hearing.md 8章：1KB 未満） */
export const INJECTION_MAX_BYTES = 1000;

/** 状態取得ツールが返す、最後の問答の件数（「最後の数件」） */
export const LAST_QA_COUNT = 5;

/** 作業の定義の案の置き場所（ユーザーの答え7）。パスの末尾がこれであること */
export const DRAFT_TASK_SUFFIX = '.plugin-creator-work/draft/task.json';
