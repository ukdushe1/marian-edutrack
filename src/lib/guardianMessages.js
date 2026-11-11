/**
 * Guardian message templates and WhatsApp helpers (browser side).
 *
 * Keep the wording in sync with TEMPLATES in functions/src/whatsapp.js, which
 * sends the same messages automatically once the project is on the Blaze plan.
 *
 * Privacy (Zimbabwe CDPA 2021): messages use the student's first name only —
 * never surnames or candidate numbers.
 */

export const MESSAGE_TYPES = {
  'report-ready': {
    label: 'Report ready',
    text:  (name) => `Hello, the school report for ${name} is now available on Marian EduTrack.`,
  },
  'absent-today': {
    label: 'Absent today',
    text:  (name) => `Hello, ${name} was marked absent from school today. Please contact the school if you were not aware.`,
  },
  'attendance-low': {
    label: 'Low attendance',
    text:  (name) => `Hello, ${name}'s attendance has fallen below 80%. Please contact the school.`,
  },
  'exeat-return': {
    label: 'Exeat return reminder',
    text:  (name) => `Hello, this is a reminder that ${name}'s exeat pass expires today.`,
  },
  'custom': {
    label: 'Custom message',
    text:  (_name, detail) => `Marian High School notice: ${detail ?? ''}`.trim(),
  },
};

export const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Grandparent', 'Sibling', 'Sponsor', 'Other'];

const SIGN_OFF = '\n\n— Marian High School';

/** First name only, as required for outbound messages. */
export function studentFirstName(student) {
  return String(student?.preferredName || student?.firstName || '').trim().split(/\s+/)[0] || 'your child';
}

/** Build the message body for a type. */
export function buildMessage(messageType, student, detail) {
  const t = MESSAGE_TYPES[messageType] ?? MESSAGE_TYPES.custom;
  return t.text(studentFirstName(student), detail);
}

/**
 * Normalise a number to digits-only international form ("263771234567").
 * Accepts "+263 77 123 4567", "263771234567", "00263…" or local "0771234567" (Zimbabwe).
 * Returns null if it doesn't look like a valid number. Mirrors normaliseNumber() in the
 * Cloud Function.
 */
export function normaliseNumber(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = '263' + digits.slice(1);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** Pretty display form, e.g. "+263 77 123 4567". */
export function formatNumber(raw) {
  const n = normaliseNumber(raw);
  if (!n) return raw ?? '';
  if (n.startsWith('263') && n.length === 12) return `+263 ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  return `+${n}`;
}

/** Why a guardian can't be messaged, or null if they can. */
export function cannotMessageReason(guardian) {
  if (guardian?.consentWhatsApp !== true) return 'No WhatsApp consent on record';
  if (!normaliseNumber(guardian?.whatsappNumber)) return 'No valid WhatsApp number';
  return null;
}

/** wa.me click-to-chat link with the message pre-filled. */
export function whatsAppLink(guardian, body) {
  const n = normaliseNumber(guardian?.whatsappNumber);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(body + SIGN_OFF)}`;
}
