// src/app/admin/events/[id]/page.js

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { generateCSV, downloadCSV } from '../../../lib/utils';
import Link from 'next/link';

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id;

  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all');

  useEffect(() => {
    if (eventId) {
      fetchEventData();
    }
    // eslint-disable-next-line
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        setEvent({ id: eventDoc.id, ...eventDoc.data() });
      }

      const attendeesRef = collection(db, 'attendees');
      const attendeesQuery = query(
        attendeesRef,
        where('eventId', '==', eventId),
        where('paymentStatus', '==', 'completed')
      );
      const attendeesSnap = await getDocs(attendeesQuery);
      const attendeesData = attendeesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAttendees(attendeesData);
    } catch (error) {
      console.error('Error fetching event data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter attendees by ticket type
  const filteredAttendees =
    ticketFilter === 'all'
      ? attendees
      : attendees.filter((a) => a.ticketId === ticketFilter || a.ticketName === ticketFilter);

  // Calculate revenue
  const revenue = filteredAttendees.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

  // Get unique ticket types from attendees
  const ticketTypes = [...new Set(attendees.map((a) => a.ticketName || 'General Admission'))];

  const handleExportCSV = () => {
    const headers = [
      { key: 'name', label: 'First Name' },
      { key: 'surname', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'ticketName', label: 'Ticket Type' },
      { key: 'amountPaid', label: 'Amount Paid (€)' },
      { key: 'createdAt', label: 'Registration Date' },
    ];

    const data = filteredAttendees.map((a) => ({
      ...a,
      amountPaid: a.amountPaid?.toFixed(2) || '0.00',
      createdAt: a.createdAt?.toDate?.()
        ? a.createdAt.toDate().toLocaleDateString()
        : 'N/A',
    }));

    const csv = generateCSV(data, headers);
    const filename = `${event?.title?.replace(/\s+/g, '_')}_attendees.csv`;
    downloadCSV(csv, filename);
  };

  const handleSendEmail = async () => {
    if (!emailSubject || !emailBody) {
      alert('Please fill in both subject and message');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch('/api/email/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          subject: emailSubject,
          body: emailBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to send emails');

      alert(`${result.successful} emails sent successfully!`);
      setEmailModalOpen(false);
      setEmailSubject('');
      setEmailBody('');
    } catch (error) {
      console.error('Error sending emails:', error);
      alert('Failed to send emails: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Event not found</h2>
        <Link href="/admin/events" className="text-indigo-600 hover:underline mt-4 inline-block">
          ← Back to events
        </Link>
      </div>
    );
  }

  const tickets = event.tickets || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/admin/events"
            className="text-sm text-gray-500 hover:text-indigo-600 mb-2 inline-block"
          >
            ← Back to events
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <p className="text-gray-500 mt-1">{formatDate(event.date)}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/events/${eventId}/edit`}
            className="px-4 py-2 text-gray-600 bg-gray-100 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Edit
          </Link>
          <Link
            href={`/e/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            View Public Page
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tickets Sold</p>
              <p className="text-2xl font-bold text-gray-900">{attendees.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{revenue.toFixed(2)} €</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎫</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Ticket Types</p>
              <p className="text-2xl font-bold text-gray-900">{tickets.length || 1}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. Ticket Price</p>
              <p className="text-2xl font-bold text-gray-900">
                {attendees.length > 0 ? (revenue / attendees.length).toFixed(2) : '0.00'} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Types Breakdown */}
      {tickets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Types</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets.map((ticket) => {
              const ticketAttendees = attendees.filter(
                (a) => a.ticketId === ticket.id || a.ticketName === ticket.name
              );
              const ticketRevenue = ticketAttendees.reduce(
                (sum, a) => sum + (a.amountPaid || 0),
                0
              );
              return (
                <div
                  key={ticket.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{ticket.name}</h3>
                    <span className="font-bold text-indigo-600">{ticket.price} €</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{ticketAttendees.length} sold</span>
                    <span>•</span>
                    <span>{ticketRevenue.toFixed(2)} € revenue</span>
                  </div>
                  {ticket.includes && ticket.includes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ticket.includes.slice(0, 3).map((item, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded"
                        >
                          {item}
                        </span>
                      ))}
                      {ticket.includes.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{ticket.includes.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Details Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/3 h-48 md:h-auto bg-gradient-to-br from-indigo-400 to-purple-500">
            {event.bannerUrl ? (
              <img
                src={event.bannerUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl opacity-50">🎓</span>
              </div>
            )}
          </div>

          <div className="md:w-2/3 p-6 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Description</h3>
              <p className="text-gray-900 mt-1">
                {event.description || 'No description provided'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Meeting Link</h3>
                {event.meetingLink ? (
                  <a
                    href={event.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline mt-1 inline-block truncate max-w-full"
                  >
                    {event.meetingLink}
                  </a>
                ) : (
                  <span className="mt-1 inline-block text-gray-400">Not set</span>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Language</h3>
                <p className="text-gray-900 mt-1">
                  {event.language === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                </p>
              </div>

              {event.organizer && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Organizer</h3>
                  <p className="text-gray-900 mt-1">{event.organizer}</p>
                </div>
              )}

              {event.format && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Format</h3>
                  <p className="text-gray-900 mt-1 capitalize">{event.format}</p>
                </div>
              )}

              {event.emailDomain && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email Restriction</h3>
                  <p className="text-gray-900 mt-1">@{event.emailDomain}</p>
                </div>
              )}

              {event.whoThisIsFor && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Target Audience</h3>
                  <p className="text-gray-900 mt-1">{event.whoThisIsFor}</p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Public Link</h3>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-gray-100 px-3 py-1 rounded">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/e/{event.slug}
                </code>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/e/${event.slug}`
                      );
                      alert('Link copied!');
                    }
                  }}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendees */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Attendees</h2>
            <p className="text-sm text-gray-500">{filteredAttendees.length} registered</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Ticket filter */}
            {ticketTypes.length > 1 && (
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">All Tickets</option>
                {ticketTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setEmailModalOpen(true)}
              disabled={attendees.length === 0}
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📧 Send Email
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredAttendees.length === 0}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {filteredAttendees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {attendee.name} {attendee.surname}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`mailto:${attendee.email}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {attendee.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                        {attendee.ticketName || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attendee.amountPaid?.toFixed(2) || '0.00'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {attendee.createdAt?.toDate?.()
                        ? attendee.createdAt.toDate().toLocaleDateString()
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-4">👥</div>
            <p>No attendees yet</p>
            <p className="text-sm mt-2">Share the event link to get registrations</p>
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Send Email to All Attendees
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Important update about the event"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="Write your message here..."
                />
              </div>

              <p className="text-sm text-gray-500">
                This will send an email to {attendees.length} attendee(s)
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}