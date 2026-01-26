// src/app/api/webhook/route.js

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '../../lib/stripe';
import { adminDb } from '../../lib/firebase-admin';
import { sendEmail, getConfirmationEmailTemplate } from '../../lib/brevo';

export async function POST(request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

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
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      // Extract metadata
      const { eventId, customerName, customerSurname, customerEmail } = session.metadata;

      // Get event details from Firestore
      const eventDoc = await adminDb.collection('events').doc(eventId).get();

      if (!eventDoc.exists) {
        console.error('Event not found:', eventId);
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      const eventData = eventDoc.data();

      // Save attendee to Firestore
      await adminDb.collection('attendees').add({
        eventId,
        name: customerName,
        surname: customerSurname,
        email: customerEmail,
        paymentStatus: 'completed',
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
        amountPaid: session.amount_total / 100,
        createdAt: new Date(),
      });

      // Format date for email
      const eventDate = eventData.date?.toDate
        ? eventData.date.toDate()
        : new Date(eventData.date);

      const formattedDate = eventDate.toLocaleDateString(
        eventData.language === 'fr' ? 'fr-FR' : 'en-GB',
        { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      );

      const formattedTime = eventDate.toLocaleTimeString(
        eventData.language === 'fr' ? 'fr-FR' : 'en-GB',
        { hour: '2-digit', minute: '2-digit' }
      );

      // Send confirmation email
      const emailTemplate = getConfirmationEmailTemplate({
        eventTitle: eventData.title,
        eventDate: formattedDate,
        eventTime: formattedTime,
        meetingLink: eventData.meetingLink,
        locale: eventData.language || 'en',
      });

      await sendEmail({
        to: customerEmail,
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.htmlContent,
        textContent: emailTemplate.textContent,
      });

      console.log('Attendee saved and email sent:', customerEmail);
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