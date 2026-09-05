// Section 5 (Reminders - WhatsApp channel): a pure client-side
// `wa.me` deep link builder. Opening this URL opens WhatsApp on the
// landlord's own device/number with the message pre-filled - the
// landlord still has to tap "Send" themselves. No WhatsApp Business
// API integration is used or required anywhere here.

// wa.me wants digits only, no leading "+". Numbers in this app are
// already stored/normalised as 254XXXXXXXXX-style E.164-ish strings,
// but this strips anything else defensively (a stray "+", spaces).
function normalizeForWaMe(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

export function buildWaMeLink(phone, message) {
  const digits = normalizeForWaMe(phone);
  const encoded = encodeURIComponent(message || '');
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function openWhatsAppReminder(phone, message) {
  const url = buildWaMeLink(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
}
