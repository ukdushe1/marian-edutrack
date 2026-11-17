/**
 * Exam timetable — Phase 3.
 * Exams officer creates sessions; clash detection runs in-browser.
 * Each session: syllabusId, paper, date, start, duration, venue, seats, invigilatorIds[].
 * Imported school timetables also carry form, subject, slot and invigilatorNames[]
 * (staff named on the printed sheet, who may not have accounts yet).
 */
import { useState, useEffect } from 'react';
import {
  col, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, getDocs, now, syllabiCol, usersCol,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import {
  Calendar, Plus, X, AlertTriangle, Clock, MapPin, Users, Pencil, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { TEACHING_ROLES } from '../../lib/roles';
import { format, parseISO, addMinutes } from 'date-fns';

const sessionsCol  = () => col('examSessions');

/** "0478 Paper 1", or for an imported session "F5 History P1". */
function sessionTitle(s, syl) {
  if (syl) return `${syl.code} ${s.paper ?? ''}`.trim();
  return [s.form, s.subject, s.paper].filter(Boolean).join(' ') || '—';
}

export default function ExamTimetablePage() {
  const [sessions,  setSessions]  = useState([]);
  const [syllabi,   setSyllabi]   = useState([]);
  const [staff,     setStaff]     = useState([]);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [view,      setView]      = useState('list'); // 'list' | 'calendar'

  useEffect(() => {
    const unsub = onSnapshot(query(sessionsCol(), orderBy('date', 'asc')), (s) =>
      setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => `${a.date}${a.start}${a.form ?? ''}`.localeCompare(`${b.date}${b.start}${b.form ?? ''}`)))
    );
    getDocs(syllabiCol()).then((s) => setSyllabi(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    getDocs(usersCol()).then((s) => setStaff(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  // Clash detection: two sessions clash if same venue + overlapping time
  // (sessions with no room yet can't clash on room)
  function getClashes() {
    const clashes = new Set();
    sessions.forEach((a, i) => {
      sessions.slice(i + 1).forEach((b) => {
        if (!a.venue || a.venue !== b.venue || a.date !== b.date) return;
        const aStart = new Date(`${a.date}T${a.start}`);
        const aEnd   = addMinutes(aStart, a.duration ?? 60);
        const bStart = new Date(`${b.date}T${b.start}`);
        const bEnd   = addMinutes(bStart, b.duration ?? 60);
        if (aStart < bEnd && bStart < aEnd) { clashes.add(a.id); clashes.add(b.id); }
      });
    });
    return clashes;
  }
  const clashes = getClashes();

  // Group sessions by date for calendar view
  const byDate = {};
  sessions.forEach((s) => { (byDate[s.date] = byDate[s.date] ?? []).push(s); });

  async function deleteSession(id) {
    if (!confirm('Delete this exam session?')) return;
    await deleteDoc(doc(db, 'examSessions', id));
    toast.success('Session deleted.');
  }

  const syllabus = (id) => syllabi.find((s) => s.id === id);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Calendar size={20}/> Exam timetable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{sessions.length} sessions scheduled</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            {['list', 'calendar'].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  view === v ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15}/> Add session
          </button>
        </div>
      </div>

      {clashes.size > 0 && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0"/>
          <span><strong>{clashes.size / 2} venue clash{clashes.size > 2 ? 'es' : ''}</strong> detected — highlighted below.</span>
        </div>
      )}

      {view === 'list' ? (
        <div className="space-y-2">
          {sessions.map((s) => {
            const syl   = syllabus(s.syllabusId);
            const clash = clashes.has(s.id);
            const start = `${s.date}T${s.start}`;
            const end   = s.duration ? format(addMinutes(new Date(start), s.duration), 'HH:mm') : null;
            const invigs = [
              ...(s.invigilatorIds ?? []).map((id) => staff.find((u) => u.id === id)?.name ?? id),
              ...(s.invigilatorNames ?? []),
            ];
            return (
              <div key={s.id} className={clsx('bg-white dark:bg-slate-800 rounded-xl border p-4',
                clash ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-700')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{sessionTitle(s, syl)}</span>
                      {s.slot && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">{s.slot}</span>}
                      {clash && <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10}/>Clash</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><Calendar size={11}/>{format(parseISO(s.date), 'EEE d MMM yyyy')}</span>
                      <span className="flex items-center gap-1"><Clock size={11}/>{end ? `${s.start} — ${end} (${s.duration}min)` : `${s.start} · duration TBC`}</span>
                      <span className="flex items-center gap-1"><MapPin size={11}/>{s.venue || 'Room not set'}</span>
                      {s.seats ? <span className="flex items-center gap-1"><Users size={11}/>{s.seats} seats</span> : null}
                    </div>
                    {invigs.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">Invigilators: {invigs.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditing(s); setShowForm(true); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"><Pencil size={13}/></button>
                    <button onClick={() => deleteSession(s.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-500"><Trash2 size={13}/></button>
                  </div>
                </div>
              </div>
            );
          })}
          {!sessions.length && (
            <div className="text-center py-14 text-slate-400 text-sm">
              <Calendar size={28} className="mx-auto mb-2 opacity-30"/>
              No exam sessions yet.
            </div>
          )}
        </div>
      ) : (
        /* Calendar view */
        <div className="space-y-4">
          {Object.entries(byDate).sort().map(([date, daySessions]) => (
            <div key={date}>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1 sticky top-0">
                {format(parseISO(date), 'EEEE, d MMMM yyyy')}
              </p>
              <div className="space-y-1 ml-3 border-l-2 border-slate-200 dark:border-slate-700 pl-3">
                {daySessions.map((s) => {
                  const syl = syllabus(s.syllabusId);
                  return (
                    <div key={s.id} className={clsx('text-sm bg-white dark:bg-slate-800 border rounded-lg px-3 py-2',
                      clashes.has(s.id) ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-700')}>
                      <span className="font-medium">{s.start}</span> · {sessionTitle(s, syl)}{s.venue ? ` · ${s.venue}` : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <SessionForm session={editing} syllabi={syllabi} staff={staff} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function SessionForm({ session, syllabi, staff, onClose }) {
  const editing = !!session;
  const [form, setForm] = useState({
    syllabusId:     session ? (session.syllabusId ?? '') : (syllabi[0]?.id ?? ''),
    form:           session?.form           ?? '',
    subject:        session?.subject        ?? '',
    paper:          session?.paper          ?? 'Paper 1',
    date:           session?.date           ?? new Date().toISOString().slice(0, 10),
    start:          session?.start          ?? '09:00',
    duration:       session ? (session.duration ?? '') : 180,
    venue:          session?.venue          ?? '',
    seats:          session ? (session.seats ?? '') : 30,
    invigilatorIds: session?.invigilatorIds ?? [],
  });
  const [busy, setBusy] = useState(false);

  function toggleInvig(id) {
    setForm((p) => ({
      ...p,
      invigilatorIds: p.invigilatorIds.includes(id)
        ? p.invigilatorIds.filter((x) => x !== id)
        : [...p.invigilatorIds, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const num = (v) => (v === '' || v == null ? null : Number(v));
      const payload = { ...form, duration: num(form.duration), seats: num(form.seats), updatedAt: now() };
      if (editing) {
        await updateDoc(doc(db, 'examSessions', session.id), payload);
      } else {
        await addDoc(sessionsCol(), { ...payload, createdAt: now() });
      }
      toast.success(editing ? 'Session updated.' : 'Session added.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const invigList = staff.filter((u) => (u.roles ?? []).some((r) => [...TEACHING_ROLES, 'examsOfficer'].includes(r)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit session' : 'Add exam session'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Syllabus</label>
            <select value={form.syllabusId} onChange={(e) => setForm((p) => ({ ...p, syllabusId: e.target.value }))} className={inp}>
              <option value="">— None (use form and subject below) —</option>
              {syllabi.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name ?? s.code}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Form</label>
              <input value={form.form} onChange={(e) => setForm((p) => ({ ...p, form: e.target.value }))} className={inp} placeholder="e.g. F3" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
              <input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} className={inp} placeholder="e.g. Geography" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Paper</label>
              <input value={form.paper} onChange={(e) => setForm((p) => ({ ...p, paper: e.target.value }))} className={inp} placeholder="Paper 1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Venue</label>
              <input value={form.venue} onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))} className={inp} placeholder="Hall A" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Start time</label>
              <input type="time" value={form.start} onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Duration (min)</label>
              <input type="number" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Seats</label>
              <input type="number" value={form.seats} onChange={(e) => setForm((p) => ({ ...p, seats: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Invigilators</label>
            <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700">
              {invigList.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input type="checkbox" checked={form.invigilatorIds.includes(u.id)} onChange={() => toggleInvig(u.id)} className="accent-brand-600"/>
                  <span className="text-sm">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save session'}
          </button>
        </form>
      </div>
    </div>
  );
}
