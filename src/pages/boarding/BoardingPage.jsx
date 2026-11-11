/**
 * Boarding — Phase 4.
 * Exeat passes, house roll call, sick bay log.
 * Only shown if school has boarders (feature flag: Firestore 'config/boarding' exists).
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  col, addDoc, updateDoc, onSnapshot, query, orderBy, now, getDocs, studentsCol,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { Home, Plus, X, BedDouble, LogOut, Stethoscope } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import NotifyGuardianButton from '../../components/NotifyGuardianButton';

const exeatsCol   = () => col('exeats');
const rollCallCol = () => col('houseRollCall');
const sickBayCol  = () => col('sickBay');

export default function BoardingPage() {
  const [tab, setTab] = useState('exeat');

  const tabs = [
    { id: 'exeat',    label: 'Exeats',     icon: LogOut },
    { id: 'rollcall', label: 'Roll call',   icon: Home },
    { id: 'sickbay',  label: 'Sick bay',   icon: Stethoscope },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><BedDouble size={20}/> Boarding</h1>

      <div className="flex gap-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700')}>
            <t.icon size={13}/>{t.label}
          </button>
        ))}
      </div>

      {tab === 'exeat'    && <ExeatPanel />}
      {tab === 'rollcall' && <RollCallPanel />}
      {tab === 'sickbay'  && <SickBayPanel />}
    </div>
  );
}

/* ── Exeats ── */
function ExeatPanel() {
  const [exeats,   setExeats]   = useState([]);
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(exeatsCol(), orderBy('departure', 'desc')), (s) =>
      setExeats(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    getDocs(studentsCol()).then((s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function markReturned(id) {
    await updateDoc(doc(db, 'exeats', id), { returned: true, returnedAt: now() });
    toast.success('Marked as returned.');
  }

  function student(id) { return students.find((s) => s.id === id); }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{exeats.filter((e) => !e.returned).length} out on exeat</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15}/> New exeat
        </button>
      </div>
      <div className="space-y-2">
        {exeats.map((e) => {
          const stu = student(e.studentId);
          return (
            <div key={e.id} className={clsx('bg-white dark:bg-slate-800 rounded-xl border p-4',
              e.returned ? 'border-slate-200 dark:border-slate-700 opacity-60' : 'border-brand-200 dark:border-brand-800')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{stu?.surname ?? '—'}, {stu?.firstName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Departs: {format(parseISO(e.departure), 'EEE d MMM, HH:mm')} ·
                    Returns: {format(parseISO(e.returnDate), 'EEE d MMM')}
                  </p>
                  {e.destination && <p className="text-xs text-slate-400">To: {e.destination}</p>}
                </div>
                {!e.returned && (
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                    {stu && <NotifyGuardianButton student={stu} messageType="exeat-return" label="Remind guardian" compact />}
                    <button onClick={() => markReturned(e.id)}
                      className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-200 transition-colors">
                      Returned
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {!exeats.length && <div className="text-center py-10 text-slate-400 text-sm">No exeats logged.</div>}
      </div>
      {showForm && <ExeatForm students={students} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function ExeatForm({ students, onClose }) {
  const [form, setForm] = useState({
    studentId:   '',
    departure:   new Date().toISOString().slice(0, 16),
    returnDate:  new Date().toISOString().slice(0, 10),
    destination: '',
    guardian:    '',
  });
  const [stuSearch, setStuSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const sel = students.find((s) => s.id === form.studentId);
  const filt = students.filter((s) => `${s.surname} ${s.firstName}`.toLowerCase().includes(stuSearch.toLowerCase())).slice(0, 10);

  async function submit(e) {
    e.preventDefault();
    if (!form.studentId) { toast.error('Select a student.'); return; }
    setBusy(true);
    try {
      await addDoc(exeatsCol(), { ...form, returned: false, createdAt: now() });
      toast.success('Exeat logged.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New exeat pass</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
            {sel ? (
              <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-1.5 text-sm">
                <span>{sel.surname}, {sel.firstName}</span>
                <button type="button" onClick={() => setForm((p) => ({ ...p, studentId: '' }))}><X size={12}/></button>
              </div>
            ) : (
              <>
                <input value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder="Search…" className={inp} />
                <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg mt-1">
                  {filt.map((s) => (
                    <button key={s.id} type="button" onClick={() => { setForm((p) => ({ ...p, studentId: s.id })); setStuSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                      {s.surname}, {s.firstName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Departure</label>
              <input type="datetime-local" value={form.departure} onChange={(e) => setForm((p) => ({ ...p, departure: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Return date</label>
              <input type="date" value={form.returnDate} onChange={(e) => setForm((p) => ({ ...p, returnDate: e.target.value }))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Destination</label>
            <input value={form.destination} onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))} className={inp} placeholder="e.g. Home – Harare" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Guardian collecting</label>
            <input value={form.guardian} onChange={(e) => setForm((p) => ({ ...p, guardian: e.target.value }))} className={inp} placeholder="Name of guardian" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Issue pass'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Roll call ── */
function RollCallPanel() {
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [house,    setHouse]    = useState('All');
  const [records,  setRecords]  = useState([]);
  const [students, setStudents] = useState([]);

  const HOUSES = ['All', 'North', 'South', 'East', 'West'];

  useEffect(() => {
    getDocs(studentsCol()).then((s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsub = onSnapshot(
      query(rollCallCol(), orderBy('date', 'desc')),
      (s) => setRecords(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  async function markPresent(studentId, present) {
    const existing = records.find((r) => r.studentId === studentId && r.date === date);
    if (existing) {
      await updateDoc(doc(db, 'houseRollCall', existing.id), { present, updatedAt: now() });
    } else {
      await addDoc(rollCallCol(), { studentId, date, present, house, createdAt: now() });
    }
  }

  const boarders = students.filter((s) => s.isBoarding);
  const filtered = house === 'All' ? boarders : boarders.filter((s) => s.house === house);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900"/>
        <select value={house} onChange={(e) => setHouse(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900">
          {HOUSES.map((h) => <option key={h}>{h}</option>)}
        </select>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {filtered.map((s) => {
          const rec = records.find((r) => r.studentId === s.id && r.date === date);
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">{s.surname}, {s.firstName}</span>
              <div className="flex gap-2">
                {(['P','A']).map((status) => (
                  <button key={status} onClick={() => markPresent(s.id, status === 'P')}
                    className={clsx('w-8 h-8 rounded-full text-xs font-bold transition-colors',
                      (status === 'P' && rec?.present === true)  ? 'bg-green-500 text-white' :
                      (status === 'A' && rec?.present === false) ? 'bg-red-500 text-white' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-500')}>
                    {status}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {!filtered.length && (
          <p className="px-4 py-10 text-center text-slate-400 text-sm">No boarders listed. Set isBoarding: true on student records.</p>
        )}
      </div>
    </div>
  );
}

/* ── Sick bay ── */
function SickBayPanel() {
  const [entries,  setEntries]  = useState([]);
  const [students, setStudents] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(sickBayCol(), orderBy('admittedAt', 'desc')), (s) =>
      setEntries(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    getDocs(studentsCol()).then((s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  async function discharge(id) {
    await updateDoc(doc(db, 'sickBay', id), { dischargedAt: now(), discharged: true });
    toast.success('Student discharged.');
  }

  function student(id) { return students.find((s) => s.id === id); }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{entries.filter((e) => !e.discharged).length} currently in sick bay</p>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15}/> Admit student
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((e) => {
          const stu = student(e.studentId);
          return (
            <div key={e.id} className={clsx('bg-white dark:bg-slate-800 rounded-xl border p-4',
              e.discharged ? 'border-slate-200 dark:border-slate-700 opacity-60' : 'border-red-200 dark:border-red-800')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{stu?.surname ?? '—'}, {stu?.firstName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{e.complaint}</p>
                  <p className="text-xs text-slate-400">Admitted: {format(e.admittedAt?.toDate?.() ?? new Date(), 'EEE d MMM, HH:mm')}</p>
                </div>
                {!e.discharged && (
                  <button onClick={() => discharge(e.id)}
                    className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-200 transition-colors">
                    Discharge
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!entries.length && <div className="text-center py-10 text-slate-400 text-sm">Sick bay is empty.</div>}
      </div>
      {showForm && <SickBayForm students={students} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function SickBayForm({ students, onClose }) {
  const [stuSearch, setStuSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [busy, setBusy] = useState(false);
  const sel  = students.find((s) => s.id === studentId);
  const filt = students.filter((s) => `${s.surname} ${s.firstName}`.toLowerCase().includes(stuSearch.toLowerCase())).slice(0, 10);
  const inp  = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  async function submit(e) {
    e.preventDefault();
    if (!studentId || !complaint.trim()) { toast.error('Fill all fields.'); return; }
    setBusy(true);
    try {
      await addDoc(sickBayCol(), { studentId, complaint, admittedAt: now(), discharged: false });
      toast.success('Student admitted.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Admit to sick bay</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student</label>
            {sel ? (
              <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-1.5 text-sm">
                <span>{sel.surname}, {sel.firstName}</span>
                <button type="button" onClick={() => setStudentId('')}><X size={12}/></button>
              </div>
            ) : (
              <>
                <input value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder="Search…" className={inp}/>
                <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg mt-1">
                  {filt.map((s) => (
                    <button key={s.id} type="button" onClick={() => { setStudentId(s.id); setStuSearch(''); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                      {s.surname}, {s.firstName}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Complaint / symptoms</label>
            <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)}
              className={clsx(inp, 'resize-none')} rows={3} placeholder="Describe the student's condition" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Admit'}
          </button>
        </form>
      </div>
    </div>
  );
}
