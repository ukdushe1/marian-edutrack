/** Stage 5 — marking: one markbook per paper × class; teachers open the per-question grid. */
import { Link } from 'react-router-dom';
import { PencilLine } from 'lucide-react';
import { windowSubjects, paperGroups, paperLabel, paperWritten, paperEndsAt } from '../../lib/termExam/model';
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
  const allWritten = papers.length && papers.every((p) => paperWritten(p));

  const rows = windowSubjects(data).flatMap((s) => papers.filter((p) => p.syllabusId === s.id).flatMap((p) =>
    paperGroups(groups, data.students, p).map((g) => ({ s, p, g, a: assessments[`${p.id}|${g.id}`] }))))
    .filter(({ s, g }) => roles.canManage || roles.hodOf(s.code) || (g.teacherIds ?? []).includes(roles.uid));

  return (
    <div className="space-y-3 max-w-4xl">
      {!allWritten && <Note>Each paper opens for marking as soon as its timetabled time is over. Everyone counts as present unless an invigilator recorded them absent.</Note>}
      <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700`}>
        {rows.map(({ p, g, a }) => {
          const [state, text] = markingState(a);
          const open = paperWritten(p);
          return (
            <div key={`${p.id}|${g.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <p className="font-medium">{paperLabel(p)} · {g.name}</p>
                <p className="text-xs text-slate-500">{(g.teacherIds ?? []).map((t) => userName(users, t)).join(', ')}{a?.moderationNote ? ` · HOD: “${a.moderationNote}”` : ''}</p>
              </div>
              <StatusPill status={state} /><span className="text-xs text-slate-500 w-32">{text}</span>
              {open
                ? <Link to={`/exams/term/${win.id}/mark/${p.id}/${g.id}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline text-sm"><PencilLine size={13} /> Open</Link>
                : <span className="text-xs text-slate-400">{p.date && p.start ? `Opens ${paperEndsAt(p)}` : 'Not on the timetable yet'}</span>}
            </div>
          );
        })}
        {!rows.length && <p className="px-4 py-8 text-center text-sm text-slate-400">No markbooks for you in this window.</p>}
      </div>
    </div>
  );
}
