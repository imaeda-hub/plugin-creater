// クリエイターのエクステンションの入口。Copilot CLI とつなぐだけにする（joinSession）。
// ツール、フック、記録、画面は、Copilot CLI に依らない creator.mjs とその部品にある。
//
// - 標準出力は JSON-RPC の通り道なので、console.log は使わない。
// - @github/copilot-sdk/extension は、Copilot CLI が自分の同梱の SDK に向ける。npm で入れない。
// - 確認を省くツールとフックを登録するので、Copilot CLI は読み込みのときに確認を出す。
//   許可の求めには答えない（onPermissionRequest は登録しない）。
// - 画面のサーバーはこのプロセスの中で動く。Copilot CLI を終えると、このプロセスと一緒に終わる。

import { joinSession } from '@github/copilot-sdk/extension';

import { startCreator } from './creator.mjs';

// 失敗でプロセスが落ちると、ツールが全部使えなくなる。知らせだけ残して続ける（標準エラー）。
process.on('unhandledRejection', (reason) => console.error('[plugin-creator] unhandledRejection:', reason));
process.on('uncaughtException', (error) => console.error('[plugin-creator] uncaughtException:', error));

await startCreator({ joinSession });
