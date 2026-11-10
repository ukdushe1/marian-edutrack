/**
 * Phase 2 — Reports.
 * Shows the approval workflow: teacher → tutor → head → published.
 * Currently a scaffold with the state machine displayed.
 */
import { FileText, ChevronRight } from 'lucide-react';

const WORKFLOW = [
  { key: 'draft',    label: 'Teacher writes comments',    role: 'Subject teacher' },
  { key: 'reviewed', label: 'Tutor adds tutor comment',   role: 'Class tutor' },
  { key: 'approved', label: 'Head approves & signs off',  role: 'Head / Deputy' },
  { key: 'published',label: 'Report published to parent', role: 'Head / Deputy' },
];

export default function ReportsPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText size={20} /> Reports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Per-subject comments, approval flow, and batch PDF generation.
        </p>
      </div>

      {/* Workflow diagram */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold mb-4 text-sm">Approval workflow</h2>
        <div className="flex flex-col gap-3">
          {WORKFLOW.map((step, i) => (
            <div key={step.key} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-slate-400">{step.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center py-8 text-slate-400 text-sm">
        <FileText size={32} className="mx-auto mb-2 opacity-30" />
        Reports module is live in Phase 2 — once markbook data is in.
      </div>
    </div>
  );
}
