/**
 * Add one student to a class (Principal / System Admin): creates the student and
 * puts them in the class's subject groups (all ticked; untick any they don't take).
 * The record is numbered after the class's last student, so it matches adding a row
 * at the end of that class in the school setup spreadsheet.
 */
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, writeBatch, doc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { nextStudentId, titleCase } from '../../lib/schoolSetup/schoolSetup';

const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

export default function AddStudentCard() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('superAdmin');
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [groups, setGroups] = useState([]);
  const [inClass, setInClass] = useState([]);
  const [picked, setPicked] = useState([]);
  const [f, setF] = useState({ surname: '', firstName: '', gender: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getDocs(collection(db, 'classes')).then((s) => setClasses(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.form ?? 99) - (b.form ?? 99) || (a.name ?? '').localeCompare(b.name ?? ''))));
  }, [isAdmin]);

  useEffect(() => {
    if (!classId) { setGroups([]); setInClass([]); return; }
    Promise.all([
      getDocs(query(collection(db, 'teachingGroups'), where('classId', '==', classId))),
      getDocs(query(collection(db, 'students'), where('classId', '==', classId))),
    ]).then(([g, s]) => {
      const list = g.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      setGroups(list);
      setPicked(list.map((x) => x.id));
      setInClass(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [classId]);

  if (!isAdmin) return null;
  const cls = classes.find((c) => c.id === classId);
  const subjectOf = (g) => (cls && g.name?.startsWith(`${cls.name} `) ? g.name.slice(cls.name.length + 1) : g.name);

  async function add(e) {
    e.preventDefault();
    const surname = titleCase(f.surname), firstName = titleCase(f.firstName);
    if (!cls || !surname || !firstName || !f.gender) { toast.error('Choose the class and enter the surname, first name and gender.'); return; }
    const same = inClass.find((s) => `${s.surname} ${s.firstName}`.toLowerCase() === `${surname} ${firstName}`.toLowerCase());
    if (same && !confirm(`${surname} ${firstName} is already in ${cls.name}. Add another student with the same name?`)) return;
    setBusy(true);
    try {
      const id = nextStudentId(cls.name, inClass.map((s) => s.id));
      const batch = writeBatch(db);
      batch.set(doc(db, 'students', id), {
        surname, firstName, preferredName: '', gender: f.gender, classId, status: 'active', source: 'addStudent', createdAt: serverTimestamp(),
      });
      picked.forEach((gid) => batch.update(doc(db, 'teachingGroups', gid), { studentIds: arrayUnion(id) }));
      await batch.commit();
      toast.success(`${firstName} ${surname} added to ${cls.name} (${picked.length} subject${picked.length === 1 ? '' : 's'}).`);
      setInClass((l) => [...l, { id, surname, firstName }]);
      setF({ surname: '', firstName: '', gender: '' });
    } catch (err) { toast.error(`Not added: ${err.code ?? err.message}`); }
    setBusy(false);
  }

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div>
        <h2 className="font-semibold flex items-center gap-2"><UserPlus size={16} /> Add a student</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Adds one learner to a class and its subjects. If you later re-import the school setup spreadsheet, add them there too, as a row at the end of their class.</p>
      </div>
      <form onSubmit={add} className="space-y-3">
        <div className="grid sm:grid-cols-4 gap-2">
          <select aria-label="Class" className={inp} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input aria-label="Surname" className={inp} placeholder="Surname" value={f.surname} onChange={(e) => setF({ ...f, surname: e.target.value })} />
          <input aria-label="First name" className={inp} placeholder="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          <select aria-label="Gender" className={inp} value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
            <option value="">Gender…</option><option value="F">Girl</option><option value="M">Boy</option>
          </select>
        </div>
        {classId && (
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Subjects ({picked.length} of {groups.length}) — untick any the student doesn’t take</p>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((g) => (
                <label key={g.id} className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer select-none ${picked.includes(g.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                  <input type="checkbox" className="sr-only" checked={picked.includes(g.id)}
                    onChange={() => setPicked((p) => (p.includes(g.id) ? p.filter((x) => x !== g.id) : [...p, g.id]))} />
                  {subjectOf(g)}
                </label>
              ))}
              {!groups.length && <span className="text-xs text-slate-400">This class has no subject groups yet.</span>}
            </div>
          </div>
        )}
        <button disabled={busy} className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Add student
        </button>
      </form>
    </section>
  );
}
