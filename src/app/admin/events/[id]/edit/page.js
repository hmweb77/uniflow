// src/app/admin/events/[id]/edit/page.js
// Edit event page with server-side image upload

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

  const [tickets, setTickets] = useState([]);
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
        });

        if (data.tickets?.length > 0) {
          setTickets(data.tickets.map((t) => ({ ...t, includesText: t.includes?.join(', ') || '' })));
        } else if (data.price) {
          setTickets([{ id: crypto.randomUUID(), name: 'General Admission', price: data.price.toString(), description: '', includes: [], includesText: '' }]);
        } else {
          setTickets([{ ...DEFAULT_TICKET, id: crypto.randomUUID() }]);
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
        bannerUrl,
        logoUrl,
        tickets: cleanedTickets,
        price: Math.min(...cleanedTickets.map((t) => t.price)),
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
            <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
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

        {/* Email Restrictions */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Registration Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Domain Restriction</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">@</span>
              <input type="text" value={formData.emailDomain.replace('@', '')} onChange={(e) => setFormData((prev) => ({ ...prev, emailDomain: e.target.value.replace('@', '') }))} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="edu.escp.eu" />
            </div>
            <p className="text-xs text-gray-400 mt-2">Leave empty to allow any email</p>
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