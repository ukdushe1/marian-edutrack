import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTeachingGroups } from '../hooks/useTeachingGroups';
import { useCurrentTerm } from '../hooks/useCurrentTerm';
import {
  BookOpen, ClipboardList, FileText, Calendar, AlertCircle, BarChart2,
} from 'lucide-react';
import {
  assessmentsCol, marksRef, registersCol, reportsCol,
  query, where, getDocs, getDoc, onSnapshot,
} from '../firebase/firestore';
import clsx from 'clsx';

export default function Dashboard() {
  const { profile, firebaseUser } = useAuth();
  const { groups, loading }       = useTeachingGroups();
  const { term }                  = useCurrentTerm();

  const [counts, setCounts] = useState({ assessments: 0, registers: 0, comments: 0 });
  const [loading2, setLoading2] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!groups.length || loading) return;

    async function fetchCounts() {
      let unmarked = 0;
      let regsNeeded = 0;
      let commentsDue = 0;

      await Promise.all(groups.map(async (g) => {
        // Count assessments with no marks doc (unmarked)
        const aSnap = await getDocs(assessmentsCol(g.id));
        for (const aDoc of aSnap.docs) {
          const mRef = marksRef(g.id, aDoc.id);
          const mSnap = await getDoc(mRef);
          if (!mSnap.exists()) unmarked++;
        }

        // Count today's missing register
        const rSnap = await getDocs(
          query(registersCol(), where('groupId', '==', g.id), where('date', '==', today))
        );
        if (rSnap.empty && aSnap.size > 0) regsNeeded++;

        // Count draft reports (comments not yet written)
        if (term?.id) {
          const repSnap = await getDocs(
            query(reportsCol(), where('groupId', '==', g.id), where('termId', '==', term.id), where('status', '==', 'draft'))
          );
          commentsDue += repSnap.size;
        }
      }));

      setCounts({ assessments: unmarked, registers: regsNeeded, comments: commentsDue });
      setLoading2(false);
    }

    fetchCounts();
  }, [groups, loading, today, term?.id]);

  const displayDate = new Date().toLocaleDateString('en-ZW', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Good {greeting()}, {profile?.name?.split(' ')[0] ?? 'there'}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{displayDate}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard icon={BookOpen}      label="Unmarked assessments" value={loading2 ? '…' : counts.assessments} to="/markbook"  urgent={counts.assessments > 0} />
        <StatCard icon={ClipboardList} label="Registers not taken"  value={loading2 ? '…' : counts.registers}  to="/register" urgent={counts.registers  > 0} />
        <StatCard icon={FileText}      label="Comments due"         value={loading2 ? '…' : counts.comments}   to="/reports"  urgent={counts.comments   > 0} />
        <StatCard icon={Calendar}      label="Groups assigned"      value={groups.length}                       to="/markbook" />
      </div>

      {/* Quick actions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="font-semibold mb-3 text-sm">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <QuickAction to="/markbook"  icon={BookOpen}      label="Open markbook"  />
          <QuickAction to="/register"  icon={ClipboardList} label="Take register"  />
          <QuickAction to="/reports"   icon={FileText}      label="Write comments" />
          <QuickAction to="/analysis"  icon={BarChart2}     label="Topic analysis" />
        </div>
      </div>

      {/* Groups summary */}
      {groups.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="font-semibold mb-3 text-sm">Your classes</h2>
          <div className="space-y-1">
            {groups.map((g) => (
              <Link key={g.id} to={`/markbook`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                <span className="text-sm font-medium">{g.syllabusCode ?? g.name}</span>
                <span className="text-xs text-slate-400">{g.studentIds?.length ?? 0} students</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, to, urgent }) {
  const inner = (
    <div className={clsx(
      'flex items-center gap-4 p-4 rounded-xl border transition-shadow hover:shadow-md',
      urgent
        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
    )}>
      <div className={clsx('p-2 rounded-lg shrink-0',
        urgent ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'bg-brand-50 dark:bg-brand-900/40 text-brand-600')}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold font-variant-numeric">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
      <Icon size={16} className="text-brand-600 shrink-0" />
      {label}
    </Link>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
