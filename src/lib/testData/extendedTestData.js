/**
 * Comprehensive test data — extends the 3D1 base set (classTestData.js).
 *
 *  - Five more subjects for 3D1 (Science keeps the real mark-list marks):
 *    Mathematics (two classes: set A / set B — so moderation compares classes),
 *    English, Geography, History (exam only) and Computer Science (requires coursework).
 *  - Last term's exam window, fully PUBLISHED (v1): papers, sittings, moderated and
 *    frozen marks, subject reports, report cards and results snapshots — feeds
 *    Analytics and the published report cards.
 *  - This term's window with every subject at a different stage, so the control
 *    panel shows done / in progress / late.
 *
 * All marks other than Science are generated deterministically from each student's
 * real test average, so stronger students stay stronger across subjects.
 * Only the uploaded 3D1 names are used.
 */
import { computeForm } from '../termExam/results';

export const EXTRA_SUBJECTS = [
  { key: 'math', code: '4024', name: 'Mathematics (test)', topics: ['Number', 'Algebra', 'Geometry', 'Statistics'], cw: false },
  { key: 'eng',  code: '1123', name: 'English Language (test)', topics: ['Reading', 'Directed writing', 'Composition', 'Summary'], cw: false },
  { key: 'geo',  code: '2217', name: 'Geography (test)', topics: ['Population', 'Weather', 'Rivers', 'Agriculture'], cw: false },
  { key: 'his',  code: '2147', name: 'History (test)', topics: ['Colonial era', 'Independence', 'World War I', 'Cold War'], cw: false },
  { key: 'cs',   code: '2210', name: 'Computer Science (test)', topics: ['Data', 'Hardware', 'Algorithms', 'Programming'], cw: true },
];

/** Deterministic 0..1 variation — same output every run. */
const vary = (...n) => ((n.reduce((a, x, i) => a + x * [31, 17, 11, 7, 5][i % 5], 0) % 21) - 10) / 100;
const clamp = (x) => Math.min(1, Math.max(0.05, x));

/**
 * ctx = { put, uid, roster, P, sid, staffId, addDays, ts, year, className,
 *         SYL_ID, GROUP_ID, TERM_ID, WIN_ID, bands }
 */
export function buildExtended(ctx) {
  const { put, uid, roster, P, sid, staffId, addDays, ts, year, className, SYL_ID, GROUP_ID, TERM_ID, WIN_ID, bands } = ctx;
  const n = roster.length;
  const ability = roster.map((s) => s[3].reduce((a, b) => a + b, 0) / 80); // real test average 0..1
  const half = Math.ceil(n / 2);
  const sylId = (k) => `${P}syl_${k}`;

  // ── Subjects and classes ──
  const groups = []; // { id, syllabusId, code, key, name, teacher, students[idx] }
  for (const [si, sub] of EXTRA_SUBJECTS.entries()) {
    put(`syllabi/${sylId(sub.key)}`, {
      code: sub.code, name: sub.name, level: 'O Level',
      components: sub.cw
        ? [{ paper: 'Theory paper', weight: 70, maxMark: 100 }, { paper: 'Practical coursework', weight: 30, maxMark: 60 }]
        : [{ paper: 'Paper 1', weight: 50, maxMark: 100 }, { paper: 'Paper 2', weight: 50, maxMark: 100 }],
      topics: sub.topics.map((t, i) => ({ id: `t${i + 1}`, name: t })), createdAt: ts,
    });
    const defs = sub.key === 'math'
      ? [{ id: `${P}g_math_a`, name: `${className} Maths set A`, teacher: uid, idx: [...Array(half).keys()] },
         { id: `${P}g_math_b`, name: `${className} Maths set B`, teacher: staffId('staff1'), idx: [...Array(n - half).keys()].map((i) => i + half) }]
      : [{ id: `${P}g_${sub.key}`, name: `${className} ${sub.name.replace(' (test)', '')}`,
           teacher: { eng: staffId('staff2'), geo: staffId('staff1'), his: staffId('staff2'), cs: uid }[sub.key], idx: [...Array(n).keys()] }];
    for (const g of defs) {
      groups.push({ ...g, syllabusId: sylId(sub.key), code: sub.code, key: sub.key, si, cw: sub.cw });
      put(`teachingGroups/${g.id}`, {
        name: g.name, syllabusId: sylId(sub.key), syllabusCode: sub.code, year,
        teacherIds: [g.teacher], studentIds: g.idx.map(sid), createdAt: ts,
      });
      // Markbook: 3 class tests (+ 3 practicals for CS, counted as coursework)
      const items = [
        ...[0, 1, 2].map((k) => ({ id: `${P}${g.id.slice(P.length)}_ct${k + 1}`, title: `Class test ${k + 1}`, component: 'Class test', maxMark: 50, date: addDays(-70 + k * 21) })),
        ...(sub.cw ? [0, 1, 2].map((k) => ({ id: `${P}${g.id.slice(P.length)}_pr${k + 1}`, title: `Practical ${k + 1}`, component: 'Practical', maxMark: 20, date: addDays(-60 + k * 20) })) : []),
      ];
      for (const [k, a] of items.entries()) {
        put(`teachingGroups/${g.id}/assessments/${a.id}`, { title: a.title, component: a.component, maxMark: a.maxMark, date: a.date, locked: false, createdBy: g.teacher, createdAt: ts });
        const entries = {};
        g.idx.forEach((i) => { entries[sid(i)] = { raw: Math.round(a.maxMark * clamp(ability[i] + vary(i, si, k, 1))), status: null }; });
        put(`teachingGroups/${g.id}/assessments/${a.id}/marks/entries`, { entries, updatedAt: ts });
      }
    }
  }
  const scienceGroup = { id: GROUP_ID, syllabusId: SYL_ID, code: '4005', key: 'sci', si: 9, idx: [...Array(n).keys()], cw: true };
  const allGroups = [scienceGroup, ...groups];
  const groupOf = (key, i) => allGroups.find((g) => g.key === key && g.idx.includes(i));
  const subjKeys = ['sci', ...EXTRA_SUBJECTS.map((s) => s.key)];
  const sylOf = (key) => (key === 'sci' ? SYL_ID : sylId(key));
  const codeOf = (key) => (key === 'sci' ? '4005' : EXTRA_SUBJECTS.find((s) => s.key === key).code);
  const nameOf = (key) => (key === 'sci' ? 'Combined Science (test)' : EXTRA_SUBJECTS.find((s) => s.key === key).name);

  // ── LAST TERM: fully published window ──
  const TERM_PREV = `${P}term_prev`;
  const WIN_PREV = `${P}win_prev`;
  put(`terms/${TERM_PREV}`, { year, term: 2, isCurrent: false, name: `Term 2 ${year}`, createdAt: ts });
  const prevBase = -130;
  put(`examWindows/${WIN_PREV}`, {
    name: `Term 2 ${year} end-of-term exams (test)`, termId: TERM_PREV,
    startDate: addDays(prevBase), endDate: addDays(prevBase + 6), courseworkFrom: addDays(prevBase - 90), nextTermOpens: addDays(prevBase + 30),
    forms: [`${P}class`], defaultSplit: { exam: 70, coursework: 30 },
    // Last term every subject was examined only (set explicitly in setup)
    subjects: Object.fromEntries(subjKeys.map((k) => [sylOf(k), { mode: 'exam' }])),
    gradeBands: bands, minSubjects: 5, stageDue: {},
    approved: true, approvedBy: staffId('staff6'), timetablePublished: true, resultsChecked: true, checkedBy: staffId('staff4'),
    published: true, publishedBy: staffId('staff6'), version: 1, createdAt: ts,
  });
  const prevSittingExc = { 3: 'sick', 9: 'absent' }; // student idx → status on their Maths paper
  const marksIn = {}; const sittingsIn = {};
  for (const [pi, key] of subjKeys.entries()) {
    const pid = `${P}pp_${key}`;
    put(`examPapers/${pid}`, {
      windowId: WIN_PREV, syllabusId: sylOf(key), syllabusCode: codeOf(key), paper: 'Paper 1', maxMark: 100, duration: 120,
      questions: [1, 2, 3, 4].map((q) => ({ no: String(q), marks: 25, topicId: `t${q}` })),
      setterId: staffId('staff1'), status: 'printed', vettedBy: staffId('staff3'),
      date: addDays(prevBase + pi), start: '08:00', venue: 'Main Hall', seats: n,
      invigilatorIds: [staffId(pi % 2 ? 'staff2' : 'staff4')], attendanceSubmitted: true, incidents: '', createdAt: ts,
    });
    for (const g of allGroups.filter((x) => x.key === key)) {
      const entries = {};
      g.idx.forEach((i) => {
        const st = key === 'math' ? prevSittingExc[i] : undefined;
        put(`examSittings/${pid}_${sid(i)}`, { paperId: pid, windowId: WIN_PREV, studentId: sid(i), status: st ?? 'present' });
        (sittingsIn[sid(i)] ??= {})[pid] = st ?? 'present';
        if (st) return;
        const perQuestion = Object.fromEntries([1, 2, 3, 4].map((q) => [String(q), Math.round(25 * clamp(ability[i] - 0.03 + vary(i, pi, q, 5)))]));
        const raw = Object.values(perQuestion).reduce((a, b) => a + b, 0);
        entries[sid(i)] = { raw, status: null, perQuestion };
        ((marksIn[sylOf(key)] ??= {})[sid(i)] ??= {})[pid] = raw;
      });
      put(`teachingGroups/${g.id}/assessments/exam_${pid}`, {
        title: `Paper 1 — Term 2 ${year} end-of-term exams (test)`, component: 'Exam', maxMark: 100, date: addDays(prevBase + pi),
        examPaperId: pid, windowId: WIN_PREV, questions: [1, 2, 3, 4].map((q) => ({ no: String(q), marks: 25 })),
        submitted: true, locked: true, moderation: 'accepted', moderatedBy: staffId('staff3'), frozen: true, createdBy: uid, createdAt: ts,
      });
      put(`teachingGroups/${g.id}/assessments/exam_${pid}/marks/entries`, { entries, updatedAt: ts });
    }
  }
  // Results via the real engine → snapshots, report cards, subject reports
  const students = roster.map((_, i) => ({ id: sid(i) }));
  const res = computeForm({
    students,
    subjects: subjKeys.map((k) => ({ id: sylOf(k), weights: { mode: 'exam' }, papers: [{ id: `${P}pp_${k}`, maxMark: 100 }] })),
    takes: Object.fromEntries(students.map((s) => [s.id, subjKeys.map(sylOf)])),
    marks: marksIn, sittings: sittingsIn, coursework: {}, bands, minSubjects: 5,
  });
  const EFFORT = 'ABCDE';
  const comment = (f, pct) => (pct == null ? `${f} missed the exam with a valid reason.`
    : pct >= 75 ? `${f} produced excellent work this term.` : pct >= 60 ? `${f} worked consistently this term.`
    : pct >= 45 ? `${f} is making steady progress; more revision will help.` : `${f} needs to focus and prepare thoroughly for tests.`);
  roster.forEach((s, i) => {
    const r = res.byStudent[sid(i)];
    const first = s[1].split(' ')[0];
    const subjects = subjKeys.map((k) => {
      const x = r.subjects[sylOf(k)];
      return {
        code: codeOf(k), name: nameOf(k), coursework: false, courseworkPct: null, examPct: x.examPct, finalPct: x.finalPct,
        grade: x.grade, position: x.position ?? null, outOf: res.subjectStats[sylOf(k)].outOf, average: res.subjectStats[sylOf(k)].average,
        effort: EFFORT.charAt((i + subjKeys.indexOf(k)) % 5), comment: comment(first, x.finalPct), x: x.x,
      };
    });
    const present = 58 - ((i * 7) % 9);
    const card = {
      windowId: WIN_PREV, windowName: `Term 2 ${year} end-of-term exams (test)`, studentId: sid(i), formId: `${P}class`, formName: className,
      student: { surname: s[0], firstName: s[1], candidateNumber: `${className}-${String(i + 1).padStart(3, '0')}` },
      subjects, overallAvg: r.overallAvg, overallPos: r.overallPos, overallOutOf: r.overallOutOf,
      attendance: { present, total: 60, pct: (present / 60) * 100 },
      conduct: { merits: (i * 3) % 5, demerits: (i * 2) % 3, incidents: i % 11 === 0 ? 1 : 0 },
      classTeacherComment: `${first} is a cooperative member of ${className}.`, principalComment: 'Well done this term. Keep working hard.',
      approvedByName: 'Mrs F. Sibanda', nextTermOpens: addDays(prevBase + 30), version: 1, publishedAt: addDays(prevBase + 20), publishedBy: staffId('staff6'),
    };
    put(`resultSnapshots/${WIN_PREV}_${sid(i)}`, card);
    put(`reports/card_${WIN_PREV}_${sid(i)}`, {
      type: 'termCard', windowId: WIN_PREV, termId: TERM_PREV, studentId: sid(i), formId: `${P}class`,
      classTeacherComment: card.classTeacherComment, principalComment: card.principalComment,
      status: 'published', approvedBy: staffId('staff6'), createdAt: ts, updatedAt: ts,
    });
    subjKeys.forEach((k) => {
      const g = groupOf(k, i);
      put(`reports/${g.id}_${TERM_PREV}_${sid(i)}`, {
        studentId: sid(i), groupId: g.id, termId: TERM_PREV, syllabusCode: codeOf(k),
        subjectComment: subjects.find((x) => x.code === codeOf(k)).comment, effort: subjects.find((x) => x.code === codeOf(k)).effort,
        tutorComment: '', headComment: '', status: 'published', createdAt: ts, updatedAt: ts,
      });
    });
  });

  // ── THIS TERM: every subject at a different stage ──
  const cur = [
    // key, papers, state
    ['math', [['Paper 1', 4], ['Paper 2', 4]], 'moderating'],  // set A accepted, set B awaiting the HOD
    ['eng',  [['Paper 1', 4]], 'marking'],                     // marks partly entered (late)
    ['geo',  [['Paper 1', 4]], 'sat'],                          // sat, marking not started (late)
    ['his',  [['Paper 1', 4]], 'draft'],                        // paper still draft (late)
    ['cs',   [['Theory', 4]], 'upcoming'],                      // scheduled in two days
  ];
  for (const [ki, [key, papers, state]] of cur.entries()) {
    for (const [pn, [label, q]] of papers.entries()) {
      const pid = `${P}cp_${key}${pn + 1}`;
      const date = state === 'upcoming' ? addDays(2) : addDays(-9 + ki);
      const sat = !['draft', 'upcoming'].includes(state);
      put(`examPapers/${pid}`, {
        windowId: WIN_ID, syllabusId: sylOf(key), syllabusCode: codeOf(key), paper: label, maxMark: q * 15, duration: 90,
        questions: [...Array(q).keys()].map((x) => ({ no: String(x + 1), marks: 15, topicId: `t${x + 1}` })),
        setterId: staffId(key === 'his' ? 'staff2' : 'staff1'), status: state === 'draft' ? 'draft' : 'vetted',
        ...(state === 'draft' ? {} : { vettedBy: staffId('staff3') }),
        date, start: pn ? '11:00' : '08:00', venue: pn ? 'Room 12' : 'Main Hall', seats: n,
        invigilatorIds: [staffId(ki % 2 ? 'staff4' : 'staff2')], attendanceSubmitted: sat, incidents: '', createdAt: ts,
      });
      if (!sat) continue;
      for (const g of allGroups.filter((x) => x.key === key)) {
        const entries = {};
        g.idx.forEach((i) => {
          put(`examSittings/${pid}_${sid(i)}`, { paperId: pid, windowId: WIN_ID, studentId: sid(i), status: 'present' });
          if (state === 'sat') return;
          if (state === 'marking' && i % 3 === 0) return; // a third still unmarked
          const perQuestion = Object.fromEntries([...Array(q).keys()].map((x) => [String(x + 1), Math.round(15 * clamp(ability[i] + vary(i, ki, pn, x)))]));
          entries[sid(i)] = { raw: Object.values(perQuestion).reduce((a, b) => a + b, 0), status: null, perQuestion };
        });
        if (state === 'sat') continue;
        const accepted = state === 'moderating' && g.id.endsWith('_a');
        put(`teachingGroups/${g.id}/assessments/exam_${pid}`, {
          title: `${label} — this term (test)`, component: 'Exam', maxMark: q * 15, date, examPaperId: pid, windowId: WIN_ID,
          questions: [...Array(q).keys()].map((x) => ({ no: String(x + 1), marks: 15 })),
          submitted: state === 'moderating', locked: accepted, ...(accepted ? { moderation: 'accepted', moderatedBy: staffId('staff3') } : {}),
          createdBy: uid, createdAt: ts,
        });
        put(`teachingGroups/${g.id}/assessments/exam_${pid}/marks/entries`, { entries, updatedAt: ts });
      }
    }
  }
  // Subject reports this term: Maths set A complete, English partly done
  roster.forEach((s, i) => {
    const first = s[1].split(' ')[0];
    const ga = groupOf('math', i);
    if (ga.id.endsWith('_a')) put(`reports/${ga.id}_${TERM_ID}_${sid(i)}`, {
      studentId: sid(i), groupId: ga.id, termId: TERM_ID, syllabusCode: '4024', subjectComment: `${first} has worked steadily in Mathematics.`,
      effort: EFFORT.charAt(i % 5), tutorComment: '', headComment: '', status: 'reviewed', createdAt: ts, updatedAt: ts,
    });
    if (i % 2 === 0) {
      const ge = groupOf('eng', i);
      put(`reports/${ge.id}_${TERM_ID}_${sid(i)}`, {
        studentId: sid(i), groupId: ge.id, termId: TERM_ID, syllabusCode: '1123', subjectComment: `${first} reads widely and writes with care.`,
        effort: '', tutorComment: '', headComment: '', status: 'draft', createdAt: ts, updatedAt: ts,
      });
    }
  });

  return { groupIds: groups.map((g) => g.id), extraSyllabusCodes: EXTRA_SUBJECTS.map((s) => s.code), sylIds: Object.fromEntries(EXTRA_SUBJECTS.map((s) => [s.key, sylId(s.key)])) };
}
