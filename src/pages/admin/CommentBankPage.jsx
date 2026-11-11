/**
 * Comment bank — Principal, Vice Principal and HODs add, edit and deactivate
 * preset report comments. HODs manage general comments and their own subjects.
 * Teachers pick these from a drop-down on the Reports page.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { addDoc, updateDoc, onSnapshot, getDocs, syllabiCol, now, ref } from '../../firebase/firestore';
import { MessageSquareText, Plus, X, Pencil } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CATEGORIES, CATEGORY_LABEL, commentBankCol, fillComment } from '../../lib/commentBank';

export default function CommentBankPage() {
  const { hasRole, profile } = useAuth();
  const isSenior = hasRole('vicePrincipal', 'superAdmin');
  const mySubjects = hasRole('hod') ? (profile?.hodSubjects ?? []) : [];
  const canManage = isSenior || hasRole('hod');
  const canEdit = (c) => isSenior || (hasRole('hod') && ((c.subject ?? '') === '' || mySubjects.includes(c.subject)));

  const [comments, setComments] = useState([]);
  const [codes,    setCodes]    = useState([]);
  const [subject,  setSubject]  = useState('all');
  const [showOff,  setShowOff]  = useState(false);
  const [editing,  setEditing]  = useState(undefined); // undefined closed, null new

  useEffect(() => {
    getDocs(syllabiCol()).then((s) => setCodes([...new Set(s.docs.map((d) => d.data().code).filter(Boolean))].sort()));
    return onSnapshot(commentBankCol(), (s) => setComments(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  const visible = comments
    .filter((c) => showOff || c.active !== false)
    .filter((c) => subject === 'all' || (c.subject ?? '') === subject);

  async function toggleActive(c) {
    try {
      await updateDoc(ref('commentBank', c.id), { active: c.active === false, updatedAt: now() });
      toast.success(c.active === false ? 'Comment reactivated.' : 'Comment deactivated.');
    } catch { toast.error('Update failed.'); }
  }

  const sample = { firstName: 'Tendai' };

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><MessageSquareText size={20} /> Comment bank</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Preset report comments teachers pick from a drop-down. Use <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{name}'}</code> for the student’s first name.
          </p>
        </div>
        {canManage && (
          <button onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15} /> Add comment
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={subject} onChange={(e) => setSubject(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800">
          <option value="all">All subjects</option>
          <option value="">General (any subject)</option>
          {codes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} className="accent-brand-600" />
          Show deactivated
        </label>
      </div>

      {CATEGORIES.map((cat) => {
        const list = visible.filter((c) => c.category === cat.key);
        if (!list.length) return null;
        return (
          <section key={cat.key} className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cat.label} ({list.length})</h2>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((c) => (
                <div key={c.id} className={clsx('flex items-start gap-3 px-4 py-2.5', c.active === false && 'opacity-50')}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{fillComment(c.text, sample)}</p>
                    <p className="text-[11px] text-slate-400">{c.subject ? `Subject ${c.subject}` : 'General'}{c.active === false && ' · deactivated'}</p>
                  </div>
                  {canEdit(c) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleActive(c)} className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-700">
                        {c.active === false ? 'Reactivate' : 'Deactivate'}
                      </button>
                      <button onClick={() => setEditing(c)} aria-label="Edit comment" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400">
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!visible.length && (
        <div className="text-center py-12 text-slate-400 text-sm">
          {comments.length ? 'No comments match.' : 'No preset comments yet.'}
        </div>
      )}

      {editing !== undefined && (
        <CommentForm comment={editing} codes={isSenior ? codes : mySubjects} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}

function CommentForm({ comment, codes, onClose }) {
  const { firebaseUser } = useAuth();
  const [text,     setText]     = useState(comment?.text ?? '');
  const [category, setCategory] = useState(comment?.category ?? 'good');
  const [subject,  setSubject]  = useState(comment?.subject ?? '');
  const [busy,     setBusy]     = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const data = { text: text.trim(), category, subject, updatedAt: now() };
    try {
      if (comment) await updateDoc(ref('commentBank', comment.id), data);
      else await addDoc(commentBankCol(), { ...data, active: true, createdBy: firebaseUser.uid, createdAt: now() });
      toast.success(comment ? 'Comment updated.' : 'Comment added.');
      onClose();
    } catch {
      toast.error('Save failed — HODs can only manage general comments and their own subjects.');
      setBusy(false);
    }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{comment ? 'Edit comment' : 'Add comment'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Comment</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} required autoFocus
              placeholder="{name} has worked consistently this term." className={`${inp} resize-none`} />
            <p className="text-[11px] text-slate-400 mt-0.5">Preview: {fillComment(text, { firstName: 'Tendai' }) || '—'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{CATEGORY_LABEL[c.key]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inp}>
                <option value="">General (any subject)</option>
                {codes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Save comment'}
          </button>
        </form>
      </div>
    </div>
  );
}
