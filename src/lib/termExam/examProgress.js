/**
 * Pure rules for exam attendance and marking progress (no database access),
 * shared by the marks imports, the Marking page and the tests.
 *
 *   - "A" / "X" in a file → absent / absent with valid reason
 *   - a student who gets marks counts as present (clears an earlier absence)
 *   - a markbook is complete once every present candidate is fully marked
 */

/** File codes for exam attendance. */
export const EXAM_CODES = { A: 'absent', ABS: 'absent', X: 'excused' };

/**
 * Attendance changes implied by an import.
 * @param statusUpdates { [sid]: 'absent' | 'excused' } from the file
 * @param markedSids    students who got marks in the file
 * @param before        { [sid]: status } currently recorded (missing = present)
 * @returns [{ sid, status }] only real changes
 */
export function planSittingChanges(statusUpdates, markedSids, before) {
  const out = [];
  for (const [sid, status] of Object.entries(statusUpdates)) if ((before[sid] ?? 'present') !== status) out.push({ sid, status });
  for (const sid of markedSids) if (!statusUpdates[sid] && (before[sid] ?? 'present') !== 'present') out.push({ sid, status: 'present' });
  return out;
}

/** An entry counts as marked when every question has a mark, or it holds a total only. */
export function entryMarked(entry, questions) {
  if (!entry || entry.raw == null) return false;
  const pq = entry.perQuestion ?? {};
  const given = Object.values(pq).filter((v) => v != null && v !== '');
  if (!given.length) return true; // imported as a total
  return questions.every((q) => pq[q.no] != null && pq[q.no] !== '');
}

/**
 * Marking progress for one paper × class.
 * @returns { present, marked, complete }
 */
export function markingProgress({ candidateIds, sittings, entries, questions }) {
  const present = candidateIds.filter((sid) => (sittings[sid] ?? 'present') === 'present');
  const marked = present.filter((sid) => entryMarked(entries[sid], questions)).length;
  return { present: present.length, marked, complete: present.length > 0 && marked === present.length };
}
