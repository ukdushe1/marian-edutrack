import { useEffect, useState } from 'react';
import { assessmentsCol, query, orderBy, onSnapshot } from '../firebase/firestore';

export function useAssessments(groupId) {
  const [assessments, setAssessments] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!groupId) { setLoading(false); return; }
    const q = query(assessmentsCol(groupId), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAssessments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  return { assessments, loading };
}
