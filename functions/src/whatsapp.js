/**
 * WhatsApp alert Cloud Function — Phase 4 stub.
 *
 * Security requirements (Zimbabwe Cyber and Data Protection Act, 2021):
 *  - Only send to guardians who have given explicit WhatsApp consent (consentWhatsApp: true).
 *  - Never include candidate numbers, full surnames, or contacts in the message payload
 *    sent to the AI model — only first names and IDs.
 *  - Every outbound message is logged in messageLog/{auto-id} for audit.
 *  - The WhatsApp API key lives ONLY in Firebase Functions secret: WHATSAPP_TOKEN.
 *    It is never stored in Firestore or in the browser.
 *
 * To activate:
 *  1. Set the secret: firebase functions:secrets:set WHATSAPP_TOKEN
 *  2. Add your META_PHONE_ID to the runtime config or as a secret.
 *  3. Replace the stub fetch below with a real WhatsApp Cloud API call.
 *  4. Deploy: firebase deploy --only functions
 */
const functions = require('firebase-functions');
const admin     = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** Callable: sendWhatsAppAlert({ guardianId, messageType, studentFirstName, detail }) */
exports.sendWhatsAppAlert = functions
  .runWith({ secrets: ['WHATSAPP_TOKEN'] })
  .https.onCall(async (data, context) => {
    // Auth check: only staff roles may trigger alerts
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
    const claims = context.auth.token;
    const allowedRoles = ['superAdmin', 'head', 'tutor', 'boardingMaster'];
    if (!allowedRoles.some((r) => claims[r])) {
      throw new functions.https.HttpsError('permission-denied', 'Insufficient role.');
    }

    const { guardianId, messageType, studentFirstName, detail } = data;
    if (!guardianId || !messageType) {
      throw new functions.https.HttpsError('invalid-argument', 'guardianId and messageType required.');
    }

    // Load guardian — check consent before sending
    const guardianDoc = await db.collection('guardians').doc(guardianId).get();
    if (!guardianDoc.exists) throw new functions.https.HttpsError('not-found', 'Guardian not found.');
    const guardian = guardianDoc.data();

    if (!guardian.consentWhatsApp) {
      throw new functions.https.HttpsError('failed-precondition', 'Guardian has not consented to WhatsApp messages.');
    }
    if (!guardian.whatsappNumber) {
      throw new functions.https.HttpsError('failed-precondition', 'No WhatsApp number on record.');
    }

    // Build message text — ONLY first name, no candidate numbers or surnames
    const templates = {
      'report-ready':  `Hello, the school report for ${studentFirstName} is now available on Marian EduTrack.`,
      'attendance-low': `Hello, ${studentFirstName}'s attendance has fallen below 80%. Please contact the school.`,
      'exeat-return':  `Hello, this is a reminder that ${studentFirstName}'s exeat pass expires today.`,
      'custom':         detail ?? 'You have a new notification from Marian High School.',
    };
    const body = templates[messageType] ?? templates['custom'];

    // ── STUB: replace with real WhatsApp Cloud API call ──────────────────────
    // const token   = process.env.WHATSAPP_TOKEN;
    // const phoneId = process.env.META_PHONE_ID;
    // await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     messaging_product: 'whatsapp',
    //     to: guardian.whatsappNumber,
    //     type: 'text',
    //     text: { body },
    //   }),
    // });
    // ── END STUB ─────────────────────────────────────────────────────────────

    // Audit log — write regardless of whether the stub sends
    await db.collection('messageLog').add({
      to:          guardian.whatsappNumber,
      guardianId,
      messageType,
      body,
      sentBy:      context.auth.uid,
      channel:     'whatsapp',
      status:      'stub', // change to 'sent' when real API is wired
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, status: 'stub' };
  });
