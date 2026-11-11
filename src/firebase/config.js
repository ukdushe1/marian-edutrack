import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';

// Replace these values with your Firebase project config from the Firebase Console.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'REPLACE_ME',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'REPLACE_ME',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'REPLACE_ME',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'REPLACE_ME',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| 'REPLACE_ME',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || 'REPLACE_ME',
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);

// Enable offline persistence (Firestore's offline cache).
enableIndexedDbPersistence(db, { synchronizeTabs: true }).catch(() => {
  // May fail in private windows or if the browser blocks IndexedDB — silently continue.
});

// Wire up emulators when running locally.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}

export default app;
