// src/utils/notifySound.js
//
// FEATURE (direct request: "we should have our own unique
// notification... a unique sound it makes to notify the user, in
// browser and in app"): every portal already polls the same
// notifications endpoint via NotificationsBell, but nothing ever
// played a sound or raised a popup when something NEW landed - the
// badge count just silently changed. This gives RentaPay a small,
// synthesized two-tone chime (no external mp3 to fetch/host, so it
// works instantly offline/on a slow connection too) plus a real
// browser Notification popup when the tab isn't focused, so a
// landlord/tenant/manager/caretaker/admin gets a plain, this-is-
// RentaPay-not-something-else audio+visual cue no matter which portal
// they're in.

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

// A short, distinct rising two-note chime (soft sine tones) - not a
// generic "ding", so it's recognizably RentaPay's own sound rather
// than indistinguishable from every other app's default alert.
export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const notes = [
      { freq: 740, start: 0, dur: 0.12 },   // F#5
      { freq: 988, start: 0.11, dur: 0.18 }, // B5
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch {
    // Sound is a nice-to-have, never worth breaking the app over
    // (autoplay restrictions before any user gesture, unsupported
    // browser, etc.) - fail silently.
  }
}

// One-time permission request, called lazily the first time something
// actually needs to pop up rather than on every page load (browsers
// increasingly ignore/penalize permission prompts fired unprompted).
export function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Real OS/browser-level popup - only fires when the tab is actually in
// the background, since a foreground tab already gets the in-app
// toast (see NotificationToast.jsx) and showing both would be doubled
// noise for no benefit.
export function showBrowserNotification(title, body) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (document.visibilityState === 'visible') return;
    if (Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      tag: 'rentapay-notification', // collapses rapid-fire notifications into one instead of stacking a dozen
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Same reasoning as playNotificationChime - never let a popup
    // failure interrupt the rest of the app.
  }
}
