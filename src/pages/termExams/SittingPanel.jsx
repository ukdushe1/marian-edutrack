/** Stage 4 — attendance for each paper (invigilators); incidents logged. */
import { useState } from 'react';
import { setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { paperRef, sittingRef, SITTING_STATUS } from '../../lib/termExam/model';
import { candidatesFor } from './TimetablePanel';
import { card, btn, Note, useExamRoles, studentName } from './ui';

const TONE = {
  present: 'bg-green-600 text-white', absent: 'bg-red-600 text-white', excused: 'bg-slate-500 text-white',
  sick: 'bg-amber-500 text-white', malpractice: 'bg-purple-700 text-white',
};

export default function SittingPanel({ data }) {
  const roles = useExamRoles();
  const { win, papers, sittings, reload } = data;
  const mine = papers.filter((p) => (p.invigilatorIds ?? []).includes(roles.uid));
  const [paperId, setPaperId] = useState((mine[0] ?? papers[0])?.id ?? '');
  const [local, setLocal] = useState({});   // optimistic statuses for this paper
  const paper = papers.find((p) => p.id === paperId);

  if (!win.timetablePublished) return <Note tone="warn">Attendance opens once the timetable is published (stage 3).</Note>;
  if (!paper) return <Note>No papers.</Note>;

  const cands = candidatesFor(data, paper);
  const canTake = !win.published && (roles.canManage || (paper.invigilatorIds ?? []).includes(roles.uid)) && (!paper.attendanceSubmitted || roles.canManage);
  const statusOf = (sid) => local[`${paper.id}|${sid}`] ?? sittings[sid]?.[paper.id] ?? 'present';

  async function setStatus(sid, status) {
    setLocal((p) => ({ ...p, [`${paper.id}|${sid}`]: status }));
    try {
      await setDoc(sittingRef(paper.id, sid), { paperId: paper.id, windowId: win.id, studentId: sid, status, updatedBy: roles.uid, updatedAt: serverTimestamp() }, { merge: true });
    } catch { toast.error('Not saved — only this paper’s invigilators or the exams officer can take attendance.'); }
  }

  async function submit(v) {
    try {
      if (v) {
        // Record everyone not yet marked as present, then sign off
        const batch = writeBatch(db);
        cands.filter((s) => !sittings[s.id]?.[paper.id] && !local[`${paper.id}|${s.id}`]).forEach((s) =>
          batch.set(sittingRef(paper.id, s.id), { paperId: paper.id, windowId: win.id, studentId: s.id, status: 'present', updatedBy: roles.uid, updatedAt: serverTimestamp() }));
        await batch.commit();
      }
      await updateDoc(paperRef(paper.id), { attendanceSubmitted: v, attendanceBy: v ? roles.uid : null, updatedAt: serverTimestamp() });
      toast.success(v ? 'Attendance submitted.' : 'Attendance reopened.');
      reload();
    } catch { toast.error('Could not submit.'); }
  }

  const counts = Object.fromEntries(SITTING_STATUS.map((s) => [s.key, cands.filter((c) => statusOf(c.id) === s.key).length]));

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <select className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={paperId} onChange={(e) => { setPaperId(e.target.value); setLocal({}); }}>
          {papers.map((p) => <option key={p.id} value={p.id}>{p.syllabusCode} {p.paper} — {p.date} {p.start}{(p.invigilatorIds ?? []).includes(roles.uid) ? ' (you invigilate)' : ''}{p.attendanceSubmitted ? ' ✓' : ''}</option>)}
        </select>
        <span className="text-xs text-slate-500">{SITTING_STATUS.map((s) => `${counts[s.key]} ${s.short}`).join(' · ')}</span>
      </div>
      {paper.attendanceSubmitted && <Note tone="ok">Attendance submitted for this paper.{roles.canManage && !win.published && <button className="underline ml-2" onClick={() => submit(false)}>Reopen</button>}</Note>}
      <p className="text-[11px] text-slate-500">{SITTING_STATUS.map((s) => `${s.short} = ${s.label}`).join(' · ')}</p>

      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700`}>
        {cands.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
            <span className="flex-1 min-w-[10rem] text-sm">{studentName(s)} <span className="text-xs text-slate-400">{s.candidateNumber}</span></span>
            <div className="flex gap-1">
              {SITTING_STATUS.map((st) => (
                <button key={st.key} disabled={!canTake} title={st.label} onClick={() => setStatus(s.id, st.key)}
                  className={clsx('w-8 h-7 rounded-md text-xs font-bold transition-colors disabled:cursor-not-allowed',
                    statusOf(s.id) === st.key ? TONE[st.key] : 'bg-slate-100 dark:bg-slate-700 text-slate-500')}>
                  {st.short}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Incidents during this paper</label>
        <textarea disabled={!canTake} rows={2} defaultValue={paper.incidents ?? ''} key={paper.id}
          onBlur={(e) => e.target.value !== (paper.incidents ?? '') && updateDoc(paperRef(paper.id), { incidents: e.target.value }).catch(() => toast.error('Not saved.'))}
          className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 resize-none" placeholder="e.g. fire drill at 10:15, 5 minutes added" />
      </div>
      {canTake && !paper.attendanceSubmitted && <button className={btn} onClick={() => submit(true)}><CheckCircle2 size={14} /> Submit attendance</button>}
      {!canTake && !paper.attendanceSubmitted && <p className="text-xs text-slate-400">Only this paper’s invigilators or the exams officer can take attendance.</p>}
    </div>
  );
}
