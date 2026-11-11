/**
 * A made-up class list in the mark-list CSV format — never real student names.
 * 31 students, 10 class exercises (/10) and 4 tests (/20), deterministic.
 */
export function fakeMarkListCsv(n = 31) {
  const header = ['surname', 'firstName', ...Array.from({ length: 10 }, (_, i) => `ex${i + 1}`), 'test1', 'test2', 'test3', 'test4'];
  const rows = Array.from({ length: n }, (_, i) => {
    const ex = Array.from({ length: 10 }, (_, k) => 3 + ((i * 7 + k * 3) % 8));      // 3..10
    const tests = Array.from({ length: 4 }, (_, k) => 6 + ((i * 5 + k * 7) % 15));   // 6..20
    return [`Testsurname${String(i + 1).padStart(2, '0')}`, `Pupil${i + 1} Q`, ...ex, ...tests].join(',');
  });
  return [header.join(','), ...rows].join('\n');
}
