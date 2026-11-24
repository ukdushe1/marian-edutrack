/**
 * End-of-term exam module — data model, stage definitions and loaders.
 *
 * Collections
 *   examWindows/{id}     name, termId, startDate, endDate, courseworkFrom, nextTermOpens,
 *                        forms[] (student classId values), defaultSplit {exam, coursework},
 *                        subjects {[syllabusId]: {mode:'exam'|'examCoursework', exam, coursework}},
 *                        gradeBands (IGCSE, Forms 1–4), gradeBandsALevel (L6/U6) [{grade,min}], minSubjects (Forms 1–4), minSubjectsALevel (L6/U6),
 *                        stageDue {[stage]: date},
 *                        approved/approvedBy, timetablePublished, resultsChecked/checkedBy,
 *                        published/publishedAt/version, formNotes {[formId]: note}
 *   examPapers/{id}      windowId, syllabusId, syllabusCode, paper, maxMark, duration,
 *                        classIds[] (forms that sit it; empty = every form taking the subject),
 *                        formLabel (as printed on the school timetable, e.g. "F3D1"), importKey,
 *                        questions [{no, marks, topicId}], setterId, status draft|vetted|printed,
 *                        vettedBy, date, start, venue, seats, invigilatorIds[], attendanceSubmitted
 *   examSittings/{paperId}_{studentId}   paperId, windowId, studentId, status, note
 *   resultSnapshots/{windowId}_{studentId}  saved at publication (versioned)
 *   Marks: teachingGroups/{g}/assessments/exam_{paperId} (+ marks/entries with perQuestion)
 *   Report cards: reports/card_{windowId}_{studentId} (class teacher + principal comments)
 *                 and the existing subject reports (subject comment + effort).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  collection, doc, getDocs, getDoc, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { compareStudents } from '../studentOrder';
import { formOf } from '../schoolSetup/schoolSetup';

export const windowsCol   = () => collection(db, 'examWindows');
export const windowRef    = (id) => doc(db, 'examWindows', id);
export const papersCol    = () => collection(db, 'examPapers');
export const paperRef     = (id) => doc(db, 'examPapers', id);
export const sittingRef   = (paperId, studentId) => doc(db, 'examSittings', `${paperId}_${studentId}`);
export const snapshotRef  = (windowId, studentId) => doc(db, 'resultSnapshots', `${windowId}_${studentId}`);
export const examAssessmentId = (paperId) => `exam_${paperId}`;
export const examAssessmentRef = (groupId, paperId) =>
  doc(db, 'teachingGroups', groupId, 'assessments', examAssessmentId(paperId));
export const examMarksRef = (groupId, paperId) =>
  doc(db, 'teachingGroups', groupId, 'assessments', examAssessmentId(paperId), 'marks', 'entries');
export const cardRef = (windowId, studentId) => doc(db, 'reports', `card_${windowId}_${studentId}`);
export const subjectReportId = (groupId, termId, studentId) => `${groupId}_${termId}_${studentId}`;

export const STAGES = [
  { key: 'setup',      n: 1,  label: 'Setup',       who: 'Exams officer',        signoff: 'Principal / VP approves the window' },
  { key: 'papers',     n: 2,  label: 'Papers',      who: 'Setter, HOD',          signoff: 'HOD marks each paper vetted' },
  { key: 'timetable',  n: 3,  label: 'Timetable',   who: 'Exams officer',        signoff: 'Timetable published to staff' },
  { key: 'sitting',    n: 4,  label: 'Sitting',     who: 'Invigilators',         signoff: 'Every paper written (invigilators record absentees only)' },
  { key: 'marking',    n: 5,  label: 'Marking',     who: 'Subject teachers',     signoff: 'Teacher submits each markbook' },
  { key: 'moderation', n: 6,  label: 'Moderation',  who: 'HOD',                  signoff: 'HOD accepts and locks the marks' },
  { key: 'results',    n: 7,  label: 'Results',     who: 'System',               signoff: 'Exams officer checks the results' },
  { key: 'comments',   n: 8,  label: 'Comments',    who: 'Teachers',             signoff: 'All comments and effort grades done' },
  { key: 'approval',   n: 9,  label: 'Approval',    who: 'Principal / VP',       signoff: 'Each form approved' },
  { key: 'published',  n: 10, label: 'Report cards', who: 'System',              signoff: 'Published' },
];

export const SITTING_STATUS = [
  { key: 'present',     label: 'Present',     short: 'P' },
  { key: 'absent',      label: 'Absent (no reason) — scores 0', short: 'A' },
  { key: 'excused',     label: 'Absent with valid reason — X', short: 'X' },
  { key: 'sick',        label: 'Sick — X',    short: 'S' },
  { key: 'malpractice', label: 'Malpractice — 0, flagged', short: 'M' },
];

export const EFFORT = ['A', 'B', 'C', 'D', 'E'];
export const EFFORT_LABEL = { A: 'Excellent', B: 'Good', C: 'Satisfactory', D: 'Needs effort', E: 'Poor' };

/**
 * Cambridge grades with the school's 10-point % bands. Cambridge sets real thresholds
 * per paper each series; internal exams use fixed bands. Pass = C or better (60%).
 */
export const CAMBRIDGE_IGCSE_BANDS = [
  { grade: 'A*', min: 90 }, { grade: 'A', min: 80 }, { grade: 'B', min: 70 }, { grade: 'C', min: 60 },
  { grade: 'D', min: 50 }, { grade: 'E', min: 40 }, { grade: 'F', min: 30 }, { grade: 'G', min: 20 }, { grade: 'U', min: 0 },
];
export const CAMBRIDGE_ALEVEL_BANDS = [
  { grade: 'A*', min: 90 }, { grade: 'A', min: 80 }, { grade: 'B', min: 70 }, { grade: 'C', min: 60 },
  { grade: 'D', min: 50 }, { grade: 'E', min: 40 }, { grade: 'U', min: 0 },
];
export const DEFAULT_BANDS = CAMBRIDGE_IGCSE_BANDS;

// The bands windows were created with before Cambridge grading (A 75, B 65, C 50…)
const OLD_DEFAULT = 'A75B65C50D40E30U0';
const sig = (bands) => [...bands].sort((x, y) => y.min - x.min).map((x) => `${x.grade}${x.min}`).join('');

/**
 * Grade bands for a class: A Level classes (L6, U6) use the window's A Level bands
 * (default A*–E, U); Forms 1–4 the IGCSE bands (default A*–G, U). A window still on
 * the old pre-Cambridge default is graded with the Cambridge bands.
 */
export function bandsFor(win, className) {
  if ((formOf(className ?? '') ?? 0) >= 5) return win?.gradeBandsALevel?.length ? win.gradeBandsALevel : CAMBRIDGE_ALEVEL_BANDS;
  const b = win?.gradeBands;
  return b?.length && sig(b) !== OLD_DEFAULT ? b : CAMBRIDGE_IGCSE_BANDS;
}

/** A syllabus requires coursework if a component looks like coursework/practical/project. */
export function syllabusRequiresCoursework(syl) {
  return (syl?.components ?? []).some((c) => /course\s*work|practical|project|school[-\s]?based|\bsba\b/i.test(c.paper ?? c.name ?? ''));
}
/** Coursework weight from the syllabus components, if given. */
export function syllabusCourseworkWeight(syl) {
  const cw = (syl?.components ?? []).filter((c) => /course\s*work|practical|project|school[-\s]?based|\bsba\b/i.test(c.paper ?? c.name ?? ''));
  const total = (syl?.components ?? []).reduce((a, c) => a + (Number(c.weight) || 0), 0);
  const w = cw.reduce((a, c) => a + (Number(c.weight) || 0), 0);
  return total > 0 && w > 0 ? Math.round((w / total) * 100) : null;
}

/**
 * Minimum subjects a learner needs for an overall position: A Level classes
 * (L6, U6 — Forms 5–6) need 3; Forms 1–4 use the window's minimum (default 5).
 * @param className the class's name, e.g. "3D1" or "L6 Sciences"
 */
export function minSubjectsFor(win, className) {
  const aLevel = (formOf(className ?? '') ?? 0) >= 5;
  return aLevel ? Number(win?.minSubjectsALevel ?? 3) : Number(win?.minSubjects ?? 5);
}

/** Forms = distinct student.classId values (named from the classes collection when present). */
export function deriveForms(students, classes) {
  const names = Object.fromEntries((classes ?? []).map((c) => [c.id, c.name]));
  const ids = [...new Set(students.map((s) => s.classId).filter(Boolean))];
  return ids.map((id) => ({ id, name: names[id] ?? id })).sort((a, b) => a.name.localeCompare(b.name));
}

const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));

/**
 * Load everything a window needs. Live for the window and papers; the rest on reload().
 * Returns { loading, win, papers, students, forms, groups, syllabi, sittings, assessments,
 *           marks, reports, cards, users, reload }.
 */
export function useWindowData(windowId) {
  const [win,    setWin]    = useState(null);
  const [papers, setPapers] = useState([]);
  const [base,   setBase]   = useState(null);
  const [tick,   setTick]   = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!windowId) return undefined;
    const u1 = onSnapshot(windowRef(windowId), (d) => setWin(d.exists() ? { id: d.id, ...d.data() } : false));
    const u2 = onSnapshot(query(papersCol(), where('windowId', '==', windowId)),
      (s) => setPapers(s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.syllabusCode ?? '').localeCompare(b.syllabusCode ?? '') || (a.paper ?? '').localeCompare(b.paper ?? ''))));
    return () => { u1(); u2(); };
  }, [windowId]);

  useEffect(() => {
    if (!win) return;
    let cancelled = false;
    (async () => {
      const [stuS, clsS, grpS, sylS, sitS, usrS] = await Promise.all([
        getDocs(collection(db, 'students')), getDocs(collection(db, 'classes')),
        getDocs(collection(db, 'teachingGroups')), getDocs(collection(db, 'syllabi')),
        getDocs(query(collection(db, 'examSittings'), where('windowId', '==', windowId))),
        getDocs(collection(db, 'users')),
      ]);
      const all = stuS.docs.map((d) => ({ id: d.id, ...d.data() }));
      const forms = deriveForms(all, clsS.docs.map((d) => ({ id: d.id, ...d.data() })));
      const students = all.filter((s) => (win.forms ?? []).includes(s.classId))
        .sort(compareStudents);
      const sidSet = new Set(students.map((s) => s.id));
      const groups = grpS.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((g) => (g.studentIds ?? []).some((id) => sidSet.has(id)));
      const syllabi = sylS.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sittings = {};
      sitS.docs.forEach((d) => { const x = d.data(); (sittings[x.studentId] ??= {})[x.paperId] = x.status; });
      const users = usrS.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Exam assessments + marks for each paper × group of its subject
      const assessments = {}, marks = {};
      await Promise.all(papers.flatMap((p) => paperGroups(groups, students, p).map(async (g) => {
        const [a, m] = await Promise.all([getDoc(examAssessmentRef(g.id, p.id)), getDoc(examMarksRef(g.id, p.id))]);
        const key = `${p.id}|${g.id}`;
        if (a.exists()) assessments[key] = { id: a.id, ...a.data() };
        marks[key] = m.exists() ? (m.data().entries ?? {}) : {};
      })));

      // Subject reports for the term + report-card docs
      const reports = {};
      if (win.termId) {
        const rs = await getDocs(query(collection(db, 'reports'), where('termId', '==', win.termId)));
        rs.docs.forEach((d) => { reports[d.id] = { id: d.id, ...d.data() }; });
      }
      const cards = {};
      const cs = await getDocs(query(collection(db, 'reports'), where('windowId', '==', windowId)));
      cs.docs.forEach((d) => { cards[d.data().studentId] = { id: d.id, ...d.data() }; });

      if (!cancelled) setBase({ students, forms, groups, syllabi, sittings, users, assessments, marks, reports, cards });
    })().catch((e) => { console.error(e); if (!cancelled) setBase((b) => b ?? { error: e.code ?? e.message }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win?.id, win?.forms?.join(','), win?.termId, papers.map((p) => p.id).join(','), tick]);

  return {
    loading: win === null || (win && !base),
    notFound: win === false,
    win: win || null, papers, reload,
    ...(base ?? { students: [], forms: [], groups: [], syllabi: [], sittings: {}, users: [], assessments: {}, marks: {}, reports: {}, cards: {} }),
  };
}

/**
 * Does a paper apply to students in this form (student.classId)? Papers carry
 * classIds when one subject has a different paper per form (F1 vs F2 Geography);
 * a paper without classIds is sat by every form taking the subject.
 */
export const paperForClass = (paper, classId) => !paper?.classIds?.length || paper.classIds.includes(classId);

/** Teaching groups that sit a paper: its subject's groups with a student in the paper's forms. */
export function paperGroups(groups, students, paper) {
  const sameSubject = groups.filter((g) => g.syllabusId === paper.syllabusId);
  if (!paper.classIds?.length) return sameSubject;
  const inForms = new Set(students.filter((s) => paper.classIds.includes(s.classId)).map((s) => s.id));
  return sameSubject.filter((g) => (g.studentIds ?? []).some((id) => inForms.has(id)));
}

/** Students who sit a paper: in one of its groups, and in one of its forms. */
export function paperCandidates(groups, students, paper) {
  const ids = new Set(paperGroups(groups, students, paper).flatMap((g) => g.studentIds ?? []));
  return students.filter((s) => ids.has(s.id) && paperForClass(paper, s.classId));
}

/** Classes in the window that take a subject: [{ id, name }] (window order). */
export function classesTakingSubject(data, syllabusId) {
  const byStudent = Object.fromEntries(data.students.map((s) => [s.id, s.classId]));
  const ids = new Set(data.groups.filter((g) => g.syllabusId === syllabusId)
    .flatMap((g) => (g.classId ? [g.classId] : (g.studentIds ?? []).map((id) => byStudent[id]))));
  return data.forms.filter((f) => ids.has(f.id) && (data.win?.forms ?? []).includes(f.id));
}

const formNumber = (name) => { const n = String(name).trim().toUpperCase(); return /^L6\b/.test(n) ? 5 : /^U6\b/.test(n) ? 6 : Number(n.match(/^(?:FORM\s*)?(\d)/)?.[1]) || null; };

/**
 * Timetable-style label for the classes a paper is for: one class "F3E";
 * every class of a form that takes the subject "F3"; otherwise the class names.
 * @param classIds chosen class ids; available [{ id, name }] classes taking the subject
 */
export function formLabelFor(classIds, available) {
  const chosen = available.filter((c) => classIds.includes(c.id));
  if (!chosen.length) return '';
  const tag = (name) => (/^\d/.test(name) ? `F${name}` : name);
  if (chosen.length === 1) return tag(chosen[0].name);
  const nums = [...new Set(chosen.map((c) => formNumber(c.name)))];
  if (nums.length === 1 && nums[0] && available.filter((c) => formNumber(c.name) === nums[0]).length === chosen.length) return `F${nums[0]}`;
  return chosen.map((c) => tag(c.name)).join(', ');
}

/**
 * Has the paper been written? True once its timetabled end time (date + start +
 * duration) has passed, or the invigilator has confirmed attendance. Scripts open
 * for marking then; nobody waits for attendance, everyone counts as present unless
 * recorded absent / sick / excused / malpractice.
 */
export function paperWritten(p, now = new Date()) {
  if (p?.attendanceSubmitted) return true;
  if (!p?.date || !p?.start) return false;
  const end = new Date(`${p.date}T${p.start}`);
  if (Number.isNaN(end.getTime())) return false;
  end.setMinutes(end.getMinutes() + (Number(p.duration) || 0));
  return now >= end;
}

/** "Wed 18 Nov, 12:30" — when a paper's scripts open for marking. */
export function paperEndsAt(p) {
  if (!p?.date || !p?.start) return '';
  const end = new Date(`${p.date}T${p.start}`);
  end.setMinutes(end.getMinutes() + (Number(p.duration) || 0));
  return end.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Every exam paper is one question out of 100 until its setter builds the real
 * layout; if nobody does, that is the exam. Use these instead of p.questions / p.maxMark.
 */
export const DEFAULT_QUESTIONS = [{ no: '1', marks: 100, topicId: '' }];
export const paperQuestions = (p) => (p?.questions?.length ? p.questions : DEFAULT_QUESTIONS);
export const paperMaxMark = (p) => paperQuestions(p).reduce((a, q) => a + (Number(q.marks) || 0), 0);

/** "4024 Paper 1 (F3)" — the form is shown when the paper is for particular forms. */
export const paperLabel = (p) => [p.syllabusCode, p.paper, p.formLabel ? `(${p.formLabel})` : ''].filter(Boolean).join(' ');

/** Subjects in the window: syllabi that have a group with a student in the window's forms. */
export function windowSubjects(data) {
  const ids = [...new Set(data.groups.map((g) => g.syllabusId).filter(Boolean))];
  const syl = byId(data.syllabi);
  return ids.map((id) => syl[id] ?? { id, code: id, name: id }).sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''));
}

/** The group a student is taught a subject in. */
export function groupFor(groups, studentId, syllabusId) {
  return groups.find((g) => g.syllabusId === syllabusId && (g.studentIds ?? []).includes(studentId));
}

/** Weights for a subject in a window (falls back to syllabus requirement + default split). */
export function subjectWeights(win, syl) {
  const set = win?.subjects?.[syl.id];
  if (set) return set;
  if (syllabusRequiresCoursework(syl)) {
    const cw = syllabusCourseworkWeight(syl) ?? Number(win?.defaultSplit?.coursework ?? 30);
    return { mode: 'examCoursework', exam: 100 - cw, coursework: cw };
  }
  return { mode: 'exam' };
}

const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * Stage status per subject: 'done' | 'progress' | 'late' | 'todo'.
 * Derived from the data, so it can never disagree with what is actually stored.
 */
export function stageStatus(data, syllabusId, stageKey) {
  const { win, papers, groups, students, assessments, reports, cards } = data;
  const sp = papers.filter((p) => p.syllabusId === syllabusId);
  const sg = groups.filter((g) => g.syllabusId === syllabusId);
  const pairs = sp.flatMap((p) => paperGroups(groups, students, p).map((g) => assessments[`${p.id}|${g.id}`]));
  let done = false, started = false;
  switch (stageKey) {
    case 'setup': done = !!win.approved; started = true; break;
    case 'papers': done = sp.length > 0 && sp.every((p) => p.status === 'vetted' || p.status === 'printed');
      started = sp.length > 0; break;
    case 'timetable': done = !!win.timetablePublished && sp.length > 0 && sp.every((p) => p.date && p.start);
      started = sp.some((p) => p.date); break;
    case 'sitting': done = sp.length > 0 && sp.every((p) => paperWritten(p)); started = sp.some((p) => paperWritten(p)); break;
    case 'marking': done = pairs.length > 0 && pairs.every((a) => a?.submitted); started = pairs.some((a) => a); break;
    case 'moderation': done = pairs.length > 0 && pairs.every((a) => a?.locked && a?.moderation === 'accepted');
      started = pairs.some((a) => a?.moderation); break;
    case 'results': done = !!win.resultsChecked; started = done; break;
    case 'comments': {
      const sids = new Set(students.map((s) => s.id));
      const need = sg.flatMap((g) => (g.studentIds ?? []).filter((id) => sids.has(id)).map((id) => reports[subjectReportId(g.id, win.termId, id)]));
      done = need.length > 0 && need.every((r) => r?.subjectComment?.trim() && r?.effort);
      started = need.some((r) => r?.subjectComment?.trim());
      break;
    }
    case 'approval': done = students.length > 0 && students.every((s) => ['approved', 'published'].includes(cards[s.id]?.status));
      started = students.some((s) => cards[s.id]?.status === 'approved'); break;
    case 'published': done = !!win.published; break;
    default:
  }
  if (done) return 'done';
  const due = win?.stageDue?.[stageKey];
  if (due && isoToday() > due) return 'late';
  return started ? 'progress' : 'todo';
}
