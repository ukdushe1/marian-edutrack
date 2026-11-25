import { describe, it, expect, vi } from 'vitest';
import { firestoreMock } from './firebaseMock';
vi.mock('firebase/firestore', () => firestoreMock());
vi.mock('../src/firebase/config', () => ({ db: {}, default: {} }));
vi.mock('react', () => ({ useEffect: () => {}, useState: (v) => [v, () => {}], useCallback: (f) => f }));

const { buildSchedule, analyseClass, explainAnalysis, shortHeading, passMark } = await import('../src/lib/termExam/classAnalysis');

// Made-up class: two girls, one boy; English (one paper) and A Level Maths (two papers)
const students = [
  { id: 'g1', surname: 'Alpha', firstName: 'Anne', gender: 'F' },
  { id: 'g2', surname: 'Beta', firstName: 'Beth', gender: 'F' },
  { id: 'b1', surname: 'Gamma', firstName: 'Carl', gender: 'M' },
];
const subjects = [
  { id: 'mat', code: '9709', name: 'Mathematics', papers: [{ id: 'p1', label: 'Pure P1' }, { id: 'p5', label: 'Stats 1 (P5)' }] },
  { id: 'eng', code: '0500', name: 'First Language English', papers: [{ id: 'e1', label: 'Exam' }] },
];
const S = (finalPct, grade) => ({ finalPct, grade });
const res = {
  students, subjects,
  byStudent: {
    g1: { subjects: { mat: S(80, 'A'), eng: S(70, 'B') }, overallAvg: 75, overallPos: 1, overallOutOf: 3 },
    g2: { subjects: { mat: S(55, 'C'), eng: S(45, 'D') }, overallAvg: 50, overallPos: 2, overallOutOf: 3 },
    b1: { subjects: { mat: S(30, 'E'), eng: S(null, 'X') }, overallAvg: 30, overallPos: 3, overallOutOf: 3 },
  },
};
const bands = [{ grade: 'A', min: 75 }, { grade: 'B', min: 65 }, { grade: 'C', min: 50 }, { grade: 'D', min: 40 }, { grade: 'E', min: 30 }, { grade: 'U', min: 0 }];

describe('class mark schedule', () => {
  const sch = buildSchedule(res);
  it('uses the school headings and order; one final mark per subject, no paper columns', () => {
    expect(sch.subjects.map((s) => s.heading)).toEqual(['ENG', 'MATHS']);
    expect(sch.subjects.every((s) => !('papers' in s))).toBe(true);
    expect(shortHeading({ code: '0580' })).toBe('MAT');
  });
  it('rows in the given order with marks, grades, average and position; class averages skip X', () => {
    expect(sch.rows.map((r) => [r.n, r.student.id, r.position])).toEqual([[1, 'g1', 1], [2, 'g2', 2], [3, 'b1', 3]]);
    expect(sch.rows[0].cells.mat).toEqual({ pct: 80, grade: 'A' });
    expect(sch.averages).toEqual({ eng: 57.5, mat: 55 });
  });
});

describe('results analysis by subject by grade', () => {
  const sch = buildSchedule(res);
  const a = analyseClass(res, bands, sch);
  it('counts grades, C or better, failing and pass rate per subject', () => {
    expect(passMark(bands)).toBe(50);
    const mat = a.subjects.find((s) => s.id === 'mat');
    expect(mat.counts).toEqual({ A: 1, B: 0, C: 1, D: 0, E: 1, U: 0 });
    expect([mat.pass, mat.fail, Math.round(mat.passRate)]).toEqual([2, 1, 67]);
    const eng = a.subjects.find((s) => s.id === 'eng');
    expect([eng.graded, eng.absent, eng.pass, eng.fail]).toEqual([2, 1, 1, 1]);
  });
  it('overall figures and the written analysis come from the same numbers', () => {
    expect([a.overall.entries, a.overall.pass]).toEqual([5, 3]);
    expect(a.overall.belowPass.map((s) => s.id)).toEqual(['b1']);
    expect(a.overall.girls.mean).toBe(62.5);
    const text = explainAnalysis('3D1', a, 3).join(' ');
    expect(text).toMatch(/3D1 has 3 learners/);
    expect(text).toMatch(/60% of subject results are at grade C or better \(3 of 5/);
    expect(text).toMatch(/Strongest subject: Mathematics/);
    expect(text).toMatch(/Top of the class: Anne Alpha \(75%\)/);
    expect(text).toMatch(/Girls average 62.5% and boys 30%/);
  });
});

describe('learner analysis', () => {
  it('compares one learner with the class and explains it', async () => {
    const { learnerAnalysis, explainLearner } = await import('../src/lib/termExam/classAnalysis');
    const withStats = { ...res, subjectStats: { mat: { average: 55, outOf: 3 }, eng: { average: 57.5, outOf: 2 } } };
    withStats.byStudent.g2.subjects.mat.position = 2;
    const a = learnerAnalysis(withStats, 'g2', bands);
    expect(a.rows.map((r) => [r.heading, r.pct, r.grade, r.diff])).toEqual([['ENG', 45, 'D', -12.5], ['MATHS', 55, 'C', 0]]);
    expect(a.summary).toMatchObject({ average: 50, position: 2, outOf: 3, passes: 1, marked: 2, above: 0, below: 1 });
    const text = explainLearner(students[1], a).join(' ');
    expect(text).toMatch(/Beth averages 50% across 2 subjects, placing 2 of 3/);
    expect(text).toMatch(/Needs most attention: First Language English — 45% \(grade D\), 12.5 points below/);
    expect(text).toMatch(/Below a pass in: First Language English \(45%\)/);
  });
});
