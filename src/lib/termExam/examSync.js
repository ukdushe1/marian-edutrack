/**
 * Keeping Sitting and Marking in step with imported exam marks.
 * Used by the End of Term marks import and by Markbook mark lists with an exam column.
 *
 *   - "A" / "X" in a file → that student is recorded absent / absent with valid reason
 *   - a student who gets marks is recorded present (clears an earlier absence)
 *   - once every present candidate is fully marked, the class markbook is submitted
 */
import { setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sittingRef, examMarksRef, examAssessmentRef, paperQuestions } from './model';
import { planSittingChanges, markingProgress } from './examProgress';

export { EXAM_CODES, planSittingChanges, entryMarked, markingProgress } from './examProgress';

/**
 * Save imported exam marks for one paper × class and update Sitting and Marking.
 * @param entryUpdates  { [sid]: { raw, perQuestion } } (perQuestion {} for a total)
 * @param statusUpdates { [sid]: 'absent' | 'excused' }
 * @param candidateIds  students in this class who sit the paper
 * @param entriesBefore, sittingsBefore  current marks entries / attendance for them
 * @returns { sittingChanges, submitted, progress }
 */
export async function applyExamImport({ paper, windowId, groupId, assessment, candidateIds, entryUpdates, statusUpdates,
  entriesBefore, sittingsBefore, uid }) {
  const sids = Object.keys(entryUpdates);
  // 1. Marks: replace each imported student's entry whole (a total clears old per-question marks)
  if (sids.length) {
    const data = { entries: Object.fromEntries(sids.map((sid) => [sid, { raw: entryUpdates[sid].raw, status: null, perQuestion: entryUpdates[sid].perQuestion ?? {} }])),
      updatedBy: uid, updatedAt: serverTimestamp() };
    await setDoc(examMarksRef(groupId, paper.id), data, { mergeFields: [...sids.map((sid) => `entries.${sid}`), 'updatedBy', 'updatedAt'] });
  }
  // 2. Attendance
  const sittingChanges = planSittingChanges(statusUpdates, sids, sittingsBefore);
  if (sittingChanges.length) {
    const batch = writeBatch(db);
    sittingChanges.forEach(({ sid, status }) => batch.set(sittingRef(paper.id, sid), {
      paperId: paper.id, windowId, studentId: sid, groupId, status, source: 'marksImport', updatedBy: uid, updatedAt: serverTimestamp(),
    }, { merge: true }));
    await batch.commit();
  }
  // 3. Marking: submit to the HOD once every present candidate is marked
  const sittings = { ...sittingsBefore, ...Object.fromEntries(sittingChanges.map((c) => [c.sid, c.status])) };
  const entries = { ...entriesBefore, ...Object.fromEntries(sids.map((sid) => [sid, { ...entryUpdates[sid] }])) };
  const progress = markingProgress({ candidateIds, sittings, entries, questions: paperQuestions(paper) });
  let submitted = false;
  if (progress.complete && assessment && !assessment.submitted && !assessment.locked && !assessment.frozen) {
    await updateDoc(examAssessmentRef(groupId, paper.id), { submitted: true, submittedBy: uid, submittedAt: serverTimestamp(), autoSubmitted: true });
    submitted = true;
  }
  return { sittingChanges, submitted, progress, sittings };
}

