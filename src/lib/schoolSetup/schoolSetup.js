/**
 * School setup import — classes, subjects (syllabi), students and teaching groups
 * from one workbook. Names come only from the uploaded file, never from source.
 *
 * Workbook
 *   Sheet "Students": class, surname, firstName   (e.g. 3D1, Moyo, Tanaka)
 *   Sheet "Subjects": class, subjects             (e.g. 3D1, "ENG, LIT, MAT, P.E")
 *     subjects use the abbreviations on the school's results schedules.
 *
 * Subjects are Cambridge syllabuses (IGCSE for Forms 1–4, A Level for 5–6),
 * stored once per code and shared by every class that takes them.
 *
 * Everything gets a stable id, and is written with merge, so importing the same
 * file again updates instead of duplicating, and keeps teachers assigned since.
 */

// Subject catalogue: key → Cambridge IGCSE (Forms 1–4) and A Level (Forms 5–6)
// code + full name, plus the abbreviations used on the school's sheets.
// code null = no Cambridge syllabus (taught as a school subject).
export const SUBJECTS = {
  ENG:  { aliases: ['ENG', 'ENGLISH'],                     igcse: ['0500', 'First Language English'] },
  LIT:  { aliases: ['LIT', 'LITERATURE'],                  igcse: ['0475', 'Literature in English'],            alevel: ['9695', 'Literature in English'] },
  MAT:  { aliases: ['MAT', 'MATH', 'MATHS', 'MATHEMATICS'], igcse: ['0580', 'Mathematics'],                     alevel: ['9709', 'Mathematics'] },
  PE:   { aliases: ['PE', 'PHYSICALEDUCATION'],            igcse: ['0413', 'Physical Education'] },
  COMP: { aliases: ['COMP', 'CS', 'COMPUTERSCIENCE'],      igcse: ['0478', 'Computer Science'],                 alevel: ['9618', 'Computer Science'] },
  ICT:  { aliases: ['ICT'],                                igcse: ['0417', 'Information and Communication Technology'] },
  GEO:  { aliases: ['GEO', 'GEOG', 'GEOGRAPHY'],           igcse: ['0460', 'Geography'],                        alevel: ['9696', 'Geography'] },
  HIS:  { aliases: ['HIS', 'HIST', 'HISTORY'],             igcse: ['0470', 'History'],                          alevel: ['9489', 'History'] },
  ACC:  { aliases: ['ACC', 'ACCS', 'ACCOUNTS', 'ACCOUNTING'], igcse: ['0452', 'Accounting'],                    alevel: ['9706', 'Accounting'] },
  BS:   { aliases: ['BS', 'BUSINESSSTUDIES', 'BUSINESS'],  igcse: ['0450', 'Business Studies'],                 alevel: ['9609', 'Business'] },
  PHY:  { aliases: ['PHY', 'PHYSICS'],                     igcse: ['0625', 'Physics'],                          alevel: ['9702', 'Physics'] },
  CHE:  { aliases: ['CHE', 'CHEM', 'CHEMISTRY'],           igcse: ['0620', 'Chemistry'],                        alevel: ['9701', 'Chemistry'] },
  BIO:  { aliases: ['BIO', 'BIOLOGY'],                     igcse: ['0610', 'Biology'],                          alevel: ['9700', 'Biology'] },
  ECO:  { aliases: ['ECO', 'ECOS', 'ECONOMICS'],           igcse: ['0455', 'Economics'],                        alevel: ['9708', 'Economics'] },
  AGR:  { aliases: ['AGR', 'AGRC', 'AGRIC', 'AGRICULTURE'], igcse: ['0600', 'Agriculture'] },
  FRE:  { aliases: ['FRE', 'FRENCH'],                      igcse: ['0520', 'French (Foreign Language)'] },
  SHO:  { aliases: ['SHO', 'SHONA'],                       igcse: [null, 'Shona'] },
  RS:   { aliases: ['RS', 'BIBLICALSTUDIES', 'RELIGIOUSSTUDIES', 'DIVINITY'], alevel: [null, 'Biblical Studies'] },
  COMB: { aliases: ['COMB', 'COMBINEDSCIENCE'],            igcse: ['0653', 'Combined Science'] },
};

const ALIAS = Object.fromEntries(Object.entries(SUBJECTS).flatMap(([key, s]) => s.aliases.map((a) => [a, key])));
/** "P.E" → "PE", "B.S" → "BS", "Maths" → "MAT"; null when unknown. */
export const subjectKey = (abbr) => ALIAS[String(abbr ?? '').toUpperCase().replace(/[^A-Z]/g, '')] ?? null;

/** Forms 1–4 sit Cambridge IGCSE syllabuses; Forms 5–6 Cambridge A Level. */
export const stageFor = (form) => (form <= 4 ? { key: 'igcse', level: 'IGCSE' } : { key: 'alevel', level: 'A Level' });

/** { code, name } for a subject at a form; school code when there is no Cambridge one. */
export function subjectAt(key, form) {
  const st = stageFor(form);
  const [code, name] = SUBJECTS[key][st.key] ?? SUBJECTS[key].igcse ?? SUBJECTS[key].alevel;
  return { code: code ?? `${key}${st.key === 'alevel' ? '-A' : ''}`, name, cambridge: !!code, level: st.level };
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
export const syllabusDocId = (key, form) => `mhs-${subjectAt(key, form).code}`.toLowerCase();

const A_LEVEL_COMPONENTS = {
  MAT:  [{ paper: 'Pure Mathematics', weight: 50, maxMark: 100 }, { paper: 'Statistics', weight: 50, maxMark: 100 }],
  COMP: [{ paper: 'Theory', weight: 50, maxMark: 100 }, { paper: 'Practical', weight: 50, maxMark: 100 }],
};

/** School term from the month: Jan–Apr term 1, May–Aug term 2, Sep–Dec term 3. */
export const termOfMonth = (month) => (month <= 3 ? 1 : month <= 7 ? 2 : 3);

/** Lower-cases row keys so "firstName" / "FirstName" / "first name" all work. */
const normRow = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ''), typeof v === 'string' ? v.trim() : v]));

/**
 * Turn the workbook's rows into the documents to write, plus anything to check.
 * @param studentRows rows of the "Students" sheet
 * @param subjectRows rows of the "Subjects" sheet
 * @returns { terms, classes, syllabi, students, groups, warnings, errors }
 *   terms: the current term (exam windows and reports hang off it)
 *   each doc list is [{ path, data }]
 */
export function planSchoolSetup(studentRows, subjectRows, { year = new Date().getFullYear(), term = termOfMonth(new Date().getMonth()) } = {}) {
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
      const subj = subjectAt(key, form);
      if (!syllabi.has(sylId)) {
        if (!subj.cambridge) warnings.push(`${subj.name} (${subj.level}) has no Cambridge code; it uses the school code ${subj.code}.`);
        syllabi.set(sylId, { path: `syllabi/${sylId}`, data: {
          code: subj.code, name: subj.name, level: subj.level,
          ...(subj.level === 'A Level' && A_LEVEL_COMPONENTS[key] ? { components: A_LEVEL_COMPONENTS[key] } : {}),
          source: 'schoolSetup',
        } });
      }
      groups.push({ path: `teachingGroups/mhs-${slug(cls)}-${key.toLowerCase()}`, data: {
        name: `${cls} ${subj.name}`, syllabusId: sylId, syllabusCode: subj.code,
        classId, year, studentIds: ids, source: 'schoolSetup',
      } });
    }
  }
  for (const cls of subjectsByClass.keys()) if (!byClass.has(cls)) warnings.push(`${cls} is on the Subjects sheet but has no students.`);

  const terms = [{ path: `terms/mhs-${year}-t${term}`, data: { year, term, name: `Term ${term} ${year}`, isCurrent: true, source: 'schoolSetup' } }];
  return { terms, classes: [...classes.values()], syllabi: [...syllabi.values()], students, groups, warnings, errors };
}
