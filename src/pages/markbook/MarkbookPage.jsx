import { useEffect, useMemo, useState } from 'react';
import { useTeachingGroups } from '../../hooks/useTeachingGroups';
import { useAuth } from '../../contexts/AuthContext';
import { teachingGroupsCol, classesCol, onSnapshot } from '../../firebase/firestore';
import MarkbookGrid from './MarkbookGrid';
import AssessmentForm from './AssessmentForm';
import { Plus } from 'lucide-react';
import clsx from 'clsx';

/** System Admin (and the Principal, who has it) sees every class's markbook. */
function useAllGroups(enabled) {
  const [groups, setGroups] = useState(null);
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    const u1 = onSnapshot(teachingGroupsCol(), (s) => setGroups(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true }))));
    const u2 = onSnapshot(classesCol(), (s) => setClasses(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [enabled]);
  return { groups: groups ?? [], classes, loading: enabled && groups === null };
}

export default function MarkbookPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('superAdmin');
  const mine = useTeachingGroups();
  const everyone = useAllGroups(isAdmin);
  const { groups, loading } = isAdmin ? everyone : mine;
  const [classId, setClassId] = useState('');
  // Admin: classes that have groups, in form order, to pick from
  const classList = useMemo(() => {
    if (!isAdmin) return [];
    const ids = [...new Set(groups.map((g) => g.classId).filter(Boolean))];
    const name = (id) => everyone.classes.find((c) => c.id === id)?.name ?? id;
    const list = ids.map((id) => ({ id, name: name(id), form: everyone.classes.find((c) => c.id === id)?.form ?? 99 }))
      .sort((a, b) => a.form - b.form || a.name.localeCompare(b.name));
    return groups.some((g) => !g.classId) ? [...list, { id: '_other', name: 'Other groups', form: 100 }] : list;
  }, [isAdmin, groups, everyone.classes]);
  const activeClass = classId || classList[0]?.id || '';
  const shown = isAdmin ? groups.filter((g) => (activeClass === '_other' ? !g.classId : g.classId === activeClass)) : groups;
  const [groupId,     setGroupId]     = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [editAssessment, setEditAssessment] = useState(null);

  if (loading) return <Spinner />;

  if (!groups.length) return (
    <div className="text-center py-16 text-slate-500">
      No classes found. Ask the Principal to assign you to a class.
    </div>
  );

  const selected = shown.find((g) => g.id === groupId) ?? shown[0];
  if ((!groupId || !shown.some((g) => g.id === groupId)) && shown[0]) setTimeout(() => setGroupId(shown[0].id), 0);

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

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-500" htmlFor="mb-class">Class</label>
          <select id="mb-class" value={activeClass} onChange={(e) => { setClassId(e.target.value); setGroupId(''); }}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900">
            {classList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-xs text-slate-400">System Admin: every class</span>
        </div>
      )}

      {/* Group selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {shown.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroupId(g.id)}
            className={clsx(
              'shrink-0 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
              g.id === selected?.id
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            )}
          >
            {isAdmin ? (g.name?.replace(/^\S+(\s+(Sciences|Commercials|Arts))?\s+/, '') || g.syllabusCode) : (g.syllabusCode ?? g.name)}
          </button>
        ))}
      </div>

      <MarkbookGrid
        groupId={selected?.id}
        group={selected}
        onEdit={(a) => { setEditAssessment(a); setShowForm(true); }}
      />

      {showForm && (
        <AssessmentForm
          groupId={selected?.id}
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
