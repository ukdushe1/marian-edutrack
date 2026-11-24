import { describe, it, expect } from 'vitest';
import { planSittingChanges, entryMarked, markingProgress } from '../src/lib/termExam/examProgress';

const qs = [{ no: '1', marks: 10 }, { no: '2', marks: 10 }];

describe('attendance from imported marks', () => {
  it('A/X record absence; a mark makes an absent student present; no change = nothing written', () => {
    expect(planSittingChanges({ s1: 'absent' }, ['s2', 's3'], { s2: 'absent', s3: 'present' }))
      .toEqual([{ sid: 's1', status: 'absent' }, { sid: 's2', status: 'present' }]);
    expect(planSittingChanges({ s1: 'absent' }, [], { s1: 'absent' })).toEqual([]);
  });
});

describe('marking progress and auto-submit', () => {
  it('a student is marked when every question has a mark, or a total was imported', () => {
    expect(entryMarked({ raw: 12, perQuestion: { 1: 5, 2: 7 } }, qs)).toBe(true);
    expect(entryMarked({ raw: 5, perQuestion: { 1: 5, 2: null } }, qs)).toBe(false);
    expect(entryMarked({ raw: 14, perQuestion: {} }, qs)).toBe(true);   // total from a mark list
    expect(entryMarked(undefined, qs)).toBe(false);
  });
  it('counts only present candidates; complete when all of them are marked', () => {
    const entries = { a: { raw: 9, perQuestion: {} }, b: { raw: null } };
    expect(markingProgress({ candidateIds: ['a', 'b', 'c'], sittings: { c: 'absent' }, entries, questions: qs }))
      .toEqual({ present: 2, marked: 1, complete: false });
    expect(markingProgress({ candidateIds: ['a', 'b'], sittings: { b: 'sick' }, entries, questions: qs }))
      .toEqual({ present: 1, marked: 1, complete: true });
  });
});
