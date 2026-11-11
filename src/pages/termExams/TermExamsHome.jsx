/** End-of-term exams — list of exam windows; exams officer / Principal / VP create one. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ClipboardCheck, Plus, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { windowsCol, DEFAULT_BANDS, deriveForms, STAGES } from '../../lib/termExam/model';
import { card, input, label, btn, useExamRoles } from './ui';

export default function TermExamsHome() {
  const roles = useExamRoles();
  const [windows, setWindows] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => onSnapshot(query(windowsCol(), orderBy('startDate', 'desc')),
    (s) => setWindows(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ClipboardCheck size={20} /> End-of-term exams</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">From setting papers to publishing report cards, with a sign-off at every stage.</p>
        </div>
        {roles.canManage && <button className={btn} onClick={() => setCreating(true)}><Plus size={15} /> New exam window</button>}
      </div>

      <div className="space-y-2">
        {windows.map((w) => (
          <Link key={w.id} to={`/exams/term/${w.id}`} className={`${card} flex items-center gap-3 px-4 py-3 hover:border-brand-300`}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{w.name}</p>
              <p className="text-xs text-slate-400">{w.startDate} to {w.endDate} · {(w.forms ?? []).length} forms ·{' '}
                {w.published ? `Published (v${w.version ?? 1})` : w.approved ? 'Approved, in progress' : 'Awaiting approval'}</p>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </Link>
        ))}
        {!windows.length && <p className="text-center py-12 text-sm text-slate-400">No exam windows yet.</p>}
      </div>

      <div className={`${card} p-4`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">The 10 stages</p>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {STAGES.map((s) => <li key={s.key}><strong>{s.n}. {s.label}</strong> ({s.who}) — sign-off: {s.signoff}</li>)}
        </ol>
      </div>

      {creating && <CreateWindow onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateWindow({ onClose }) {
  const nav = useNavigate();
  const [terms, setTerms] = useState([]);
  const [forms, setForms] = useState([]);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ name: '', termId: '', startDate: today, endDate: today, forms: [] });

  useEffect(() => {
    getDocs(collection(db, 'terms')).then((s) => {
      const t = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTerms(t);
      const cur = t.find((x) => x.isCurrent) ?? t[0];
      if (cur) setF((p) => ({ ...p, termId: cur.id, name: p.name || `${cur.name ?? `Term ${cur.term} ${cur.year}`} end-of-term exams` }));
    });
    Promise.all([getDocs(collection(db, 'students')), getDocs(collection(db, 'classes'))]).then(([s, c]) =>
      setForms(deriveForms(s.docs.map((d) => ({ id: d.id, ...d.data() })), c.docs.map((d) => ({ id: d.id, ...d.data() })))));
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!f.forms.length) { toast.error('Choose at least one form.'); return; }
    if (f.endDate < f.startDate) { toast.error('End date is before start date.'); return; }
    setBusy(true);
    try {
      const ref = await addDoc(windowsCol(), {
        ...f, defaultSplit: { exam: 70, coursework: 30 }, subjects: {}, gradeBands: DEFAULT_BANDS,
        minSubjects: 5, courseworkFrom: '', nextTermOpens: '', stageDue: {},
        approved: false, timetablePublished: false, resultsChecked: false, published: false, version: 0,
        createdAt: serverTimestamp(),
      });
      toast.success('Exam window created. Finish the setup, then ask the Principal to approve it.');
      nav(`/exams/term/${ref.id}`);
    } catch { toast.error('Could not create the window.'); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form onSubmit={create} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">New exam window</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>
        <div><label className={label}>Name</label><input className={input} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div>
          <label className={label}>Term</label>
          <select className={input} value={f.termId} onChange={(e) => setF({ ...f, termId: e.target.value })} required>
            <option value="">Choose…</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name ?? `Term ${t.term} ${t.year}`}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>First exam</label><input type="date" className={input} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><label className={label}>Last exam</label><input type="date" className={input} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <div>
          <label className={label}>Forms included</label>
          <div className="flex flex-wrap gap-1.5">
            {forms.map((fm) => (
              <button type="button" key={fm.id} onClick={() => setF({ ...f, forms: f.forms.includes(fm.id) ? f.forms.filter((x) => x !== fm.id) : [...f.forms, fm.id] })}
                className={`text-xs px-2.5 py-1 rounded-full border ${f.forms.includes(fm.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                {fm.name}
              </button>
            ))}
            {!forms.length && <p className="text-xs text-slate-400">No forms found — import students with a class first.</p>}
          </div>
        </div>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </form>
    </div>
  );
}
