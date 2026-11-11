/**
 * AI Tools — Phase 2 implementation.
 * Currently shows the four planned tools and their safeguards.
 * Each tool card will call a Cloud Function that calls Gemini/Claude.
 */
import { Sparkles, MessageSquare, HelpCircle, BookOpen, PenTool, AlertTriangle } from 'lucide-react';

const TOOLS = [
  {
    id:    'comments',
    icon:  MessageSquare,
    title: 'Report comment drafts',
    desc:  'Written from the term mark, paper components, weak topics and attendance. Run for a whole class at once.',
    phase: 2,
  },
  {
    id:    'questions',
    icon:  HelpCircle,
    title: 'Question & mark-scheme generator',
    desc:  'Pick a syllabus and topic; drafts are saved to a question bank already tagged to topics.',
    phase: 2,
  },
  {
    id:    'diagnostic',
    icon:  BookOpen,
    title: 'Class diagnostic summary',
    desc:  'Turns the topic heatmap into a short revision plan for the class.',
    phase: 2,
  },
  {
    id:    'lesson',
    icon:  PenTool,
    title: 'Lesson plan builder',
    desc:  'From a scheme-of-work topic, sized to 40- or 80-minute periods.',
    phase: 2,
  },
];

export default function AIToolsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Sparkles size={20} className="text-brand-500" /> AI Tools
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          All AI output goes into an editable box — nothing reaches a report without teacher sign-off.
        </p>
      </div>

      {/* Safeguards notice */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium mb-1">Safeguards in place</p>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            <li>API keys live in Cloud Functions — never in the browser.</li>
            <li>Only first names or IDs are sent to the model.</li>
            <li>Per-teacher daily quotas and a monthly school-wide spending cap.</li>
            <li>Every prompt, output, approver and cost is logged.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-3">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.id}
              className="relative flex items-start gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 opacity-60">
              <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-600 shrink-0">
                <Icon size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{t.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.desc}</p>
              </div>
              <span className="absolute top-3 right-3 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                Phase {t.phase}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 text-center">
        AI tools are implemented in Phase 2, once markbooks and registers are live.
      </p>
    </div>
  );
}
