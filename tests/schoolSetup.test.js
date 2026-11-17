import { describe, it, expect } from 'vitest';
import { planSchoolSetup, subjectKey, formOf, titleCase } from '../src/lib/schoolSetup/schoolSetup';

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
    expect(plan.syllabi.map((s) => s.data.code).sort()).toEqual(['AGR-O', 'BS-JR', 'COMP-A', 'ENG-JR', 'ENG-O', 'MAT-A', 'MAT-JR', 'PE-O'].sort());
    const g = plan.groups.find((x) => x.path === 'teachingGroups/mhs-1d-mat');
    expect(g.data).toMatchObject({ name: '1D Mathematics', syllabusCode: 'MAT-JR', studentIds: ['mhs-1d-001', 'mhs-1d-002'] });
    expect(plan.syllabi.find((s) => s.data.code === 'MAT-A').data.components.map((c) => c.paper)).toEqual(['Pure Mathematics', 'Statistics']);
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
  it('rejects rows missing a name', () => {
    expect(planSchoolSetup([{ class: '1D', surname: 'X', firstName: '' }], []).errors[0]).toMatch(/surname and firstName/);
  });
});
