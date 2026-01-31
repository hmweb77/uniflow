// src/app/api/webhook/route.js
// CRITICAL: Handles Stripe payment confirmations

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '../../lib/firebase-admin';
import { sendEmail, getConfirmationEmailTemplate, addContactToBrevo } from '../../lib/brevo';

// IMPORTANT: Required for raw body access in Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  // ============================================
  // VALIDATE CONFIGURATION
  // ============================================
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  if (!signature) {
    console.error('No Stripe signature found in request');
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  // ============================================
  // VERIFY WEBHOOK SIGNATURE (CRITICAL!)
  // ============================================
  
  let event;

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
    
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // ============================================
  // HANDLE CHECKOUT COMPLETED EVENT
  // ============================================
  
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

      // Validate required metadata
      if (!eventId || !customerEmail) {
        console.error('Missing required metadata in session:', session.id);
        return NextResponse.json(
          { error: 'Missing required metadata' },
          { status: 400 }
        );
      }

      // ============================================
      // IDEMPOTENCY CHECK (Prevent duplicates)
      // ============================================
      
      const existingAttendee = await adminDb
        .collection('attendees')
        .where('stripeSessionId', '==', session.id)
        .limit(1)
        .get();

      if (!existingAttendee.empty) {
        console.log('Attendee already exists for session:', session.id);
        return NextResponse.json({ received: true, status: 'duplicate' });
      }

      // ============================================
      // GET EVENT DATA
      // ============================================
      
      const eventDoc = await adminDb.collection('events').doc(eventId).get();

      if (!eventDoc.exists) {
        console.error('Event not found:', eventId);
        return NextResponse.json({ received: true, status: 'event_not_found' });
      }

      const eventData = eventDoc.data();

      // Find ticket details
      let ticketDetails = null;
      if (eventData.tickets && ticketId) {
        ticketDetails = eventData.tickets.find((t) => t.id === ticketId);
      }

      // ============================================
      // SAVE ATTENDEE TO DATABASE
      // ============================================
      
      const attendeeRef = await adminDb.collection('attendees').add({
        eventId,
        name: customerName || '',
        surname: customerSurname || '',
        email: customerEmail.toLowerCase(),
        paymentStatus: 'completed',
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
        amountPaid: session.amount_total / 100,
        currency: session.currency || 'eur',
        ticketId: ticketId || 'default',
        ticketName: ticketName || ticketDetails?.name || 'General Admission',
        ticketIncludes: ticketDetails?.includes || [],
        createdAt: new Date(),
        stripeEventId: event.id,
        processedAt: new Date(),
      });

      console.log('Attendee saved:', attendeeRef.id);

      // ============================================
      // SEND CONFIRMATION EMAIL
      // ============================================
      
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

      // Add to Brevo for reminders
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
          listId: 10,
        });
      } catch (brevoErr) {
        console.error('Failed to add contact to Brevo:', brevoErr);
      }

      // Send email
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

  // Handle other events (optional logging)
  if (event.type === 'payment_intent.payment_failed') {
    console.log('Payment failed:', event.data.object.id);
  }

  if (event.type === 'charge.refunded') {
    console.log('Refund processed:', event.data.object.id);
  }

  return NextResponse.json({ received: true });
}

// Only allow POST
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}