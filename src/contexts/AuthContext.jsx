import { createContext, useContext, useEffect, useState } from 'react';
import { onAuth, getUserProfile, getUserRoles, ensureUserProfile } from '../firebase/auth';
import { effectiveRoles } from '../lib/roles';

export const AuthContext = createContext(null); // exported for the dev layout preview

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [profile,      setProfile]      = useState(null);
  const [roles,        setRoles]        = useState([]);

  useEffect(() => {
    const unsub = onAuth(async (user) => {
      setFirebaseUser(user);
      if (user) {
        let [prof, r] = await Promise.all([getUserProfile(user.uid), getUserRoles(user)]);
        // First sign-in: create an empty profile so the Principal can assign roles in Users
        if (!prof) prof = await ensureUserProfile(user).catch(() => null);
        setProfile(prof);
        setRoles(effectiveRoles(r)); // legacy names mapped; principal implies admin powers
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    return unsub;
  }, []);

  const hasRole = (...check) => check.some((r) => roles.includes(r));

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, roles, hasRole, loading: firebaseUser === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
