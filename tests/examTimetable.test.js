import { describe, it, expect } from 'vitest';
import { SESSIONS, SLOTS } from '../src/lib/examTimetable/endOfYear2026';

describe('End of Year 2026 timetable data', () => {
  it('has 65 sessions over Mon 16 – Fri 20 Nov', () => {
    expect(SESSIONS).toHaveLength(65);
    expect(new Set(SESSIONS.map((s) => s.date))).toEqual(new Set(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']));
  });
  it('ids are unique and stable, so a re-import overwrites', () => {
    expect(new Set(SESSIONS.map((s) => s.id)).size).toBe(SESSIONS.length);
    expect(SESSIONS[0].id).toBe('eoy2026-001');
  });
  it('every session has a known slot, a form, a subject and invigilators', () => {
    const starts = Object.values(SLOTS).map((x) => x.start);
    for (const s of SESSIONS) {
      expect(starts).toContain(s.start);
      expect(s.form).toMatch(/^F\d/);
      expect(s.subject).toBeTruthy();
      expect(s.invigilatorNames.length).toBeGreaterThan(0);
      expect(s.duration === null || (s.duration >= 60 && s.duration <= 120)).toBe(true);
    }
  });
});
