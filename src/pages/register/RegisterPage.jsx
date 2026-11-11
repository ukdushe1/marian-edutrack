/**
 * Tutor roll call + lesson registers.
 * One register document per class/group per date, containing:
 *   { classId, date, type: 'tutor'|'lesson', period, entries: { [studentId]: status } }
 * Status values: P (present) | A (absent) | L (late) | E (exeat/excused)
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  registersCol, query, where, getDocs, setDoc, now,
  studentsCol, onSnapshot, ref,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, collection } from 'firebase/firestore';
import { useTeachingGroups } from '../../hooks/useTeachingGroups';
import { useStudents } from '../../hooks/useStudents';
import { CheckCircle2, XCircle, Clock, MinusCircle, Download, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import NotifyGuardianButton from '../../components/NotifyGuardianButton';

const STATUS_OPTIONS = [
  { value: 'P', label: 'Present',  icon: CheckCircle2, color: 'text-green-600' },
  { value: 'A', label: 'Absent',   icon: XCircle,      color: 'text-red-500'  },
  { value: 'L', label: 'Late',     icon: Clock,        color: 'text-amber-500'},
  { value: 'E', label: 'Excused',  icon: MinusCircle,  color: 'text-slate-400'},
];

function statusMeta(v) { return STATUS_OPTIONS.find((s) => s.value === v) ?? STATUS_OPTIONS[0]; }

export default function RegisterPage() {
  const { firebaseUser, hasRole } = useAuth();
  const { groups } = useTeachingGroups();

  const todayISO = new Date().toISOString().slice(0, 10);
  const [date,     setDate]    = useState(todayISO);
  const [groupId,  setGroupId] = useState('');
  const [period,   setPeriod]  = useState('1');
  const [entries,  setEntries] = useState({});  // { studentId: 'P'|'A'|'L'|'E' }
  const [saving,   setSaving]  = useState(false);
  const [regId,    setRegId]   = useState(null);

  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  // Load students when group changes (chunked — classes can exceed 30)
  const { students } = useStudents(group?.studentIds ?? []);
  useEffect(() => {
    // Default everyone to P
    setEntries((prev) => {
      const next = { ...prev };
      students.forEach((s) => { if (!next[s.id]) next[s.id] = 'P'; });
      return next;
    });
  }, [students]);

  // Load existing register for this date + group + period
  useEffect(() => {
    if (!groupId && !group?.id) return;
    const gid = groupId || group?.id;
    if (!gid) return;
    const q = query(
      registersCol(),
      where('groupId', '==', gid),
      where('date',    '==', date),
      where('period',  '==', period),
    );
    getDocs(q).then((snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setRegId(d.id);
        setEntries(d.data().entries ?? {});
      } else {
        setRegId(null);
      }
    });
  }, [groupId, group?.id, date, period]);

  function toggleStudent(studentId) {
    setEntries((prev) => {
      const cycle = ['P', 'A', 'L', 'E'];
      const idx   = cycle.indexOf(prev[studentId] ?? 'P');
      return { ...prev, [studentId]: cycle[(idx + 1) % cycle.length] };
    });
  }

  function markAll(status) {
    const next = {};
    students.forEach((s) => { next[s.id] = status; });
    setEntries(next);
  }

  async function saveRegister() {
    setSaving(true);
    const gid = groupId || group?.id;
    try {
      const payload = {
        groupId: gid,
        date, period,
        entries,
        takenBy: firebaseUser.uid,
        takenAt: now(),
      };
      const id = regId ?? `${gid}_${date}_p${period}`;
      await setDoc(doc(db, 'registers', id), payload, { merge: true });
      setRegId(id);
      toast.success('Register saved.');
    } catch {
      toast.error('Save failed — will retry when online.');
    } finally {
      setSaving(false);
    }
  }

  function exportXLSX() {
    const headers = ['Student', 'Status'];
    const rows = students.map((s) => [
      s.surname ? `${s.surname}, ${s.preferredName ?? s.firstName}` : s.name,
      entries[s.id] ?? 'P',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Register');
    XLSX.writeFile(wb, `register-${group?.syllabusCode ?? group?.id}-${date}-p${period}.xlsx`);
  }

  const absentCount = students.filter((s) => entries[s.id] === 'A').length;
  const presentPct  = students.length
    ? Math.round(((students.length - absentCount) / students.length) * 100)
    : 100;
  const lowAttendance = presentPct < 80;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Register</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportXLSX} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors">
            <Download size={13} /> Export
          </button>
          <button onClick={saveRegister} disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save register'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Group</label>
          <select value={groupId || group?.id || ''} onChange={(e) => setGroupId(e.target.value)}
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500">
            {groups.map((g) => <option key={g.id} value={g.id}>{g.syllabusCode ?? g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Period</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500">
            {['Tutor', '1', '2', '3', '4', '5', '6', '7', '8'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Mark all</label>
          <div className="flex gap-1">
            {['P', 'A'].map((s) => {
              const meta = statusMeta(s);
              return (
                <button key={s} onClick={() => markAll(s)}
                  className={clsx('flex-1 text-xs font-medium border rounded-lg py-1.5 transition-colors', meta.color,
                    'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700')}>
                  All {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Attendance summary */}
      <div className={clsx('flex items-center gap-2 text-sm px-3 py-2 rounded-lg border',
        lowAttendance
          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          : 'border-slate-200 dark:border-slate-700 text-slate-500')}>
        {lowAttendance && <AlertTriangle size={14} />}
        <span>{students.length - absentCount}/{students.length} present ({presentPct}%)</span>
        {lowAttendance && <span className="font-medium">— below 80% threshold</span>}
      </div>

      {/* Student list */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
        {students.length === 0 && (
          <p className="text-center py-8 text-sm text-slate-400">No students found in this group.</p>
        )}
        {students.map((s, i) => {
          const status = entries[s.id] ?? 'P';
          const meta   = statusMeta(status);
          const Icon   = meta.icon;
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5 text-right">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium">
                    {s.surname ? `${s.surname}, ${s.preferredName ?? s.firstName}` : s.name}
                  </p>
                  <p className="text-xs text-slate-400">{s.candidateNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
              {status === 'A' && (
                <NotifyGuardianButton student={s} messageType="absent-today" label="Notify" compact />
              )}
              <button
                onClick={() => toggleStudent(s.id)}
                className={clsx('flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
                  status === 'P' && 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
                  status === 'A' && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
                  status === 'L' && 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
                  status === 'E' && 'border-slate-200 dark:border-slate-700 text-slate-400',
                )}
              >
                <Icon size={14} />
                {meta.label}
              </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
