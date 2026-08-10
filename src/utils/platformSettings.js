// src/utils/platformSettings.js
//
// FEATURE (Admin Settings - editable Help contact details): the
// WhatsApp/Call/Email numbers shown in Help modals across every portal
// used to be hardcoded constants in HelpButton.jsx. Numbers change,
// WhatsApp Business numbers get suspended/banned, so admin now needs to
// be able to update these from the Admin Settings tab without a code
// deploy. This is a tiny framework-free store (subscribe/notify) rather
// than a React Context so it can be read from both components and plain
// utility functions (e.g. BaPortal.jsx's WhatsApp reminder) alike.
//
// Falls back to the last-known-good hardcoded numbers if the backend is
// unreachable (offline, first paint before the fetch resolves, etc.) so
// Help is never blank.
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export const DEFAULT_HELP_CONTACTS = {
  helpWhatsapp: '+254710888917',
  helpCall: '254710888917',
  helpEmail: 'support@rentapay.co.ke',
};

let current = { ...DEFAULT_HELP_CONTACTS };
let loadingPromise = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(current);
    } catch {
      // a listener throwing shouldn't break the others
    }
  });
}

export function getPlatformContacts() {
  return current;
}

export function subscribePlatformContacts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Called once from App.jsx on first mount, and again after an admin
// saves changes in Settings so every open tab/portal picks it up
// without a full page reload.
export async function loadPlatformContacts() {
  if (loadingPromise) return loadingPromise;
  loadingPromise = api
    .getPublicHelpContacts()
    .then((res) => {
      current = {
        helpWhatsapp: res?.helpWhatsapp || DEFAULT_HELP_CONTACTS.helpWhatsapp,
        helpCall: res?.helpCall || DEFAULT_HELP_CONTACTS.helpCall,
        helpEmail: res?.helpEmail || DEFAULT_HELP_CONTACTS.helpEmail,
      };
      notify();
      return current;
    })
    .catch(() => current)
    .finally(() => {
      loadingPromise = null;
    });
  return loadingPromise;
}

// Optimistic local update used right after AdminHelpContactSettings
// saves successfully - avoids waiting on a network round trip to
// reflect the admin's own change back to them.
export function setPlatformContacts(partial) {
  current = { ...current, ...partial };
  notify();
}

// Convenience hook for components (HelpButton, Faq, ManualPaymentHelp,
// BaPortal) - re-renders automatically if an admin updates the numbers
// while the tab is open.
export function useHelpContacts() {
  const [contacts, setContacts] = useState(current);
  useEffect(() => {
    const unsubscribe = subscribePlatformContacts(setContacts);
    loadPlatformContacts();
    return unsubscribe;
  }, []);
  return contacts;
}
