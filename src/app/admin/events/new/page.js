// src/app/admin/events/new/page.js

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase';
import { generateEventSlug } from '../../../lib/utils';
import Link from 'next/link';

const DEFAULT_TICKET = {
  id: '',
  name: '',
  price: '',
  description: '',
  includes: [], // Array of strings: what's included
};

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    meetingLink: '',
    language: 'en',
    // New fields
    organizer: '',
    format: 'live', // live, replay, materials
    whoThisIsFor: '',
    emailDomain: '', // e.g., @edu.escp.eu (empty = any email allowed)
  });

  // Tickets state (array of ticket objects)
  const [tickets, setTickets] = useState([
    { ...DEFAULT_TICKET, id: crypto.randomUUID(), name: 'General Admission', price: '' },
  ]);

  const [bannerFile, setBannerFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'banner') {
        setBannerFile(file);
        setBannerPreview(reader.result);
      } else {
        setLogoFile(file);
        setLogoPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Ticket management functions
  const addTicket = () => {
    setTickets([
      ...tickets,
      { ...DEFAULT_TICKET, id: crypto.randomUUID() },
    ]);
  };

  const removeTicket = (ticketId) => {
    if (tickets.length === 1) {
      setError('You need at least one ticket type');
      return;
    }
    setTickets(tickets.filter((t) => t.id !== ticketId));
  };

  const updateTicket = (ticketId, field, value) => {
    setTickets(
      tickets.map((t) =>
        t.id === ticketId ? { ...t, [field]: value } : t
      )
    );
  };

  const updateTicketIncludes = (ticketId, includesText) => {
    // Convert comma-separated text to array
    const includesArray = includesText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    updateTicket(ticketId, 'includes', includesArray);
    updateTicket(ticketId, 'includesText', includesText); // Keep raw text for editing
  };

  const uploadImage = async (file, path) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate basic fields
      if (!formData.title || !formData.date || !formData.time) {
        throw new Error('Please fill in all required fields');
      }

      // Validate tickets
      const validTickets = tickets.filter((t) => t.name && t.price);
      if (validTickets.length === 0) {
        throw new Error('Please add at least one ticket with name and price');
      }

      // Check for duplicate ticket names
      const ticketNames = validTickets.map((t) => t.name.toLowerCase());
      if (new Set(ticketNames).size !== ticketNames.length) {
        throw new Error('Ticket names must be unique');
      }

      // Generate slug
      const slug = generateEventSlug(formData.title);

      // Upload images if provided
      let bannerUrl = '';
      let logoUrl = '';

      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile, `events/${slug}/banner`);
      }
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, `events/${slug}/logo`);
      }

      // Combine date and time
      const eventDateTime = new Date(`${formData.date}T${formData.time}`);

      // Prepare tickets for storage (clean up and add IDs)
      const cleanedTickets = validTickets.map((t, index) => ({
        id: t.id || crypto.randomUUID(),
        name: t.name.trim(),
        price: parseFloat(t.price),
        description: t.description?.trim() || '',
        includes: t.includes || [],
        order: index,
      }));

      // Create event document
      const eventData = {
        title: formData.title,
        description: formData.description,
        organizer: formData.organizer,
        format: formData.format,
        whoThisIsFor: formData.whoThisIsFor,
        emailDomain: formData.emailDomain.trim(),
        date: eventDateTime,
        meetingLink: formData.meetingLink,
        language: formData.language,
        slug,
        bannerUrl,
        logoUrl,
        // New: tickets array instead of single price
        tickets: cleanedTickets,
        // Keep legacy price field for backwards compatibility (use lowest price)
        price: Math.min(...cleanedTickets.map((t) => t.price)),
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'events'), eventData);

      router.push('/admin/events');
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
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
        <p className="text-gray-500 mt-1">Fill in the details for your event</p>
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
              placeholder="Introduction to Marketing"
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
              placeholder="Describe your event..."
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
              <p className="text-sm text-gray-500">Add one or more ticket options</p>
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
                className="p-4 border border-gray-200 rounded-lg space-y-4 relative"
              >
                {/* Ticket header */}
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
                      placeholder="e.g., Live Session, Materials Only"
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
                      placeholder="19.99"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={ticket.description}
                    onChange={(e) => updateTicket(ticket.id, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Short description of what this ticket includes"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    What's Included (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={ticket.includesText || ticket.includes?.join(', ') || ''}
                    onChange={(e) => updateTicketIncludes(ticket.id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="Live session, Q&A, Slides, Recording access"
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
                        setBannerFile(null);
                        setBannerPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">🖼️</div>
                    <p className="text-sm text-gray-500">Click to upload banner</p>
                    <p className="text-xs text-gray-400">Recommended: 1200x630px</p>
                    <input
                      type="file"
                      accept="image/*"
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
                University Logo
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
                        setLogoFile(null);
                        setLogoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <div className="text-4xl mb-2">🏫</div>
                    <p className="text-sm text-gray-500">Click to upload logo</p>
                    <p className="text-xs text-gray-400">Recommended: 200x200px</p>
                    <input
                      type="file"
                      accept="image/*"
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
            disabled={loading}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}