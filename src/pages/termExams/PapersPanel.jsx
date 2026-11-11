/** Stage 2 — papers: setter builds the question layout; HOD vets; exams officer marks printed. */
import { useState } from 'react';
import { addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Plus, X, Pencil, ShieldCheck, Printer, Lock } from 'lucide-react';
import { papersCol, paperRef, windowSubjects } from '../../lib/termExam/model';
import { TEACHING_ROLES } from '../../lib/roles';
import { card, input, label, btn, btnGhost, Note, useExamRoles, userName } from './ui';

const STATUS = { draft: 'Draft', vetted: 'Vetted (locked)', printed: 'Printed' };

export default function PapersPanel({ data }) {
  const roles = useExamRoles();
  const { win, papers, users } = data;
  const subjects = windowSubjects(data);
  const [editing, setEditing] = useState(undefined); // undefined closed; {syl} new; paper edit

  if (!win.approved) return <Note tone="warn">Papers open once the Principal or Vice Principal approves the window (stage 1).</Note>;

  async function setStatus(p, status) {
    try {
      await updateDoc(paperRef(p.id), { status, ...(status === 'vetted' ? { vettedBy: roles.uid, vettedAt: serverTimestamp() } : {}), updatedAt: serverTimestamp() });
      toast.success(`Paper marked ${STATUS[status].toLowerCase()}.`);
    } catch { toast.error('Not allowed — vetting is for the subject’s HOD.'); }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <Note>Paper and mark-scheme <strong>file uploads</strong> come in phase 2 (they need the Firebase Blaze plan). For now each paper records its questions, marks and topics, which the marking grid copies.</Note>
      {subjects.map((s) => {
        const list = papers.filter((p) => p.syllabusId === s.id);
        const canAdd = !win.published && (roles.canManage || roles.hodOf(s.code));
        return (
          <section key={s.id} className={`${card} p-4 space-y-2`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{s.code} <span className="text-slate-400 font-normal">{s.name}</span></p>
              {canAdd && <button className={btnGhost} onClick={() => setEditing({ syl: s })}><Plus size={13} /> Paper</button>}
            </div>
            {list.map((p) => {
              const isSetter = p.setterId === roles.uid;
              const canEdit = !win.published && ((p.status === 'draft' && (isSetter || roles.canManage)) || roles.hodOf(s.code));
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-2 text-sm">
                  <div className="flex-1 min-w-[12rem]">
                    <p className="font-medium">{p.paper} <span className="text-xs text-slate-400">· {p.maxMark} marks · {p.duration} min · {p.questions?.length ?? 0} questions</span></p>
                    <p className="text-xs text-slate-500">Setter: {userName(users, p.setterId)} · {STATUS[p.status] ?? p.status}{p.vettedBy ? ` by ${userName(users, p.vettedBy)}` : ''}</p>
                  </div>
                  {canEdit && <button className={btnGhost} onClick={() => setEditing(p)}><Pencil size={12} /> Edit</button>}
                  {p.status === 'draft' && roles.hodOf(s.code) && <button className={btn} onClick={() => setStatus(p, 'vetted')}><ShieldCheck size={13} /> Mark vetted</button>}
                  {p.status === 'vetted' && roles.hodOf(s.code) && !win.published && <button className={btnGhost} onClick={() => setStatus(p, 'draft')}>Reopen</button>}
                  {p.status === 'vetted' && roles.canManage && <button className={btnGhost} onClick={() => setStatus(p, 'printed')}><Printer size={12} /> Printed</button>}
                  {p.status !== 'draft' && <Lock size={12} className="text-slate-400" aria-label="Locked" />}
                </div>
              );
            })}
            {!list.length && <p className="text-xs text-slate-400">No papers yet.</p>}
          </section>
        );
      })}
      {editing !== undefined && <PaperForm data={data} paper={editing?.id ? editing : null} syl={editing?.syl ?? subjects.find((s) => s.id === editing?.syllabusId)} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

function PaperForm({ data, paper, syl, onClose }) {
  const roles = useExamRoles();
  const teachers = data.users.filter((u) => (u.roles ?? []).some((r) => TEACHING_ROLES.includes(r)));
  const subjectTeachers = new Set(data.groups.filter((g) => g.syllabusId === syl.id).flatMap((g) => g.teacherIds ?? []));
  const [f, setF] = useState({
    paper: paper?.paper ?? `Paper ${data.papers.filter((p) => p.syllabusId === syl.id).length + 1}`,
    duration: paper?.duration ?? 90,
    setterId: paper?.setterId ?? [...subjectTeachers][0] ?? '',
    questions: paper?.questions ?? [{ no: '1', marks: 10, topicId: '' }],
  });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const total = f.questions.reduce((a, q) => a + (Number(q.marks) || 0), 0);
  const setQ = (i, patch) => setF((p) => ({ ...p, questions: p.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }));

  async function save(e) {
    e.preventDefault();
    if (!f.setterId) { toast.error('Choose a setter.'); return; }
    if (f.questions.some((q) => !String(q.no).trim() || !(Number(q.marks) > 0))) { toast.error('Every question needs a number and marks above 0.'); return; }
    setBusy(true);
    const payload = {
      ...f, duration: Number(f.duration), maxMark: total,
      questions: f.questions.map((q) => ({ no: String(q.no).trim(), marks: Number(q.marks), topicId: q.topicId || '' })),
      updatedAt: serverTimestamp(),
    };
    try {
      if (paper) await updateDoc(paperRef(paper.id), payload);
      else await addDoc(papersCol(), {
        ...payload, windowId: data.win.id, syllabusId: syl.id, syllabusCode: syl.code, status: 'draft',
        invigilatorIds: [], attendanceSubmitted: false, createdBy: roles.uid, createdAt: serverTimestamp(),
      });
      toast.success('Paper saved.');
      onClose();
    } catch { toast.error('Save failed — check you are the setter, the HOD or the exams officer.'); setBusy(false); }
  }

  async function remove() {
    try { await deleteDoc(paperRef(paper.id)); toast.success('Paper deleted.'); onClose(); }
    catch { toast.error('Delete failed.'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <form onSubmit={save} className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4 space-y-3 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{paper ? 'Edit paper' : 'New paper'} — {syl.code}</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><label className={label}>Paper</label><input className={input} value={f.paper} onChange={(e) => setF({ ...f, paper: e.target.value })} required /></div>
          <div><label className={label}>Minutes</label><input type="number" className={input} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
        </div>
        <div>
          <label className={label}>Setter</label>
          <select className={input} value={f.setterId} onChange={(e) => setF({ ...f, setterId: e.target.value })}>
            <option value="">Choose…</option>
            {teachers.sort((a, b) => Number(subjectTeachers.has(b.id)) - Number(subjectTeachers.has(a.id))).map((t) => (
              <option key={t.id} value={t.id}>{t.name}{subjectTeachers.has(t.id) ? ' (teaches this subject)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Questions — the marking grid copies this layout</label>
          <div className="space-y-1">
            {f.questions.map((q, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input aria-label="Question number" className="w-14 text-sm border rounded px-1.5 py-1 dark:bg-slate-900 dark:border-slate-600" value={q.no} onChange={(e) => setQ(i, { no: e.target.value })} />
                <input aria-label="Marks" type="number" min={1} className="w-16 text-sm border rounded px-1.5 py-1 dark:bg-slate-900 dark:border-slate-600" value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} />
                <select aria-label="Topic" className="flex-1 text-sm border rounded px-1.5 py-1 dark:bg-slate-900 dark:border-slate-600" value={q.topicId} onChange={(e) => setQ(i, { topicId: e.target.value })}>
                  <option value="">Topic…</option>
                  {(syl.topics ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={() => setF({ ...f, questions: f.questions.filter((_, j) => j !== i) })} className="text-slate-400 p-1" aria-label="Remove question"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <button type="button" className={btnGhost} onClick={() => setF({ ...f, questions: [...f.questions, { no: String(f.questions.length + 1), marks: 10, topicId: '' }] })}><Plus size={12} /> Question</button>
            <span className="text-sm font-semibold">Total: {total} marks</span>
          </div>
        </div>
        <button className={`${btn} w-full`} disabled={busy}>{busy ? 'Saving…' : 'Save paper'}</button>
        {paper && paper.status === 'draft' && (confirmDel
          ? <div className="flex items-center gap-2 text-sm"><span className="flex-1 text-red-600">Delete this paper?</span>
              <button type="button" className={btnGhost} onClick={() => setConfirmDel(false)}>Cancel</button>
              <button type="button" className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm" onClick={remove}>Delete</button></div>
          : <button type="button" className="w-full text-xs text-slate-400 hover:text-red-600" onClick={() => setConfirmDel(true)}>Delete paper</button>)}
      </form>
    </div>
  );
}
