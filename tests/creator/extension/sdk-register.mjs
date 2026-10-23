// 試験の道具：--import で読み込む。エクステンションの @github/copilot-sdk/extension を、試験が指す SDK に向ける。
// Copilot CLI が、エクステンションのプロセスを起動するときに行うのと同じ（preloads/extension_sdk_resolver.mjs）。
import { register } from 'node:module';

register(new URL('./sdk-resolver.mjs', import.meta.url));
