// src/app/api/checkout/route.js
// Checkout API - handles paid (Stripe) and free registrations
// Updated: promo codes, campus field, custom fields support
// FIXED: Custom field metadata keys exceeding Stripe's 40-char limit

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

    // Sold out or at capacity
    const attendeeCount = event.attendeeCount ?? 0;
    const maxTickets = event.maxTickets != null ? Number(event.maxTickets) : null;
    if (event.soldOut === true) {
      return NextResponse.json({ error: 'This event is sold out' }, { status: 400 });
    }
    if (maxTickets != null && attendeeCount >= maxTickets) {
      return NextResponse.json({ error: 'This event is sold out' }, { status: 400 });
    }

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
          // Used count: free path increments below when creating attendee; paid path increments in webhook via promoId
        }
      }
    }

    const finalPrice = Math.max(0, unitPrice - discountAmount);

    // Base metadata (Stripe has a 40-char key limit and 500-char value limit)
    const metadata = {
      eventId,
      eventTitle: event.title?.substring(0, 500) || '',
      firstName,
      lastName,
      email: email.toLowerCase(),
      ticketId: ticketId || '',
      ticketName,
      locale,
      campus: campus || '',
      promoCode: appliedPromo?.code || '',
      ...(appliedPromo?.id && { promoId: appliedPromo.id }),
      discountAmount: discountAmount.toString(),
    };

    // Store custom field values as a single JSON string in metadata
    // This avoids the 40-char key limit issue with long UUID field IDs
    if (customFieldValues && typeof customFieldValues === 'object') {
      const filteredValues = {};
      Object.entries(customFieldValues).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          filteredValues[key] = value.trim().substring(0, 200);
        }
      });
      if (Object.keys(filteredValues).length > 0) {
        const jsonStr = JSON.stringify(filteredValues);
        // Stripe metadata values can be up to 500 chars
        metadata.customFields = jsonStr.substring(0, 500);
      }
    }

    // FREE event path
    if (finalPrice === 0) {
      let parsedCustomFields = {};
      if (customFieldValues && typeof customFieldValues === 'object') {
        parsedCustomFields = customFieldValues;
      }

      const eventRef = adminDb.collection('events').doc(eventId);

      // Use a transaction to atomically check capacity and register
      await adminDb.runTransaction(async (transaction) => {
        const eventSnap = await transaction.get(eventRef);
        if (!eventSnap.exists) throw new Error('Event not found');
        const freshEvent = eventSnap.data();

        const currentCount = freshEvent.attendeeCount ?? 0;
        const max = freshEvent.maxTickets != null ? Number(freshEvent.maxTickets) : null;

        if (freshEvent.soldOut === true || (max != null && currentCount >= max)) {
          throw new Error('This event is sold out');
        }

        transaction.update(eventRef, {
          attendeeCount: FieldValue.increment(1),
        });
      });

      const attendeeData = {
        eventId,
        eventTitle: event.title,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase(),
        ticketId: ticketId || null,
        ticketName,
        amount: 0,
        amountPaid: 0,
        originalPrice: unitPrice,
        discountAmount,
        promoCode: appliedPromo?.code || null,
        campus: campus || null,
        customFields: parsedCustomFields,
        status: 'confirmed',
        paymentStatus: finalPrice === 0 && unitPrice === 0 ? 'free' : 'promo_free',
        createdAt: FieldValue.serverTimestamp(),
      };

      await adminDb.collection('attendees').add(attendeeData);

      // Increment promo used count for free registration (paid path is incremented in webhook)
      if (appliedPromo?.id) {
        await adminDb.collection('promos').doc(appliedPromo.id).update({ usedCount: FieldValue.increment(1) });
      }

      // Update or create user record (match webhook: purchaseCount, events, lastPurchase)
      const usersRef = adminDb.collection('users');
      const userSnap = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
      if (userSnap.empty) {
        await usersRef.add({
          email: email.toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: firstName.trim(),
          surname: lastName.trim(),
          campus: campus || null,
          purchaseCount: 1,
          totalSpent: 0,
          events: [eventId],
          lastPurchase: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const existingData = userSnap.docs[0].data();
        const updatedEvents = existingData.events || [];
        if (!updatedEvents.includes(eventId)) updatedEvents.push(eventId);

        await userSnap.docs[0].ref.update({
          purchaseCount: FieldValue.increment(1),
          events: updatedEvents,
          lastPurchase: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Send confirmation email (UTC so unambiguous; calendar link shows user's local time)
      try {
        const { sendEmail, getConfirmationEmailTemplate } = await import('../../lib/brevo');
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        const utcDateStr = eventDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });
        const utcTimeStr = eventDate.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        });
        const { subject, htmlContent, textContent } = getConfirmationEmailTemplate({
          customerName: firstName.trim(),
          eventId,
          eventTitle: event.title,
          eventDate: `${utcDateStr} (UTC)`,
          eventTime: `${utcTimeStr} (UTC)`,
          meetingLink: event.meetingLink || '',
          ticketName,
          locale,
        });
        await sendEmail({ to: email, subject, htmlContent, textContent });
      } catch (emailErr) {
        console.error('[CHECKOUT] Email send failed (non-blocking):', emailErr.message);
      }

      // Redirect with category for success page (category-based CTA)
      let redirectQuery = `event=${eventId}&lang=${locale}`;
      if (event.category) redirectQuery += `&category=${encodeURIComponent(event.category)}`;
      if (event.categoryName) redirectQuery += `&categoryName=${encodeURIComponent(event.categoryName)}`;

      return NextResponse.json({
        success: true,
        type: 'free',
        redirectUrl: `/success?${redirectQuery}`,
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

    const successCategory = event.category ? `&category=${encodeURIComponent(event.category)}` : '';
    const successCategoryName = event.categoryName ? `&categoryName=${encodeURIComponent(event.categoryName)}` : '';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata,
      customer_email: email,
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&event=${eventId}&lang=${locale}${successCategory}${successCategoryName}`,
      cancel_url: `${appUrl}/e/${event.slug}?cancelled=true`,
      locale: locale === 'fr' ? 'fr' : 'en',
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[CHECKOUT] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}