// src/app/admin/settings/page.js
// Site configuration: exam countdowns, discount rules, private call product

'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const EMPTY_COUNTDOWN = { label: '', date: '', category: '', active: true };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);

  const [examCountdowns, setExamCountdowns] = useState([]);
  const [discountRules, setDiscountRules] = useState({
    twoSubjects: 10,
    threeSubjects: 20,
  });
  const [privateCallProductId, setPrivateCallProductId] = useState('');

  useEffect(() => {
    fetchConfig();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const configDoc = await getDoc(doc(db, 'site_config', 'global'));
      if (configDoc.exists()) {
        const data = configDoc.data();
        if (data.examCountdowns) {
          setExamCountdowns(data.examCountdowns.map((c) => ({
            ...c,
            date: c.date?.toDate ? c.date.toDate().toISOString().slice(0, 16) : (c.date ? new Date(c.date).toISOString().slice(0, 16) : ''),
          })));
        }
        if (data.discountRules) {
          setDiscountRules(data.discountRules);
        }
        if (data.privateCallProductId) {
          setPrivateCallProductId(data.privateCallProductId);
        }
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'site_config', 'global'), {
        examCountdowns: examCountdowns
          .filter((c) => c.label.trim() && c.date)
          .map((c) => ({
            label: c.label.trim(),
            date: new Date(c.date),
            category: c.category || '',
            active: c.active,
          })),
        discountRules: {
          twoSubjects: parseInt(discountRules.twoSubjects, 10) || 10,
          threeSubjects: parseInt(discountRules.threeSubjects, 10) || 20,
        },
        privateCallProductId: privateCallProductId || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      alert('Settings saved!');
    } catch (err) {
      console.error('Error saving config:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Countdown helpers
  const addCountdown = () => setExamCountdowns([...examCountdowns, { ...EMPTY_COUNTDOWN }]);
  const updateCountdown = (i, field, val) => {
    const updated = [...examCountdowns];
    updated[i] = { ...updated[i], [field]: val };
    setExamCountdowns(updated);
  };
  const removeCountdown = (i) => setExamCountdowns(examCountdowns.filter((_, idx) => idx !== i));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site Settings</h1>
        <p className="text-gray-500 mt-1">Configure global settings for the student-facing site</p>
      </div>

      {/* Exam Countdown Banners */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Exam Countdown Banners</h2>
            <p className="text-sm text-gray-500 mt-1">Shows urgency countdown at the top of the website</p>
          </div>
          <button type="button" onClick={addCountdown} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            + Add Countdown
          </button>
        </div>

        {examCountdowns.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No countdowns configured</p>
        ) : (
          <div className="space-y-4">
            {examCountdowns.map((c, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Countdown {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={c.active}
                        onChange={(e) => updateCountdown(i, 'active', e.target.checked)}
                        className="rounded"
                      />
                      Active
                    </label>
                    <button type="button" onClick={() => removeCountdown(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Label *</label>
                    <input
                      type="text"
                      value={c.label}
                      onChange={(e) => updateCountdown(i, 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                      placeholder="e.g., Midterm Exam"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
                    <input
                      type="datetime-local"
                      value={c.date}
                      onChange={(e) => updateCountdown(i, 'date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Category (optional)</label>
                    <select
                      value={c.category}
                      onChange={(e) => updateCountdown(i, 'category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    >
                      <option value="">All students</option>
                      <option value="b1">B1 only</option>
                      <option value="b2">B2 only</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Discount Rules */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Multi-Subject Discount Rules</h2>
        <p className="text-sm text-gray-500 mb-4">Auto-applied when students add courses from different subjects to their cart</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">2 different subjects (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={discountRules.twoSubjects}
                onChange={(e) => setDiscountRules({ ...discountRules, twoSubjects: e.target.value })}
                min="0"
                max="100"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg outline-none"
              />
              <span className="text-sm text-gray-500">% off</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">3+ different subjects (%)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={discountRules.threeSubjects}
                onChange={(e) => setDiscountRules({ ...discountRules, threeSubjects: e.target.value })}
                min="0"
                max="100"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg outline-none"
              />
              <span className="text-sm text-gray-500">% off</span>
            </div>
          </div>
        </div>
      </section>

      {/* Private Call Product */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Private Call Add-on</h2>
        <p className="text-sm text-gray-500 mb-4">30-min private call product shown as an add-on in the cart</p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
          <select
            value={privateCallProductId}
            onChange={(e) => setPrivateCallProductId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
          >
            <option value="">No private call add-on</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title} - {p.price} EUR</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">This product will appear as a checkbox add-on in the cart drawer</p>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
