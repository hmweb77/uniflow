// src/app/admin/categories/page.js
// Admin page to manage event categories (B1, B2, etc.)

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', order: 0, color: '#1a1a2e' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const snap = await getDocs(collection(db, 'categories'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCategories(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || generateSlug(formData.name),
        description: formData.description.trim(),
        order: parseInt(formData.order) || 0,
        color: formData.color,
        updatedAt: serverTimestamp(),
      };

      if (editing) {
        await updateDoc(doc(db, 'categories', editing), payload);
      } else {
        await addDoc(collection(db, 'categories'), { ...payload, createdAt: serverTimestamp() });
      }

      setFormData({ name: '', slug: '', description: '', order: 0, color: '#1a1a2e' });
      setShowForm(false);
      setEditing(null);
      fetchCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      alert('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat) => {
    setFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      description: cat.description || '',
      order: cat.order || 0,
      color: cat.color || '#1a1a2e',
    });
    setEditing(cat.id);
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
      setCategories(categories.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Error deleting category:', err);
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
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500 mt-1">Organize events by level or type (e.g., B1 Classes, B2 Classes)</p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', slug: '', description: '', order: categories.length, color: '#1a1a2e' });
            setEditing(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Category
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Category' : 'New Category'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., B1 Classes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="b1-classes"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Optional description for this category"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {categories.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500">{cat.order || 0}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-sm">{cat.slug}</td>
                  <td className="px-6 py-4">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: cat.color || '#1a1a2e' }} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(cat)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Edit</button>
                    <button onClick={() => handleDelete(cat.id, cat.name)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <p className="text-lg font-medium text-gray-900 mb-2">No categories yet</p>
            <p>Create categories like "B1 Classes" and "B2 Classes" to organize your events</p>
          </div>
        )}
      </div>
    </div>
  );
}
