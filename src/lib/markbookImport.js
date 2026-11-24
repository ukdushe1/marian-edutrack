/**
 * Import a class mark list into the Markbook from a spreadsheet.
 * Columns: id (from the template, optional), name, then one column per assessment.
 * A column matches an assessment by title; a new title with "(/N)" in its heading
 * ("Test 3 (/20)") becomes a new assessment out of N. Cells: a mark, A/ABS
 * (absent) or X/EXM (exempt); blank = leave as is.
 * An End of Term exam column is imported as each student's exam total; there,
 * A = absent and X = absent with valid reason, and Sitting / Marking follow.
 * Pure: returns what would be saved plus anything to fix, for a preview.
 */

const nameKey = (s) => String(s ?? '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const titleKey = (s) => String(s ?? '').replace(/\(\s*\/\s*\d+(\.\d+)?\s*\)/, '').trim().toLowerCase().replace(/\s+/g, ' ');
const maxFromHeader = (h) => { const m = String(h).match(/\(\s*\/\s*(\d+(?:\.\d+)?)\s*\)/); return m ? Number(m[1]) : null; };
const NAME_COLS = ['name', 'student', 'studentname', 'learner', 'nameoflearner'];
const flat = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

/** Template rows: hidden id, name, one column per existing assessment (exams included). */
export function markbookTemplateRows(students, assessments) {
  const cols = assessments;
  return [
    ['id', 'name', ...cols.map((a) => `${a.title} (/${a.maxMark})`)],
    ...students.map((s) => [s.id, `${s.surname}, ${s.firstName}`, ...cols.map(() => '')]),
  ];
}

/**
 * @param rows sheet rows as objects (header → value)
 * @param students [{ id, surname, firstName }]
 * @param assessments [{ id, title, maxMark, examPaperId? }]
 * @returns { columns: [{ header, assessmentId?, examPaperId?, newTitle?, maxMark, count }],
 *            updates: { [assessmentId | 'new:<title>']: { [sid]: { raw, status } } },
 *            errors, unmatched, ignored }
 */
export function planMarkbookImport({ rows, students, assessments }) {
  const errors = [], unmatched = [], ignored = [];
  const updates = {}, columns = [];
  if (!rows.length) return { columns, updates, errors: ['The file has no rows.'], unmatched, ignored };

  const headers = Object.keys(rows[0]);
  const idCol = headers.find((h) => flat(h) === 'id');
  const nameCol = headers.find((h) => NAME_COLS.includes(flat(h)));
  if (!idCol && !nameCol) return { columns, updates, errors: ['No name column found. Use the template, or add a "name" column.'], unmatched, ignored };

  for (const h of headers) {
    if (h === idCol || h === nameCol || /^__EMPTY/.test(h)) continue;
    const a = assessments.find((x) => titleKey(x.title) === titleKey(h));
    if (a?.examPaperId) { columns.push({ header: h, assessmentId: a.id, examPaperId: a.examPaperId, maxMark: Number(a.maxMark), key: a.id, count: 0 }); continue; }
    if (a) { columns.push({ header: h, assessmentId: a.id, maxMark: Number(a.maxMark), key: a.id, count: 0 }); continue; }
    const max = maxFromHeader(h);
    if (max) { columns.push({ header: h, newTitle: String(h).replace(/\(\s*\/[^)]*\)/, '').trim(), maxMark: max, key: `new:${titleKey(h)}`, count: 0 }); continue; }
    ignored.push(`"${h}" doesn't match an assessment. To add it as a new one, write its maximum in the heading, e.g. "${h} (/20)".`);
  }
  if (!columns.length) return { columns, updates, errors: errors.length ? errors : ['No mark columns found.'], unmatched, ignored };

  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const byName = new Map();
  students.forEach((s) => { const k = nameKey(`${s.surname} ${s.firstName}`); byName.set(k, byName.has(k) ? null : s); });

  rows.forEach((r, i) => {
    const line = i + 2;
    const cells = columns.map((c) => r[c.header]);
    if (cells.every((v) => v === '' || v == null)) return;
    const s = (idCol && byId[String(r[idCol]).trim()]) || (nameCol && byName.get(nameKey(r[nameCol])));
    if (!s) { unmatched.push(`Row ${line}: ${nameCol ? r[nameCol] || '(no name)' : '(no name)'} is not in this class.`); return; }
    columns.forEach((c, k) => {
      const v = String(cells[k] ?? '').trim();
      if (!v) return;
      const code = v.toUpperCase();
      let entry;
      if (code === 'A' || code === 'ABS') entry = { raw: null, status: 'absent' };
      else if (code === 'X' || code === 'EXM') entry = { raw: null, status: c.examPaperId ? 'excused' : 'exempt' };
      else {
        const n = Number(v);
        if (Number.isNaN(n) || n < 0 || n > c.maxMark) { errors.push(`Row ${line} (${s.surname}, ${s.firstName}): ${c.header} = "${v}" must be 0–${c.maxMark}, A or X.`); return; }
        entry = { raw: n, status: null };
      }
      (updates[c.key] ??= {})[s.id] = entry;
      c.count++;
    });
  });
  return { columns, updates, errors, unmatched, ignored };
}
