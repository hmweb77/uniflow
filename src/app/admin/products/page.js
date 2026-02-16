// src/app/admin/products/page.js
// Admin page to manage digital products (bundles, notes, recordings)

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import useImageUpload from '@/app/hooks/useImageUpload';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const { uploadImage, uploading } = useImageUpload();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    type: 'notes', // 'notes', 'bundle', 'recording', 'other'
    includes: '',
    status: 'published',
    downloadUrl: '',
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(data.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      }));
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be less than 5MB'); return; }
    setBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.price) return;
    setSaving(true);

    try {
      let bannerUrl = '';
      if (bannerFile) {
        const result = await uploadImage(bannerFile, `products/${Date.now()}`);
        bannerUrl = result.url;
      }

      const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const includesArr = formData.includes.split(',').map((s) => s.trim()).filter(Boolean);

      const payload = {
        title: formData.title.trim(),
        slug,
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        type: formData.type,
        includes: includesArr,
        status: formData.status,
        downloadUrl: formData.downloadUrl.trim(),
        isDigitalProduct: true,
        updatedAt: serverTimestamp(),
      };

      if (bannerUrl) payload.bannerUrl = bannerUrl;

      if (editing) {
        await updateDoc(doc(db, 'products', editing), payload);
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          createdAt: serverTimestamp(),
          purchaseCount: 0,
          totalRevenue: 0,
        });
      }

      resetForm();
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', price: '', type: 'notes', includes: '', status: 'published', downloadUrl: '' });
    setBannerFile(null);
    setBannerPreview(null);
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (product) => {
    setFormData({
      title: product.title || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      type: product.type || 'notes',
      includes: (product.includes || []).join(', '),
      status: product.status || 'published',
      downloadUrl: product.downloadUrl || '',
    });
    setBannerPreview(product.bannerUrl || null);
    setEditing(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      setProducts(products.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  };

  const typeLabels = { notes: 'Notes', bundle: 'Bundle', recording: 'Recording', other: 'Other' };

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
          <h1 className="text-2xl font-bold text-gray-900">Digital Products</h1>
          <p className="text-gray-500 mt-1">Sell notes, bundles, recordings, and other digital resources</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Product
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editing ? 'Edit Product' : 'New Digital Product'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g., B1 Course Notes Bundle"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (EUR) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="notes">Notes</option>
                    <option value="bundle">Bundle</option>
                    <option value="recording">Recording</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Includes (comma-separated)</label>
              <input
                type="text"
                value={formData.includes}
                onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="PDF notes, Practice exercises, Answer key"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Download URL (after purchase)</label>
                <input
                  type="url"
                  value={formData.downloadUrl}
                  onChange={(e) => setFormData({ ...formData, downloadUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="https://drive.google.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                {bannerPreview ? (
                  <div className="relative inline-block">
                    <img src={bannerPreview} alt="Preview" className="h-32 object-contain rounded" />
                    <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(null); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">x</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-sm text-gray-500">Click to upload image</p>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving || uploading} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {uploading ? 'Uploading...' : saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Products Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-36 bg-gray-100">
                {product.bannerUrl ? (
                  <img src={product.bannerUrl} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                    {product.type === 'notes' ? 'N' : product.type === 'bundle' ? 'B' : product.type === 'recording' ? 'R' : 'P'}
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                    {typeLabels[product.type] || product.type}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${product.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {product.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{product.title}</h3>
                <p className="text-lg font-bold text-gray-900 mb-3">{product.price} EUR</p>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(product)} className="flex-1 px-3 py-2 text-sm text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">Edit</button>
                  <button onClick={() => handleDelete(product.id, product.title)} className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-lg font-medium text-gray-900 mb-2">No digital products yet</p>
          <p className="text-gray-500">Create products like note bundles, recordings, or other digital resources</p>
        </div>
      )}
    </div>
  );
}
