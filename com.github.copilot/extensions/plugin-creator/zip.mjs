// zip の読み取り（読むだけ）。docx・xlsx・pptx は zip なので、文書をテキストにするツールが使う。
// 外部のパッケージを使わず、Node.js の標準の部品（node:zlib）だけで読む。
// 対応：保存（無圧縮）と deflate。対応しない：暗号化、zip64、分割。

import zlib from 'node:zlib';

export class ZipError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZipError';
  }
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

/** 1つのファイルを開いたときの大きさの上限（zip 爆弾を避けるため）。バイト */
export const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

/** zip の目次（中央ディレクトリ）を読む。@returns {Map<string, object>} ファイル名 → 目次の行 */
export function readZipIndex(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new ZipError('zip として読めません（小さすぎます）');
  let eocd = -1;
  const lowest = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= lowest; i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('zip として読めません（終わりの印がありません）');

  const total = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (total === 0xffff || centralOffset === 0xffffffff) throw new ZipError('zip64 の形式には対応していません');

  const index = new Map();
  let pos = centralOffset;
  for (let n = 0; n < total; n += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== SIG_CENTRAL) throw new ZipError('zip の目次が壊れています');
    const flags = buffer.readUInt16LE(pos + 8);
    const method = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const size = buffer.readUInt32LE(pos + 24);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    if (pos + 46 + nameLength > buffer.length) throw new ZipError('zip の目次が壊れています');
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength);
    index.set(name, { name, flags, method, compressedSize, size, localOffset });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return index;
}

/** 目次の行 1 つの中身を取り出す */
export function readZipEntry(buffer, entry, maxBytes = MAX_ENTRY_BYTES) {
  if (entry.flags & 1) throw new ZipError(`暗号化されていて読めません：${entry.name}`);
  const at = entry.localOffset;
  if (at + 30 > buffer.length || buffer.readUInt32LE(at) !== SIG_LOCAL) throw new ZipError(`zip の中のファイルが壊れています：${entry.name}`);
  const start = at + 30 + buffer.readUInt16LE(at + 26) + buffer.readUInt16LE(at + 28);
  const end = start + entry.compressedSize;
  if (end > buffer.length) throw new ZipError(`zip の中のファイルが壊れています：${entry.name}`);
  const data = buffer.subarray(start, end);
  if (entry.method === 0) {
    if (data.length > maxBytes) throw new ZipError(`大きすぎて読めません：${entry.name}`);
    return Buffer.from(data);
  }
  if (entry.method === 8) {
    try {
      return zlib.inflateRawSync(data, { maxOutputLength: maxBytes });
    } catch (error) {
      if (error.code === 'ERR_BUFFER_TOO_LARGE') throw new ZipError(`大きすぎて読めません：${entry.name}`);
      throw new ZipError(`zip の中のファイルを開けません：${entry.name}`);
    }
  }
  throw new ZipError(`対応していない圧縮の形式です：${entry.name}`);
}
