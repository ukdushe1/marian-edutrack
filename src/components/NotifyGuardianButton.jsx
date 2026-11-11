/**
 * "Notify guardian" — opens a panel listing the student's guardians with a
 * pre-filled WhatsApp message. Staff tap a guardian to open WhatsApp (app or
 * WhatsApp Web) and press Send themselves. Each opened link is logged in
 * messageLog for audit. Guardians without consent are shown but cannot be messaged.
 */
import { useState, useEffect } from 'react';
import { MessageCircle, X, ShieldAlert, Loader2, Send } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  guardiansCol, messageLogCol, query, where, getDocs, addDoc, now,
} from '../firebase/firestore';
import {
  MESSAGE_TYPES, buildMessage, cannotMessageReason, whatsAppLink, formatNumber, studentFirstName,
} from '../lib/guardianMessages';

export default function NotifyGuardianButton({ student, messageType, detail, label, compact = false, className }) {
  const [open, setOpen] = useState(false);
  const text = label ?? 'Notify guardian';

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={`${text} — ${MESSAGE_TYPES[messageType]?.label ?? ''}`}
        className={clsx(
          'inline-flex items-center gap-1.5 font-medium rounded-lg border transition-colors',
          'border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/30',
          compact ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5',
          className,
        )}
      >
        <MessageCircle size={compact ? 12 : 14} />
        {compact ? <span className="sr-only sm:not-sr-only">{text}</span> : text}
      </button>
      {open && (
        <NotifyPanel student={student} messageType={messageType} detail={detail} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function NotifyPanel({ student, messageType, detail, onClose }) {
  const { firebaseUser } = useAuth();
  const [guardians, setGuardians] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  const [customText, setCustomText] = useState(detail ?? '');

  useEffect(() => {
    let cancelled = false;
    getDocs(query(guardiansCol(), where('studentIds', 'array-contains', student.id)))
      .then((snap) => {
        if (cancelled) return;
        // Messageable guardians first
        setGuardians(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => Number(!cannotMessageReason(b)) - Number(!cannotMessageReason(a))));
      })
      .catch(() => { if (!cancelled) { setLoadError(true); setGuardians([]); } });
    return () => { cancelled = true; };
  }, [student.id]);

  const isCustom = messageType === 'custom';
  const body = buildMessage(messageType, student, isCustom ? customText : detail);
  const canSend = !isCustom || customText.trim().length > 0;

  function logOpened(guardian) {
    // Fire-and-forget audit entry; offline writes sync later.
    addDoc(messageLogCol(), {
      channel:     'whatsapp-link',
      status:      'opened',
      guardianId:  guardian.id,
      studentId:   student.id,
      messageType,
      body,
      sentBy:      firebaseUser.uid,
      createdAt:   now(),
    }).catch(() => toast.error('Message opened, but the audit log could not be saved.'));
    toast.success(`WhatsApp opened for ${guardian.name}. Press Send in WhatsApp.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Notify guardian">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Notify guardian</h2>
            <p className="text-xs text-slate-500">{studentFirstName(student)} · {MESSAGE_TYPES[messageType]?.label}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={16} /></button>
        </div>

        {isCustom ? (
          <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} rows={3}
            placeholder="Type the message…"
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        ) : (
          <div className="text-sm bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300">
            {body}
          </div>
        )}

        <div className="space-y-2">
          {guardians === null && (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading guardians…</p>
          )}
          {loadError && <p className="text-sm text-red-600">Could not load guardians. Check your connection.</p>}
          {guardians?.length === 0 && !loadError && (
            <p className="text-sm text-slate-500">
              No guardians are linked to this student yet. An admin can add them under <strong>Guardians</strong>.
            </p>
          )}
          {guardians?.map((g) => {
            const reason = cannotMessageReason(g);
            const href   = reason || !canSend ? null : whatsAppLink(g, body);
            return (
              <div key={g.id} className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {g.relationship}{g.whatsappNumber ? ` · ${formatNumber(g.whatsappNumber)}` : ''}
                  </p>
                  {reason && (
                    <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      <ShieldAlert size={11} /> {reason}
                    </p>
                  )}
                </div>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => logOpened(g)}
                    className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors shrink-0">
                    <Send size={12} /> WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 px-2 shrink-0">{reason ? 'Unavailable' : 'Add text'}</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">
          Only the first name is included. Each message you open is logged for audit.
        </p>
      </div>
    </div>
  );
}
