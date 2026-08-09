import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { getCountySilently } from '../utils/geoCounty.js';
import './EngagementToast.css';

// DIRECT REQUEST: "random browser popups to random users... telling
// them of our services and another ones telling them of vacant
// listings... eg a unit just went vacant around you, check it out".
//
// Purely decorative/social-proof - no permission prompts here (that's
// VacancyAlertOptIn.jsx's job). Shows ~2s after the visitor first
// engages with a public page (any click/scroll/keypress counts - a
// visitor who never touches the page never sees it), then rotates on
// a loop for as long as they stay: real recent vacancies when one
// matches (or is otherwise available), generic promo copy the rest of
// the time. Rate-limited via localStorage so a visitor isn't shown
// one on literally every single page load in the same sitting.

const PROMO_MESSAGES = [
  { title: 'Never miss rent again', body: 'Landlords on RentaPay collect rent, send reminders, and track tenants — all in one place.' },
  { title: 'Looking for a home?', body: 'Browse verified vacant units across Kenya, free, no account needed.' },
  { title: 'List your vacant unit', body: 'Get it in front of thousands of house-hunters on RentaPay, today.' },
  { title: 'Rent collection, simplified', body: 'M-Pesa payments, receipts, and reminders — automatic, for every tenant.' },
];

const MIN_GAP_MS = 3 * 60 * 1000; // don't show more than once per ~3 min in a session
const LOOP_INTERVAL_MS = 55 * 1000; // how often a new one appears once the loop has started
const FIRST_DELAY_MS = 2000; // "after engaging with our page for maybe 2 seconds"
const AUTO_HIDE_MS = 8000;
const SESSION_KEY = 'rentapay_engagement_toast_last_shown';

function canShowNow() {
  try {
    const last = Number(sessionStorage.getItem(SESSION_KEY) || 0);
    return Date.now() - last > MIN_GAP_MS;
  } catch {
    return true;
  }
}
function markShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export default function EngagementToast() {
  const [toastData, setToastData] = useState(null); // { kind: 'vacancy'|'promo', title, body, unitId? }
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const engagedRef = useRef(false);
  const hideTimerRef = useRef(null);
  const loopTimerRef = useRef(null);
  const countyRef = useRef(null);

  async function buildNextToast() {
    try {
      if (countyRef.current === null) countyRef.current = (await getCountySilently()) || undefined;
      const { vacancy } = await api.getToastVacancy(countyRef.current || undefined);
      if (vacancy) {
        return {
          kind: 'vacancy',
          title: vacancy.county ? `A unit just went vacant in ${vacancy.county}` : 'A unit just went vacant',
          body: `"${vacancy.unitName}" is now available. Check it out on RentaPay.`,
          unitId: vacancy.unitId,
        };
      }
    } catch {
      // fall through to promo
    }
    const promo = PROMO_MESSAGES[Math.floor(Math.random() * PROMO_MESSAGES.length)];
    return { kind: 'promo', ...promo };
  }

  async function showNext() {
    if (!canShowNow()) return;
    const data = await buildNextToast();
    setToastData(data);
    setVisible(true);
    markShown();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }

  useEffect(() => {
    function onEngage() {
      if (engagedRef.current) return;
      engagedRef.current = true;
      setTimeout(() => {
        showNext();
        loopTimerRef.current = setInterval(showNext, LOOP_INTERVAL_MS);
      }, FIRST_DELAY_MS);
      window.removeEventListener('scroll', onEngage);
      window.removeEventListener('click', onEngage);
      window.removeEventListener('keydown', onEngage);
      window.removeEventListener('touchstart', onEngage);
    }
    window.addEventListener('scroll', onEngage, { passive: true, once: true });
    window.addEventListener('click', onEngage, { once: true });
    window.addEventListener('keydown', onEngage, { once: true });
    window.addEventListener('touchstart', onEngage, { passive: true, once: true });
    return () => {
      window.removeEventListener('scroll', onEngage);
      window.removeEventListener('click', onEngage);
      window.removeEventListener('keydown', onEngage);
      window.removeEventListener('touchstart', onEngage);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
    };
  }, []);

  if (!visible || !toastData) return null;

  function handleClick() {
    if (toastData.kind === 'vacancy') {
      navigate(`/find-a-house?unit=${toastData.unitId}`);
    } else {
      navigate('/find-a-house');
    }
    setVisible(false);
  }

  return (
    <div className={`engagement-toast engagement-toast--${toastData.kind}`} role="status">
      <button className="engagement-toast__dismiss" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); setVisible(false); }}>
        ×
      </button>
      <div className="engagement-toast__content" onClick={handleClick} role="button" tabIndex={0}>
        <p className="engagement-toast__title">{toastData.title}</p>
        <p className="engagement-toast__body">{toastData.body}</p>
        <span className="engagement-toast__cta">{toastData.kind === 'vacancy' ? 'View unit →' : 'Learn more →'}</span>
      </div>
    </div>
  );
}
