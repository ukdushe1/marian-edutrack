/**
 * Grade boundaries — Cambridge (or other board) boundaries per syllabus and series,
 * as % of the total. Exams officer / Principal / VP edit; all staff can read.
 */
import { useEffect, useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, getDocs, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ChevronRight, Plus, X, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const SERIES = ['May/June', 'Oct/Nov', 'Feb/Mar'];
const SCALES = {
  'IGCSE / O Level': ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
  'AS / A Level': ['A*', 'A', 'B', 'C', 'D', 'E'],
};
const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
const card = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700';

export default function GradeBoundariesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('examsOfficer', 'vicePrincipal', 'superAdmin');
  const [rows, setRows] = useState([]);
  const [syllabi, setSyllabi] = useState([]);
  const [editing, setEditing] = useState(undefined);

  useEffect(() => {
    getDocs(collection(db, 'syllabi')).then((s) => setSyllabi(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''))));
    return onSnapshot(collection(db, 'gradeBoundaries'), (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.syllabusCode ?? '').localeCompare(b.syllabusCode ?? ''))));
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ChevronRight size={20} /> Grade boundaries</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Published exam-board boundaries per syllabus and series, as a % of the total mark. The school’s own grade bands are set per exam window.</p>
        </div>
        {canEdit && <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg"><Plus size={15} /> Add boundaries</button>}
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const grades = Object.entries(r.boundaries ?? {}).sort((a, b) => b[1] - a[1]);
          return (
            <div key={r.id} className={`${card} px-4 py-3 flex items-start gap-3`}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{r.syllabusCode} <span className="text-xs font-normal text-slate-400">{r.series} {r.year}{r.scale ? ` · ${r.scale}` : ''}</span></p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {grades.map(([g, v]) => <span key={g} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full tabular-nums"><strong>{g}</strong> {v}%</span>)}
                </div>
              </div>
              {canEdit && <button aria-label="Edit" onClick={() => setEditing(r)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"><Pencil size={13} /></button>}
            </div>
          );
        })}
        {!rows.length && <p className="text-center py-12 text-sm text-slate-400">No grade boundaries yet.</p>}
      </div>
      {editing !== undefined && <BoundaryForm row={editing} syllabi={syllabi} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

function BoundaryForm({ row, syllabi, onClose }) {
  const year = new Date().getFullYear();
  const [f, setF] = useState({
    syllabusId: row?.syllabusId ?? syllabi[0]?.id ?? '', series: row?.series ?? SERIES[1], year: row?.year ?? year,
    scale: row?.scale ?? 'IGCSE / O Level', boundaries: row?.boundaries ?? {},
  });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const grades = SCALES[f.scale];

  async function save(e) {
    e.preventDefault();
    const vals = grades.map((g) => f.boundaries[g]).filter((v) => v !== '' && v != null).map(Number);
    if (vals.some((v) => isNaN(v) || v < 0 || v > 100)) { toast.error('Boundaries must be between 0 and 100.'); return; }
    if (vals.some((v, i) => i > 0 && v > vals[i - 1])) { toast.error('Each grade must need fewer marks than the one above it.'); return; }
    setBusy(true);
    const syl = syllabi.find((s) => s.id === f.syllabusId);
    const data = {
      ...f, year: Number(f.year), syllabusCode: syl?.code ?? '',
      boundaries: Object.fromEntries(grades.filter((g) => f.boundaries[g] !== '' && f.boundaries[g] != null).map((g) => [g, Number(f.boundaries[g])])),
      updatedAt: serverTimestamp(),
    };
    try {
      if (row) await updateDoc(doc(db, 'gradeBoundaries', row.id), data);
      else await addDoc(collection(db, 'gradeBoundaries'), { ...data, createdAt: serverTimestamp() });
      toast.success('Saved.'); onClose();
    } catch { toast.error('Save failed — only the exams officer, Principal or Vice Principal can edit.'); setBusy(false); }
  }

  async function remove() {
    try { await deleteDoc(doc(db, 'gradeBoundaries', row.id)); toast.success('Deleted.'); onClose(); }
    catch { toast.error('Delete failed.'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form onSubmit={save} className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{row ? 'Edit boundaries' : 'Add boundaries'}</h2>
          <button type="button" onClick={onClose} className="p-1"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs font-medium text-slate-500 mb-1">Syllabus</label>
            <select className={inp} value={f.syllabusId} onChange={(e) => setF({ ...f, syllabusId: e.target.value })}>
              {syllabi.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Series</label>
            <select className={inp} value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })}>{SERIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
            <input type="number" className={inp} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
          <div className="col-span-2"><label className="block text-xs font-medium text-slate-500 mb-1">Grade scale</label>
            <select className={inp} value={f.scale} onChange={(e) => setF({ ...f, scale: e.target.value })}>{Object.keys(SCALES).map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Minimum % for each grade (leave blank if not published)</p>
          <div className="grid grid-cols-4 gap-2">
            {grades.map((g) => (
              <label key={g} className="text-sm flex items-center gap-1.5"><strong className="w-6">{g}</strong>
                <input type="number" min={0} max={100} className="w-full text-sm border rounded px-1.5 py-1 dark:bg-slate-900 dark:border-slate-600"
                  value={f.boundaries[g] ?? ''} onChange={(e) => setF({ ...f, boundaries: { ...f.boundaries, [g]: e.target.value } })} />
              </label>
            ))}
          </div>
        </div>
        <button className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {row && (confirm
          ? <div className="flex items-center gap-2 text-sm"><span className="flex-1 text-red-600">Delete these boundaries?</span>
              <button type="button" onClick={() => setConfirm(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">Cancel</button>
              <button type="button" onClick={remove} className="px-3 py-1.5 rounded-lg bg-red-600 text-white">Delete</button></div>
          : <button type="button" onClick={() => setConfirm(true)} className="w-full text-xs text-slate-400 hover:text-red-600">Delete</button>)}
      </form>
    </div>
  );
}
