import { useEffect, useState } from 'react';
import { termsCol, query, where, getDocs } from '../firebase/firestore';

export function useCurrentTerm() {
  const [term,    setTerm]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(termsCol(), where('isCurrent', '==', true));
    getDocs(q).then((snap) => {
      setTerm(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
      setLoading(false);
    });
  }, []);

  return { term, loading };
}
