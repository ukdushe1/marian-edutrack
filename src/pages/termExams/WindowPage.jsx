/** One exam window: tabs for every stage. */
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useWindowData } from '../../lib/termExam/model';
import ControlPanel from './ControlPanel';
import SetupPanel from './SetupPanel';
import PapersPanel from './PapersPanel';
import TimetablePanel from './TimetablePanel';
import SittingPanel from './SittingPanel';
import MarkingPanel from './MarkingPanel';
import ModerationPanel from './ModerationPanel';
import ResultsPanel from './ResultsPanel';
import CommentsPanel from './CommentsPanel';
import ApprovalPanel from './ApprovalPanel';
import ReportCardsPanel from './ReportCardsPanel';

const TABS = [
  ['control', 'Control panel', ControlPanel],
  ['setup', '1 Setup', SetupPanel],
  ['papers', '2 Papers', PapersPanel],
  ['timetable', '3 Timetable', TimetablePanel],
  ['sitting', '4 Sitting', SittingPanel],
  ['marking', '5 Marking', MarkingPanel],
  ['moderation', '6 Moderation', ModerationPanel],
  ['results', '7 Results', ResultsPanel],
  ['comments', '8 Comments', CommentsPanel],
  ['approval', '9 Approval', ApprovalPanel],
  ['cards', '10 Report cards', ReportCardsPanel],
];

export default function WindowPage() {
  const { windowId } = useParams();
  const data = useWindowData(windowId);
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') ?? 'control');

  if (data.notFound) return <p className="text-sm text-slate-500">This exam window no longer exists. <Link className="text-brand-600" to="/exams/term">Back</Link></p>;
  if (data.loading) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading exam window…</p>;
  if (data.error) return <p className="text-sm text-red-600">Could not load: {data.error}</p>;

  const Panel = TABS.find(([k]) => k === tab)?.[2] ?? ControlPanel;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="print:hidden">
        <Link to="/exams/term" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"><ArrowLeft size={12} /> All exam windows</Link>
        <h1 className="text-xl font-bold">{data.win.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data.win.startDate} to {data.win.endDate} · Forms {data.forms.filter((f) => data.win.forms?.includes(f.id)).map((f) => f.name).join(', ') || '—'} · {data.students.length} students
          {data.win.published && ` · Published v${data.win.version}`}
        </p>
      </div>
      <div className="print:hidden flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700 -mx-1 px-1">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={clsx('whitespace-nowrap px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors',
              tab === k ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
            {label}
          </button>
        ))}
      </div>
      <Panel data={data} goTo={setTab} />
    </div>
  );
}
