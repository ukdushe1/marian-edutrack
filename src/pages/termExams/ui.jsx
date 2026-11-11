/** Small shared UI pieces for the end-of-term exam module. */
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';

export const card  = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700';
export const input = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
export const label = 'block text-xs font-medium text-slate-500 mb-1';
export const btn   = 'inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors';
export const btnGhost = 'inline-flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors';

const PILL = {
  done:     ['Done',        'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'],
  progress: ['In progress', 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'],
  late:     ['Late',        'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'],
  todo:     ['Not started', 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'],
};
export function StatusPill({ status, compact }) {
  const [text, cls] = PILL[status] ?? PILL.todo;
  return <span className={clsx('inline-block rounded-full font-medium', compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5', cls)}>{text}</span>;
}

export function Note({ tone = 'info', children }) {
  const cls = {
    info: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
    warn: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
    ok:   'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  }[tone];
  return <div className={clsx('text-sm border rounded-xl px-4 py-3', cls)}>{children}</div>;
}

/** Role helpers for the module (Principal implies superAdmin + vicePrincipal). */
export function useExamRoles() {
  const { hasRole, profile, firebaseUser } = useAuth();
  const senior = hasRole('vicePrincipal', 'superAdmin');
  return {
    uid: firebaseUser?.uid,
    senior,
    canManage: senior || hasRole('examsOfficer'),
    canApprove: senior,
    hodOf: (code) => senior || (hasRole('hod') && (profile?.hodSubjects ?? []).includes(code)),
    isHod: senior || hasRole('hod'),
  };
}

export const userName = (users, id) => users.find((u) => u.id === id)?.name ?? '—';
export const studentName = (s) => (s ? `${s.surname}, ${s.preferredName || s.firstName}` : '—');
