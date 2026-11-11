/** Stage 5 — marking: one markbook per paper × class; teachers open the per-question grid. */
import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { windowSubjects } from '../../lib/termExam/model';
import { card, Note, StatusPill, useExamRoles, userName } from './ui';

export function markingState(a) {
  if (!a) return ['todo', 'Not started'];
  if (a.locked && a.moderation === 'accepted') return ['done', 'Accepted & locked'];
  if (a.submitted) return ['done', a.moderation === 'returned' ? 'Re-submitted' : 'Submitted'];
  if (a.moderation === 'returned') return ['late', 'Returned by HOD'];
  return ['progress', 'In progress'];
}

export default function MarkingPanel({ data }) {
  const roles = useExamRoles();
  const { win, papers, groups, assessments, users } = data;
  const sittingDone = papers.length && papers.every((p) => p.attendanceSubmitted);

  const rows = windowSubjects(data).flatMap((s) => papers.filter((p) => p.syllabusId === s.id).flatMap((p) =>
    groups.filter((g) => g.syllabusId === s.id).map((g) => ({ s, p, g, a: assessments[`${p.id}|${g.id}`] }))))
    .filter(({ s, g }) => roles.canManage || roles.hodOf(s.code) || (g.teacherIds ?? []).includes(roles.uid));

  return (
    <div className="space-y-3 max-w-4xl">
      {!sittingDone && <Note tone="warn">Some papers’ attendance is not submitted yet; you can start marking papers that have been sat.</Note>}
      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700`}>
        {rows.map(({ s, p, g, a }) => {
          const [state, text] = markingState(a);
          const open = p.attendanceSubmitted;
          return (
            <div key={`${p.id}|${g.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium">{s.code} {p.paper} · {g.name}</p>
                <p className="text-xs text-slate-500">{(g.teacherIds ?? []).map((t) => userName(users, t)).join(', ')}{a?.moderationNote ? ` · HOD: “${a.moderationNote}”` : ''}</p>
              </div>
              <StatusPill status={state} /><span className="text-xs text-slate-500 w-32">{text}</span>
              {open
                ? <Link to={`/exams/term/${win.id}/mark/${p.id}/${g.id}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline text-sm"><PencilLine size={13} /> Open</Link>
                : <span className="text-xs text-slate-400">Not sat yet</span>}
            </div>
          );
        })}
        {!rows.length && <p className="px-4 py-8 text-center text-sm text-slate-400">No markbooks for you in this window.</p>}
      </div>
    </div>
  );
}
