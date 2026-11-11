/**
 * End-of-term results — pure calculation, no Firestore. Unit-tested.
 *
 * Agreed rules (2026-11 review):
 *  - Subjects are exam only unless the syllabus requires coursework.
 *    With coursework: final % = exam % × exam weight + coursework % × coursework weight.
 *    Coursework required but missing → flagged; the subject gets no final % (never exam = 100%).
 *  - Paper status: present → marks; absent (unexcused) → 0; malpractice → 0 + flagged;
 *    excused / sick (valid reason) → "X": left out of the exam %, and if every paper of the
 *    subject is X the subject is X (no final %, left out of positions).
 *  - Positions are within the form; equal scores (to 1 decimal place) share a position
 *    (1, 2, 2, 4); shown "out of" the number who have a final % in that subject.
 *  - Overall average = mean of a student's final %s; overall position only for students with
 *    at least `minSubjects` final %s, ranked among those.
 */

export const VALID_ABSENCE = ['excused', 'sick'];   // → X
export const ZERO_STATUS   = ['absent', 'malpractice']; // → 0

const round1 = (n) => Math.round(n * 10) / 10;

/** Grade from bands [{grade, min}] (min %, any order). */
export function gradeFor(pct, bands) {
  if (pct == null) return 'X';
  const sorted = [...(bands ?? [])].sort((a, b) => b.min - a.min);
  return sorted.find((b) => pct >= b.min)?.grade ?? sorted.at(-1)?.grade ?? '—';
}

/**
 * Competition ranking within one list. `items` = [{id, score}] (score null = unranked).
 * Scores compared at 1 decimal. Returns { [id]: position } and the count ranked.
 */
export function rank(items) {
  const scored = items.filter((i) => i.score != null)
    .map((i) => ({ id: i.id, s: round1(i.score) }))
    .sort((a, b) => b.s - a.s);
  const pos = {};
  scored.forEach((it, idx) => {
    pos[it.id] = idx > 0 && it.s === scored[idx - 1].s ? pos[scored[idx - 1].id] : idx + 1;
  });
  return { positions: pos, outOf: scored.length };
}

/**
 * Exam % for one student in one subject.
 * papers: [{id, maxMark}], marks: {[paperId]: raw|null}, sittings: {[paperId]: status}
 * Returns { examPct, x, flags[] }.
 */
export function examPercent(papers, marks, sittings) {
  let got = 0, max = 0, counted = 0;
  const flags = [];
  for (const p of papers) {
    const st = sittings?.[p.id] ?? 'present';
    if (VALID_ABSENCE.includes(st)) continue;               // X — not counted
    if (st === 'malpractice') flags.push({ type: 'malpractice', paperId: p.id });
    const raw = ZERO_STATUS.includes(st) ? 0 : marks?.[p.id];
    if (raw == null) { flags.push({ type: 'unmarked', paperId: p.id }); continue; }
    got += Number(raw); max += Number(p.maxMark); counted++;
  }
  if (!counted) return { examPct: null, x: papers.length > 0 && flags.every((f) => f.type !== 'unmarked'), flags };
  return { examPct: (got / max) * 100, x: false, flags };
}

/**
 * Final % for a subject.
 * weights: { mode: 'exam' | 'examCoursework', exam, coursework } (percentages summing to 100)
 */
export function finalPercent(examPct, courseworkPct, weights) {
  if (examPct == null) return { finalPct: null, flag: null };
  if (weights?.mode !== 'examCoursework') return { finalPct: examPct, flag: null };
  if (courseworkPct == null) return { finalPct: null, flag: 'missingCoursework' };
  const e = Number(weights.exam) / 100, c = Number(weights.coursework) / 100;
  return { finalPct: examPct * e + courseworkPct * c, flag: null };
}

/**
 * Whole-form results.
 * input = {
 *   students: [{id}],
 *   subjects: [{ id, weights, papers: [{id, maxMark}] }],
 *   takes:    { [studentId]: [subjectId] }           // subjects each student takes
 *   marks:    { [subjectId]: { [studentId]: { [paperId]: raw } } }
 *   sittings: { [studentId]: { [paperId]: status } }
 *   coursework: { [subjectId]: { [studentId]: pct } }
 *   bands, minSubjects
 * }
 * Returns { byStudent: { [sid]: { subjects: {...}, overallAvg, overallPos, overallOutOf, counted } },
 *           subjectStats: { [subjectId]: { average, outOf } }, flags: [...] }
 */
export function computeForm(input) {
  const { students, subjects, takes, marks, sittings, coursework, bands, minSubjects = 5 } = input;
  const byStudent = {};
  const flags = [];
  const subjectStats = {};

  for (const s of students) byStudent[s.id] = { subjects: {}, overallAvg: null, overallPos: null, overallOutOf: 0, counted: 0 };

  for (const subj of subjects) {
    const takers = students.filter((s) => (takes[s.id] ?? []).includes(subj.id));
    const rows = [];
    for (const s of takers) {
      const ex = examPercent(subj.papers, marks?.[subj.id]?.[s.id], sittings?.[s.id]);
      ex.flags.forEach((f) => flags.push({ ...f, studentId: s.id, subjectId: subj.id }));
      const cw = subj.weights?.mode === 'examCoursework' ? (coursework?.[subj.id]?.[s.id] ?? null) : null;
      const fin = ex.x ? { finalPct: null, flag: null } : finalPercent(ex.examPct, cw, subj.weights);
      if (fin.flag) flags.push({ type: fin.flag, studentId: s.id, subjectId: subj.id });
      const r = {
        courseworkPct: subj.weights?.mode === 'examCoursework' ? cw : undefined,
        examPct: ex.examPct, finalPct: fin.finalPct, x: ex.x,
        grade: ex.x ? 'X' : fin.finalPct == null ? '—' : gradeFor(fin.finalPct, bands),
      };
      byStudent[s.id].subjects[subj.id] = r;
      rows.push({ id: s.id, score: r.finalPct });
    }
    const { positions, outOf } = rank(rows);
    const vals = rows.map((r) => r.score).filter((v) => v != null);
    subjectStats[subj.id] = { average: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, outOf };
    for (const r of rows) byStudent[r.id].subjects[subj.id].position = positions[r.id] ?? null;
  }

  // Overall
  const overall = [];
  for (const s of students) {
    const finals = Object.values(byStudent[s.id].subjects).map((r) => r.finalPct).filter((v) => v != null);
    const st = byStudent[s.id];
    st.counted = finals.length;
    st.overallAvg = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : null;
    overall.push({ id: s.id, score: finals.length >= minSubjects ? st.overallAvg : null });
  }
  const { positions, outOf } = rank(overall);
  for (const s of students) {
    byStudent[s.id].overallPos = positions[s.id] ?? null;
    byStudent[s.id].overallOutOf = outOf;
  }
  return { byStudent, subjectStats, flags };
}

/** Average % of a list of {raw, maxMark}; null if none. */
export function averagePercent(items) {
  const ok = items.filter((i) => i.raw != null && i.maxMark > 0);
  if (!ok.length) return null;
  return ok.reduce((a, i) => a + (i.raw / i.maxMark) * 100, 0) / ok.length;
}

export const fmtPct = (v) => (v == null ? '—' : `${round1(v)}%`);
