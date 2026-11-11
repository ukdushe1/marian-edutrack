/**
 * Stage 3 — timetable, rooms, seating and a fair invigilator roster.
 * Publishing also writes each session to the main Exam Timetable page.
 */
import { useMemo, useState } from 'react';
import { updateDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { AlertTriangle, Shuffle, Send, Armchair, X } from 'lucide-react';
import clsx from 'clsx';
import { paperRef, windowRef } from '../../lib/termExam/model';
import { TEACHING_ROLES } from '../../lib/roles';
import { card, btn, btnGhost, Note, useExamRoles, userName, studentName } from './ui';

const mins = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
const overlaps = (a, b) => a.date && a.date === b.date && a.start && b.start
  && mins(a.start) < mins(b.start) + Number(b.duration || 0) && mins(b.start) < mins(a.start) + Number(a.duration || 0);

/** Candidates for a paper: students in the window taught the subject. */
export function candidatesFor(data, paper) {
  const ids = new Set(data.groups.filter((g) => g.syllabusId === paper.syllabusId).flatMap((g) => g.studentIds ?? []));
  return data.students.filter((s) => ids.has(s.id)).sort((a, b) => String(a.candidateNumber ?? a.surname).localeCompare(String(b.candidateNumber ?? b.surname)));
}

export default function TimetablePanel({ data }) {
  const roles = useExamRoles();
  const { win, papers, users } = data;
  const [seating, setSeating] = useState(null);
  const editable = roles.canManage && !win.published;

  const clashes = useMemo(() => {
    const out = [];
    for (let i = 0; i < papers.length; i++) for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i], b = papers[j];
      if (!overlaps(a, b)) continue;
      const ca = new Set(candidatesFor(data, a).map((s) => s.id));
      const both = candidatesFor(data, b).filter((s) => ca.has(s.id)).length;
      if (both) out.push(`${a.syllabusCode} ${a.paper} and ${b.syllabusCode} ${b.paper}: ${both} students sit both`);
      if (a.venue && a.venue === b.venue) out.push(`${a.venue} is double-booked (${a.syllabusCode} ${a.paper} / ${b.syllabusCode} ${b.paper})`);
      const inv = (a.invigilatorIds ?? []).filter((x) => (b.invigilatorIds ?? []).includes(x));
      inv.forEach((u) => out.push(`${userName(users, u)} invigilates two papers at once`));
    }
    return out;
  }, [papers, data, users]);

  async function setField(p, patch) {
    try { await updateDoc(paperRef(p.id), { ...patch, updatedAt: serverTimestamp() }); }
    catch { toast.error('Save failed.'); }
  }

  /** Fair roster: 1 invigilator per 30 candidates; least-loaded first; never the subject's own teachers; never double-booked. */
  async function autoAssign() {
    const staff = users.filter((u) => (u.roles ?? []).some((r) => TEACHING_ROLES.includes(r)));
    if (!staff.length) { toast.error('No teaching staff found.'); return; }
    const load = Object.fromEntries(staff.map((u) => [u.id, 0]));
    const planned = {};
    const sorted = [...papers].filter((p) => p.date && p.start).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    for (const p of sorted) {
      const need = Math.max(1, Math.ceil(candidatesFor(data, p).length / 30));
      const own = new Set(data.groups.filter((g) => g.syllabusId === p.syllabusId).flatMap((g) => g.teacherIds ?? []));
      const busy = new Set(sorted.filter((q) => q.id !== p.id && overlaps(p, q)).flatMap((q) => planned[q.id] ?? []));
      const pick = staff.filter((u) => !own.has(u.id) && !busy.has(u.id))
        .sort((a, b) => load[a.id] - load[b.id] || (a.name ?? '').localeCompare(b.name ?? '')).slice(0, need).map((u) => u.id);
      pick.forEach((id) => { load[id]++; });
      planned[p.id] = pick;
    }
    await Promise.all(Object.entries(planned).map(([id, invigilatorIds]) => updateDoc(paperRef(id), { invigilatorIds })));
    toast.success('Invigilators assigned. Unscheduled papers were skipped.');
  }

  async function publish(v) {
    if (v && papers.some((p) => !p.date || !p.start || !p.venue)) { toast.error('Every paper needs a date, start time and room first.'); return; }
    if (v && clashes.length) { toast.error('Resolve the clashes first.'); return; }
    try {
      if (v) {
        await Promise.all(papers.map((p) => setDoc(doc(db, 'examSessions', `term_${p.id}`), {
          syllabusId: p.syllabusId, paper: p.paper, date: p.date, start: p.start, duration: Number(p.duration),
          venue: p.venue, seats: Number(p.seats || candidatesFor(data, p).length), invigilatorIds: p.invigilatorIds ?? [],
          windowId: win.id, examPaperId: p.id, updatedAt: serverTimestamp(),
        })));
      }
      await updateDoc(windowRef(win.id), { timetablePublished: v });
      toast.success(v ? 'Timetable published to staff (also on Exams → Timetable).' : 'Timetable unpublished.');
    } catch { toast.error('Publish failed.'); }
  }

  if (!papers.length) return <Note tone="warn">Add papers first (stage 2).</Note>;

  return (
    <div className="space-y-3">
      {win.timetablePublished ? <Note tone="ok">Published to staff.</Note> : <Note>Sign-off: publish the timetable once every paper has a date, time and room, with no clashes.</Note>}
      {clashes.length > 0 && (
        <div className="text-sm border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl px-4 py-3">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> {clashes.length} clash{clashes.length > 1 ? 'es' : ''}</p>
          <ul className="list-disc pl-5 text-xs mt-1">{clashes.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      <div className={`${card} overflow-x-auto`}>
        <table className="text-sm min-w-full">
          <thead><tr className="text-xs text-slate-500 text-left border-b border-slate-200 dark:border-slate-700">
            <th className="px-3 py-2">Paper</th><th>Date</th><th>Start</th><th>Min</th><th>Room</th><th>Candidates</th><th>Invigilators</th><th />
          </tr></thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-700/50">
                <td className="px-3 py-1.5 whitespace-nowrap">{p.syllabusCode} {p.paper}</td>
                <td><input type="date" disabled={!editable} className="text-xs border rounded px-1 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={p.date ?? ''} onChange={(e) => setField(p, { date: e.target.value })} /></td>
                <td><input type="time" disabled={!editable} className="text-xs border rounded px-1 py-0.5 dark:bg-slate-900 dark:border-slate-600" value={p.start ?? ''} onChange={(e) => setField(p, { start: e.target.value })} /></td>
                <td className="text-xs">{p.duration}</td>
                <td><input disabled={!editable} className="w-28 text-xs border rounded px-1 py-0.5 dark:bg-slate-900 dark:border-slate-600" defaultValue={p.venue ?? ''} onBlur={(e) => e.target.value !== (p.venue ?? '') && setField(p, { venue: e.target.value.trim() })} placeholder="e.g. Main Hall" /></td>
                <td className="text-xs text-center">{candidatesFor(data, p).length}</td>
                <td className="text-xs">{(p.invigilatorIds ?? []).map((u) => userName(users, u)).join(', ') || <span className="text-slate-400">—</span>}</td>
                <td><button className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1" onClick={() => setSeating(p)}><Armchair size={12} /> Seating</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <button className={btnGhost} onClick={autoAssign}><Shuffle size={13} /> Assign invigilators fairly</button>
          {win.timetablePublished
            ? <button className={btnGhost} onClick={() => publish(false)}>Unpublish</button>
            : <button className={btn} onClick={() => publish(true)}><Send size={13} /> Publish timetable</button>}
        </div>
      )}
      <p className="text-[11px] text-slate-400">Fair roster: one invigilator per 30 candidates, spread by lowest load, never a teacher of that subject, never two rooms at once.</p>
      {seating && <SeatingPlan data={data} paper={seating} onClose={() => setSeating(null)} />}
    </div>
  );
}

function SeatingPlan({ data, paper, onClose }) {
  const cands = candidatesFor(data, paper);
  const cols = 6;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4 print:shadow-none print:rounded-none max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain print:max-h-none print:overflow-visible">
        <div className="flex items-start justify-between print:hidden">
          <h2 className="font-semibold">Seating plan</h2>
          <div className="flex gap-2"><button className={btnGhost} onClick={() => window.print()}>Print</button><button onClick={onClose} className="p-1"><X size={16} /></button></div>
        </div>
        <p className="text-sm mt-1"><strong>{paper.syllabusCode} {paper.paper}</strong> · {paper.date} {paper.start} · {paper.venue || 'Room not set'} · {cands.length} candidates · front of room at top</p>
        <div className="grid gap-1.5 mt-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {cands.map((s, i) => (
            <div key={s.id} className={clsx('border rounded-lg px-1.5 py-1 text-[11px] leading-tight', 'border-slate-300 dark:border-slate-600')}>
              <span className="text-slate-400">{String.fromCharCode(65 + (i % cols))}{Math.floor(i / cols) + 1}</span>
              <p className="font-medium truncate">{studentName(s)}</p>
              <p className="text-slate-400 truncate">{s.candidateNumber}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
