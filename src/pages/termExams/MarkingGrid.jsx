/**
 * Per-question marking grid for one paper × class. Copies the paper's layout;
 * totals add up automatically. Saved into the main markbook (exam_{paperId}).
 */
import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, doc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ArrowLeft, Send, Lock, Loader2 } from 'lucide-react';
import { paperRef, windowRef, examAssessmentRef, examMarksRef } from '../../lib/termExam/model';
import { writeAuditLog } from '../../firebase/firestore';
import { useStudents } from '../../hooks/useStudents';
import { card, btn, Note, useExamRoles, studentName } from './ui';

export default function MarkingGrid() {
  const { windowId, paperId, groupId } = useParams();
  const roles = useExamRoles();
  const [win, setWin] = useState(null);
  const [paper, setPaper] = useState(null);
  const [group, setGroup] = useState(null);
  const [assess, setAssess] = useState(undefined);
  const [entries, setEntries] = useState({});
  const [sittings, setSittings] = useState({});
  const [draft, setDraft] = useState({}); // typed but unsaved cells

  useEffect(() => {
    getDoc(windowRef(windowId)).then((d) => setWin(d.data() ?? false));
    getDoc(doc(db, 'teachingGroups', groupId)).then((d) => setGroup(d.exists() ? { id: d.id, ...d.data() } : false));
    getDocs(query(collection(db, 'examSittings'), where('paperId', '==', paperId))).then((s) =>
      setSittings(Object.fromEntries(s.docs.map((d) => [d.data().studentId, d.data().status]))));
    const u1 = onSnapshot(paperRef(paperId), (d) => setPaper(d.exists() ? { id: d.id, ...d.data() } : false));
    const u2 = onSnapshot(examAssessmentRef(groupId, paperId), (d) => setAssess(d.exists() ? d.data() : null));
    const u3 = onSnapshot(examMarksRef(groupId, paperId), (d) => setEntries(d.exists() ? d.data().entries ?? {} : {}));
    return () => { u1(); u2(); u3(); };
  }, [windowId, paperId, groupId]);

  const { students: all } = useStudents(group?.studentIds ?? []);
  const students = useMemo(() => (win?.forms ? all.filter((s) => win.forms.includes(s.classId)) : all), [all, win]);

  // Create the markbook entry for this paper on first open (appears in the normal Markbook too)
  useEffect(() => {
    if (assess !== null || !paper || !group || !win) return;
    const isTeacher = (group.teacherIds ?? []).includes(roles.uid);
    if (!isTeacher && !roles.isHod && !roles.canManage) return;
    setDoc(examAssessmentRef(groupId, paperId), {
      title: `${paper.paper} — ${win.name}`, component: 'Exam', maxMark: paper.maxMark, date: paper.date ?? win.endDate,
      examPaperId: paperId, windowId, questions: paper.questions ?? [], submitted: false, locked: false,
      createdBy: roles.uid, createdAt: serverTimestamp(),
    }).catch(() => {});
  }, [assess, paper, group, win, groupId, paperId, windowId, roles]);

  if (win === null || paper === null || group === null || assess === undefined) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</p>;
  if (!win || !paper || !group) return <Note tone="warn">This paper or class was not found.</Note>;

  const qs = paper.questions ?? [];
  const isTeacher = (group.teacherIds ?? []).includes(roles.uid);
  const frozen = !!assess?.frozen || win.published;
  const locked = !!assess?.locked;
  const canEdit = !frozen && ((isTeacher && !assess?.submitted && !locked) || (roles.isHod && !locked) || (roles.senior));
  const present = students.filter((s) => (sittings[s.id] ?? 'present') === 'present');

  const cell = (sid, no) => draft[`${sid}|${no}`] ?? entries[sid]?.perQuestion?.[no] ?? '';
  const totalOf = (sid) => {
    const pq = { ...(entries[sid]?.perQuestion ?? {}) };
    Object.entries(draft).forEach(([k, v]) => { const [s, n] = k.split('|'); if (s === sid) pq[n] = v === '' ? null : Number(v); });
    const vals = qs.map((q) => pq[q.no]);
    return vals.some((v) => v != null && v !== '') ? vals.reduce((a, v) => a + (Number(v) || 0), 0) : null;
  };
  const complete = (sid) => qs.every((q) => { const v = cell(sid, q.no); return v !== '' && v != null; });

  async function save(sid, q, value) {
    const key = `${sid}|${q.no}`;
    if (value === '') { setDraft((d) => ({ ...d, [key]: '' })); }
    const n = value === '' ? null : Number(value);
    if (n != null && (isNaN(n) || n < 0 || n > q.marks)) { toast.error(`Q${q.no} is out of ${q.marks}.`); return; }
    const before = entries[sid]?.perQuestion?.[q.no] ?? null;
    if (before === n) { setDraft((d) => { const x = { ...d }; delete x[key]; return x; }); return; }
    const perQuestion = { ...(entries[sid]?.perQuestion ?? {}), [q.no]: n };
    const vals = qs.map((x) => perQuestion[x.no]);
    const raw = vals.some((v) => v != null) ? vals.reduce((a, v) => a + (Number(v) || 0), 0) : null;
    try {
      await setDoc(examMarksRef(groupId, paperId), { entries: { [sid]: { raw, status: null, perQuestion } }, updatedBy: roles.uid, updatedAt: serverTimestamp() }, { merge: true });
      setDraft((d) => { const x = { ...d }; delete x[key]; return x; });
      if (before != null) writeAuditLog(roles.uid, 'marks', `teachingGroups/${groupId}/assessments/exam_${paperId}`, { studentId: sid, question: q.no, raw: before }, { studentId: sid, question: q.no, raw: n }).catch(() => {});
    } catch { toast.error('Not saved — the marks may be locked.'); }
  }

  async function submit() {
    const missing = present.filter((s) => !complete(s.id));
    if (missing.length) { toast.error(`${missing.length} present student(s) still have unmarked questions.`); return; }
    try {
      await updateDoc(examAssessmentRef(groupId, paperId), { submitted: true, submittedBy: roles.uid, submittedAt: serverTimestamp() });
      toast.success('Markbook submitted for moderation.');
    } catch { toast.error('Could not submit.'); }
  }

  return (
    <div className="space-y-3 max-w-6xl">
      <Link to={`/exams/term/${windowId}?tab=marking`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"><ArrowLeft size={12} /> {win.name}</Link>
      <h1 className="text-xl font-bold">{paper.syllabusCode} {paper.paper} · {group.name}</h1>
      <p className="text-sm text-slate-500">{paper.maxMark} marks · {qs.length} questions · {present.length} of {students.length} sat</p>
      {assess?.moderation === 'returned' && !assess?.submitted && <Note tone="warn">Returned by the HOD: “{assess.moderationNote || 'please review'}”. Correct the marks and submit again.</Note>}
      {assess?.submitted && !locked && <Note tone="ok">Submitted for moderation{isTeacher ? ' — you can no longer change marks unless the HOD returns them.' : '.'}</Note>}
      {locked && <Note tone="ok"><Lock size={12} className="inline" /> Moderated and locked by the HOD.{frozen && ' Results are published: marks are frozen.'}</Note>}

      <div className={`${card} overflow-x-auto`}>
        <table className="text-sm min-w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              <th className="text-left px-3 py-2 sticky left-0 bg-white dark:bg-slate-800">Student</th>
              {qs.map((q) => <th key={q.no} className="px-1 py-2 font-medium">Q{q.no}<span className="block font-normal">/{q.marks}</span></th>)}
              <th className="px-2 py-2">Total<span className="block font-normal">/{paper.maxMark}</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const st = sittings[s.id] ?? 'present';
              const sat = st === 'present';
              const total = totalOf(s.id);
              return (
                <tr key={s.id} className={clsx('border-b border-slate-100 dark:border-slate-700/50', !sat && 'bg-slate-50 dark:bg-slate-900/40')}>
                  <td className="px-3 py-1 whitespace-nowrap sticky left-0 bg-inherit">{studentName(s)}</td>
                  {sat ? qs.map((q) => (
                    <td key={q.no} className="px-0.5 py-0.5 text-center">
                      <input inputMode="numeric" disabled={!canEdit} aria-label={`${studentName(s)} Q${q.no}`}
                        className="w-11 text-center text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-0.5 disabled:bg-slate-100 dark:disabled:bg-slate-700"
                        value={cell(s.id, q.no)}
                        onChange={(e) => setDraft((d) => ({ ...d, [`${s.id}|${q.no}`]: e.target.value.replace(/[^\d.]/g, '') }))}
                        onBlur={(e) => save(s.id, q, e.target.value.trim())} />
                    </td>
                  )) : <td colSpan={qs.length} className="px-3 text-xs text-slate-500 italic">{st === 'absent' ? 'Absent (no reason) — scores 0' : st === 'malpractice' ? 'Malpractice — scores 0' : `${st === 'sick' ? 'Sick' : 'Absent with valid reason'} — X`}</td>}
                  <td className={clsx('px-2 text-center font-semibold', sat && !complete(s.id) && 'text-amber-600')}>{sat ? (total ?? '—') : (['absent', 'malpractice'].includes(st) ? 0 : 'X')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && isTeacher && !assess?.submitted && <button className={btn} onClick={submit}><Send size={14} /> Submit markbook</button>}
      <p className="text-[11px] text-slate-400">Marks save when you leave a box. Changes to a mark already saved are recorded in the audit log.</p>
    </div>
  );
}
