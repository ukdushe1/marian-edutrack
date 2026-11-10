/**
 * Reports workflow: draft → reviewed → approved → published
 *
 * Teacher view: write subject comments per student, see status.
 * Tutor view: add tutor comment.
 * Head view: approve and publish.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeachingGroups } from '../../hooks/useTeachingGroups';
import { useStudents } from '../../hooks/useStudents';
import { useCurrentTerm } from '../../hooks/useCurrentTerm';
import {
  reportsCol, query, where, onSnapshot, setDoc, updateDoc,
  reportRef, now, getDocs,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, collection } from 'firebase/firestore';
import {
  FileText, CheckCircle2, Clock, Send, ChevronDown, ChevronUp,
  Lock, AlertCircle, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const STATUS_ORDER = ['draft', 'reviewed', 'approved', 'published'];
const STATUS_META  = {
  draft:     { label: 'Draft',     color: 'text-slate-400',  bg: 'bg-slate-100 dark:bg-slate-700'   },
  reviewed:  { label: 'Reviewed',  color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  approved:  { label: 'Approved',  color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20'   },
  published: { label: 'Published', color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20' },
};

export default function ReportsPage() {
  const { firebaseUser, hasRole } = useAuth();
  const { groups }                = useTeachingGroups();
  const { term }                  = useCurrentTerm();

  const [groupId,   setGroupId]   = useState('');
  const [reports,   setReports]   = useState({});  // { studentId: reportDoc }
  const [expanded,  setExpanded]  = useState(null);
  const [busy,      setBusy]      = useState(null);

  const group    = groups.find((g) => g.id === groupId) ?? groups[0];
  const { students } = useStudents(group?.studentIds ?? []);

  const isHead   = hasRole('head', 'superAdmin');
  const isTutor  = hasRole('tutor', 'head', 'superAdmin');

  // Load reports for this group + term
  useEffect(() => {
    if (!group?.id || !term?.id) return;
    const q = query(reportsCol(), where('groupId', '==', group.id), where('termId', '==', term.id));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.data().studentId] = { id: d.id, ...d.data() }; });
      setReports(map);
    });
    return unsub;
  }, [group?.id, term?.id]);

  async function getOrCreateReport(studentId) {
    if (reports[studentId]) return reports[studentId];
    const id = `${group.id}_${term?.id ?? 'nterm'}_${studentId}`;
    const data = {
      studentId, groupId: group.id,
      termId: term?.id ?? null,
      syllabusCode: group.syllabusCode ?? '',
      subjectComment: '', tutorComment: '', headComment: '',
      status: 'draft',
      createdAt: now(),
    };
    await setDoc(doc(db, 'reports', id), data);
    return { id, ...data };
  }

  async function saveComment(studentId, field, value) {
    setBusy(studentId + field);
    try {
      const r = await getOrCreateReport(studentId);
      await updateDoc(doc(db, 'reports', r.id), { [field]: value, updatedAt: now() });
    } catch { toast.error('Save failed.'); }
    finally { setBusy(null); }
  }

  async function advance(studentId) {
    const r = reports[studentId];
    if (!r) return;
    const idx     = STATUS_ORDER.indexOf(r.status);
    const next    = STATUS_ORDER[idx + 1];
    if (!next) return;
    if (next === 'approved' && !isHead) { toast.error('Only the head can approve reports.'); return; }
    if (next === 'published' && !isHead) { toast.error('Only the head can publish reports.'); return; }
    setBusy(studentId + 'adv');
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        status: next,
        [`${next}By`]: firebaseUser.uid,
        [`${next}At`]: now(),
      });
      toast.success(`Report marked as ${next}.`);
    } catch { toast.error('Update failed.'); }
    finally { setBusy(null); }
  }

  const done      = students.filter((s) => reports[s.id]?.status === 'published').length;
  const total     = students.length;
  const pct       = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={20}/> Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {term ? `Term: ${term.year} · Term ${term.term}` : 'No active term — ask admin to set one.'}
          </p>
        </div>
        {/* Group selector */}
        <select value={groupId || group?.id || ''} onChange={(e) => setGroupId(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500">
          {groups.map((g) => <option key={g.id} value={g.id}>{g.syllabusCode ?? g.name}</option>)}
        </select>
      </div>

      {/* Progress bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-medium">Published</span>
          <span className="text-slate-500">{done} / {total}</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {/* Workflow steps */}
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {STATUS_ORDER.map((s, i) => {
            const count = students.filter((st) => reports[st.id]?.status === s).length;
            const meta  = STATUS_META[s];
            return (
              <div key={s} className={clsx('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', meta.bg, meta.color)}>
                {meta.label}: {count}
              </div>
            );
          })}
        </div>
      </div>

      {!term && (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <AlertCircle size={15} /> No active term found. Reports can still be drafted but won't be tied to a term until admin creates one.
        </div>
      )}

      {/* Student list */}
      <div className="space-y-2">
        {students.map((s) => {
          const report  = reports[s.id];
          const status  = report?.status ?? 'draft';
          const meta    = STATUS_META[status];
          const isOpen  = expanded === s.id;
          const nextIdx = STATUS_ORDER.indexOf(status) + 1;
          const next    = STATUS_ORDER[nextIdx];
          const canAdv  = next && (next !== 'approved' && next !== 'published' ? true : isHead);

          return (
            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Row header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                onClick={() => setExpanded(isOpen ? null : s.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {s.surname ? `${s.surname}, ${s.preferredName ?? s.firstName}` : s.name}
                  </p>
                  <p className="text-xs text-slate-400">{s.candidateNumber}</p>
                </div>
                <span className={clsx('text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0', meta.bg, meta.color)}>
                  {meta.label}
                </span>
                {isOpen ? <ChevronUp size={15} className="text-slate-400 shrink-0"/> : <ChevronDown size={15} className="text-slate-400 shrink-0"/>}
              </button>

              {/* Expanded comment editor */}
              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-700 p-4 space-y-3">
                  {/* Subject comment */}
                  <CommentField
                    label="Subject comment"
                    value={report?.subjectComment ?? ''}
                    readOnly={status === 'published'}
                    onSave={(v) => saveComment(s.id, 'subjectComment', v)}
                    busy={busy === s.id + 'subjectComment'}
                  />
                  {/* Tutor comment */}
                  {isTutor && (
                    <CommentField
                      label="Tutor comment"
                      value={report?.tutorComment ?? ''}
                      readOnly={status === 'published'}
                      onSave={(v) => saveComment(s.id, 'tutorComment', v)}
                      busy={busy === s.id + 'tutorComment'}
                    />
                  )}
                  {/* Head comment */}
                  {isHead && (
                    <CommentField
                      label="Head's comment"
                      value={report?.headComment ?? ''}
                      readOnly={status === 'published'}
                      onSave={(v) => saveComment(s.id, 'headComment', v)}
                      busy={busy === s.id + 'headComment'}
                    />
                  )}
                  {/* Advance button */}
                  {canAdv && status !== 'published' && (
                    <button
                      onClick={() => advance(s.id)}
                      disabled={busy === s.id + 'adv'}
                      className={clsx(
                        'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
                        next === 'published'
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-brand-600 hover:bg-brand-700 text-white',
                        'disabled:opacity-60'
                      )}
                    >
                      {next === 'published' ? <Send size={13}/> : <CheckCircle2 size={13}/>}
                      {busy === s.id + 'adv' ? 'Saving…' : `Mark as ${next}`}
                    </button>
                  )}
                  {status === 'published' && (
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <Lock size={13}/> Published — locked
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!students.length && (
          <div className="text-center py-12 text-slate-400 text-sm">No students in this group yet.</div>
        )}
      </div>
    </div>
  );
}

function CommentField({ label, value, onSave, readOnly, busy }) {
  const [local, setLocal]   = useState(value);
  const [dirty, setDirty]   = useState(false);

  useEffect(() => { setLocal(value); setDirty(false); }, [value]);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <textarea
        value={local}
        readOnly={readOnly}
        rows={3}
        onChange={(e) => { setLocal(e.target.value); setDirty(true); }}
        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:opacity-60"
        placeholder={readOnly ? '—' : 'Write comment…'}
      />
      {dirty && !readOnly && (
        <button
          onClick={() => { onSave(local); setDirty(false); }}
          disabled={busy}
          className="mt-1 text-xs text-brand-600 hover:underline disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  );
}
