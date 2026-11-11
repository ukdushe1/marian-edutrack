/**
 * Cover & relief — Phase 3.
 * Log absent teacher, see free colleagues, assign cover, attach lesson note.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  col, addDoc, updateDoc, onSnapshot,
  query, orderBy, getDocs, now, usersCol,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { UserX, Plus, X, CheckCircle2, User, FileText, Pencil } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { TEACHING_ROLES } from '../../lib/roles';
import { format, parseISO } from 'date-fns';

const coverCol = () => col('coverRequests');

export default function CoverReliefPage() {
  const { firebaseUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(query(coverCol(), orderBy('date', 'desc')), (s) =>
      setRequests(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    getDocs(usersCol()).then((s) => setStaff(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  function staffName(id) { return staff.find((s) => s.id === id)?.name ?? id; }

  const statusBadge = {
    open:    'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    covered: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    cancelled: 'bg-slate-100 dark:bg-slate-700 text-slate-500',
  };

  async function markCovered(r) {
    await updateDoc(doc(db, 'coverRequests', r.id), { status: 'covered', updatedAt: now() });
    toast.success('Marked as covered.');
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><UserX size={20}/> Cover & relief</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {requests.filter((r) => r.status === 'open').length} open requests
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15}/> Log absence
        </button>
      </div>

      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className={clsx('bg-white dark:bg-slate-800 rounded-xl border p-4',
            r.status === 'open' ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <User size={13} className="text-slate-400"/>
                    {staffName(r.absentTeacherId)}
                  </span>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', statusBadge[r.status ?? 'open'])}>
                    {r.status ?? 'open'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                  <p>{format(parseISO(r.date), 'EEE d MMM yyyy')} · Period {r.period} · {r.className}</p>
                  {r.coverTeacherId && <p className="flex items-center gap-1"><CheckCircle2 size={11} className="text-green-500"/>Cover: {staffName(r.coverTeacherId)}</p>}
                  {r.lessonNote && <p className="flex items-center gap-1"><FileText size={11}/>Note: {r.lessonNote}</p>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {r.status === 'open' && (
                  <button onClick={() => markCovered(r)}
                    className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-1 rounded-lg font-medium hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors">
                    Mark covered
                  </button>
                )}
                <button onClick={() => { setEditing(r); setShowForm(true); }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"><Pencil size={13}/></button>
              </div>
            </div>
          </div>
        ))}
        {!requests.length && (
          <div className="text-center py-14 text-slate-400 text-sm">
            <UserX size={28} className="mx-auto mb-2 opacity-30"/>
            No cover requests logged.
          </div>
        )}
      </div>

      {showForm && <CoverForm request={editing} staff={staff} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CoverForm({ request, staff, onClose }) {
  const editing = !!request;
  const teachers = staff.filter((u) => (u.roles ?? []).some((r) => TEACHING_ROLES.includes(r)));
  const [form, setForm] = useState({
    absentTeacherId: request?.absentTeacherId ?? '',
    coverTeacherId:  request?.coverTeacherId  ?? '',
    date:            request?.date            ?? new Date().toISOString().slice(0, 10),
    period:          request?.period          ?? 1,
    className:       request?.className       ?? '',
    lessonNote:      request?.lessonNote      ?? '',
    status:          request?.status          ?? 'open',
  });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, period: Number(form.period), updatedAt: now() };
      if (editing) {
        await updateDoc(doc(db, 'coverRequests', request.id), payload);
      } else {
        await addDoc(coverCol(), { ...payload, createdAt: now() });
      }
      toast.success(editing ? 'Request updated.' : 'Absence logged.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit request' : 'Log absence'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Absent teacher</label>
            <select required value={form.absentTeacherId} onChange={(e) => setForm((p) => ({ ...p, absentTeacherId: e.target.value }))} className={inp}>
              <option value="">Select…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cover teacher (optional)</label>
            <select value={form.coverTeacherId} onChange={(e) => setForm((p) => ({ ...p, coverTeacherId: e.target.value }))} className={inp}>
              <option value="">Not yet assigned</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Period</label>
              <input type="number" min={1} max={9} value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <input value={form.className} onChange={(e) => setForm((p) => ({ ...p, className: e.target.value }))} className={inp} placeholder="e.g. L6A CS" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lesson note for cover teacher</label>
            <textarea value={form.lessonNote} onChange={(e) => setForm((p) => ({ ...p, lessonNote: e.target.value }))}
              className={clsx(inp, 'resize-none')} rows={3} placeholder="What should the cover teacher do?" />
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
