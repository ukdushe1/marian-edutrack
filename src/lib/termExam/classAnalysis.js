/**
 * Class mark schedule and results analysis for one class (form) in an exam window,
 * in the school's formats ("Term-end tests results schedule" and "Results analysis
 * by subject by grades distribution"), plus the statistics behind the written analysis.
 * Pure: works on the output of formResults() and the raw paper marks.
 */
import { SUBJECTS } from '../schoolSetup/schoolSetup';
import { DEFAULT_BANDS } from './model';

const round1 = (n) => Math.round(n * 10) / 10;

// Cambridge code → the school's short heading (0580 → MAT, 9709 → MATHS…), in the school's column order
const SHORT = { ENG: 'ENG', LIT: 'LIT', MAT: 'MAT', PE: 'P.E', COMP: 'COMP', ICT: 'ICT', GEO: 'GEO', HIS: 'HIS', ACC: 'ACC',
  BS: 'B.S', PHY: 'PHY', CHE: 'CHE', BIO: 'BIO', ECO: 'ECO', AGR: 'AGRC', FRE: 'FRE', SHO: 'SHO', RS: 'R.S', COMB: 'COMB' };
const ORDER = Object.keys(SUBJECTS);
function subjectKeyOfCode(code) {
  for (const [key, s] of Object.entries(SUBJECTS)) {
    if (s.igcse?.[0] === code || s.alevel?.[0] === code) return key;
  }
  const k = String(code ?? '').replace(/-A$/, '');
  return SUBJECTS[k] ? k : null;
}
export function shortHeading(subj) {
  const key = subjectKeyOfCode(subj.code);
  if (key === 'MAT' && /^9/.test(subj.code)) return 'MATHS';
  return key ? SHORT[key] : (subj.code ?? subj.name);
}
const subjectOrder = (subj) => { const i = ORDER.indexOf(subjectKeyOfCode(subj.code)); return i < 0 ? 99 : i; };

export const sortBands = (bands) => [...(bands?.length ? bands : DEFAULT_BANDS)].sort((a, b) => b.min - a.min);
/** Lowest % that counts as a pass: the C band if there is one, otherwise 50. */
export function passMark(bands) {
  return sortBands(bands).find((b) => String(b.grade).toUpperCase() === 'C')?.min ?? 50;
}

function stats(vals) {
  if (!vals.length) return null;
  const n = vals.length;
  const mean = vals.reduce((a, v) => a + v, 0) / n;
  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  const s = [...vals].sort((a, b) => a - b);
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  return { n, mean, sd, median, min: s[0], max: s[n - 1] };
}

/**
 * The mark schedule: each subject's final mark and grade only (no paper-by-paper marks).
 * @param res formResults() output for this class (students already in school order)
 * @returns { subjects: [{ id, code, heading, name }], rows, averages, learners }
 */
export function buildSchedule(res) {
  const subjects = [...res.subjects].sort((a, b) => subjectOrder(a) - subjectOrder(b) || String(a.code).localeCompare(String(b.code)))
    .map((s) => ({ id: s.id, code: s.code, name: s.name, heading: shortHeading(s) }));
  const rows = res.students.map((st, i) => {
    const r = res.byStudent[st.id];
    const cells = {};
    for (const s of subjects) {
      const x = r.subjects[s.id];
      if (!x) continue;
      cells[s.id] = { pct: x.finalPct, grade: x.grade };
    }
    return { n: i + 1, student: st, cells, average: r.overallAvg, position: r.overallPos, outOf: r.overallOutOf };
  });
  const averages = Object.fromEntries(subjects.map((s) => {
    const vals = rows.map((r) => r.cells[s.id]?.pct).filter((v) => v != null);
    return [s.id, vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null];
  }));
  return { subjects, rows, averages, learners: res.students.length };
}

/**
 * Results analysis by subject by grade, and the class statistics.
 * @returns { grades, subjects: [{ id, name, counts, graded, pass, fail, passRate, stats }], overall, students }
 */
export function analyseClass(res, bands, schedule) {
  const ordered = sortBands(bands);
  const grades = ordered.map((b) => b.grade);
  const pm = passMark(bands);
  const subjects = schedule.subjects.map((s) => {
    const counts = Object.fromEntries(grades.map((g) => [g, 0]));
    const vals = [];
    let absent = 0;
    for (const r of schedule.rows) {
      const c = r.cells[s.id];
      if (!c) continue;
      if (c.pct == null) { absent++; continue; }
      vals.push(c.pct);
      if (c.grade in counts) counts[c.grade]++;
    }
    const pass = vals.filter((v) => v >= pm).length;
    return { id: s.id, name: s.name, heading: s.heading, counts, graded: vals.length, absent,
      pass, fail: vals.length - pass, passRate: vals.length ? (pass / vals.length) * 100 : null, stats: stats(vals) };
  });
  const all = schedule.rows.flatMap((r) => Object.values(r.cells).map((c) => c.pct)).filter((v) => v != null);
  const averages = schedule.rows.map((r) => ({ student: r.student, average: r.average })).filter((x) => x.average != null);
  const byGender = (g) => stats(averages.filter((x) => x.student.gender === g).map((x) => x.average));
  return {
    grades, passMark: pm, subjects,
    overall: {
      entries: all.length, pass: all.filter((v) => v >= pm).length,
      passRate: all.length ? (all.filter((v) => v >= pm).length / all.length) * 100 : null,
      results: stats(all), learnerAverages: stats(averages.map((x) => x.average)),
      girls: byGender('F'), boys: byGender('M'),
      belowPass: averages.filter((x) => x.average < pm).map((x) => x.student),
      top: [...averages].sort((a, b) => b.average - a.average).slice(0, 3),
    },
  };
}

const pct = (v) => `${round1(v)}%`;
const who = (s) => `${s.firstName} ${s.surname}`;

/** A short written analysis from the calculated statistics. */
export function explainAnalysis(className, analysis, learners) {
  const { subjects, overall, passMark: pm } = analysis;
  const lines = [];
  const taken = subjects.filter((s) => s.graded > 0);
  if (!overall.entries) return [`No marks have been recorded for ${className} yet.`];
  lines.push(`${className} has ${learners} learner${learners === 1 ? '' : 's'}. Across ${taken.length} subject${taken.length === 1 ? '' : 's'}, ${pct(overall.passRate)} of subject results are at grade C or better (${overall.pass} of ${overall.entries}, pass mark ${pm}%).`);
  if (overall.learnerAverages) {
    const la = overall.learnerAverages;
    lines.push(`The average learner scores ${pct(la.mean)} (median ${pct(la.median)}), with a spread of ±${round1(la.sd)} points and averages ranging from ${pct(la.min)} to ${pct(la.max)}.`);
  }
  const ranked = [...taken].sort((a, b) => b.passRate - a.passRate || b.stats.mean - a.stats.mean);
  if (ranked.length > 1) {
    const best = ranked[0], worst = ranked.at(-1);
    lines.push(`Strongest subject: ${best.name} — ${pct(best.passRate)} pass, average ${pct(best.stats.mean)}. Weakest: ${worst.name} — ${pct(worst.passRate)} pass, average ${pct(worst.stats.mean)}, with ${worst.fail} learner${worst.fail === 1 ? '' : 's'} below C.`);
    const wide = [...taken].filter((s) => s.stats.n > 2).sort((a, b) => b.stats.sd - a.stats.sd)[0];
    if (wide && wide.stats.sd >= 15) lines.push(`Results vary most in ${wide.name} (±${round1(wide.stats.sd)} points, ${pct(wide.stats.min)}–${pct(wide.stats.max)}), so the class is split there.`);
  }
  const topGrade = analysis.grades[0];
  const tops = taken.map((s) => ({ s, n: s.counts[topGrade] ?? 0 })).sort((a, b) => b.n - a.n);
  if (tops[0]?.n) lines.push(`Most ${topGrade} grades: ${tops[0].s.name} (${tops[0].n}).`);
  if (overall.belowPass.length) lines.push(`${overall.belowPass.length} learner${overall.belowPass.length === 1 ? ' averages' : 's average'} below ${pm}% across their subjects and may need support.`);
  if (overall.top.length) lines.push(`Top of the class: ${overall.top.map((t) => `${who(t.student)} (${pct(t.average)})`).join(', ')}.`);
  if (overall.girls && overall.boys) {
    const d = overall.girls.mean - overall.boys.mean;
    lines.push(`Girls average ${pct(overall.girls.mean)} and boys ${pct(overall.boys.mean)}${Math.abs(d) < 1 ? ' — about the same' : ` — ${d > 0 ? 'girls' : 'boys'} ahead by ${round1(Math.abs(d))} points`}.`);
  }
  return lines;
}

/**
 * One learner's results against their class.
 * @param res formResults() output for the learner's class; sid the learner
 * @returns { rows: [{ id, name, heading, pct, grade, classAvg, diff, position, outOf }], summary }
 */
export function learnerAnalysis(res, sid, bands) {
  const pm = passMark(bands);
  const me = res.byStudent[sid];
  if (!me) return null;
  const rows = [...res.subjects].sort((a, b) => subjectOrder(a) - subjectOrder(b))
    .filter((s) => me.subjects[s.id])
    .map((s) => {
      const x = me.subjects[s.id];
      const classAvg = res.subjectStats?.[s.id]?.average ?? null;
      return { id: s.id, name: s.name, heading: shortHeading(s), pct: x.finalPct, grade: x.grade,
        classAvg, diff: x.finalPct != null && classAvg != null ? x.finalPct - classAvg : null,
        position: x.position ?? null, outOf: res.subjectStats?.[s.id]?.outOf ?? null };
    });
  const marked = rows.filter((r) => r.pct != null);
  const grades = {};
  marked.forEach((r) => { grades[r.grade] = (grades[r.grade] ?? 0) + 1; });
  return {
    rows,
    summary: {
      average: me.overallAvg, position: me.overallPos, outOf: me.overallOutOf, subjects: rows.length, marked: marked.length,
      passes: marked.filter((r) => r.pct >= pm).length, passMark: pm, grades,
      above: marked.filter((r) => r.diff != null && r.diff > 0).length,
      below: marked.filter((r) => r.diff != null && r.diff < 0).length,
    },
  };
}

/** A short written analysis of one learner's results. */
export function explainLearner(student, analysis) {
  if (!analysis) return [];
  const { rows, summary: s } = analysis;
  const name = student.firstName;
  const marked = rows.filter((r) => r.pct != null);
  if (!marked.length) return [`No marks have been recorded for ${name} yet.`];
  const lines = [];
  lines.push(`${name} averages ${pct(s.average ?? 0)} across ${s.marked} subject${s.marked === 1 ? '' : 's'}${s.position ? `, placing ${s.position} of ${s.outOf} in the class` : ''}.`);
  lines.push(`${s.passes} of ${s.marked} subjects are at grade C or better (pass mark ${s.passMark}%); ${s.above} above the class average and ${s.below} below it.`);
  const byDiff = marked.filter((r) => r.diff != null).sort((a, b) => b.diff - a.diff);
  if (byDiff.length) {
    const best = byDiff[0], worst = byDiff.at(-1);
    if (best.diff > 0) lines.push(`Strongest against the class: ${best.name} — ${pct(best.pct)} (grade ${best.grade}), ${round1(best.diff)} points above the class average.`);
    if (worst.diff < 0) lines.push(`Needs most attention: ${worst.name} — ${pct(worst.pct)} (grade ${worst.grade}), ${round1(Math.abs(worst.diff))} points below the class average.`);
  }
  const failing = marked.filter((r) => r.pct < s.passMark);
  if (failing.length) lines.push(`Below a pass in: ${failing.map((r) => `${r.name} (${pct(r.pct)})`).join(', ')}.`);
  const absent = rows.filter((r) => r.pct == null);
  if (absent.length) lines.push(`No result (absent or not marked) in: ${absent.map((r) => r.name).join(', ')}.`);
  if (s.position && s.outOf > 1) {
    const top = Math.max(1, Math.round((s.position / s.outOf) * 100));
    lines.push(top <= 25 ? `This is in the top quarter of the class.` : top > 75 ? `This is in the bottom quarter of the class.` : `This is in the middle half of the class.`);
  }
  return lines;
}
