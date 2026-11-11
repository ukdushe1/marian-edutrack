/**
 * Stage 6 — moderation queue (HOD): distribution by class, outliers flagged,
 * sample scripts recorded, then accept & lock or return with a note.
 */
import { useState } from 'react';
import { updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { CheckCircle2, Undo2, AlertTriangle } from 'lucide-react';
import { examAssessmentRef, windowSubjects } from '../../lib/termExam/model';
import { card, btn, btnGhost, Note, useExamRoles, studentName } from './ui';

function stats(vals) {
  if (!vals.length) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
  const sorted = [...vals].sort((a, b) => a - b);
  return { n: vals.length, mean, sd, min: sorted[0], max: sorted.at(-1), median: sorted[Math.floor(sorted.length / 2)] };
}
const BUCKETS = [[0, 30], [30, 40], [40, 50], [50, 65], [65, 75], [75, 101]];

export default function ModerationPanel({ data }) {
  const roles = useExamRoles();
  const { win, papers, groups, assessments, marks, students, reload } = data;
  const subjects = windowSubjects(data).filter((s) => roles.hodOf(s.code));
  const winStudents = new Set(students.map((s) => s.id));
  const [note, setNote] = useState({});

  if (!roles.isHod) return <Note>Moderation is done by each subject’s HOD.</Note>;
  if (!subjects.length) return <Note>You are not HOD of any subject in this window.</Note>;

  async function act(g, p, kind) {
    const ref = examAssessmentRef(g.id, p.id);
    const key = `${p.id}|${g.id}`;
    try {
      if (kind === 'accept') await updateDoc(ref, { locked: true, moderation: 'accepted', moderatedBy: roles.uid, moderatedAt: serverTimestamp() });
      if (kind === 'return') {
        if (!note[key]?.trim()) { toast.error('Add a note saying what to check.'); return; }
        await updateDoc(ref, { submitted: false, locked: false, moderation: 'returned', moderationNote: note[key].trim(), moderatedBy: roles.uid, moderatedAt: serverTimestamp() });
      }
      if (kind === 'unlock') await updateDoc(ref, { locked: false, moderation: null });
      toast.success({ accept: 'Marks accepted and locked.', return: 'Returned to the teacher.', unlock: 'Unlocked.' }[kind]);
      reload();
    } catch { toast.error('Not allowed.'); }
  }

  async function toggleSample(g, p, sid) {
    const a = assessments[`${p.id}|${g.id}`];
    const cur = a?.sampleIds ?? [];
    const next = cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid];
    try { await updateDoc(examAssessmentRef(g.id, p.id), { sampleIds: next }); reload(); } catch { toast.error('Not saved.'); }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Note>Check a sample of scripts in each class (tick them below), compare the classes, then accept and lock the marks or return them with a note. A class whose average is more than 10 points from the paper average, and students more than 2 standard deviations from their class, are flagged.</Note>
      {subjects.map((s) => papers.filter((p) => p.syllabusId === s.id).map((p) => {
        const gs = groups.filter((g) => g.syllabusId === s.id);
        const perClass = gs.map((g) => {
          const ent = marks[`${p.id}|${g.id}`] ?? {};
          const vals = Object.entries(ent).filter(([sid, e]) => winStudents.has(sid) && e?.raw != null).map(([sid, e]) => ({ sid, pct: (e.raw / p.maxMark) * 100 }));
          return { g, a: assessments[`${p.id}|${g.id}`], vals, st: stats(vals.map((v) => v.pct)) };
        });
        const all = stats(perClass.flatMap((c) => c.vals.map((v) => v.pct)));
        return (
          <section key={p.id} className={`${card} p-4 space-y-3`}>
            <p className="font-semibold text-sm">{s.code} {p.paper} <span className="text-xs font-normal text-slate-400">· paper average {all ? `${all.mean.toFixed(1)}%` : '—'}</span></p>
            {perClass.map(({ g, a, vals, st }) => {
              const key = `${p.id}|${g.id}`;
              const off = st && all && Math.abs(st.mean - all.mean) > 10;
              const outliers = st && st.sd > 0 ? vals.filter((v) => Math.abs(v.pct - st.mean) > 2 * st.sd) : [];
              const studentsIn = students.filter((x) => (g.studentIds ?? []).includes(x.id));
              return (
                <div key={g.id} className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-slate-500">{st ? `${st.n} marked · avg ${st.mean.toFixed(1)}% · median ${st.median.toFixed(0)}% · ${st.min.toFixed(0)}–${st.max.toFixed(0)}%` : 'No marks yet'}</span>
                    {off && <span className="text-xs text-amber-700 inline-flex items-center gap-1"><AlertTriangle size={12} /> class average differs from paper by {(st.mean - all.mean).toFixed(1)} pts</span>}
                    <span className="text-xs text-slate-400 ml-auto">{a?.locked ? 'Locked' : a?.submitted ? 'Submitted — awaiting you' : a?.moderation === 'returned' ? 'Returned' : 'Not submitted'}</span>
                  </div>
                  {st && (
                    <div className="flex items-end gap-1 h-12" aria-label="Distribution">
                      {BUCKETS.map(([lo, hi]) => {
                        const n = vals.filter((v) => v.pct >= lo && v.pct < hi).length;
                        return (
                          <div key={lo} className="flex-1 flex flex-col items-center justify-end">
                            <div className="w-full bg-brand-500/70 rounded-t" style={{ height: `${(n / st.n) * 40}px` }} title={`${n} students`} />
                            <span className="text-[10px] text-slate-400">{lo}{hi > 100 ? '+' : `–${hi - 1}`}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {outliers.length > 0 && <p className="text-xs text-amber-700">Outliers: {outliers.map((o) => `${studentName(students.find((x) => x.id === o.sid))} (${o.pct.toFixed(0)}%)`).join(', ')}</p>}
                  {a?.submitted && !a?.locked && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-500">Scripts sampled: {(a.sampleIds ?? []).length}</summary>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {studentsIn.map((x) => (
                          <button key={x.id} onClick={() => toggleSample(g, p, x.id)}
                            className={clsx('px-2 py-0.5 rounded-full border', (a.sampleIds ?? []).includes(x.id) ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 dark:border-slate-600')}>
                            {studentName(x)}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                  {!win.published && a?.submitted && !a?.locked && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button className={btn} onClick={() => act(g, p, 'accept')}><CheckCircle2 size={13} /> Accept &amp; lock</button>
                      <input className="flex-1 min-w-[12rem] text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-900 dark:border-slate-600" placeholder="Note if returning (e.g. re-check Q4 for 3D1)"
                        value={note[key] ?? ''} onChange={(e) => setNote({ ...note, [key]: e.target.value })} />
                      <button className={btnGhost} onClick={() => act(g, p, 'return')}><Undo2 size={13} /> Return</button>
                    </div>
                  )}
                  {!win.published && a?.locked && <button className="text-xs text-slate-500 underline" onClick={() => act(g, p, 'unlock')}>Unlock to allow corrections</button>}
                </div>
              );
            })}
          </section>
        );
      }))}
    </div>
  );
}
