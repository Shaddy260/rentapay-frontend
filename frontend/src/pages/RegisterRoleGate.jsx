import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import HeroPhotoBackground from '../components/HeroPhotoBackground.jsx';
import Button from '../components/Button.jsx';
import './RegisterRoleGate.css';

// DIRECT REQUEST: tenants were landing on the landlord setup wizard
// and creating landlord accounts by mistake, since nothing stopped
// them getting there. This gate now sits in front of that wizard.
// Nobody reaches /register/setup without first saying, in plain
// words, which of these three they are:
//
//   Landlord               -> straight into the setup wizard.
//   Tenant                 -> never reaches the wizard at all. Shown
//                              a clear message instead: a landlord has
//                              to add them, they cannot sign up here.
//   Property Manager       -> asked one more question, since this
//                              covers two very different situations:
//                              managing independently on their own
//                              account (goes into the same wizard as
//                              a landlord, just addressed afterward as
//                              Property Manager, see roleLabel.js), or
//                              working under a landlord as staff (same
//                              "a landlord/employer has to add you"
//                              message as the tenant path).

const ROLE_OPTIONS = [
  {
    id: 'landlord',
    title: 'Landlord',
    description: 'I own a property and want to manage it, collect rent, and track tenants myself.',
  },
  {
    id: 'tenant',
    title: 'Tenant',
    description: 'I rent a unit and want to view my balance, pay rent, and message my landlord.',
  },
  {
    id: 'manager',
    title: 'Property Manager',
    description: 'I manage a rental property, whether or not I own it.',
  },
];

const MANAGER_SUB_OPTIONS = [
  {
    id: 'independent',
    title: 'I manage independently, on my own account',
    description: 'You are not staff under a landlord. You will set up your own account, the same way a landlord does.',
  },
  {
    id: 'under_landlord',
    title: 'I manage a property under a landlord, as their manager or caretaker',
    description: 'You work for a landlord who already has, or will have, a RentaPay account.',
  },
];

export default function RegisterRoleGate() {
  const navigate = useNavigate();
  // 'choose' | 'manager_sub' | 'tenant_message' | 'manager_message'
  const [view, setView] = useState('choose');
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedManagerSub, setSelectedManagerSub] = useState(null);

  function markGatePassed() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('rentapay_signup_gate_passed', 'true');
    }
  }

  function handleContinue() {
    if (selectedRole === 'landlord') {
      markGatePassed();
      navigate('/register/setup?as=landlord');
      return;
    }
    if (selectedRole === 'tenant') {
      setView('tenant_message');
      return;
    }
    if (selectedRole === 'manager') {
      setView('manager_sub');
      return;
    }
  }

  function handleManagerSubContinue() {
    if (selectedManagerSub === 'independent') {
      markGatePassed();
      navigate('/register/setup?as=manager');
      return;
    }
    if (selectedManagerSub === 'under_landlord') {
      setView('manager_message');
      return;
    }
  }

  function backToChoose() {
    setView('choose');
    setSelectedManagerSub(null);
  }

  return (
    <div className="register-gate">
      <HeroPhotoBackground
        wrapClassName="register-gate__photo-bg"
        photoClassName="register-gate__photo"
        overlayClassName="register-gate__photo-overlay"
      />
      <main className="register-gate__main">
        <div className="register-gate__panel">
          {view === 'choose' && (
            <>
              <h1>How will you use RentaPay?</h1>
              <p className="register-gate__intro">Choose the option that describes you, then continue.</p>

              <div className="register-gate__options" role="group" aria-label="Account type">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={`register-gate__option${selectedRole === opt.id ? ' register-gate__option--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRole === opt.id}
                      onChange={() => setSelectedRole(opt.id)}
                    />
                    <span className="register-gate__option-text">
                      <span className="register-gate__option-title">Create account as a {opt.title}</span>
                      <span className="register-gate__option-description">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </div>

              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={!selectedRole}
                onClick={handleContinue}
              >
                Continue
              </Button>

              <p className="register-gate__login-link">
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            </>
          )}

          {view === 'manager_sub' && (
            <>
              <button type="button" className="register-gate__back" onClick={backToChoose}>
                ← Back
              </button>
              <h1>One more thing</h1>
              <p className="register-gate__intro">
                Property managers fall into two different situations. Pick the one that matches you.
              </p>

              <div className="register-gate__options" role="group" aria-label="Property manager type">
                {MANAGER_SUB_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={`register-gate__option${selectedManagerSub === opt.id ? ' register-gate__option--selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedManagerSub === opt.id}
                      onChange={() => setSelectedManagerSub(opt.id)}
                    />
                    <span className="register-gate__option-text">
                      <span className="register-gate__option-title">{opt.title}</span>
                      <span className="register-gate__option-description">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </div>

              <Button
                type="button"
                variant="primary"
                fullWidth
                disabled={!selectedManagerSub}
                onClick={handleManagerSubContinue}
              >
                Continue
              </Button>
            </>
          )}

          {view === 'tenant_message' && (
            <div className="register-gate__notice" role="alert">
              <h1>Tenants do not sign up here</h1>
              <p className="register-gate__notice-text">
                You will not create your own account on this page. Your landlord adds you,
                either by sending you an onboarding link to fill in your own details, or by
                adding you directly themselves.
              </p>
              <p className="register-gate__notice-text">
                Either way, you will receive your login details by email. Use those details
                to log in directly. There is nothing to sign up for.
              </p>
              <div className="register-gate__notice-actions">
                <Button type="button" variant="primary" fullWidth onClick={() => navigate('/login')}>
                  Go to login
                </Button>
                <button type="button" className="register-gate__back register-gate__back--centered" onClick={backToChoose}>
                  ← Back to account type
                </button>
              </div>
            </div>
          )}

          {view === 'manager_message' && (
            <div className="register-gate__notice" role="alert">
              <h1>Ask your landlord to add you</h1>
              <p className="register-gate__notice-text">
                As a manager or caretaker working under a landlord, you do not create your
                own account here. Ask that landlord to add you as a manager or caretaker on
                their RentaPay account.
              </p>
              <p className="register-gate__notice-text">
                Once they do, you will receive your login details by email. Use those
                details to log in directly. There is nothing to sign up for.
              </p>
              <div className="register-gate__notice-actions">
                <Button type="button" variant="primary" fullWidth onClick={() => navigate('/login')}>
                  Go to login
                </Button>
                <button type="button" className="register-gate__back register-gate__back--centered" onClick={() => setView('manager_sub')}>
                  ← Back
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
