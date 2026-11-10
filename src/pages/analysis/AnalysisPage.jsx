/**
 * Topic analysis — Phase 2.
 * Shows a heatmap of topic scores per student.
 * Each assessment has questions tagged to syllabus topic IDs.
 * Per-question marks → aggregate by topic → colour by % correct.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTeachingGroups } from '../../hooks/useTeachingGroups';
import { useAssessments } from '../../hooks/useAssessments';
import { useStudents } from '../../hooks/useStudents';
import { marksRef, syllabusRef, getDoc, onSnapshot } from '../../firebase/firestore';
import { BarChart2, Info } from 'lucide-react';
import clsx from 'clsx';

function heatColor(pct) {
  if (pct === null) return 'bg-slate-100 dark:bg-slate-700 text-slate-400';
  if (pct >= 70)    return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
  if (pct >= 50)    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300';
  return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
}

export default function AnalysisPage() {
  const { groups }             = useTeachingGroups();
  const [groupId, setGroupId]  = useState('');
  const group                  = groups.find((g) => g.id === groupId) ?? groups[0];
  const { assessments }        = useAssessments(group?.id);
  const { students }           = useStudents(group?.studentIds ?? []);

  const [marksMap,  setMarksMap]  = useState({});   // { assessmentId: entries }
  const [syllabus,  setSyllabus]  = useState(null);
  const [selAssIds, setSelAssIds] = useState([]);   // which assessments to include

  // Load marks for all assessments
  useEffect(() => {
    if (!assessments.length) return;
    const unsubList = assessments.map((a) => {
      const ref = marksRef(group.id, a.id);
      return onSnapshot(ref, (snap) => {
        if (snap.exists()) setMarksMap((p) => ({ ...p, [a.id]: snap.data().entries ?? {} }));
      });
    });
    setSelAssIds(assessments.map((a) => a.id));
    return () => unsubList.forEach((u) => u());
  }, [assessments.map((a) => a.id).join(',')]);

  // Load syllabus topics
  useEffect(() => {
    if (!group?.syllabusId) return;
    getDoc(syllabusRef(group.syllabusId)).then((snap) => {
      if (snap.exists()) setSyllabus(snap.data());
    });
  }, [group?.syllabusId]);

  // Build topic score map: { studentId: { topicId: { got, max } } }
  const topicScores = useMemo(() => {
    const result = {};
    students.forEach((s) => { result[s.id] = {}; });

    const included = assessments.filter((a) => selAssIds.includes(a.id));
    included.forEach((assessment) => {
      const questions = assessment.questions ?? [];
      const entries   = marksMap[assessment.id] ?? {};
      questions.forEach((q) => {
        if (!q.topicId) return;
        students.forEach((s) => {
          const entry = entries[s.id];
          if (!entry || entry.status === 'absent' || entry.status === 'exempt') return;
          const perQ = entry.perQuestion ?? {};
          const got  = perQ[q.no] ?? 0;
          if (!result[s.id][q.topicId]) result[s.id][q.topicId] = { got: 0, max: 0 };
          result[s.id][q.topicId].got += got;
          result[s.id][q.topicId].max += q.marks ?? 1;
        });
      });
    });
    return result;
  }, [students, assessments, marksMap, selAssIds]);

  // All topics that appear in selected assessments
  const topicIds = useMemo(() => {
    const ids = new Set();
    assessments.filter((a) => selAssIds.includes(a.id)).forEach((a) => {
      (a.questions ?? []).forEach((q) => { if (q.topicId) ids.add(q.topicId); });
    });
    return [...ids];
  }, [assessments, selAssIds]);

  const topicName = (id) => {
    const t = syllabus?.topics?.find((t) => t.id === id);
    return t?.name ?? id;
  };

  // Class average per topic
  const classAvg = useMemo(() => {
    const avgs = {};
    topicIds.forEach((tid) => {
      const vals = students.map((s) => {
        const sc = topicScores[s.id]?.[tid];
        return sc?.max ? sc.got / sc.max : null;
      }).filter((v) => v !== null);
      avgs[tid] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : null;
    });
    return avgs;
  }, [topicIds, students, topicScores]);

  const weakTopics = topicIds.filter((t) => (classAvg[t] ?? 100) < 50).sort((a, b) => (classAvg[a] ?? 100) - (classAvg[b] ?? 100));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BarChart2 size={20}/> Topic analysis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Class heatmap by syllabus topic</p>
        </div>
        <select value={groupId || group?.id || ''} onChange={(e) => setGroupId(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500">
          {groups.map((g) => <option key={g.id} value={g.id}>{g.syllabusCode ?? g.name}</option>)}
        </select>
      </div>

      {/* Assessment filter */}
      {assessments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assessments.map((a) => (
            <button key={a.id}
              onClick={() => setSelAssIds((p) => p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id])}
              className={clsx('text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                selAssIds.includes(a.id)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              )}>
              {a.title}
            </button>
          ))}
        </div>
      )}

      {/* Weak topics summary */}
      {weakTopics.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="font-semibold text-sm text-red-700 dark:text-red-300 mb-2">Topics needing revision (class avg &lt;50%)</p>
          <div className="flex flex-wrap gap-2">
            {weakTopics.map((t) => (
              <span key={t} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2.5 py-1 rounded-full">
                {topicName(t)} — {classAvg[t] ?? '—'}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {topicIds.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <Info size={28} className="mx-auto mb-2 opacity-30"/>
          No topic-tagged questions found. When creating an assessment, tag each question to a syllabus topic to see the heatmap.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs border-collapse bg-white dark:bg-slate-800">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <th className="text-left px-3 py-2 font-medium text-slate-500 sticky left-0 bg-slate-50 dark:bg-slate-900 min-w-[150px]">Student</th>
                {topicIds.map((t) => (
                  <th key={t} className="px-2 py-2 font-medium text-slate-500 min-w-[90px] text-center">
                    <span className="block max-w-[80px] mx-auto truncate" title={topicName(t)}>{topicName(t)}</span>
                  </th>
                ))}
              </tr>
              {/* Class average row */}
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <td className="px-3 py-1.5 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-white dark:bg-slate-800">Class avg</td>
                {topicIds.map((t) => (
                  <td key={t} className="text-center px-1 py-1">
                    <span className={clsx('inline-block w-14 rounded py-0.5 text-center font-semibold', heatColor(classAvg[t]))}>
                      {classAvg[t] !== null ? `${classAvg[t]}%` : '—'}
                    </span>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                  <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-800">
                    {s.surname ? `${s.surname}, ${s.preferredName ?? s.firstName}` : s.name}
                  </td>
                  {topicIds.map((t) => {
                    const sc  = topicScores[s.id]?.[t];
                    const pct = sc?.max ? Math.round((sc.got / sc.max) * 100) : null;
                    return (
                      <td key={t} className="text-center px-1 py-1">
                        <span className={clsx('inline-block w-14 rounded py-0.5 text-center', heatColor(pct))}>
                          {pct !== null ? `${pct}%` : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800 inline-block"></span>≥70%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800 inline-block"></span>50–69%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-800 inline-block"></span>&lt;50%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 inline-block"></span>No data</span>
      </div>
    </div>
  );
}
