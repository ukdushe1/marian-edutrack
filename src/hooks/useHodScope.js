import { useAuth } from '../contexts/AuthContext';

/**
 * Which subjects (syllabus codes) the signed-in user leads — mirrors leadsGroup()
 * in firestore.rules. Principal / VP lead everything; a HOD leads only the
 * subjects on their profile (users/{uid}.hodSubjects, set in Users).
 */
export function useHodScope() {
  const { hasRole, profile } = useAuth();
  const senior   = hasRole('vicePrincipal', 'superAdmin', 'principal', 'head');
  const subjects = hasRole('hod') ? (profile?.hodSubjects ?? []) : [];
  const leads    = (code) => senior || (!!code && subjects.includes(code));
  return {
    senior,
    subjects,
    leads,
    leadsGroup: (g) => leads(g?.syllabusCode),
  };
}
