// 試験用の docx・xlsx・pptx を作る。外部のパッケージを使わず、zip を自分で書く（node:zlib）。
// 中身は、Word・Excel・PowerPoint が書く形に近づけてある（文字が複数の run に分かれる、共有文字列、順番の定義、ノートなど）。
// 本物の Office の道具（python-docx、openpyxl、python-pptx）で作ったファイルでも、同じ文字が取れることは、手で確かめた。

import zlib from 'node:zlib';

// ---- zip を書く ----------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * zip を作る。
 * @param {Record<string, string|Buffer>} files ファイル名 → 中身
 * @param {{ stored?: string[], encrypted?: string[] }} [options] stored：圧縮しない名前、encrypted：暗号化の印を付ける名前
 */
export function makeZip(files, { stored = [], encrypted = [] } = {}) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const method = stored.includes(name) ? 0 : 8;
    const packed = method === 0 ? data : zlib.deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const flags = 0x0800 | (encrypted.includes(name) ? 1 : 0);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(flags, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + packed.length;
  }
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuffer, end]);
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
const A = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"';

// ---- docx ------------------------------------------------------------------------------------------

/** 見本の docx。本文（段落、複数の run、タブ、改行、表、テキストボックス）、ヘッダー、フッター、脚注、コメント */
export function sampleDocx() {
  const run = (text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
  const body = [
    `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run('週報の書き方')}</w:p>`,
    `<w:p>${run('毎週')}${run('金曜日の17時までに')}${run('提出する。')}</w:p>`,
    `<w:p>${run('提出先は 営業部 &amp; 総務部（')}<w:r><w:rPr><w:b/></w:rPr><w:t>田中さん</w:t></w:r>${run('）')}</w:p>`,
    `<w:p><w:r><w:t>項目</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>内容</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>改行の次の行</w:t></w:r></w:p>`,
    '<w:tbl><w:tr>' +
      `<w:tc><w:p>${run('日付')}</w:p></w:tc><w:tc><w:p>${run('実績')}</w:p><w:p>${run('（2段目）')}</w:p></w:tc>` +
      '</w:tr><w:tr>' +
      `<w:tc><w:p>${run('月')}</w:p></w:tc><w:tc><w:p>${run('資料作成')}</w:p></w:tc>` +
      '</w:tr></w:tbl>',
    // テキストボックスは、mc:Choice と mc:Fallback に同じ文字が2回入る
    '<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx><w:txbxContent><w:p><w:r><w:t>枠の中の注意書き</w:t></w:r></w:p></w:txbxContent></wps:txbx></w:drawing></mc:Choice>' +
      '<mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>枠の中の注意書き</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>',
    `<w:p><w:del w:id="1"><w:r><w:delText>消された文字</w:delText></w:r></w:del>${run('残った文字')}</w:p>`,
    `<w:p>${run('&#x3042;&#12356; &lt;タグ&gt; &quot;引用&quot;')}</w:p>`,
  ].join('');
  return makeZip({
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    '_rels/.rels': `${XML}<Relationships ${REL}/>`,
    'word/document.xml': `${XML}<w:document ${W}><w:body>${body}</w:body></w:document>`,
    'word/header1.xml': `${XML}<w:hdr ${W}><w:p>${run('ヘッダーの会社名')}</w:p></w:hdr>`,
    'word/footer1.xml': `${XML}<w:ftr ${W}><w:p>${run('フッターのページ')}</w:p></w:ftr>`,
    'word/footnotes.xml': `${XML}<w:footnotes ${W}><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:id="1"><w:p>${run('脚注の文字')}</w:p></w:footnote></w:footnotes>`,
    'word/comments.xml': `${XML}<w:comments ${W}><w:comment w:id="0"><w:p>${run('コメントの文字')}</w:p></w:comment></w:comments>`,
  });
}

// ---- xlsx ------------------------------------------------------------------------------------------

/** 見本の xlsx。共有文字列（ふりがな付き、書式つき）、数、文字、真偽、式、インライン文字列、列の飛び、非表示のシート */
export function sampleXlsx() {
  const shared = [
    '<si><t>項目</t></si>',
    '<si><r><rPr><b/></rPr><t>金</t></r><r><t>額</t></r><rPh sb="0" eb="2"><t>キンガク</t></rPh></si>',
    '<si><t xml:space="preserve">交通費 &amp; 宿泊費</t></si>',
    '<si><t>合計</t></si>',
  ].join('');
  const sheet1 =
    '<sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>備考（インライン）</t></is></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1200</v></c><c r="C2" t="b"><v>1</v></c></row>' +
    '<row r="3"/>' +
    '<row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4"><f>SUM(B2:B2)</f><v>1200</v></c><c r="C4" t="str"><f>"計"&amp;"です"</f><v>計です</v></c></row>' +
    '</sheetData>';
  const sheet2 = '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><r><t>隠し</t></r><r><t>シート</t></r></is></c></row></sheetData>';
  return makeZip({
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    'xl/workbook.xml': `${XML}<workbook ${S}><sheets><sheet name="集計 &amp; 明細" sheetId="1" r:id="rId1"/><sheet name="隠し" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML}<Relationships ${REL}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>`,
    'xl/sharedStrings.xml': `${XML}<sst ${S} count="4" uniqueCount="4">${shared}</sst>`,
    'xl/worksheets/sheet1.xml': `${XML}<worksheet ${S}>${sheet1}</worksheet>`,
    'xl/worksheets/sheet2.xml': `${XML}<worksheet ${S}>${sheet2}</worksheet>`,
  });
}

// ---- pptx ------------------------------------------------------------------------------------------

/** 見本の pptx。スライドの順番の定義が、ファイルの番号と違う（slide2 が1枚目）。表とノートつき */
export function samplePptx() {
  const para = (text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`;
  const slide = (shapes) => `${XML}<p:sld ${A}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;
  const shape = (paras) => `<p:sp><p:txBody>${paras}</p:txBody></p:sp>`;
  const table =
    '<p:graphicFrame><a:graphic><a:graphicData><a:tbl>' +
    `<a:tr><a:tc><a:txBody>${para('見出しA')}</a:txBody></a:tc><a:tc><a:txBody>${para('見出しB')}</a:txBody></a:tc></a:tr>` +
    `<a:tr><a:tc><a:txBody>${para('値A')}</a:txBody></a:tc><a:tc><a:txBody>${para('値B')}</a:txBody></a:tc></a:tr>` +
    '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>';
  const notes = (text) => `${XML}<p:notes ${A}><p:cSld><p:spTree>${shape(para(text))}</p:spTree></p:cSld></p:notes>`;
  const rels = (items) => `${XML}<Relationships ${REL}>${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`;
  return makeZip({
    '[Content_Types].xml': `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    'ppt/presentation.xml': `${XML}<p:presentation ${A}><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': rels([
      ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
      ['rId2', 'slide', 'slides/slide1.xml'],
      ['rId3', 'slide', 'slides/slide2.xml'],
    ]),
    // ファイルの番号は slide1、slide2 だが、スライドの順番は slide2 → slide1
    'ppt/slides/slide1.xml': slide(shape(para('二枚目のタイトル') + para('二枚目の本文')) + table),
    'ppt/slides/slide2.xml': slide(shape(para('一枚目のタイトル') + '<a:p><a:r><a:t>1行目</a:t></a:r><a:br/><a:r><a:t>2行目</a:t></a:r></a:p>')),
    'ppt/slides/_rels/slide2.xml.rels': rels([['rId1', 'notesSlide', '../notesSlides/notesSlide1.xml']]),
    'ppt/notesSlides/notesSlide1.xml': notes('一枚目のノート'),
    'ppt/slideMasters/slideMaster1.xml': slide(shape(para('マスターの文字（出さない）'))),
  });
}
