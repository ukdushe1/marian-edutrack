/**
 * Admin — Syllabi management.
 * Super admin can create/edit syllabi with components, weights, and topics.
 */
import { useState, useEffect } from 'react';
import { syllabiCol, addDoc, updateDoc, onSnapshot, now, ref } from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { BookMarked, Plus, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const LEVELS = ['IGCSE', 'AS Level', 'A Level', 'Lower School'];

export default function SyllabiPage() {
  const [syllabi,  setSyllabi]  = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    return onSnapshot(syllabiCol(), (snap) =>
      setSyllabi(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2"><BookMarked size={20}/> Syllabi</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15}/> New syllabus
        </button>
      </div>

      <div className="space-y-2">
        {syllabi.map((s) => (
          <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{s.code} — {s.name ?? s.code}</p>
                <p className="text-xs text-slate-400">{s.level} · {s.components?.length ?? 0} components · {s.topics?.length ?? 0} topics</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setEditing(s); setShowForm(true); }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400">
                <Pencil size={13}/>
              </button>
              {expanded === s.id ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
            </button>
            {expanded === s.id && (
              <div className="border-t border-slate-100 dark:border-slate-700 p-4 text-sm space-y-3">
                {s.components?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Components</p>
                    <div className="space-y-1">
                      {s.components.map((c, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{c.paper}</span>
                          <span className="text-slate-500">{c.weight}% · max {c.maxMark}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {s.topics?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {s.topics.map((t) => (
                        <span key={t.id} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{t.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!syllabi.length && (
          <div className="text-center py-12 text-slate-400 text-sm">No syllabi yet. Add a Cambridge syllabus to get started.</div>
        )}
      </div>

      {showForm && <SyllabusForm syllabus={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function SyllabusForm({ syllabus, onClose }) {
  const editing = !!syllabus;
  const [form, setForm] = useState({
    code:       syllabus?.code       ?? '',
    name:       syllabus?.name       ?? '',
    level:      syllabus?.level      ?? 'IGCSE',
    components: syllabus?.components ?? [],
    topics:     syllabus?.topics     ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [newComp, setNewComp] = useState({ paper: '', weight: '', maxMark: '' });
  const [newTopic, setNewTopic] = useState('');

  function addComponent() {
    if (!newComp.paper) return;
    setForm((p) => ({ ...p, components: [...p.components, { ...newComp, weight: Number(newComp.weight), maxMark: Number(newComp.maxMark) }] }));
    setNewComp({ paper: '', weight: '', maxMark: '' });
  }

  function addTopic() {
    if (!newTopic.trim()) return;
    const id = newTopic.toLowerCase().replace(/\s+/g, '-');
    setForm((p) => ({ ...p, topics: [...p.topics, { id, name: newTopic.trim() }] }));
    setNewTopic('');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'syllabi', syllabus.id), { ...form, updatedAt: now() });
      } else {
        await addDoc(syllabiCol(), { ...form, createdAt: now() });
      }
      toast.success(editing ? 'Syllabus updated.' : 'Syllabus created.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit syllabus' : 'New syllabus'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Code</label>
              <input required value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} className={inp} placeholder="e.g. 0478" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Level</label>
              <select value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))} className={inp}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject name</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inp} placeholder="e.g. Computer Science" />
          </div>

          {/* Components */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Components</label>
            {form.components.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-700 rounded px-2 py-1 mb-1">
                <span>{c.paper} — {c.weight}% / {c.maxMark} marks</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, components: p.components.filter((_, j) => j !== i) }))}>
                  <X size={12}/>
                </button>
              </div>
            ))}
            <div className="flex gap-1 mt-1">
              <input value={newComp.paper} onChange={(e) => setNewComp((p) => ({ ...p, paper: e.target.value }))} placeholder="Paper name" className={clsx(inp, 'flex-1')} />
              <input type="number" value={newComp.weight} onChange={(e) => setNewComp((p) => ({ ...p, weight: e.target.value }))} placeholder="Wt%" className={clsx(inp, 'w-14')} />
              <input type="number" value={newComp.maxMark} onChange={(e) => setNewComp((p) => ({ ...p, maxMark: e.target.value }))} placeholder="Max" className={clsx(inp, 'w-14')} />
              <button type="button" onClick={addComponent} className="px-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">+</button>
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Topics</label>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {form.topics.map((t, i) => (
                <span key={t.id} className="flex items-center gap-1 text-xs bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">
                  {t.name}
                  <button type="button" onClick={() => setForm((p) => ({ ...p, topics: p.topics.filter((_, j) => j !== i) }))}><X size={10}/></button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                placeholder="Topic name, then Enter" className={clsx(inp, 'flex-1')} />
              <button type="button" onClick={addTopic} className="px-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">+</button>
            </div>
          </div>

          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save syllabus'}
          </button>
        </form>
      </div>
    </div>
  );
}
