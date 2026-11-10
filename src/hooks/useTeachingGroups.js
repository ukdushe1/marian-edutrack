import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { teachingGroupsCol, query, where, onSnapshot } from '../firebase/firestore';

export function useTeachingGroups() {
  const { firebaseUser } = useAuth();
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(teachingGroupsCol(), where('teacherIds', 'array-contains', firebaseUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [firebaseUser]);

  return { groups, loading };
}
