/** Private acceptance receipts, never message bodies or recipient/challenge identifiers. */
import {createHash} from 'node:crypto';
import {renderLoginCodeEmail} from './email-template.mjs';

export const RECEIPT_LIMIT = 100;
export const RECEIPT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Fixed inputs: hashing a real six-digit code would permit offline enumeration.
export const templateFingerprint = createHash('sha256').update(JSON.stringify(
  renderLoginCodeEmail({code:'000000', expiresAt:'2000-01-01T00:00:00.000Z'}),
)).digest('hex');

export async function providerAcceptanceId(response) {
  try {
    const data = await response.json();
    return typeof data?.id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(data.id)
      ? data.id.toLowerCase() : null;
  } catch { return null; } // A successful send must not fail because diagnostics are absent.
}

export function pruneMailReceipts(state, timestamp) {
  if (!state.mailReceipts) return;
  state.mailReceipts = state.mailReceipts
    .filter(receipt => Date.parse(receipt.retainUntil) > Date.parse(timestamp))
    .slice(-RECEIPT_LIMIT);
}

export function recordMailAcceptance(state, message, providerId, acceptedAt) {
  pruneMailReceipts(state, acceptedAt);
  state.mailReceipts ||= [];
  state.mailReceipts.push({
    providerId,
    providerIdStatus: providerId ? 'available' : 'unavailable',
    status: 'accepted', // Resend HTTP acceptance, not delivery or Inbox placement.
    acceptedAt,
    queuedAt: message.createdAt,
    templateFingerprint: /^[0-9a-f]{64}$/.test(message.templateFingerprint || '')
      ? message.templateFingerprint : null, // Legacy outbox must not inherit today's template.
    retainUntil: new Date(Date.parse(acceptedAt) + RECEIPT_TTL_MS).toISOString(),
  });
  state.mailReceipts = state.mailReceipts.slice(-RECEIPT_LIMIT);
}
