/**
 * Connects stored window data to the pure results engine (results.js).
 */
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { computeForm, averagePercent } from './results';
import { windowSubjects, subjectWeights, groupFor, DEFAULT_BANDS } from './model';

const COURSEWORK_COMPONENTS = /course\s*work|practical|project|school[-\s]?based|\bsba\b/i;

/**
 * Coursework % per subject per student = average % of the class's markbook
 * assessments whose component is coursework/practical, dated within
 * [courseworkFrom, endDate]. Only for subjects that require coursework.
 * Returns { [syllabusId]: { [studentId]: pct } }.
 */
export async function loadCoursework(data) {
  const { win, groups, syllabi } = data;
  const out = {};
  const subjects = windowSubjects({ ...data, syllabi });
  const need = subjects.filter((s) => subjectWeights(win, s).mode === 'examCoursework');
  await Promise.all(need.map(async (syl) => {
    out[syl.id] = {};
    await Promise.all(groups.filter((g) => g.syllabusId === syl.id).map(async (g) => {
      const as = await getDocs(collection(db, 'teachingGroups', g.id, 'assessments'));
      const cw = as.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((a) => !a.examPaperId && COURSEWORK_COMPONENTS.test(a.component ?? '')
          && (!win.courseworkFrom || (a.date ?? '') >= win.courseworkFrom)
          && (!win.endDate || (a.date ?? '') <= win.endDate));
      const marks = await Promise.all(cw.map((a) => getDoc(doc(db, 'teachingGroups', g.id, 'assessments', a.id, 'marks', 'entries'))));
      for (const sid of g.studentIds ?? []) {
        const items = cw.map((a, i) => {
          const e = marks[i].exists() ? marks[i].data().entries?.[sid] : null;
          return { raw: e?.status ? null : e?.raw ?? null, maxMark: Number(a.maxMark) || 0 };
        });
        const pct = averagePercent(items);
        if (pct != null) out[syl.id][sid] = pct;
      }
    }));
  }));
  return out;
}

/** Build the engine input for one form and run it. */
export function formResults(data, formId, coursework = {}) {
  const { win, papers, groups, students, marks, sittings } = data;
  const formStudents = students.filter((s) => s.classId === formId);
  const subjects = windowSubjects(data).map((syl) => ({
    id: syl.id,
    code: syl.code,
    name: syl.name,
    weights: subjectWeights(win, syl),
    papers: papers.filter((p) => p.syllabusId === syl.id).map((p) => ({ id: p.id, maxMark: Number(p.maxMark) || 0 })),
  })).filter((s) => s.papers.length > 0);

  const takes = {};
  const markIn = {};
  for (const s of formStudents) {
    takes[s.id] = [];
    for (const subj of subjects) {
      const g = groupFor(groups, s.id, subj.id);
      if (!g) continue;
      takes[s.id].push(subj.id);
      (markIn[subj.id] ??= {})[s.id] = {};
      for (const p of subj.papers) {
        const e = marks[`${p.id}|${g.id}`]?.[s.id];
        markIn[subj.id][s.id][p.id] = e?.status ? null : e?.raw ?? null;
      }
    }
  }
  const res = computeForm({
    students: formStudents, subjects, takes, marks: markIn, sittings, coursework,
    bands: win.gradeBands?.length ? win.gradeBands : DEFAULT_BANDS,
    minSubjects: Number(win.minSubjects ?? 5),
  });
  return { ...res, subjects, students: formStudents };
}

/**
 * Term attendance (roll call) and conduct per student, between courseworkFrom/startDate and endDate.
 * Returns { [studentId]: { present, total, pct, merits, demerits, incidents } }.
 */
export async function loadAttendanceConduct(data) {
  const { win, students } = data;
  const from = win.courseworkFrom || win.startDate || '0000';
  const to = win.endDate || '9999';
  const out = Object.fromEntries(students.map((s) => [s.id, { present: 0, total: 0, pct: null, merits: 0, demerits: 0, incidents: 0 }]));
  const [regs, cond] = await Promise.all([
    getDocs(query(collection(db, 'registers'), where('period', '==', 'Tutor'))),
    getDocs(collection(db, 'conduct')),
  ]);
  regs.docs.forEach((d) => {
    const r = d.data();
    if (r.date < from || r.date > to) return;
    for (const [sid, st] of Object.entries(r.entries ?? {})) {
      const o = out[sid]; if (!o) continue;
      if (st === 'E') continue;               // excused (e.g. exeat) — not counted either way
      o.total++; if (st === 'P' || st === 'L') o.present++;
    }
  });
  cond.docs.forEach((d) => {
    const c = d.data(); const o = out[c.studentId];
    if (!o || (c.date && (c.date < from || c.date > to))) return;
    if (c.type === 'merit') o.merits++; else if (c.type === 'demerit') o.demerits++; else if (c.type === 'incident') o.incidents++;
  });
  for (const o of Object.values(out)) o.pct = o.total ? (o.present / o.total) * 100 : null;
  return out;
}
