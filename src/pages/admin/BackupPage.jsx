/** Backup & restore — Principal / System Admin. */
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DatabaseBackup, Download, Upload, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { createBackup, downloadBackup, readBackup, restoreBackup, APPEND_ONLY } from '../../lib/backup';

const card = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3';
const btn = 'inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg';
const ghost = 'inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50';

export default function BackupPage() {
  const { hasRole, firebaseUser } = useAuth();
  const [last, setLast] = useState(undefined);
  const [busy, setBusy] = useState('');
  const [file, setFile] = useState(null);   // { name, backup, byGroup }
  const [chosen, setChosen] = useState([]);
  const [mode, setMode] = useState('missing');
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => onSnapshot(doc(db, 'settings', 'backup'), (d) => setLast(d.exists() ? d.data() : null), () => setLast(null)), []);

  if (!hasRole('superAdmin')) return <p className="text-sm text-slate-500">Only the Principal or System Admin can back up or restore data.</p>;

  async function backup() {
    setBusy('Starting…'); setResult(null);
    try {
      const b = await createBackup({ uid: firebaseUser.uid, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, onProgress: setBusy });
      const total = await downloadBackup(b, firebaseUser.uid);
      toast.success(`Backup downloaded: ${total} records.`);
    } catch (e) { toast.error(`Backup failed: ${e.code ?? e.message}`); }
    finally { setBusy(''); }
  }

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    f.text().then((t) => {
      try {
        const r = readBackup(t);
        setFile({ name: f.name, ...r });
        setChosen(Object.keys(r.byGroup).filter((g) => g !== 'users' && !APPEND_ONLY.includes(g)));
        setResult(null);
      } catch (err) { toast.error(err.message); }
    });
  }

  async function restore() {
    setConfirm(false); setBusy('Restoring…'); setProgress({ n: 0, total: 1 });
    try {
      const r = await restoreBackup(file.backup, chosen, mode, (n, total) => setProgress({ n, total }));
      setResult(r);
      toast[r.errors.length ? 'error' : 'success'](`Restored ${r.written} records${r.skipped ? `, ${r.skipped} already present` : ''}${r.errors.length ? `, ${r.errors.length} failed` : ''}.`);
    } catch (e) { toast.error(`Restore failed: ${e.message}`); }
    finally { setBusy(''); setProgress(null); }
  }

  const lastDate = last?.lastBackupAt?.toDate?.();
  const days = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 864e5) : null;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><DatabaseBackup size={20} /> Backup &amp; restore</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">The free Firebase plan keeps no automatic backups. Download one regularly — weekly, and before every exam publication.</p>
      </div>

      <section className={card}>
        <h2 className="font-semibold">Download a backup</h2>
        <p className={clsx('text-sm', days == null || days >= 7 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500')}>
          {last === undefined ? 'Checking…' : lastDate ? `Last backup ${lastDate.toLocaleString()} (${days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''} ago`}), ${last.documents} records.` : 'No backup has been taken yet.'}
        </p>
        <p className="text-xs text-slate-500">One file with every record: students, marks, reports, guardians, exams, logs. It contains personal data — keep it somewhere safe and private (e.g. an encrypted drive), never on a shared computer or in email.</p>
        <button className={btn} onClick={backup} disabled={!!busy}>{busy && !progress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy && !progress ? busy : 'Download full backup'}</button>
      </section>

      <section className={card}>
        <h2 className="font-semibold">Restore from a backup</h2>
        <p className="text-xs text-slate-500">Choose what to bring back. Records added since the backup are never deleted. Audit and message logs stay in the file but are never rewritten.</p>
        <label className={clsx(ghost, 'cursor-pointer w-fit')}><Upload size={14} /> {file ? file.name : 'Choose backup file (.json)'}
          <input type="file" accept=".json,application/json" className="hidden" onChange={pick} />
        </label>
        {file && (
          <>
            <p className="text-xs text-slate-500">Backup taken {new Date(file.backup.createdAt).toLocaleString()}{file.backup.projectId && file.backup.projectId !== import.meta.env.VITE_FIREBASE_PROJECT_ID ? ` from another project (${file.backup.projectId})` : ''}.</p>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(file.byGroup).sort().map(([g, n]) => (
                <label key={g} className={clsx('flex items-center gap-2 text-sm', APPEND_ONLY.includes(g) && 'opacity-50')}>
                  <input type="checkbox" className="accent-brand-600" disabled={APPEND_ONLY.includes(g)} checked={chosen.includes(g)}
                    onChange={() => setChosen((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]))} />
                  {g} <span className="text-xs text-slate-400">{n}</span>
                  {g === 'users' && <span className="text-[11px] text-amber-600">roles — off by default</span>}
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'missing'} onChange={() => setMode('missing')} className="accent-brand-600" /> Only bring back records that were deleted (safe)</label>
              <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} className="accent-brand-600" /> Overwrite with the backup’s copy (undoes changes made since)</label>
            </div>
            {progress && (
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600" style={{ width: `${Math.round((progress.n / progress.total) * 100)}%` }} />
              </div>
            )}
            {confirm ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="flex-1">{mode === 'overwrite' ? 'Overwrite' : 'Restore'} {chosen.length} kinds of record? Take a fresh backup first if unsure.</span>
                <button className={ghost} onClick={() => setConfirm(false)}>Cancel</button>
                <button className={btn} onClick={restore}>Restore</button>
              </div>
            ) : (
              <button className={btn} disabled={!!busy || !chosen.length} onClick={() => setConfirm(true)}>Restore selected</button>
            )}
            {result?.errors?.length > 0 && <ul className="text-xs text-red-600 list-disc pl-5 max-h-32 overflow-y-auto">{result.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>}
          </>
        )}
      </section>
    </div>
  );
}
