/**
 * Admin — Classes (stored as teachingGroups).
 * Create groups, assign syllabus, teachers and students.
 */
import { useState, useEffect } from 'react';
import {
  teachingGroupsCol, syllabiCol, studentsCol, usersCol,
  addDoc, updateDoc, onSnapshot, getDocs, now,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { Layers, Plus, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { TEACHING_ROLES } from '../../lib/roles';

export default function GroupsPage() {
  const [groups,   setGroups]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [syllabi,  setSyllabi]  = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    const unsubG = onSnapshot(teachingGroupsCol(), (s) => setGroups(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    getDocs(syllabiCol()).then((s) => setSyllabi(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    getDocs(studentsCol()).then((s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    getDocs(usersCol()).then((s) => setTeachers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => (u.roles ?? []).some((r) => TEACHING_ROLES.includes(r)))));
    return unsubG;
  }, []);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2"><Layers size={20}/> Classes</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15}/> New class
        </button>
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const syllabus = syllabi.find((s) => s.id === g.syllabusId);
          return (
            <div key={g.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                onClick={() => setExpanded(expanded === g.id ? null : g.id)}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{g.syllabusCode ?? syllabus?.code ?? '—'} · {g.name ?? g.id}</p>
                  <p className="text-xs text-slate-400">{g.studentIds?.length ?? 0} students · {g.teacherIds?.length ?? 0} teachers · {g.year}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setEditing(g); setShowForm(true); }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400">
                  <Pencil size={13}/>
                </button>
                {expanded === g.id ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
              </button>
              {expanded === g.id && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4 text-sm space-y-2">
                  <p className="text-xs text-slate-500">Syllabus: {syllabus?.code} — {syllabus?.name}</p>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Teachers</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(g.teacherIds ?? []).map((tid) => {
                        const t = teachers.find((t) => t.id === tid);
                        return <span key={tid} className="text-xs bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">{t?.name ?? tid}</span>;
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!groups.length && <div className="text-center py-12 text-slate-400 text-sm">No classes yet.</div>}
      </div>

      {showForm && <GroupForm group={editing} syllabi={syllabi} students={students} teachers={teachers} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function GroupForm({ group, syllabi, students, teachers, onClose }) {
  const editing = !!group;
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    name:        group?.name        ?? '',
    syllabusId:  group?.syllabusId  ?? syllabi[0]?.id ?? '',
    syllabusCode:group?.syllabusCode?? syllabi[0]?.code ?? '',
    year:        group?.year        ?? currentYear,
    teacherIds:  group?.teacherIds  ?? [],
    studentIds:  group?.studentIds  ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [stuSearch, setStuSearch] = useState('');

  function toggleItem(field, id) {
    setForm((p) => ({
      ...p,
      [field]: p[field].includes(id) ? p[field].filter((x) => x !== id) : [...p[field], id],
    }));
  }

  function handleSyllabus(id) {
    const s = syllabi.find((s) => s.id === id);
    setForm((p) => ({ ...p, syllabusId: id, syllabusCode: s?.code ?? '' }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await updateDoc(doc(db, 'teachingGroups', group.id), { ...form, updatedAt: now() });
      } else {
        await addDoc(teachingGroupsCol(), { ...form, createdAt: now() });
      }
      toast.success(editing ? 'Class updated.' : 'Class created.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const filteredStudents = students.filter((s) => `${s.surname} ${s.firstName}`.toLowerCase().includes(stuSearch.toLowerCase())).slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{editing ? 'Edit class' : 'New class'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Class name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inp} placeholder="e.g. L6A CS" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Syllabus</label>
            <select value={form.syllabusId} onChange={(e) => handleSyllabus(e.target.value)} className={inp}>
              {syllabi.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name ?? s.code}</option>)}
            </select>
          </div>

          {/* Teachers */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Teachers</label>
            <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700">
              {teachers.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input type="checkbox" checked={form.teacherIds.includes(t.id)} onChange={() => toggleItem('teacherIds', t.id)} className="accent-brand-600" />
                  <span className="text-sm">{t.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Students */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Students <span className="text-slate-400">({form.studentIds.length} selected)</span>
            </label>
            <input value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder="Search students…" className={clsx(inp, 'mb-1')} />
            <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700">
              {filteredStudents.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={() => toggleItem('studentIds', s.id)} className="accent-brand-600" />
                  <span className="text-sm">{s.surname}, {s.preferredName ?? s.firstName}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save class'}
          </button>
        </form>
      </div>
    </div>
  );
}
