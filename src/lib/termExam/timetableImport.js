/**
 * Turn a school exam timetable (src/lib/examTimetable/*) into End-of-Term papers.
 * Pure: takes the school's classes, teaching groups and staff, returns the papers
 * to write plus anything it could not match, for the review screen.
 *
 * Forms on the timetable: "F3" = every Form 3 class, "F3D1" / "F1E" = that class.
 * Subjects: "Computer Science / ICT" = whichever of the two each class takes.
 */
import { subjectKey, subjectAt, formOf } from '../schoolSetup/schoolSetup';

const norm = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Classes a timetable form label refers to. */
export function classesForForm(label, classes) {
  const m = String(label).trim().toUpperCase().match(/^F(\d)(.*)$/);
  if (!m) return [];
  const n = Number(m[1]);
  const suffix = norm(m[2]);
  return classes.filter((c) => (c.form ?? formOf(c.name)) === n
    && (!suffix || norm(c.name).replace(/^FORM/, '').startsWith(`${n}${suffix}`)));
}

/** Everyone who could invigilate: every account except parent-only ones (incl. staff not given a role yet). */
export const staffAccounts = (users) => users.filter((u) => !((u.roles ?? []).length && (u.roles ?? []).every((r) => r === 'parent')));

/** Staff whose name contains this surname as a whole word. */
export function staffBySurname(surname, users) {
  const s = String(surname).trim().toLowerCase();
  return staffAccounts(users).filter((u) => String(u.name ?? '').toLowerCase().split(/[^a-z']+/).includes(s));
}

/**
 * @param sessions timetable rows: { id, date, slot, start, form, subject, paper, duration, invigilatorNames }
 * @param classes  [{ id, name, form }]
 * @param groups   [{ id, classId, syllabusId, syllabusCode }]
 * @param users    [{ id, name, roles }]
 * @returns { papers: [{ id, data }], skipped: [{ row, reason }], invigilators: { [surname]: userId|null },
 *            ambiguous: { [surname]: names[] }, classIds: string[] }
 */
export function planTimetableImport({ windowId, sessions, classes, groups, users }) {
  const papers = [], skipped = [];
  const formClassIds = new Set(); // every class the timetable covers = the window's forms
  const invigilators = {}, ambiguous = {};
  for (const name of new Set(sessions.flatMap((r) => r.invigilatorNames ?? []))) {
    const hits = staffBySurname(name, users);
    invigilators[name] = hits.length === 1 ? hits[0].id : null;
    if (hits.length > 1) ambiguous[name] = hits.map((u) => u.name);
  }

  for (const row of sessions) {
    const rowClasses = classesForForm(row.form, classes);
    if (!rowClasses.length) { skipped.push({ row, reason: `no class matches ${row.form}` }); continue; }
    rowClasses.forEach((c) => formClassIds.add(c.id));
    const keys = row.subject.split('/').map((x) => subjectKey(x.trim())).filter(Boolean);
    if (!keys.length) { skipped.push({ row, reason: `unknown subject “${row.subject}”` }); continue; }

    // One paper per syllabus, sat by the row's classes that take it
    const bySyllabus = new Map();
    for (const key of keys) {
      for (const c of rowClasses) {
        const code = subjectAt(key, c.form ?? formOf(c.name)).code;
        const g = groups.find((x) => x.classId === c.id && x.syllabusCode === code);
        if (!g) continue;
        const e = bySyllabus.get(g.syllabusId) ?? { syllabusId: g.syllabusId, syllabusCode: code, classIds: [] };
        if (!e.classIds.includes(c.id)) e.classIds.push(c.id);
        bySyllabus.set(g.syllabusId, e);
      }
    }
    if (!bySyllabus.size) { skipped.push({ row, reason: `no ${row.form} class takes ${row.subject}` }); continue; }

    const names = row.invigilatorNames ?? [];
    for (const e of bySyllabus.values()) {
      papers.push({
        id: `${windowId}_${row.id}_${e.syllabusCode}`.replace(/[^A-Za-z0-9_-]/g, ''),
        data: {
          windowId, syllabusId: e.syllabusId, syllabusCode: e.syllabusCode,
          paper: row.paper || 'Exam', formLabel: row.form, classIds: e.classIds,
          date: row.date, start: row.start, duration: row.duration ?? null, slot: row.slot,
          invigilatorIds: names.map((n) => invigilators[n]).filter(Boolean),
          invigilatorNames: names.filter((n) => !invigilators[n]),
          importKey: row.id,
        },
      });
    }
  }
  return { papers, skipped, invigilators, ambiguous, classIds: [...formClassIds] };
}
