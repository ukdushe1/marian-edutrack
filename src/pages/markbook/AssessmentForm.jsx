import { useState } from 'react';
import { addDoc, assessmentsCol, now } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

const COMPONENTS = ['Paper 1', 'Paper 2', 'Paper 3', 'Paper 4', 'Coursework', 'Practical', 'Mock', 'Class test', 'Other'];

export default function AssessmentForm({ groupId, assessment, onClose }) {
  const { firebaseUser } = useAuth();
  const editing = !!assessment;

  const [form, setForm] = useState({
    title:     assessment?.title     ?? '',
    component: assessment?.component ?? 'Class test',
    maxMark:   assessment?.maxMark   ?? 100,
    date:      assessment?.date      ?? new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await addDoc(assessmentsCol(groupId), {
        ...form,
        maxMark:   Number(form.maxMark),
        createdBy: firebaseUser.uid,
        createdAt: now(),
      });
      toast.success('Assessment added.');
      onClose();
    } catch {
      toast.error('Failed to save assessment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit assessment' : 'New assessment'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Title">
            <input required value={form.title} onChange={(e) => set('title', e.target.value)}
              className={input} placeholder="e.g. Paper 1 Mock" />
          </Field>
          <Field label="Component">
            <select value={form.component} onChange={(e) => set('component', e.target.value)} className={input}>
              {COMPONENTS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max mark">
              <input required type="number" min={1} max={1000} value={form.maxMark}
                onChange={(e) => set('maxMark', e.target.value)} className={input} />
            </Field>
            <Field label="Date">
              <input required type="date" value={form.date}
                onChange={(e) => set('date', e.target.value)} className={input} />
            </Field>
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

const input = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
