// src/app/admin/events/new/page.js
// Create new event - with visibility, category, campus, feedback form, share image, custom fields

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import Link from 'next/link';

const DEFAULT_TICKET = { id: '', name: '', price: '', description: '', includes: [] };

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [campuses, setCampuses] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    meetingLink: '',
    language: 'en',
    organizer: '',
    format: 'live',
    whoThisIsFor: '',
    emailDomain: '',
    visibility: 'public',
    category: '',
    campusRequired: false,
    feedbackFormUrl: '',
    shareImageUrl: '',
  });

  const [tickets, setTickets] = useState([{ ...DEFAULT_TICKET, id: crypto.randomUUID() }]);
  const [customFields, setCustomFields] = useState([]);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [pendingBannerFile, setPendingBannerFile] = useState(null);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [catsSnap, campusSnap] = await Promise.all([
        getDocs(collection(db, 'categories')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'campuses')).catch(() => ({ docs: [] })),
      ]);
      setCategories(catsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
      setCampuses(campusSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (err) {
      console.log('Options fetch info:', err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return; }
    setPendingBannerFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);
    setError('');
  };

  const uploadImage = async (file, path) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('path', path);
    const response = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!response.ok) throw new Error('Upload failed');
    return (await response.json()).url;
  };

  const generateSlug = (title) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const addTicket = () =>
    setTickets([...tickets, { ...DEFAULT_TICKET, id: crypto.randomUUID() }]);

  const removeTicket = (id) => {
    if (tickets.length <= 1) return;
    setTickets(tickets.filter((t) => t.id !== id));
  };

  const updateTicket = (id, field, value) =>
    setTickets(tickets.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

  // Custom registration fields
  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: crypto.randomUUID(), label: '', type: 'text', required: false, options: '' },
    ]);
  };

  const updateCustomField = (id, field, value) =>
    setCustomFields(customFields.map((f) => (f.id === id ? { ...f, [field]: value } : f)));

  const removeCustomField = (id) =>
    setCustomFields(customFields.filter((f) => f.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!formData.title || !formData.date || !formData.time) {
        throw new Error('Please fill in title, date, and time');
      }

      // Validate tickets
      const validTickets = tickets.filter((t) => t.name.trim());
      if (validTickets.length === 0) throw new Error('Add at least one ticket type');

      // Parse tickets
      const processedTickets = validTickets.map((t) => ({
        id: t.id,
        name: t.name.trim(),
        price: parseFloat(t.price) || 0,
        description: t.description?.trim() || '',
        includes: t.includes || [],
      }));

      // Upload banner if present
      let bannerUrl = '';
      if (pendingBannerFile) {
        bannerUrl = await uploadImage(pendingBannerFile, `events/${Date.now()}/banner`);
      }

      // Build date
      const dateStr = `${formData.date}T${formData.time}`;
      const eventDate = new Date(dateStr);
      if (isNaN(eventDate.getTime())) throw new Error('Invalid date/time');

      const slug = generateSlug(formData.title) + '-' + Date.now().toString(36);

      // Process custom fields
      const processedCustomFields = customFields
        .filter((f) => f.label.trim())
        .map((f) => ({
          id: f.id,
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          options: f.type === 'select' ? f.options.split(',').map((o) => o.trim()).filter(Boolean) : [],
        }));

      // Find category name
      const selectedCat = categories.find((c) => c.id === formData.category);

      const eventData = {
        title: formData.title.trim(),
        slug,
        description: formData.description.trim(),
        date: eventDate,
        meetingLink: formData.meetingLink.trim(),
        language: formData.language,
        organizer: formData.organizer.trim(),
        format: formData.format,
        whoThisIsFor: formData.whoThisIsFor.trim(),
        emailDomain: formData.emailDomain.trim(),
        visibility: formData.visibility,
        category: formData.category,
        categoryName: selectedCat?.name || '',
        campusRequired: formData.campusRequired,
        feedbackFormUrl: formData.feedbackFormUrl.trim(),
        shareImageUrl: formData.shareImageUrl.trim(),
        customFields: processedCustomFields,
        tickets: processedTickets,
        price: processedTickets[0]?.price || 0,
        bannerUrl,
        status: 'active',
        attendeeCount: 0,
        totalRevenue: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'events'), eventData);
      console.log('Event created:', docRef.id);
      router.push('/admin/events');
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
          <p className="text-gray-500 mt-1">Fill in the details to create an event</p>
        </div>
        <Link href="/admin/events" className="text-gray-600 hover:text-gray-900 font-medium">
          Cancel
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g., Business English B2 Session"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                <input type="time" name="time" value={formData.time} onChange={handleInputChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select name="language" value={formData.language} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organizer</label>
                <input type="text" name="organizer" value={formData.organizer} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                <input type="url" name="meetingLink" value={formData.meetingLink} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Zoom, Teams, etc." />
              </div>
            </div>
          </div>
        </section>

        {/* Classification & Visibility */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Classification & Visibility</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                <select name="visibility" value={formData.visibility} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="public">Public</option>
                  <option value="private">Private (hidden from listings)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Private events are only accessible via direct link</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select name="format" value={formData.format} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="live">Live Session</option>
                  <option value="replay">Replay / Recording</option>
                  <option value="materials">Materials Only</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Who This Is For</label>
                <input type="text" name="whoThisIsFor" value={formData.whoThisIsFor} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., B2 students, All levels" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Domain Restriction</label>
                <input type="text" name="emailDomain" value={formData.emailDomain} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., escp.eu (leave empty for any)" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="campusRequired" name="campusRequired" checked={formData.campusRequired} onChange={handleInputChange} className="rounded" />
              <label htmlFor="campusRequired" className="text-sm text-gray-700">Require campus selection during registration</label>
            </div>
          </div>
        </section>

        {/* Tickets */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
            <button type="button" onClick={addTicket} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              + Add Ticket Type
            </button>
          </div>
          <div className="space-y-4">
            {tickets.map((ticket, index) => (
              <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">Ticket {index + 1}</span>
                  {tickets.length > 1 && (
                    <button type="button" onClick={() => removeTicket(ticket.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                    <input type="text" value={ticket.name} onChange={(e) => updateTicket(ticket.id, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="e.g., General" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Price (EUR)</label>
                    <input type="number" value={ticket.price} onChange={(e) => updateTicket(ticket.id, 'price', e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="0 = Free" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                    <input type="text" value={ticket.description || ''} onChange={(e) => updateTicket(ticket.id, 'description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Registration Fields */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Custom Registration Fields</h2>
              <p className="text-sm text-gray-500 mt-1">Add extra fields students must fill in when registering</p>
            </div>
            <button type="button" onClick={addCustomField} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              + Add Field
            </button>
          </div>
          {customFields.length === 0 ? (
            <p className="text-sm text-gray-400">No custom fields. Students will fill in name and email only.</p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                      <input type="text" value={field.label} onChange={(e) => updateCustomField(field.id, 'label', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" placeholder="e.g., Phone number" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select value={field.type} onChange={(e) => updateCustomField(field.id, 'type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="number">Number</option>
                        <option value="select">Dropdown</option>
                        <option value="textarea">Long text</option>
                      </select>
                    </div>
                    {field.type === 'select' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Options (comma-separated)</label>
                        <input type="text" value={field.options} onChange={(e) => updateCustomField(field.id, 'options', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" placeholder="Option A, Option B" />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 text-sm text-gray-600">
                        <input type="checkbox" checked={field.required} onChange={(e) => updateCustomField(field.id, 'required', e.target.checked)} className="rounded" />
                        Required
                      </label>
                      <button type="button" onClick={() => removeCustomField(field.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Images & Sharing */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Images & Sharing</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Banner</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {bannerPreview ? (
                  <div className="relative inline-block">
                    <img src={bannerPreview} alt="Banner" className="max-h-48 object-contain rounded" />
                    <button type="button" onClick={() => { setPendingBannerFile(null); setBannerPreview(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">x</button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-sm text-gray-500 mb-1">Click to upload banner image</p>
                    <p className="text-xs text-gray-400">JPG, PNG, GIF, WebP (max 5MB)</p>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp / Social Share Image URL</label>
              <input type="url" name="shareImageUrl" value={formData.shareImageUrl} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="URL of image to show when sharing on WhatsApp (defaults to banner)" />
              <p className="text-xs text-gray-400 mt-1">If empty, the event banner will be used as the share preview image</p>
            </div>
          </div>
        </section>

        {/* Marketing */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Post-Event & Feedback</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback Form URL (Google Form, etc.)</label>
            <input type="url" name="feedbackFormUrl" value={formData.feedbackFormUrl} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://forms.google.com/..." />
            <p className="text-xs text-gray-400 mt-1">Included in the post-event thank-you email</p>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating...' : 'Create Event'}
          </button>
          <Link href="/admin/events" className="text-gray-600 hover:text-gray-900 font-medium">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
