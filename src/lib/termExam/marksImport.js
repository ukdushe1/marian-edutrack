/**
 * Import exam marks for one paper × class from a spreadsheet.
 * Columns: id (from the template), name, then one column per question ("Q1", "Q2a"…).
 * A paper with a single question may use "Total" instead.
 * "A" (absent) or "X" (absent with valid reason) in a mark cell records attendance.
 * Pure: returns what would be saved plus anything to fix, for a preview.
 */

import { EXAM_CODES } from './examProgress';

const key = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nameKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');

/** Rows for the template: one per student, blank question columns. */
export function marksTemplateRows(students, questions) {
  const head = ['id', 'name', ...questions.map((q) => `Q${q.no} (/${q.marks})`)];
  return [head, ...students.map((s) => [s.id, `${s.surname}, ${s.firstName}`, ...questions.map(() => '')])];
}

/**
 * @param rows sheet rows as objects (header → value)
 * @param students [{ id, surname, firstName }] in this class for this paper
 * @param questions [{ no, marks }]
 * @returns { updates: { [sid]: { perQuestion, raw } }, statuses: { [sid]: 'absent'|'excused' }, errors, unmatched }
 *   A student recorded absent who now has marks becomes present (see examSync).
 */
export function planMarksImport({ rows, students, questions }) {
  const errors = [], unmatched = [];
  const updates = {}, statuses = {};
  if (!rows.length) return { updates, statuses, errors: ['The file has no rows.'], unmatched };

  // Which column holds each question ("Q1 (/10)", "q1", "1" all match question 1)
  const headers = Object.keys(rows[0]);
  const colFor = {};
  for (const q of questions) {
    const want = key(q.no);
    const h = headers.find((x) => { const k = key(String(x).replace(/\(.*\)/, '')); return k === `q${want}` || k === want; });
    if (h) colFor[q.no] = h;
  }
  const totalCol = headers.find((x) => key(x) === 'total');
  if (!Object.keys(colFor).length && totalCol && questions.length === 1) colFor[questions[0].no] = totalCol;
  if (!Object.keys(colFor).length) {
    return { updates, statuses, errors: [questions.length > 1
      ? `No question columns found. Use the template: one column per question (${questions.map((q) => `Q${q.no}`).join(', ')}).`
      : 'No mark column found. Use the template, or a "Total" column.'], unmatched };
  }
  const idCol = headers.find((x) => key(x) === 'id');
  const nameCol = headers.find((x) => ['name', 'student', 'studentname', 'learner', 'nameoflearner'].includes(key(x)));
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const byName = new Map();
  students.forEach((s) => { const k = nameKey(`${s.surname} ${s.firstName}`); byName.set(k, byName.has(k) ? null : s); });

  rows.forEach((r, i) => {
    const line = i + 2;
    const marks = questions.map((q) => r[colFor[q.no]]);
    if (marks.every((v) => v === '' || v == null)) return; // nothing entered
    const s = (idCol && byId[String(r[idCol]).trim()]) || (nameCol && byName.get(nameKey(r[nameCol])));
    if (!s) { unmatched.push(`Row ${line}: ${nameCol ? r[nameCol] || '(no name)' : '(no name column)'} is not in this class.`); return; }
    const code = marks.map((v) => EXAM_CODES[String(v ?? '').trim().toUpperCase()]).find(Boolean);
    if (code) { statuses[s.id] = code; return; }
    const perQuestion = {};
    let bad = false;
    questions.forEach((q, k) => {
      const v = marks[k];
      if (v === '' || v == null) { perQuestion[q.no] = null; return; }
      const n = Number(String(v).trim());
      if (Number.isNaN(n) || n < 0 || n > q.marks) { errors.push(`Row ${line} (${s.surname}, ${s.firstName}): Q${q.no} = "${v}" must be 0–${q.marks}.`); bad = true; return; }
      perQuestion[q.no] = n;
    });
    if (bad) return;
    const vals = Object.values(perQuestion).filter((v) => v != null);
    updates[s.id] = { perQuestion, raw: vals.length ? vals.reduce((a, v) => a + v, 0) : null };
  });
  return { updates, statuses, errors, unmatched };
}
