import { describe, expect, it } from 'vitest';
import {
  canDeleteShift,
  canDisableShift,
  isActiveAssignment,
} from '../src/modules/shift/shift.rules.js';
import {
  deriveDayType,
  eachDateInclusive,
} from '../src/modules/computation/computation.service.js';

describe('shift rules', () => {
  it('blocks disable when there is an active assignment', () => {
    expect(canDisableShift({ hasActiveAssignment: true }).ok).toBe(false);
    expect(canDisableShift({ hasActiveAssignment: false }).ok).toBe(true);
  });

  it('blocks delete when any assignment exists', () => {
    expect(canDeleteShift({ assignmentCount: 1 }).ok).toBe(false);
    expect(canDeleteShift({ assignmentCount: 0 }).ok).toBe(true);
  });

  it('treats open-ended and future end dates as active', () => {
    const today = new Date('2026-09-18T00:00:00Z');
    expect(isActiveAssignment(null, today)).toBe(true);
    expect(isActiveAssignment(new Date('2026-09-18T00:00:00Z'), today)).toBe(
      true,
    );
    expect(isActiveAssignment(new Date('2026-09-17T00:00:00Z'), today)).toBe(
      false,
    );
  });
});

describe('computation day type', () => {
  it('prefers gov make_up and holiday over weekday', () => {
    const fri = new Date('2026-03-20T00:00:00Z'); // Friday
    expect(deriveDayType(fri, 'make_up')).toBe('make_up');
    expect(deriveDayType(fri, 'holiday')).toBe('holiday');
    expect(deriveDayType(fri, null)).toBe('weekday');
  });

  it('maps Saturday to rest_day and Sunday to holiday when no gov row', () => {
    expect(deriveDayType(new Date('2026-03-21T00:00:00Z'), null)).toBe(
      'rest_day',
    );
    expect(deriveDayType(new Date('2026-03-22T00:00:00Z'), null)).toBe(
      'holiday',
    );
  });

  it('enumerates inclusive date range', () => {
    const dates = eachDateInclusive(
      new Date('2026-03-20T00:00:00Z'),
      new Date('2026-03-22T00:00:00Z'),
    );
    expect(dates.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-03-20',
      '2026-03-21',
      '2026-03-22',
    ]);
  });
});
