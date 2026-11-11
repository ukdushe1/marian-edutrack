/**
 * Test data generator for one class, built from an uploaded mark-list CSV
 * (10 class exercises /10 and 4 tests /20). No student names live in source code.
 *
 * Every document written here has `testData: true` and an id starting with
 * `test3d1_`, so removeTestData() can delete exactly what seedTestData() created.
 * Guardian names, phone numbers, conduct notes etc. are invented for testing.
 */
import {
  doc, setDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

// [surname, firstName, classExercises x10 (/10), tests x4 (/20)]
/**
 * Parse a mark-list CSV: surname,firstName,ex1..ex10,test1..test4 (header row required).
 * Returns { students: [[surname, firstName, ex[], tests[]]], errors: string[] }.
 * Student names are never stored in source code — they come from this file at runtime.
 */
export function parseMarkListCsv(text) {
  const lines = String(text).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const errors = [];
  if (!lines.length) return { students: [], errors: ['File is empty.'] };
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  if (header[0] !== 'surname' || header[1] !== 'firstname') {
    return { students: [], errors: ['First row must be the header: surname,firstName,ex1…ex10,test1…test4'] };
  }
  const students = [];
  lines.slice(1).forEach((line, i) => {
    const c = line.split(',').map((x) => x.trim());
    const nums = c.slice(2).map(Number);
    if (c.length !== 16 || !c[0] || !c[1] || nums.some((n) => !Number.isFinite(n))) {
      errors.push(`Row ${i + 2}: expected surname, first name and 14 numeric marks.`);
      return;
    }
    if (nums.slice(0, 10).some((n) => n < 0 || n > 10) || nums.slice(10).some((n) => n < 0 || n > 20)) {
      errors.push(`Row ${i + 2}: class exercises must be 0–10 and tests 0–20.`);
      return;
    }
    students.push([c[0], c[1], nums.slice(0, 10), nums.slice(10)]);
  });
  if (students.length < 16) errors.push('At least 16 students are needed to cover every test scenario.');
  return { students, errors };
}

const P = 'test3d1_';
const GROUP_ID = `${P}group`;
const TERM_ID  = `${P}term`;
const SYL_ID   = `${P}syllabus`;
const HOUSES   = ['North', 'South', 'East', 'West'];
const TAG      = { testData: true };

// Every top-level collection seeded (used for removal).
const COLLECTIONS = [
  'students', 'classes', 'terms', 'syllabi', 'teachingGroups', 'registers', 'reports',
  'conduct', 'notices', 'guardians', 'predictions', 'resources', 'resourceBookings',
  'coverRequests', 'examSessions', 'cambridgeEntries', 'exeats', 'houseRollCall', 'sickBay',
  'users', 'gradingScales', 'gradeBoundaries', 'commentBank',
  'examWindows', 'examPapers', 'examSittings',
];
const WIN_ID = `${P}win`;

// Invented staff (profiles only — they cannot sign in)
const STAFF = [
  ['staff1', 'Mr T. Moyo',      ['teacher']],
  ['staff2', 'Mrs R. Chikore',  ['teacher', 'classTeacher']],
  ['staff3', 'Mr K. Dube',      ['hod', 'teacher'], ['4005']],   // HOD of the test subject
  ['staff4', 'Ms P. Ncube',     ['examsOfficer']],
  ['staff5', 'Mr S. Banda',     ['boardingMaster']],
  ['staff6', 'Mrs F. Sibanda',  ['vicePrincipal']],
];

// Preset report comments: [category, subject ('' = general), text]
const COMMENTS = [
  ['excellent', '', '{name} has produced excellent work this term and is a role model to others.'],
  ['excellent', '', 'Outstanding effort and results. Well done, {name}.'],
  ['good', '', '{name} has worked consistently this term. Keep it up.'],
  ['good', '', 'A good term. {name} participates well in class.'],
  ['satisfactory', '', '{name} is making steady progress. More revision of weaker topics will help.'],
  ['satisfactory', '', 'Satisfactory work. {name} should aim to complete all homework on time.'],
  ['needsImprovement', '', '{name} needs to focus more in class and prepare thoroughly for tests.'],
  ['needsImprovement', '', 'Attendance and effort must improve if {name} is to reach their potential.'],
  ['excellent', '4005', '{name} shows a strong grasp of scientific concepts and excellent practical skills.'],
  ['good', '4005', '{name} writes up practicals carefully and applies formulae well.'],
  ['needsImprovement', '4005', '{name} should revise electricity and forces before the next test.'],
];
const staffId = (k) => `${P}${k}`;

const sid = (i) => `${P}s${String(i + 1).padStart(2, '0')}`;
const iso = (d) => d.toISOString().slice(0, 10);

/** The last n school days (Mon–Fri) ending today, oldest first. */
function schoolDays(n) {
  const out = [];
  const d = new Date();
  while (out.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.unshift(iso(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
}

function grade(pct) {
  if (pct >= 90) return 'A*';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  if (pct >= 40) return 'E';
  return 'U';
}
const GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'];

/** Build every document as [path, data]. Pure — no Firestore calls. */
export function buildTestDocs({ uid, userName = 'Test Teacher', testNumber = null, students: roster, className = '3D1' }) {
  const docs = [];
  const put = (path, data) => docs.push([path, { ...data, ...TAG }]);
  const year = new Date().getFullYear();
  const studentIds = roster.map((_, i) => sid(i));
  const ts = serverTimestamp();

  // ── School structure ──
  put(`terms/${TERM_ID}`, { year, term: 3, isCurrent: true, name: `Term 3 ${year}`, createdAt: ts });
  put(`syllabi/${SYL_ID}`, {
    code: '4005', name: 'Combined Science (test)', level: 'O Level',
    components: [
      { paper: 'Theory papers',            weight: 70, maxMark: 100 },
      { paper: 'Coursework (practicals)',  weight: 30, maxMark: 100 },
    ],
    topics: [
      { id: 't1', name: 'Cells and organisation' },
      { id: 't2', name: 'Matter and particles' },
      { id: 't3', name: 'Forces and motion' },
      { id: 't4', name: 'Electricity' },
    ],
    createdAt: ts,
  });
  put(`classes/${P}class`, { name: className, form: Number(className.match(/\d/)?.[0] ?? 3), year, tutorId: uid, createdAt: ts });

  roster.forEach(([surname, firstName], i) => {
    put(`students/${sid(i)}`, {
      surname, firstName, preferredName: '',
      candidateNumber: `${className}-${String(i + 1).padStart(3, '0')}`,
      house: HOUSES[i % 4], classId: `${P}class`,
      isBoarding: i % 3 === 0,
      createdAt: ts,
    });
  });

  STAFF.forEach(([k, name, roles, hodSubjects]) => {
    put(`users/${staffId(k)}`, { name, roles, ...(hodSubjects ? { hodSubjects } : {}), email: '', createdAt: ts });
  });

  COMMENTS.forEach(([category, subject, text], k) => {
    put(`commentBank/${P}cb${String(k + 1).padStart(2, '0')}`, {
      text, category, subject, active: true, createdBy: uid, createdAt: ts, updatedAt: ts,
    });
  });

  put(`gradingScales/${P}scale`, {
    name: 'O Level (test)', grades: ['A*', 'A', 'B', 'C', 'D', 'E', 'U'], passGrade: 'C', createdAt: ts,
  });
  put(`gradeBoundaries/${P}4005`, {
    syllabusId: SYL_ID, syllabusCode: '4005', series: 'Oct/Nov', year,
    boundaries: { 'A*': 90, A: 80, B: 70, C: 60, D: 50, E: 40 }, createdAt: ts,
  });

  // Teaching group — you are the teacher so it shows in Markbook/Register/Reports
  put(`teachingGroups/${GROUP_ID}`, {
    name: className, syllabusId: SYL_ID, syllabusCode: '4005', year,
    teacherIds: [uid, staffId('staff1')], studentIds, createdAt: ts,
  });

  // ── Assessments + marks (real 3D1 marks) ──
  const weeks = 14;
  const assess = [
    ...Array.from({ length: 10 }, (_, k) => ({ id: `${P}ex${k + 1}`, title: `Class exercise ${k + 1}`, component: 'Coursework', maxMark: 10, col: 0, k, topicId: `t${(k % 4) + 1}` })),
    ...Array.from({ length: 4 },  (_, k) => ({ id: `${P}test${k + 1}`, title: `Test ${k + 1}`, component: 'Class test', maxMark: 20, col: 1, k, topicId: `t${k + 1}` })),
  ];
  assess.forEach((a, n) => {
    const date = addDays(-(weeks - n) * 7 + (a.col ? 3 : 0));
    const locked = a.id === `${P}test1`; // one locked assessment to test HOD locking
    put(`teachingGroups/${GROUP_ID}/assessments/${a.id}`, {
      title: a.title, component: a.component, maxMark: a.maxMark, date, topicId: a.topicId,
      locked, createdBy: uid, createdAt: ts,
    });
    const entries = {};
    roster.forEach((s, i) => {
      // A couple of absent/exempt codes so special statuses show in the grid
      if (a.id === `${P}ex3` && i === 4) entries[sid(i)] = { raw: null, status: 'absent' };
      else if (a.id === `${P}test2` && i === 30) entries[sid(i)] = { raw: null, status: 'exempt' };
      else entries[sid(i)] = { raw: s[2 + a.col][a.k], status: null };
    });
    put(`teachingGroups/${GROUP_ID}/assessments/${a.id}/marks/entries`, { entries, locked, updatedAt: ts });
  });

  // ── Registers: last 5 school days, tutor period; a few absences/lates ──
  const days = schoolDays(5);
  days.forEach((date, d) => {
    const entries = {};
    studentIds.forEach((id, i) => {
      let st = 'P';
      if ((i + d) % 11 === 0) st = 'A';
      else if ((i + d * 3) % 13 === 0) st = 'L';
      else if (i === 8 && d >= 2) st = 'A';       // Manjengwa: repeated absences (low attendance)
      else if (i === 0 && d === 4) st = 'E';
      entries[id] = st;
    });
    put(`registers/${GROUP_ID}_${date}_pTutor`, {
      groupId: GROUP_ID, date, period: 'Tutor', entries, takenBy: uid, takenAt: ts,
    });
  });

  // ── Reports: spread across the workflow ──
  const statuses = ['draft', 'reviewed', 'approved', 'published'];
  roster.forEach((s, i) => {
    const exPct = s[2].reduce((a, b) => a + b, 0);            // /100
    const tPct  = s[3].reduce((a, b) => a + b, 0) / 80 * 100; // /100
    const overall = Math.round(exPct * 0.3 + tPct * 0.7);
    const status = statuses[i % 4];
    const first = s[1].split(' ')[0];
    put(`reports/${GROUP_ID}_${TERM_ID}_${sid(i)}`, {
      studentId: sid(i), groupId: GROUP_ID, termId: TERM_ID, syllabusCode: '4005',
      subjectComment: status === 'draft' && i % 8 === 0 ? '' :
        overall >= 70 ? `${first} has worked consistently this term (${overall}%). Keep it up.`
        : overall >= 55 ? `${first} is making steady progress (${overall}%). More revision of weaker topics will help.`
        : `${first} needs to focus on class exercises and test preparation (${overall}%).`,
      tutorComment: status !== 'draft' ? `${first} is a cooperative member of ${className}.` : '',
      headComment: status === 'published' || status === 'approved' ? 'Well done this term.' : '',
      effort: 'ABCDE'.charAt((i * 3) % 5),
      status, createdAt: ts, updatedAt: ts,
      ...(status !== 'draft' ? { reviewedBy: uid } : {}),
      ...(status === 'approved' || status === 'published' ? { approvedBy: uid } : {}),
      ...(status === 'published' ? { publishedBy: uid } : {}),
    });
  });

  // ── Predictions (from marks) ──
  const predEntries = {};
  roster.forEach((s, i) => {
    const exPct = s[2].reduce((a, b) => a + b, 0);
    const tPct  = s[3].reduce((a, b) => a + b, 0) / 80 * 100;
    const predicted = grade(exPct * 0.3 + tPct * 0.7);
    const mock = grade(s[3][3] / 20 * 100);
    // Some targets set above the prediction so the at-risk flag shows
    const pi = GRADES.indexOf(predicted);
    const target = GRADES[Math.max(0, pi - (i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0))];
    predEntries[sid(i)] = { target, predicted, mock, notes: i % 5 === 0 ? 'Extra revision sessions recommended' : '' };
  });
  put(`predictions/${GROUP_ID}`, { entries: predEntries, updatedAt: ts });

  // ── Conduct ──
  const conduct = [
    [9, 'merit', 'Excellent practical write-up'], [16, 'merit', 'Helped classmates with revision'],
    [28, 'merit', 'Full marks in class exercise 3'], [6, 'demerit', 'Homework not submitted'],
    [20, 'demerit', 'Late to class twice'], [11, 'incident', 'Phone used during test'],
    [13, 'merit', 'Most improved this month'], [2, 'merit', 'Great teamwork in practical'],
    [8, 'demerit', 'Uniform not complete'], [24, 'merit', 'Perfect attendance this term'],
  ];
  conduct.forEach(([i, type, note], k) => {
    put(`conduct/${P}conduct${k + 1}`, {
      studentId: sid(i % roster.length), type, note, date: days[k % days.length],
      points: { merit: 1, demerit: -1, incident: -3 }[type], by: uid, createdAt: ts,
    });
  });

  // ── Notices ──
  [
    [`${className} science test next week`, 'Test 5 covers electricity. Please remind students to revise chapters 7–8.', 'teachers'],
    ['Staff meeting Friday', 'All staff meeting in the library at 14:00 on Friday.', 'all'],
    ['Mark lists due', 'HODs: please lock all Term 3 assessments by the end of the month.', 'hods'],
  ].forEach(([title, body, audience], k) => {
    put(`notices/${P}notice${k + 1}`, {
      title, body, audience, authorId: uid, authorName: userName,
      readBy: k === 0 ? [uid] : [], createdAt: ts,
    });
  });

  // ── Guardians (invented). Consented guardians use YOUR test number so
  //    nobody real is ever messaged; without it they show "no valid number". ──
  const testWa = testNumber ? `+${testNumber}` : '';
  roster.forEach(([surname], i) => {
    const consent = i % 4 !== 3; // every 4th has no consent
    put(`guardians/${P}g${String(i + 1).padStart(2, '0')}`, {
      name: `${i % 2 ? 'Mr' : 'Mrs'} ${surname}`,
      relationship: i % 2 ? 'Father' : 'Mother',
      whatsappNumber: consent ? testWa : '',
      phone: '', email: '',
      studentIds: [sid(i)],
      consentWhatsApp: consent,
      ...(consent ? { consentAt: ts, consentRecordedBy: uid } : {}),
      createdAt: ts, updatedAt: ts,
    });
  });
  // A guardian linked to two students, and a second guardian for student 1
  put(`guardians/${P}g_shared`, {
    name: `Mrs ${roster[20 % roster.length][0]} (sponsor)`, relationship: 'Sponsor', whatsappNumber: testWa, phone: '', email: '',
    studentIds: [sid(20 % roster.length), sid(10)], consentWhatsApp: true, consentAt: ts, consentRecordedBy: uid,
    createdAt: ts, updatedAt: ts,
  });
  put(`guardians/${P}g_second`, {
    name: `Grandmother ${roster[0][0]}`, relationship: 'Grandparent', whatsappNumber: testWa, phone: '', email: '',
    studentIds: [sid(0)], consentWhatsApp: true, consentAt: ts, consentRecordedBy: uid,
    createdAt: ts, updatedAt: ts,
  });

  // ── Schemes of work ──
  ['Cells and organisation', 'Matter and particles', 'Forces and motion', 'Electricity'].forEach((topic, k) => {
    put(`teachingGroups/${GROUP_ID}/schemeEntries/${P}scheme${k + 1}`, {
      weekStart: addDays(-(3 - k) * 7), topic,
      homework: `Textbook questions on ${topic.toLowerCase()}`, homeworkDue: addDays(-(3 - k) * 7 + 4),
      resources: 'Textbook, worksheet', createdAt: ts, updatedAt: ts,
    });
  });

  // ── Resources & bookings (includes a clash-free set plus today's booking) ──
  put(`resources/${P}lab`, { name: 'Science Lab 1', type: 'lab', capacity: 40, createdAt: ts });
  put(`resources/${P}it`,  { name: 'Computer Lab',  type: 'IT',  capacity: 35, createdAt: ts });
  [[`${P}lab`, 0, 3, `${className} practical`], [`${P}it`, 1, 5, `${className} research`], [`${P}lab`, 2, 2, `${className} test practical`]]
    .forEach(([resourceId, d, period, notes], k) => {
      put(`resourceBookings/${P}booking${k + 1}`, {
        resourceId, date: addDays(d), period, groupName: className, notes,
        bookedBy: uid, bookedByName: userName, createdAt: ts,
      });
    });

  // ── Cover ──
  put(`coverRequests/${P}cover1`, {
    absentTeacherId: staffId('staff1'), coverTeacherId: '', date: addDays(1), period: 2, className,
    lessonNote: 'Students to complete worksheet on electricity (pages 12–13).', status: 'open', createdAt: ts, updatedAt: ts,
  });
  put(`coverRequests/${P}cover2`, {
    absentTeacherId: staffId('staff2'), coverTeacherId: staffId('staff3'), date: days[0], period: 4, className,
    lessonNote: 'Revision of Test 3.', status: 'covered', createdAt: ts, updatedAt: ts,
  });

  // ── Exams (sessions 1 and 2 clash on purpose) ──
  [
    ['Paper 1', addDays(14), '09:00', 60, 'Main Hall'],
    ['Paper 2', addDays(14), '09:30', 90, 'Main Hall'],
    ['Practical', addDays(16), '11:00', 120, 'Science Lab 1'],
  ].forEach(([paper, date, start, duration, venue], k) => {
    put(`examSessions/${P}exam${k + 1}`, {
      syllabusId: SYL_ID, paper, date, start, duration, venue, seats: roster.length,
      invigilatorIds: [uid, staffId(k === 2 ? 'staff3' : 'staff4')], createdAt: ts, updatedAt: ts,
    });
  });
  roster.slice(0, 12).forEach((_, i) => {
    put(`cambridgeEntries/${P}entry${i + 1}`, {
      studentId: sid(i), syllabusId: SYL_ID, series: 'Oct/Nov', year: year + 1,
      status: ['pending', 'confirmed', 'confirmed', 'withdrawn'][i % 4], notes: '', createdAt: ts, updatedAt: ts,
    });
  });

  // ── Boarding (boarders are every 3rd student) ──
  const boarders = studentIds.filter((_, i) => i % 3 === 0);
  [
    [boarders[0], `${days[3]}T15:00`, addDays(0), 'Home – Harare', false],
    [boarders[1], `${days[4]}T14:30`, addDays(2), 'Home – Bulawayo', false],
    [boarders[2], `${days[0]}T16:00`, days[2], 'Home – Mutare', true],
  ].forEach(([studentId, departure, returnDate, destination, returned], k) => {
    put(`exeats/${P}exeat${k + 1}`, {
      studentId, departure, returnDate, destination, guardian: 'Parent', returned, createdAt: ts,
    });
  });
  boarders.forEach((id, k) => {
    put(`houseRollCall/${P}roll${k + 1}`, {
      studentId: id, date: days[4], present: k !== 3, house: HOUSES[(k * 3) % 4], createdAt: ts,
    });
  });
  // ── End-of-term exam window, stopped at moderation (stage 6) ──
  const papers = [
    { id: `${P}paper1`, paper: 'Paper 1', duration: 90, questions: [10, 10, 10, 10, 10, 10], day: -10, start: '08:00', venue: 'Main Hall', inv: ['staff2'] },
    { id: `${P}paper2`, paper: 'Paper 2', duration: 60, questions: [10, 10, 10, 10], day: -8, start: '10:30', venue: 'Science Lab 1', inv: ['staff4'] },
  ];
  put(`examWindows/${WIN_ID}`, {
    name: `Term 3 ${year} end-of-term exams (test)`, termId: TERM_ID, startDate: addDays(-10), endDate: addDays(-6),
    courseworkFrom: addDays(-100), nextTermOpens: addDays(60), forms: [`${P}class`],
    defaultSplit: { exam: 70, coursework: 30 }, subjects: { [SYL_ID]: { mode: 'examCoursework', exam: 70, coursework: 30 } },
    gradeBands: [{ grade: 'A', min: 75 }, { grade: 'B', min: 65 }, { grade: 'C', min: 50 }, { grade: 'D', min: 40 }, { grade: 'E', min: 30 }, { grade: 'U', min: 0 }],
    minSubjects: 1, // the test data has one subject; real windows default to 5
    stageDue: { papers: addDays(-20), timetable: addDays(-15), sitting: addDays(-6), marking: addDays(-2), moderation: addDays(2), results: addDays(4), comments: addDays(7), approval: addDays(9), published: addDays(10) },
    approved: true, approvedBy: staffId('staff6'), timetablePublished: true, resultsChecked: false, published: false, version: 0, createdAt: ts,
  });
  // Sitting exceptions: [student index, paper index, status]
  const EXC = [[4, 1, 'sick'], [6, 0, 'absent'], [11, 1, 'malpractice'], [14, 0, 'excused'], [14, 1, 'excused']];
  papers.forEach((pp, pi) => {
    const maxMark = pp.questions.reduce((a, b) => a + b, 0);
    put(`examPapers/${pp.id}`, {
      windowId: WIN_ID, syllabusId: SYL_ID, syllabusCode: '4005', paper: pp.paper, maxMark, duration: pp.duration,
      questions: pp.questions.map((m, q) => ({ no: String(q + 1), marks: m, topicId: `t${(q % 4) + 1}` })),
      setterId: staffId('staff1'), status: 'vetted', vettedBy: staffId('staff3'),
      date: addDays(pp.day), start: pp.start, venue: pp.venue, seats: roster.length,
      invigilatorIds: pp.inv.map(staffId), attendanceSubmitted: true, incidents: '', createdAt: ts,
    });
    const entries = {};
    roster.forEach((s, i) => {
      const exc = EXC.find(([si, p]) => si === i && p === pi);
      put(`examSittings/${pp.id}_${sid(i)}`, { paperId: pp.id, windowId: WIN_ID, studentId: sid(i), status: exc ? exc[2] : 'present' });
      if (exc) return;
      // Per-question marks derived from the student's real test average, varied per question
      const t = s[3].reduce((a, b) => a + b, 0) / 80;
      const perQuestion = {};
      pp.questions.forEach((m, q) => {
        perQuestion[String(q + 1)] = Math.round(m * Math.min(1, Math.max(0, t + (((i * 7 + q * 3 + pi) % 9) - 4) / 25)));
      });
      entries[sid(i)] = { raw: Object.values(perQuestion).reduce((a, b) => a + b, 0), status: null, perQuestion };
    });
    put(`teachingGroups/${GROUP_ID}/assessments/exam_${pp.id}`, {
      title: `${pp.paper} — Term 3 ${year} end-of-term exams (test)`, component: 'Exam', maxMark, date: addDays(pp.day),
      examPaperId: pp.id, windowId: WIN_ID, questions: pp.questions.map((m, q) => ({ no: String(q + 1), marks: m })),
      submitted: true, submittedBy: uid, locked: false, createdBy: uid, createdAt: ts,
    });
    put(`teachingGroups/${GROUP_ID}/assessments/exam_${pp.id}/marks/entries`, { entries, updatedAt: ts });
  });

  put(`sickBay/${P}sick1`, { studentId: boarders[4], complaint: 'Headache and mild fever', discharged: false, admittedAt: Timestamp.now() });
  put(`sickBay/${P}sick2`, { studentId: boarders[5], complaint: 'Sprained ankle (sports)', discharged: true, admittedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 864e5)), dischargedAt: Timestamp.now() });

  return docs;
}

/** Run async tasks with limited concurrency, reporting progress. */
async function runLimited(tasks, limit, onProgress) {
  let done = 0, next = 0;
  const errors = [];
  async function worker() {
    while (next < tasks.length) {
      const t = tasks[next++];
      try { await t.run(); } catch (e) { errors.push(`${t.label}: ${e.code ?? e.message}`); }
      onProgress?.(++done, tasks.length);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return errors;
}

/**
 * Write all test documents. The teaching group is written first because
 * assessment rules look it up. Returns { written, errors }.
 */
export async function seedTestData({ uid, userName, testNumber, students, className, onProgress }) {
  const docs = buildTestDocs({ uid, userName, testNumber, students, className });
  const groupDoc = docs.find(([p]) => p === `teachingGroups/${GROUP_ID}`);
  await setDoc(doc(db, groupDoc[0]), groupDoc[1]);
  const rest = docs.filter((d) => d !== groupDoc).map(([path, data]) => ({
    label: path, run: () => setDoc(doc(db, path), data),
  }));
  const errors = await runLimited(rest, 8, (n, total) => onProgress?.(n + 1, total + 1));
  return { written: docs.length - errors.length, errors };
}

/** Delete every document created by seedTestData (subcollections first). */
export async function removeTestData({ onProgress } = {}) {
  const tasks = [];
  const assessments = await getDocs(collection(db, 'teachingGroups', GROUP_ID, 'assessments'));
  assessments.forEach((a) => {
    tasks.push({ label: a.ref.path + '/marks', run: () => deleteDoc(doc(db, a.ref.path, 'marks', 'entries')) });
    tasks.push({ label: a.ref.path, run: () => deleteDoc(a.ref) });
  });
  const schemes = await getDocs(collection(db, 'teachingGroups', GROUP_ID, 'schemeEntries'));
  schemes.forEach((s) => tasks.push({ label: s.ref.path, run: () => deleteDoc(s.ref) }));

  const subErrors = await runLimited(tasks, 8, (n) => onProgress?.(n, tasks.length));

  const topTasks = [];
  for (const name of COLLECTIONS) {
    const snap = await getDocs(query(collection(db, name), where('testData', '==', true)));
    snap.forEach((d) => topTasks.push({ label: d.ref.path, run: () => deleteDoc(d.ref) }));
  }
  // Created through the module's screens for the test window (not tagged at seed time)
  for (const [name, field] of [['resultSnapshots', 'windowId'], ['reports', 'windowId']]) {
    const snap = await getDocs(query(collection(db, name), where(field, '==', WIN_ID)));
    snap.forEach((d) => topTasks.push({ label: d.ref.path, run: () => deleteDoc(d.ref) }));
  }
  [`${P}paper1`, `${P}paper2`].forEach((id) => topTasks.push({ label: `examSessions/term_${id}`, run: () => deleteDoc(doc(db, 'examSessions', `term_${id}`)) }));
  const errors = await runLimited(topTasks, 8, (n) => onProgress?.(tasks.length + n, tasks.length + topTasks.length));
  return { removed: tasks.length + topTasks.length - subErrors.length - errors.length, errors: [...subErrors, ...errors] };
}
