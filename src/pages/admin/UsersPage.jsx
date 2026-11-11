/**
 * Users & roles — Principal / System Admin only.
 * Assign roles and the subjects a HOD manages. New staff appear here after
 * their first sign-in with no role. Every change is written to the audit log.
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  usersCol, userRef, syllabiCol, onSnapshot, getDocs, updateDoc, now, writeAuditLog,
} from '../../firebase/firestore';
import { Users, X, Pencil, Search, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ROLES, normaliseRoles, roleLabel } from '../../lib/roles';

export default function UsersPage() {
  const { hasRole } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [codes,   setCodes]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(usersCol(), (s) => setUsers(
      s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => Number((a.roles ?? []).length > 0) - Number((b.roles ?? []).length > 0)
          || (a.name ?? '').localeCompare(b.name ?? ''))));
    getDocs(syllabiCol()).then((s) => setCodes(
      [...new Set(s.docs.map((d) => d.data().code).filter(Boolean))].sort()));
    return unsub;
  }, []);

  const visible = useMemo(() => users.filter((u) =>
    `${u.name} ${u.email} ${(u.roles ?? []).map(roleLabel).join(' ')}`.toLowerCase().includes(search.toLowerCase())),
  [users, search]);

  if (!hasRole('superAdmin')) {
    return <p className="text-sm text-slate-500">Only the Principal or System Admin can manage users.</p>;
  }

  const pending = users.filter((u) => !(u.roles ?? []).length).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Users size={20} /> Users &amp; roles</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {users.length} users{pending > 0 && ` · ${pending} waiting for a role`}. New staff appear here after they first sign in.
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or role…"
          className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {visible.map((u) => {
          const roles = normaliseRoles(u.roles);
          return (
            <div key={u.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.name ?? 'Unnamed'}</p>
                {u.email && <p className="text-xs text-slate-400 truncate">{u.email}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {roles.map((r) => (
                    <span key={r} className={clsx('text-[11px] font-medium px-2 py-0.5 rounded-full',
                      r === 'principal' || r === 'superAdmin'
                        ? 'bg-brand-600 text-white'
                        : 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300')}>
                      {roleLabel(r)}{r === 'hod' && u.hodSubjects?.length ? ` · ${u.hodSubjects.join(', ')}` : ''}
                    </span>
                  ))}
                  {!roles.length && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      <UserPlus size={11} /> Needs a role
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400">
                <Pencil size={14} />
              </button>
            </div>
          );
        })}
        {!visible.length && <p className="px-4 py-10 text-center text-sm text-slate-400">No users found.</p>}
      </div>

      {editing && <UserForm user={editing} codes={codes} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UserForm({ user, codes, onClose }) {
  const { firebaseUser } = useAuth();
  const [name,     setName]     = useState(user.name ?? '');
  const [roles,    setRoles]    = useState(normaliseRoles(user.roles));
  const [subjects, setSubjects] = useState(user.hodSubjects ?? []);
  const [busy,     setBusy]     = useState(false);
  const isSelf = user.id === firebaseUser.uid;

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save(e) {
    e.preventDefault();
    // Don't let the last admin lock themselves out by accident
    if (isSelf && !roles.includes('principal') && !roles.includes('superAdmin')) {
      toast.error('You cannot remove your own Principal / System Admin role here.');
      return;
    }
    if (roles.includes('hod') && !subjects.length) {
      toast.error('Choose at least one subject for the HOD.');
      return;
    }
    setBusy(true);
    const before = { roles: user.roles ?? [], hodSubjects: user.hodSubjects ?? [] };
    const after  = { roles, hodSubjects: roles.includes('hod') ? subjects : [] };
    try {
      await updateDoc(userRef(user.id), { name: name.trim(), ...after, updatedAt: now() });
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        await writeAuditLog(firebaseUser.uid, 'users', user.id, before, after);
      }
      toast.success('User updated.');
      onClose();
    } catch {
      toast.error('Save failed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Edit user</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
            {user.email && <p className="text-[11px] text-slate-400 mt-0.5">{user.email}</p>}
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Roles</p>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700">
              {ROLES.map((r) => (
                <label key={r.key} className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input type="checkbox" checked={roles.includes(r.key)} onChange={() => toggle(roles, setRoles, r.key)} className="accent-brand-600 mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-[11px] text-slate-400">{r.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {roles.includes('hod') && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Subjects this HOD manages (syllabus codes)</p>
              {codes.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {codes.map((c) => (
                    <button key={c} type="button" onClick={() => toggle(subjects, setSubjects, c)}
                      className={clsx('text-xs px-2.5 py-1 rounded-full border transition-colors',
                        subjects.includes(c)
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300')}>
                      {c}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No syllabi yet — add one under Syllabi first.</p>
              )}
            </div>
          )}

          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
