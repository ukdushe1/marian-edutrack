/**
 * Audit log — Principal / System Admin, read-only (append-only in firestore.rules).
 * Shows role changes and edits to existing marks, newest first.
 */
import { useState, useEffect, useMemo } from 'react';
import { col, query, orderBy, limit, onSnapshot, getDocs, usersCol, studentsCol } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { ScrollText } from 'lucide-react';
import clsx from 'clsx';
import { roleLabel } from '../../lib/roles';

const KIND = { users: 'Role change', marks: 'Mark edit' };

function describe(entry, names) {
  const b = entry.before ?? {}, a = entry.after ?? {};
  if (entry.collection === 'users') {
    const list = (r) => (r ?? []).map(roleLabel).join(', ') || 'none';
    const subj = a.hodSubjects?.length ? ` (HOD: ${a.hodSubjects.join(', ')})` : '';
    return `${names[entry.docId] ?? entry.docId}: ${list(b.roles)} → ${list(a.roles)}${subj}`;
  }
  if (entry.collection === 'marks') {
    const v = (x) => (x.status ? x.status : x.raw ?? '—');
    const assessment = (entry.docId ?? '').split('/').at(-1);
    const sid = a.studentId ?? b.studentId;
    return `${assessment} · ${names[sid] ?? sid}: ${v(b)} → ${v(a)}`;
  }
  return `${entry.collection}/${entry.docId}`;
}

export default function AuditLogPage() {
  const { hasRole } = useAuth();
  const [entries, setEntries] = useState([]);
  const [names,   setNames]   = useState({});
  const [kind,    setKind]    = useState('all');

  useEffect(() => {
    if (!hasRole('superAdmin')) return undefined;
    Promise.all([getDocs(usersCol()), getDocs(studentsCol())]).then(([u, st]) => setNames({
      ...Object.fromEntries(st.docs.map((d) => [d.id, `${d.data().surname}, ${d.data().firstName}`])),
      ...Object.fromEntries(u.docs.map((d) => [d.id, d.data().name ?? d.id])),
    }));
    return onSnapshot(query(col('auditLog'), orderBy('when', 'desc'), limit(300)),
      (s) => setEntries(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => entries.filter((e) => kind === 'all' || e.collection === kind), [entries, kind]);

  if (!hasRole('superAdmin')) return <p className="text-sm text-slate-500">Only the Principal or System Admin can view the audit log.</p>;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><ScrollText size={20} /> Audit log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Role changes and edits to existing marks. Entries cannot be changed or deleted.</p>
      </div>
      <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden w-fit">
        {[['all', 'All'], ['users', 'Role changes'], ['marks', 'Mark edits']].map(([id, label]) => (
          <button key={id} onClick={() => setKind(id)}
            className={clsx('px-3 py-1.5 text-xs font-medium transition-colors',
              kind === id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700')}>
            {label}
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {visible.map((e) => (
          <div key={e.id} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">{KIND[e.collection] ?? e.collection}</span>
              <span>by {names[e.who] ?? e.who}</span>
              <span>{e.when?.toDate?.().toLocaleString() ?? ''}</span>
            </div>
            <p className="mt-0.5">{describe(e, names)}</p>
          </div>
        ))}
        {!visible.length && <p className="px-4 py-10 text-center text-sm text-slate-400">Nothing logged yet.</p>}
      </div>
    </div>
  );
}
