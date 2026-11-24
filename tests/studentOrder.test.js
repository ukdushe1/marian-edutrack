import { describe, it, expect } from 'vitest';
import { sortStudents, parseGender } from '../src/lib/studentOrder';
import { planSchoolSetup } from '../src/lib/schoolSetup/schoolSetup';

// Made-up names only
describe('class lists: girls first, then boys, A–Z', () => {
  it('sorts girls, then boys, then unknown, each by surname then first name', () => {
    const list = [
      { surname: 'Zulu', firstName: 'Ann', gender: 'F' }, { surname: 'Alpha', firstName: 'Ben', gender: 'M' },
      { surname: 'Beta', firstName: 'Cara', gender: 'F' }, { surname: 'Beta', firstName: 'Abi', gender: 'F' },
      { surname: 'Aaa', firstName: 'Kim' },
    ];
    expect(sortStudents(list).map((s) => `${s.surname} ${s.firstName}`)).toEqual(['Beta Abi', 'Beta Cara', 'Zulu Ann', 'Alpha Ben', 'Aaa Kim']);
  });
  it('reads F/M, Girl/Boy, Female/Male', () => {
    expect(['F', 'girl', 'Female', 'm', 'BOY', 'male', '', 'x'].map(parseGender)).toEqual(['F', 'F', 'F', 'M', 'M', 'M', '', '']);
  });
  it('the school setup import saves gender and flags students without one', () => {
    const plan = planSchoolSetup(
      [{ class: '1D', surname: 'A', firstName: 'B', gender: 'F' }, { class: '1D', surname: 'C', firstName: 'D', gender: '' }],
      [{ class: '1D', subjects: 'ENG' }], { year: 2026, term: 3 });
    expect(plan.students.map((s) => s.data.gender)).toEqual(['F', '']);
    expect(plan.warnings.join(' ')).toMatch(/1D: 1 student has no gender/);
  });
});
