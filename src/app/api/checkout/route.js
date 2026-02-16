// src/app/api/checkout/route.js
// Checkout API - handles paid (Stripe) and free registrations
// Updated: promo codes, campus field, custom fields support

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId,
      ticketId,
      firstName,
      lastName,
      email,
      locale = 'en',
      promoCode,
      campus,
      customFieldValues,
    } = body;

    if (!eventId || !email || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const event = eventDoc.data();

    // Check email domain restriction
    if (event.emailDomain) {
      const allowedDomains = event.emailDomain.split(',').map((d) => d.trim().toLowerCase());
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!allowedDomains.includes(emailDomain)) {
        return NextResponse.json(
          { error: `Registration is restricted to ${event.emailDomain} email addresses` },
          { status: 400 }
        );
      }
    }

    // Duplicate check
    const existingAttendees = await adminDb
      .collection('attendees')
      .where('eventId', '==', eventId)
      .where('email', '==', email.toLowerCase())
      .get();

    if (!existingAttendees.empty) {
      return NextResponse.json({ error: 'You are already registered for this event' }, { status: 400 });
    }

    // Resolve ticket and price SERVER-SIDE
    let ticketName = 'General Admission';
    let unitPrice = event.price || 0;

    if (event.tickets && event.tickets.length > 0) {
      const selectedTicket = ticketId
        ? event.tickets.find((t) => t.id === ticketId)
        : event.tickets[0];
      if (selectedTicket) {
        ticketName = selectedTicket.name;
        unitPrice = selectedTicket.price || 0;
      }
    }

    // Apply promo code
    let discountAmount = 0;
    let appliedPromo = null;

    if (promoCode) {
      const promosRef = adminDb.collection('promos');
      const promoSnap = await promosRef.where('code', '==', promoCode.toUpperCase()).limit(1).get();

      if (!promoSnap.empty) {
        const promoDoc = promoSnap.docs[0];
        const promo = promoDoc.data();

        // Validate promo
        const isValid =
          promo.active !== false &&
          (!promo.expiresAt || (promo.expiresAt.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt)) > new Date()) &&
          (!promo.maxUses || (promo.usedCount || 0) < promo.maxUses) &&
          (!promo.eventId || promo.eventId === eventId);

        if (isValid) {
          if (promo.discountType === 'percentage') {
            discountAmount = Math.round(unitPrice * (promo.discountValue / 100) * 100) / 100;
          } else {
            discountAmount = Math.min(promo.discountValue, unitPrice);
          }
          appliedPromo = { id: promoDoc.id, code: promo.code, discountAmount };

          // Increment used count
          await promoDoc.ref.update({ usedCount: FieldValue.increment(1) });
        }
      }
    }

    const finalPrice = Math.max(0, unitPrice - discountAmount);

    // Base metadata
    const metadata = {
      eventId,
      eventTitle: event.title,
      firstName,
      lastName,
      email: email.toLowerCase(),
      ticketId: ticketId || '',
      ticketName,
      locale,
      campus: campus || '',
      promoCode: appliedPromo?.code || '',
      discountAmount: discountAmount.toString(),
    };

    // Store custom field values in metadata
    if (customFieldValues && typeof customFieldValues === 'object') {
      Object.entries(customFieldValues).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          metadata[`custom_${key}`] = value.trim().substring(0, 500);
        }
      });
    }

    // FREE event path
    if (finalPrice === 0) {
      const attendeeData = {
        eventId,
        eventTitle: event.title,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase(),
        ticketId: ticketId || null,
        ticketName,
        amount: 0,
        originalPrice: unitPrice,
        discountAmount,
        promoCode: appliedPromo?.code || null,
        campus: campus || null,
        customFields: customFieldValues || {},
        status: 'confirmed',
        paymentStatus: finalPrice === 0 && unitPrice === 0 ? 'free' : 'promo_free',
        createdAt: FieldValue.serverTimestamp(),
      };

      await adminDb.collection('attendees').add(attendeeData);

      // Update event counters
      await adminDb.collection('events').doc(eventId).update({
        attendeeCount: FieldValue.increment(1),
      });

      // Update or create user record
      const usersRef = adminDb.collection('users');
      const userSnap = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
      if (userSnap.empty) {
        await usersRef.add({
          email: email.toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          campus: campus || null,
          eventCount: 1,
          totalSpent: 0,
          firstEventDate: FieldValue.serverTimestamp(),
          lastEventDate: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        await userSnap.docs[0].ref.update({
          eventCount: FieldValue.increment(1),
          lastEventDate: FieldValue.serverTimestamp(),
        });
      }

      // Send confirmation email
      try {
        const { sendEmail, getConfirmationEmailTemplate } = await import('../../lib/brevo');
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        const { subject, htmlContent, textContent } = getConfirmationEmailTemplate({
          customerName: firstName.trim(),
          eventId,
          eventTitle: event.title,
          eventDate: eventDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
          eventTime: eventDate.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' }),
          meetingLink: event.meetingLink || '',
          ticketName,
          locale,
        });
        await sendEmail({ to: email, subject, htmlContent, textContent });
      } catch (emailErr) {
        console.error('[CHECKOUT] Email send failed (non-blocking):', emailErr.message);
      }

      // Determine redirect based on category
      let redirectCategory = '';
      if (event.category) redirectCategory = `&category=${event.category}`;

      return NextResponse.json({
        success: true,
        type: 'free',
        redirectUrl: `/success?event=${eventId}&lang=${locale}${redirectCategory}`,
      });
    }

    // PAID event path - Create Stripe session
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Build line items
    const lineItems = [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${event.title}${ticketName !== 'General Admission' ? ` - ${ticketName}` : ''}`,
            description: event.description?.substring(0, 500) || undefined,
          },
          unit_amount: Math.round(finalPrice * 100),
        },
        quantity: 1,
      },
    ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata,
      customer_email: email,
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&event=${eventId}&lang=${locale}`,
      cancel_url: `${appUrl}/e/${event.slug}?cancelled=true`,
      locale: locale === 'fr' ? 'fr' : 'en',
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[CHECKOUT] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
