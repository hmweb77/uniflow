// src/app/api/webhook/route.js

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '../../lib/stripe';
import { adminDb } from '../../lib/firebase-admin';
import { sendEmail, getConfirmationEmailTemplate, addContactToBrevo } from '../../lib/brevo';

export async function POST(request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      const {
        eventId,
        ticketId,
        ticketName,
        customerName,
        customerSurname,
        customerEmail,
      } = session.metadata || {};

      if (!eventId || !customerEmail) {
        console.error('Missing required metadata in session:', session.id);
        return NextResponse.json(
          { error: 'Missing required metadata' },
          { status: 400 }
        );
      }

      // Get event details
      const eventDoc = await adminDb.collection('events').doc(eventId).get();

      if (!eventDoc.exists) {
        console.error('Event not found:', eventId);
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      const eventData = eventDoc.data();

      // Check for duplicate
      const existingAttendee = await adminDb
        .collection('attendees')
        .where('stripeSessionId', '==', session.id)
        .limit(1)
        .get();

      if (!existingAttendee.empty) {
        console.log('Attendee already exists for session:', session.id);
        return NextResponse.json({ received: true, status: 'duplicate' });
      }

      // Find matching ticket details from event
      let ticketDetails = null;
      if (eventData.tickets && ticketId) {
        ticketDetails = eventData.tickets.find((t) => t.id === ticketId);
      }

      // Save attendee with ticket info
      const attendeeRef = await adminDb.collection('attendees').add({
        eventId,
        name: customerName || '',
        surname: customerSurname || '',
        email: customerEmail,
        paymentStatus: 'completed',
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
        amountPaid: session.amount_total / 100,
        currency: session.currency || 'eur',
        ticketId: ticketId || 'default',
        ticketName: ticketName || ticketDetails?.name || 'General Admission',
        ticketIncludes: ticketDetails?.includes || [],
        createdAt: new Date(),
      });

      console.log('Attendee saved:', attendeeRef.id);

      // Format date for email
      let eventDate;
      if (eventData.date?.toDate) {
        eventDate = eventData.date.toDate();
      } else if (eventData.date?._seconds) {
        eventDate = new Date(eventData.date._seconds * 1000);
      } else {
        eventDate = new Date(eventData.date);
      }

      const formattedDate = eventDate.toLocaleDateString(
        eventData.language === 'fr' ? 'fr-FR' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      );

      const formattedTime = eventDate.toLocaleTimeString(
        eventData.language === 'fr' ? 'fr-FR' : 'en-GB',
        { hour: '2-digit', minute: '2-digit' }
      );

      // ==================================================
      // ADD CONTACT TO BREVO FOR AUTOMATED REMINDERS
      // ==================================================
      try {
        await addContactToBrevo({
          email: customerEmail,
          firstName: customerName || '',
          lastName: customerSurname || '',
          eventDate: eventDate,
          eventTitle: eventData.title,
          meetingLink: eventData.meetingLink || '',
          eventId: eventId,
          ticketType: ticketName || 'General Admission',
          listId: 10, // Uniflow Attendees list ID
        });
        console.log('Contact added to Brevo list:', customerEmail);
      } catch (brevoErr) {
        // Don't fail the webhook if Brevo fails
        console.error('Failed to add contact to Brevo:', brevoErr);
      }
      // ==================================================

      // Send confirmation email with calendar links
      try {
        const emailTemplate = getConfirmationEmailTemplate({
          customerName: customerName || 'Student',
          eventId,
          eventTitle: eventData.title,
          eventDate: formattedDate,
          eventTime: formattedTime,
          meetingLink: eventData.meetingLink || '',
          ticketName: ticketName || 'General Admission',
          locale: eventData.language || 'en',
        });

        await sendEmail({
          to: customerEmail,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.htmlContent,
          textContent: emailTemplate.textContent,
        });

        console.log('Confirmation email sent to:', customerEmail);
      } catch (emailErr) {
        console.error('Failed to send confirmation email:', emailErr);
      }

      console.log('Webhook processed successfully for:', customerEmail);
    } catch (err) {
      console.error('Error processing webhook:', err);
      return NextResponse.json(
        { error: 'Error processing webhook' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};