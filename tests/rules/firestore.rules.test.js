/**
 * Security-rules tests — run against the Firestore emulator:
 *   npm run test:rules        (needs Java 11+ for the emulator)
 * Each test signs in as a role and checks what the database allows.
 */
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

let env;
const USERS = {
  principal: ['principal'], admin: ['superAdmin'], vp: ['vicePrincipal'], legacyHead: ['head'],
  hod: ['hod', 'teacher'], teacher: ['teacher'], teacher2: ['teacher'], classT: ['classTeacher'], legacyTutor: ['tutor'],
  exams: ['examsOfficer'], boarding: ['boardingMaster'], parent: ['parent'], nobody: [],
};
const as = (uid) => env.authenticatedContext(uid).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'marian-edutrack-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(() => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, roles] of Object.entries(USERS)) {
      await setDoc(doc(db, 'users', uid), { name: uid, roles, ...(uid === 'hod' ? { hodSubjects: ['4005'] } : {}) });
    }
    await setDoc(doc(db, 'syllabi/sci'), { code: '4005', name: 'Science' });
    await setDoc(doc(db, 'syllabi/math'), { code: '4024', name: 'Maths' });
    await setDoc(doc(db, 'teachingGroups/g1'), { name: '3D1 Sci', syllabusId: 'sci', teacherIds: ['teacher'], studentIds: ['s1'] });
    await setDoc(doc(db, 'teachingGroups/g1/assessments/open'), { title: 'Test 1', maxMark: 10 });
    await setDoc(doc(db, 'teachingGroups/g1/assessments/locked'), { title: 'Test 2', maxMark: 10, locked: true });
    await setDoc(doc(db, 'teachingGroups/g1/assessments/frozen'), { title: 'Exam', maxMark: 100, locked: true, frozen: true });
    await setDoc(doc(db, 'reports/draft1'), { studentId: 's1', groupId: 'g1', status: 'draft' });
    await setDoc(doc(db, 'reports/pub1'), { studentId: 's1', groupId: 'g1', status: 'published', guardianIds: [] });
    await setDoc(doc(db, 'examWindows/w1'), { name: 'T3', approved: false, published: false, version: 0 });
    await setDoc(doc(db, 'examPapers/p1'), { windowId: 'w1', syllabusCode: '4005', status: 'draft', setterId: 'teacher2', invigilatorIds: ['teacher'] });
    await setDoc(doc(db, 'sickBay/x'), { studentId: 's1', complaint: 'flu' });
  });
});

describe('users and roles', () => {
  it('a new user may create their own profile only with no roles', async () => {
    await assertSucceeds(setDoc(doc(as('newbie'), 'users/newbie'), { name: 'N', roles: [] }));
    await assertFails(setDoc(doc(as('sneaky'), 'users/sneaky'), { name: 'S', roles: ['superAdmin'] }));
  });
  it('nobody can change their own roles', async () => {
    await assertFails(updateDoc(doc(as('teacher'), 'users/teacher'), { roles: ['superAdmin'] }));
  });
  it('the Principal can assign roles', async () => {
    await assertSucceeds(updateDoc(doc(as('principal'), 'users/teacher'), { roles: ['teacher', 'hod'] }));
  });
});

describe('syllabus (HOD of the subject + Principal)', () => {
  it('a subject teacher cannot edit any syllabus', async () => {
    await assertFails(updateDoc(doc(as('teacher'), 'syllabi/sci'), { name: 'x' }));
    await assertFails(setDoc(doc(as('teacher'), 'syllabi/new'), { code: '4005' }));
    await assertSucceeds(getDoc(doc(as('teacher'), 'syllabi/sci')));
  });
  it('the HOD edits only their own subject', async () => {
    await assertSucceeds(updateDoc(doc(as('hod'), 'syllabi/sci'), { name: 'Combined Science' }));
    await assertFails(updateDoc(doc(as('hod'), 'syllabi/math'), { name: 'x' }));
    await assertFails(updateDoc(doc(as('hod'), 'syllabi/sci'), { code: '4024' })); // cannot move it to another subject
  });
  it('the Principal edits any syllabus; the VP does not', async () => {
    await assertSucceeds(updateDoc(doc(as('principal'), 'syllabi/math'), { name: 'Mathematics' }));
    await assertFails(updateDoc(doc(as('vp'), 'syllabi/math'), { name: 'x' }));
  });
});

describe('marks: locked and frozen', () => {
  const marks = (db, a) => setDoc(doc(db, `teachingGroups/g1/assessments/${a}/marks/entries`), { entries: { s1: { raw: 5 } } }, { merge: true });
  it("the class teacher writes open marks; another teacher can't", async () => {
    await assertSucceeds(marks(as('teacher'), 'open'));
    await assertFails(marks(as('teacher2'), 'open'));
  });
  it('locked: HOD only', async () => {
    await assertFails(marks(as('teacher'), 'locked'));
    await assertSucceeds(marks(as('hod'), 'locked'));
  });
  it('frozen (published): Principal / VP only', async () => {
    await assertFails(marks(as('hod'), 'frozen'));
    await assertSucceeds(marks(as('vp'), 'frozen'));
  });
  it('a teacher cannot unlock an assessment', async () => {
    await assertFails(updateDoc(doc(as('teacher'), 'teachingGroups/g1/assessments/locked'), { locked: false }));
  });
});

describe('reports', () => {
  it('staff edit drafts; only Principal / VP change published reports', async () => {
    await assertSucceeds(updateDoc(doc(as('teacher'), 'reports/draft1'), { subjectComment: 'Good' }));
    await assertFails(updateDoc(doc(as('teacher'), 'reports/pub1'), { subjectComment: 'x' }));
    await assertFails(updateDoc(doc(as('teacher'), 'reports/draft1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as('vp'), 'reports/draft1'), { status: 'approved' }));
  });
  it('legacy Head works as Vice Principal; legacy Tutor works as staff', async () => {
    await assertSucceeds(updateDoc(doc(as('legacyHead'), 'reports/pub1'), { headComment: 'Well done' }));
    await assertSucceeds(getDoc(doc(as('legacyTutor'), 'reports/draft1')));
  });
});

describe('exam module sign-offs', () => {
  it('the exams officer cannot approve their own window', async () => {
    await assertSucceeds(updateDoc(doc(as('exams'), 'examWindows/w1'), { name: 'Term 3 exams' }));
    await assertFails(updateDoc(doc(as('exams'), 'examWindows/w1'), { approved: true }));
    await assertSucceeds(updateDoc(doc(as('principal'), 'examWindows/w1'), { approved: true }));
  });
  it('only the HOD vets; the setter cannot', async () => {
    await assertFails(updateDoc(doc(as('teacher2'), 'examPapers/p1'), { status: 'vetted' }));
    await assertSucceeds(updateDoc(doc(as('teacher2'), 'examPapers/p1'), { questions: [] }));
    await assertFails(updateDoc(doc(as('exams'), 'examPapers/p1'), { status: 'vetted' }));
    await assertSucceeds(updateDoc(doc(as('hod'), 'examPapers/p1'), { status: 'vetted' }));
  });
  it('invigilators record attendance for their paper only', async () => {
    await assertSucceeds(setDoc(doc(as('teacher'), 'examSittings/p1_s1'), { paperId: 'p1', studentId: 's1', status: 'present' }));
    await assertFails(setDoc(doc(as('teacher2'), 'examSittings/p1_s1'), { paperId: 'p1', studentId: 's1', status: 'absent' }));
  });
});

describe('privacy and logs', () => {
  it('sick bay is boarding staff + seniors only', async () => {
    await assertFails(getDoc(doc(as('teacher'), 'sickBay/x')));
    await assertSucceeds(getDoc(doc(as('boarding'), 'sickBay/x')));
  });
  it('people with no role see nothing', async () => {
    await assertFails(getDoc(doc(as('nobody'), 'syllabi/sci')));
  });
  it('audit entries must name the writer and cannot be edited', async () => {
    await assertFails(addDoc(collection(as('teacher'), 'auditLog'), { who: 'someoneElse', when: serverTimestamp() }));
    const ref = await assertSucceeds(addDoc(collection(as('teacher'), 'auditLog'), { who: 'teacher', when: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('principal'), `auditLog/${ref.id}`), { who: 'x' }));
  });
});
