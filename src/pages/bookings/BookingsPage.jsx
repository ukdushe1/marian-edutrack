/**
 * Lab & IT resource bookings — Phase 3.
 * Overlap blocked client-side (Firestore transaction would secure it server-side in prod).
 * Resources: each doc in 'resources' has name, type (lab|IT|other), capacity.
 * Bookings: resourceId, bookedBy, date, period, groupName, notes.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  col, addDoc, deleteDoc, onSnapshot,
  query, orderBy, now,
} from '../../firebase/firestore';
import { db } from '../../firebase/config';
import { doc } from 'firebase/firestore';
import { CalendarCheck2, Plus, X, Wrench, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const bookingsCol  = () => col('resourceBookings');
const resourcesCol = () => col('resources');

const RESOURCE_TYPES = ['Lab', 'IT Room', 'Sports facility', 'Other'];

export default function BookingsPage() {
  const { firebaseUser, profile } = useAuth();
  const [bookings,   setBookings]   = useState([]);
  const [resources,  setResources]  = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  const [showResForm,setShowResForm]= useState(false);
  const [filterRes,  setFilterRes]  = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0,10));

  useEffect(() => {
    const unsubB = onSnapshot(query(bookingsCol(), orderBy('date', 'asc')), (s) =>
      setBookings(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubR = onSnapshot(query(resourcesCol(), orderBy('name', 'asc')), (s) =>
      setResources(s.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubB(); unsubR(); };
  }, []);

  const filtered = bookings.filter((b) =>
    (!filterRes  || b.resourceId === filterRes) &&
    (!filterDate || b.date       === filterDate)
  );

  function resource(id) { return resources.find((r) => r.id === id); }

  // Check if a slot is already booked for overlap warning
  function isClash(resourceId, date, period, excludeId) {
    return bookings.some((b) => b.id !== excludeId && b.resourceId === resourceId && b.date === date && b.period === period);
  }

  async function deleteBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    await deleteDoc(doc(db, 'resourceBookings', id));
    toast.success('Booking cancelled.');
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><CalendarCheck2 size={20}/> Room & lab bookings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} bookings shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowResForm(true)}
            className="flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 text-sm px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Wrench size={13}/> Resources
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={15}/> New booking
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900"/>
        <select value={filterRes} onChange={(e) => setFilterRes(e.target.value)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900">
          <option value="">All resources</option>
          {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button onClick={() => { setFilterDate(''); setFilterRes(''); }}
          className="text-xs text-brand-600 hover:underline">Clear</button>
      </div>

      {/* Booking grid by period */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Resource</th>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-left">Booked by</th>
              <th className="px-3 py-2"/>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map((b) => {
              const res = resource(b.resourceId);
              return (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-3 py-2 font-medium">{b.period}</td>
                  <td className="px-3 py-2">{res?.name ?? '—'}</td>
                  <td className="px-3 py-2">{b.groupName ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{b.bookedByName ?? b.bookedBy}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => deleteBooking(b.id)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">No bookings for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <BookingForm resources={resources} bookings={bookings} bookedBy={firebaseUser?.uid}
          bookedByName={profile?.name} isClash={isClash} onClose={() => setShowForm(false)} />
      )}
      {showResForm && (
        <ResourcesModal resources={resources} onClose={() => setShowResForm(false)} />
      )}
    </div>
  );
}

function BookingForm({ resources, bookedBy, bookedByName, isClash, onClose }) {
  const [form, setForm] = useState({
    resourceId: resources[0]?.id ?? '',
    date:       new Date().toISOString().slice(0, 10),
    period:     1,
    groupName:  '',
    notes:      '',
  });
  const [busy, setBusy] = useState(false);

  const clash = form.resourceId && form.date && form.period
    ? isClash(form.resourceId, form.date, Number(form.period), null)
    : false;

  async function submit(e) {
    e.preventDefault();
    if (clash) { toast.error('That slot is already booked.'); return; }
    setBusy(true);
    try {
      await addDoc(bookingsCol(), {
        ...form, period: Number(form.period),
        bookedBy, bookedByName: bookedByName ?? bookedBy,
        createdAt: now(),
      });
      toast.success('Booking confirmed.');
      onClose();
    } catch { toast.error('Save failed.'); setBusy(false); }
  }

  const inp = 'w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">New booking</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Resource</label>
            <select required value={form.resourceId} onChange={(e) => setForm((p) => ({ ...p, resourceId: e.target.value }))} className={inp}>
              <option value="">Select…</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Period</label>
              <input type="number" min={1} max={9} value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))} className={inp} />
            </div>
          </div>
          {clash && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13}/> This slot is already booked.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <input value={form.groupName} onChange={(e) => setForm((p) => ({ ...p, groupName: e.target.value }))} className={inp} placeholder="e.g. L6A CS" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className={inp} placeholder="Optional" />
          </div>
          <button type="submit" disabled={busy || clash}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition-colors">
            {busy ? 'Saving…' : 'Confirm booking'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ResourcesModal({ resources, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(RESOURCE_TYPES[0]);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addDoc(resourcesCol(), { name: name.trim(), type, createdAt: now() });
      setName(''); setBusy(false);
      toast.success('Resource added.');
    } catch { toast.error('Failed.'); setBusy(false); }
  }

  async function remove(id) {
    await deleteDoc(doc(db, 'resources', id));
    toast.success('Removed.');
  }

  const inp = 'flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Manage resources</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16}/></button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 rounded-lg px-3 py-2 text-sm">
              <span>{r.name} <span className="text-slate-400">({r.type})</span></span>
              <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-500 p-1"><X size={12}/></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Resource name" className={inp}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900">
            {RESOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={add} disabled={busy || !name.trim()}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
