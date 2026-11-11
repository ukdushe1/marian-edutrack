/**
 * Drop-down of preset comments, filtered by category and subject.
 * Picking one adds it to the comment box; teachers can still type freely.
 */
import { useState } from 'react';
import { CATEGORIES, fillComment } from '../lib/commentBank';

export default function CommentPicker({ comments, subject, student, onPick, disabled }) {
  const [category, setCategory] = useState('');
  // This subject's comments plus general ones ('' = any subject)
  const pool = comments.filter((c) => (c.subject ?? '') === '' || c.subject === subject);
  const options = pool.filter((c) => !category || c.category === category);
  if (!pool.length) return null;

  const sel = 'text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="flex flex-wrap gap-1.5 mb-1.5">
      <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={disabled} className={sel} aria-label="Comment category">
        <option value="">All categories</option>
        {CATEGORIES.filter((c) => pool.some((p) => p.category === c.key)).map((c) => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>
      <select value="" disabled={disabled} className={`${sel} flex-1 min-w-[12rem]`} aria-label="Insert a preset comment"
        onChange={(e) => {
          const c = pool.find((x) => x.id === e.target.value);
          if (c) onPick(fillComment(c.text, student), c);
        }}>
        <option value="">Insert a preset comment…</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>{fillComment(c.text, student)}</option>
        ))}
      </select>
    </div>
  );
}
