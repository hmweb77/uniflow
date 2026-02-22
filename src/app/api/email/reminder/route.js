// src/app/api/email/reminder/route.js
// Send 24h or 1h reminder emails to all attendees of an event

import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';
import {
  sendEmail,
  get24HourReminderTemplate,
  get1HourReminderTemplate,
} from '../../../lib/brevo';
import { verifyAdminAuth } from '../../../lib/auth-check';

export async function POST(request) {
  const user = await verifyAdminAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { eventId, reminderType } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }
    if (!reminderType || !['24h', '1h'].includes(reminderType)) {
      return NextResponse.json(
        { error: 'reminderType must be "24h" or "1h"' },
        { status: 400 }
      );
    }

    // Get event details
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventDoc.data();

    // Parse event date for formatted strings
    let eventDate;
    if (event.date?.toDate) {
      eventDate = event.date.toDate();
    } else if (event.date?._seconds) {
      eventDate = new Date(event.date._seconds * 1000);
    } else {
      eventDate = new Date(event.date);
    }

    const locale = event.language === 'fr' ? 'fr-FR' : 'en-GB';
    const formattedDate = `${eventDate.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })} (UTC)`;
    const formattedTime = `${eventDate.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    })} (UTC)`;

    // Get all attendees for this event (paid/valid status only)
    const attendeesSnap = await adminDb
      .collection('attendees')
      .where('eventId', '==', eventId)
      .where('paymentStatus', 'in', ['completed', 'paid', 'free', 'promo_free'])
      .get();

    if (attendeesSnap.empty) {
      return NextResponse.json(
        { error: 'No attendees found for this event' },
        { status: 404 }
      );
    }

    const getTemplate =
      reminderType === '24h' ? get24HourReminderTemplate : get1HourReminderTemplate;
    const results = { sent: 0, failed: 0 };

    for (const attendeeDoc of attendeesSnap.docs) {
      const attendee = attendeeDoc.data();
      const email = attendee.email;
      const name =
        `${attendee.firstName || attendee.name || ''} ${attendee.lastName || attendee.surname || ''}`.trim() ||
        'Student';

      try {
        const { subject, htmlContent } = getTemplate({
          customerName: name,
          eventTitle: event.title,
          eventDate: formattedDate,
          eventTime: formattedTime,
          meetingLink: event.meetingLink || '',
          locale: event.language || 'en',
        });

        await sendEmail({ to: email, subject, htmlContent });
        results.sent++;

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`[REMINDER ${reminderType}] Failed to send to ${email}:`, err.message);
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
    });
  } catch (err) {
    console.error('[REMINDER] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
