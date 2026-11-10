/**
 * Notice board — Phase 3.
 * Staff circulars and meeting notices with read receipts.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { col, addDoc, query, orderBy, onSnapshot, now, updateDoc, ref } from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc, arrayUnion } from 'firebase/firestore';
import { Bell, Plus, CheckCircle2, X, Paperclip } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const noticesCol = () => col('notices');

export default function NoticeBoardPage() {
  const { firebaseUser, profile, hasRole } = useAuth();
  const [notices,  setNotices]  = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(noticesCol(), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) =>
      setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  async function markRead(noticeId) {
    try {
      await updateDoc(doc(db, 'notices', noticeId), {
        readBy: arrayUnion(firebaseUser.uid),
      });
    } catch { toast.error('Could not mark as read.'); }
  }

  const canPost = hasRole('head', 'superAdmin', 'hod');

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center gap-2"><Bell size={20}/> Notice board</h1>
        {canPost && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15}/> Post notice
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notices.map((n) => {
          const hasRead = (n.readBy ?? []).includes(firebaseUser.uid);
          const readCount = (n.readBy ?? []).length;
          const timeAgo = n.createdAt?.toDate
            ? formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true })
            : 'recently';

          return (
            <div key={n.id}
              className={clsx('bg-white dark:bg-slate-800 rounded-xl border p-4 transition-opacity',
                hasRead ? 'border-slate-200 dark:border-slate-700 opacity-70' : 'border-brand-300 dark:border-brand-700')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!hasRead && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0 mt-0.5"/>}
                    <h3 className="font-semibold text-sm">{n.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{n.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{n.authorName ?? 'Staff'} · {timeAgo}</span>
                    <span className="flex items-center gap-1"><CheckCircle2 size={11}/> {readCount} read</span>
                  </div>
                </div>
                {!hasRead && (
                  <button onClick={() => markRead(n.id)}
                    className="shrink-0 text-xs font-medium text-brand-600 hover:underline whitespace-nowrap">
                    Mark read
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!notices.length && (
          <div className="text-center py-14 text-slate-400 text-sm">
            <Bell size={28} className="mx-auto mb-2 opacity-30"/>
            No notices yet. {canPost ? 'Post the first one above.' : ''}
          </div>
        )}
      </div>

      {showForm && (
        <NoticeForm
          uid={firebaseUser.uid}
          authorName={profile?.name ?? 'Staff'}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function NoticeForm({ uid, authorName, onClose }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await addDoc(noticesCol(), {
        ...form,
        authorId: uid, authorName,
        readBy: [uid],
        createdAt: now(),
      });
      toast.success('Notice posted.');
      onClose();
    } catch { toast.error('Post failed.'); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Post notice</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Staff meeting Thursday" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Body</label>
            <textarea required rows={4} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Notice details…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Audience</label>
            <select value={form.audience} onChange={(e) => setForm((p) => ({ ...p, audience: e.target.value }))}
              className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="all">All staff</option>
              <option value="teachers">Teachers only</option>
              <option value="hods">HODs only</option>
            </select>
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Posting…' : 'Post notice'}
          </button>
        </form>
      </div>
    </div>
  );
}
