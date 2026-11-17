import { describe, it, expect } from 'vitest';
import { planSchoolSetup, subjectKey, formOf, titleCase, termOfMonth } from '../src/lib/schoolSetup/schoolSetup';

// Made-up names only — real class lists are never committed
const students = [
  { class: '1D', surname: 'ALPHA', firstName: 'ANNE' },
  { class: '1D', surname: 'BETA', firstName: 'BEN J.' },
  { class: '3D1', surname: 'GAMMA', firstName: 'CARA-LEE' },
  { class: 'L6 Sciences', surname: 'DELTA', firstName: 'DAN' },
  { class: '3G', surname: 'GAMMA', firstName: 'CARA-LEE' },
];
const subjects = [
  { class: '1D', subjects: 'ENG, MAT, B.S' },
  { class: '3D1', subjects: 'ENG, P.E, AGRC, XYZ' },
  { class: 'L6 Sciences', subjects: 'MATHS, COMP' },
];

describe('school setup import', () => {
  const plan = planSchoolSetup(students, subjects, { year: 2026 });

  it('reads school abbreviations and forms', () => {
    expect(['P.E', 'B.S', 'AGRC', 'CHEM', 'ECOS', 'R.S', 'MATHS'].map(subjectKey)).toEqual(['PE', 'BS', 'AGR', 'CHE', 'ECO', 'RS', 'MAT']);
    expect(['1D', '3D1', 'L6 Sciences', 'U6 Arts', 'Form 2E'].map(formOf)).toEqual([1, 3, 5, 6, 2]);
    expect(titleCase('NICO-WILLIAM')).toBe('Nico-William');
  });
  it('makes one syllabus per subject per level and one group per class per subject', () => {
    // Forms 1 and 3 share the IGCSE syllabus (one ENG 0500), L6 gets A Level
    expect(plan.syllabi.map((s) => `${s.data.code} ${s.data.name} (${s.data.level})`).sort()).toEqual([
      '0413 Physical Education (IGCSE)', '0450 Business Studies (IGCSE)', '0500 First Language English (IGCSE)',
      '0580 Mathematics (IGCSE)', '0600 Agriculture (IGCSE)', '9618 Computer Science (A Level)', '9709 Mathematics (A Level)',
    ]);
    const g = plan.groups.find((x) => x.path === 'teachingGroups/mhs-1d-mat');
    expect(g.data).toMatchObject({ name: '1D Mathematics', syllabusId: 'mhs-0580', syllabusCode: '0580', studentIds: ['mhs-1d-001', 'mhs-1d-002'] });
    expect(plan.groups.find((x) => x.path === 'teachingGroups/mhs-3d1-eng').data.syllabusId).toBe('mhs-0500');
    expect(plan.syllabi.find((s) => s.data.code === '9709').data.components.map((c) => c.paper)).toEqual(['Pure Mathematics', 'Statistics']);
  });
  it('adds the current term (November → Term 3)', () => {
    expect(planSchoolSetup(students, subjects, { year: 2026, term: 3 }).terms).toEqual([
      { path: 'terms/mhs-2026-t3', data: expect.objectContaining({ year: 2026, term: 3, name: 'Term 3 2026', isCurrent: true }) },
    ]);
    expect([0, 3, 4, 7, 8, 10].map((m) => termOfMonth(m))).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it('never sets teacherIds, so re-importing keeps assigned teachers', () => {
    expect(plan.groups.every((x) => !('teacherIds' in x.data))).toBe(true);
  });
  it('stable ids and title-case names', () => {
    expect(plan.students[1]).toEqual({ path: 'students/mhs-1d-002', data: expect.objectContaining({ surname: 'Beta', firstName: 'Ben J.', classId: 'mhs-class-1d' }) });
  });
  it('flags unknown subjects, students in two classes and classes without subjects', () => {
    expect(plan.errors).toEqual([]);
    expect(plan.warnings.join(' | ')).toMatch(/unknown subject "XYZ"/);
    expect(plan.warnings.join(' | ')).toMatch(/Gamma Cara-Lee is in both 3D1 and 3G/);
    expect(plan.warnings.join(' | ')).toMatch(/3G has no row on the Subjects sheet/);
  });
  it('a subject with no Cambridge code keeps a school code and is flagged', () => {
    const p = planSchoolSetup([{ class: '2D', surname: 'X', firstName: 'Y' }], [{ class: '2D', subjects: 'SHO' }]);
    expect(p.syllabi[0].data).toMatchObject({ code: 'SHO', name: 'Shona', level: 'IGCSE' });
    expect(p.warnings.join()).toMatch(/Shona \(IGCSE\) has no Cambridge code/);
  });
  it('rejects rows missing a name', () => {
    expect(planSchoolSetup([{ class: '1D', surname: 'X', firstName: '' }], []).errors[0]).toMatch(/surname and firstName/);
  });
});
