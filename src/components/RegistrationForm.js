// src/components/RegistrationForm.js
// Registration form with campus selection, promo codes, and custom fields
// FIXED: Handles checkout API call internally when onSuccess/onError are provided

'use client';

import { useState, useEffect } from 'react';

export default function RegistrationForm({
  event,
  selectedTicket,
  locale = 'en',
  onSubmit,
  onSuccess,
  onError,
  loading: externalLoading,
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState(null); // null | 'checking' | 'valid' | 'invalid'
  const [promoDiscount, setPromoDiscount] = useState(null);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isEnglish = locale === 'en';

  // Load campuses if required
  useEffect(() => {
    if (event?.campusRequired) {
      fetch('/api/campuses')
        .then((r) => r.json())
        .then((data) => setCampuses(data.campuses || []))
        .catch(() => console.log('Could not load campuses'));
    }
  }, [event?.campusRequired]);

  // Check URL for promo code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPromo = params.get('promo');
      if (urlPromo) {
        setPromoCode(urlPromo);
        validatePromo(urlPromo);
      }
    }
  }, []);

  const validatePromo = async (code) => {
    if (!code.trim()) {
      setPromoStatus(null);
      setPromoDiscount(null);
      return;
    }

    setPromoStatus('checking');
    try {
      const res = await fetch('/api/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), eventId: event?.id }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setPromoStatus('valid');
        setPromoDiscount(data);
      } else {
        setPromoStatus('invalid');
        setPromoDiscount(null);
      }
    } catch {
      setPromoStatus('invalid');
      setPromoDiscount(null);
    }
  };

  const getDiscountedPrice = () => {
    const basePrice = selectedTicket?.price ?? event?.price ?? 0;
    if (!promoDiscount) return basePrice;

    if (promoDiscount.discountType === 'percentage') {
      return Math.max(0, basePrice - basePrice * (promoDiscount.discountValue / 100));
    }
    return Math.max(0, basePrice - promoDiscount.discountValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(isEnglish ? 'Please fill in all required fields' : 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Validate email domain if restricted
    if (event?.emailDomain) {
      const allowedDomains = event.emailDomain.split(',').map((d) => d.trim().toLowerCase());
      const emailDomain = email.trim().split('@')[1]?.toLowerCase();
      if (!allowedDomains.includes(emailDomain)) {
        const domainError = isEnglish
          ? `Registration is restricted to @${event.emailDomain} email addresses`
          : `L'inscription est réservée aux adresses @${event.emailDomain}`;
        setError(domainError);
        return;
      }
    }

    if (event?.campusRequired && !campus) {
      setError(isEnglish ? 'Please select your campus' : 'Veuillez sélectionner votre campus');
      return;
    }

    // Validate required custom fields
    if (event?.customFields) {
      for (const field of event.customFields) {
        if (field.required && !customFieldValues[field.id]?.trim()) {
          setError(isEnglish ? `Please fill in: ${field.label}` : `Veuillez remplir: ${field.label}`);
          return;
        }
      }
    }

    const formData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      campus,
      promoCode: promoStatus === 'valid' ? promoCode.trim() : '',
      customFieldValues,
    };

    // If legacy onSubmit prop is provided, use it
    if (onSubmit) {
      onSubmit(formData);
      return;
    }

    // Otherwise, call the checkout API directly
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          ticketId: selectedTicket?.id || null,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          locale,
          promoCode: formData.promoCode,
          campus: formData.campus,
          customFieldValues: formData.customFieldValues,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.error || (isEnglish ? 'Registration failed. Please try again.' : "L'inscription a échoué. Veuillez réessayer.");
        setError(errMsg);
        if (onError) onError(errMsg);
        return;
      }

      // Free event — redirect to success page
      if (data.type === 'free' && data.redirectUrl) {
        if (onSuccess) {
          onSuccess(data.redirectUrl);
        } else {
          window.location.href = data.redirectUrl;
        }
        return;
      }

      // Paid event — redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Fallback error
      const fallbackErr = isEnglish ? 'Something went wrong. Please try again.' : "Une erreur s'est produite. Veuillez réessayer.";
      setError(fallbackErr);
      if (onError) onError(fallbackErr);
    } catch (err) {
      console.error('[RegistrationForm] Checkout error:', err);
      const errMsg = isEnglish ? 'Network error. Please check your connection and try again.' : 'Erreur réseau. Vérifiez votre connexion et réessayez.';
      setError(errMsg);
      if (onError) onError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const finalPrice = getDiscountedPrice();
  const basePrice = selectedTicket?.price ?? event?.price ?? 0;
  const isLoading = externalLoading || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.15)' }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEnglish ? 'First Name' : 'Prénom'} *
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="input w-full"
            placeholder={isEnglish ? 'First name' : 'Prénom'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEnglish ? 'Last Name' : 'Nom'} *
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="input w-full"
            placeholder={isEnglish ? 'Last name' : 'Nom'}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          Email *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input w-full"
          placeholder={event?.emailDomain ? `yourname@${event.emailDomain}` : 'email@example.com'}
        />
        {event?.emailDomain && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {isEnglish ? `Must be a @${event.emailDomain} address` : `Doit être une adresse @${event.emailDomain}`}
          </p>
        )}
      </div>

      {/* Campus Selector */}
      {event?.campusRequired && campuses.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Campus *
          </label>
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            required
            className="input w-full"
          >
            <option value="">{isEnglish ? 'Select your campus' : 'Sélectionnez votre campus'}</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}{c.city ? ` (${c.city})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom Fields */}
      {event?.customFields?.map((field) => (
        <div key={field.id}>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {field.label} {field.required && '*'}
          </label>
          {field.type === 'select' ? (
            <select
              value={customFieldValues[field.id] || ''}
              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
              required={field.required}
              className="input w-full"
            >
              <option value="">{isEnglish ? 'Select...' : 'Sélectionner...'}</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              value={customFieldValues[field.id] || ''}
              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
              required={field.required}
              className="input w-full"
              rows={3}
            />
          ) : (
            <input
              type={field.type || 'text'}
              value={customFieldValues[field.id] || ''}
              onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
              required={field.required}
              className="input w-full"
            />
          )}
        </div>
      ))}

      {/* Promo Code */}
      {basePrice > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            {isEnglish ? 'Promo Code (optional)' : 'Code promo (optionnel)'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                if (promoStatus) { setPromoStatus(null); setPromoDiscount(null); }
              }}
              className="input flex-1 font-mono"
              placeholder="e.g., ESCP20"
            />
            <button
              type="button"
              onClick={() => validatePromo(promoCode)}
              disabled={!promoCode.trim() || promoStatus === 'checking'}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors btn-secondary"
              style={{
                border: '1px solid var(--border-default)',
              }}
            >
              {promoStatus === 'checking' ? '...' : isEnglish ? 'Apply' : 'Appliquer'}
            </button>
          </div>
          {promoStatus === 'valid' && (
            <p className="text-xs mt-1 text-green-600 font-medium">
              {promoDiscount.discountType === 'percentage'
                ? `${promoDiscount.discountValue}% off applied`
                : `${promoDiscount.discountValue} EUR off applied`}
            </p>
          )}
          {promoStatus === 'invalid' && (
            <p className="text-xs mt-1 text-red-500">
              {isEnglish ? 'Invalid or expired promo code' : 'Code promo invalide ou expiré'}
            </p>
          )}
        </div>
      )}

      {/* Price Display */}
      {basePrice > 0 && (
        <div
          className="flex items-center justify-between p-3 rounded-lg"
          style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {isEnglish ? 'Total' : 'Total'}
          </span>
          <div className="text-right">
            {promoDiscount && finalPrice !== basePrice ? (
              <div className="flex items-center gap-2">
                <span className="text-sm line-through" style={{ color: 'var(--text-tertiary)' }}>
                  {basePrice.toFixed(2)} EUR
                </span>
                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {finalPrice === 0 ? (isEnglish ? 'Free' : 'Gratuit') : `${finalPrice.toFixed(2)} EUR`}
                </span>
              </div>
            ) : (
              <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {basePrice.toFixed(2)} EUR
              </span>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full btn btn-primary btn-lg disabled:opacity-50"
      >
        {isLoading
          ? (isEnglish ? 'Processing...' : 'Traitement...')
          : finalPrice === 0
            ? (isEnglish ? 'Register (Free)' : "S'inscrire (Gratuit)")
            : (isEnglish ? `Pay ${finalPrice.toFixed(2)} EUR` : `Payer ${finalPrice.toFixed(2)} EUR`)
        }
      </button>
    </form>
  );
}