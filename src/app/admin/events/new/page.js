// src/app/admin/events/new/page.js
// Create new event page with server-side image upload (no CORS issues)

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import Link from 'next/link';

const DEFAULT_TICKET = {
  id: '',
  name: '',
  price: '',
  description: '',
  includes: [],
};

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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
  });

  const [tickets, setTickets] = useState([{ ...DEFAULT_TICKET, id: crypto.randomUUID() }]);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [pendingBannerFile, setPendingBannerFile] = useState(null);
  const [pendingLogoFile, setPendingLogoFile] = useState(null);

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

    // Create preview
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

  // Server-side upload function - no CORS issues!
  const uploadImage = async (file, path) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return data.url;
  };

  const addTicket = () => {
    setTickets([...tickets, { ...DEFAULT_TICKET, id: crypto.randomUUID() }]);
  };

  const removeTicket = (id) => {
    if (tickets.length === 1) {
      setError('You need at least one ticket type');
      return;
    }
    setTickets(tickets.filter((t) => t.id !== id));
  };

  const updateTicket = (id, field, value) => {
    setTickets(tickets.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const updateTicketIncludes = (id, text) => {
    const includesArray = text.split(',').map((s) => s.trim()).filter(Boolean);
    setTickets(tickets.map((t) => (t.id === id ? { ...t, includes: includesArray, includesText: text } : t)));
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      // Validation
      if (!formData.title || !formData.date || !formData.time) {
        throw new Error('Please fill in all required fields');
      }

      const validTickets = tickets.filter((t) => t.name && t.price);
      if (validTickets.length === 0) {
        throw new Error('Please add at least one ticket with name and price');
      }

      // Generate a temporary ID for the upload path
      const tempId = crypto.randomUUID();
      let bannerUrl = '';
      let logoUrl = '';

      // Upload images using server-side API
      if (pendingBannerFile || pendingLogoFile) {
        setUploading(true);
        
        if (pendingBannerFile) {
          console.log('Uploading banner...');
          bannerUrl = await uploadImage(pendingBannerFile, `events/${tempId}`);
          console.log('Banner uploaded:', bannerUrl);
        }
        
        if (pendingLogoFile) {
          console.log('Uploading logo...');
          logoUrl = await uploadImage(pendingLogoFile, `events/${tempId}`);
          console.log('Logo uploaded:', logoUrl);
        }
        
        setUploading(false);
      }

      // Prepare event data
      const eventDateTime = new Date(`${formData.date}T${formData.time}`);
      const cleanedTickets = validTickets.map((t, index) => ({
        id: t.id || crypto.randomUUID(),
        name: t.name.trim(),
        price: parseFloat(t.price),
        description: t.description?.trim() || '',
        includes: t.includes || [],
        order: index,
      }));

      const eventData = {
        title: formData.title,
        slug: generateSlug(formData.title),
        description: formData.description,
        organizer: formData.organizer,
        format: formData.format,
        whoThisIsFor: formData.whoThisIsFor,
        emailDomain: formData.emailDomain.trim(),
        date: eventDateTime,
        meetingLink: formData.meetingLink,
        language: formData.language,
        bannerUrl,
        logoUrl,
        tickets: cleanedTickets,
        price: Math.min(...cleanedTickets.map((t) => t.price)),
        currency: 'EUR',
        status: 'published',
        attendeeCount: 0,
        totalRevenue: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'events'), eventData);
      console.log('Event created:', docRef.id);

      router.push(`/admin/events/${docRef.id}`);
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to create event');
      setUploading(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/events"
          className="text-sm text-gray-500 hover:text-indigo-600 mb-2 inline-block"
        >
          ← Back to events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-gray-500 mt-1">Fill in the details for your new event</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Introduction to Financial Markets"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organizer / Instructor Name
            </label>
            <input
              type="text"
              name="organizer"
              value={formData.organizer}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Prof. John Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              placeholder="Describe what attendees will learn..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Format
              </label>
              <select
                name="format"
                value={formData.format}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="live">🔴 Live Session</option>
                <option value="replay">📹 Replay / Recording</option>
                <option value="materials">📚 Materials Only</option>
                <option value="hybrid">🎯 Live + Materials</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="en">🇬🇧 English</option>
                <option value="fr">🇫🇷 Français</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Who This Is For
            </label>
            <input
              type="text"
              name="whoThisIsFor"
              value={formData.whoThisIsFor}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="B2 students, MBA candidates, Finance majors..."
            />
          </div>
        </div>

        {/* Tickets Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ticket Types</h2>
              <p className="text-sm text-gray-500">Add different ticket options</p>
            </div>
            <button
              type="button"
              onClick={addTicket}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              + Add Ticket
            </button>
          </div>

          <div className="space-y-6">
            {tickets.map((ticket, index) => (
              <div
                key={ticket.id}
                className="p-4 border border-gray-200 rounded-lg space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Ticket #{index + 1}
                  </span>
                  {tickets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTicket(ticket.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ticket Name *
                    </label>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => updateTicket(ticket.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="e.g., Live Session"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (€) *
                    </label>
                    <input
                      type="number"
                      value={ticket.price}
                      onChange={(e) => updateTicket(ticket.id, 'price', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="29.99"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={ticket.description || ''}
                    onChange={(e) => updateTicket(ticket.id, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Brief description of what's included"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What's Included (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={ticket.includesText || ''}
                    onChange={(e) => updateTicketIncludes(ticket.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Live access, Recording, Course materials, Certificate"
                  />
                  {ticket.includes && ticket.includes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ticket.includes.map((item, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full"
                        >
                          ✓ {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Date & Time</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time *
              </label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Meeting Link */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Online Class Link</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Link (Zoom / Google Meet)
            </label>
            <input
              type="url"
              name="meetingLink"
              value={formData.meetingLink}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="https://zoom.us/j/123456789"
            />
            <p className="text-xs text-gray-400 mt-2">
              This link will be sent to attendees after payment
            </p>
          </div>
        </div>

        {/* Email Restrictions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Registration Settings</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Domain Restriction (Optional)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">@</span>
              <input
                type="text"
                name="emailDomain"
                value={formData.emailDomain.replace('@', '')}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    emailDomain: e.target.value.replace('@', ''),
                  }))
                }
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="edu.escp.eu"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Leave empty to allow any email. Example: edu.escp.eu will only accept name@edu.escp.eu
            </p>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Images</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Banner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Banner
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                {bannerPreview ? (
                  <div className="relative">
                    <img
                      src={bannerPreview}
                      alt="Banner preview"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingBannerFile(null);
                        setBannerPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                    <p className="text-xs text-green-600 mt-2">Image selected ✓</p>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">🖼️</div>
                    <p className="text-sm text-gray-500">Click to upload banner</p>
                    <p className="text-xs text-gray-400">Max 5MB, JPEG/PNG/WebP</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => handleFileChange(e, 'banner')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                University / Organization Logo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors">
                {logoPreview ? (
                  <div className="relative">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-24 h-24 object-contain mx-auto rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600"
                    >
                      ×
                    </button>
                    <p className="text-xs text-green-600 mt-2">Image selected ✓</p>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">🏫</div>
                    <p className="text-sm text-gray-500">Click to upload logo</p>
                    <p className="text-xs text-gray-400">Max 5MB, JPEG/PNG/WebP</p>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => handleFileChange(e, 'logo')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/admin/events"
            className="px-6 py-3 text-gray-600 font-medium hover:text-gray-900"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || uploading}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {(saving || uploading) && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {uploading ? 'Uploading images...' : saving ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}