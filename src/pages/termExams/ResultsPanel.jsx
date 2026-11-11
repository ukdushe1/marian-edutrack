/**
 * Stage 7 — results: combine exam (+ coursework where the syllabus requires it),
 * apply bands, positions within the form. Exams officer checks and signs off.
 * After publication the Principal / VP can unlock a subject with a recorded reason.
 */
import { useEffect, useMemo, useState } from 'react';
import { updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertTriangle, Loader2, Unlock } from 'lucide-react';
import { windowRef, examAssessmentRef, windowSubjects } from '../../lib/termExam/model';
import { formResults, loadCoursework } from '../../lib/termExam/compute';
import { fmtPct } from '../../lib/termExam/results';
import { writeAuditLog } from '../../firebase/firestore';
import { card, btn, btnGhost, Note, useExamRoles, studentName } from './ui';

const FLAG_TEXT = {
  unmarked: 'paper not marked', missingCoursework: 'coursework required but missing', malpractice: 'malpractice recorded',
};

/** Coursework loader shared by stages 7, 9 and 10. */
export function useCoursework(data) {
  const [cw, setCw] = useState(null);
  useEffect(() => {
    let off = false;
    loadCoursework(data).then((r) => !off && setCw(r)).catch(() => !off && setCw({}));
    return () => { off = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.win.id, data.groups.length, data.win.courseworkFrom, data.win.endDate, JSON.stringify(data.win.subjects)]);
  return cw;
}

export default function ResultsPanel({ data }) {
  const roles = useExamRoles();
  const { win, papers, groups, assessments, reload } = data;
  const forms = data.forms.filter((f) => win.forms?.includes(f.id));
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const cw = useCoursework(data);
  const all = useMemo(() => (cw ? Object.fromEntries(forms.map((f) => [f.id, formResults(data, f.id, cw)])) : null), [cw, data, forms]);
  const [unlock, setUnlock] = useState({ subject: '', reason: '' });

  if (!all) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Calculating results…</p>;

  const pairs = papers.flatMap((p) => groups.filter((g) => g.syllabusId === p.syllabusId).map((g) => assessments[`${p.id}|${g.id}`]));
  const allLocked = pairs.length > 0 && pairs.every((a) => a?.locked);
  const blocking = Object.values(all).flatMap((r) => r.flags.filter((f) => f.type !== 'malpractice'));
  const res = all[formId];
  const sname = (sid) => studentName(data.students.find((s) => s.id === sid));
  const subjName = (id) => windowSubjects(data).find((s) => s.id === id)?.code ?? id;

  async function signOff(v) {
    if (v && (!allLocked || blocking.length)) { toast.error('All marks must be moderated and every issue resolved first.'); return; }
    try { await updateDoc(windowRef(win.id), { resultsChecked: v, checkedBy: v ? roles.uid : null, checkedAt: v ? serverTimestamp() : null }); toast.success(v ? 'Results checked.' : 'Sign-off withdrawn.'); }
    catch { toast.error('Not allowed.'); }
  }

  async function doUnlock() {
    if (!unlock.subject || unlock.reason.trim().length < 5) { toast.error('Choose a subject and give a reason.'); return; }
    try {
      const sp = papers.filter((p) => p.syllabusId === unlock.subject);
      await Promise.all(sp.flatMap((p) => groups.filter((g) => g.syllabusId === p.syllabusId)
        .map((g) => updateDoc(examAssessmentRef(g.id, p.id), { frozen: false, locked: false, moderation: null }).catch(() => null))));
      await updateDoc(windowRef(win.id), { published: false, resultsChecked: false, unlockedFrom: win.version ?? 1 });
      await writeAuditLog(roles.uid, 'examWindows', win.id, { published: true, version: win.version ?? 1 },
        { unlockedSubject: subjName(unlock.subject), reason: unlock.reason.trim() });
      toast.success('Unlocked. Correct the marks, re-moderate, then publish again (new version).');
      setUnlock({ subject: '', reason: '' });
      reload();
    } catch { toast.error('Only the Principal or Vice Principal can unlock.'); }
  }

  return (
    <div className="space-y-3">
      {win.resultsChecked
        ? <Note tone="ok">Results checked and signed off.{roles.canManage && !win.published && <button className="underline ml-2" onClick={() => signOff(false)}>Withdraw</button>}</Note>
        : <Note tone={allLocked && !blocking.length ? 'info' : 'warn'}>
            Sign-off: the exams officer checks this summary. {allLocked ? '' : 'Some marks are not moderated and locked yet. '}
            {roles.canManage && <button className={`${btn} ml-2`} onClick={() => signOff(true)} disabled={!allLocked || blocking.length > 0}><CheckCircle2 size={13} /> Results checked</button>}
          </Note>}

      {Object.values(all).some((r) => r.flags.length > 0) && (
        <div className={`${card} p-3`}>
          <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-700"><AlertTriangle size={14} /> Issues to resolve</p>
          <ul className="text-xs mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {Object.values(all).flatMap((r) => r.flags).map((f, i) => (
              <li key={i}>{sname(f.studentId)} · {subjName(f.subjectId)}: {FLAG_TEXT[f.type] ?? f.type}{f.type === 'malpractice' ? ' (scores 0 — Principal informed)' : ''}</li>
            ))}
          </ul>
        </div>
      )}

      <select className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={formId} onChange={(e) => setFormId(e.target.value)}>
        {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      {res && (
        <div className={`${card} overflow-x-auto`}>
          <table className="text-xs min-w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                <th className="text-left px-3 py-2 sticky left-0 bg-white dark:bg-slate-800">Student</th>
                {res.subjects.map((s) => <th key={s.id} className="px-2 py-2">{s.code}<span className="block font-normal">{s.weights.mode === 'examCoursework' ? `E${s.weights.exam}/C${s.weights.coursework}` : 'exam'}</span></th>)}
                <th className="px-2">Average</th><th className="px-2">Position</th>
              </tr>
            </thead>
            <tbody>
              {res.students.map((st) => {
                const r = res.byStudent[st.id];
                return (
                  <tr key={st.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="px-3 py-1 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-800">{studentName(st)}</td>
                    {res.subjects.map((s) => {
                      const x = r.subjects[s.id];
                      return <td key={s.id} className="px-2 text-center whitespace-nowrap">{x ? <>{x.grade} <span className="text-slate-400">{fmtPct(x.finalPct)}{x.position ? ` · ${x.position}/${res.subjectStats[s.id].outOf}` : ''}</span></> : ''}</td>;
                    })}
                    <td className="px-2 text-center">{fmtPct(r.overallAvg)}</td>
                    <td className="px-2 text-center font-semibold">{r.overallPos ? `${r.overallPos}/${r.overallOutOf}` : <span className="text-slate-400 font-normal">{r.counted < (win.minSubjects ?? 5) ? `< ${win.minSubjects ?? 5} subj.` : '—'}</span>}</td>
                  </tr>
                );
              })}
              <tr className="text-slate-500">
                <td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-slate-800">Form average</td>
                {res.subjects.map((s) => <td key={s.id} className="px-2 text-center">{fmtPct(res.subjectStats[s.id].average)}</td>)}
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">Grade · final % · position in subject (within the form). X = valid absence, left out of positions. Equal scores (to 1 decimal) share a position.</p>

      {(win.published || win.unlockedFrom) && roles.canApprove && (
        <div className={`${card} p-4 space-y-2`}>
          <p className="font-semibold text-sm flex items-center gap-1.5"><Unlock size={14} /> Unlock published marks</p>
          <p className="text-xs text-slate-500">Published marks are frozen. Unlocking a subject withdraws publication; the reason is kept in the audit log, and the next publish becomes a new version.</p>
          {win.published ? (
            <div className="flex flex-wrap gap-2">
              <select className="text-sm border rounded-lg px-2 py-1.5 dark:bg-slate-900 dark:border-slate-600" value={unlock.subject} onChange={(e) => setUnlock({ ...unlock, subject: e.target.value })}>
                <option value="">Subject…</option>
                {windowSubjects(data).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
              </select>
              <input className="flex-1 min-w-[12rem] text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-900 dark:border-slate-600" placeholder="Reason (required)" value={unlock.reason} onChange={(e) => setUnlock({ ...unlock, reason: e.target.value })} />
              <button className={btnGhost} onClick={doUnlock}>Unlock</button>
            </div>
          ) : <p className="text-xs text-amber-700">Unlocked from version {win.unlockedFrom}. Re-moderate, re-check and publish again.</p>}
        </div>
      )}
    </div>
  );
}
