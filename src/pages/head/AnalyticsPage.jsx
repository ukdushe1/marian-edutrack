/**
 * School analytics (Principal / VP / admin) — built from the published results
 * snapshots of an end-of-term exam window, compared with the previous one.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BarChart2, Loader2 } from 'lucide-react';

// Ordinal grades → one hue, dark (best) to light; U neutral gray
const GRADE_SHADE = ['#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd', '#dbeafe', '#cbd5e1', '#e2e8f0'];
const card = 'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700';
const pct = (v) => (v == null ? '—' : `${Math.round(v * 10) / 10}%`);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function summarise(snaps, win) {
  const bands = [...(win?.gradeBands ?? [])].sort((a, b) => b.min - a.min);
  const passMin = bands.find((b) => b.grade === 'C')?.min ?? 50;
  const grades = bands.length ? bands.map((b) => b.grade) : ['A', 'B', 'C', 'D', 'E', 'U'];
  const subjects = {};
  for (const s of snaps) for (const x of s.subjects ?? []) {
    const o = (subjects[x.code] ??= { code: x.code, name: x.name, finals: [], grades: {}, forms: {} });
    if (x.finalPct != null) { o.finals.push(x.finalPct); (o.forms[s.formName] ??= []).push(x.finalPct); }
    o.grades[x.grade] = (o.grades[x.grade] ?? 0) + 1;
  }
  const rows = Object.values(subjects).map((o) => ({
    ...o, mean: mean(o.finals), entries: o.finals.length,
    pass: o.finals.length ? (o.finals.filter((v) => v >= passMin).length / o.finals.length) * 100 : null,
  })).sort((a, b) => a.code.localeCompare(b.code));
  const overall = snaps.map((s) => s.overallAvg).filter((v) => v != null);
  const att = snaps.map((s) => s.attendance?.pct).filter((v) => v != null);
  const atRisk = snaps.filter((s) => (s.overallAvg != null && s.overallAvg < passMin)
    || (s.subjects ?? []).filter((x) => x.finalPct != null && x.finalPct < passMin).length >= 2);
  const forms = {};
  snaps.forEach((s) => { if (s.overallAvg != null) (forms[s.formName] ??= []).push(s.overallAvg); });
  return {
    passMin, grades, rows, students: snaps.length, overallMean: mean(overall),
    passRate: overall.length ? (overall.filter((v) => v >= passMin).length / overall.length) * 100 : null,
    attendance: mean(att), lowAttendance: att.filter((v) => v < 80).length, atRisk,
    top: [...snaps].filter((s) => s.overallPos).sort((a, b) => a.overallPos - b.overallPos || (b.overallAvg ?? 0) - (a.overallAvg ?? 0)).slice(0, 10),
    forms: Object.entries(forms).map(([name, v]) => ({ name, mean: mean(v), n: v.length })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function Tile({ label, value, note }) {
  return (
    <div className={`${card} px-4 py-3`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

function Change({ now, before }) {
  if (now == null || before == null) return <span className="text-slate-400">—</span>;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <span className="text-slate-500">0.0</span>;
  return <span className={d > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>;
}

export default function AnalyticsPage() {
  const [windows, setWindows] = useState(null);
  const [winId, setWinId] = useState('');
  const [snaps, setSnaps] = useState({}); // windowId → snapshots

  useEffect(() => {
    getDocs(query(collection(db, 'examWindows'), where('published', '==', true))).then((s) => {
      const w = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));
      setWindows(w); if (w[0]) setWinId(w[0].id);
    }).catch(() => setWindows([]));
  }, []);

  const win = windows?.find((w) => w.id === winId);
  const prev = windows?.[windows.findIndex((w) => w.id === winId) + 1];

  useEffect(() => {
    [win, prev].filter(Boolean).forEach((w) => {
      if (snaps[w.id]) return;
      getDocs(query(collection(db, 'resultSnapshots'), where('windowId', '==', w.id)))
        .then((s) => setSnaps((p) => ({ ...p, [w.id]: s.docs.map((d) => d.data()) })));
    });
  }, [win, prev, snaps]);

  const now = useMemo(() => (win && snaps[win.id] ? summarise(snaps[win.id], win) : null), [win, snaps]);
  const then = useMemo(() => (prev && snaps[prev.id] ? summarise(snaps[prev.id], prev) : null), [prev, snaps]);

  if (windows === null) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</p>;
  if (!windows.length) return (
    <div className="max-w-2xl space-y-2">
      <h1 className="text-xl font-bold flex items-center gap-2"><BarChart2 size={20} /> School analytics</h1>
      <p className="text-sm text-slate-500">Analytics appear once an end-of-term exam window is published. <Link to="/exams/term" className="text-brand-600 underline">Go to End of term</Link></p>
    </div>
  );

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><BarChart2 size={20} /> School analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Published results{prev ? `, compared with ${prev.name}` : ''}. Pass = {now?.passMin ?? 50}% or above.</p>
        </div>
        <select className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={winId} onChange={(e) => setWinId(e.target.value)}>
          {windows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {!now ? <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading results…</p> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Tile label="Students" value={now.students} />
            <Tile label="Average result" value={pct(now.overallMean)} note={then ? <>vs last: <Change now={now.overallMean} before={then.overallMean} /></> : null} />
            <Tile label="Pass rate (overall)" value={pct(now.passRate)} note={then ? <>vs last: <Change now={now.passRate} before={then.passRate} /></> : null} />
            <Tile label="Attendance" value={pct(now.attendance)} note={`${now.lowAttendance} below 80%`} />
            <Tile label="At risk" value={now.atRisk.length} note="below pass overall, or in 2+ subjects" />
          </div>

          <section className={`${card} overflow-x-auto`}>
            <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-sm">Results by subject</h2>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500" aria-label="Grade legend">
                {now.grades.map((g, i) => <span key={g} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: GRADE_SHADE[Math.min(i, GRADE_SHADE.length - 1)] }} />{g}</span>)}
              </div>
            </div>
            <table className="text-sm min-w-full mt-2">
              <thead><tr className="text-xs text-slate-500 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-2">Subject</th><th className="text-right px-2">Entries</th><th className="text-right px-2">Average</th>
                <th className="text-right px-2">Change</th><th className="text-right px-2">Pass rate</th><th className="px-4 w-[36%]">Grade distribution</th>
              </tr></thead>
              <tbody>
                {now.rows.map((r) => {
                  const total = Object.values(r.grades).reduce((a, b) => a + b, 0) || 1;
                  const before = then?.rows.find((x) => x.code === r.code);
                  return (
                    <tr key={r.code} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="px-4 py-2">{r.code} <span className="text-slate-400">{r.name}</span></td>
                      <td className="text-right px-2 tabular-nums">{r.entries}</td>
                      <td className="text-right px-2 tabular-nums font-medium">{pct(r.mean)}</td>
                      <td className="text-right px-2 tabular-nums text-xs"><Change now={r.mean} before={before?.mean} /></td>
                      <td className="text-right px-2 tabular-nums">{pct(r.pass)}</td>
                      <td className="px-4">
                        <div className="flex h-3.5 rounded overflow-hidden gap-[2px]" role="img"
                          aria-label={now.grades.map((g) => `${g}: ${r.grades[g] ?? 0}`).join(', ')}>
                          {now.grades.map((g, i) => (r.grades[g] ? (
                            <div key={g} title={`${g}: ${r.grades[g]} student${r.grades[g] > 1 ? 's' : ''}`}
                              style={{ width: `${(r.grades[g] / total) * 100}%`, background: GRADE_SHADE[Math.min(i, GRADE_SHADE.length - 1)] }} />
                          ) : null))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 py-2 text-[11px] text-slate-400">Hover a bar segment for the number of students. X (valid absence) is left out of averages.</p>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <section className={`${card} p-4`}>
              <h2 className="font-semibold text-sm mb-2">Top 10 overall</h2>
              <ol className="text-sm space-y-1">
                {now.top.map((s) => (
                  <li key={s.studentId} className="flex justify-between gap-2">
                    <span><span className="text-slate-400 tabular-nums w-6 inline-block">{s.overallPos}.</span>{s.student?.surname}, {s.student?.firstName} <span className="text-xs text-slate-400">{s.formName}</span></span>
                    <span className="tabular-nums">{pct(s.overallAvg)}</span>
                  </li>
                ))}
                {!now.top.length && <li className="text-slate-400">No ranked students.</li>}
              </ol>
            </section>
            <section className={`${card} p-4`}>
              <h2 className="font-semibold text-sm mb-2">At risk ({now.atRisk.length})</h2>
              <ul className="text-sm space-y-1 max-h-72 overflow-y-auto">
                {now.atRisk.map((s) => (
                  <li key={s.studentId} className="flex justify-between gap-2">
                    <span>{s.student?.surname}, {s.student?.firstName} <span className="text-xs text-slate-400">{s.formName}</span></span>
                    <span className="text-xs text-slate-500">{pct(s.overallAvg)} · {(s.subjects ?? []).filter((x) => x.finalPct != null && x.finalPct < now.passMin).length} below pass</span>
                  </li>
                ))}
                {!now.atRisk.length && <li className="text-slate-400">No students at risk.</li>}
              </ul>
            </section>
          </div>

          {now.forms.length > 1 && (
            <section className={`${card} p-4`}>
              <h2 className="font-semibold text-sm mb-2">Average by form</h2>
              <table className="text-sm">
                <tbody>{now.forms.map((f) => <tr key={f.name}><td className="pr-6 py-0.5">{f.name}</td><td className="tabular-nums pr-6">{pct(f.mean)}</td><td className="text-xs text-slate-400">{f.n} students</td></tr>)}</tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
