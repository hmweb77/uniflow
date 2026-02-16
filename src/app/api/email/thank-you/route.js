// src/app/api/email/thank-you/route.js
// Send post-event thank you email with feedback link

import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';
import { sendEmail, getThankYouEmailTemplate } from '../../../lib/brevo';

export async function POST(request) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    // Get event details
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventDoc.data();

    // Get all attendees for this event
    const attendeesSnap = await adminDb
      .collection('attendees')
      .where('eventId', '==', eventId)
      .get();

    if (attendeesSnap.empty) {
      return NextResponse.json({ error: 'No attendees found for this event' }, { status: 404 });
    }

    const results = { sent: 0, failed: 0, errors: [] };

    for (const attendeeDoc of attendeesSnap.docs) {
      const attendee = attendeeDoc.data();
      const email = attendee.email;
      const name = `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'Student';

      try {
        const { subject, htmlContent } = getThankYouEmailTemplate({
          customerName: name,
          eventTitle: event.title,
          feedbackFormUrl: event.feedbackFormUrl || '',
          locale: event.language || 'en',
        });

        await sendEmail({ to: email, subject, htmlContent });
        results.sent++;

        // Small delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`[THANK YOU] Failed to send to ${email}:`, err.message);
        results.failed++;
        results.errors.push({ email, error: err.message });
      }
    }

    // Mark event as thanked
    await adminDb.collection('events').doc(eventId).update({
      thankYouSent: true,
      thankYouSentAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Sent ${results.sent} thank-you emails`,
      ...results,
    });
  } catch (err) {
    console.error('[THANK YOU] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
