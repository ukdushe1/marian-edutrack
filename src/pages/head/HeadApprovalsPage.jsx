/**
 * Principal / Vice Principal — approvals dashboard — Phase 2.
 * Shows reports awaiting approval, with approve/reject actions.
 * Also shows pending cover requests and open exam clashes.
 */
import { useState, useEffect } from 'react';
import {
  col, onSnapshot, query, where, orderBy, updateDoc, now, getDocs, teachingGroupsCol,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { FileText, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const reportsCol = () => col('reports');
const coverCol   = () => col('coverRequests');

export default function HeadApprovalsPage() {
  const [reports,  setReports]  = useState([]);
  const [cover,    setCover]    = useState([]);
  const [groups,   setGroups]   = useState([]);
  const [tab,      setTab]      = useState('reports');

  useEffect(() => {
    const unsubR = onSnapshot(
      query(reportsCol(), where('status', '==', 'reviewed'), orderBy('updatedAt', 'desc')),
      (s) => setReports(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubC = onSnapshot(
      query(coverCol(), where('status', '==', 'open'), orderBy('date', 'asc')),
      (s) => setCover(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    getDocs(teachingGroupsCol()).then((s) => setGroups(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { unsubR(); unsubC(); };
  }, []);

  async function approveReport(id) {
    await updateDoc(doc(db, 'reports', id), { status: 'approved', approvedAt: now() });
    toast.success('Report approved.');
  }

  async function publishReport(id) {
    await updateDoc(doc(db, 'reports', id), { status: 'published', publishedAt: now() });
    toast.success('Report published.');
  }

  async function rejectReport(id) {
    await updateDoc(doc(db, 'reports', id), { status: 'draft', updatedAt: now() });
    toast.success('Returned to draft.');
  }

  function groupName(groupId) {
    return groups.find((g) => g.id === groupId)?.name ?? groupId;
  }

  const tabs = [
    { id: 'reports', label: `Reports (${reports.length})` },
    { id: 'cover',   label: `Cover (${cover.length})` },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={20}/> Approvals</h1>

      {/* Tab bar */}
      <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 text-sm font-medium transition-colors',
              tab === t.id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{r.studentName ?? r.studentId}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {groupName(r.groupId)} · Term {r.termId ?? '—'} ·
                    <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">Awaiting approval</span>
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => approveReport(r.id)}
                    className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2.5 py-1.5 rounded-lg font-medium hover:bg-green-200 transition-colors">
                    <CheckCircle2 size={12}/> Approve
                  </button>
                  <button onClick={() => publishReport(r.id)}
                    className="flex items-center gap-1 text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2.5 py-1.5 rounded-lg font-medium hover:bg-brand-200 transition-colors">
                    Publish
                  </button>
                  <button onClick={() => rejectReport(r.id)}
                    className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2.5 py-1.5 rounded-lg font-medium hover:bg-red-100 transition-colors">
                    <XCircle size={12}/> Return
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!reports.length && (
            <div className="text-center py-14 text-slate-400 text-sm">
              <CheckCircle2 size={28} className="mx-auto mb-2 opacity-30"/>
              No reports awaiting approval.
            </div>
          )}
        </div>
      )}

      {tab === 'cover' && (
        <div className="space-y-2">
          {cover.map((c) => (
            <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertTriangle size={14} className="text-amber-500 shrink-0"/>
                <span className="font-semibold text-sm">{c.className ?? '—'}</span>
                <span className="text-xs text-slate-500">· {c.date} · Period {c.period}</span>
                <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                  No cover assigned
                </span>
              </div>
              {c.lessonNote && (
                <p className="text-xs text-slate-500 mt-1 ml-5">{c.lessonNote}</p>
              )}
            </div>
          ))}
          {!cover.length && (
            <div className="text-center py-14 text-slate-400 text-sm">
              <Clock size={28} className="mx-auto mb-2 opacity-30"/>
              No open cover requests.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
