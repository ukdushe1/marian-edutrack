/** My exam tasks — papers to set, attendance to take, scripts to mark, comments to write. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDocs, getDoc, query, where, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ListTodo, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { examAssessmentRef } from '../../lib/termExam/model';
import { card, Note } from './ui';

export default function MyExamTasks() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid;
  const [tasks, setTasks] = useState(null);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const wins = (await getDocs(query(collection(db, 'examWindows'), where('published', '==', false))))
        .docs.map((d) => ({ id: d.id, ...d.data() })).filter((w) => w.approved);
      const myGroups = (await getDocs(query(collection(db, 'teachingGroups'), where('teacherIds', 'array-contains', uid))))
        .docs.map((d) => ({ id: d.id, ...d.data() }));
      const out = [];
      for (const w of wins) {
        const papers = (await getDocs(query(collection(db, 'examPapers'), where('windowId', '==', w.id)))).docs.map((d) => ({ id: d.id, ...d.data() }));
        const due = (k) => w.stageDue?.[k] ?? '';
        for (const p of papers) {
          if (p.setterId === uid && p.status === 'draft') out.push({ w, kind: 'Set paper', what: `${p.syllabusCode} ${p.paper} — build the question layout for vetting`, due: due('papers'), to: `/exams/term/${w.id}?tab=papers` });
          if ((p.invigilatorIds ?? []).includes(uid) && !p.attendanceSubmitted && w.timetablePublished) out.push({ w, kind: 'Invigilate', what: `${p.syllabusCode} ${p.paper} — ${p.date} ${p.start}, ${p.venue}: take attendance`, due: p.date ?? '', to: `/exams/term/${w.id}?tab=sitting` });
          if (!p.attendanceSubmitted) continue;
          for (const g of myGroups.filter((x) => x.syllabusId === p.syllabusId)) {
            const a = await getDoc(examAssessmentRef(g.id, p.id));
            const d = a.exists() ? a.data() : null;
            if (!d?.submitted && !d?.locked) out.push({ w, kind: d?.moderation === 'returned' ? 'Re-mark (returned)' : 'Mark scripts', what: `${p.syllabusCode} ${p.paper} · ${g.name}${d?.moderationNote ? ` — HOD: “${d.moderationNote}”` : ''}`, due: due('marking'), to: `/exams/term/${w.id}/mark/${p.id}/${g.id}` });
          }
        }
        if (w.resultsChecked && w.termId && myGroups.length) {
          const reps = (await getDocs(query(collection(db, 'reports'), where('termId', '==', w.termId)))).docs.map((d) => d.data());
          for (const g of myGroups) {
            const missing = (g.studentIds ?? []).filter((sid) => { const r = reps.find((x) => x.groupId === g.id && x.studentId === sid); return !r?.subjectComment?.trim() || !r?.effort; }).length;
            if (missing) out.push({ w, kind: 'Write comments', what: `${g.name}: ${missing} subject comments or effort grades to do`, due: due('comments'), to: '/reports' });
          }
        }
      }
      setTasks(out.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')));
    })().catch(() => setTasks([]));
  }, [uid]);

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><ListTodo size={20} /> My exam tasks</h1>
      {tasks === null && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Checking your tasks…</p>}
      {tasks?.length === 0 && <Note tone="ok">Nothing waiting for you right now.</Note>}
      {tasks?.length > 0 && (
        <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700`}>
          {tasks.map((t, i) => (
            <Link key={i} to={t.to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 w-32 shrink-0">{t.kind}</span>
              <span className="flex-1 text-sm">{t.what}<span className="block text-xs text-slate-400">{t.w.name}</span></span>
              {t.due && <span className={`text-xs whitespace-nowrap ${t.due < today ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{t.due < today ? 'Late · ' : 'Due '}{t.due}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
