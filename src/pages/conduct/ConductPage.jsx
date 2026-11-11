/**
 * Conduct log — Phase 3.
 * Merits, demerits, incidents. Tutors alerted when points cross a threshold.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { conductCol, addDoc, query, orderBy, onSnapshot, now, studentsCol, getDocs } from '../../firebase/firestore';
import { Shield, Plus, TrendingUp, TrendingDown, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const TYPES = [
  { value: 'merit',    label: 'Merit',    icon: TrendingUp,   points: +1,  color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
  { value: 'demerit',  label: 'Demerit',  icon: TrendingDown, points: -1,  color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  { value: 'incident', label: 'Incident', icon: AlertTriangle, points: -3,  color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
];
const ALERT_THRESHOLD = -5;

export default function ConductPage() {
  const { firebaseUser } = useAuth();
  const [entries,   setEntries]  = useState([]);
  const [students,  setStudents] = useState([]);
  const [showForm,  setShowForm] = useState(false);
  const [search,    setSearch]   = useState('');

  // Load all conduct entries
  useEffect(() => {
    const q = query(conductCol(), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  // Load students for search
  useEffect(() => {
    getDocs(studentsCol()).then((snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  // Aggregate points per student
  const pointsMap = {};
  entries.forEach((e) => {
    pointsMap[e.studentId] = (pointsMap[e.studentId] ?? 0) + (e.points ?? 0);
  });

  const alertStudents = students.filter((s) => (pointsMap[s.id] ?? 0) <= ALERT_THRESHOLD);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = students.find((st) => st.id === e.studentId);
    const name = s ? `${s.surname} ${s.firstName}` : '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2"><Shield size={20}/> Conduct log</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15}/> Add entry
        </button>
      </div>

      {/* Alert bar */}
      {alertStudents.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1 flex items-center gap-1.5">
            <AlertTriangle size={14}/> Students below {ALERT_THRESHOLD} points
          </p>
          <div className="flex flex-wrap gap-2">
            {alertStudents.map((s) => (
              <span key={s.id} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
                {s.surname}, {s.preferredName ?? s.firstName} ({pointsMap[s.id]})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by student name…"
        className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {/* Log entries */}
      <div className="space-y-2">
        {filtered.map((e) => {
          const typeMeta = TYPES.find((t) => t.value === e.type) ?? TYPES[1];
          const Icon     = typeMeta.icon;
          const student  = students.find((s) => s.id === e.studentId);
          const name     = student ? `${student.surname}, ${student.preferredName ?? student.firstName}` : e.studentId;
          return (
            <div key={e.id} className={clsx('flex items-start gap-3 p-3 rounded-xl border', typeMeta.color)}>
              <Icon size={16} className="mt-0.5 shrink-0"/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  <span className="text-xs shrink-0">{e.date ? format(new Date(e.date), 'dd MMM yyyy') : ''}</span>
                </div>
                <p className="text-xs mt-0.5">{typeMeta.label} · {e.points > 0 ? '+' : ''}{e.points} pts</p>
                {e.note && <p className="text-xs mt-1 opacity-80">{e.note}</p>}
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <div className="text-center py-10 text-slate-400 text-sm">No conduct entries yet.</div>
        )}
      </div>

      {/* Add form modal */}
      {showForm && (
        <ConductForm students={students} uid={firebaseUser.uid} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function ConductForm({ students, uid, onClose }) {
  const [form, setForm] = useState({ studentId: '', type: 'merit', note: '', date: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const [q,    setQ]    = useState('');

  const filtered = students.filter((s) => `${s.surname} ${s.firstName}`.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  const typeMeta = TYPES.find((t) => t.value === form.type);

  async function submit(e) {
    e.preventDefault();
    if (!form.studentId) { toast.error('Select a student.'); return; }
    setBusy(true);
    try {
      await addDoc(conductCol(), {
        ...form,
        points: typeMeta.points,
        by: uid,
        createdAt: now(),
      });
      toast.success('Entry added.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Add conduct entry</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {/* Student search */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-1" />
            {q && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                {filtered.map((s) => (
                  <button type="button" key={s.id}
                    onClick={() => { setForm((p) => ({ ...p, studentId: s.id })); setQ(`${s.surname}, ${s.preferredName ?? s.firstName}`); }}
                    className="w-full text-left text-sm px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                    {s.surname}, {s.preferredName ?? s.firstName}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <button type="button" key={t.value}
                  onClick={() => setForm((p) => ({ ...p, type: t.value }))}
                  className={clsx('flex-1 text-xs font-medium py-1.5 rounded-lg border transition-colors',
                    form.type === t.value ? t.color : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* Note */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Note (optional)</label>
            <textarea rows={2} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
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
