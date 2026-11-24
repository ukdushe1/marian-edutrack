import { describe, it, expect } from 'vitest';
import { planMarkbookImport, markbookTemplateRows } from '../src/lib/markbookImport';

// Made-up names only
const students = [{ id: 's1', surname: 'Alpha', firstName: 'Anne' }, { id: 's2', surname: 'Beta', firstName: 'Ben' }];
const assessments = [
  { id: 'a1', title: 'Test 1', maxMark: 20 },
  { id: 'ex', title: 'Exam — End of Year', maxMark: 50, examPaperId: 'p1' },
];

describe('importing a mark list into the Markbook', () => {
  it('template: class list with the non-exam assessments as columns', () => {
    expect(markbookTemplateRows(students, assessments)[0]).toEqual(['id', 'name', 'Test 1 (/20)', 'Exam — End of Year (/50)']);
  });

  it('fills existing assessments, adds new ones from "(/N)" headings, reads A and X', () => {
    const rows = [
      { id: 's1', name: 'Alpha, Anne', 'Test 1 (/20)': 15, 'Quiz 2 (/10)': 'A' },
      { id: '', name: 'ben beta', 'Test 1 (/20)': 'x', 'Quiz 2 (/10)': 7 },
    ];
    const plan = planMarkbookImport({ rows, students, assessments });
    expect(plan.columns.map((c) => [c.assessmentId ?? c.newTitle, c.maxMark, c.count])).toEqual([['a1', 20, 2], ['Quiz 2', 10, 2]]);
    expect(plan.updates.a1).toEqual({ s1: { raw: 15, status: null }, s2: { raw: null, status: 'exempt' } });
    expect(plan.updates['new:quiz 2']).toEqual({ s1: { raw: null, status: 'absent' }, s2: { raw: 7, status: null } });
    expect(plan.errors).toEqual([]);
  });

  it('an exam column imports totals; A = absent, X = absent with valid reason', () => {
    const rows = [{ name: 'Alpha Anne', 'Exam — End of Year (/50)': 41 }, { name: 'Beta Ben', 'Exam — End of Year (/50)': 'x' }];
    const plan = planMarkbookImport({ rows, students, assessments });
    expect(plan.columns[0]).toMatchObject({ assessmentId: 'ex', examPaperId: 'p1', maxMark: 50, count: 2 });
    expect(plan.updates.ex).toEqual({ s1: { raw: 41, status: null }, s2: { raw: null, status: 'excused' } });
  });

  it('flags out-of-range marks, unknown students and headings without a maximum', () => {
    const rows = [
      { name: 'Alpha Anne', 'Test 1': 25, 'Exam — End of Year': 60, Homework: 5 },
      { name: 'Nobody', 'Test 1': 3, 'Exam — End of Year': '', Homework: '' },
    ];
    const plan = planMarkbookImport({ rows, students, assessments });
    expect(plan.errors.join(' ')).toMatch(/Test 1 = "25" must be 0–20/);
    expect(plan.errors.join(' ')).toMatch(/End of Year = "60" must be 0–50/);
    expect(plan.unmatched).toEqual(['Row 3: Nobody is not in this class.']);
    expect(plan.ignored.join(' ')).toMatch(/"Homework \(\/20\)"/);
    expect(plan.updates).toEqual({});
  });
});
