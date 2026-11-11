/**
 * Admin — Guardians.
 * Contact details, linked students and WhatsApp consent (Zimbabwe CDPA 2021).
 *
 * guardians/{id}: {
 *   name, relationship, whatsappNumber, phone, email,
 *   studentIds: string[],
 *   consentWhatsApp: boolean, consentAt, consentRecordedBy, consentWithdrawnAt,
 *   createdAt, updatedAt
 * }
 */
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  guardiansCol, guardianRef, studentsCol, onSnapshot, getDocs,
  addDoc, updateDoc, deleteDoc, now,
} from '../../firebase/firestore';
import { Contact, Plus, X, Pencil, Search, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { RELATIONSHIPS, normaliseNumber, formatNumber } from '../../lib/guardianMessages';

const studentName = (s) => (s ? `${s.surname}, ${s.preferredName || s.firstName}` : 'Unknown student');

export default function GuardiansPage() {
  const [guardians, setGuardians] = useState([]);
  const [students,  setStudents]  = useState([]);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all'); // all | consented | no-consent
  const [editing,   setEditing]   = useState(undefined); // undefined = closed, null = new

  useEffect(() => {
    const unsub = onSnapshot(guardiansCol(), (s) =>
      setGuardians(s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))));
    getDocs(studentsCol()).then((s) => setStudents(
      s.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.surname ?? '').localeCompare(b.surname ?? ''))));
    return unsub;
  }, []);

  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const visible = guardians.filter((g) => {
    if (filter === 'consented' && !g.consentWhatsApp) return false;
    if (filter === 'no-consent' && g.consentWhatsApp) return false;
    if (!search) return true;
    const hay = [g.name, g.whatsappNumber, g.phone, ...(g.studentIds ?? []).map((id) => studentName(studentsById[id]))]
      .join(' ').toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  const withoutGuardian = students.filter((s) => !guardians.some((g) => g.studentIds?.includes(s.id))).length;
  const consented = guardians.filter((g) => g.consentWhatsApp).length;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Contact size={20} /> Guardians</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {guardians.length} guardians · {consented} with WhatsApp consent
            {students.length > 0 && ` · ${withoutGuardian} students without a guardian`}
          </p>
        </div>
        <button onClick={() => setEditing(null)}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus size={15} /> Add guardian
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guardian, number or student…"
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {[['all', 'All'], ['consented', 'Consented'], ['no-consent', 'No consent']].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={clsx('px-3 py-1.5 text-xs font-medium transition-colors',
                filter === id ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((g) => (
          <div key={g.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm">{g.name}</p>
                <span className="text-xs text-slate-400">{g.relationship}</span>
                {g.consentWhatsApp ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={11} /> WhatsApp consent
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    <ShieldAlert size={11} /> No consent
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {g.whatsappNumber ? `WhatsApp ${formatNumber(g.whatsappNumber)}` : 'No WhatsApp number'}
                {g.phone ? ` · Phone ${g.phone}` : ''}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {(g.studentIds ?? []).map((id) => (
                  <span key={id} className="text-xs bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">
                    {studentName(studentsById[id])}
                  </span>
                ))}
                {!g.studentIds?.length && <span className="text-xs text-slate-400">No students linked</span>}
              </div>
            </div>
            <button onClick={() => setEditing(g)} aria-label={`Edit ${g.name}`}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400">
              <Pencil size={14} />
            </button>
          </div>
        ))}
        {!visible.length && (
          <div className="text-center py-12 text-slate-400 text-sm">
            {guardians.length ? 'No guardians match.' : 'No guardians yet. Add one to start sending notifications.'}
          </div>
        )}
      </div>

      {editing !== undefined && (
        <GuardianForm guardian={editing} students={students} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}

function GuardianForm({ guardian, students, onClose }) {
  const { firebaseUser } = useAuth();
  const isEdit = !!guardian;
  const [form, setForm] = useState({
    name:            guardian?.name            ?? '',
    relationship:    guardian?.relationship    ?? 'Mother',
    whatsappNumber:  guardian?.whatsappNumber  ?? '',
    phone:           guardian?.phone           ?? '',
    email:           guardian?.email           ?? '',
    studentIds:      guardian?.studentIds      ?? [],
    consentWhatsApp: guardian?.consentWhatsApp ?? false,
  });
  const [stuSearch,     setStuSearch]     = useState('');
  const [busy,          setBusy]          = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleStudent = (id) => setForm((p) => ({
    ...p, studentIds: p.studentIds.includes(id) ? p.studentIds.filter((x) => x !== id) : [...p.studentIds, id],
  }));

  const numberOk = !form.whatsappNumber || !!normaliseNumber(form.whatsappNumber);
  const filtered = students
    .filter((s) => `${s.surname} ${s.firstName} ${s.preferredName ?? ''}`.toLowerCase().includes(stuSearch.toLowerCase()))
    .slice(0, 30);
  const selected = students.filter((s) => form.studentIds.includes(s.id));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Enter the guardian’s name.'); return; }
    if (!numberOk) { toast.error('WhatsApp number is not valid.'); return; }
    if (form.consentWhatsApp && !form.whatsappNumber) { toast.error('Add a WhatsApp number to record consent.'); return; }
    setBusy(true);

    const normalised = normaliseNumber(form.whatsappNumber);
    const payload = {
      ...form,
      name:           form.name.trim(),
      whatsappNumber: normalised ? `+${normalised}` : '',
      phone:          form.phone.trim(),
      email:          form.email.trim(),
      updatedAt:      now(),
    };
    // Consent audit trail
    const wasConsented = guardian?.consentWhatsApp === true;
    if (form.consentWhatsApp && !wasConsented) {
      Object.assign(payload, { consentAt: now(), consentRecordedBy: firebaseUser.uid, consentWithdrawnAt: null });
    } else if (!form.consentWhatsApp && wasConsented) {
      Object.assign(payload, { consentWithdrawnAt: now() });
    }

    try {
      if (isEdit) await updateDoc(guardianRef(guardian.id), payload);
      else        await addDoc(guardiansCol(), { ...payload, createdAt: now() });
      toast.success(isEdit ? 'Guardian updated.' : 'Guardian added.');
      onClose();
    } catch {
      toast.error('Save failed.');
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteDoc(guardianRef(guardian.id));
      toast.success('Guardian removed.');
      onClose();
    } catch {
      toast.error('Delete failed.');
      setBusy(false);
    }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const lbl = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{isEdit ? 'Edit guardian' : 'Add guardian'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={lbl}>Full name</label>
              <input value={form.name} onChange={set('name')} className={inp} placeholder="e.g. Rutendo Moyo" autoFocus />
            </div>
            <div>
              <label className={lbl}>Relationship</label>
              <select value={form.relationship} onChange={set('relationship')} className={inp}>
                {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>WhatsApp number</label>
              <input value={form.whatsappNumber} onChange={set('whatsappNumber')} inputMode="tel"
                className={clsx(inp, !numberOk && 'border-red-400 focus:ring-red-400')} placeholder="0771 234 567" />
              <p className={clsx('text-[11px] mt-0.5', numberOk ? 'text-slate-400' : 'text-red-600')}>
                {numberOk
                  ? (form.whatsappNumber ? `Saved as ${formatNumber(form.whatsappNumber)}` : 'Local 07… numbers become +263')
                  : 'Not a valid number'}
              </p>
            </div>
            <div>
              <label className={lbl}>Other phone (optional)</label>
              <input value={form.phone} onChange={set('phone')} inputMode="tel" className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Email (optional)</label>
            <input type="email" value={form.email} onChange={set('email')} className={inp} />
          </div>

          {/* Linked students */}
          <div>
            <label className={lbl}>Students <span className="text-slate-400">({form.studentIds.length} linked)</span></label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {selected.map((s) => (
                  <button key={s.id} type="button" onClick={() => toggleStudent(s.id)}
                    className="inline-flex items-center gap-1 text-xs bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">
                    {studentName(s)} <X size={10} />
                  </button>
                ))}
              </div>
            )}
            <input value={stuSearch} onChange={(e) => setStuSearch(e.target.value)} placeholder="Search students…" className={clsx(inp, 'mb-1')} />
            <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                  <input type="checkbox" checked={form.studentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} className="accent-brand-600" />
                  <span className="text-sm">{studentName(s)}</span>
                </label>
              ))}
              {!filtered.length && <p className="px-3 py-2 text-xs text-slate-400">No students found. Import students under Imports first.</p>}
            </div>
          </div>

          {/* Consent */}
          <label className={clsx('flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer',
            form.consentWhatsApp ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700')}>
            <input type="checkbox" checked={form.consentWhatsApp} onChange={set('consentWhatsApp')} className="accent-brand-600 mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Guardian consents to WhatsApp messages from the school</span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Only tick this if the guardian has given consent (e.g. signed form). The date and who recorded it are saved.
                {guardian?.consentAt?.toDate && ` Recorded ${guardian.consentAt.toDate().toLocaleDateString()}.`}
              </span>
            </span>
          </label>

          <button type="submit" disabled={busy}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add guardian'}
          </button>

          {isEdit && (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-red-600">Remove {guardian.name}? This cannot be undone.</span>
                <button type="button" onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">Cancel</button>
                <button type="button" onClick={remove} disabled={busy} className="px-3 py-1.5 rounded-lg bg-red-600 text-white">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-red-600">
                <Trash2 size={12} /> Remove guardian
              </button>
            )
          )}
        </form>
      </div>
    </div>
  );
}
