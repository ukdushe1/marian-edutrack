/**
 * HOD department marks — Phase 2.
 * HOD sees the assessments of groups in their own subjects (profile hodSubjects)
 * and can lock/unlock them. Principal / VP see every group. firestore.rules enforces it.
 */
import { useState, useEffect, useRef } from 'react';
import {
  teachingGroupsCol, syllabiCol, onSnapshot, getDocs, query, orderBy, now,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, collection, onSnapshot as fsOnSnapshot, updateDoc } from 'firebase/firestore';
import { BookOpen, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useHodScope } from '../../hooks/useHodScope';

export default function HodMarksPage() {
  const scope = useHodScope();
  const [allGroups, setGroups]  = useState([]);
  const [syllabi,  setSyllabi]  = useState([]);
  const [expanded, setExpanded] = useState(null);
  // assessments per group: { [groupId]: assessment[] }
  const [assessments, setAssessments] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(teachingGroupsCol(), (s) => {
      setGroups(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    getDocs(syllabiCol()).then((s) => setSyllabi(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  // Live listeners for expanded classes — closed when the HOD leaves the page
  const listeners = useRef({});
  useEffect(() => () => Object.values(listeners.current).forEach((u) => u()), []);

  // When a group is expanded, subscribe to its assessments
  function handleExpand(groupId) {
    if (expanded === groupId) { setExpanded(null); return; }
    setExpanded(groupId);
    if (assessments[groupId]) return; // already loaded
    listeners.current[groupId] = fsOnSnapshot(
      query(collection(db, 'teachingGroups', groupId, 'assessments'), orderBy('createdAt', 'asc')),
      (snap) => setAssessments((prev) => ({
        ...prev,
        [groupId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
      }))
    );
  }

  async function toggleLock(groupId, assessment) {
    const aRef = doc(db, 'teachingGroups', groupId, 'assessments', assessment.id);
    await updateDoc(aRef, { locked: !assessment.locked, updatedAt: now() });
    toast.success(assessment.locked ? 'Assessment unlocked.' : 'Assessment locked.');
  }

  function syllabus(id) { return syllabi.find((s) => s.id === id); }
  const codeOf = (g) => g.syllabusCode ?? syllabus(g.syllabusId)?.code;
  const groups = allGroups.filter((g) => scope.leads(codeOf(g)));

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen size={20}/>
        <h1 className="text-xl font-bold">Department marks</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {scope.senior ? 'All classes. ' : scope.subjects.length ? `Classes in ${scope.subjects.join(', ')}. ` : ''}
        Lock assessments to prevent further changes.
      </p>

      <div className="space-y-2">
        {groups.map((g) => {
          const syl  = syllabus(g.syllabusId);
          const aList = assessments[g.id] ?? [];
          const isOpen = expanded === g.id;

          // Simple class avg per assessment: average of all numeric scores in the marks doc
          return (
            <div key={g.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => handleExpand(g.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <div>
                  <p className="font-semibold text-sm">{g.syllabusCode ?? syl?.code ?? '—'} · {g.name}</p>
                  <p className="text-xs text-slate-400">{g.year} · {aList.length} assessment{aList.length !== 1 ? 's' : ''}</p>
                </div>
                {isOpen ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  {aList.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-400">No assessments yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">Assessment</th>
                          <th className="px-3 py-2 text-center">Max</th>
                          <th className="px-3 py-2 text-center">Status</th>
                          <th className="px-3 py-2 text-center">Lock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {aList.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="px-3 py-2">
                              <p className="font-medium">{a.title}</p>
                              <p className="text-xs text-slate-400">{a.type} · {a.date ?? '—'}</p>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-500">{a.maxMark ?? '—'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                                a.locked
                                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300')}>
                                {a.locked ? 'Locked' : 'Open'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => toggleLock(g.id, a)}
                                aria-label={a.locked ? `Unlock ${a.title}` : `Lock ${a.title}`}
                                className={clsx('p-1.5 rounded-lg transition-colors',
                                  a.locked
                                    ? 'text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600'
                                    : 'text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600')}>
                                {a.locked ? <Unlock size={14}/> : <Lock size={14}/>}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!groups.length && (
          <div className="text-center py-14 text-slate-400 text-sm">
            {scope.senior || scope.subjects.length ? 'No classes found.'
              : 'No subjects are assigned to you yet. Ask the Principal to set your HOD subjects in Users.'}
          </div>
        )}
      </div>
    </div>
  );
}
