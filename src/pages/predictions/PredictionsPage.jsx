/**
 * Predictions & mock grades — Phase 2.
 * Per student, per assessment: target grade, predicted grade, mock grade.
 * At-risk flag when predicted < target by 2+ grade points.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  teachingGroupsCol, assessmentsCol, studentsCol,
  onSnapshot, getDocs, query, orderBy, now,
  col,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, setDoc, collection, getDoc } from 'firebase/firestore';
import { Target, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const GRADES = ['A*','A','B','C','D','E','U','—'];
const gradeIndex = (g) => GRADES.indexOf(g);
const isAtRisk = (pred, target) => {
  const pi = gradeIndex(pred), ti = gradeIndex(target);
  return pi !== -1 && ti !== -1 && pred !== '—' && target !== '—' && pi - ti >= 2;
};

function predictionsRef(groupId) {
  return doc(db, 'predictions', groupId);
}

export default function PredictionsPage() {
  const { firebaseUser } = useAuth();
  const [groups,   setGroups]   = useState([]);
  const [selGroup, setSelGroup] = useState('');
  const [students, setStudents] = useState([]);
  const [preds,    setPreds]    = useState({});
  const [dirty,    setDirty]    = useState({});
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(teachingGroupsCol(), (s) => {
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      const mine = all.filter((g) => (g.teacherIds ?? []).includes(firebaseUser?.uid));
      setGroups(mine);
      if (!selGroup && mine.length) setSelGroup(mine[0].id);
    });
    return unsub;
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!selGroup) return;
    const group = groups.find((g) => g.id === selGroup);
    const ids = group?.studentIds ?? [];
    if (!ids.length) { setStudents([]); setPreds({}); return; }

    // Load students
    getDocs(studentsCol()).then((snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStudents(all.filter((s) => ids.includes(s.id)));
    });

    // Load predictions doc
    getDoc(predictionsRef(selGroup)).then((d) => {
      setPreds(d.exists() ? (d.data().entries ?? {}) : {});
      setDirty({});
    });
  }, [selGroup, groups]);

  function update(studentId, field, value) {
    setPreds((p) => ({ ...p, [studentId]: { ...(p[studentId] ?? {}), [field]: value } }));
    setDirty((p) => ({ ...p, [studentId]: true }));
  }

  async function save() {
    setSaving(true);
    try {
      await setDoc(predictionsRef(selGroup), { entries: preds, updatedAt: now() }, { merge: true });
      setDirty({});
      toast.success('Predictions saved.');
    } catch { toast.error('Save failed.'); }
    setSaving(false);
  }

  const dirtyCount = Object.keys(dirty).length;
  const atRiskCount = students.filter((s) => isAtRisk(preds[s.id]?.predicted, preds[s.id]?.target)).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Target size={20}/> Predictions</h1>
          {atRiskCount > 0 && (
            <p className="text-sm text-red-500 flex items-center gap-1 mt-0.5">
              <AlertTriangle size={13}/> {atRiskCount} student{atRiskCount > 1 ? 's' : ''} at risk
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <select value={selGroup} onChange={(e) => setSelGroup(e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900">
            {groups.map((g) => <option key={g.id} value={g.id}>{g.syllabusCode} · {g.name}</option>)}
          </select>
          <button onClick={save} disabled={!dirtyCount || saving}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            {saving ? 'Saving…' : `Save${dirtyCount ? ` (${dirtyCount})` : ''}`}
          </button>
        </div>
      </div>

      {atRiskCount > 0 && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          <TrendingDown size={15} className="mt-0.5 shrink-0"/>
          <span>Students are at risk when predicted grade is 2+ grades below target.</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 text-left sticky left-0 bg-slate-50 dark:bg-slate-700/50">Student</th>
                <th className="px-3 py-2.5 text-center">Target</th>
                <th className="px-3 py-2.5 text-center">Predicted</th>
                <th className="px-3 py-2.5 text-center">Mock</th>
                <th className="px-3 py-2.5 text-left">Notes</th>
                <th className="px-3 py-2.5 text-center">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {students.map((s) => {
                const p = preds[s.id] ?? {};
                const risk = isAtRisk(p.predicted, p.target);
                return (
                  <tr key={s.id} className={clsx('hover:bg-slate-50 dark:hover:bg-slate-700/30', risk && 'bg-red-50/50 dark:bg-red-900/10')}>
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-slate-800">
                      {s.surname}, {s.preferredName ?? s.firstName}
                    </td>
                    {(['target','predicted','mock']).map((field) => (
                      <td key={field} className="px-2 py-1.5 text-center">
                        <select value={p[field] ?? '—'} onChange={(e) => update(s.id, field, e.target.value)}
                          className={clsx('text-xs border rounded px-1.5 py-1 bg-transparent cursor-pointer',
                            field === 'predicted' && risk
                              ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                              : 'border-slate-200 dark:border-slate-600')}>
                          {GRADES.map((g) => <option key={g}>{g}</option>)}
                        </select>
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <input value={p.notes ?? ''} onChange={(e) => update(s.id, 'notes', e.target.value)}
                        placeholder="—"
                        className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-transparent w-full" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {risk
                        ? <AlertTriangle size={14} className="text-red-500 mx-auto"/>
                        : p.predicted && p.predicted !== '—'
                          ? <CheckCircle2 size={14} className="text-green-500 mx-auto"/>
                          : null}
                    </td>
                  </tr>
                );
              })}
              {!students.length && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">No students in this class.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
