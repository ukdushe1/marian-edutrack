/**
 * Import End of Term marks for a whole class, every subject, from one sheet.
 * Columns: id (from the template), name, then one column per subject paper:
 *   "ENG (/100)" for a one-paper subject, "MATHS Pure P1 (/100)" when there are several.
 * Cells: a mark, A / ABS (absent), X (absent with valid reason); blank = leave as is.
 * Pure: returns what would be saved per paper plus anything to fix, for a preview.
 */
import { EXAM_CODES } from './examProgress';

const norm = (s) => String(s ?? '').replace(/\(\s*\/[^)]*\)/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const nameKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const flat = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * Columns for a class: one per paper the class sits.
 * @param subjects [{ id, heading, name, papers: [{ id, label, max }] }] (school order)
 */
export function classMarkColumns(subjects) {
  return subjects.flatMap((s) => s.papers.map((p) => ({
    header: `${s.heading}${s.papers.length > 1 ? ` ${p.label}` : ''} (/${p.max})`,
    subjectId: s.id, subjectName: s.name, paperId: p.id, max: p.max,
  })));
}

/** Template rows: hidden id, name, a blank column per subject paper. */
export function classMarksTemplate(students, columns) {
  return [['id', 'name', ...columns.map((c) => c.header)],
    ...students.map((s) => [s.id, `${s.surname}, ${s.firstName}`, ...columns.map(() => '')])];
}

/**
 * @param takes (studentId, subjectId) => boolean — whether the student takes that subject
 * @returns { columns: [...with count], updates: { [paperId]: { [sid]: { raw } | { status } } }, errors, unmatched, ignored }
 */
export function planClassMarksImport({ rows, students, columns, takes = () => true }) {
  const errors = [], unmatched = [], ignored = [], updates = {};
  if (!rows.length) return { columns: [], updates, errors: ['The file has no rows.'], unmatched, ignored };
  const headers = Object.keys(rows[0]);
  const idCol = headers.find((h) => flat(h) === 'id');
  const nameCol = headers.find((h) => ['name', 'student', 'studentname', 'learner', 'nameoflearner'].includes(flat(h)));
  if (!idCol && !nameCol) return { columns: [], updates, errors: ['No name column found. Use the template.'], unmatched, ignored };

  const used = [];
  for (const h of headers) {
    if (h === idCol || h === nameCol || /^__EMPTY/.test(h)) continue;
    const c = columns.find((x) => norm(x.header) === norm(h));
    if (c) used.push({ ...c, sheetHeader: h, count: 0 });
    else ignored.push(`"${h}" doesn't match a subject paper this class sits — column skipped.`);
  }
  if (!used.length) return { columns: [], updates, errors: ['No subject columns found. Use the class marks template.'], unmatched, ignored };

  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const byName = new Map();
  students.forEach((s) => { const k = nameKey(`${s.surname} ${s.firstName}`); byName.set(k, byName.has(k) ? null : s); });

  rows.forEach((r, i) => {
    const line = i + 2;
    if (used.every((c) => String(r[c.sheetHeader] ?? '').trim() === '')) return;
    const s = (idCol && byId[String(r[idCol]).trim()]) || (nameCol && byName.get(nameKey(r[nameCol])));
    if (!s) { unmatched.push(`Row ${line}: ${nameCol ? r[nameCol] || '(no name)' : '(no name)'} is not in this class.`); return; }
    for (const c of used) {
      const v = String(r[c.sheetHeader] ?? '').trim();
      if (!v) continue;
      if (!takes(s.id, c.subjectId)) { errors.push(`Row ${line} (${s.surname}, ${s.firstName}): doesn't take ${c.subjectName} — mark skipped.`); continue; }
      const code = EXAM_CODES[v.toUpperCase()];
      let entry;
      if (code) entry = { status: code };
      else {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0 || n > c.max) { errors.push(`Row ${line} (${s.surname}, ${s.firstName}): ${c.header} = "${v}" must be 0–${c.max}, A or X.`); continue; }
        entry = { raw: n };
      }
      (updates[c.paperId] ??= {})[s.id] = entry;
      c.count++;
    }
  });
  return { columns: used, updates, errors, unmatched, ignored };
}
