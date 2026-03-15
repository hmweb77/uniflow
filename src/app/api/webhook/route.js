// src/app/api/webhook/route.js
// Handles Stripe payment confirmations
// FIXED: Uses FieldValue.increment() for atomic counter updates

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { adminDb } from '../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendEmail, getConfirmationEmailTemplate, getCartConfirmationEmailTemplate, addContactToBrevo } from '../../lib/brevo';

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
      const metadata = session.metadata || {};

      // ============================================
      // CART PURCHASE (multi-item checkout)
      // ============================================
      if (metadata.orderType === 'cart') {
        const { firstName, lastName, email, promoCode, promoId, campus, cartItemsJson, locale: cartLocale } = metadata;
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (!normalizedEmail) {
          console.error('❌ [WEBHOOK] Cart checkout missing email');
          return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        }

        // Idempotency check
        const existingCartOrder = await adminDb
          .collection('product_orders')
          .where('stripeSessionId', '==', session.id)
          .limit(1)
          .get();
        if (!existingCartOrder.empty) {
          console.log('⚠️ [WEBHOOK] Cart order already processed:', session.id);
          return NextResponse.json({ received: true, status: 'duplicate' });
        }

        // Parse cart items from metadata
        let cartItems = [];
        try {
          cartItems = JSON.parse(cartItemsJson || '[]');
        } catch { cartItems = []; }

        const now = new Date();
        const amountPerItem = cartItems.length > 0 ? (session.amount_total / 100) / cartItems.length : 0;

        for (const item of cartItems) {
          if (item.type === 'product') {
            await adminDb.collection('product_orders').add({
              productId: item.id,
              productTitle: item.title,
              firstName: firstName || '',
              lastName: lastName || '',
              email: normalizedEmail,
              amountPaid: Math.round(amountPerItem * 100) / 100,
              currency: session.currency || 'eur',
              paymentStatus: 'completed',
              stripeSessionId: session.id,
              stripePaymentIntent: session.payment_intent,
              campus: campus || null,
              promoCode: promoCode || null,
              orderSource: 'cart',
              createdAt: now,
            });

            try {
              await adminDb.collection('products').doc(item.id).update({
                purchaseCount: FieldValue.increment(1),
                totalRevenue: FieldValue.increment(Math.round(amountPerItem * 100) / 100),
              });
            } catch (e) { console.warn('⚠️ [WEBHOOK] Product stats update failed:', e.message); }

          } else if (item.type === 'event') {
            await adminDb.collection('attendees').add({
              eventId: item.id,
              eventTitle: item.title,
              firstName: firstName || '',
              lastName: lastName || '',
              name: firstName || '',
              surname: lastName || '',
              email: normalizedEmail,
              paymentStatus: 'completed',
              stripeSessionId: session.id,
              stripePaymentIntent: session.payment_intent,
              amountPaid: Math.round(amountPerItem * 100) / 100,
              currency: session.currency || 'eur',
              ticketId: item.ticketId || 'default',
              ticketName: item.ticketName || 'General Admission',
              campus: campus || null,
              promoCode: promoCode || null,
              orderSource: 'cart',
              createdAt: now,
              stripeEventId: event.id,
              processedAt: now,
            });

            try {
              await adminDb.collection('events').doc(item.id).update({
                attendeeCount: FieldValue.increment(1),
                totalRevenue: FieldValue.increment(Math.round(amountPerItem * 100) / 100),
              });
            } catch (e) { console.warn('⚠️ [WEBHOOK] Event stats update failed:', e.message); }
          }
        }

        // Update/create user
        try {
          const existingUserQuery = await adminDb
            .collection('users')
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();

          const eventIds = cartItems.filter((i) => i.type === 'event').map((i) => i.id);

          if (existingUserQuery.empty) {
            await adminDb.collection('users').add({
              email: normalizedEmail,
              firstName: firstName || '',
              lastName: lastName || '',
              name: firstName || '',
              surname: lastName || '',
              createdAt: now,
              updatedAt: now,
              totalSpent: session.amount_total / 100,
              purchaseCount: cartItems.length,
              events: eventIds,
              lastPurchase: now,
            });
          } else {
            const userDoc = existingUserQuery.docs[0];
            const existingData = userDoc.data();
            const updatedEvents = [...(existingData.events || [])];
            eventIds.forEach((id) => { if (!updatedEvents.includes(id)) updatedEvents.push(id); });
            await userDoc.ref.update({
              updatedAt: now,
              totalSpent: (existingData.totalSpent || 0) + (session.amount_total / 100),
              purchaseCount: (existingData.purchaseCount || 0) + cartItems.length,
              events: updatedEvents,
              lastPurchase: now,
            });
          }
        } catch (userErr) {
          console.warn('⚠️ [WEBHOOK] Cart user update failed:', userErr.message);
        }

        if (promoId) {
          try {
            await adminDb.collection('promos').doc(promoId).update({ usedCount: FieldValue.increment(1) });
          } catch {}
        }

        if (process.env.BREVO_API_KEY) {
          try {
            // Enrich cart items with access links (meeting links for events, download URLs for products)
            const enrichedItems = [];
            for (const item of cartItems) {
              const enriched = { ...item };
              if (item.type === 'event') {
                try {
                  const eventDoc = await adminDb.collection('events').doc(item.id).get();
                  if (eventDoc.exists) {
                    const eventData = eventDoc.data();
                    enriched.meetingLink = eventData.meetingLink || null;
                    if (eventData.date) {
                      const d = eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date);
                      const loc = cartLocale === 'fr' ? 'fr-FR' : 'en-GB';
                      enriched.eventDate = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
                    }
                  }
                } catch {}
              } else if (item.type === 'product' && !item.downloadUrl) {
                try {
                  const prodDoc = await adminDb.collection('products').doc(item.id).get();
                  if (prodDoc.exists) {
                    enriched.downloadUrl = prodDoc.data().downloadUrl || null;
                  }
                } catch {}
              }
              enrichedItems.push(enriched);
            }

            // Fetch recommendations based on purchased category tags
            let recommendations = [];
            const categoryTag = metadata.categoryFilter || '';
            try {
              // Get related products from purchased items
              const purchasedIds = cartItems.map((i) => i.id);
              const relatedIds = new Set();

              for (const item of cartItems) {
                const col = item.type === 'event' ? 'events' : 'products';
                try {
                  const doc = await adminDb.collection(col).doc(item.id).get();
                  if (doc.exists) {
                    const data = doc.data();
                    (data.relatedProductIds || []).forEach((id) => {
                      if (!purchasedIds.includes(id)) relatedIds.add(id);
                    });
                  }
                } catch {}
              }

              // Fetch up to 3 recommendation docs
              const recIds = [...relatedIds].slice(0, 3);
              for (const recId of recIds) {
                // Try products first, then events
                let recDoc = await adminDb.collection('products').doc(recId).get();
                if (recDoc.exists) {
                  const d = recDoc.data();
                  if (d.status === 'published') {
                    recommendations.push({ title: d.title, slug: d.slug, price: d.price, type: 'product' });
                  }
                } else {
                  recDoc = await adminDb.collection('events').doc(recId).get();
                  if (recDoc.exists) {
                    const d = recDoc.data();
                    recommendations.push({ title: d.title, slug: d.slug, price: d.price, type: 'event' });
                  }
                }
              }
            } catch (recErr) {
              console.warn('⚠️ [WEBHOOK] Recommendation fetch error:', recErr.message);
            }

            const discountPct = parseInt(metadata.discountPercent || '0', 10);
            const totalPaid = session.amount_total / 100;
            const originalTotal = discountPct > 0 ? totalPaid / (1 - discountPct / 100) : totalPaid;
            const savings = originalTotal - totalPaid;

            const { subject, htmlContent, textContent } = getCartConfirmationEmailTemplate({
              customerName: firstName || 'Customer',
              items: enrichedItems,
              totalPaid,
              discountPercent: discountPct,
              savings,
              recommendations,
              categoryFilter: categoryTag,
              locale: cartLocale === 'fr' ? 'fr' : 'en',
            });
            await sendEmail({ to: normalizedEmail, subject, htmlContent, textContent });
            console.log('✅ [WEBHOOK] Cart confirmation email sent');
          } catch (emailErr) {
            console.error('❌ [WEBHOOK] Cart email error:', emailErr.message);
          }
        }

        console.log('🎉 [WEBHOOK] Cart order processed:', cartItems.length, 'items');
        return NextResponse.json({ received: true, status: 'success', orderType: 'cart' });
      }

      // ============================================
      // PRODUCT PURCHASE (digital product)
      // ============================================
      if (metadata.orderType === 'product') {
        const { productId, productTitle, firstName, lastName, email, promoCode, promoId, campus } = metadata;
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (!productId || !normalizedEmail) {
          console.error('❌ [WEBHOOK] Product checkout missing metadata');
          return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
        }

        const existingOrder = await adminDb
          .collection('product_orders')
          .where('stripeSessionId', '==', session.id)
          .limit(1)
          .get();

        if (!existingOrder.empty) {
          console.log('⚠️ [WEBHOOK] Product order already processed:', session.id);
          return NextResponse.json({ received: true, status: 'duplicate' });
        }

        const productDoc = await adminDb.collection('products').doc(productId).get();
        const product = productDoc.exists ? productDoc.data() : {};
        const downloadUrl = product.downloadUrl || null;

        const orderData = {
          productId,
          productTitle: productTitle || product.title,
          firstName: firstName || '',
          lastName: lastName || '',
          email: normalizedEmail,
          amountPaid: session.amount_total / 100,
          currency: session.currency || 'eur',
          paymentStatus: 'completed',
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          createdAt: new Date(),
          ...(campus && { campus }),
          ...(promoCode && { promoCode }),
        };

        await adminDb.collection('product_orders').add(orderData);
        console.log('✅ [WEBHOOK] Product order saved');

        if (promoId) {
          try {
            await adminDb.collection('promos').doc(promoId).update({
              usedCount: FieldValue.increment(1),
            });
          } catch (promoErr) {
            console.warn('⚠️ [WEBHOOK] Product promo usedCount increment failed:', promoErr.message);
          }
        }

        if (process.env.BREVO_API_KEY) {
          try {
            const { sendEmail, getProductConfirmationEmailTemplate } = await import('../../lib/brevo');
            const locale = metadata.locale === 'fr' ? 'fr' : 'en';
            const { subject, htmlContent, textContent } = getProductConfirmationEmailTemplate({
              customerName: firstName || 'Customer',
              productTitle: productTitle || product.title,
              downloadUrl,
              locale,
            });
            await sendEmail({
              to: normalizedEmail,
              subject,
              htmlContent,
              textContent,
            });
            console.log('✅ [WEBHOOK] Product confirmation email sent to:', normalizedEmail);
          } catch (emailErr) {
            console.error('❌ [WEBHOOK] Product email error:', emailErr.message);
          }
        }

        return NextResponse.json({ received: true, status: 'success', orderType: 'product' });
      }

      // ============================================
      // EVENT REGISTRATION (existing logic)
      // ============================================
      const {
        eventId,
        ticketId,
        ticketName,
        firstName: customerName,
        lastName: customerSurname,
        email: customerEmail,
        promoCode,
        promoId,
        campus,
        customFields: customFieldsStr,
      } = metadata;

      let customFieldsObj = {};
      if (customFieldsStr && typeof customFieldsStr === 'string') {
        try {
          customFieldsObj = JSON.parse(customFieldsStr);
        } catch (_) {}
      }

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
        firstName: customerName || '',
        lastName: customerSurname || '',
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
        ...(campus && { campus }),
        ...(Object.keys(customFieldsObj).length > 0 && { customFields: customFieldsObj }),
        ...(promoCode && { promoCode }),
      };

      const attendeeRef = await adminDb.collection('attendees').add(attendeeData);

      if (promoId) {
        try {
          await adminDb.collection('promos').doc(promoId).update({
            usedCount: FieldValue.increment(1),
          });
        } catch (promoErr) {
          console.warn('⚠️ [WEBHOOK] Promo usedCount increment failed:', promoErr.message);
        }
      }
      console.log('✅ [WEBHOOK] Attendee saved:', attendeeRef.id);

      // ============================================
      // CREATE/UPDATE USER IN USERS COLLECTION
      // ============================================

      try {
        const existingUserQuery = await adminDb
          .collection('users')
          .where('email', '==', normalizedEmail)
          .limit(1)
          .get();

        if (existingUserQuery.empty) {
          // Create new user (firstName/lastName match free-path and consumers)
          const userData = {
            email: normalizedEmail,
            firstName: customerName || '',
            lastName: customerSurname || '',
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
            firstName: customerName || existingData.firstName || existingData.name || '',
            lastName: customerSurname || existingData.lastName || existingData.surname || '',
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
        // Don't fail the webhook — attendee was already saved
      }

      // ============================================
      // UPDATE EVENT STATS (TRANSACTION)
      // ============================================

      try {
        const eventRef = adminDb.collection('events').doc(eventId);
        await adminDb.runTransaction(async (transaction) => {
          const snap = await transaction.get(eventRef);
          if (!snap.exists) return;
          transaction.update(eventRef, {
            attendeeCount: FieldValue.increment(1),
            totalRevenue: FieldValue.increment(session.amount_total / 100),
          });
        });
        console.log('✅ [WEBHOOK] Event stats updated (transaction)');
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

      const locale = eventData.language === 'fr' ? 'fr-FR' : 'en-GB';
      const formattedDate = `${eventDate.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })} (UTC)`;
      const formattedTime = `${eventDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })} (UTC)`;

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
            campus: campus || '',
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
    },
  });
}