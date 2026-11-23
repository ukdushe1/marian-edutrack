import { describe, it, expect } from 'vitest';
import { planMarksImport, marksTemplateRows } from '../src/lib/termExam/marksImport';

// Made-up names only
const students = [
  { id: 's1', surname: 'Alpha', firstName: 'Anne' },
  { id: 's2', surname: 'Beta', firstName: 'Ben' },
  { id: 's3', surname: 'Gamma', firstName: 'Cara' },
];
const questions = [{ no: '1', marks: 10 }, { no: '2', marks: 20 }];

describe('importing exam marks from a file', () => {
  it('the template lists the class with one column per question', () => {
    expect(marksTemplateRows(students, questions)[0]).toEqual(['id', 'name', 'Q1 (/10)', 'Q2 (/20)']);
    expect(marksTemplateRows(students, questions)[2]).toEqual(['s2', 'Beta, Ben', '', '']);
  });

  it('reads the template back: matches by id, totals the questions', () => {
    const rows = [
      { id: 's1', name: 'Alpha, Anne', 'Q1 (/10)': 8, 'Q2 (/20)': 15 },
      { id: 's2', name: 'Beta, Ben', 'Q1 (/10)': '', 'Q2 (/20)': '' }, // left blank: ignored
    ];
    const plan = planMarksImport({ rows, students, questions });
    expect(plan.updates).toEqual({ s1: { perQuestion: { 1: 8, 2: 15 }, raw: 23 } });
    expect(plan.errors).toEqual([]);
  });

  it('a file without ids matches names in either order', () => {
    const rows = [{ Name: 'cara gamma', Q1: 5, Q2: 6 }, { Name: 'Nobody Here', Q1: 1, Q2: 1 }];
    const plan = planMarksImport({ rows, students, questions });
    expect(plan.updates.s3.raw).toBe(11);
    expect(plan.unmatched).toEqual(['Row 3: Nobody Here is not in this class.']);
  });

  it('flags marks out of range and ignores students who did not sit', () => {
    const rows = [{ name: 'Alpha Anne', Q1: 12, Q2: 3 }, { name: 'Beta Ben', Q1: 4, Q2: 4 }];
    const plan = planMarksImport({ rows, students, questions, sat: (sid) => sid !== 's2' });
    expect(plan.updates).toEqual({});
    expect(plan.errors[0]).toMatch(/Q1 = "12" must be 0–10/);
    expect(plan.skipped[0]).toMatch(/Beta, Ben did not sit/);
  });

  it('a one-question paper can use a Total column; otherwise question columns are required', () => {
    expect(planMarksImport({ rows: [{ name: 'Alpha Anne', Total: 40 }], students, questions: [{ no: '1', marks: 50 }] }).updates.s1.raw).toBe(40);
    expect(planMarksImport({ rows: [{ name: 'Alpha Anne', Total: 40 }], students, questions }).errors[0]).toMatch(/No question columns/);
  });
});
