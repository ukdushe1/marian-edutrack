/**
 * Stage 10 — report cards. Preview from live results; on publish, a results
 * snapshot is saved per student (versioned), report cards and subject reports are
 * published and exam marks are frozen. Print or "Save as PDF" from the browser.
 */
import { useEffect, useMemo, useState } from 'react';
import { setDoc, updateDoc, getDocs, query, where, collection, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';
import { Printer, Send, Loader2 } from 'lucide-react';
import {
  cardRef, windowRef, snapshotRef, examAssessmentRef, subjectReportId, groupFor, EFFORT_LABEL,
} from '../../lib/termExam/model';
import { formResults, loadAttendanceConduct } from '../../lib/termExam/compute';
import { fmtPct } from '../../lib/termExam/results';
import NotifyGuardianButton from '../../components/NotifyGuardianButton';
import { useCoursework } from './ResultsPanel';
import { btn, btnGhost, Note, useExamRoles, userName } from './ui';

const reportDoc = (id) => doc(db, 'reports', id);

/** Everything printed on one card — also what is frozen in the results snapshot. */
export function buildCard(data, res, s, att) {
  const { win, reports, groups, cards, users, forms } = data;
  const c = cards[s.id] ?? {};
  const r = res.byStudent[s.id];
  return {
    windowId: win.id, windowName: win.name, studentId: s.id, formId: s.classId,
    formName: forms.find((f) => f.id === s.classId)?.name ?? s.classId,
    student: { surname: s.surname ?? '', firstName: s.firstName ?? '', candidateNumber: s.candidateNumber ?? '' },
    subjects: res.subjects.filter((sub) => r.subjects[sub.id]).map((sub) => {
      const x = r.subjects[sub.id];
      const g = groupFor(groups, s.id, sub.id);
      const rep = g ? reports[subjectReportId(g.id, win.termId, s.id)] : null;
      return {
        code: sub.code, name: sub.name ?? sub.code, coursework: sub.weights.mode === 'examCoursework',
        courseworkPct: x.courseworkPct ?? null, examPct: x.examPct, finalPct: x.finalPct, grade: x.grade,
        position: x.position ?? null, outOf: res.subjectStats[sub.id].outOf, average: res.subjectStats[sub.id].average,
        effort: rep?.effort ?? '', comment: rep?.subjectComment ?? '', x: x.x,
      };
    }),
    overallAvg: r.overallAvg, overallPos: r.overallPos, overallOutOf: r.overallOutOf,
    attendance: att ? { present: att.present, total: att.total, pct: att.pct } : null,
    conduct: att ? { merits: att.merits, demerits: att.demerits, incidents: att.incidents } : null,
    classTeacherComment: c.classTeacherComment ?? '', principalComment: c.principalComment ?? '',
    approvedByName: c.approvedBy ? userName(users, c.approvedBy) : '', nextTermOpens: win.nextTermOpens ?? '',
  };
}

export function ReportCard({ card: d, preview }) {
  const pos = (p, n) => (p ? `${p} / ${n}` : '—');
  return (
    <article className="report-card bg-white text-slate-900 rounded-xl border border-slate-200 p-6 space-y-3 text-[13px] relative">
      {preview && <span className="absolute top-3 right-4 text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Preview — not published</span>}
      <header className="flex items-center gap-3 border-b-2 border-brand-600 pb-3">
        <img src="/crest.png" alt="" className="h-14 w-auto" />
        <div className="flex-1">
          <p className="text-base font-bold">Marian High School</p>
          <p className="text-xs text-slate-500">Seize the moment · {d.windowName}</p>
        </div>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div><span className="text-slate-500 block">Student</span><strong>{d.student.surname}, {d.student.firstName}</strong></div>
        <div><span className="text-slate-500 block">Form</span>{d.formName}</div>
        <div><span className="text-slate-500 block">Candidate no.</span>{d.student.candidateNumber || '—'}</div>
        <div><span className="text-slate-500 block">Overall</span>{fmtPct(d.overallAvg)} · position {pos(d.overallPos, d.overallOutOf)}</div>
      </div>
      <table className="w-full text-xs border-collapse">
        <thead><tr className="bg-slate-100 text-left">
          <th className="p-1.5">Subject</th><th className="p-1.5 text-center">Course&shy;work</th><th className="p-1.5 text-center">Exam</th>
          <th className="p-1.5 text-center">Final</th><th className="p-1.5 text-center">Grade</th><th className="p-1.5 text-center">Position</th>
          <th className="p-1.5 text-center">Form avg</th><th className="p-1.5 text-center">Effort</th><th className="p-1.5">Teacher’s comment</th>
        </tr></thead>
        <tbody>
          {d.subjects.map((s) => (
            <tr key={s.code} className="border-b border-slate-200 align-top">
              <td className="p-1.5 font-medium">{s.name}</td>
              <td className="p-1.5 text-center">{s.coursework ? fmtPct(s.courseworkPct) : '—'}</td>
              <td className="p-1.5 text-center">{s.x ? 'X' : fmtPct(s.examPct)}</td>
              <td className="p-1.5 text-center font-semibold">{s.x ? 'X' : fmtPct(s.finalPct)}</td>
              <td className="p-1.5 text-center font-semibold">{s.grade}</td>
              <td className="p-1.5 text-center">{pos(s.position, s.outOf)}</td>
              <td className="p-1.5 text-center">{fmtPct(s.average)}</td>
              <td className="p-1.5 text-center" title={EFFORT_LABEL[s.effort]}>{s.effort || '—'}</td>
              <td className="p-1.5">{s.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.subjects.some((s) => s.x) && <p className="text-[11px] text-slate-500">X = absent from the exam with a valid reason; not included in positions.</p>}
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <p><strong>Attendance:</strong> {d.attendance?.total ? `${d.attendance.present} of ${d.attendance.total} days (${fmtPct(d.attendance.pct)})` : '—'}</p>
        <p><strong>Conduct:</strong> {d.conduct ? `${d.conduct.merits} merits, ${d.conduct.demerits} demerits, ${d.conduct.incidents} incidents` : '—'}</p>
      </div>
      <div className="text-xs space-y-1.5">
        <p><strong>Class teacher:</strong> {d.classTeacherComment || '—'}</p>
        <p><strong>Principal:</strong> {d.principalComment || '—'}</p>
      </div>
      <footer className="flex flex-wrap items-end justify-between gap-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
        <span>{d.approvedByName ? `Approved electronically by ${d.approvedByName}` : 'Not yet approved'}{d.publishedAt ? ` · published ${d.publishedAt}` : ''}{d.version ? ` · v${d.version}` : ''}</span>
        <span>Next term opens: <strong className="text-slate-700">{d.nextTermOpens || 'to be announced'}</strong></span>
      </footer>
    </article>
  );
}

export default function ReportCardsPanel({ data }) {
  const roles = useExamRoles();
  const { win, cards, papers, groups, reload } = data;
  const forms = data.forms.filter((f) => win.forms?.includes(f.id));
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const [att, setAtt] = useState(null);
  const [snaps, setSnaps] = useState({});
  const [busy, setBusy] = useState(false);
  const cw = useCoursework(data);

  useEffect(() => { loadAttendanceConduct(data).then(setAtt).catch(() => setAtt({})); }, [data.win.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    getDocs(query(collection(db, 'resultSnapshots'), where('windowId', '==', win.id)))
      .then((s) => setSnaps(Object.fromEntries(s.docs.map((d) => [d.data().studentId, d.data()])))).catch(() => {});
  }, [win.id, win.version]);

  const all = useMemo(() => (cw ? Object.fromEntries(forms.map((f) => [f.id, formResults(data, f.id, cw)])) : null), [cw, data, forms]);
  if (!all || !att) return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Preparing report cards…</p>;

  const res = all[formId];
  const everyone = data.students;
  const allApproved = everyone.length > 0 && everyone.every((s) => ['approved', 'published'].includes(cards[s.id]?.status));

  async function publish() {
    if (!allApproved) { toast.error('Every form must be approved first (stage 9).'); return; }
    setBusy(true);
    const version = (win.version ?? 0) + 1;
    const publishedAt = new Date().toISOString().slice(0, 10);
    try {
      // 1. Results snapshot per student (what parents and later reports see)
      await Promise.all(everyone.map((s) => {
        const card = buildCard(data, all[s.classId], s, att[s.id]);
        return setDoc(snapshotRef(win.id, s.id), { ...card, version, publishedAt, publishedBy: roles.uid, createdAt: serverTimestamp() });
      }));
      // 2. Report cards and subject reports → published
      await Promise.all(everyone.map((s) => setDoc(cardRef(win.id, s.id), { status: 'published', publishedAt: serverTimestamp() }, { merge: true })));
      await Promise.all(everyone.flatMap((s) => all[s.classId].subjects.map((sub) => {
        const g = groupFor(groups, s.id, sub.id);
        const rep = g && data.reports[subjectReportId(g.id, win.termId, s.id)];
        return rep && rep.status !== 'published' ? updateDoc(reportDoc(rep.id), { status: 'published', publishedBy: roles.uid, publishedAt: serverTimestamp() }).catch(() => null) : null;
      })));
      // 3. Freeze exam marks
      await Promise.all(papers.flatMap((p) => groups.filter((g) => g.syllabusId === p.syllabusId)
        .map((g) => updateDoc(examAssessmentRef(g.id, p.id), { frozen: true }).catch(() => null))));
      await updateDoc(windowRef(win.id), { published: true, publishedAt: serverTimestamp(), publishedBy: roles.uid, version, unlockedFrom: null });
      toast.success(`Published (version ${version}). Marks are now frozen.`);
      reload();
    } catch (e) { console.error(e); toast.error('Publishing stopped part-way — try again; it is safe to repeat.'); }
    finally { setBusy(false); }
  }

  const list = res?.students ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select className="text-sm border rounded-lg px-2.5 py-1.5 dark:bg-slate-800 dark:border-slate-600" value={formId} onChange={(e) => setFormId(e.target.value)}>
          {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button className={btnGhost} onClick={() => window.print()}><Printer size={13} /> Print / Save as PDF</button>
        {roles.canApprove && !win.published && <button className={btn} onClick={publish} disabled={busy || !allApproved}><Send size={13} /> {busy ? 'Publishing…' : 'Publish report cards'}</button>}
      </div>
      <div className="print:hidden">
        {win.published
          ? <Note tone="ok">Published (version {win.version}). Use “Tell guardian” to send each family a WhatsApp that the report is ready.</Note>
          : <Note tone={allApproved ? 'info' : 'warn'}>{allApproved ? 'All forms approved — ready to publish.' : 'Preview only. Publishing needs every form approved (stage 9).'}</Note>}
      </div>
      <div className="space-y-4">
        {list.map((s) => {
          const card = win.published && snaps[s.id] ? snaps[s.id] : buildCard(data, res, s, att[s.id]);
          return (
            <div key={s.id} className="space-y-1">
              {win.published && <div className="print:hidden"><NotifyGuardianButton student={s} messageType="report-ready" label="Tell guardian" compact /></div>}
              <ReportCard card={card} preview={!win.published} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
