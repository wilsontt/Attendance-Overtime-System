import { describe, expect, it } from 'vitest';
import {
  mapGovCsvRow,
  parseDgpaGovCalendarCsv,
  pickYearCsvUrl,
} from '../src/modules/calendar/govCalendarParse.js';

describe('govCalendarParse', () => {
  it('maps national holiday and Saturday work as make_up', () => {
    expect(
      mapGovCsvRow({
        dateRaw: '20260101',
        weekday: '四',
        isHoliday: '2',
        note: '開國紀念日',
      }),
    ).toEqual({
      date: '2026-01-01',
      dayType: 'holiday',
      name: '開國紀念日',
    });

    expect(
      mapGovCsvRow({
        dateRaw: '20260207',
        weekday: '六',
        isHoliday: '0',
        note: '補行上班',
      }),
    ).toEqual({
      date: '2026-02-07',
      dayType: 'make_up',
      name: '補行上班',
    });

    expect(
      mapGovCsvRow({
        dateRaw: '20260105',
        weekday: '一',
        isHoliday: '0',
        note: '',
      }),
    ).toBeNull();
  });

  it('parses dgpa CSV content', () => {
    const csv = [
      '西元日期,星期,是否放假,備註',
      '20260101,四,2,開國紀念日',
      '20260102,五,0,',
      '20260103,六,2,',
      '20260207,六,0,補行上班',
    ].join('\n');
    const days = parseDgpaGovCalendarCsv(csv);
    expect(days).toHaveLength(3);
    expect(days.map((d) => d.date)).toEqual([
      '2026-01-01',
      '2026-01-03',
      '2026-02-07',
    ]);
    expect(days[2]?.dayType).toBe('make_up');
  });

  it('picks ROC year CSV preferring 更新', () => {
    const url = pickYearCsvUrl(
      [
        {
          resourceDescription: '114年中華民國政府行政機關辦公日曆表',
          resourceDownloadUrl: 'http://a',
        },
        {
          resourceDescription: '114年中華民國政府行政機關辦公日曆表(1141020更新)',
          resourceDownloadUrl: 'http://b',
        },
        {
          resourceDescription: '114年中華民國政府行政機關辦公日曆表_Google行事曆專用',
          resourceDownloadUrl: 'http://g',
        },
      ],
      2025,
    );
    expect(url).toBe('http://b');
  });
});
