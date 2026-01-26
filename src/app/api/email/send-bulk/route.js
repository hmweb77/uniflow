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

    // Get event details for context
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    const eventData = eventDoc.exists ? eventDoc.data() : null;

    // Get all attendees for this event
    const attendeesSnap = await adminDb
      .collection('attendees')
      .where('eventId', '==', eventId)
      .where('paymentStatus', '==', 'completed')
      .get();

    if (attendeesSnap.empty) {
      return NextResponse.json(
        { error: 'No attendees found for this event' },
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
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">
                  ${eventData?.title || 'Event Update'}
                </h1>
              </div>
              
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; margin-bottom: 16px;">Hi ${attendee.name || 'there'},</p>
                <div style="white-space: pre-wrap; color: #4b5563;">${body}</div>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p>Uniflow - You received this email because you registered for an event.</p>
              </div>
            </body>
            </html>
          `,
          textContent: `Hi ${attendee.name || 'there'},\n\n${body}\n\n---\nUniflow`,
        });
        return { email: attendee.email, success: true };
      } catch (err) {
        console.error('Failed to send email to:', attendee.email, err);
        return { email: attendee.email, success: false, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Sent ${successful} emails, ${failed} failed`,
      total: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    console.error('Bulk email error:', error);
    return NextResponse.json(
      { error: 'Failed to send emails: ' + error.message },
      { status: 500 }
    );
  }
}