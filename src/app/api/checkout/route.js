// src/app/api/checkout/route.js
// SECURITY: Price is verified from database, NOT from client request
// SUPPORTS: Paid events (Stripe) + Free events (direct registration)

import { NextResponse } from 'next/server';
import { adminDb } from '../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId,
      ticketId,
      customerName,
      customerSurname,
      customerEmail,
      locale = 'en',
    } = body;

    // ============================================
    // VALIDATION
    // ============================================

    if (!eventId || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // ============================================
    // GET EVENT & PRICE FROM DATABASE (CRITICAL!)
    // Never trust client-provided price
    // ============================================

    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const eventData = eventDoc.data();

    // Check if event is still active
    if (eventData.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This event has been cancelled' },
        { status: 400 }
      );
    }

    // ============================================
    // CHECK IF EVENT DATE HAS PASSED (CRITICAL!)
    // ============================================

    if (!eventData.date) {
      return NextResponse.json(
        { error: 'Event date is not configured' },
        { status: 500 }
      );
    }

    let eventDate;
    if (eventData.date?.toDate) {
      eventDate = eventData.date.toDate();
    } else if (eventData.date?._seconds) {
      eventDate = new Date(eventData.date._seconds * 1000);
    } else {
      eventDate = new Date(eventData.date);
    }

    if (isNaN(eventDate.getTime())) {
      return NextResponse.json(
        { error: 'Event has an invalid date configuration' },
        { status: 500 }
      );
    }

    if (eventDate < new Date()) {
      return NextResponse.json(
        { error: 'This event has already ended. Registration is closed.' },
        { status: 400 }
      );
    }

    // ============================================
    // GET SERVER-SIDE PRICE FROM TICKET
    // ============================================

    let price;
    let resolvedTicketId = ticketId || 'default';
    let resolvedTicketName = 'General Admission';

    if (eventData.tickets && eventData.tickets.length > 0) {
      const ticket = ticketId
        ? eventData.tickets.find(t => t.id === ticketId)
        : eventData.tickets[0];

      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket type not found' },
          { status: 404 }
        );
      }

      price = ticket.price;
      resolvedTicketId = ticket.id;
      resolvedTicketName = ticket.name;
    } else {
      // Legacy: single price field
      price = eventData.price;
    }

    // Validate price — allows 0 for free events
    if (typeof price !== 'number' || !isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: 'Invalid ticket price configuration' },
        { status: 500 }
      );
    }

    // ============================================
    // CHECK EMAIL DOMAIN RESTRICTION
    // ============================================

    if (eventData.emailDomain && eventData.emailDomain.trim()) {
      const requiredDomain = eventData.emailDomain.trim().toLowerCase();
      const emailDomain = customerEmail.split('@')[1]?.toLowerCase();

      if (emailDomain !== requiredDomain) {
        return NextResponse.json(
          { error: `Only @${requiredDomain} emails are allowed for this event` },
          { status: 400 }
        );
      }
    }

    // ============================================
    // PREVENT DUPLICATE REGISTRATIONS
    // ============================================

    const normalizedEmail = customerEmail.toLowerCase().trim();

    const existingAttendee = await adminDb
      .collection('attendees')
      .where('eventId', '==', eventId)
      .where('email', '==', normalizedEmail)
      .where('paymentStatus', '==', 'completed')
      .limit(1)
      .get();

    if (!existingAttendee.empty) {
      return NextResponse.json(
        { error: 'You are already registered for this event' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitize = (str) => str ? String(str).slice(0, 200).replace(/[<>]/g, '') : '';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      console.error('NEXT_PUBLIC_APP_URL is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // ============================================
    // FREE EVENT → Register directly (skip Stripe)
    // ============================================

    if (price === 0) {
      const now = new Date();

      // Save attendee
      const attendeeData = {
        eventId,
        eventTitle: eventData.title,
        name: sanitize(customerName) || '',
        surname: sanitize(customerSurname) || '',
        email: normalizedEmail,
        paymentStatus: 'completed',
        stripeSessionId: `free_${eventId}_${Date.now()}`,
        stripePaymentIntent: null,
        amountPaid: 0,
        currency: 'eur',
        ticketId: resolvedTicketId,
        ticketName: resolvedTicketName,
        ticketIncludes: eventData.tickets?.find(t => t.id === resolvedTicketId)?.includes || [],
        createdAt: now,
        processedAt: now,
        isFreeRegistration: true,
      };

      const attendeeRef = await adminDb.collection('attendees').add(attendeeData);
      console.log('✅ Free attendee registered:', attendeeRef.id);

      // Update/create user record
      try {
        const existingUserQuery = await adminDb
          .collection('users')
          .where('email', '==', normalizedEmail)
          .limit(1)
          .get();

        if (existingUserQuery.empty) {
          await adminDb.collection('users').add({
            email: normalizedEmail,
            name: sanitize(customerName) || '',
            surname: sanitize(customerSurname) || '',
            createdAt: now,
            updatedAt: now,
            totalSpent: 0,
            purchaseCount: 1,
            events: [eventId],
            lastPurchase: now,
          });
        } else {
          const userDoc = existingUserQuery.docs[0];
          const userData = userDoc.data();
          const updatedEvents = userData.events || [];
          if (!updatedEvents.includes(eventId)) updatedEvents.push(eventId);

          await userDoc.ref.update({
            updatedAt: now,
            purchaseCount: (userData.purchaseCount || 0) + 1,
            events: updatedEvents,
            lastPurchase: now,
          });
        }
      } catch (userErr) {
        console.error('⚠️ Free reg user update failed:', userErr.message);
      }

      // Update event stats (atomic)
      try {
        await adminDb.collection('events').doc(eventId).update({
          attendeeCount: FieldValue.increment(1),
        });
      } catch (statsErr) {
        console.error('⚠️ Free reg stats update failed:', statsErr.message);
      }

      // Send confirmation email
      try {
        const { sendEmail, getConfirmationEmailTemplate, addContactToBrevo } = await import('../../lib/brevo');

        const formattedDate = eventDate.toLocaleDateString(
          eventData.language === 'fr' ? 'fr-FR' : 'en-GB',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        );
        const formattedTime = eventDate.toLocaleTimeString(
          eventData.language === 'fr' ? 'fr-FR' : 'en-GB',
          { hour: '2-digit', minute: '2-digit' }
        );

        await addContactToBrevo({
          email: normalizedEmail,
          firstName: sanitize(customerName) || '',
          lastName: sanitize(customerSurname) || '',
          eventDate,
          eventTitle: eventData.title,
          meetingLink: eventData.meetingLink || '',
          eventId,
          ticketType: resolvedTicketName,
          listId: parseInt(process.env.BREVO_LIST_ID || '10'),
        }).catch(err => console.error('⚠️ Brevo contact error:', err.message));

        const emailTemplate = getConfirmationEmailTemplate({
          customerName: sanitize(customerName) || 'Student',
          eventId,
          eventTitle: eventData.title,
          eventDate: formattedDate,
          eventTime: formattedTime,
          meetingLink: eventData.meetingLink || '',
          ticketName: resolvedTicketName,
          locale: eventData.language || locale,
        });

        await sendEmail({
          to: normalizedEmail,
          subject: emailTemplate.subject,
          htmlContent: emailTemplate.htmlContent,
          textContent: emailTemplate.textContent,
        });

        console.log('✅ Free reg email sent to:', normalizedEmail);
      } catch (emailErr) {
        console.error('⚠️ Free reg email failed:', emailErr.message);
      }

      const successUrl = `${appUrl}/success?lang=${locale}&event=${eventId}`;
      return NextResponse.json({ url: successUrl, free: true });
    }

    // ============================================
    // PAID EVENT → Create Stripe checkout session
    // ============================================

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const productName = resolvedTicketName !== 'General Admission'
      ? `${eventData.title} - ${resolvedTicketName}`
      : eventData.title;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: normalizedEmail,

      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
              description: `Registration for ${eventData.title}`,
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],

      metadata: {
        eventId,
        ticketId: resolvedTicketId,
        ticketName: resolvedTicketName,
        customerName: sanitize(customerName) || '',
        customerSurname: sanitize(customerSurname) || '',
        customerEmail: normalizedEmail,
      },

      success_url: `${appUrl}/success?lang=${locale}&event=${eventId}`,
      cancel_url: `${appUrl}/e/${eventData.slug || eventId}`,

      locale: locale === 'fr' ? 'fr' : 'auto',

      payment_intent_data: {
        metadata: {
          eventId,
          ticketId: resolvedTicketId,
          ticketName: resolvedTicketName,
          customerEmail: normalizedEmail,
        },
      },

      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('Checkout error:', error);

    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    );
  }
}

// Only allow POST
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}