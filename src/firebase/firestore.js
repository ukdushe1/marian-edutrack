/**
 * Thin helpers over the Firestore SDK.
 * All reads/writes in feature components import from here, never raw from firebase/firestore.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc,
  query, where, orderBy, onSnapshot, writeBatch, serverTimestamp,
  deleteDoc, increment, limit,
} from 'firebase/firestore';
import { db } from './config';

// ─── generic helpers ───────────────────────────────────────────────────────

export const col  = (...path) => collection(db, ...path);
export const ref  = (...path) => doc(db, ...path);
export const now  = () => serverTimestamp();

export { query, where, orderBy, onSnapshot, writeBatch, increment,
         getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc, limit };

// ─── users ─────────────────────────────────────────────────────────────────

export const usersCol = () => col('users');
export const userRef  = (uid) => ref('users', uid);

// ─── syllabi ───────────────────────────────────────────────────────────────

export const syllabiCol       = () => col('syllabi');
export const syllabusRef      = (id) => ref('syllabi', id);
export const gradeBoundsRef   = (id) => ref('gradeBoundaries', id);
export const gradingScalesCol = () => col('gradingScales');

// ─── school structure ──────────────────────────────────────────────────────

export const classesCol         = () => col('classes');
export const studentsCol        = () => col('students');
export const teachingGroupsCol  = () => col('teachingGroups');
export const groupRef           = (id) => ref('teachingGroups', id);
export const termsCol           = () => col('terms');
export const termRef            = (id) => ref('terms', id);

// ─── marks & assessments ──────────────────────────────────────────────────

export const assessmentsCol  = (groupId) => col('teachingGroups', groupId, 'assessments');
export const assessmentRef   = (groupId, id) => ref('teachingGroups', groupId, 'assessments', id);
export const marksRef        = (groupId, assessmentId) =>
  ref('teachingGroups', groupId, 'assessments', assessmentId, 'marks', 'entries');

// ─── registers ─────────────────────────────────────────────────────────────

export const registersCol = () => col('registers');
export const registerRef  = (id) => ref('registers', id);

// ─── reports ───────────────────────────────────────────────────────────────

export const reportsCol = () => col('reports');
export const reportRef  = (id) => ref('reports', id);

// ─── conduct ───────────────────────────────────────────────────────────────

export const conductCol = () => col('conduct');

// ─── audit ─────────────────────────────────────────────────────────────────

export async function writeAuditLog(who, collectionName, docId, before, after) {
  await addDoc(col('auditLog'), { who, collection: collectionName, docId, before, after, when: now() });
}
