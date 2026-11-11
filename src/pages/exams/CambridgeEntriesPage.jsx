/**
 * Cambridge entries — Phase 3.
 * Track candidate registrations per exam series; flag missing entries; export CSV.
 */
import { useState, useEffect } from 'react';
import {
  col, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, getDocs, now, studentsCol, syllabiCol,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { GraduationCap, Plus, X, Download, Pencil } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const entriesCol  = () => col('cambridgeEntries');
const SERIES = ['May/June', 'Oct/Nov', 'Feb/Mar'];

export default function CambridgeEntriesPage() {
  const [entries,  setEntries]  = useState([]);
  const [students, setStudents] = useState([]);
  const [syllabi,  setSyllabi]  = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [filterSeries, setFilterSeries] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(query(entriesCol(), orderBy('createdAt', 'desc')), (s) =>
      setEntries(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    getDocs(studentsCol()).then((s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    getDocs(syllabiCol()).then((s) => setSyllabi(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const filtered = filterSeries ? entries.filter((e) => e.series === filterSeries) : entries;

  function student(id) { return students.find((s) => s.id === id); }
  function syllabus(id) { return syllabi.find((s) => s.id === id); }

  function exportCsv() {
    const rows = [
      ['CandidateNo', 'Surname', 'FirstName', 'SyllabuCode', 'Series', 'Year', 'Status'],
      ...filtered.map((e) => {
        const stu = student(e.studentId);
        const syl = syllabus(e.syllabusId);
        return [stu?.candidateNo ?? '', stu?.surname ?? '', stu?.firstName ?? '',
          syl?.code ?? '', e.series, e.year, e.status ?? 'pending'];
      }),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cambridge-entries-${filterSeries || 'all'}.csv`;
    a.click();
  }

  async function deleteEntry(id) {
    if (!confirm('Remove this entry?')) return;
    await deleteDoc(doc(db, 'cambridgeEntries', id));
    toast.success('Entry removed.');
  }

  const statusColor = { pending: 'amber', confirmed: 'green', withdrawn: 'slate' };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><GraduationCap size={20}/> Cambridge entries</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} entries</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={filterSeries} onChange={(e) => setFilterSeries(e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900">
            <option value="">All series</option>
            {SERIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Download size={14}/> Export CSV
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15}/> Add entry
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Candidate</th>
              <th className="px-3 py-2 text-left">Syllabus</th>
              <th className="px-3 py-2 text-left">Series</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map((e) => {
              const stu = student(e.studentId);
              const syl = syllabus(e.syllabusId);
              const col = statusColor[e.status ?? 'pending'];
              return (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-3 py-2">
                    <p className="font-medium">{stu?.surname ?? '—'}, {stu?.firstName}</p>
                    <p className="text-xs text-slate-400">{stu?.candidateNo ?? 'No candidate no.'}</p>
                  </td>
                  <td className="px-3 py-2">{syl?.code ?? '—'}</td>
                  <td className="px-3 py-2">{e.series} {e.year}</td>
                  <td className="px-3 py-2">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                      col === 'green'  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                      col === 'amber'  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                                         'bg-slate-100 dark:bg-slate-700 text-slate-600')}>
                      {e.status ?? 'pending'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditing(e); setShowForm(true); }}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400"><Pencil size={12}/></button>
                      <button onClick={() => deleteEntry(e.id)}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-500"><X size={12}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">No entries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <EntryForm entry={editing} students={students} syllabi={syllabi} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function EntryForm({ entry, students, syllabi, onClose }) {
  const editing = !!entry;
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState({
    studentId:  entry?.studentId  ?? '',
    syllabusId: entry?.syllabusId ?? syllabi[0]?.id ?? '',
    series:     entry?.series     ?? SERIES[0],
    year:       entry?.year       ?? thisYear,
    status:     entry?.status     ?? 'pending',
    notes:      entry?.notes      ?? '',
  });
  const [stuSearch, setStuSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredStu = students
    .filter((s) => `${s.surname} ${s.firstName}`.toLowerCase().includes(stuSearch.toLowerCase()))
    .slice(0, 15);

  async function submit(e) {
    e.preventDefault();
    if (!form.studentId) { toast.error('Select a student.'); return; }
    setBusy(true);
    try {
      const payload = { ...form, year: Number(form.year), updatedAt: now() };
      if (editing) {
        await updateDoc(doc(db, 'cambridgeEntries', entry.id), payload);
      } else {
        await addDoc(entriesCol(), { ...payload, createdAt: now() });
      }
      toast.success(editing ? 'Entry updated.' : 'Entry added.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const selectedStu = students.find((s) => s.id === form.studentId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit entry' : 'Add entry'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
            {selectedStu ? (
              <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-1.5 text-sm">
                <span>{selectedStu.surname}, {selectedStu.firstName}</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, studentId: '' }))}><X size={12}/></button>
              </div>
            ) : (
              <>
                <input value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder="Search students…" className={inp} />
                <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg mt-1 divide-y divide-slate-100 dark:divide-slate-700">
                  {filteredStu.map((s) => (
                    <button key={s.id} type="button"
                      onClick={() => { setForm((p) => ({ ...p, studentId: s.id })); setStuSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                      {s.surname}, {s.firstName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Syllabus</label>
            <select value={form.syllabusId} onChange={(e) => setForm((p) => ({ ...p, syllabusId: e.target.value }))} className={inp}>
              {syllabi.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Series</label>
              <select value={form.series} onChange={(e) => setForm((p) => ({ ...p, series: e.target.value }))} className={inp}>
                {SERIES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inp}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inp} placeholder="Optional" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      </div>
    </div>
  );
}
