/**
 * School setup import — classes, subjects (syllabi), students and teaching groups
 * from one workbook. Names come only from the uploaded file, never from source.
 *
 * Workbook
 *   Sheet "Students": class, surname, firstName   (e.g. 3D1, Moyo, Tanaka)
 *   Sheet "Subjects": class, subjects             (e.g. 3D1, "ENG, LIT, MAT, P.E")
 *     subjects use the abbreviations on the school's results schedules.
 *
 * Everything gets a stable id, and is written with merge, so importing the same
 * file again updates instead of duplicating, and keeps teachers assigned since.
 */

// Subject catalogue: key → name, plus the abbreviations used on school sheets
export const SUBJECTS = {
  ENG:  { name: 'English',               aliases: ['ENG', 'ENGLISH'] },
  LIT:  { name: 'Literature',            aliases: ['LIT', 'LITERATURE'] },
  MAT:  { name: 'Mathematics',           aliases: ['MAT', 'MATH', 'MATHS', 'MATHEMATICS'] },
  PE:   { name: 'Physical Education',    aliases: ['PE', 'PHYSICALEDUCATION'] },
  COMP: { name: 'Computer Science',      aliases: ['COMP', 'CS', 'COMPUTERSCIENCE'] },
  ICT:  { name: 'ICT',                   aliases: ['ICT'] },
  GEO:  { name: 'Geography',             aliases: ['GEO', 'GEOG', 'GEOGRAPHY'] },
  HIS:  { name: 'History',               aliases: ['HIS', 'HIST', 'HISTORY'] },
  ACC:  { name: 'Accounts',              aliases: ['ACC', 'ACCS', 'ACCOUNTS', 'ACCOUNTING'] },
  BS:   { name: 'Business Studies',      aliases: ['BS', 'BUSINESSSTUDIES'] },
  PHY:  { name: 'Physics',               aliases: ['PHY', 'PHYSICS'] },
  CHE:  { name: 'Chemistry',             aliases: ['CHE', 'CHEM', 'CHEMISTRY'] },
  BIO:  { name: 'Biology',               aliases: ['BIO', 'BIOLOGY'] },
  ECO:  { name: 'Economics',             aliases: ['ECO', 'ECOS', 'ECONOMICS'] },
  AGR:  { name: 'Agriculture',           aliases: ['AGR', 'AGRC', 'AGRIC', 'AGRICULTURE'] },
  FRE:  { name: 'French',                aliases: ['FRE', 'FRENCH'] },
  SHO:  { name: 'Shona',                 aliases: ['SHO', 'SHONA'] },
  RS:   { name: 'Biblical Studies',      aliases: ['RS', 'BIBLICALSTUDIES', 'RELIGIOUSSTUDIES'] },
  COMB: { name: 'Combined Science',      aliases: ['COMB', 'COMBINEDSCIENCE'] },
};

const ALIAS = Object.fromEntries(Object.entries(SUBJECTS).flatMap(([key, s]) => s.aliases.map((a) => [a, key])));
/** "P.E" → "PE", "B.S" → "BS", "Maths" → "MAT"; null when unknown. */
export const subjectKey = (abbr) => ALIAS[String(abbr ?? '').toUpperCase().replace(/[^A-Z]/g, '')] ?? null;

/** Forms 1–2 lower school, 3–4 O Level, 5–6 A Level. */
export function stageFor(form) {
  if (form <= 2) return { suffix: 'JR', level: 'Lower School' };
  if (form <= 4) return { suffix: 'O', level: 'O Level' };
  return { suffix: 'A', level: 'A Level' };
}

/** "3D1" → 3, "L6 Sciences" → 5, "U6 Arts" → 6, "Form 2E" → 2. */
export function formOf(className) {
  const n = String(className).trim().toUpperCase();
  if (/^L6\b/.test(n)) return 5;
  if (/^U6\b/.test(n)) return 6;
  const m = n.replace(/^FORM\s*/, '').match(/^(\d)/);
  return m ? Number(m[1]) : null;
}

const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** "NICO-WILLIAM" → "Nico-William", "HOPE J." → "Hope J." */
export const titleCase = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  .replace(/(^|[\s'-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

export const classDocId   = (cls) => `mhs-class-${slug(cls)}`;
export const syllabusDocId = (key, form) => `mhs-${key}-${stageFor(form).suffix}`.toLowerCase();
export const syllabusCode  = (key, form) => `${key}-${stageFor(form).suffix}`;

const A_LEVEL_COMPONENTS = {
  MAT:  [{ paper: 'Pure Mathematics', weight: 50, maxMark: 100 }, { paper: 'Statistics', weight: 50, maxMark: 100 }],
  COMP: [{ paper: 'Theory', weight: 50, maxMark: 100 }, { paper: 'Practical', weight: 50, maxMark: 100 }],
};

/** Lower-cases row keys so "firstName" / "FirstName" / "first name" all work. */
const normRow = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ''), typeof v === 'string' ? v.trim() : v]));

/**
 * Turn the workbook's rows into the documents to write, plus anything to check.
 * @param studentRows rows of the "Students" sheet
 * @param subjectRows rows of the "Subjects" sheet
 * @returns { classes, syllabi, students, groups, warnings, errors }
 *   each doc list is [{ path, data }]
 */
export function planSchoolSetup(studentRows, subjectRows, { year = new Date().getFullYear() } = {}) {
  const errors = [], warnings = [];
  const students = [], classes = new Map(), syllabi = new Map(), groups = [];
  const byClass = new Map();

  studentRows.map(normRow).forEach((r, i) => {
    const cls = String(r.class ?? r.classid ?? '').trim();
    if (!cls && !r.surname && !r.firstname) return; // blank line
    if (!cls) { errors.push(`Students row ${i + 2}: class is empty.`); return; }
    if (!r.surname || !r.firstname) { errors.push(`Students row ${i + 2}: surname and firstName are both needed.`); return; }
    if (formOf(cls) == null) { errors.push(`Students row ${i + 2}: can't tell the form from class "${cls}".`); return; }
    const list = byClass.get(cls) ?? [];
    list.push({ surname: titleCase(r.surname), firstName: titleCase(r.firstname) });
    byClass.set(cls, list);
  });

  const subjectsByClass = new Map();
  subjectRows.map(normRow).forEach((r, i) => {
    const cls = String(r.class ?? r.classid ?? '').trim();
    if (!cls) return;
    const keys = [];
    String(r.subjects ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean).forEach((abbr) => {
      const k = subjectKey(abbr);
      if (!k) warnings.push(`Subjects row ${i + 2} (${cls}): unknown subject "${abbr}" was skipped.`);
      else if (!keys.includes(k)) keys.push(k);
    });
    subjectsByClass.set(cls, keys);
  });

  // Same name in two classes is usually a typo or a moved student — flag it
  const seen = new Map();
  for (const [cls, list] of byClass) {
    const inClass = new Set();
    for (const s of list) {
      const key = `${s.surname} ${s.firstName}`.toLowerCase();
      if (inClass.has(key)) warnings.push(`${s.surname} ${s.firstName} is listed twice in ${cls}.`);
      inClass.add(key);
      if (seen.has(key) && seen.get(key) !== cls) warnings.push(`${s.surname} ${s.firstName} is in both ${seen.get(key)} and ${cls}.`);
      seen.set(key, cls);
    }
  }

  for (const [cls, list] of byClass) {
    const form = formOf(cls);
    const classId = classDocId(cls);
    classes.set(classId, { path: `classes/${classId}`, data: { name: cls, form, year, source: 'schoolSetup' } });
    const ids = list.map((s, n) => {
      const id = `mhs-${slug(cls)}-${String(n + 1).padStart(3, '0')}`;
      students.push({ path: `students/${id}`, data: { ...s, preferredName: '', classId, status: 'active', source: 'schoolSetup' } });
      return id;
    });
    const keys = subjectsByClass.get(cls);
    if (!keys) { warnings.push(`${cls} has no row on the Subjects sheet, so no teaching groups were made for it.`); continue; }
    for (const key of keys) {
      const sylId = syllabusDocId(key, form);
      const { level } = stageFor(form);
      if (!syllabi.has(sylId)) {
        syllabi.set(sylId, { path: `syllabi/${sylId}`, data: {
          code: syllabusCode(key, form), name: SUBJECTS[key].name, level,
          ...(level === 'A Level' && A_LEVEL_COMPONENTS[key] ? { components: A_LEVEL_COMPONENTS[key] } : {}),
          source: 'schoolSetup',
        } });
      }
      groups.push({ path: `teachingGroups/mhs-${slug(cls)}-${key.toLowerCase()}`, data: {
        name: `${cls} ${SUBJECTS[key].name}`, syllabusId: sylId, syllabusCode: syllabusCode(key, form),
        classId, year, studentIds: ids, source: 'schoolSetup',
      } });
    }
  }
  for (const cls of subjectsByClass.keys()) if (!byClass.has(cls)) warnings.push(`${cls} is on the Subjects sheet but has no students.`);

  return { classes: [...classes.values()], syllabi: [...syllabi.values()], students, groups, warnings, errors };
}
