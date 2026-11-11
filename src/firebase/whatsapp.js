import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

const callable = httpsCallable(functions, 'sendWhatsAppAlert');

/**
 * Send a WhatsApp alert to one guardian via the sendWhatsAppAlert Cloud Function.
 * The function checks the caller's role and the guardian's consent, and logs every attempt.
 *
 * @param {object} args
 * @param {string} args.guardianId        guardians/{id}
 * @param {'report-ready'|'absent-today'|'attendance-low'|'exeat-return'|'custom'} args.messageType
 * @param {string} [args.studentFirstName] required unless messageType is 'custom'
 * @param {string} [args.detail]           required when messageType is 'custom'
 * @returns {Promise<{ success: boolean, status: string, messageId: string|null }>}
 */
export async function sendWhatsAppAlert(args) {
  const { data } = await callable(args);
  return data;
}

/** Turn a callable error into a message suitable for a toast. */
export function whatsAppErrorMessage(err) {
  switch (err?.code) {
    case 'functions/failed-precondition':
    case 'functions/invalid-argument':
    case 'functions/not-found':
    case 'functions/permission-denied':
    case 'functions/unavailable':
      return err.message;
    case 'functions/unauthenticated':
      return 'Please sign in again.';
    default:
      return 'Could not send the WhatsApp message.';
  }
}
