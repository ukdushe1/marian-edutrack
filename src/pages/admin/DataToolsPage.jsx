/**
 * Phase 1 data tools:
 *   - Import students from Excel (columns: surname, firstName, candidateNumber, house, classId)
 *   - Export markbook / register template
 */
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { now } from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import TestDataCard from './TestDataCard';

const REQUIRED_COLS = ['surname', 'firstName'];

export default function DataToolsPage() {
  const fileRef   = useRef(null);
  const [preview,  setPreview]  = useState(null);  // parsed rows
  const [errors,   setErrors]   = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [imported, setImported] = useState(0);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'binary' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        validate(rows);
      } catch {
        toast.error('Could not read file. Make sure it is .xlsx or .xls.');
      }
    };
    reader.readAsBinaryString(file);
  }

  function validate(rows) {
    const errs = [];
    if (!rows.length) { errs.push('File is empty.'); setErrors(errs); return; }
    // Normalize keys to lowercase
    const normed = rows.map((r) => {
      const n = {};
      Object.entries(r).forEach(([k, v]) => { n[k.toLowerCase().trim()] = v; });
      return n;
    });
    // Headers were lowercased above, so compare lowercase
    REQUIRED_COLS.forEach((col) => {
      if (!Object.prototype.hasOwnProperty.call(normed[0], col.toLowerCase())) errs.push(`Missing column: "${col}"`);
    });
    normed.forEach((r, i) => {
      if (!r.surname)    errs.push(`Row ${i + 2}: surname is empty.`);
      if (!r.firstname)  errs.push(`Row ${i + 2}: firstName is empty.`);
    });
    setErrors(errs);
    setPreview(errs.length ? null : normed);
  }

  async function doImport() {
    if (!preview) return;
    setBusy(true);
    let count = 0;
    try {
      // Batch writes (max 500 per batch)
      const batches = [];
      let batch = writeBatch(db);
      let batchCount = 0;
      preview.forEach((row) => {
        const ref = doc(collection(db, 'students'));
        batch.set(ref, {
          surname:          row.surname          || '',
          firstName:        row.firstname        || row.firstName || '',
          preferredName:    row.preferredname    || row.preferredName || '',
          candidateNumber:  row.candidatenumber  || row.candidateNumber || '',
          house:            row.house            || '',
          classId:          row.classid          || row.classId || '',
          status:           'active',
          createdAt:        now(),
        });
        batchCount++;
        count++;
        if (batchCount === 499) {
          batches.push(batch.commit());
          batch = writeBatch(db);
          batchCount = 0;
        }
      });
      if (batchCount > 0) batches.push(batch.commit());
      await Promise.all(batches);
      setImported(count);
      setPreview(null);
      toast.success(`${count} students imported.`);
    } catch (err) {
      toast.error('Import failed — check the console.');
      console.error(err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['surname', 'firstName', 'preferredName', 'candidateNumber', 'house', 'classId'],
      ['Moyo',    'Tanaka',    'Tana',           '0001',           'Lion',  'L6A'],
      ['Chikwanda','Priscilla','Priss',          '0002',           'Eagle', 'L6A'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student-import-template.xlsx');
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Data tools</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Import class lists and students from Excel.</p>
      </div>

      <TestDataCard />

      {/* Import card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-brand-600" />
            <h2 className="font-semibold">Import students</h2>
          </div>
          <button onClick={downloadTemplate}
            className="flex items-center gap-1 text-xs text-brand-600 hover:underline">
            <Download size={13} /> Download template
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Upload an .xlsx file with columns: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">surname</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">firstName</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">preferredName</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">candidateNumber</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">house</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">classId</code>.
        </p>

        <label className={clsx(
          'flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors',
          'border-slate-200 dark:border-slate-600 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10'
        )}>
          <Upload size={24} className="text-slate-400" />
          <span className="text-sm text-slate-500">Click to select file or drag and drop</span>
          <span className="text-xs text-slate-400">.xlsx or .xls</span>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </label>

        {errors.length > 0 && (
          <div className="space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {err}
              </div>
            ))}
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} />
              {preview.length} students ready to import
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    {['Surname', 'First name', 'Candidate #', 'House', 'Class'].map((h) => (
                      <th key={h} className="text-left px-3 py-1.5 font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-1">{r.surname}</td>
                      <td className="px-3 py-1">{r.firstname ?? r.firstName}</td>
                      <td className="px-3 py-1">{r.candidatenumber ?? r.candidateNumber}</td>
                      <td className="px-3 py-1">{r.house}</td>
                      <td className="px-3 py-1">{r.classid ?? r.classId}</td>
                    </tr>
                  ))}
                  {preview.length > 20 && (
                    <tr><td colSpan={5} className="px-3 py-1 text-slate-400">… and {preview.length - 20} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={doImport} disabled={busy}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
              {busy ? 'Importing…' : `Import ${preview.length} students`}
            </button>
          </div>
        )}

        {imported > 0 && !preview && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={14} />
            Last import: {imported} students added.
          </div>
        )}
      </div>
    </div>
  );
}
