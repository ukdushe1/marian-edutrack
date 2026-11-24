/**
 * Class schedules — for each class (1D, 3D1, L6 Sciences…): the mark schedule and the
 * results analysis by subject by grades distribution, in the school's formats,
 * with charts and a short written analysis. Print (landscape) or export to Excel.
 */
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Printer, Download, Loader2, Upload, X } from 'lucide-react';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { formResults } from '../../lib/termExam/compute';
import { groupFor, paperMaxMark, paperQuestions, paperForClass, examAssessmentRef, bandsFor } from '../../lib/termExam/model';
import { classMarkColumns, classMarksTemplate, planClassMarksImport } from '../../lib/termExam/classMarksImport';
import { applyExamImport } from '../../lib/termExam/examSync';
import { writeAuditLog } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { buildSchedule, analyseClass, explainAnalysis, sortBands } from '../../lib/termExam/classAnalysis';
import { fmtPct } from '../../lib/termExam/results';
import { useCoursework } from './ResultsPanel';
import { card, btnGhost, Note, studentName } from './ui';

const r1 = (v) => (v == null ? '' : Math.round(v * 10) / 10);

export default function SchedulePanel({ data }) {
  const { win } = data;
  const forms = data.forms.filter((f) => win.forms?.includes(f.id));
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const cw = useCoursework(data);
  const className = forms.find((f) => f.id === formId)?.name ?? '';
  const { hasRole, firebaseUser } = useAuth();
  const isAdmin = hasRole('superAdmin'); // whole-class, every-subject import: System Admin only
  const [importPlan, setImportPlan] = useState(null);
  const [importing, setImporting] = useState(false);

  const view = useMemo(() => {
    if (!cw || !formId) return null;
    const res = formResults(data, formId, cw);
    const paperById = Object.fromEntries(data.papers.map((p) => [p.id, p]));
    // Paper headings (Pure P1, Stats 2 (P6)…) for subjects with more than one paper
    const enriched = { ...res, subjects: res.subjects.map((s) => ({ ...s, papers: s.papers.map((p) => ({ ...p, label: paperById[p.id]?.paper ?? 'Paper' })) })) };
    const paperPct = (sid, subj, p) => {
      if ((data.sittings[sid]?.[p.id] ?? 'present') !== 'present') return null;
      const g = groupFor(data.groups, sid, subj.id);
      const raw = g ? data.marks[`${p.id}|${g.id}`]?.[sid]?.raw : null;
      const max = paperMaxMark(paperById[p.id]);
      return raw == null || !max ? null : (raw / max) * 100;
    };
    const schedule = buildSchedule(enriched, paperPct);
    const analysis = analyseClass(enriched, bandsFor(win, className), schedule);
    // Every paper the class sits, per subject in school order, for the class marks template
    const columns = classMarkColumns(schedule.subjects.map((s) => ({
      ...s, papers: enriched.subjects.find((x) => x.id === s.id).papers.map((p) => ({ id: p.id, label: p.label, max: paperMaxMark(paperById[p.id]) })),
    })));
    return { schedule, analysis, text: explainAnalysis(className, analysis, schedule.learners), columns, paperById, res };
  }, [cw, formId, data, win, className]);

  if (!forms.length) return <Note>No classes in this window.</Note>;
  if (!view) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Calculating…</p>;
  const { schedule, analysis, text, columns, paperById, res } = view;
  const classStudents = schedule.rows.map((r) => r.student);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(classMarksTemplate(classStudents, columns));
    ws['!cols'] = [{ hidden: true }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    XLSX.writeFile(wb, `${className} class marks.xlsx`);
  }
  function readFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.arrayBuffer().then((buf) => {
      const wb = XLSX.read(buf, { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const takes = (sid, subjId) => !!res.byStudent[sid]?.subjects?.[subjId];
      setImportPlan({ fileName: file.name, ...planClassMarksImport({ rows, students: classStudents, columns, takes }) });
    }).catch(() => toast.error('Could not read that file. Use .xlsx or .csv.'));
  }
  async function applyImport() {
    setImporting(true);
    let saved = 0, absent = 0, submitted = 0;
    try {
      for (const c of importPlan.columns) {
        const ups = importPlan.updates[c.paperId];
        if (!ups) continue;
        const paper = paperById[c.paperId];
        const qs = paperQuestions(paper);
        // One markbook per paper × teaching group
        const byGroup = {};
        for (const [sid, e] of Object.entries(ups)) {
          const g = groupFor(data.groups, sid, c.subjectId);
          if (g) (byGroup[g.id] ??= { g, ups: {} }).ups[sid] = e;
        }
        for (const { g, ups: gu } of Object.values(byGroup)) {
          const key = `${paper.id}|${g.id}`;
          let assessment = data.assessments[key];
          if (!assessment) {
            assessment = { title: `${paper.paper} — ${win.name}`, component: 'Exam', maxMark: paperMaxMark(paper), date: paper.date ?? win.endDate,
              examPaperId: paper.id, windowId: win.id, questions: qs, submitted: false, locked: false };
            await setDoc(examAssessmentRef(g.id, paper.id), { ...assessment, createdBy: firebaseUser.uid, createdAt: serverTimestamp() });
          }
          const candidateIds = (g.studentIds ?? []).filter((sid) => { const st = data.students.find((x) => x.id === sid); return st && paperForClass(paper, st.classId); });
          const r = await applyExamImport({
            paper, windowId: win.id, groupId: g.id, assessment, candidateIds,
            entryUpdates: Object.fromEntries(Object.entries(gu).filter(([, e]) => e.raw != null)
              .map(([sid, e]) => [sid, { raw: e.raw, perQuestion: qs.length === 1 ? { [qs[0].no]: e.raw } : {} }])),
            statusUpdates: Object.fromEntries(Object.entries(gu).filter(([, e]) => e.status).map(([sid, e]) => [sid, e.status])),
            entriesBefore: data.marks[key] ?? {},
            sittingsBefore: Object.fromEntries(candidateIds.map((sid) => [sid, data.sittings[sid]?.[paper.id]]).filter(([, v]) => v)),
            uid: firebaseUser.uid,
          });
          saved += Object.keys(gu).length;
          absent += r.sittingChanges.filter((x) => x.status !== 'present').length;
          if (r.submitted) submitted++;
        }
      }
      writeAuditLog(firebaseUser.uid, 'marks', `examWindows/${win.id}`, { imported: importPlan.fileName, class: className },
        { subjects: importPlan.columns.map((c) => c.header), marks: saved }).catch(() => {});
      toast.success([`${saved} marks imported for ${className}`, absent ? `${absent} recorded absent` : '', submitted ? `${submitted} markbook${submitted > 1 ? 's' : ''} submitted to HODs` : ''].filter(Boolean).join(' · '), { duration: 6000 });
      setImportPlan(null);
      data.reload();
    } catch (err) { toast.error(`Import stopped: ${err.code ?? err.message}. It is safe to run again.`); }
    setImporting(false);
  }
  const year = (win.startDate ?? '').slice(0, 4) || new Date().getFullYear();

  function exportExcel() {
    const head1 = ['#', 'NAME OF LEARNER'], head2 = ['', ''];
    schedule.subjects.forEach((s) => {
      if (s.papers.length) { s.papers.forEach((p, i) => { head1.push(i ? '' : s.heading); head2.push(p.label); }); head1.push('', ''); head2.push('TOT', 'GRD'); }
      else { head1.push(s.heading, ''); head2.push('%', 'GRD'); }
    });
    head1.push('AVERAGE', 'POSITION'); head2.push('', '');
    const rows = schedule.rows.map((r) => {
      const out = [r.n, studentName(r.student)];
      schedule.subjects.forEach((s) => {
        const c = r.cells[s.id];
        s.papers.forEach((p) => out.push(c ? r1(c.papers[p.id]) : ''));
        out.push(c ? r1(c.pct) : '', c?.grade ?? '');
      });
      out.push(r1(r.average), r.position ? `${r.position}/${r.outOf}` : '');
      return out;
    });
    const avg = ['', 'CLASS AVERAGE MARK PER SUBJECT'];
    schedule.subjects.forEach((s) => { s.papers.forEach(() => avg.push('')); avg.push(r1(schedule.averages[s.id]), ''); });
    const ana = [['SUBJECT', ...analysis.grades, 'NO. WITH C OR BETTER', 'NO. FAILING', '% PASS RATE'],
      ...analysis.subjects.map((s) => [s.name.toUpperCase(), ...analysis.grades.map((g) => s.counts[g]), s.pass, s.fail, s.passRate == null ? '' : r1(s.passRate)])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`MARIAN HIGH SCHOOL — TERM-END TESTS RESULTS SCHEDULE ${year}`], [`CLASS: FORM ${className}`, '', `NO. OF LEARNERS: ${schedule.learners}`], head1, head2, ...rows, avg]), 'Schedule');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`RESULTS ANALYSIS BY SUBJECT BY GRADES DISTRIBUTION — ${className}`], ...ana, [], ...text.map((t) => [t])]), 'Analysis');
    XLSX.writeFile(wb, `${className} results schedule ${year}.xlsx`);
  }

  const th = 'border border-slate-300 dark:border-slate-600 px-1.5 py-1 font-semibold';
  const td = 'border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-center';

  return (
    <div className="space-y-4">
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } .sched-break { break-before: page; } }'}</style>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select aria-label="Class" className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={formId} onChange={(e) => setFormId(e.target.value)}>
          {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className={btnGhost} onClick={() => window.print()}><Printer size={13} /> Print</button>
        <button className={btnGhost} onClick={exportExcel}><Download size={13} /> Export to Excel</button>
        {isAdmin && !win.published && (
          <>
            <button className={btnGhost} onClick={downloadTemplate}><Download size={13} /> Class marks template</button>
            <label className={`${btnGhost} cursor-pointer`}><Upload size={13} /> Import class marks
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={readFile} />
            </label>
          </>
        )}
        {!win.resultsChecked && <span className="text-xs text-amber-700 dark:text-amber-300">Provisional: results are not signed off yet.</span>}
      </div>

      {importPlan && (
        <div className={`${card} p-4 space-y-2 text-sm print:hidden`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p><strong>{importPlan.fileName}</strong> → {className}</p>
              <ul className="text-xs text-slate-600 dark:text-slate-300 mt-1 columns-2 sm:columns-3">
                {importPlan.columns.map((c) => <li key={c.paperId}>{c.header}: {c.count} mark{c.count === 1 ? '' : 's'}</li>)}
              </ul>
            </div>
            <button onClick={() => setImportPlan(null)} className="p-1" aria-label="Cancel import"><X size={14} /></button>
          </div>
          {[...importPlan.errors, ...importPlan.unmatched, ...importPlan.ignored].length > 0 && (
            <ul className="list-disc pl-5 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 rounded-lg py-2 pr-2 max-h-40 overflow-y-auto">
              {[...importPlan.errors, ...importPlan.unmatched, ...importPlan.ignored].map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
          <p className="text-xs text-slate-500">Saves each subject’s End of Term marks, records A / X in Sitting, and submits a class markbook to its HOD when it is complete. Marks already entered for these students are replaced.</p>
          <div className="flex gap-2">
            <button onClick={applyImport} disabled={importing || !Object.keys(importPlan.updates).length}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Save class marks
            </button>
            <button onClick={() => setImportPlan(null)} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Mark schedule ─────────────────────────────────────────── */}
      <section className={`${card} p-4 print:border-0 print:p-0`}>
        <div className="text-center mb-2">
          <p className="font-bold tracking-wide">MARIAN HIGH SCHOOL</p>
          <p className="text-sm font-semibold">TERM-END TESTS RESULTS SCHEDULE {year}</p>
          <p className="text-xs mt-1">CLASS: FORM <strong>{className}</strong> · NO. OF LEARNERS: <strong>{schedule.learners}</strong></p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-[11px] border-collapse min-w-full">
            <thead>
              <tr>
                <th rowSpan={2} className={th}>#</th>
                <th rowSpan={2} className={`${th} text-left`}>NAME OF LEARNER</th>
                {schedule.subjects.map((s) => <th key={s.id} colSpan={s.papers.length ? s.papers.length + 2 : 2} className={th} title={`${s.code} ${s.name}`}>{s.heading}</th>)}
                <th rowSpan={2} className={th}>AVG</th><th rowSpan={2} className={th}>POS</th>
              </tr>
              <tr>
                {schedule.subjects.flatMap((s) => (s.papers.length
                  ? [...s.papers.map((p) => <th key={`${s.id}${p.id}`} className={`${th} font-normal`}>{p.label}</th>), <th key={`${s.id}t`} className={th}>TOT</th>, <th key={`${s.id}g`} className={th}>GRD</th>]
                  : [<th key={`${s.id}m`} className={`${th} font-normal`}>%</th>, <th key={`${s.id}g`} className={th}>GRD</th>]))}
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((r) => (
                <tr key={r.student.id}>
                  <td className={td}>{r.n}</td>
                  <td className={`${td} text-left whitespace-nowrap`}>{studentName(r.student)}</td>
                  {schedule.subjects.flatMap((s) => {
                    const c = r.cells[s.id];
                    return [
                      ...s.papers.map((p) => <td key={`${s.id}${p.id}`} className={td}>{c ? r1(c.papers[p.id]) : ''}</td>),
                      <td key={`${s.id}m`} className={td}>{c ? r1(c.pct) : ''}</td>,
                      <td key={`${s.id}g`} className={`${td} font-semibold`}>{c?.grade ?? ''}</td>,
                    ];
                  })}
                  <td className={`${td} font-semibold`}>{r1(r.average)}</td>
                  <td className={td}>{r.position ? `${r.position}/${r.outOf}` : ''}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-900/40">
                <td className={td} />
                <td className={`${td} text-left font-semibold whitespace-nowrap`}>CLASS AVERAGE MARK PER SUBJECT</td>
                {schedule.subjects.flatMap((s) => [
                  ...s.papers.map((p) => <td key={`${s.id}${p.id}`} className={td} />),
                  <td key={`${s.id}m`} className={`${td} font-semibold`}>{r1(schedule.averages[s.id])}</td>,
                  <td key={`${s.id}g`} className={`${td} bg-slate-300 dark:bg-slate-600`} />,
                ])}
                <td className={td} /><td className={td} />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-1 print:hidden">Marks are final % per subject (exam, plus coursework where the subject requires it). Blank = not taken; X = absent with valid reason.</p>
      </section>

      {/* ── Results analysis ──────────────────────────────────────── */}
      <section className={`${card} p-4 space-y-4 sched-break print:border-0 print:p-0`}>
        <p className="text-center font-bold underline">RESULTS ANALYSIS BY SUBJECT BY GRADES DISTRIBUTION — {className}</p>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr>
                <th rowSpan={2} className={`${th} text-left`}>SUBJECT</th>
                <th colSpan={analysis.grades.length} className={th}>LEARNERS OBTAINING THE UNIT</th>
                <th rowSpan={2} className={th}>NO. OF LEARNERS WITH C OR BETTER</th>
                <th rowSpan={2} className={th}>NO. OF LEARNERS FAILING</th>
                <th rowSpan={2} className={th}>% PASS RATE</th>
              </tr>
              <tr>{analysis.grades.map((g) => <th key={g} className={th}>{g}</th>)}</tr>
            </thead>
            <tbody>
              {analysis.subjects.map((s) => (
                <tr key={s.id}>
                  <td className={`${td} text-left whitespace-nowrap`}>{s.name.toUpperCase()}</td>
                  {analysis.grades.map((g) => <td key={g} className={td}>{s.graded ? s.counts[g] : ''}</td>)}
                  <td className={td}>{s.graded ? s.pass : ''}</td>
                  <td className={td}>{s.graded ? s.fail : ''}</td>
                  <td className={`${td} font-semibold`}>{s.passRate == null ? '' : `${r1(s.passRate)}%`}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-900/40 font-semibold">
                <td className={`${td} text-left`}>ALL SUBJECTS</td>
                {analysis.grades.map((g) => <td key={g} className={td}>{analysis.subjects.reduce((a, s) => a + (s.counts[g] ?? 0), 0)}</td>)}
                <td className={td}>{analysis.overall.pass}</td>
                <td className={td}>{analysis.overall.entries - analysis.overall.pass}</td>
                <td className={td}>{analysis.overall.passRate == null ? '' : `${r1(analysis.overall.passRate)}%`}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Headline figures */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="Learners" value={schedule.learners} />
          <Tile label="Pass rate (C or better)" value={fmtPct(analysis.overall.passRate)} />
          <Tile label="Average learner" value={fmtPct(analysis.overall.learnerAverages?.mean)} />
          <Tile label="Below pass on average" value={analysis.overall.belowPass.length} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <PassRateChart subjects={analysis.subjects.filter((s) => s.graded)} />
          <GradeBandsChart subjects={analysis.subjects.filter((s) => s.graded)} bands={bandsFor(win, className)} passMark={analysis.passMark} />
        </div>

        <div>
          <p className="text-sm font-semibold mb-1">Analysis</p>
          <ul className="list-disc pl-5 text-sm space-y-0.5 text-slate-700 dark:text-slate-200">{text.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>

        <div className="hidden print:block text-xs space-y-4 pt-4">
          <p>CLASS TEACHER: ........................................ SIGNATURE: .............................. DATE: ..................</p>
          <p>PRINCIPAL’S SIGNATURE: ........................................ DATE: ..................</p>
        </div>
      </section>
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

/* ── Charts (inline SVG; colours validated: one blue for a single series, a
      3-step blue ramp for ordered grade groups, light and dark) ──────────── */
const ROW = 26, BAR = 16, LABEL_W = 132, PLOT_W = 420, VALUE_W = 48;
const grid = 'stroke-[#e1e0d9] dark:stroke-[#2c2c2a]';
const ink2 = 'fill-slate-600 dark:fill-slate-300';
const ink3 = 'fill-slate-400 dark:fill-slate-500';

/** Bar from the baseline with a 4px rounded data end. */
function barPath(x, y, w, h) {
  if (w <= 0) return '';
  const r = Math.min(4, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

function ChartFrame({ title, subtitle, height, children, legend }) {
  return (
    <figure className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 break-inside-avoid">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </figcaption>
      {legend}
      <svg viewBox={`0 0 ${LABEL_W + PLOT_W + VALUE_W} ${height}`} className="w-full h-auto" role="img" aria-label={title}>{children}</svg>
    </figure>
  );
}

function Axis({ height }) {
  return [0, 50, 100].map((t) => {
    const x = LABEL_W + (t / 100) * PLOT_W;
    return (
      <g key={t}>
        <line x1={x} x2={x} y1={0} y2={height - 16} className={grid} strokeWidth={1} />
        <text x={x} y={height - 4} textAnchor="middle" className={`${ink3} text-[10px]`}>{t}%</text>
      </g>
    );
  });
}

function PassRateChart({ subjects }) {
  const list = [...subjects].sort((a, b) => b.passRate - a.passRate);
  const height = list.length * ROW + 20;
  return (
    <ChartFrame title="Pass rate by subject" subtitle="Share of learners at grade C or better" height={height}>
      <Axis height={height} />
      {list.map((s, i) => {
        const y = i * ROW + (ROW - BAR) / 2;
        const w = (s.passRate / 100) * PLOT_W;
        return (
          <g key={s.id}>
            <title>{`${s.name}: ${Math.round(s.passRate)}% pass (${s.pass} of ${s.graded}), average ${Math.round(s.stats.mean)}%`}</title>
            <rect x={0} y={i * ROW} width={LABEL_W + PLOT_W + VALUE_W} height={ROW} fill="transparent" />
            <text x={LABEL_W - 8} y={y + BAR / 2 + 4} textAnchor="end" className={`${ink2} text-[11px]`}>{s.name}</text>
            <path d={barPath(LABEL_W, y, w, BAR)} className="fill-[#2a78d6] dark:fill-[#3987e5]" />
            <text x={LABEL_W + w + 6} y={y + BAR / 2 + 4} className="fill-slate-800 dark:fill-slate-100 text-[11px]">{Math.round(s.passRate)}%</text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

// Ordered grade groups on one blue ramp (validated --ordinal, light and dark); class names written out for Tailwind
const GROUPS = [
  { key: 'top', label: 'Above C', fill: 'fill-[#0d366b] dark:fill-[#cde2fb]', swatch: 'bg-[#0d366b] dark:bg-[#cde2fb]' },
  { key: 'c', label: 'C', fill: 'fill-[#2a78d6] dark:fill-[#6da7ec]', swatch: 'bg-[#2a78d6] dark:bg-[#6da7ec]' },
  { key: 'below', label: 'Below C', fill: 'fill-[#86b6ef] dark:fill-[#184f95]', swatch: 'bg-[#86b6ef] dark:bg-[#184f95]' },
];

function GradeBandsChart({ subjects, bands, passMark }) {
  const ordered = sortBands(bands);
  const cBand = ordered.find((b) => b.min === passMark);
  const groupOf = (g) => {
    const b = ordered.find((x) => x.grade === g);
    if (!b) return 'below';
    if (b.min > passMark) return 'top';
    return b === cBand || b.min === passMark ? 'c' : 'below';
  };
  const list = [...subjects].sort((a, b) => a.name.localeCompare(b.name));
  const height = list.length * ROW + 20;
  const legend = (
    <div className="flex flex-wrap gap-3 mb-2 text-xs text-slate-600 dark:text-slate-300">
      {GROUPS.map((g) => (
        <span key={g.key} className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-3 h-3 rounded-sm ${g.swatch}`} />
          {g.label}
        </span>
      ))}
    </div>
  );
  return (
    <ChartFrame title="Grades by subject" subtitle={`Share of learners above C, at C, and below C (pass mark ${passMark}%)`} height={height} legend={legend}>
      <Axis height={height} />
      {list.map((s, i) => {
        const y = i * ROW + (ROW - BAR) / 2;
        const sums = { top: 0, c: 0, below: 0 };
        Object.entries(s.counts).forEach(([g, n]) => { sums[groupOf(g)] += n; });
        const total = sums.top + sums.c + sums.below || 1;
        let x = LABEL_W;
        const segs = GROUPS.map((g) => ({ ...g, n: sums[g.key], w: (sums[g.key] / total) * PLOT_W })).filter((g) => g.n > 0);
        return (
          <g key={s.id}>
            <title>{`${s.name}: ${segs.map((g) => `${g.label} ${g.n}`).join(', ')} (of ${s.graded})`}</title>
            <rect x={0} y={i * ROW} width={LABEL_W + PLOT_W + VALUE_W} height={ROW} fill="transparent" />
            <text x={LABEL_W - 8} y={y + BAR / 2 + 4} textAnchor="end" className={`${ink2} text-[11px]`}>{s.name}</text>
            {segs.map((g, k) => {
              const last = k === segs.length - 1;
              const w = Math.max(0, g.w - (last ? 0 : 2)); // 2px surface gap between segments
              const el = last
                ? <path key={g.key} d={barPath(x, y, w, BAR)} className={g.fill} />
                : <rect key={g.key} x={x} y={y} width={w} height={BAR} className={g.fill} />;
              x += g.w;
              return el;
            })}
          </g>
        );
      })}
    </ChartFrame>
  );
}
