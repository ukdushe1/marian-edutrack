/**
 * Import school setup (Principal / System Admin): classes, subjects, students and
 * teaching groups from one workbook. Preview first; nothing is written until confirmed.
 */
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { writeBatch, doc, serverTimestamp, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { School, Upload, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { planSchoolSetup } from '../../lib/schoolSetup/schoolSetup';

export default function SchoolSetupCard() {
  const { hasRole } = useAuth();
  const [plan, setPlan] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);

  if (!hasRole('superAdmin')) return null;

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDone(null);
    file.arrayBuffer().then((buf) => {
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = (name) => wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase() === name)];
      if (!sheet('students') || !sheet('subjects')) { toast.error('The workbook needs two sheets: "Students" and "Subjects".'); return; }
      const rows = (name) => XLSX.utils.sheet_to_json(sheet(name), { defval: '' });
      setFileName(file.name);
      setPlan(planSchoolSetup(rows('students'), rows('subjects')));
    }).catch(() => toast.error('Could not read that file. Use .xlsx.'));
  }

  async function doImport() {
    const all = [...plan.classes, ...plan.syllabi, ...plan.students, ...plan.groups];
    setBusy(true); setProgress({ n: 0, total: all.length });
    try {
      for (let i = 0; i < all.length; i += 400) {
        const batch = writeBatch(db);
        all.slice(i, i + 400).forEach(({ path, data }) => batch.set(doc(db, path), { ...data, importedAt: serverTimestamp() }, { merge: true }));
        await batch.commit();
        setProgress({ n: Math.min(i + 400, all.length), total: all.length });
      }
      // Subjects from an earlier import that no class uses any more (e.g. old codes) are removed
      const keep = new Set(plan.syllabi.map((x) => x.path.split('/')[1]));
      const old = (await getDocs(query(collection(db, 'syllabi'), where('source', '==', 'schoolSetup')))).docs.filter((d) => !keep.has(d.id));
      let removed = 0;
      for (const d of old) {
        const used = await getDocs(query(collection(db, 'teachingGroups'), where('syllabusId', '==', d.id)));
        if (used.empty) { await deleteDoc(d.ref); removed++; }
      }
      setDone(`Imported ${plan.classes.length} classes, ${plan.syllabi.length} subjects, ${plan.students.length} students and ${plan.groups.length} teaching groups.${removed ? ` Removed ${removed} old subjects that no class uses now.` : ''}`);
      setPlan(null);
      toast.success('School setup imported.');
    } catch (e) {
      toast.error(`Import stopped: ${e.code ?? e.message}. It is safe to run again.`);
    } finally { setBusy(false); setProgress(null); }
  }

  // Per-class summary for the preview
  const perClass = plan ? plan.classes.map((c) => ({
    name: c.data.name,
    form: c.data.form,
    students: plan.students.filter((s) => s.data.classId === c.path.split('/')[1]).length,
    subjects: plan.groups.filter((g) => g.data.classId === c.path.split('/')[1]).map((g) => g.data.syllabusCode),
  })).sort((a, b) => a.form - b.form || a.name.localeCompare(b.name)) : [];

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><School size={16} /> Import school setup</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          One .xlsx with two sheets. <strong>Students</strong>: <code>class</code>, <code>surname</code>, <code>firstName</code>.{' '}
          <strong>Subjects</strong>: <code>class</code>, <code>subjects</code> (abbreviations as on the results schedules, e.g. “ENG, MAT, P.E, B.S”).
          Creates the classes, subjects, students and one teaching group per class per subject. Importing the same file again updates it and keeps the teachers you have assigned.
        </p>
      </div>

      <label className="inline-flex items-center gap-2 cursor-pointer border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium px-3 py-2 rounded-lg">
        <Upload size={14} /> Choose workbook
        <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} disabled={busy} />
      </label>

      {plan && (
        <div className="space-y-3">
          <p className="text-sm"><strong>{fileName}</strong>: {plan.classes.length} classes · {plan.syllabi.length} subjects · {plan.students.length} students · {plan.groups.length} teaching groups</p>
          {plan.errors.length > 0 && (
            <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <p className="font-semibold">Fix these in the file first:</p>
              <ul className="list-disc pl-5 text-xs mt-1">{plan.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {plan.warnings.length > 0 && (
            <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Check these</p>
              <ul className="list-disc pl-5 text-xs mt-1">{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="text-sm min-w-full">
              <thead><tr className="text-xs text-slate-500 text-left border-b border-slate-200 dark:border-slate-700"><th className="py-1.5 pr-3">Class</th><th className="pr-3">Form</th><th className="pr-3">Students</th><th>Subjects</th></tr></thead>
              <tbody>
                {perClass.map((c) => (
                  <tr key={c.name} className="border-b border-slate-100 dark:border-slate-700/50 align-top">
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{c.name}</td><td className="pr-3">{c.form}</td><td className="pr-3">{c.students}</td>
                    <td className="text-xs text-slate-500">{c.subjects.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={doImport} disabled={busy || plan.errors.length > 0}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {busy && progress ? `Importing ${progress.n}/${progress.total}…` : 'Import'}
            </button>
            {!busy && <button onClick={() => setPlan(null)} className="text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">Cancel</button>}
          </div>
        </div>
      )}
      {done && <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-1.5"><CheckCircle2 size={14} /> {done} Next: assign teachers to each group under Classes.</p>}
    </section>
  );
}
