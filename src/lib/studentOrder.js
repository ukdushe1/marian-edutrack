/**
 * School order for class lists: girls first, then boys (then anyone without a
 * gender recorded), each alphabetical by surname then first name — as on the
 * school's class registers and results schedules.
 */
const rank = (g) => (g === 'F' ? 0 : g === 'M' ? 1 : 2);
const text = (s) => String(s ?? '');

export const compareStudents = (a, b) => rank(a?.gender) - rank(b?.gender)
  || text(a?.surname).localeCompare(text(b?.surname), undefined, { sensitivity: 'base' })
  || text(a?.firstName).localeCompare(text(b?.firstName), undefined, { sensitivity: 'base' });

export const sortStudents = (list) => [...list].sort(compareStudents);

/** "F" / "M" from a sheet cell (F, Female, Girl / M, Male, Boy); '' when blank or unknown. */
export function parseGender(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (['F', 'FEMALE', 'GIRL', 'G'].includes(s)) return 'F';
  if (['M', 'MALE', 'BOY', 'B'].includes(s)) return 'M';
  return '';
}
