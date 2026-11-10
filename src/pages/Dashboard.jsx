import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, ClipboardList, FileText, Calendar, AlertCircle,
} from 'lucide-react';
import {
  col, query, where, getDocs, orderBy, limit,
} from '../firebase/firestore';
import { db } from '../firebase/config';
import { collection, getDocs as fsGetDocs } from 'firebase/firestore';
import clsx from 'clsx';

function StatCard({ icon: Icon, label, value, to, urgent }) {
  const inner = (
    <div className={clsx(
      'flex items-center gap-4 p-4 rounded-xl border transition-shadow hover:shadow-md',
      urgent
        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
    )}>
      <div className={clsx('p-2 rounded-lg', urgent ? 'bg-red-100 dark:bg-red-900/40 text-red-600' : 'bg-brand-50 dark:bg-brand-900/40 text-brand-600')}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const [counts, setCounts] = useState({ assessments: 0, registers: 0, comments: 0 });

  // Real counts would need group IDs for the teacher, left as 0 until groups load.
  // This dashboard structure is in place for Phase 2 wiring.

  const today = new Date().toLocaleDateString('en-ZW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Good {greeting()}, {profile?.name?.split(' ')[0] ?? 'there'}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{today}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard icon={BookOpen}     label="Unmarked assessments" value={counts.assessments} to="/markbook"  urgent={counts.assessments > 0} />
        <StatCard icon={ClipboardList} label="Registers not taken"  value={counts.registers}  to="/register" urgent={counts.registers  > 0} />
        <StatCard icon={FileText}      label="Comments due"         value={counts.comments}   to="/reports"  urgent={counts.comments   > 0} />
        <StatCard icon={Calendar}      label="Cover duties today"   value={0}                 to="#" />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <h2 className="font-semibold mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <QuickAction to="/markbook"  icon={BookOpen}      label="Open markbook" />
          <QuickAction to="/register"  icon={ClipboardList} label="Take register" />
          <QuickAction to="/reports"   icon={FileText}      label="Write comments" />
          <QuickAction to="/ai"        icon={AlertCircle}   label="AI tools" />
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
      <Icon size={16} className="text-brand-600" />
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
