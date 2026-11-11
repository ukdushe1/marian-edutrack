/**
 * Test-data generator + exam module end-to-end, on a made-up class list.
 * Rebuilds what the app's loader writes, then runs the real results pipeline.
 */
import { describe, it, expect, vi } from 'vitest';
import { firestoreMock } from './firebaseMock';
import { fakeMarkListCsv } from './fixtures/fakeClass';
vi.mock('firebase/firestore', () => firestoreMock());
vi.mock('../src/firebase/config', () => ({ db: {}, default: {} }));
vi.mock('react', () => ({ useEffect: () => {}, useState: (v) => [v, () => {}], useCallback: (f) => f }));
const { buildTestDocs, parseMarkListCsv } = await import('../src/lib/testData/classTestData');
const { formResults } = await import('../src/lib/termExam/compute');
const { stageStatus, windowSubjects } = await import('../src/lib/termExam/model');

const parsed = parseMarkListCsv(fakeMarkListCsv());
const list = buildTestDocs({ uid: 'ME', students: parsed.students });
const docs = Object.fromEntries(list);
const col = (name) => Object.entries(docs).filter(([p]) => p.startsWith(`${name}/`) && p.split('/').length === 2).map(([p, d]) => ({ id: p.split('/')[1], ...d }));
const groups = col('teachingGroups'), syllabi = col('syllabi'), students = col('students');

function load(winId) {
  const win = { id: winId, ...docs[`examWindows/${winId}`] };
  const papers = col('examPapers').filter((p) => p.windowId === winId);
  const sittings = {};
  col('examSittings').filter((x) => x.windowId === winId).forEach((x) => { (sittings[x.studentId] ??= {})[x.paperId] = x.status; });
  const assessments = {}, marks = {};
  for (const p of papers) for (const g of groups) {
    const a = docs[`teachingGroups/${g.id}/assessments/exam_${p.id}`];
    if (a) assessments[`${p.id}|${g.id}`] = a;
    marks[`${p.id}|${g.id}`] = docs[`teachingGroups/${g.id}/assessments/exam_${p.id}/marks/entries`]?.entries ?? {};
  }
  const reports = Object.fromEntries(Object.entries(docs).filter(([p, d]) => p.startsWith('reports/') && d.termId === win.termId).map(([p, d]) => [p.split('/')[1], d]));
  const cards = {};
  Object.values(docs).filter((d) => d.type === 'termCard' && d.windowId === winId).forEach((d) => { cards[d.studentId] = d; });
  return { win, papers, students, groups, syllabi, sittings, assessments, marks, reports, cards, forms: [{ id: 'test3d1_class', name: '3D1' }], users: [] };
}

describe('mark-list CSV', () => {
  it('parses 31 students', () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.students).toHaveLength(31);
  });
  it('rejects bad rows and headers', () => {
    expect(parseMarkListCsv('name,x').errors).toHaveLength(1);
    const bad = parseMarkListCsv(`${fakeMarkListCsv(0)}\nA,B,11,1,1,1,1,1,1,1,1,1,1,1,1,1\nC,D,1,1`);
    expect(bad.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('generated data', () => {
  it('is unique, tagged and prefixed', () => {
    const paths = list.map(([p]) => p);
    expect(new Set(paths).size).toBe(paths.length);
    expect(list.every(([, d]) => d.testData === true)).toBe(true);
  });
  it('has 6 subjects and 7 classes; Maths sets split the form', () => {
    expect(syllabi).toHaveLength(6);
    expect(groups).toHaveLength(7);
    const a = groups.find((g) => g.id.endsWith('math_a')), b = groups.find((g) => g.id.endsWith('math_b'));
    expect(a.studentIds.length + b.studentIds.length).toBe(31);
  });
  it('keeps the uploaded science marks', () => {
    const e = docs['teachingGroups/test3d1_group/assessments/test3d1_ex1/marks/entries'].entries;
    expect(e.test3d1_s01.raw).toBe(parsed.students[0][2][0]);
  });
  it('per-question marks add up to totals', () => {
    for (const [p, d] of Object.entries(docs)) if (p.includes('/assessments/exam_') && p.endsWith('/entries')) {
      for (const e of Object.values(d.entries)) expect(e.raw).toBe(Object.values(e.perQuestion).reduce((x, y) => x + y, 0));
    }
  });
  it('consented guardians only ever get the tester number', () => {
    const g = buildTestDocs({ uid: 'ME', students: parsed.students, testNumber: '263771234567' }).filter(([p]) => p.startsWith('guardians/')).map(([, d]) => d);
    expect(g.filter((x) => x.consentWhatsApp).every((x) => x.whatsappNumber === '+263771234567')).toBe(true);
    expect(g.filter((x) => !x.consentWhatsApp).every((x) => !x.whatsappNumber)).toBe(true);
  });
});

describe('last term (published)', () => {
  const prev = load('test3d1_win_prev');
  const res = formResults(prev, 'test3d1_class', {});
  it('snapshots equal a fresh recalculation', () => {
    for (const s of students) {
      const snap = docs[`resultSnapshots/test3d1_win_prev_${s.id}`];
      expect(snap.overallPos).toBe(res.byStudent[s.id].overallPos);
      expect(snap.overallAvg).toBeCloseTo(res.byStudent[s.id].overallAvg, 9);
    }
  });
  it('sick → X; unexcused absence → 0', () => {
    expect(res.byStudent.test3d1_s04.subjects.test3d1_syl_math.grade).toBe('X');
    expect(res.byStudent.test3d1_s10.subjects.test3d1_syl_math.examPct).toBe(0);
  });
  it('every stage done for every subject', () => {
    for (const s of windowSubjects(prev)) for (const k of ['papers', 'timetable', 'sitting', 'marking', 'moderation', 'results', 'comments', 'approval', 'published']) {
      expect(stageStatus(prev, s.id, k), `${s.code} ${k}`).toBe('done');
    }
  });
});

describe('this term (mixed stages)', () => {
  const cur = load('test3d1_win');
  const st = (code, k) => stageStatus(cur, windowSubjects(cur).find((s) => s.code === code).id, k);
  it('control panel states', () => {
    expect(st('4005', 'marking')).toBe('done');
    expect(st('4024', 'moderation')).toBe('progress');
    expect(st('1123', 'marking')).toBe('late');
    expect(st('2217', 'marking')).toBe('late');
    expect(st('2147', 'papers')).toBe('late');
    expect(st('2210', 'papers')).toBe('done');
    expect(st('2210', 'sitting')).not.toBe('done');
  });
  it('science results use 70% exam + 30% coursework', () => {
    const cw = { test3d1_syllabus: { test3d1_s01: 80 } };
    const r = formResults(cur, 'test3d1_class', cw).byStudent.test3d1_s01.subjects.test3d1_syllabus;
    expect(r.finalPct).toBeCloseTo(r.examPct * 0.7 + 80 * 0.3, 9);
  });
});
