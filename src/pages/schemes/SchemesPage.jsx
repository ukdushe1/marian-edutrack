/**
 * Schemes of work & homework — Phase 3.
 * Teachers post weekly topic + homework. HOD can view all in dept.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, now, teachingGroupsCol,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, collection } from 'firebase/firestore';
import { Layers, Plus, X, BookOpen, CalendarDays, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

const schemeEntriesCol = (groupId) => collection(db, 'teachingGroups', groupId, 'schemeEntries');

export default function SchemesPage() {
  const { firebaseUser, roles } = useAuth();
  const [groups,   setGroups]   = useState([]);
  const [selGroup, setSelGroup] = useState('');
  const [entries,  setEntries]  = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(teachingGroupsCol(), (s) => {
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const mine = (roles ?? []).includes('hod') ? all :
        all.filter((g) => (g.teacherIds ?? []).includes(firebaseUser?.uid));
      setGroups(mine);
      if (!selGroup && mine.length) setSelGroup(mine[0].id);
    });
    return unsub;
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!selGroup) return;
    const unsub = onSnapshot(
      query(schemeEntriesCol(selGroup), orderBy('weekStart', 'desc')),
      (s) => setEntries(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [selGroup]);

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    await deleteDoc(doc(schemeEntriesCol(selGroup), id));
    toast.success('Entry deleted.');
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2"><Layers size={20}/> Schemes & homework</h1>
        <div className="flex gap-2">
          <select value={selGroup} onChange={(e) => setSelGroup(e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900">
            {groups.map((g) => <option key={g.id} value={g.id}>{g.syllabusCode} · {g.name}</option>)}
          </select>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15}/> Add week
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button onClick={() => setExpanded(expanded === e.id ? null : e.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <CalendarDays size={13} className="text-slate-400"/>
                  Week of {format(parseISO(e.weekStart), 'd MMM yyyy')}
                </p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{e.topic}</p>
              </div>
              <div className="flex gap-1 items-center">
                <button onClick={(ev) => { ev.stopPropagation(); setEditing(e); setShowForm(true); }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"><Pencil size={13}/></button>
                <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-500"><Trash2 size={13}/></button>
                {expanded === e.id ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
              </div>
            </button>
            {expanded === e.id && (
              <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Topic / objectives</p>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{e.topic}</p>
                </div>
                {e.homework && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                      <BookOpen size={11}/> Homework
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{e.homework}</p>
                    {e.homeworkDue && <p className="text-xs text-slate-400 mt-1">Due: {format(parseISO(e.homeworkDue), 'EEE d MMM yyyy')}</p>}
                  </div>
                )}
                {e.resources && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Resources / links</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{e.resources}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!entries.length && selGroup && (
          <div className="text-center py-14 text-slate-400 text-sm">
            <Layers size={28} className="mx-auto mb-2 opacity-30"/>
            No entries yet for this class.
          </div>
        )}
      </div>

      {showForm && selGroup && (
        <SchemeForm entry={editing} groupId={selGroup} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function SchemeForm({ entry, groupId, onClose }) {
  const editing = !!entry;
  const [form, setForm] = useState({
    weekStart:   entry?.weekStart   ?? new Date().toISOString().slice(0, 10),
    topic:       entry?.topic       ?? '',
    homework:    entry?.homework    ?? '',
    homeworkDue: entry?.homeworkDue ?? '',
    resources:   entry?.resources   ?? '',
  });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.topic.trim()) { toast.error('Topic is required.'); return; }
    setBusy(true);
    try {
      const payload = { ...form, updatedAt: now() };
      if (editing) {
        await updateDoc(doc(schemeEntriesCol(groupId), entry.id), payload);
      } else {
        await addDoc(schemeEntriesCol(groupId), { ...payload, createdAt: now() });
      }
      toast.success(editing ? 'Entry updated.' : 'Entry added.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit entry' : 'Add week'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Week starting</label>
            <input type="date" value={form.weekStart} onChange={(e) => setForm((p) => ({ ...p, weekStart: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Topic / objectives</label>
            <textarea required value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
              className={clsx(inp, 'resize-none')} rows={3} placeholder="What will be covered this week?" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Homework task</label>
            <textarea value={form.homework} onChange={(e) => setForm((p) => ({ ...p, homework: e.target.value }))}
              className={clsx(inp, 'resize-none')} rows={2} placeholder="Optional" />
          </div>
          {form.homework && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Homework due date</label>
              <input type="date" value={form.homeworkDue} onChange={(e) => setForm((p) => ({ ...p, homeworkDue: e.target.value }))} className={inp} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Resources / links</label>
            <input value={form.resources} onChange={(e) => setForm((p) => ({ ...p, resources: e.target.value }))} className={inp} placeholder="Optional" />
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
