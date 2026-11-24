import { describe, it, expect, vi } from 'vitest';
import { firestoreMock } from './firebaseMock';
vi.mock('firebase/firestore', () => firestoreMock());
vi.mock('../src/firebase/config', () => ({ db: {}, default: {} }));
vi.mock('react', () => ({ useEffect: () => {}, useState: (v) => [v, () => {}], useCallback: (f) => f }));

const { paperForClass, paperGroups, paperCandidates, paperLabel } = await import('../src/lib/termExam/model');
const { formResults } = await import('../src/lib/termExam/compute');
const { planTimetableImport, classesForForm, recoverInvigilatorLinks } = await import('../src/lib/termExam/timetableImport');

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
    { id: 'u4', name: 'P Zishura', roles: ['parent'] }, { id: 'u5', name: 'B Nehoma', roles: ['boardingMaster'] }];

  it('reads form labels: F1 = all Form 1, F1D = that class, F5 = L6', () => {
    expect(classesForForm('F1', classes).map((c) => c.name)).toEqual(['1D', '1E']);
    expect(classesForForm('F1D', classes).map((c) => c.name)).toEqual(['1D']);
    expect(classesForForm('F5', classes).map((c) => c.name)).toEqual(['L6 Sciences']);
  });

  it('splits "Computer Science / ICT" by what each class takes, uses A Level for F5, skips what nobody takes', () => {
    const plan = planTimetableImport({ windowId: 'w', classes, groups: tg, users, sessions: [
      row('r1', 'F3', 'Computer Science / ICT', '', ['Nare', 'Moyo', 'Zishura', 'Nehoma']),
      row('r2', 'F5', 'Maths', 'Pure P1'),
      row('r3', 'F1D', 'Economics'),
      row('r4', 'F1E', 'Agriculture'),
    ] });
    expect(plan.papers.map((p) => [p.data.syllabusCode, p.data.classIds])).toEqual([
      ['0478', ['k3d1']], ['0417', ['k3g']], ['9709', ['kl6s']], ['0455', ['k1d']],
    ]);
    expect(plan.papers[2].data.paper).toBe('Pure P1');
    expect(plan.skipped.map((s) => s.reason)).toEqual(['no F1E class takes Agriculture']);
    // Teaching staff only: Nare has no role, Zishura is a parent, Nehoma is boarding-only,
    // K Moyo is admin-only — so the one teaching Moyo links
    expect(plan.invigilators).toEqual({ Nare: null, Moyo: 'u2', Zishura: null, Nehoma: null });
    expect(plan.ambiguous).toEqual({});
    expect(plan.papers[0].data.invigilatorNames).toEqual(['Nare', 'Zishura', 'Nehoma']);
    expect(plan.classIds.sort()).toEqual(['k1d', 'k1e', 'k3d1', 'k3g', 'kl6s'].sort());
  });

  it('remembers which of two staff with the same surname was picked last time', () => {
    const staff = [{ id: 'k', name: 'Kuda Ushe', roles: ['teacher'] }, { id: 'a', name: 'A Ushe', roles: ['teacher'] }, { id: 'n', name: 'J Nare', roles: ['teacher'] }];
    const sessions = [row('r1', 'F1', 'Business Studies', '', ['Ushe', 'Nare']), row('r2', 'F2', 'Chemistry', '', ['Ushe'])];
    // Set up before links were saved: Ushe → k is already on the papers
    const papers = [{ importKey: 'r1', invigilatorIds: ['k', 'n'], invigilatorNames: [] }, { importKey: 'r2', invigilatorIds: ['k'], invigilatorNames: [] }];
    expect(recoverInvigilatorLinks({ sessions, papers, users: staff })).toEqual({ Ushe: 'k' });
    // Saved links win; nothing guessed when the papers don't say
    expect(recoverInvigilatorLinks({ sessions, papers: [], users: staff, saved: { Ushe: 'a', Nare: null } })).toEqual({ Ushe: 'a' });
    expect(recoverInvigilatorLinks({ sessions, papers: [{ importKey: 'r1', invigilatorIds: [], invigilatorNames: ['Ushe'] }], users: staff })).toEqual({});
  });
});

describe('choosing the classes for a hand-added paper', () => {
  it('labels the choice like the timetable', async () => {
    const { formLabelFor, classesTakingSubject } = await import('../src/lib/termExam/model');
    const cs = [{ id: 'a', name: '1D' }, { id: 'b', name: '1E' }, { id: 'c', name: '3D1' }, { id: 'd', name: '3E' }, { id: 'e', name: 'L6 Sciences' }];
    expect(formLabelFor(['d'], cs)).toBe('F3E');
    expect(formLabelFor(['a', 'b'], cs)).toBe('F1');
    expect(formLabelFor(['c', 'd'], cs)).toBe('F3');
    expect(formLabelFor(['b', 'd'], cs)).toBe('F1E, F3E');
    expect(formLabelFor(['e'], cs)).toBe('L6 Sciences');
    expect(formLabelFor([], cs)).toBe('');
    // Only classes in the window that have a group for the subject are offered
    const data = {
      win: { forms: ['c1', 'c2'] }, forms: [{ id: 'c1', name: '3D1' }, { id: 'c2', name: '3E' }, { id: 'c9', name: '4E' }],
      students: [{ id: 's', classId: 'c2' }],
      groups: [{ syllabusId: 'cs', classId: 'c1' }, { syllabusId: 'cs', studentIds: ['s'] }, { syllabusId: 'cs', classId: 'c9' }, { syllabusId: 'geo', classId: 'c1' }],
    };
    expect(classesTakingSubject(data, 'cs').map((c) => c.name)).toEqual(['3D1', '3E']);
  });
});

describe('scripts open when the exam has been written', () => {
  it('opens at the timetabled end time, without waiting for attendance', async () => {
    const { paperWritten } = await import('../src/lib/termExam/model');
    const p = { date: '2026-11-18', start: '08:00', duration: 90 };
    expect(paperWritten(p, new Date('2026-11-18T09:29:00'))).toBe(false);
    expect(paperWritten(p, new Date('2026-11-18T09:30:00'))).toBe(true);
    expect(paperWritten({ ...p, duration: null }, new Date('2026-11-18T08:00:00'))).toBe(true); // duration TBC: opens at the start time
    expect(paperWritten({ date: '', start: '' }, new Date())).toBe(false);                     // not timetabled yet
    expect(paperWritten({ attendanceSubmitted: true }, new Date('2000-01-01'))).toBe(true);     // confirmed early
  });
});

describe('default exam paper', () => {
  it('a paper with no questions is Q1 out of 100; a built paper keeps its layout', async () => {
    const { paperQuestions, paperMaxMark } = await import('../src/lib/termExam/model');
    expect(paperQuestions({ questions: [] })).toEqual([{ no: '1', marks: 100, topicId: '' }]);
    expect(paperMaxMark({})).toBe(100);
    expect(paperMaxMark({ questions: [{ no: '1', marks: 30 }, { no: '2', marks: 20 }] })).toBe(50);
  });
});

describe('minimum subjects for an overall position', () => {
  it('A Level classes need 3; Forms 1–4 use the window minimum (5 unless changed)', async () => {
    const { minSubjectsFor } = await import('../src/lib/termExam/model');
    expect(minSubjectsFor({ minSubjects: 5 }, 'L6 Sciences')).toBe(3);
    expect(minSubjectsFor({}, 'U6 Arts')).toBe(3);
    expect(minSubjectsFor({ minSubjectsALevel: 4 }, 'L6 Arts')).toBe(4);
    expect(minSubjectsFor({ minSubjects: 5 }, '3D1')).toBe(5);
    expect(minSubjectsFor({}, '1E')).toBe(5);
  });
  it('an L6 learner with three subjects gets an overall position', async () => {
    const { formResults } = await import('../src/lib/termExam/compute');
    const subj = (id) => ({ id, code: id, name: id });
    const data = {
      win: { forms: ['l6'], gradeBands: [], minSubjects: 5 },
      forms: [{ id: 'l6', name: 'L6 Arts' }],
      students: [{ id: 's', classId: 'l6' }],
      syllabi: ['a', 'b', 'c'].map(subj),
      groups: ['a', 'b', 'c'].map((x) => ({ id: `g${x}`, syllabusId: x, studentIds: ['s'] })),
      papers: ['a', 'b', 'c'].map((x) => ({ id: `p${x}`, syllabusId: x, maxMark: 100, questions: [{ no: '1', marks: 100 }] })),
      marks: { 'pa|ga': { s: { raw: 60 } }, 'pb|gb': { s: { raw: 70 } }, 'pc|gc': { s: { raw: 80 } } },
      sittings: {},
    };
    const res = formResults(data, 'l6');
    expect(res.byStudent.s.overallPos).toBe(1);
  });
});
