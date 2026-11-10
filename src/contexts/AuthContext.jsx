import { createContext, useContext, useEffect, useState } from 'react';
import { onAuth, getUserProfile, getUserRoles } from '../firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [profile,      setProfile]      = useState(null);
  const [roles,        setRoles]        = useState([]);

  useEffect(() => {
    const unsub = onAuth(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const [prof, r] = await Promise.all([getUserProfile(user.uid), getUserRoles(user)]);
        setProfile(prof);
        setRoles(r);
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
