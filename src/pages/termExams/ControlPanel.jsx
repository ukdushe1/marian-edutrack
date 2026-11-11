/** Exam control panel: subjects × stages, coloured by status, with reminders. */
import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { STAGES, stageStatus, windowSubjects } from '../../lib/termExam/model';
import { card, Note, useExamRoles } from './ui';
import { useAuth } from '../../contexts/AuthContext';

const CELL = {
  done: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  progress: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  late: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  todo: 'bg-slate-50 dark:bg-slate-900/40 text-slate-400',
};
const SYMBOL = { done: '✓', progress: '…', late: '!', todo: '·' };

export default function ControlPanel({ data, goTo }) {
  const roles = useExamRoles();
  const { profile } = useAuth();
  const subjects = windowSubjects(data);
  const [sent, setSent] = useState({});

  async function remind(subj, stage) {
    const due = data.win.stageDue?.[stage.key];
    try {
      await addDoc(collection(db, 'notices'), {
        title: `Reminder: ${stage.label} for ${subj.code} (${data.win.name})`,
        body: `${stage.label} for ${subj.code} ${subj.name ?? ''} is ${due ? `due ${due}` : 'still outstanding'}. Sign-off needed: ${stage.signoff}.`,
        audience: stage.key === 'moderation' ? 'hods' : 'teachers',
        authorId: roles.uid, authorName: profile?.name ?? 'Exams office', readBy: [], createdAt: serverTimestamp(),
      });
      setSent((p) => ({ ...p, [`${subj.id}|${stage.key}`]: true }));
      toast.success('Reminder posted to Notices.');
    } catch { toast.error('Could not post the reminder.'); }
  }

  const counts = { done: 0, progress: 0, late: 0, todo: 0 };
  subjects.forEach((s) => STAGES.forEach((st) => { counts[stageStatus(data, s.id, st.key)]++; }));

  return (
    <div className="space-y-3">
      {!data.win.approved && <Note tone="warn">Stage 1: this window is waiting for the Principal or Vice Principal to approve it (Setup tab).</Note>}
      <p className="text-xs text-slate-500">
        {counts.done} done · {counts.progress} in progress · <span className="text-red-600">{counts.late} late</span> · {counts.todo} not started.
        Click a cell to open that stage. {roles.canManage && 'Late cells have a reminder button.'}
      </p>
      <div className={`${card} overflow-x-auto`}>
        <table className="text-xs min-w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-3 py-2 sticky left-0 bg-white dark:bg-slate-800">Subject</th>
              {STAGES.map((s) => <th key={s.key} className="px-1.5 py-2 font-medium text-slate-500 whitespace-nowrap">{s.n}. {s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj) => (
              <tr key={subj.id} className="border-b border-slate-100 dark:border-slate-700/50">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap sticky left-0 bg-white dark:bg-slate-800">{subj.code} <span className="text-slate-400 font-normal">{subj.name}</span></td>
                {STAGES.map((st) => {
                  const status = stageStatus(data, subj.id, st.key);
                  const key = `${subj.id}|${st.key}`;
                  return (
                    <td key={st.key} className="px-1 py-1 text-center">
                      <button onClick={() => goTo(st.key === 'published' ? 'cards' : st.key)} title={`${st.label}: ${status} — ${st.signoff}`}
                        className={clsx('w-full min-w-[3rem] rounded-md py-1 font-semibold', CELL[status])}>
                        {SYMBOL[status]}
                      </button>
                      {status === 'late' && roles.canManage && (
                        <button onClick={() => remind(subj, st)} disabled={sent[key]} title="Post a reminder"
                          className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-red-600 hover:underline disabled:text-slate-400">
                          <Bell size={9} /> {sent[key] ? 'sent' : 'remind'}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!subjects.length && <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-400">No subjects: the chosen forms have no classes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">✓ done · … in progress · ! late (past the due date set in Setup) · · not started. Status is worked out from the data, so it is always current.</p>
    </div>
  );
}
