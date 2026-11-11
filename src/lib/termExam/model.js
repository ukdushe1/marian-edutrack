/**
 * End-of-term exam module — data model, stage definitions and loaders.
 *
 * Collections
 *   examWindows/{id}     name, termId, startDate, endDate, courseworkFrom, nextTermOpens,
 *                        forms[] (student classId values), defaultSplit {exam, coursework},
 *                        subjects {[syllabusId]: {mode:'exam'|'examCoursework', exam, coursework}},
 *                        gradeBands [{grade,min}], minSubjects, stageDue {[stage]: date},
 *                        approved/approvedBy, timetablePublished, resultsChecked/checkedBy,
 *                        published/publishedAt/version, formNotes {[formId]: note}
 *   examPapers/{id}      windowId, syllabusId, syllabusCode, paper, maxMark, duration,
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
  { key: 'sitting',    n: 4,  label: 'Sitting',     who: 'Invigilators',         signoff: 'Every paper’s attendance submitted' },
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

export const DEFAULT_BANDS = [
  { grade: 'A', min: 75 }, { grade: 'B', min: 65 }, { grade: 'C', min: 50 },
  { grade: 'D', min: 40 }, { grade: 'E', min: 30 }, { grade: 'U', min: 0 },
];

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
        .sort((a, b) => (a.surname ?? '').localeCompare(b.surname ?? ''));
      const sidSet = new Set(students.map((s) => s.id));
      const groups = grpS.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((g) => (g.studentIds ?? []).some((id) => sidSet.has(id)));
      const syllabi = sylS.docs.map((d) => ({ id: d.id, ...d.data() }));
      const sittings = {};
      sitS.docs.forEach((d) => { const x = d.data(); (sittings[x.studentId] ??= {})[x.paperId] = x.status; });
      const users = usrS.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Exam assessments + marks for each paper × group of its subject
      const assessments = {}, marks = {};
      await Promise.all(papers.flatMap((p) => groups.filter((g) => g.syllabusId === p.syllabusId).map(async (g) => {
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
  const pairs = sp.flatMap((p) => sg.map((g) => assessments[`${p.id}|${g.id}`]));
  let done = false, started = false;
  switch (stageKey) {
    case 'setup': done = !!win.approved; started = true; break;
    case 'papers': done = sp.length > 0 && sp.every((p) => p.status === 'vetted' || p.status === 'printed');
      started = sp.length > 0; break;
    case 'timetable': done = !!win.timetablePublished && sp.length > 0 && sp.every((p) => p.date && p.start && p.venue);
      started = sp.some((p) => p.date); break;
    case 'sitting': done = sp.length > 0 && sp.every((p) => p.attendanceSubmitted); started = sp.some((p) => p.attendanceSubmitted); break;
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
