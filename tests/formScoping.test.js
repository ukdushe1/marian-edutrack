import { describe, it, expect, vi } from 'vitest';
import { firestoreMock } from './firebaseMock';
vi.mock('firebase/firestore', () => firestoreMock());
vi.mock('../src/firebase/config', () => ({ db: {}, default: {} }));
vi.mock('react', () => ({ useEffect: () => {}, useState: (v) => [v, () => {}], useCallback: (f) => f }));

const { paperForClass, paperGroups, paperCandidates, paperLabel } = await import('../src/lib/termExam/model');
const { formResults } = await import('../src/lib/termExam/compute');
const { planTimetableImport, classesForForm } = await import('../src/lib/termExam/timetableImport');

// Geography (one syllabus) taught in F1 and F2; one paper per form
const students = [
  { id: 'a', classId: 'c1', surname: 'A' }, { id: 'b', classId: 'c1', surname: 'B' },
  { id: 'c', classId: 'c2', surname: 'C' },
];
const groups = [
  { id: 'g1', classId: 'c1', syllabusId: 'geo', syllabusCode: '0460', studentIds: ['a', 'b'] },
  { id: 'g2', classId: 'c2', syllabusId: 'geo', syllabusCode: '0460', studentIds: ['c'] },
];
const f1paper = { id: 'p1', syllabusId: 'geo', syllabusCode: '0460', paper: 'Exam', formLabel: 'F1', classIds: ['c1'], maxMark: 50 };
const f2paper = { id: 'p2', syllabusId: 'geo', syllabusCode: '0460', paper: 'Exam', formLabel: 'F2', classIds: ['c2'], maxMark: 40 };
const oldPaper = { id: 'p0', syllabusId: 'geo', syllabusCode: '0460', paper: 'Paper 1', maxMark: 10 };

describe('papers for particular forms', () => {
  it('only the paper’s forms sit it; a paper without forms is sat by everyone (unchanged behaviour)', () => {
    expect(paperGroups(groups, students, f1paper).map((g) => g.id)).toEqual(['g1']);
    expect(paperCandidates(groups, students, f2paper).map((s) => s.id)).toEqual(['c']);
    expect(paperCandidates(groups, students, oldPaper).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect([paperForClass(f1paper, 'c2'), paperForClass(oldPaper, 'c2')]).toEqual([false, true]);
    expect(paperLabel(f1paper)).toBe('0460 Exam (F1)');
  });

  it('results: F1 students are not marked absent from the F2 paper', () => {
    const data = {
      win: { forms: ['c1', 'c2'], gradeBands: [], minSubjects: 1 },
      papers: [f1paper, f2paper], groups, students,
      syllabi: [{ id: 'geo', code: '0460', name: 'Geography' }],
      marks: { 'p1|g1': { a: { raw: 40 }, b: { raw: 25 } }, 'p2|g2': { c: { raw: 30 } } },
      sittings: {},
    };
    const f1 = formResults(data, 'c1');
    expect(f1.subjects[0].papers.map((p) => p.id)).toEqual(['p1']);
    expect(f1.flags.filter((f) => f.type === 'unmarked')).toEqual([]);
    const f2 = formResults(data, 'c2');
    expect(f2.subjects[0].papers.map((p) => p.id)).toEqual(['p2']);
  });
});

describe('timetable → papers', () => {
  const classes = [
    { id: 'k1d', name: '1D', form: 1 }, { id: 'k1e', name: '1E', form: 1 },
    { id: 'k3d1', name: '3D1', form: 3 }, { id: 'k3g', name: '3G', form: 3 },
    { id: 'kl6s', name: 'L6 Sciences', form: 5 },
  ];
  const tg = [
    { classId: 'k1d', syllabusId: 'mhs-0455', syllabusCode: '0455' },
    { classId: 'k3d1', syllabusId: 'mhs-0478', syllabusCode: '0478' },
    { classId: 'k3g', syllabusId: 'mhs-0417', syllabusCode: '0417' },
    { classId: 'kl6s', syllabusId: 'mhs-9709', syllabusCode: '9709' },
  ];
  const row = (id, form, subject, paper = '', names = []) => ({ id, date: '2026-11-20', slot: 'Morning', start: '08:00', form, subject, paper, duration: 90, invigilatorNames: names });
  const users = [{ id: 'u1', name: 'Mr Nare', roles: [] }, { id: 'u2', name: 'T Moyo', roles: ['teacher'] }, { id: 'u3', name: 'K Moyo', roles: ['superAdmin'] },
    { id: 'u4', name: 'P Zishura', roles: ['parent'] }];

  it('reads form labels: F1 = all Form 1, F1D = that class, F5 = L6', () => {
    expect(classesForForm('F1', classes).map((c) => c.name)).toEqual(['1D', '1E']);
    expect(classesForForm('F1D', classes).map((c) => c.name)).toEqual(['1D']);
    expect(classesForForm('F5', classes).map((c) => c.name)).toEqual(['L6 Sciences']);
  });

  it('splits "Computer Science / ICT" by what each class takes, uses A Level for F5, skips what nobody takes', () => {
    const plan = planTimetableImport({ windowId: 'w', classes, groups: tg, users, sessions: [
      row('r1', 'F3', 'Computer Science / ICT', '', ['Nare', 'Moyo', 'Zishura']),
      row('r2', 'F5', 'Maths', 'Pure P1'),
      row('r3', 'F1D', 'Economics'),
      row('r4', 'F1E', 'Agriculture'),
    ] });
    expect(plan.papers.map((p) => [p.data.syllabusCode, p.data.classIds])).toEqual([
      ['0478', ['k3d1']], ['0417', ['k3g']], ['9709', ['kl6s']], ['0455', ['k1d']],
    ]);
    expect(plan.papers[2].data.paper).toBe('Pure P1');
    expect(plan.skipped.map((s) => s.reason)).toEqual(['no F1E class takes Agriculture']);
    // Unique surname links (even before a role is given); two staff called Moyo is left
    // for the officer to choose; a parent account is never an invigilator
    expect(plan.invigilators).toEqual({ Nare: 'u1', Moyo: null, Zishura: null });
    expect(plan.ambiguous.Moyo).toHaveLength(2);
    expect(plan.papers[0].data.invigilatorNames).toEqual(['Moyo', 'Zishura']);
    expect(plan.classIds.sort()).toEqual(['k1d', 'k1e', 'k3d1', 'k3g', 'kl6s'].sort());
  });
});
