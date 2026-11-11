/** Stage 1 — exam setup (exams officer) and approval (Principal / VP). */
import { useState } from 'react';
import { updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { CheckCircle2, Plus, X } from 'lucide-react';
import { windowRef, windowSubjects, subjectWeights, syllabusRequiresCoursework, STAGES, DEFAULT_BANDS } from '../../lib/termExam/model';
import { card, input, label, btn, btnGhost, Note, useExamRoles, userName } from './ui';

export default function SetupPanel({ data }) {
  const roles = useExamRoles();
  const { win } = data;
  const subjects = windowSubjects(data);
  const [f, setF] = useState(() => ({
    name: win.name, startDate: win.startDate, endDate: win.endDate,
    courseworkFrom: win.courseworkFrom ?? '', nextTermOpens: win.nextTermOpens ?? '',
    defaultSplit: win.defaultSplit ?? { exam: 70, coursework: 30 },
    subjects: Object.fromEntries(subjects.map((s) => [s.id, subjectWeights(win, s)])),
    gradeBands: win.gradeBands?.length ? win.gradeBands : DEFAULT_BANDS,
    minSubjects: win.minSubjects ?? 5,
    stageDue: win.stageDue ?? {},
  }));
  const [busy, setBusy] = useState(false);
  const locked = win.published;
  const editable = roles.canManage && !locked;

  const setSubj = (id, patch) => setF((p) => ({ ...p, subjects: { ...p.subjects, [id]: { ...p.subjects[id], ...patch } } }));

  async function save() {
    for (const [id, w] of Object.entries(f.subjects)) {
      if (w.mode === 'examCoursework' && Number(w.exam) + Number(w.coursework) !== 100) {
        toast.error(`Weights for ${subjects.find((s) => s.id === id)?.code} must add up to 100.`); return;
      }
    }
    if (f.subjects && Object.values(f.subjects).some((w) => w.mode === 'examCoursework') && !f.courseworkFrom) {
      toast.error('Set "Coursework counted from" — it decides which markbook work counts.'); return;
    }
    setBusy(true);
    try {
      // Changing an approved setup needs fresh approval, unless a senior leader saves it
      const reapprove = win.approved && !roles.canApprove;
      await updateDoc(windowRef(win.id), {
        ...f, minSubjects: Number(f.minSubjects),
        gradeBands: f.gradeBands.map((b) => ({ grade: b.grade.trim(), min: Number(b.min) })).sort((a, b) => b.min - a.min),
        ...(reapprove ? { approved: false, approvedBy: null } : {}),
        updatedAt: serverTimestamp(),
      });
      toast.success(reapprove ? 'Saved. The window needs approval again.' : 'Setup saved.');
    } catch { toast.error('Save failed.'); } finally { setBusy(false); }
  }

  async function approve(v) {
    try {
      await updateDoc(windowRef(win.id), { approved: v, approvedBy: v ? roles.uid : null, approvedAt: v ? serverTimestamp() : null });
      toast.success(v ? 'Exam window approved.' : 'Approval withdrawn.');
    } catch { toast.error('Only the Principal or Vice Principal can approve.'); }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {win.approved
        ? <Note tone="ok">Approved by {userName(data.users, win.approvedBy)}. {roles.canApprove && !locked && <button className="underline ml-1" onClick={() => approve(false)}>Withdraw approval</button>}</Note>
        : <Note tone="warn">Sign-off: the Principal or Vice Principal approves this window before papers are set.
            {roles.canApprove && <button className={`${btn} ml-3`} onClick={() => approve(true)}><CheckCircle2 size={14} /> Approve window</button>}</Note>}
      {locked && <Note>Results are published, so the setup is frozen.</Note>}

      <fieldset disabled={!editable} className={`${card} p-4 grid sm:grid-cols-2 gap-3`}>
        <div className="sm:col-span-2"><label className={label}>Name</label><input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className={label}>First exam</label><input type="date" className={input} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
        <div><label className={label}>Last exam</label><input type="date" className={input} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        <div><label className={label}>Coursework and attendance counted from</label><input type="date" className={input} value={f.courseworkFrom} onChange={(e) => setF({ ...f, courseworkFrom: e.target.value })} /></div>
        <div><label className={label}>Next term opens (shown on report cards)</label><input type="date" className={input} value={f.nextTermOpens} onChange={(e) => setF({ ...f, nextTermOpens: e.target.value })} /></div>
      </fieldset>

      <fieldset disabled={!editable} className={`${card} p-4 space-y-3`}>
        <div>
          <p className="font-semibold text-sm">Subject weighting</p>
          <p className="text-xs text-slate-500">Exam only unless the subject’s syllabus requires coursework (a coursework, practical or project component). Default split for those:{' '}
            <input type="number" className="w-14 border rounded px-1 dark:bg-slate-900 dark:border-slate-600" value={f.defaultSplit.exam}
              onChange={(e) => setF({ ...f, defaultSplit: { exam: Number(e.target.value), coursework: 100 - Number(e.target.value) } })} /> / {f.defaultSplit.coursework}</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 text-left"><th className="py-1">Subject</th><th>Counts</th><th>Exam %</th><th>Coursework %</th></tr></thead>
          <tbody>
            {subjects.map((s) => {
              const w = f.subjects[s.id] ?? { mode: 'exam' };
              const requires = syllabusRequiresCoursework(s);
              return (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="py-1.5">{s.code} <span className="text-slate-400">{s.name}</span></td>
                  <td>{requires
                    ? <select className="text-xs border rounded px-1 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={w.mode}
                        onChange={(e) => setSubj(s.id, e.target.value === 'exam' ? { mode: 'exam' } : { mode: 'examCoursework', exam: f.defaultSplit.exam, coursework: f.defaultSplit.coursework })}>
                        <option value="examCoursework">Exam + coursework</option><option value="exam">Exam only</option>
                      </select>
                    : <span className="text-xs text-slate-500">Exam only (no coursework in syllabus)</span>}</td>
                  <td>{w.mode === 'examCoursework'
                    ? <input type="number" className="w-16 text-xs border rounded px-1 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={w.exam} onChange={(e) => setSubj(s.id, { exam: Number(e.target.value), coursework: 100 - Number(e.target.value) })} />
                    : '100'}</td>
                  <td>{w.mode === 'examCoursework' ? w.coursework : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-4">
        <fieldset disabled={!editable} className={`${card} p-4 space-y-2`}>
          <p className="font-semibold text-sm">Grade bands (school %)</p>
          {f.gradeBands.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input className="w-14 border rounded px-1.5 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={b.grade}
                onChange={(e) => setF({ ...f, gradeBands: f.gradeBands.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)) })} />
              <span className="text-xs text-slate-500">from</span>
              <input type="number" className="w-16 border rounded px-1.5 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={b.min}
                onChange={(e) => setF({ ...f, gradeBands: f.gradeBands.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)) })} />
              <span className="text-xs text-slate-500">%</span>
              <button type="button" onClick={() => setF({ ...f, gradeBands: f.gradeBands.filter((_, j) => j !== i) })} className="text-slate-400"><X size={12} /></button>
            </div>
          ))}
          <button type="button" className={btnGhost} onClick={() => setF({ ...f, gradeBands: [...f.gradeBands, { grade: '', min: 0 }] })}><Plus size={12} /> Band</button>
          <div className="pt-2"><label className={label}>Minimum subjects for an overall position</label>
            <input type="number" min={1} className="w-20 border rounded px-1.5 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={f.minSubjects} onChange={(e) => setF({ ...f, minSubjects: e.target.value })} /></div>
        </fieldset>
        <fieldset disabled={!editable} className={`${card} p-4 space-y-1.5`}>
          <p className="font-semibold text-sm">Stage due dates</p>
          <p className="text-xs text-slate-500">Used to mark stages late on the control panel.</p>
          {STAGES.slice(1).map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.n}. {s.label}</span>
              <input type="date" className="text-xs border rounded px-1.5 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={f.stageDue[s.key] ?? ''}
                onChange={(e) => setF({ ...f, stageDue: { ...f.stageDue, [s.key]: e.target.value } })} />
            </div>
          ))}
        </fieldset>
      </div>

      {editable && <button className={btn} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save setup'}</button>}
    </div>
  );
}
