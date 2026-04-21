/**
 * 加班理由輸出格式化工具。
 *
 * 目前只供 PDF / 列印流程使用，將半形英數、符號與空白轉為對應全型字元。
 */

const ASCII_PRINTABLE_START = 0x21;
const ASCII_PRINTABLE_END = 0x7e;
const FULLWIDTH_OFFSET = 0xfee0;
const FULLWIDTH_SPACE = '\u3000';

/**
 * 將加班理由中的半形 ASCII 字元轉為全型。
 *
 * - 空白 `' '` 轉為全形空白 `\u3000`
 * - 可列印 ASCII（`!` ~ `~`）轉為對應全型字元
 * - 非 ASCII 字元（例如中文）保持原樣
 */
export function normalizeOvertimeReasonForPrint(reason: string): string {
  return Array.from(reason || '')
    .map((char) => {
      if (char === ' ') {
        return FULLWIDTH_SPACE;
      }

      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) {
        return char;
      }

      if (codePoint >= ASCII_PRINTABLE_START && codePoint <= ASCII_PRINTABLE_END) {
        return String.fromCodePoint(codePoint + FULLWIDTH_OFFSET);
      }

      return char;
    })
    .join('');
}
