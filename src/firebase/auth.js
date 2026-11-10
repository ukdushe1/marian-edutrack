import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';

const googleProvider = new GoogleAuthProvider();

export const loginEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const loginGoogle = () =>
  signInWithPopup(auth, googleProvider);

export const logout = () => signOut(auth);

export const resetPassword = (email) =>
  sendPasswordResetEmail(auth, email);

export const onAuth = (cb) => onAuthStateChanged(auth, cb);

/** Fetch the user's Firestore profile (name, roles, departments). */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Roles come from Firebase custom claims (set by Cloud Functions / Admin SDK).
 * During development, fall back to the Firestore users doc.
 */
export async function getUserRoles(firebaseUser) {
  const token = await firebaseUser.getIdTokenResult(true);
  if (token.claims.roles) return token.claims.roles;
  // Fallback for local dev when Cloud Functions haven't been deployed yet.
  const profile = await getUserProfile(firebaseUser.uid);
  return profile?.roles ?? [];
}
