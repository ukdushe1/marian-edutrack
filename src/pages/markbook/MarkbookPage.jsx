import { useState } from 'react';
import { useTeachingGroups } from '../../hooks/useTeachingGroups';
import MarkbookGrid from './MarkbookGrid';
import AssessmentForm from './AssessmentForm';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

export default function MarkbookPage() {
  const { groups, loading } = useTeachingGroups();
  const [groupId,     setGroupId]     = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [editAssessment, setEditAssessment] = useState(null);

  if (loading) return <Spinner />;

  if (!groups.length) return (
    <div className="text-center py-16 text-slate-500">
      No classes found. Ask the Principal to assign you to a class.
    </div>
  );

  const selected = groups.find((g) => g.id === groupId) ?? groups[0];
  if (!groupId && groups[0]) setTimeout(() => setGroupId(groups[0].id), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Markbook</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {selected?.syllabusCode} · {selected?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditAssessment(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={15} /> New assessment
          </button>
        </div>
      </div>

      {/* Group selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {groups.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroupId(g.id)}
            className={clsx(
              'shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
              g.id === (groupId || groups[0]?.id)
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            )}
          >
            {g.syllabusCode ?? g.name}
          </button>
        ))}
      </div>

      <MarkbookGrid
        groupId={groupId || groups[0]?.id}
        group={selected ?? groups[0]}
        onEdit={(a) => { setEditAssessment(a); setShowForm(true); }}
      />

      {showForm && (
        <AssessmentForm
          groupId={groupId || groups[0]?.id}
          assessment={editAssessment}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
    </div>
  );
}
