// src/app/api/email/send-bulk/route.js

import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';
import { sendEmail } from '../../../lib/brevo';

export async function POST(request) {
  try {
    const { eventId, subject, body } = await request.json();

    if (!eventId || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get all attendees for this event
    const attendeesSnap = await adminDb
      .collection('attendees')
      .where('eventId', '==', eventId)
      .where('paymentStatus', '==', 'completed')
      .get();

    if (attendeesSnap.empty) {
      return NextResponse.json(
        { error: 'No attendees found' },
        { status: 404 }
      );
    }

    // Send email to each attendee
    const sendPromises = attendeesSnap.docs.map(async (doc) => {
      const attendee = doc.data();
      try {
        await sendEmail({
          to: attendee.email,
          subject,
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <p>Hi ${attendee.name},</p>
              <div style="white-space: pre-wrap;">${body}</div>
              <p style="margin-top: 30px; color: #666; font-size: 12px;">
                You received this email because you registered for an event on Uniflow.
              </p>
            </div>
          `,
          textContent: `Hi ${attendee.name},\n\n${body}`,
        });
        return { email: attendee.email, success: true };
      } catch (err) {
        console.error('Failed to send email to:', attendee.email, err);
        return { email: attendee.email, success: false };
      }
    });

    const results = await Promise.all(sendPromises);
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Sent ${successful} emails, ${failed} failed`,
      results,
    });
  } catch (error) {
    console.error('Bulk email error:', error);
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    );
  }
}