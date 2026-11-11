/**
 * Spreadsheet-style markbook grid.
 *
 * Keyboard nav: Arrow keys / Tab / Enter move focus. Special codes:
 *   A  → absent     X  → exempt     (stored as null with status flag)
 *
 * Data layout:
 *   marks doc  { entries: { [studentId]: { raw, status, perQuestion } } }
 *   One document per assessment — entire class loads in 1 Firestore read.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAssessments } from '../../hooks/useAssessments';
import { useStudents } from '../../hooks/useStudents';
import {
  marksRef, setDoc, now, writeAuditLog,
  onSnapshot,
} from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, Download } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const SPECIAL_CODES = { A: 'absent', X: 'exempt', a: 'absent', x: 'exempt' };

export default function MarkbookGrid({ groupId, group }) {
  const { firebaseUser } = useAuth();
  const { assessments, loading: loadingA } = useAssessments(groupId);

  const [marksMap,  setMarksMap]  = useState({});   // { [assessmentId]: entries }
  const [locked,    setLocked]    = useState({});    // { [assessmentId]: bool }
  const [focusCell, setFocusCell] = useState(null);  // { row, col }

  // Load students in this group (chunked — classes can exceed 30)
  const { students } = useStudents(group?.studentIds ?? []);

  // Load all marks for each assessment (1 read each)
  useEffect(() => {
    if (!assessments.length) return;
    const unsubList = assessments.map((a) => {
      const ref = marksRef(groupId, a.id);
      return onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          setMarksMap((prev) => ({ ...prev, [a.id]: snap.data().entries ?? {} }));
          setLocked((prev)   => ({ ...prev, [a.id]: snap.data().locked ?? false }));
        }
      });
    });
    return () => unsubList.forEach((u) => u());
  }, [assessments, groupId]);

  // Audit: remember a cell's saved value on focus; on blur, log if an existing mark changed
  const editStart = useRef({});
  function beginEdit(assessmentId, studentId) {
    editStart.current[`${assessmentId}:${studentId}`] = marksMap[assessmentId]?.[studentId] ?? null;
  }
  function endEdit(assessmentId, studentId) {
    const key = `${assessmentId}:${studentId}`;
    const before = editStart.current[key];
    delete editStart.current[key];
    const after = marksMap[assessmentId]?.[studentId] ?? null;
    const had = before && (before.raw != null || before.status);
    if (!had || JSON.stringify(before) === JSON.stringify(after)) return; // first entry or unchanged
    writeAuditLog(firebaseUser.uid, 'marks', `teachingGroups/${groupId}/assessments/${assessmentId}`,
      { studentId, raw: before.raw ?? null, status: before.status ?? null },
      { studentId, raw: after?.raw ?? null, status: after?.status ?? null },
    ).catch(() => {});
  }

  // Debounced save for a single cell
  const saveCell = useCallback(async (assessmentId, studentId, value, status) => {
    const ref = marksRef(groupId, assessmentId);
    try {
      await setDoc(ref, {
        entries: { [studentId]: { raw: status ? null : value, status: status ?? null } },
        updatedBy: firebaseUser.uid, updatedAt: now(),
      }, { merge: true });
    } catch {
      toast.error('Save failed — will retry when online.');
    }
  }, [groupId, firebaseUser]);

  function handleCellChange(assessmentId, studentId, raw) {
    // Check for special codes first
    const code = SPECIAL_CODES[raw.trim()];
    if (code) {
      setMarksMap((prev) => ({
        ...prev,
        [assessmentId]: { ...prev[assessmentId], [studentId]: { raw: null, status: code } },
      }));
      saveCell(assessmentId, studentId, null, code);
      return;
    }
    const num = Number(raw);
    if (raw === '' || (!isNaN(num) && raw.trim() !== '')) {
      const val = raw === '' ? null : num;
      setMarksMap((prev) => ({
        ...prev,
        [assessmentId]: { ...prev[assessmentId], [studentId]: { raw: val, status: null } },
      }));
      if (raw !== '') saveCell(assessmentId, studentId, val, null);
    }
  }

  function gradeFromMark(mark, maxMark, boundaries) {
    if (mark === null || mark === undefined) return '—';
    if (!boundaries?.length) return `${Math.round((mark / maxMark) * 100)}%`;
    const pct = (mark / maxMark) * 100;
    const band = [...boundaries].sort((a, b) => b.min - a.min).find((b) => pct >= b.min);
    return band?.grade ?? 'U';
  }

  function handleKeyDown(e, row, col) {
    const moves = {
      ArrowRight: [0, 1], ArrowLeft: [0, -1],
      ArrowDown:  [1, 0], ArrowUp:  [-1, 0],
      Enter:      [1, 0], Tab:      [0, e.shiftKey ? -1 : 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      setFocusCell({ row: row + dr, col: col + dc });
    }
  }

  function exportXLSX() {
    const headers = ['Student', ...assessments.map((a) => a.title ?? a.id)];
    const rows = students.map((s) => {
      const row = [s.surname ? `${s.surname}, ${s.preferredName ?? s.firstName}` : s.name];
      assessments.forEach((a) => {
        const e = marksMap[a.id]?.[s.id];
        row.push(e?.status === 'absent' ? 'ABS' : e?.status === 'exempt' ? 'EXM' : e?.raw ?? '');
      });
      return row;
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Markbook');
    XLSX.writeFile(wb, `markbook-${group?.syllabusCode ?? groupId}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loadingA) return <GridSkeleton />;
  if (!assessments.length) return (
    <div className="text-center py-12 text-slate-400 text-sm">
      No assessments yet. Click <strong>+ New assessment</strong> to add one.
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>Keys: <kbd className="bg-slate-100 dark:bg-slate-700 px-1 rounded">A</kbd> absent · <kbd className="bg-slate-100 dark:bg-slate-700 px-1 rounded">X</kbd> exempt · arrows move · Enter/Tab advance</span>
        <button onClick={exportXLSX} className="flex items-center gap-1 hover:text-brand-600 transition-colors">
          <Download size={13} /> Export XLSX
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-900 min-w-[160px]">
                Student
              </th>
              {assessments.map((a) => (
                <th key={a.id} className="text-center px-2 py-2 font-medium text-slate-600 dark:text-slate-300 min-w-[90px]">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="truncate max-w-[80px]" title={a.title}>{a.title}</span>
                    <span className="text-xs font-normal text-slate-400">/{a.maxMark}</span>
                    {locked[a.id] && <Lock size={10} className="text-amber-500" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, si) => (
              <tr key={s.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-800 font-medium">
                  {s.surname ? `${s.surname}, ${s.preferredName ?? s.firstName}` : s.name}
                </td>
                {assessments.map((a, ai) => {
                  const entry   = marksMap[a.id]?.[s.id];
                  const isFocus = focusCell?.row === si && focusCell?.col === ai;
                  const isLocked = locked[a.id];
                  const displayVal = entry?.status === 'absent' ? 'A'
                    : entry?.status === 'exempt' ? 'X'
                    : entry?.raw ?? '';
                  const grade = entry?.status
                    ? ''
                    : gradeFromMark(entry?.raw, a.maxMark, a.gradeBoundaries);
                  return (
                    <td key={a.id} className="px-1 py-0.5 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          className={clsx(
                            'w-16 text-center text-sm rounded border py-0.5 transition-colors',
                            isLocked ? 'bg-slate-100 dark:bg-slate-700 cursor-not-allowed text-slate-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600',
                            isFocus && 'ring-2 ring-brand-500',
                            entry?.status === 'absent' && 'bg-amber-50 dark:bg-amber-900/20 text-amber-700',
                            entry?.status === 'exempt' && 'bg-slate-100 dark:bg-slate-700 text-slate-400',
                          )}
                          value={displayVal}
                          readOnly={isLocked}
                          onFocus={() => { setFocusCell({ row: si, col: ai }); beginEdit(a.id, s.id); }}
                          onBlur={() => !isLocked && endEdit(a.id, s.id)}
                          onKeyDown={(e) => handleKeyDown(e, si, ai, ai)}
                          onChange={(e) => !isLocked && handleCellChange(a.id, s.id, e.target.value)}
                        />
                        {grade && <span className="text-xs text-slate-400">{grade}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700" />
      ))}
    </div>
  );
}
