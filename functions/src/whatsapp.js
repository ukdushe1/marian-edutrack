/**
 * WhatsApp guardian alerts — Cloud Function (Phase 4).
 *
 * Security requirements (Zimbabwe Cyber and Data Protection Act, 2021):
 *  - Only send to guardians who have given explicit WhatsApp consent (consentWhatsApp: true).
 *  - Messages carry only the student's first name — never candidate numbers or surnames.
 *  - Every attempt (sent, failed, or blocked) is logged in messageLog/{auto-id} for audit.
 *  - The WhatsApp access token lives ONLY in the Functions secret WHATSAPP_TOKEN.
 *    It is never stored in Firestore or sent to the browser.
 *
 * Setup:
 *  1. In Meta Business Manager → WhatsApp → Message templates, create and get approved
 *     the templates listed in TEMPLATES below (language: English "en"). Each has one
 *     body variable {{1}}:
 *       report_ready      "Hello, the school report for {{1}} is now available on Marian EduTrack."
 *       absent_today      "Hello, {{1}} was marked absent from school today. Please contact the school if you were not aware."
 *       attendance_low    "Hello, {{1}}'s attendance has fallen below 80%. Please contact the school."
 *       exeat_return      "Hello, this is a reminder that {{1}}'s exeat pass expires today."
 *       school_notice     "Marian High School notice: {{1}}"
 *  2. firebase functions:secrets:set WHATSAPP_TOKEN      (permanent system-user token)
 *     firebase functions:secrets:set WHATSAPP_PHONE_ID   (phone number ID, not the phone number)
 *  3. firebase deploy --only functions
 *
 * Business-initiated WhatsApp messages MUST use an approved template; free-form text is
 * rejected by Meta outside a 24-hour customer-service window, so this function only sends
 * templates.
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin  = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const WHATSAPP_TOKEN    = defineSecret('WHATSAPP_TOKEN');
const WHATSAPP_PHONE_ID = defineSecret('WHATSAPP_PHONE_ID');
const GRAPH_API_VERSION = defineString('WHATSAPP_API_VERSION', { default: 'v22.0' });

const ALLOWED_ROLES = ['superAdmin', 'head', 'tutor', 'boardingMaster'];

/** messageType → approved Meta template + the text we log for audit. */
const TEMPLATES = {
  'report-ready':   { name: 'report_ready',   preview: (v) => `Hello, the school report for ${v} is now available on Marian EduTrack.` },
  'absent-today':   { name: 'absent_today',   preview: (v) => `Hello, ${v} was marked absent from school today. Please contact the school if you were not aware.` },
  'attendance-low': { name: 'attendance_low', preview: (v) => `Hello, ${v}'s attendance has fallen below 80%. Please contact the school.` },
  'exeat-return':   { name: 'exeat_return',   preview: (v) => `Hello, this is a reminder that ${v}'s exeat pass expires today.` },
  'custom':         { name: 'school_notice',  preview: (v) => `Marian High School notice: ${v}` },
};
const TEMPLATE_LANGUAGE = 'en';
const MAX_PARAM_LENGTH  = 500;

/**
 * Template variables may not contain newlines, tabs or 4+ consecutive spaces.
 * Collapse whitespace and cap length so Meta doesn't reject the message.
 */
function cleanParam(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PARAM_LENGTH);
}

/**
 * Normalise a stored number to the digits-only international form Meta expects.
 * Accepts "+263 77 123 4567", "263771234567" or local "0771234567" (assumed Zimbabwe).
 * Returns null if the result doesn't look like a valid international number.
 */
function normaliseNumber(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = '263' + digits.slice(1);
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

async function logAttempt(entry) {
  await db.collection('messageLog').add({
    channel:   'whatsapp',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ...entry,
  });
}

async function postToWhatsApp({ to, template, param }) {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION.value()}/${WHATSAPP_PHONE_ID.value()}/messages`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${WHATSAPP_TOKEN.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type:    'individual',
      to,
      type: 'template',
      template: {
        name:     template,
        language: { code: TEMPLATE_LANGUAGE },
        components: [{ type: 'body', parameters: [{ type: 'text', text: param }] }],
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json.error ?? {};
    const e = new Error(err.message ?? `WhatsApp API returned HTTP ${res.status}`);
    e.code = err.code ?? res.status;
    throw e;
  }
  return json.messages?.[0]?.id ?? null;
}

/**
 * Callable: sendWhatsAppAlert({ guardianId, messageType, studentFirstName?, detail? })
 *   messageType: 'report-ready' | 'attendance-low' | 'exeat-return' | 'custom'
 *   studentFirstName is required for all types except 'custom'; detail is required for 'custom'.
 * Returns { success: true, status: 'sent', messageId }.
 */
exports.sendWhatsAppAlert = onCall(
  { region: 'us-central1', secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID] },
  async (request) => {
    // Auth: only staff roles may trigger alerts. Roles are a custom-claims array.
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
    const roles = Array.isArray(request.auth.token.roles) ? request.auth.token.roles : [];
    if (!roles.some((r) => ALLOWED_ROLES.includes(r))) {
      throw new HttpsError('permission-denied', 'Insufficient role.');
    }

    const { guardianId, messageType, studentFirstName, detail } = request.data ?? {};
    const template = TEMPLATES[messageType];
    if (typeof guardianId !== 'string' || !guardianId || !template) {
      throw new HttpsError('invalid-argument',
        `guardianId and a valid messageType (${Object.keys(TEMPLATES).join(', ')}) are required.`);
    }

    // First name only — strip anything after the first word in case a full name was passed.
    const param = messageType === 'custom'
      ? cleanParam(detail)
      : cleanParam(studentFirstName).split(' ')[0];
    if (!param) {
      throw new HttpsError('invalid-argument',
        messageType === 'custom' ? 'detail is required for custom messages.' : 'studentFirstName is required.');
    }

    const sentBy = request.auth.uid;
    const base   = { guardianId, messageType, template: template.name, body: template.preview(param), sentBy };

    // Consent and number checks before anything leaves the school.
    const guardianDoc = await db.collection('guardians').doc(guardianId).get();
    if (!guardianDoc.exists) throw new HttpsError('not-found', 'Guardian not found.');
    const guardian = guardianDoc.data();

    if (guardian.consentWhatsApp !== true) {
      await logAttempt({ ...base, status: 'blocked', reason: 'no-consent' });
      throw new HttpsError('failed-precondition', 'Guardian has not consented to WhatsApp messages.');
    }
    const to = normaliseNumber(guardian.whatsappNumber);
    if (!to) {
      await logAttempt({ ...base, status: 'blocked', reason: 'invalid-number' });
      throw new HttpsError('failed-precondition', 'No valid WhatsApp number on record.');
    }

    try {
      const messageId = await postToWhatsApp({ to, template: template.name, param });
      await logAttempt({ ...base, to, status: 'sent', messageId });
      return { success: true, status: 'sent', messageId };
    } catch (err) {
      logger.error('WhatsApp send failed', { guardianId, messageType, code: err.code, message: err.message });
      await logAttempt({ ...base, to, status: 'failed', errorCode: err.code ?? null, error: err.message });
      throw new HttpsError('unavailable', 'WhatsApp message could not be sent. It has been logged; try again later.');
    }
  },
);

// Exported for unit tests.
exports._internal = { normaliseNumber, cleanParam };
