/**
 * Stage 9 — approval (Principal / VP): class-by-class preview, Principal comments,
 * bulk approve or send back with a note.
 */
import { useMemo, useState } from 'react';
import { setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { CheckCircle2, Undo2, Loader2 } from 'lucide-react';
import { cardRef, windowRef, subjectReportId, groupFor } from '../../lib/termExam/model';
import { formResults } from '../../lib/termExam/compute';
import { fmtPct } from '../../lib/termExam/results';
import { useCommentBank } from '../../lib/commentBank';
import CommentPicker from '../../components/CommentPicker';
import { useCoursework } from './ResultsPanel';
import { card, btn, btnGhost, Note, useExamRoles, studentName } from './ui';

export function commentsComplete(data, res, sid) {
  const { win, reports, cards, groups } = data;
  const subj = res.subjects.filter((s) => groupFor(groups, sid, s.id));
  const subjOk = subj.every((s) => { const r = reports[subjectReportId(groupFor(groups, sid, s.id).id, win.termId, sid)]; return r?.subjectComment?.trim() && r?.effort; });
  return { subjOk, ctOk: !!cards[sid]?.classTeacherComment?.trim() };
}

export default function ApprovalPanel({ data }) {
  const roles = useExamRoles();
  const { win, cards, reload } = data;
  const forms = data.forms.filter((f) => win.forms?.includes(f.id));
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [comments, setComments] = useState({});
  const bank = useCommentBank();
  const cw = useCoursework(data);
  const res = useMemo(() => (cw ? formResults(data, formId, cw) : null), [cw, data, formId]);

  if (!win.resultsChecked) return <Note tone="warn">Approval opens once results are checked (stage 7) and comments are written (stage 8).</Note>;
  if (!res) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</p>;

  const rows = res.students.map((s) => ({ s, r: res.byStudent[s.id], c: commentsComplete(data, res, s.id), card: cards[s.id] }));
  const ready = rows.every((x) => x.c.subjOk && x.c.ctOk);
  const approved = rows.length > 0 && rows.every((x) => ['approved', 'published'].includes(x.card?.status));
  const formNote = win.formNotes?.[formId];

  const base = (s) => ({ type: 'termCard', windowId: win.id, termId: win.termId, studentId: s.id, formId, updatedAt: serverTimestamp() });

  async function savePrincipal(s) {
    try { await setDoc(cardRef(win.id, s.id), { ...base(s), principalComment: (comments[s.id] ?? '').trim(), status: cards[s.id]?.status ?? 'draft' }, { merge: true }); toast.success('Saved.'); reload(); }
    catch { toast.error('Not saved.'); }
  }

  async function approveAll() {
    if (!ready) { toast.error('Some comments or effort grades are missing (stage 8).'); return; }
    try {
      await Promise.all(rows.map(({ s }) => setDoc(cardRef(win.id, s.id), {
        ...base(s), ...(comments[s.id] != null ? { principalComment: comments[s.id].trim() } : {}),
        status: 'approved', approvedBy: roles.uid, approvedAt: serverTimestamp(), returnNote: null,
      }, { merge: true })));
      await updateDoc(windowRef(win.id), { [`formNotes.${formId}`]: null });
      toast.success('Form approved.'); reload();
    } catch { toast.error('Only the Principal or Vice Principal can approve.'); }
  }

  async function sendBack() {
    if (!note.trim()) { toast.error('Add a note saying what needs changing.'); return; }
    try {
      await Promise.all(rows.map(({ s }) => setDoc(cardRef(win.id, s.id), { ...base(s), status: 'draft', returnNote: note.trim() }, { merge: true })));
      await updateDoc(windowRef(win.id), { [`formNotes.${formId}`]: { note: note.trim(), by: roles.uid } });
      toast.success('Sent back with your note.'); setNote(''); reload();
    } catch { toast.error('Not allowed.'); }
  }

  return (
    <div className="space-y-3 max-w-5xl">
      <select className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={formId} onChange={(e) => setFormId(e.target.value)}>
        {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
      {approved && <Note tone="ok">This form is approved.</Note>}
      {formNote?.note && !approved && <Note tone="warn">Sent back: “{formNote.note}”</Note>}
      {!ready && <Note tone="warn">Waiting on comments: {rows.filter((x) => !x.c.subjOk).length} students missing subject comments or effort, {rows.filter((x) => !x.c.ctOk).length} missing a class teacher comment.</Note>}

      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700`}>
        {rows.map(({ s, r, c, card: cd }) => (
          <div key={s.id} className="px-4 py-2.5 space-y-1">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium flex-1">{studentName(s)}</span>
              <span className="text-xs text-slate-500">Average {fmtPct(r.overallAvg)} · {r.overallPos ? `${r.overallPos}/${r.overallOutOf}` : 'not ranked'}</span>
              <span className={`text-xs ${c.subjOk ? 'text-green-700' : 'text-amber-700'}`}>{c.subjOk ? 'Subject comments ✓' : 'Subject comments missing'}</span>
              <span className={`text-xs ${c.ctOk ? 'text-green-700' : 'text-amber-700'}`}>{c.ctOk ? 'Class teacher ✓' : 'Class teacher missing'}</span>
            </div>
            {cd?.classTeacherComment && <p className="text-xs text-slate-500">Class teacher: {cd.classTeacherComment}</p>}
            {roles.canApprove && !win.published && (
              <div>
                <CommentPicker comments={bank} subject="" student={s} onPick={(t) => setComments((p) => ({ ...p, [s.id]: `${(p[s.id] ?? cd?.principalComment ?? '').trim()} ${t}`.trim() }))} />
                <div className="flex gap-2">
                  <input className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 bg-white dark:bg-slate-900" placeholder="Principal’s comment"
                    value={comments[s.id] ?? cd?.principalComment ?? ''} onChange={(e) => setComments({ ...comments, [s.id]: e.target.value })} />
                  {comments[s.id] != null && <button className="text-xs text-brand-600" onClick={() => savePrincipal(s)}>Save</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {roles.canApprove && !win.published && (
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={approveAll} disabled={!ready}><CheckCircle2 size={14} /> Approve whole form</button>
          <input className="flex-1 min-w-[14rem] text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-900 dark:border-slate-600" placeholder="Note if sending back" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={btnGhost} onClick={sendBack}><Undo2 size={13} /> Send back</button>
        </div>
      )}
    </div>
  );
}
