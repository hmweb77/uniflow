// src/app/admin/events/[id]/edit/page.js
// Edit event page with server-side image upload

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';
import { useImageUpload } from '../../../../hooks/useImageUpload';
import Link from 'next/link';

const DEFAULT_TICKET = {
  id: '',
  name: '',
  price: '',
  description: '',
  includes: [],
};

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);

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
    soldOut: false,
    maxTickets: '',
    subject: '',
    tags: [],
    countdownDate: '',
    countdownLabel: '',
  });

  const [tickets, setTickets] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [existingBanner, setExistingBanner] = useState('');
  const [existingLogo, setExistingLogo] = useState('');
  const [pendingBannerFile, setPendingBannerFile] = useState(null);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);

  const { uploadImage, uploading, error: uploadError } = useImageUpload();

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

  useEffect(() => {
    getDocs(collection(db, 'categories'))
      .then((snap) => setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0))))
      .catch(() => {});
  }, []);

  const fetchEvent = async () => {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        const data = eventDoc.data();
        const eventDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);

        setFormData({
          title: data.title || '',
          description: data.description || '',
          date: eventDate.toISOString().split('T')[0],
          time: eventDate.toTimeString().slice(0, 5),
          meetingLink: data.meetingLink || '',
          language: data.language || 'en',
          organizer: data.organizer || '',
          format: data.format || 'live',
          whoThisIsFor: data.whoThisIsFor || '',
          emailDomain: data.emailDomain || '',
          visibility: data.visibility || 'public',
          category: data.category || '',
          campusRequired: data.campusRequired === true,
          feedbackFormUrl: data.feedbackFormUrl || '',
          shareImageUrl: data.shareImageUrl || '',
          soldOut: data.soldOut === true,
          maxTickets: data.maxTickets != null ? String(data.maxTickets) : '',
          subject: data.subject || '',
          tags: data.tags || [],
          countdownDate: data.countdownDate ? (data.countdownDate.toDate ? data.countdownDate.toDate().toISOString().slice(0, 16) : new Date(data.countdownDate).toISOString().slice(0, 16)) : '',
          countdownLabel: data.countdownLabel || '',
        });

        if (data.tickets?.length > 0) {
          setTickets(data.tickets.map((t) => ({ ...t, includesText: t.includes?.join(', ') || '' })));
        } else if (data.price) {
          setTickets([{ id: crypto.randomUUID(), name: 'General Admission', price: data.price.toString(), description: '', includes: [], includesText: '' }]);
        } else {
          setTickets([{ ...DEFAULT_TICKET, id: crypto.randomUUID() }]);
        }

        if (data.customFields?.length) {
          setCustomFields(data.customFields.map((f) => ({ ...f, options: Array.isArray(f.options) ? f.options.join(', ') : (f.options || '') })));
        } else {
          setCustomFields([]);
        }

        setExistingBanner(data.bannerUrl || '');
        setExistingLogo(data.logoUrl || '');
        setBannerPreview(data.bannerUrl || null);
        setLogoPreview(data.logoUrl || null);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image (JPEG, PNG, GIF, WebP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'banner') {
        setPendingBannerFile(file);
        setBannerPreview(reader.result);
      } else {
        setPendingLogoFile(file);
        setLogoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
    setError('');
  };

  const addTicket = () => setTickets([...tickets, { ...DEFAULT_TICKET, id: crypto.randomUUID() }]);
  
  const removeTicket = (id) => {
    if (tickets.length === 1) { setError('Need at least one ticket'); return; }
    setTickets(tickets.filter((t) => t.id !== id));
  };

  const updateTicket = (id, field, value) => setTickets(tickets.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  
  const updateTicketIncludes = (id, text) => {
    const arr = text.split(',').map((s) => s.trim()).filter(Boolean);
    setTickets(tickets.map((t) => (t.id === id ? { ...t, includes: arr, includesText: text } : t)));
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { id: crypto.randomUUID(), label: '', type: 'text', required: false, options: '' }]);
  };
  const updateCustomField = (id, field, value) => {
    setCustomFields(customFields.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };
  const removeCustomField = (id) => setCustomFields(customFields.filter((f) => f.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!formData.title || !formData.date || !formData.time) throw new Error('Fill required fields');

      const validTickets = tickets.filter((t) => t.name && t.price);
      if (!validTickets.length) throw new Error('Add at least one ticket with name and price');

      let bannerUrl = existingBanner;
      let logoUrl = existingLogo;

      if (pendingBannerFile) {
        const result = await uploadImage(pendingBannerFile, `events/${eventId}`);
        bannerUrl = result.url;
      }
      if (pendingLogoFile) {
        const result = await uploadImage(pendingLogoFile, `events/${eventId}`);
        logoUrl = result.url;
      }

      const eventDateTime = new Date(`${formData.date}T${formData.time}`);
      const cleanedTickets = validTickets.map((t, i) => ({
        id: t.id || crypto.randomUUID(),
        name: t.name.trim(),
        price: parseFloat(t.price),
        description: t.description?.trim() || '',
        includes: t.includes || [],
        order: i,
      }));

      const selectedCat = categories.find((c) => c.id === formData.category);
      const processedCustomFields = customFields
        .filter((f) => f.label?.trim())
        .map((f) => ({
          id: f.id,
          label: f.label.trim(),
          type: f.type || 'text',
          required: !!f.required,
          options: f.type === 'select' ? (f.options || '').split(',').map((o) => o.trim()).filter(Boolean) : [],
        }));

      const maxTicketsNum = formData.maxTickets.trim() === '' ? null : parseInt(formData.maxTickets, 10);

      await updateDoc(doc(db, 'events', eventId), {
        title: formData.title,
        description: formData.description,
        organizer: formData.organizer,
        format: formData.format,
        whoThisIsFor: formData.whoThisIsFor,
        emailDomain: formData.emailDomain.trim(),
        date: eventDateTime,
        meetingLink: formData.meetingLink,
        language: formData.language,
        visibility: formData.visibility,
        category: formData.category || '',
        categoryName: selectedCat?.name || '',
        campusRequired: formData.campusRequired,
        feedbackFormUrl: formData.feedbackFormUrl.trim(),
        shareImageUrl: formData.shareImageUrl.trim(),
        customFields: processedCustomFields,
        soldOut: formData.soldOut,
        maxTickets: maxTicketsNum,
        bannerUrl,
        logoUrl,
        tickets: cleanedTickets,
        price: Math.min(...cleanedTickets.map((t) => t.price)),
        subject: formData.subject || null,
        tags: formData.tags || [],
        countdownDate: formData.countdownDate ? new Date(formData.countdownDate) : null,
        countdownLabel: formData.countdownLabel.trim(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/admin/events/${eventId}`);
    } catch (err) {
      console.error('Error updating event:', err);
      setError(err.message || 'Failed to update event');
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href={`/admin/events/${eventId}`} className="text-sm text-gray-500 hover:text-indigo-600 mb-2 inline-block">← Back to event</Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {uploadError && <div className="bg-yellow-50 text-yellow-700 px-4 py-3 rounded-lg text-sm">Upload: {uploadError}</div>}

        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
            <input type="text" name="title" value={formData.title} onChange={handleInputChange} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Organizer</label>
            <input type="text" name="organizer" value={formData.organizer} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Prof. John Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Use **bold**, *italic*, # Title, ## Subtitle, ### Heading — or paste from Word/Google Docs"
            />
            <p className="text-xs text-gray-500 mt-2">
              Formatting: <code className="bg-gray-100 px-1 rounded">**bold**</code> <code className="bg-gray-100 px-1 rounded">*italic*</code> <code className="bg-gray-100 px-1 rounded"># Title</code> <code className="bg-gray-100 px-1 rounded">## Subtitle</code> — or paste rich text (bold/italic/headings kept).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <select name="format" value={formData.format} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="live">🔴 Live Session</option>
                <option value="replay">📹 Replay</option>
                <option value="materials">📚 Materials Only</option>
                <option value="hybrid">🎯 Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <select name="language" value={formData.language} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="en">🇬🇧 English</option>
                <option value="fr">🇫🇷 Français</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Who This Is For</label>
            <input type="text" name="whoThisIsFor" value={formData.whoThisIsFor} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
              <select name="visibility" value={formData.visibility} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="public">Public</option>
                <option value="private">Private (hidden from listings)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select name="category" value={formData.category} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="campusRequired" name="campusRequired" checked={formData.campusRequired} onChange={(e) => setFormData((prev) => ({ ...prev, campusRequired: e.target.checked }))} className="rounded" />
            <label htmlFor="campusRequired" className="text-sm text-gray-700">Require campus selection during registration</label>
          </div>
        </div>

        {/* Subject, Tags & Countdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Subject, Tags & Urgency</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select name="subject" value={formData.subject} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">No subject</option>
                <option value="stats">Statistics & Probability</option>
                <option value="accounting">Managerial Accounting</option>
                <option value="psychology">Psychology</option>
                <option value="law">Law</option>
                <option value="computer-skills">Computer Skills</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['cohort:b1', 'cohort:b2', 'exam:midterm', 'exam:final', 'bundle', 'premium'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const tags = formData.tags.includes(tag) ? formData.tags.filter((t) => t !== tag) : [...formData.tags, tag];
                      setFormData((prev) => ({ ...prev, tags }));
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Countdown Date (urgency banner)</label>
              <input type="datetime-local" name="countdownDate" value={formData.countdownDate} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              <p className="text-xs text-gray-400 mt-1">Shows urgency countdown on the event page</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Countdown Label</label>
              <input type="text" name="countdownLabel" value={formData.countdownLabel} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Midterm Exam" />
            </div>
          </div>
        </div>

        {/* Capacity: Sold out & Max tickets */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Capacity</h2>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="soldOut" checked={formData.soldOut} onChange={(e) => setFormData((prev) => ({ ...prev, soldOut: e.target.checked }))} className="rounded" />
            <label htmlFor="soldOut" className="text-sm font-medium text-gray-700">Mark as sold out (registration closed)</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max tickets (optional)</label>
            <input type="number" min="0" value={formData.maxTickets} onChange={(e) => setFormData((prev) => ({ ...prev, maxTickets: e.target.value }))} className="w-full max-w-xs px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Leave empty for unlimited" />
            <p className="text-xs text-gray-400 mt-1">Registration will close automatically when this number is reached</p>
          </div>
        </div>

        {/* Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Tickets</h2>
            <button type="button" onClick={addTicket} className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">+ Add Ticket</button>
          </div>
          {tickets.map((ticket, index) => (
            <div key={ticket.id} className="p-4 border border-gray-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Ticket #{index + 1}</span>
                {tickets.length > 1 && <button type="button" onClick={() => removeTicket(ticket.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={ticket.name} onChange={(e) => updateTicket(ticket.id, 'name', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (€) *</label>
                  <input type="number" value={ticket.price} onChange={(e) => updateTicket(ticket.id, 'price', e.target.value)} min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={ticket.description || ''} onChange={(e) => updateTicket(ticket.id, 'description', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Includes (comma-separated)</label>
                <input type="text" value={ticket.includesText || ''} onChange={(e) => updateTicketIncludes(ticket.id, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                {ticket.includes?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ticket.includes.map((item, i) => <span key={i} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">✓ {item}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Custom Registration Fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Custom Registration Fields</h2>
            <button type="button" onClick={addCustomField} className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100">+ Add Field</button>
          </div>
          {customFields.length === 0 ? (
            <p className="text-sm text-gray-400">No custom fields. Students fill in name and email only.</p>
          ) : (
            customFields.map((field) => (
              <div key={field.id} className="p-4 border border-gray-200 rounded-lg flex flex-wrap items-end gap-3">
                <div className="min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
                  <input type="text" value={field.label} onChange={(e) => updateCustomField(field.id, 'label', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g., Phone" />
                </div>
                <div className="min-w-[100px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select value={field.type} onChange={(e) => updateCustomField(field.id, 'type', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown</option>
                    <option value="textarea">Long text</option>
                  </select>
                </div>
                {field.type === 'select' && (
                  <div className="min-w-[160px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Options (comma-separated)</label>
                    <input type="text" value={field.options || ''} onChange={(e) => updateCustomField(field.id, 'options', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="A, B, C" />
                  </div>
                )}
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input type="checkbox" checked={!!field.required} onChange={(e) => updateCustomField(field.id, 'required', e.target.checked)} className="rounded" />
                  Required
                </label>
                <button type="button" onClick={() => removeCustomField(field.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
              </div>
            ))
          )}
        </div>

        {/* Date & Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Date & Time</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
              <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
              <input type="time" name="time" value={formData.time} onChange={handleInputChange} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
          </div>
        </div>

        {/* Meeting Link */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Online Class Link</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Link</label>
            <input type="url" name="meetingLink" value={formData.meetingLink} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://zoom.us/j/123456789" />
          </div>
        </div>

        {/* Email Restrictions & Marketing */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Registration & Post-Event</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Domain Restriction</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">@</span>
              <input type="text" value={formData.emailDomain.replace('@', '')} onChange={(e) => setFormData((prev) => ({ ...prev, emailDomain: e.target.value.replace('@', '') }))} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="edu.escp.eu" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Leave empty to allow any email</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Feedback Form URL</label>
            <input type="url" name="feedbackFormUrl" value={formData.feedbackFormUrl} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://forms.google.com/..." />
            <p className="text-xs text-gray-400 mt-2">Included in post-event thank-you email</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Share Image URL (WhatsApp / social)</label>
            <input type="url" name="shareImageUrl" value={formData.shareImageUrl} onChange={handleInputChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="URL for share preview (defaults to banner)" />
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Images</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Banner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Banner</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                {bannerPreview ? (
                  <div className="relative">
                    <img src={bannerPreview} alt="Banner" className="w-full h-32 object-cover rounded-lg" />
                    <button type="button" onClick={() => { setPendingBannerFile(null); setBannerPreview(null); setExistingBanner(''); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600">×</button>
                    {pendingBannerFile && <p className="text-xs text-green-600 mt-2">New image selected</p>}
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">🖼️</div>
                    <p className="text-sm text-gray-500">Click to upload</p>
                    <p className="text-xs text-gray-400">Max 5MB</p>
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'banner')} className="hidden" />
                  </label>
                )}
              </div>
            </div>
            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo" className="w-24 h-24 object-contain mx-auto rounded-lg" />
                    <button type="button" onClick={() => { setPendingLogoFile(null); setLogoPreview(null); setExistingLogo(''); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600">×</button>
                    {pendingLogoFile && <p className="text-xs text-green-600 mt-2">New image selected</p>}
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">🏫</div>
                    <p className="text-sm text-gray-500">Click to upload</p>
                    <p className="text-xs text-gray-400">Max 5MB</p>
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link href={`/admin/events/${eventId}`} className="px-6 py-3 text-gray-600 font-medium hover:text-gray-900">Cancel</Link>
          <button type="submit" disabled={saving || uploading} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {(saving || uploading) && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}