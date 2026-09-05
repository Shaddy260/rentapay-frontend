import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigate as useNavigate } from '../hooks/useAppNavigate.js';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { api, ApiError } from '../api/client.js';
import './AddTenant.css';
import Skeleton from '../components/Skeleton.jsx';
import InfoTip from '../components/InfoTip.jsx';
import { isRequired, isValidEmail, isValidPhone, isValidDueDay, isValidPositiveNumber, fieldErrorsFromApi } from '../utils/validators.js';

/**
 * Blueprint section 4: Tenant Onboarding. Reached from a vacant unit's
 * "+ Add Tenant" button on the dashboard/unit detail page.
 */
export default function AddTenant() {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { message } | null
  const [fieldErrors, setFieldErrors] = useState({}); // Phase 2: per-field inline validation

  const [form, setForm] = useState({
    fullName: '',
    primaryPhone: '',
    secondaryPhone: '',
    email: '',
    idNumber: '',
    moveInDate: new Date().toISOString().slice(0, 10),
    rentOverride: '',
    dueDayOfMonth: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    depositAmount: '',
    depositPaidAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    const token = localStorage.getItem('rentapay_token');
    if (!token) {
      navigate('/login');
      return;
    }
    api
      .getUnit(unitId, token)
      .then((res) => setUnit(res.unit))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [unitId, navigate]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Phase 2: client-side checks mirror the backend Zod schemas so a
  // field error is visible before the round trip; backend 400s that
  // carry a `fields` map (validate.middleware.js) are mapped onto the
  // same inline errors.
  function validateForm() {
    const errors = {};
    if (!isRequired(form.fullName)) errors.fullName = 'Full name is required.';
    if (!isValidPhone(form.primaryPhone)) errors.primaryPhone = 'Enter a valid Kenyan phone number (e.g. 07XXXXXXXX or 2547XXXXXXXX).';
    if (form.secondaryPhone && !isValidPhone(form.secondaryPhone)) errors.secondaryPhone = 'Enter a valid Kenyan phone number.';
    if (form.email && !isValidEmail(form.email)) errors.email = 'Enter a valid email address.';
    if (form.rentOverride && !isValidPositiveNumber(form.rentOverride)) errors.rentOverride = 'Enter a positive amount.';
    if (form.dueDayOfMonth && !isValidDueDay(form.dueDayOfMonth)) errors.dueDayOfMonth = 'Due day must be a whole number between 1 and 31.';
    if (form.depositAmount && !isValidPositiveNumber(form.depositAmount)) errors.depositAmount = 'Enter a positive amount.';
    if (form.emergencyContactPhone && !isValidPhone(form.emergencyContactPhone)) errors.emergencyContactPhone = 'Enter a valid Kenyan phone number.';
    return errors;
  }

  function FieldError({ name }) {
    if (!fieldErrors[name]) return null;
    return <p className="add-tenant-field-error" role="alert">{fieldErrors[name]}</p>;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await submitTenant(false);
  }

  async function submitTenant(confirmDuplicate) {
    setError('');
    setFieldErrors({});
    const token = localStorage.getItem('rentapay_token');

    setSubmitting(true);
    try {
      await api.addTenant(
        {
          unitId,
          fullName: form.fullName,
          primaryPhone: form.primaryPhone,
          secondaryPhone: form.secondaryPhone || undefined,
          email: form.email,
          idNumber: form.idNumber,
          moveInDate: form.moveInDate,
          rentOverride: form.rentOverride ? Number(form.rentOverride) : undefined,
          dueDayOfMonth: form.dueDayOfMonth ? Number(form.dueDayOfMonth) : undefined,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          depositAmount: form.depositAmount ? Number(form.depositAmount) : undefined,
          depositPaidAt: form.depositAmount ? form.depositPaidAt : undefined,
          confirmDuplicate: confirmDuplicate || undefined,
        },
        token
      );
      setDuplicateWarning(null);
      setSuccess(true);
      setTimeout(() => navigate(`/units/${unitId}`), 1500);
    } catch (err) {
      const fields = fieldErrorsFromApi(err);
      if (fields) setFieldErrors(fields);
      if (err instanceof ApiError && err.raw?.duplicateTenant) {
        setDuplicateWarning({ message: err.message });
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to add tenant.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="add-tenant-page add-tenant-page--center"><Skeleton rows={4} /></div>;

  if (error && !unit) {
    return (
      <div className="add-tenant-page add-tenant-page--center">
        <p>{error}</p>
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="add-tenant-page add-tenant-page--center">
        <div className="add-tenant-success">
          <span className="add-tenant-success__icon">✓</span>
          <h2>Tenant added</h2>
          <p>Login details have been sent via email.</p>
        </div>
      </div>
    );
  }

  if (unit?.tenantLocked) {
    return (
      <div className="add-tenant-page add-tenant-page--center">
        <p>
          This unit is not available for a tenant yet. Your free trial only opens tenants on your first {unit.trialTenantUnitLimit} units. Subscribe to unlock the rest.
        </p>
        <Button variant="primary" onClick={() => navigate('/subscription')}>Go to subscription</Button>
        <Button variant="ghost" onClick={() => navigate(`/units/${unitId}`)}>Back to unit</Button>
      </div>
    );
  }

  return (
    <div className="add-tenant-page">
      <header className="add-tenant-header">
        <button className="add-tenant-back" onClick={() => navigate(`/units/${unitId}`)}>← Back to unit</button>
        <h1>Add tenant to Unit {unit?.unit_name}</h1>
        <p className="add-tenant-subtitle">
          Rent prefilled from the unit (KES {Number(unit?.rent_amount || 0).toLocaleString()}) - override below if this tenant pays differently.
        </p>
      </header>

      {error && <div className="add-tenant-error">{error}</div>}

      <form className="add-tenant-form" onSubmit={handleSubmit}>
        <div className="add-tenant-grid">
          <div className="form-field form-field--full">
            <label className="form-field__label">Full name *</label>
            <input required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="John Kamau" />
            <FieldError name="fullName" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Primary phone *</label>
            <input required value={form.primaryPhone} onChange={(e) => update('primaryPhone', e.target.value)} placeholder="07XXXXXXXX or 2547XXXXXXXX" />
            <FieldError name="primaryPhone" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Secondary phone</label>
            <input value={form.secondaryPhone} onChange={(e) => update('secondaryPhone', e.target.value)} placeholder="Optional" />
            <FieldError name="secondaryPhone" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Email *</label>
            <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="tenant@example.com" />
            <FieldError name="email" />
          </div>
          <div className="form-field">
            <label className="form-field__label">ID number *</label>
            <input required value={form.idNumber} onChange={(e) => update('idNumber', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Move-in date *</label>
            <input type="date" required value={form.moveInDate} onChange={(e) => update('moveInDate', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Rent override (KES)</label>
            <input type="number" value={form.rentOverride} onChange={(e) => update('rentOverride', e.target.value)} placeholder={`Default: ${unit?.rent_amount}`} />
            <FieldError name="rentOverride" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Due date override (day of month)</label>
            <input type="number" min="1" max="28" value={form.dueDayOfMonth} onChange={(e) => update('dueDayOfMonth', e.target.value)} placeholder={`Default: ${unit?.due_day_of_month}`} />
            <FieldError name="dueDayOfMonth" />
          </div>
          <div className="form-field">
            <label className="form-field__label">Security deposit paid (KES)<InfoTip text="Refundable at move-out, separate from rent - this is not added to what the tenant owes." /></label>
            <input type="number" min="0" value={form.depositAmount} onChange={(e) => update('depositAmount', e.target.value)} placeholder="Leave blank if none was collected" />
            <FieldError name="depositAmount" />
          </div>
          {form.depositAmount ? (
            <div className="form-field">
              <label className="form-field__label">Deposit paid on</label>
              <input type="date" value={form.depositPaidAt} onChange={(e) => update('depositPaidAt', e.target.value)} />
            </div>
          ) : null}
          <div className="form-field">
            <label className="form-field__label">Emergency contact name *</label>
            <input required value={form.emergencyContactName} onChange={(e) => update('emergencyContactName', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-field__label">Emergency contact phone *</label>
            <input required value={form.emergencyContactPhone} onChange={(e) => update('emergencyContactPhone', e.target.value)} />
            <FieldError name="emergencyContactPhone" />
          </div>
        </div>

        <Button type="submit" variant="primary" loading={submitting}>Add tenant and send login details</Button>
      </form>

      <ConfirmDialog
        open={!!duplicateWarning}
        title="Possible duplicate tenant"
        message={duplicateWarning?.message}
        confirmLabel="Add anyway"
        cancelLabel="Cancel"
        danger={false}
        busy={submitting}
        onConfirm={() => submitTenant(true)}
        onCancel={() => setDuplicateWarning(null)}
      />
    </div>
  );
}
