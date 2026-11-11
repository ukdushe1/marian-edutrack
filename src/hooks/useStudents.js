import { useEffect, useState } from 'react';
import { studentsCol, query, where, onSnapshot } from '../firebase/firestore';

const CHUNK = 30; // Firestore 'in' queries accept at most 30 values

/** Live list of students by id, sorted by surname. Handles classes larger than 30. */
export function useStudents(studentIds = []) {
  const [students, setStudents] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const key = studentIds.join(',');

  useEffect(() => {
    if (!studentIds.length) { setStudents([]); setLoading(false); return; }
    setLoading(true);

    const chunks = [];
    for (let i = 0; i < studentIds.length; i += CHUNK) chunks.push(studentIds.slice(i, i + CHUNK));
    const results = new Array(chunks.length).fill(null);

    const unsubs = chunks.map((ids, idx) =>
      onSnapshot(query(studentsCol(), where('__name__', 'in', ids)), (snap) => {
        results[idx] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (results.every(Boolean)) {
          setStudents(results.flat().sort((a, b) =>
            (a.surname ?? '').localeCompare(b.surname ?? '') || (a.firstName ?? '').localeCompare(b.firstName ?? '')));
          setLoading(false);
        }
      }));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { students, loading };
}
