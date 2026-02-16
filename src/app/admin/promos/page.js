// src/app/admin/promos/page.js
// Admin page to manage promo codes and discount links

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function PromosPage() {
  const [promos, setPromos] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage', // 'percentage' or 'fixed'
    discountValue: '',
    eventId: '', // empty = applies to all events
    maxUses: '',
    expiresAt: '',
    active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [promosSnap, eventsSnap] = await Promise.all([
        getDocs(collection(db, 'promos')),
        getDocs(collection(db, 'events')),
      ]);
      setPromos(promosSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setEvents(eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching promos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.discountValue) return;
    setSaving(true);

    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        eventId: formData.eventId || null,
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt) : null,
        active: formData.active,
        usedCount: 0,
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, 'promos', editing), payload);
      } else {
        await addDoc(collection(db, 'promos'), { ...payload, createdAt: serverTimestamp() });
      }

      resetForm();
      fetchData();
    } catch (err) {
      console.error('Error saving promo:', err);
      alert('Failed to save promo code');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ code: '', discountType: 'percentage', discountValue: '', eventId: '', maxUses: '', expiresAt: '', active: true });
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (promo) => {
    setFormData({
      code: promo.code || '',
      discountType: promo.discountType || 'percentage',
      discountValue: promo.discountValue?.toString() || '',
      eventId: promo.eventId || '',
      maxUses: promo.maxUses?.toString() || '',
      expiresAt: promo.expiresAt?.toDate ? promo.expiresAt.toDate().toISOString().split('T')[0] : '',
      active: promo.active !== false,
    });
    setEditing(promo.id);
    setShowForm(true);
  };

  const toggleActive = async (id, currentActive) => {
    try {
      await updateDoc(doc(db, 'promos', id), { active: !currentActive });
      fetchData();
    } catch (err) {
      console.error('Error toggling promo:', err);
    }
  };

  const handleDelete = async (id, code) => {
    if (!confirm(`Delete promo "${code}"?`)) return;
    try {
      await deleteDoc(doc(db, 'promos', id));
      setPromos(promos.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting promo:', err);
    }
  };

  const getEventTitle = (eventId) => events.find((e) => e.id === eventId)?.title || 'All Events';

  const generateShareLink = (promo) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
    if (promo.eventId) {
      const event = events.find((e) => e.id === promo.eventId);
      if (event?.slug) return `${appUrl}/e/${event.slug}?promo=${promo.code}`;
    }
    return `${appUrl}/classes?promo=${promo.code}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
          <p className="text-gray-500 mt-1">Create discount codes and shareable links</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Create Promo
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Promo Code' : 'New Promo Code'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  placeholder="e.g., ESCP20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (EUR)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Value * {formData.discountType === 'percentage' ? '(%)' : '(EUR)'}
                </label>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder={formData.discountType === 'percentage' ? '20' : '5.00'}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apply to Event</label>
                <select
                  value={formData.eventId}
                  onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">All Events</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses (optional)</label>
                <input
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expires (optional)</label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="promo-active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="promo-active" className="text-sm text-gray-700">Active</label>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {promos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {promos.map((promo) => (
                  <tr key={promo.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono font-semibold text-gray-900">{promo.code}</td>
                    <td className="px-6 py-4 text-gray-900">
                      {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `${promo.discountValue} EUR`}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{getEventTitle(promo.eventId)}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {promo.usedCount || 0}{promo.maxUses ? ` / ${promo.maxUses}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(promo.id, promo.active)}
                        className={`px-2 py-1 rounded text-xs font-medium ${promo.active !== false ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {promo.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          const link = generateShareLink(promo);
                          navigator.clipboard.writeText(link);
                          alert('Link copied: ' + link);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        Copy Link
                      </button>
                      <button onClick={() => handleEdit(promo)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                      <button onClick={() => handleDelete(promo.id, promo.code)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium text-gray-900 mb-2">No promo codes yet</p>
            <p>Create promo codes to offer discounts to your students</p>
          </div>
        )}
      </div>
    </div>
  );
}
