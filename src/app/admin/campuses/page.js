// src/app/admin/campuses/page.js
// Admin page to manage campuses

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function CampusesPage() {
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', city: '', country: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCampuses();
  }, []);

  const fetchCampuses = async () => {
    try {
      const snap = await getDocs(collection(db, 'campuses'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCampuses(data.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (err) {
      console.error('Error fetching campuses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);

    try {
      if (editing) {
        await updateDoc(doc(db, 'campuses', editing), {
          name: formData.name.trim(),
          city: formData.city.trim(),
          country: formData.country.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'campuses'), {
          name: formData.name.trim(),
          city: formData.city.trim(),
          country: formData.country.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setFormData({ name: '', city: '', country: '' });
      setShowForm(false);
      setEditing(null);
      fetchCampuses();
    } catch (err) {
      console.error('Error saving campus:', err);
      alert('Failed to save campus');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (campus) => {
    setFormData({ name: campus.name || '', city: campus.city || '', country: campus.country || '' });
    setEditing(campus.id);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete campus "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'campuses', id));
      setCampuses(campuses.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Error deleting campus:', err);
      alert('Failed to delete campus');
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Campuses</h1>
          <p className="text-gray-500 mt-1">{campuses.length} campus{campuses.length !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', city: '', country: '' });
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Campus
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Campus' : 'New Campus'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., Paris Campus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., Paris"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., France"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {campuses.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campuses.map((campus) => (
                <tr key={campus.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{campus.name}</td>
                  <td className="px-6 py-4 text-gray-500">{campus.city || '-'}</td>
                  <td className="px-6 py-4 text-gray-500">{campus.country || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(campus)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Edit</button>
                    <button onClick={() => handleDelete(campus.id, campus.name)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium text-gray-900 mb-2">No campuses yet</p>
            <p>Add your first campus to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
