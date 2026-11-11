import { describe, it, expect } from 'vitest';
import { gradeFor, rank, examPercent, finalPercent, computeForm, averagePercent } from '../src/lib/termExam/results';

const bands = [{ grade: 'A', min: 75 }, { grade: 'B', min: 65 }, { grade: 'C', min: 50 }, { grade: 'D', min: 40 }, { grade: 'E', min: 30 }, { grade: 'U', min: 0 }];
const P = [{ id: 'p1', maxMark: 60 }, { id: 'p2', maxMark: 40 }];

describe('grades and ranking', () => {
  it('applies % bands', () => {
    expect(gradeFor(75, bands)).toBe('A');
    expect(gradeFor(74.9, bands)).toBe('B');
    expect(gradeFor(0, bands)).toBe('U');
    expect(gradeFor(null, bands)).toBe('X');
  });
  it('shares positions for equal scores at 1 decimal (1, 2, 2, 4) and counts only ranked', () => {
    const r = rank([{ id: 'a', score: 80 }, { id: 'b', score: 70 }, { id: 'c', score: 70.04 }, { id: 'd', score: 60 }, { id: 'e', score: null }]);
    expect(r.positions).toEqual({ a: 1, b: 2, c: 2, d: 4 });
    expect(r.outOf).toBe(4);
  });
});

describe('exam % rules', () => {
  it('adds papers', () => expect(examPercent(P, { p1: 30, p2: 20 }, {}).examPct).toBe(50));
  it('unexcused absence scores 0', () => expect(examPercent(P, { p1: 30 }, { p2: 'absent' }).examPct).toBe(30));
  it('malpractice scores 0 and is flagged', () => {
    const r = examPercent(P, { p1: 60, p2: 40 }, { p2: 'malpractice' });
    expect(r.examPct).toBe(60);
    expect(r.flags.map((f) => f.type)).toContain('malpractice');
  });
  it('a sick paper is left out', () => expect(examPercent(P, { p1: 30 }, { p2: 'sick' }).examPct).toBe(50));
  it('every paper validly missed → X', () => {
    const r = examPercent(P, {}, { p1: 'sick', p2: 'excused' });
    expect(r).toMatchObject({ x: true, examPct: null });
  });
  it('flags an unmarked paper', () => expect(examPercent(P, { p1: 30 }, {}).flags.map((f) => f.type)).toContain('unmarked'));
});

describe('final % and coursework', () => {
  it('exam only', () => expect(finalPercent(62, null, { mode: 'exam' }).finalPct).toBe(62));
  it('70/30 split', () => expect(finalPercent(60, 80, { mode: 'examCoursework', exam: 70, coursework: 30 }).finalPct).toBeCloseTo(66));
  it('missing required coursework is flagged, never counted as 100% exam', () => {
    expect(finalPercent(60, null, { mode: 'examCoursework', exam: 70, coursework: 30 })).toEqual({ finalPct: null, flag: 'missingCoursework' });
  });
  it('coursework average %', () => expect(averagePercent([{ raw: 5, maxMark: 10 }, { raw: 20, maxMark: 20 }, { raw: null, maxMark: 10 }])).toBe(75));
});

describe('whole form', () => {
  const out = computeForm({
    students: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    subjects: [
      { id: 'math', weights: { mode: 'exam' }, papers: [{ id: 'm1', maxMark: 100 }] },
      { id: 'sci', weights: { mode: 'examCoursework', exam: 70, coursework: 30 }, papers: [{ id: 's1', maxMark: 50 }] },
    ],
    takes: { A: ['math', 'sci'], B: ['math', 'sci'], C: ['math', 'sci'], D: ['math'] },
    marks: { math: { A: { m1: 80 }, B: { m1: 70 }, C: { m1: 70 }, D: { m1: 90 } }, sci: { A: { s1: 40 }, B: { s1: 25 }, C: { s1: 30 } } },
    sittings: { C: { s1: 'sick' } },
    coursework: { sci: { A: 90, B: 50 } },
    bands, minSubjects: 2,
  });
  it('combines exam and coursework', () => expect(out.byStudent.A.subjects.sci.finalPct).toBeCloseTo(83));
  it('X is left out of positions', () => expect(out.byStudent.C.subjects.sci).toMatchObject({ grade: 'X', position: null }));
  it('positions within the subject', () => {
    expect([out.byStudent.D, out.byStudent.A, out.byStudent.B, out.byStudent.C].map((s) => s.subjects.math.position)).toEqual([1, 2, 3, 3]);
  });
  it('overall position only with the minimum number of subjects', () => {
    expect(out.byStudent.D.overallPos).toBeNull();
    expect(out.byStudent.A.overallPos).toBe(1);
    expect(out.byStudent.A.overallOutOf).toBe(2);
  });
});
