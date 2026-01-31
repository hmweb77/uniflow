// src/app/api/webhook/route.js
// IMPROVED: Handles Stripe webhooks, saves to attendees + users collections, sends email

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '../../lib/firebase-admin';
import { sendEmail, getConfirmationEmailTemplate, addContactToBrevo } from '../../lib/brevo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request) {
  console.log('🔔 [WEBHOOK] Received request');
  
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  // ============================================
  // VALIDATE CONFIGURATION
  // ============================================
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('❌ [WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  if (!signature) {
    console.error('❌ [WEBHOOK] No Stripe signature');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  // ============================================
  // VERIFY WEBHOOK SIGNATURE
  // ============================================
  
  let event;

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    console.log('✅ [WEBHOOK] Signature verified, event:', event.type);
  } catch (err) {
    console.error('❌ [WEBHOOK] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ============================================
  // HANDLE CHECKOUT COMPLETED
  // ============================================
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('💳 [WEBHOOK] Processing checkout:', session.id);

    try {
      const {
        eventId,
        ticketId,
        ticketName,
        customerName,
        customerSurname,
        customerEmail,
      } = session.metadata || {};

      console.log('📋 [WEBHOOK] Metadata:', { eventId, ticketId, ticketName, customerEmail });

      if (!eventId || !customerEmail) {
        console.error('❌ [WEBHOOK] Missing metadata');
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
      }

      // ============================================
      // IDEMPOTENCY CHECK
      // ============================================
      
      const existingAttendee = await adminDb
        .collection('attendees')
        .where('stripeSessionId', '==', session.id)
        .limit(1)
        .get();

      if (!existingAttendee.empty) {
        console.log('⚠️ [WEBHOOK] Duplicate - already processed:', session.id);
        return NextResponse.json({ received: true, status: 'duplicate' });
      }

      // ============================================
      // GET EVENT DATA
      // ============================================
      
      const eventDoc = await adminDb.collection('events').doc(eventId).get();

      if (!eventDoc.exists) {
        console.error('❌ [WEBHOOK] Event not found:', eventId);
        return NextResponse.json({ received: true, status: 'event_not_found' });
      }

      const eventData = eventDoc.data();
      console.log('📅 [WEBHOOK] Event:', eventData.title);

      // Find ticket details
      let ticketDetails = null;
      if (eventData.tickets && ticketId) {
        ticketDetails = eventData.tickets.find((t) => t.id === ticketId);
      }

      // ============================================
      // SAVE ATTENDEE TO DATABASE
      // ============================================
      
      const normalizedEmail = customerEmail.toLowerCase().trim();
      const now = new Date();
      
      const attendeeData = {
        eventId,
        eventTitle: eventData.title,
        name: customerName || '',
        surname: customerSurname || '',
        email: normalizedEmail,
        paymentStatus: 'completed',
        stripeSessionId: session.id,
        stripePaymentIntent: session.payment_intent,
        amountPaid: session.amount_total / 100,
        currency: session.currency || 'eur',
        ticketId: ticketId || 'default',
        ticketName: ticketName || ticketDetails?.name || 'General Admission',
        ticketIncludes: ticketDetails?.includes || [],
        createdAt: now,
        stripeEventId: event.id,
        processedAt: now,
      };

      const attendeeRef = await adminDb.collection('attendees').add(attendeeData);
      console.log('✅ [WEBHOOK] Attendee saved:', attendeeRef.id);

      // ============================================
      // CREATE/UPDATE USER IN USERS COLLECTION
      // ============================================
      
      try {
        // Check if user already exists by email
        const existingUserQuery = await adminDb
          .collection('users')
          .where('email', '==', normalizedEmail)
          .limit(1)
          .get();

        if (existingUserQuery.empty) {
          // Create new user
          const userData = {
            email: normalizedEmail,
            name: customerName || '',
            surname: customerSurname || '',
            createdAt: now,
            updatedAt: now,
            totalSpent: session.amount_total / 100,
            purchaseCount: 1,
            events: [eventId],
            lastPurchase: now,
          };
          
          const userRef = await adminDb.collection('users').add(userData);
          console.log('✅ [WEBHOOK] New user created:', userRef.id);
        } else {
          // Update existing user
          const userDoc = existingUserQuery.docs[0];
          const existingData = userDoc.data();
          
          const updatedEvents = existingData.events || [];
          if (!updatedEvents.includes(eventId)) {
            updatedEvents.push(eventId);
          }
          
          await userDoc.ref.update({
            name: customerName || existingData.name || '',
            surname: customerSurname || existingData.surname || '',
            updatedAt: now,
            totalSpent: (existingData.totalSpent || 0) + (session.amount_total / 100),
            purchaseCount: (existingData.purchaseCount || 0) + 1,
            events: updatedEvents,
            lastPurchase: now,
          });
          console.log('✅ [WEBHOOK] User updated:', userDoc.id);
        }
      } catch (userErr) {
        console.error('⚠️ [WEBHOOK] Failed to update users collection:', userErr.message);
        // Don't fail the webhook - attendee was already saved
      }

      // ============================================
      // UPDATE EVENT ATTENDEE COUNT (OPTIONAL)
      // ============================================
      
      try {
        const eventRef = adminDb.collection('events').doc(eventId);
        await eventRef.update({
          attendeeCount: (eventData.attendeeCount || 0) + 1,
          totalRevenue: (eventData.totalRevenue || 0) + (session.amount_total / 100),
        });
        console.log('✅ [WEBHOOK] Event stats updated');
      } catch (eventUpdateErr) {
        console.error('⚠️ [WEBHOOK] Failed to update event stats:', eventUpdateErr.message);
      }

      // ============================================
      // SEND CONFIRMATION EMAIL
      // ============================================
      
      // Parse event date
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

      // Check if Brevo is configured
      if (!process.env.BREVO_API_KEY) {
        console.warn('⚠️ [WEBHOOK] BREVO_API_KEY not set - skipping email');
        console.log('📧 [WEBHOOK] Would send email to:', normalizedEmail);
      } else {
        // Add to Brevo contact list
        try {
          await addContactToBrevo({
            email: normalizedEmail,
            firstName: customerName || '',
            lastName: customerSurname || '',
            eventDate: eventDate,
            eventTitle: eventData.title,
            meetingLink: eventData.meetingLink || '',
            eventId: eventId,
            ticketType: ticketName || 'General Admission',
            listId: parseInt(process.env.BREVO_LIST_ID || '10'),
          });
          console.log('✅ [WEBHOOK] Contact added to Brevo');
        } catch (brevoErr) {
          console.error('⚠️ [WEBHOOK] Brevo contact error:', brevoErr.message);
        }

        // Send confirmation email
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

          const emailResult = await sendEmail({
            to: normalizedEmail,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
            textContent: emailTemplate.textContent,
          });

          console.log('✅ [WEBHOOK] Email sent to:', normalizedEmail, emailResult);
        } catch (emailErr) {
          console.error('❌ [WEBHOOK] Email error:', emailErr.message);
          console.error('❌ [WEBHOOK] Email error details:', emailErr);
        }
      }

      console.log('🎉 [WEBHOOK] Success for:', normalizedEmail);
      return NextResponse.json({ received: true, status: 'success', attendeeId: attendeeRef.id });
      
    } catch (err) {
      console.error('❌ [WEBHOOK] Processing error:', err);
      return NextResponse.json({ error: 'Processing error' }, { status: 500 });
    }
  }

  // Handle other events
  if (event.type === 'payment_intent.payment_failed') {
    console.log('⚠️ [WEBHOOK] Payment failed:', event.data.object.id);
  }

  if (event.type === 'charge.refunded') {
    console.log('💸 [WEBHOOK] Refund:', event.data.object.id);
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    configured: {
      stripeSecret: !!process.env.STRIPE_SECRET_KEY,
      webhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      brevoKey: !!process.env.BREVO_API_KEY,
    }
  });
}