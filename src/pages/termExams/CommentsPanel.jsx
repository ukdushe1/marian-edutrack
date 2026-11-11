/**
 * Stage 8 — comments. Subject comments + effort are written on the Reports page
 * (preset drop-down available); class teacher comments are written here.
 * Attendance and conduct are pulled in automatically on the report card.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { cardRef, subjectReportId, windowSubjects, groupFor } from '../../lib/termExam/model';
import { useCommentBank } from '../../lib/commentBank';
import CommentPicker from '../../components/CommentPicker';
import { card, Note, StatusPill, studentName } from './ui';

export default function CommentsPanel({ data }) {
  const { hasRole, firebaseUser } = useAuth();
  const { win, reports, cards, reload } = data;
  const forms = data.forms.filter((f) => win.forms?.includes(f.id));
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const bank = useCommentBank();
  const canClassTeacher = hasRole('classTeacher', 'vicePrincipal', 'superAdmin');
  const subjects = windowSubjects(data);
  const students = data.students.filter((s) => s.classId === formId);

  if (!win.resultsChecked) return <Note tone="warn">Comments open once the results are checked (stage 7), so teachers comment on final marks. (Teachers can still draft on the Reports page.)</Note>;
  if (!win.termId) return <Note tone="warn">Set the term on this window first.</Note>;

  const subjectProgress = subjects.map((s) => {
    const need = students.map((st) => { const g = groupFor(data.groups, st.id, s.id); return g ? reports[subjectReportId(g.id, win.termId, st.id)] : undefined; })
      .filter((_, i) => groupFor(data.groups, students[i].id, s.id));
    const done = need.filter((r) => r?.subjectComment?.trim() && r?.effort).length;
    return { s, done, total: need.length };
  }).filter((x) => x.total > 0);

  return (
    <div className="space-y-3 max-w-4xl">
      <select className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={formId} onChange={(e) => setFormId(e.target.value)}>
        {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      <div className={`${card} p-4`}>
        <p className="font-semibold text-sm mb-2">Subject comments and effort grades</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {subjectProgress.map(({ s, done, total }) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span>{s.code} <span className="text-slate-400">{s.name}</span></span>
              <span className="flex items-center gap-2"><span className="text-xs text-slate-500">{done}/{total}</span><StatusPill compact status={done === total ? 'done' : done ? 'progress' : 'todo'} /></span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">Teachers write these on the <Link to="/reports" className="text-brand-600 underline">Reports</Link> page: pick a preset or type a comment, and set the effort grade.</p>
      </div>

      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700`}>
        <p className="px-4 py-2 font-semibold text-sm">Class teacher comments — {forms.find((f) => f.id === formId)?.name}</p>
        {students.map((st) => (
          <ClassTeacherComment key={st.id} student={st} card={cards[st.id]} win={win} formId={formId}
            canEdit={canClassTeacher && !['approved', 'published'].includes(cards[st.id]?.status)} bank={bank} uid={firebaseUser.uid} onSaved={reload} />
        ))}
      </div>
    </div>
  );
}

function ClassTeacherComment({ student, card: c, win, formId, canEdit, bank, uid, onSaved }) {
  const [text, setText] = useState(c?.classTeacherComment ?? '');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setText(c?.classTeacherComment ?? ''); setDirty(false); }, [c?.classTeacherComment]);

  async function save() {
    try {
      await setDoc(cardRef(win.id, student.id), {
        type: 'termCard', windowId: win.id, termId: win.termId, studentId: student.id, formId,
        classTeacherComment: text.trim(), classTeacherId: uid, status: c?.status ?? 'draft', updatedAt: serverTimestamp(),
        ...(c ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      setDirty(false); toast.success('Saved.'); onSaved();
    } catch { toast.error('Not saved — the report may already be approved.'); }
  }

  return (
    <div className="px-4 py-2.5 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{studentName(student)}</span>
        {c?.status && c.status !== 'draft' && <span className="text-xs text-slate-400">{c.status}</span>}
      </div>
      {canEdit && <CommentPicker comments={bank} subject="" student={student} onPick={(t) => { setText((p) => (p.trim() ? `${p.trim()} ${t}` : t)); setDirty(true); }} />}
      <textarea rows={2} disabled={!canEdit} value={text} onChange={(e) => { setText(e.target.value); setDirty(true); }}
        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 resize-none" placeholder={canEdit ? 'Class teacher comment…' : '—'} />
      {dirty && canEdit && <button className="text-xs text-brand-600 hover:underline" onClick={save}>Save</button>}
    </div>
  );
}
