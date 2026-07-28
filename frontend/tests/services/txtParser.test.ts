import { describe, expect, it } from 'vitest';
import { parseTxtContent } from '../../src/services/txtParser';

describe('parseTxtContent', () => {
  it('should parse clock out time when approval status is 符合', () => {
    const content = `
員工姓名               歸屬日期/班別      考勤別/數量/備註/日期時間起迄                             標準時間             刷卡日期 時間  主管核定
================================================================================================================================================
200038 黃琨峻          1150407/1                                                                    上班/0407 09:00      1150407 09:27    異常
                                                                                                    下班/0407 18:00      1150407 19:05    符合
                        -------------------------------------------------------------------------------------------------------------------------
`;

    const records = parseTxtContent(content);

    expect(records).toHaveLength(1);
    expect(records[0].clockIn).toBe('09:27');
    expect(records[0].clockOut).toBe('19:05');
  });

  it('should correctly assign clock out time when clock in is missing', () => {
    const content = `
員工姓名               歸屬日期/班別      考勤別/數量/備註/日期時間起迄                             標準時間             刷卡日期 時間  主管核定
================================================================================================================================================
100057 鄒東良          1150325/1                                                                    上班/0325 09:00                         異常
                                                                                                    下班/0325 18:00      1150325 19:08    正常
                        -------------------------------------------------------------------------------------------------------------------------
`;

    const records = parseTxtContent(content);

    expect(records).toHaveLength(1);
    expect(records[0].clockIn).toBe('');
    expect(records[0].clockOut).toBe('19:08');
  });
});
