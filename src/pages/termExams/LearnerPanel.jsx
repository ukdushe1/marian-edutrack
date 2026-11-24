/**
 * Learner analysis (System Admin and the Principal): one learner's End of Term
 * results against their class — marks, grades, class averages, positions, a chart
 * and a short written analysis. Printable.
 */
import { useMemo, useState } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { formResults } from '../../lib/termExam/compute';
import { bandsFor } from '../../lib/termExam/model';
import { learnerAnalysis, explainLearner } from '../../lib/termExam/classAnalysis';
import { fmtPct } from '../../lib/termExam/results';
import { useCoursework } from './ResultsPanel';
import { card, btnGhost, Note, studentName } from './ui';

const r1 = (v) => (v == null ? '—' : Math.round(v * 10) / 10);

export default function LearnerPanel({ data }) {
  const { win } = data;
  const forms = data.forms.filter((f) => win.forms?.includes(f.id));
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const [sid, setSid] = useState('');
  const cw = useCoursework(data);
  const className = forms.find((f) => f.id === formId)?.name ?? '';
  const learners = data.students.filter((s) => s.classId === formId); // already girls first, A–Z
  const student = learners.find((s) => s.id === sid) ?? learners[0];

  const view = useMemo(() => {
    if (!cw || !formId || !student) return null;
    const res = formResults(data, formId, cw);
    const analysis = learnerAnalysis(res, student.id, bandsFor(win, className));
    return { analysis, text: explainLearner(student, analysis) };
  }, [cw, formId, student, data, win, className]);

  if (!forms.length) return <Note>No classes in this window.</Note>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select aria-label="Class" className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={formId}
          onChange={(e) => { setFormId(e.target.value); setSid(''); }}>
          {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select aria-label="Learner" className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600 min-w-[14rem]" value={student?.id ?? ''}
          onChange={(e) => setSid(e.target.value)}>
          {learners.map((s) => <option key={s.id} value={s.id}>{studentName(s)}</option>)}
        </select>
        <button className={btnGhost} onClick={() => window.print()}><Printer size={13} /> Print</button>
        {!win.resultsChecked && <span className="text-xs text-amber-700 dark:text-amber-300">Provisional: results are not signed off yet.</span>}
      </div>

      {!student && <Note>No learners in this class.</Note>}
      {student && !view && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Calculating…</p>}
      {student && view?.analysis && (
        <section className={`${card} p-4 space-y-4 print:border-0 print:p-0`}>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{win.name} · {className}</p>
            <h2 className="text-lg font-bold">{studentName(student)}</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="Overall average" value={fmtPct(view.analysis.summary.average)} />
            <Tile label="Position in class" value={view.analysis.summary.position ? `${view.analysis.summary.position} of ${view.analysis.summary.outOf}` : '—'} />
            <Tile label="Passes (C or better)" value={`${view.analysis.summary.passes} of ${view.analysis.summary.marked}`} />
            <Tile label="Grades" value={Object.entries(view.analysis.summary.grades).sort(([a], [b]) => a.localeCompare(b)).map(([g, n]) => `${n}${g}`).join(' ') || '—'} />
          </div>

          <div className="overflow-x-auto">
            <table className="text-sm min-w-full">
              <thead><tr className="text-xs text-slate-500 text-left border-b border-slate-200 dark:border-slate-700">
                <th className="py-1.5 pr-3">Subject</th><th className="pr-3 text-center">Mark</th><th className="pr-3 text-center">Grade</th>
                <th className="pr-3 text-center">Class average</th><th className="pr-3 text-center">Difference</th><th className="text-center">Position</th>
              </tr></thead>
              <tbody>
                {view.analysis.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-1.5 pr-3">{r.name}</td>
                    <td className="pr-3 text-center font-semibold">{r.pct == null ? 'X' : `${r1(r.pct)}%`}</td>
                    <td className="pr-3 text-center font-semibold">{r.grade}</td>
                    <td className="pr-3 text-center text-slate-500">{r.classAvg == null ? '—' : `${r1(r.classAvg)}%`}</td>
                    <td className="pr-3 text-center">{r.diff == null ? '—' : `${r.diff > 0 ? '+' : ''}${r1(r.diff)}`}</td>
                    <td className="text-center">{r.position ? `${r.position}/${r.outOf}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <LearnerChart rows={view.analysis.rows.filter((r) => r.pct != null)} passMark={view.analysis.summary.passMark} />

          <div>
            <p className="text-sm font-semibold mb-1">Analysis</p>
            <ul className="list-disc pl-5 text-sm space-y-0.5 text-slate-700 dark:text-slate-200">{view.text.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

/* One series (the learner, validated blue) with the class average as a reference tick. */
const ROW = 26, BAR = 16, LABEL_W = 132, PLOT_W = 420, VALUE_W = 48;
function barPath(x, y, w, h) {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

function LearnerChart({ rows, passMark }) {
  if (!rows.length) return null;
  const height = rows.length * ROW + 20;
  const X = (v) => LABEL_W + (Math.max(0, Math.min(100, v)) / 100) * PLOT_W;
  return (
    <figure className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 break-inside-avoid">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Marks against the class average</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Pass mark {passMark}%</p>
      </figcaption>
      <div className="flex flex-wrap gap-3 mb-2 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-[#2a78d6] dark:bg-[#3987e5]" />Learner’s mark</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block w-0.5 h-3.5 bg-slate-900 dark:bg-slate-100" />Class average</span>
      </div>
      <svg viewBox={`0 0 ${LABEL_W + PLOT_W + VALUE_W} ${height}`} className="w-full h-auto" role="img" aria-label="Marks against the class average">
        {[0, 50, 100].map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={0} y2={height - 16} className="stroke-[#e1e0d9] dark:stroke-[#2c2c2a]" strokeWidth={1} />
            <text x={X(t)} y={height - 4} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px]">{t}%</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = i * ROW + (ROW - BAR) / 2;
          return (
            <g key={r.id}>
              <title>{`${r.name}: ${Math.round(r.pct)}% (grade ${r.grade})${r.classAvg != null ? `, class average ${Math.round(r.classAvg)}%` : ''}`}</title>
              <rect x={0} y={i * ROW} width={LABEL_W + PLOT_W + VALUE_W} height={ROW} fill="transparent" />
              <text x={LABEL_W - 8} y={y + BAR / 2 + 4} textAnchor="end" className="fill-slate-600 dark:fill-slate-300 text-[11px]">{r.name}</text>
              <path d={barPath(LABEL_W, y, X(r.pct) - LABEL_W, BAR)} className="fill-[#2a78d6] dark:fill-[#3987e5]" />
              {r.classAvg != null && <line x1={X(r.classAvg)} x2={X(r.classAvg)} y1={y - 3} y2={y + BAR + 3} className="stroke-slate-900 dark:stroke-slate-100" strokeWidth={2} strokeLinecap="round" />}
              <text x={Math.max(X(r.pct), r.classAvg != null ? X(r.classAvg) : 0) + 6} y={y + BAR / 2 + 4} className="fill-slate-800 dark:fill-slate-100 text-[11px]">{Math.round(r.pct)}%</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
