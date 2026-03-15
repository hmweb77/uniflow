// src/app/admin/products/page.js
// Admin page to manage digital products (bundles, notes, recordings)

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import useImageUpload from '@/app/hooks/useImageUpload';

const SUBJECTS = [
  { value: '', label: 'No subject' },
  { value: 'stats', label: 'Statistics & Probability' },
  { value: 'accounting', label: 'Managerial Accounting' },
  { value: 'psychology', label: 'Psychology' },
  { value: 'law', label: 'Law' },
  { value: 'computer-skills', label: 'Computer Skills' },
];

const TAG_OPTIONS = [
  'cohort:b1', 'cohort:b2',
  'exam:midterm', 'exam:final',
  'bundle', 'premium',
];

const EMPTY_TESTIMONIAL = { name: '', rating: 5, text: '', photoUrl: '', visible: true };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const { uploadImage, uploading } = useImageUpload();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    descriptionRich: '',
    price: '',
    type: 'notes',
    includes: '',
    status: 'published',
    downloadUrl: '',
    category: '',
    subject: '',
    learningOutcomes: [''],
    examAlignment: '',
    whoIsThisFor: '',
    badgeToggles: { bestseller: false, new: false, limited: false },
    tags: [],
    relatedProductIds: [],
    upsellProductIds: [],
    testimonials: [],
    countdownDate: '',
    countdownLabel: '',
    bundleContents: [],
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const snap = await getDocs(collection(db, 'categories'));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCategories(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

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
      const categoryId = formData.category?.trim() || null;
      const categoryName = categoryId ? (categories.find((c) => c.id === categoryId)?.name || '') : '';

      const payload = {
        title: formData.title.trim(),
        slug,
        description: formData.description.trim(),
        descriptionRich: formData.descriptionRich.trim(),
        price: parseFloat(formData.price),
        type: formData.type,
        includes: includesArr,
        status: formData.status,
        downloadUrl: formData.downloadUrl.trim(),
        isDigitalProduct: true,
        subject: formData.subject || null,
        learningOutcomes: formData.learningOutcomes.filter((o) => o.trim()),
        examAlignment: formData.examAlignment.trim(),
        whoIsThisFor: formData.whoIsThisFor.trim(),
        badgeToggles: formData.badgeToggles,
        tags: formData.tags,
        relatedProductIds: formData.relatedProductIds,
        upsellProductIds: formData.upsellProductIds,
        testimonials: formData.testimonials.filter((t) => t.text.trim()),
        countdownDate: formData.countdownDate ? new Date(formData.countdownDate) : null,
        countdownLabel: formData.countdownLabel.trim(),
        bundleContents: formData.type === 'bundle' ? formData.bundleContents : [],
        updatedAt: serverTimestamp(),
      };
      if (categoryId) {
        payload.category = categoryId;
        payload.categoryName = categoryName;
      } else {
        payload.category = null;
        payload.categoryName = null;
      }

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
    setFormData({
      title: '', description: '', descriptionRich: '', price: '', type: 'notes', includes: '',
      status: 'published', downloadUrl: '', category: '', subject: '',
      learningOutcomes: [''], examAlignment: '', whoIsThisFor: '',
      badgeToggles: { bestseller: false, new: false, limited: false },
      tags: [], relatedProductIds: [], upsellProductIds: [],
      testimonials: [], countdownDate: '', countdownLabel: '', bundleContents: [],
    });
    setBannerFile(null);
    setBannerPreview(null);
    setShowForm(false);
    setEditing(null);
    setActiveTab('basic');
  };

  const handleEdit = (product) => {
    setFormData({
      title: product.title || '',
      description: product.description || '',
      descriptionRich: product.descriptionRich || '',
      price: product.price?.toString() || '',
      type: product.type || 'notes',
      includes: (product.includes || []).join(', '),
      status: product.status || 'published',
      downloadUrl: product.downloadUrl || '',
      category: product.category || '',
      subject: product.subject || '',
      learningOutcomes: product.learningOutcomes?.length ? product.learningOutcomes : [''],
      examAlignment: product.examAlignment || '',
      whoIsThisFor: product.whoIsThisFor || '',
      badgeToggles: product.badgeToggles || { bestseller: false, new: false, limited: false },
      tags: product.tags || [],
      relatedProductIds: product.relatedProductIds || [],
      upsellProductIds: product.upsellProductIds || [],
      testimonials: product.testimonials || [],
      countdownDate: product.countdownDate ? (product.countdownDate.toDate ? product.countdownDate.toDate().toISOString().slice(0, 16) : new Date(product.countdownDate).toISOString().slice(0, 16)) : '',
      countdownLabel: product.countdownLabel || '',
      bundleContents: product.bundleContents || [],
    });
    setBannerPreview(product.bannerUrl || null);
    setEditing(product.id);
    setShowForm(true);
    setActiveTab('basic');
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

  // Learning outcomes helpers
  const addOutcome = () => setFormData({ ...formData, learningOutcomes: [...formData.learningOutcomes, ''] });
  const updateOutcome = (i, val) => {
    const updated = [...formData.learningOutcomes];
    updated[i] = val;
    setFormData({ ...formData, learningOutcomes: updated });
  };
  const removeOutcome = (i) => {
    if (formData.learningOutcomes.length <= 1) return;
    setFormData({ ...formData, learningOutcomes: formData.learningOutcomes.filter((_, idx) => idx !== i) });
  };

  // Testimonial helpers
  const addTestimonial = () => {
    if (formData.testimonials.length >= 3) return;
    setFormData({ ...formData, testimonials: [...formData.testimonials, { ...EMPTY_TESTIMONIAL }] });
  };
  const updateTestimonial = (i, field, val) => {
    const updated = [...formData.testimonials];
    updated[i] = { ...updated[i], [field]: val };
    setFormData({ ...formData, testimonials: updated });
  };
  const removeTestimonial = (i) => {
    setFormData({ ...formData, testimonials: formData.testimonials.filter((_, idx) => idx !== i) });
  };

  // Tag toggle
  const toggleTag = (tag) => {
    const tags = formData.tags.includes(tag) ? formData.tags.filter((t) => t !== tag) : [...formData.tags, tag];
    setFormData({ ...formData, tags });
  };

  // Bundle contents helpers
  const addBundleItem = () => {
    setFormData({ ...formData, bundleContents: [...formData.bundleContents, { productId: '', type: 'product' }] });
  };
  const updateBundleItem = (i, field, val) => {
    const updated = [...formData.bundleContents];
    updated[i] = { ...updated[i], [field]: val };
    setFormData({ ...formData, bundleContents: updated });
  };
  const removeBundleItem = (i) => {
    setFormData({ ...formData, bundleContents: formData.bundleContents.filter((_, idx) => idx !== i) });
  };

  // Related/upsell product toggle
  const toggleProductLink = (field, productId) => {
    const current = formData[field];
    const updated = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
    setFormData({ ...formData, [field]: updated });
  };

  const typeLabels = { notes: 'Notes', bundle: 'Bundle', recording: 'Recording', other: 'Other' };
  const subjectLabels = Object.fromEntries(SUBJECTS.filter((s) => s.value).map((s) => [s.value, s.label]));

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'content', label: 'Content & Description' },
    { id: 'marketing', label: 'Marketing & Badges' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'links', label: 'Related Products' },
    ...(formData.type === 'bundle' ? [{ id: 'bundle', label: 'Bundle Contents' }] : []),
  ];

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

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* === BASIC INFO TAB === */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category (B1/B2)</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">No category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder="Brief summary shown on product cards"
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
              </div>
            )}

            {/* === CONTENT & DESCRIPTION TAB === */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rich Description (detailed product page)</label>
                  <textarea
                    value={formData.descriptionRich}
                    onChange={(e) => setFormData({ ...formData, descriptionRich: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm"
                    placeholder="Detailed description shown on the product page. Supports markdown: **bold**, *italic*, ## headings, - lists"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Learning Outcomes</label>
                    <button type="button" onClick={addOutcome} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add</button>
                  </div>
                  {formData.learningOutcomes.map((outcome, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={outcome}
                        onChange={(e) => updateOutcome(i, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder={`Outcome ${i + 1}, e.g., "Master probability distributions"`}
                      />
                      {formData.learningOutcomes.length > 1 && (
                        <button type="button" onClick={() => removeOutcome(i)} className="text-red-500 hover:text-red-700 text-sm px-2">x</button>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Alignment</label>
                  <input
                    type="text"
                    value={formData.examAlignment}
                    onChange={(e) => setFormData({ ...formData, examAlignment: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g., Covers 100% of the midterm syllabus (weeks 1-6)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Who Is This For</label>
                  <input
                    type="text"
                    value={formData.whoIsThisFor}
                    onChange={(e) => setFormData({ ...formData, whoIsThisFor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g., B1 students preparing for the Statistics midterm"
                  />
                </div>
              </div>
            )}

            {/* === MARKETING & BADGES TAB === */}
            {activeTab === 'marketing' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Badge Toggles</label>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(formData.badgeToggles).map(([key, val]) => (
                      <label key={key} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) => setFormData({
                            ...formData,
                            badgeToggles: { ...formData.badgeToggles, [key]: e.target.checked },
                          })}
                          className="rounded"
                        />
                        <span className="text-sm capitalize">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          formData.tags.includes(tag)
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Countdown Date</label>
                    <input
                      type="datetime-local"
                      value={formData.countdownDate}
                      onChange={(e) => setFormData({ ...formData, countdownDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Shows urgency countdown on product page</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Countdown Label</label>
                    <input
                      type="text"
                      value={formData.countdownLabel}
                      onChange={(e) => setFormData({ ...formData, countdownLabel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g., Midterm Exam"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* === TESTIMONIALS TAB === */}
            {activeTab === 'testimonials' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Up to 3 testimonials per product</p>
                  {formData.testimonials.length < 3 && (
                    <button type="button" onClick={addTestimonial} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      + Add Testimonial
                    </button>
                  )}
                </div>
                {formData.testimonials.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">No testimonials yet. Add one to display on the product page.</p>
                )}
                {formData.testimonials.map((t, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Testimonial {i + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={t.visible}
                            onChange={(e) => updateTestimonial(i, 'visible', e.target.checked)}
                            className="rounded"
                          />
                          Visible
                        </label>
                        <button type="button" onClick={() => removeTestimonial(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Name (optional)</label>
                        <input
                          type="text"
                          value={t.name}
                          onChange={(e) => updateTestimonial(i, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                          placeholder="Anonymous if empty"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rating (1-5)</label>
                        <div className="flex gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => updateTestimonial(i, 'rating', star)}
                              className={`text-xl ${star <= t.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                              &#9733;
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Review Text *</label>
                      <textarea
                        value={t.text}
                        onChange={(e) => updateTestimonial(i, 'text', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-none"
                        placeholder="What the student said about this product..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Photo URL (optional)</label>
                      <input
                        type="url"
                        value={t.photoUrl}
                        onChange={(e) => updateTestimonial(i, 'photoUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* === RELATED PRODUCTS TAB === */}
            {activeTab === 'links' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    &quot;Students who bought this also bought&quot; (Recommendations)
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {products.filter((p) => p.id !== editing).map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.relatedProductIds.includes(p.id)}
                          onChange={() => toggleProductLink('relatedProductIds', p.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{p.title}</span>
                        <span className="text-xs text-gray-400 ml-auto">{typeLabels[p.type]}</span>
                      </label>
                    ))}
                    {products.filter((p) => p.id !== editing).length === 0 && (
                      <p className="text-sm text-gray-400 py-2 text-center">No other products to link</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upsell Products (&quot;Students also take this course&quot;)
                  </label>
                  <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {products.filter((p) => p.id !== editing).map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.upsellProductIds.includes(p.id)}
                          onChange={() => toggleProductLink('upsellProductIds', p.id)}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{p.title}</span>
                        <span className="text-xs text-gray-400 ml-auto">{typeLabels[p.type]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === BUNDLE CONTENTS TAB === */}
            {activeTab === 'bundle' && formData.type === 'bundle' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">Select products included in this bundle</p>
                  <button type="button" onClick={addBundleItem} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add Item</button>
                </div>
                {formData.bundleContents.map((item, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <select
                      value={item.productId}
                      onChange={(e) => updateBundleItem(i, 'productId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                    >
                      <option value="">Select a product...</option>
                      {products.filter((p) => p.id !== editing).map((p) => (
                        <option key={p.id} value={p.id}>{p.title} ({typeLabels[p.type]})</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeBundleItem(i)} className="text-red-500 hover:text-red-700 text-sm px-2">x</button>
                  </div>
                ))}
                {formData.bundleContents.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">No items in bundle. Add products that are included.</p>
                )}
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
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
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                    {typeLabels[product.type] || product.type}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${product.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {product.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                  {product.subject && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {subjectLabels[product.subject] || product.subject}
                    </span>
                  )}
                  {product.badgeToggles?.bestseller && (
                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs font-medium">Bestseller</span>
                  )}
                  {product.badgeToggles?.new && (
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">New</span>
                  )}
                  {product.badgeToggles?.limited && (
                    <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-medium">Limited</span>
                  )}
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
