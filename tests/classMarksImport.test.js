import { describe, it, expect } from 'vitest';
import { classMarkColumns, classMarksTemplate, planClassMarksImport } from '../src/lib/termExam/classMarksImport';

// Made-up names only
const students = [{ id: 's1', surname: 'Alpha', firstName: 'Anne' }, { id: 's2', surname: 'Beta', firstName: 'Ben' }];
const columns = classMarkColumns([
  { id: 'eng', heading: 'ENG', name: 'English', papers: [{ id: 'pe', label: 'Exam', max: 100 }] },
  { id: 'mat', heading: 'MATHS', name: 'Mathematics', papers: [{ id: 'p1', label: 'Pure P1', max: 100 }, { id: 'p5', label: 'Stats 1 (P5)', max: 50 }] },
]);

describe('whole-class marks import (every subject, one sheet)', () => {
  it('one column per paper: subject alone, or subject + paper when there are several', () => {
    expect(columns.map((c) => c.header)).toEqual(['ENG (/100)', 'MATHS Pure P1 (/100)', 'MATHS Stats 1 (P5) (/50)']);
    expect(classMarksTemplate(students, columns)[1]).toEqual(['s1', 'Alpha, Anne', '', '', '']);
  });

  it('reads marks per paper, A/X as attendance, and matches names in either order', () => {
    const rows = [
      { id: 's1', name: 'Alpha, Anne', 'ENG (/100)': 64, 'MATHS Pure P1 (/100)': 'a', 'MATHS Stats 1 (P5) (/50)': 41 },
      { id: '', name: 'ben beta', 'ENG (/100)': 'X', 'MATHS Pure P1 (/100)': '', 'MATHS Stats 1 (P5) (/50)': '' },
    ];
    const plan = planClassMarksImport({ rows, students, columns });
    expect(plan.updates).toEqual({ pe: { s1: { raw: 64 }, s2: { status: 'excused' } }, p1: { s1: { status: 'absent' } }, p5: { s1: { raw: 41 } } });
    expect(plan.columns.map((c) => c.count)).toEqual([2, 1, 1]);
    expect(plan.errors).toEqual([]);
  });

  it('flags marks over the maximum, subjects a learner does not take, unknown names and columns', () => {
    const rows = [
      { name: 'Alpha Anne', 'ENG (/100)': 64, 'MATHS Stats 1 (P5) (/50)': 60, Art: 5 },
      { name: 'Beta Ben', 'ENG (/100)': 50, 'MATHS Stats 1 (P5) (/50)': '', Art: '' },
      { name: 'Nobody', 'ENG (/100)': 1, 'MATHS Stats 1 (P5) (/50)': '', Art: '' },
    ];
    const plan = planClassMarksImport({ rows, students, columns, takes: (sid, subj) => !(sid === 's2' && subj === 'eng') });
    expect(plan.errors.join(' ')).toMatch(/Stats 1 \(P5\) \(\/50\) = "60" must be 0–50/);
    expect(plan.errors.join(' ')).toMatch(/Beta, Ben\): doesn't take English/);
    expect(plan.unmatched).toEqual(['Row 4: Nobody is not in this class.']);
    expect(plan.ignored.join(' ')).toMatch(/"Art"/);
    expect(plan.updates).toEqual({ pe: { s1: { raw: 64 } } });
  });
});
