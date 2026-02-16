// src/components/RegistrationForm.js
// Registration form with campus selection, promo codes, and custom fields

'use client';

import { useState, useEffect } from 'react';

export default function RegistrationForm({
  event,
  selectedTicket,
  locale = 'en',
  onSubmit,
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError(isEnglish ? 'Please fill in all required fields' : 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (event?.campusRequired && !campus) {
      setError(isEnglish ? 'Please select your campus' : 'Veuillez selectionner votre campus');
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

    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      campus,
      promoCode: promoStatus === 'valid' ? promoCode.trim() : '',
      customFieldValues,
    });
  };

  const finalPrice = getDiscountedPrice();
  const basePrice = selectedTicket?.price ?? event?.price ?? 0;

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
            {isEnglish ? 'First Name' : 'Prenom'} *
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="input w-full"
            placeholder={isEnglish ? 'First name' : 'Prenom'}
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
            {isEnglish ? `Must be a @${event.emailDomain} address` : `Doit etre une adresse @${event.emailDomain}`}
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
            <option value="">{isEnglish ? 'Select your campus' : 'Selectionnez votre campus'}</option>
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
              <option value="">{isEnglish ? 'Select...' : 'Selectionner...'}</option>
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
              className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
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
              {isEnglish ? 'Invalid or expired promo code' : 'Code promo invalide ou expire'}
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
        disabled={externalLoading}
        className="w-full py-3 rounded-lg font-semibold text-white transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        {externalLoading
          ? (isEnglish ? 'Processing...' : 'Traitement...')
          : finalPrice === 0
            ? (isEnglish ? 'Register (Free)' : "S'inscrire (Gratuit)")
            : (isEnglish ? `Pay ${finalPrice.toFixed(2)} EUR` : `Payer ${finalPrice.toFixed(2)} EUR`)
        }
      </button>
    </form>
  );
}
