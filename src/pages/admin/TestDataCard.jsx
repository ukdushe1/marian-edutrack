/**
 * Load / remove test data for one class from a mark-list CSV (superAdmin only).
 * Student names come only from the uploaded file — never from source code — and
 * everything created is tagged testData: true so it can be removed cleanly.
 */
import { useState } from 'react';
import { FlaskConical, Trash2, Loader2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { seedTestData, removeTestData, parseMarkListCsv } from '../../lib/testData/classTestData';
import { normaliseNumber, formatNumber } from '../../lib/guardianMessages';

export default function TestDataCard() {
  const { firebaseUser, profile, hasRole } = useAuth();
  const [number,   setNumber]   = useState('');
  const [busy,     setBusy]     = useState(null); // 'seed' | 'remove' | null
  const [progress, setProgress] = useState(null);
  const [confirm,  setConfirm]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [roster,   setRoster]   = useState(null); // { name, students, errors }
  const [className, setClassName] = useState('3D1');

  if (!hasRole('superAdmin')) return null;

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const parsed = parseMarkListCsv(text);
      setRoster({ name: file.name, ...parsed });
      const m = file.name.match(/\b(\d[A-Za-z]\d?|L6|U6)\b/i);
      if (m) setClassName(m[1].toUpperCase());
    });
    e.target.value = '';
  }

  const normalised = number ? normaliseNumber(number) : null;
  const numberOk = !number || !!normalised;

  async function seed() {
    setBusy('seed'); setResult(null); setProgress({ n: 0, total: 1 });
    try {
      const r = await seedTestData({
        uid: firebaseUser.uid, userName: profile?.name ?? 'Admin', testNumber: normalised,
        students: roster.students, className: className.trim() || 'Test class',
        onProgress: (n, total) => setProgress({ n, total }),
      });
      setResult(r.errors.length
        ? { ok: false, text: `Loaded ${r.written} records, ${r.errors.length} failed.`, errors: r.errors }
        : { ok: true, text: `Loaded ${r.written} records for ${className}. Reload the page to see them in every menu.` });
      r.errors.length ? toast.error('Some test records failed.') : toast.success('Test data loaded.');
    } catch (e) {
      setResult({ ok: false, text: `Failed: ${e.code ?? e.message}` });
    } finally { setBusy(null); setProgress(null); }
  }

  async function remove() {
    setConfirm(false); setBusy('remove'); setResult(null); setProgress({ n: 0, total: 1 });
    try {
      const r = await removeTestData({ onProgress: (n, total) => setProgress({ n, total }) });
      setResult(r.errors.length
        ? { ok: false, text: `Removed ${r.removed}, ${r.errors.length} failed.`, errors: r.errors }
        : { ok: true, text: `Removed ${r.removed} test records.` });
      toast.success('Test data removed.');
    } catch (e) {
      setResult({ ok: false, text: `Failed: ${e.code ?? e.message}` });
    } finally { setBusy(null); setProgress(null); }
  }

  const pct = progress ? Math.round((progress.n / Math.max(progress.total, 1)) * 100) : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-brand-300 dark:border-brand-800 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} className="text-brand-600" />
        <h2 className="font-semibold">Test data from a mark list</h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Upload a class mark list (CSV: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">surname,firstName,ex1…ex10,test1…test4</code>).
        It loads those students and marks, plus sample registers,
        reports at every stage, predictions, conduct, notices, guardians, schemes of work, bookings, cover,
        exams, Cambridge entries, boarding, test staff (incl. a HOD and Vice Principal), preset comments, grade boundaries, six subjects, last term’s published exam window and this term’s window at mixed stages — enough to try every page.
        You are set as the class teacher. Everything is tagged as test data and can be removed in one click.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
          <Upload size={14} /> {roster ? roster.name : 'Choose mark list (.csv)'}
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Class name</label>
          <input value={className} onChange={(e) => setClassName(e.target.value)}
            className="w-24 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      {roster && (
        <p className={roster.errors.length ? 'text-xs text-red-600' : 'text-xs text-green-700 dark:text-green-400'}>
          {roster.students.length} students read from {roster.name}.
          {roster.errors.slice(0, 3).map((e) => <span key={e} className="block">{e}</span>)}
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Your WhatsApp number for guardian tests (optional)
        </label>
        <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" placeholder="0771 234 567"
          className="w-full sm:w-64 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <p className={numberOk ? 'text-[11px] text-slate-400 mt-0.5' : 'text-[11px] text-red-600 mt-0.5'}>
          {!numberOk ? 'Not a valid number'
            : normalised ? `Test guardians with consent will use ${formatNumber(number)}, so only you get messages.`
            : 'Without a number, test guardians show "No valid WhatsApp number" — no real person is ever messaged.'}
        </p>
      </div>

      {progress && (
        <div className="space-y-1">
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-400">{busy === 'seed' ? 'Loading' : 'Removing'}… {progress.n}/{progress.total}</p>
        </div>
      )}

      {result && (
        <div className={result.ok ? 'text-sm text-green-700 dark:text-green-400' : 'text-sm text-red-600'}>
          {result.text}
          {result.errors?.length > 0 && (
            <ul className="mt-1 text-xs list-disc pl-5 max-h-24 overflow-y-auto">
              {result.errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={seed} disabled={!!busy || !numberOk || !roster || roster.errors.length > 0}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          {busy === 'seed' ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
          Load test data
        </button>
        {confirm ? (
          <>
            <span className="text-sm text-red-600">Delete all test records?</span>
            <button onClick={() => setConfirm(false)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">Cancel</button>
            <button onClick={remove} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">Delete</button>
          </>
        ) : (
          <button onClick={() => setConfirm(true)} disabled={!!busy}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 disabled:opacity-60">
            {busy === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Remove test data
          </button>
        )}
      </div>
    </div>
  );
}
