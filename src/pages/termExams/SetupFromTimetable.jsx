/**
 * Set up an exam window from a printed school timetable: creates the window and
 * one draft paper per session per subject, for exactly the classes that sit it.
 * Review first; re-running updates dates/times/invigilators and never resets a
 * paper's questions, setter or vetting.
 */
import { useState } from 'react';
import { collection, getDoc, getDocs, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CalendarRange, Loader2, X, AlertTriangle } from 'lucide-react';
import { db } from '../../firebase/config';
import { windowRef, paperRef, DEFAULT_BANDS, DEFAULT_QUESTIONS } from '../../lib/termExam/model';
import { planTimetableImport, staffBySurname, staffAccounts, recoverInvigilatorLinks } from '../../lib/termExam/timetableImport';
import { SESSIONS, TIMETABLE_ID, TIMETABLE_NAME } from '../../lib/examTimetable/endOfYear2026';
import { card, btn, btnGhost, Note } from './ui';

const all = async (name) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));

export default function SetupFromTimetable() {
  const nav = useNavigate();
  const [state, setState] = useState(null); // { classes, groups, users, term, existing, existingPapers, picks }
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const [classes, groups, users, terms, win, papers] = await Promise.all([
        all('classes'), all('teachingGroups'), all('users'), all('terms'),
        getDoc(windowRef(TIMETABLE_ID)),
        getDocs(query(collection(db, 'examPapers'), where('windowId', '==', TIMETABLE_ID))),
      ]);
      const term = terms.find((t) => t.isCurrent) ?? terms.sort((a, b) => (b.year - a.year) || (b.term - a.term))[0] ?? null;
      const existing = win.exists() ? win.data() : null;
      const paperData = papers.docs.map((d) => d.data());
      // Start from the picks saved last time, so "Which Ushe?" is not asked again
      const picks = recoverInvigilatorLinks({ sessions: SESSIONS, papers: paperData, users, saved: existing?.invigilatorLinks ?? {} });
      setState({ classes, groups, users, term, existing,
        existingPapers: new Map(papers.docs.map((d) => [d.id, d.data()])), picks });
    } catch (e) { toast.error(`Could not load the school setup: ${e.code ?? e.message}`); }
    setLoading(false);
  }

  const plan = state && planTimetableImport({ windowId: TIMETABLE_ID, sessions: SESSIONS, classes: state.classes, groups: state.groups, users: state.users });
  // Invigilator surname → account, with the officer's picks for unmatched / ambiguous names
  const chosen = plan ? Object.fromEntries(Object.entries(plan.invigilators).map(([n, id]) => [n, state.picks[n] ?? id])) : {};
  const staff = state ? staffAccounts(state.users).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')) : [];
  const staffLabel = (u) => u.name || u.email || u.id;
  const className = (id) => state?.classes.find((c) => c.id === id)?.name ?? id;

  async function create() {
    if (!state.term) { toast.error('There is no current term. Re-import the school setup first (Imports page).'); return; }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      const dates = SESSIONS.map((s) => s.date).sort();
      // Remember every pick (surname → account) with the window for next time
      const links = Object.fromEntries(Object.entries(chosen).filter(([, id]) => id));
      if (state.existing) {
        batch.set(windowRef(TIMETABLE_ID), { forms: plan.classIds, startDate: dates[0], endDate: dates.at(-1), invigilatorLinks: links, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        batch.set(windowRef(TIMETABLE_ID), {
          name: TIMETABLE_NAME, termId: state.term.id, startDate: dates[0], endDate: dates.at(-1), forms: plan.classIds,
          defaultSplit: { exam: 70, coursework: 30 }, subjects: {}, gradeBands: DEFAULT_BANDS, minSubjects: 5, minSubjectsALevel: 3,
          courseworkFrom: '', nextTermOpens: '', stageDue: {},
          approved: false, timetablePublished: false, resultsChecked: false, published: false, version: 0,
          invigilatorLinks: links, createdAt: serverTimestamp(),
        });
      }
      for (const p of plan.papers) {
        const names = SESSIONS.find((s) => s.id === p.data.importKey)?.invigilatorNames ?? [];
        const schedule = {
          ...p.data,
          invigilatorIds: [...new Set(names.map((n) => chosen[n]).filter(Boolean))],
          invigilatorNames: names.filter((n) => !chosen[n]),
          updatedAt: serverTimestamp(),
        };
        // Default paper: Q1 out of 100 — kept unless the setter builds the real layout
        const existing = state.existingPapers.get(p.id);
        const needsDefault = existing && !existing.questions?.length;
        batch.set(paperRef(p.id), existing ? { ...schedule, ...(needsDefault ? { questions: DEFAULT_QUESTIONS, maxMark: 100 } : {}) } : {
          ...schedule, venue: '', status: 'draft', setterId: '', questions: DEFAULT_QUESTIONS, maxMark: 100,
          attendanceSubmitted: false, createdAt: serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
      toast.success(`${plan.papers.length} papers set up.`);
      nav(`/exams/term/${TIMETABLE_ID}`);
    } catch (e) { toast.error(`Not saved: ${e.code ?? e.message}`); setBusy(false); }
  }

  const unresolved = plan ? Object.keys(plan.invigilators).filter((n) => !chosen[n]) : [];

  return (
    <>
      <div className={`${card} p-4 flex flex-wrap items-center gap-3`}>
        <CalendarRange size={18} className="text-brand-600" />
        <div className="flex-1 min-w-[14rem]">
          <p className="font-semibold text-sm">{TIMETABLE_NAME}</p>
          <p className="text-xs text-slate-500">Set up the window and its papers from the printed timetable (16–20 Nov, {SESSIONS.length} sessions).</p>
        </div>
        <button className={btn} onClick={open} disabled={loading}>{loading ? <Loader2 size={14} className="animate-spin" /> : null} Review set-up</button>
      </div>

      {state && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4 space-y-4 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{TIMETABLE_NAME}</h2>
                <p className="text-xs text-slate-500">{state.existing ? 'Already set up: this updates dates, times, classes and invigilators. Questions, setters and vetting are kept.' : 'Nothing is saved until you confirm.'}</p>
              </div>
              <button onClick={() => setState(null)} className="p-1"><X size={16} /></button>
            </div>

            {!state.term && <Note tone="warn">No current term found. Re-import the school setup on the Imports page first; it adds Term 3 2026.</Note>}
            <div className="text-sm space-y-1">
              <p><strong>Term:</strong> {state.term?.name ?? '—'} · <strong>Dates:</strong> 16–20 Nov 2026</p>
              <p><strong>Classes ({plan.classIds.length}):</strong> {plan.classIds.map(className).join(', ') || '—'}</p>
              <p><strong>Papers:</strong> {plan.papers.length}{state.existing ? ` (${plan.papers.filter((p) => state.existingPapers.has(p.id)).length} already exist)` : ''} · each starts as <strong>Q1 out of 100</strong> until its setter builds the paper
                {(() => { const n = plan.papers.filter((p) => state.existingPapers.has(p.id) && !state.existingPapers.get(p.id).questions?.length).length; return n ? ` · ${n} without questions will get the default` : ''; })()}</p>
            </div>

            {plan.skipped.length > 0 && (
              <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> Not set up ({plan.skipped.length})</p>
                <ul className="list-disc pl-5 text-xs mt-1">{plan.skipped.map(({ row, reason }) => <li key={row.id}>{row.date} {row.slot}: {row.form} {row.subject} {row.paper} — {reason}. Add that subject to the class (Classes page), then run this again.</li>)}</ul>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Invigilators</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {Object.keys(plan.invigilators).sort().map((n) => {
                  const hits = staffBySurname(n, state.users);
                  return (
                    <label key={n} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0">{n}</span>
                      <select className={`flex-1 text-xs border rounded px-1.5 py-1 dark:bg-slate-900 dark:border-slate-600 ${chosen[n] ? '' : 'border-amber-400'}`}
                        value={chosen[n] ?? ''} onChange={(e) => setState((s) => ({ ...s, picks: { ...s.picks, [n]: e.target.value || null } }))}>
                        <option value="">{hits.length > 1 ? `Which ${n}? (${hits.length} staff)` : 'No account — name shown only'}</option>
                        {staff.map((u) => <option key={u.id} value={u.id}>{staffLabel(u)}</option>)}
                      </select>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Only teaching staff and the exams officer are listed. Someone missing? Give them a teaching role (e.g. Teacher) in Users, then open this again.</p>
              {unresolved.length > 0 && <p className="text-xs text-slate-500 mt-1.5">{unresolved.length} name{unresolved.length > 1 ? 's are' : ' is'} not linked to a staff account. They still show on the timetable, but won’t get invigilation tasks until linked (run this again after adding them in Users).</p>}
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-slate-500">All {plan.papers.length} papers</summary>
              <table className="mt-2 min-w-full">
                <tbody>
                  {plan.papers.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-1 pr-2 whitespace-nowrap">{p.data.date.slice(5)} {p.data.start}</td>
                      <td className="pr-2 whitespace-nowrap">{p.data.syllabusCode} {p.data.paper}</td>
                      <td className="pr-2">{p.data.classIds.map(className).join(', ')}</td>
                      <td className="text-slate-400">{p.data.duration ? `${p.data.duration} min` : 'duration TBC'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            <div className="flex gap-2">
              <button className={btn} onClick={create} disabled={busy || !state.term || !plan.papers.length}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}{state.existing ? 'Update window and papers' : `Create window and ${plan.papers.length} papers`}
              </button>
              <button className={btnGhost} onClick={() => setState(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
