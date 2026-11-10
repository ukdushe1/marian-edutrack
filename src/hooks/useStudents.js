import { useEffect, useState } from 'react';
import { studentsCol, query, where, onSnapshot } from '../firebase/firestore';

export function useStudents(studentIds = []) {
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!studentIds.length) { setStudents([]); setLoading(false); return; }
    // Firestore 'in' supports max 30 items; chunk if needed
    const ids = studentIds.slice(0, 30);
    const q = query(studentsCol(), where('__name__', 'in', ids));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.surname ?? '').localeCompare(b.surname ?? ''))
      );
      setLoading(false);
    });
    return unsub;
  }, [studentIds.join(',')]);

  return { students, loading };
}
