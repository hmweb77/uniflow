// src/app/api/checkout/cart/route.js
// Multi-item cart checkout: validates discounts server-side, creates Stripe session with multiple line items

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '../../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request) {
  try {
    const body = await request.json();
    const { items, privateCallAdded, firstName, lastName, email, locale = 'en', promoCode, campus } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }
    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ============================================
    // FETCH ALL ITEMS FROM FIRESTORE (validate they exist)
    // ============================================
    const validatedItems = [];
    for (const item of items) {
      if (item.type === 'product') {
        const doc = await adminDb.collection('products').doc(item.id).get();
        if (!doc.exists) {
          return NextResponse.json({ error: `Product not found: ${item.title}` }, { status: 404 });
        }
        const data = doc.data();
        if (data.status !== 'published') {
          return NextResponse.json({ error: `Product not available: ${data.title}` }, { status: 400 });
        }
        validatedItems.push({
          id: doc.id,
          type: 'product',
          title: data.title,
          price: Number(data.price) || 0,
          subject: data.subject || null,
          slug: data.slug,
          downloadUrl: data.downloadUrl || null,
        });
      } else if (item.type === 'event') {
        const doc = await adminDb.collection('events').doc(item.id).get();
        if (!doc.exists) {
          return NextResponse.json({ error: `Event not found: ${item.title}` }, { status: 404 });
        }
        const data = doc.data();
        validatedItems.push({
          id: doc.id,
          type: 'event',
          title: data.title,
          price: Number(item.price) || Number(data.price) || 0,
          subject: data.subject || null,
          slug: data.slug,
          ticketId: item.ticketId || null,
          ticketName: item.ticketName || null,
        });
      }
    }

    // ============================================
    // FETCH PRIVATE CALL PRODUCT IF ADDED
    // ============================================
    let privateCallItem = null;
    if (privateCallAdded) {
      const configDoc = await adminDb.collection('site_config').doc('global').get();
      if (configDoc.exists()) {
        const config = configDoc.data();
        if (config.privateCallProductId) {
          const callDoc = await adminDb.collection('products').doc(config.privateCallProductId).get();
          if (callDoc.exists()) {
            const callData = callDoc.data();
            privateCallItem = {
              id: callDoc.id,
              type: 'product',
              title: callData.title,
              price: Number(callData.price) || 0,
              subject: null,
              downloadUrl: callData.downloadUrl || null,
            };
          }
        }
      }
    }

    // ============================================
    // CALCULATE MULTI-SUBJECT DISCOUNT
    // ============================================
    let discountRules = { twoSubjects: 10, threeSubjects: 20 };
    try {
      const configDoc = await adminDb.collection('site_config').doc('global').get();
      if (configDoc.exists() && configDoc.data().discountRules) {
        discountRules = configDoc.data().discountRules;
      }
    } catch {}

    const distinctSubjects = new Set(validatedItems.filter((i) => i.subject).map((i) => i.subject));
    let discountPercent = 0;
    if (distinctSubjects.size >= 3) discountPercent = discountRules.threeSubjects || 20;
    else if (distinctSubjects.size >= 2) discountPercent = discountRules.twoSubjects || 10;

    // ============================================
    // APPLY PROMO CODE (optional, stacks after multi-subject)
    // ============================================
    let appliedPromo = null;
    if (promoCode) {
      const promoSnap = await adminDb.collection('promos')
        .where('code', '==', promoCode.toUpperCase())
        .limit(1)
        .get();

      if (!promoSnap.empty) {
        const promoDoc = promoSnap.docs[0];
        const promo = promoDoc.data();
        const isValid =
          promo.active !== false &&
          (!promo.expiresAt || (promo.expiresAt.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt)) > new Date()) &&
          (!promo.maxUses || (promo.usedCount || 0) < promo.maxUses) &&
          !promo.eventId && !promo.productId; // Cart promos must be global

        if (isValid) {
          appliedPromo = { id: promoDoc.id, code: promo.code, discountType: promo.discountType, discountValue: promo.discountValue };
        }
      }
    }

    // ============================================
    // BUILD LINE ITEMS WITH DISCOUNTS
    // ============================================
    const allItems = [...validatedItems];
    if (privateCallItem) allItems.push(privateCallItem);

    let totalAmount = 0;
    const lineItems = allItems.map((item) => {
      let itemPrice = item.price;

      // Apply multi-subject discount to non-bundle items (private call excluded)
      if (discountPercent > 0 && item !== privateCallItem) {
        itemPrice = Math.max(0, itemPrice - itemPrice * (discountPercent / 100));
      }

      // Apply promo on top
      if (appliedPromo) {
        if (appliedPromo.discountType === 'percentage') {
          itemPrice = Math.max(0, itemPrice - itemPrice * (appliedPromo.discountValue / 100));
        }
        // Fixed discount: split across items proportionally (apply to first item only for simplicity)
      }

      itemPrice = Math.round(itemPrice * 100) / 100;
      totalAmount += itemPrice;

      return {
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.title,
          },
          unit_amount: Math.round(itemPrice * 100),
        },
        quantity: 1,
      };
    });

    // Apply fixed promo discount as a separate negative line item (if applicable)
    if (appliedPromo && appliedPromo.discountType === 'fixed' && appliedPromo.discountValue > 0) {
      const fixedDiscount = Math.min(appliedPromo.discountValue, totalAmount);
      if (fixedDiscount > 0) {
        // Stripe doesn't support negative line items, so subtract from the most expensive item
        // For simplicity, we'll reduce the first item's price
        const firstLineAmount = lineItems[0].price_data.unit_amount;
        lineItems[0].price_data.unit_amount = Math.max(0, firstLineAmount - Math.round(fixedDiscount * 100));
        totalAmount -= fixedDiscount;
      }
    }

    // ============================================
    // BUILD METADATA (Stripe 500 char limit per value)
    // ============================================
    const cartItemsSummary = allItems.map((i) => `${i.type}:${i.id}`).join(',');

    // Detect category from items: check tags in Firestore docs
    let categoryFilter = '';
    try {
      for (const item of validatedItems) {
        const col = item.type === 'event' ? 'events' : 'products';
        const doc = await adminDb.collection(col).doc(item.id).get();
        if (doc.exists) {
          const tags = doc.data().tags || [];
          if (tags.includes('cohort:b1')) { categoryFilter = 'b1'; break; }
          if (tags.includes('cohort:b2')) { categoryFilter = 'b2'; break; }
        }
      }
    } catch {}

    const metadata = {
      orderType: 'cart',
      cartItems: cartItemsSummary.substring(0, 500),
      cartItemsJson: JSON.stringify(allItems.map((i) => ({
        id: i.id, type: i.type, title: i.title, price: i.price,
        ticketId: i.ticketId || null, ticketName: i.ticketName || null, downloadUrl: i.downloadUrl || null,
      }))).substring(0, 500),
      firstName: firstName.trim().substring(0, 500),
      lastName: lastName.trim().substring(0, 500),
      email: normalizedEmail,
      locale: locale === 'fr' ? 'fr' : 'en',
      discountPercent: String(discountPercent),
      ...(categoryFilter && { categoryFilter }),
      ...(campus && { campus: campus.substring(0, 500) }),
      ...(appliedPromo && { promoCode: appliedPromo.code, promoId: appliedPromo.id }),
    };

    // ============================================
    // FREE CART (all items free after discounts)
    // ============================================
    const finalTotal = lineItems.reduce((sum, li) => sum + li.price_data.unit_amount, 0);

    if (finalTotal === 0) {
      // Create all orders directly
      const now = new Date();
      for (const item of allItems) {
        if (item.type === 'product') {
          await adminDb.collection('product_orders').add({
            productId: item.id,
            productTitle: item.title,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            amountPaid: 0,
            paymentStatus: 'free',
            campus: campus || null,
            promoCode: appliedPromo?.code || null,
            orderSource: 'cart',
            createdAt: FieldValue.serverTimestamp(),
          });
        } else if (item.type === 'event') {
          await adminDb.collection('attendees').add({
            eventId: item.id,
            eventTitle: item.title,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: normalizedEmail,
            paymentStatus: 'free',
            amountPaid: 0,
            ticketId: item.ticketId || 'default',
            ticketName: item.ticketName || 'General Admission',
            campus: campus || null,
            promoCode: appliedPromo?.code || null,
            orderSource: 'cart',
            createdAt: now,
          });
          // Increment attendee count
          await adminDb.collection('events').doc(item.id).update({
            attendeeCount: FieldValue.increment(1),
          });
        }
      }

      if (appliedPromo?.id) {
        await adminDb.collection('promos').doc(appliedPromo.id).update({ usedCount: FieldValue.increment(1) });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.json({
        success: true,
        type: 'free',
        redirectUrl: `${appUrl}/success?cart=true&lang=${locale}`,
      });
    }

    // ============================================
    // PAID CART: CREATE STRIPE SESSION
    // ============================================
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata,
      customer_email: normalizedEmail,
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&cart=true&lang=${locale}`,
      cancel_url: `${appUrl}/classes?cancelled=true`,
      locale: locale === 'fr' ? 'fr' : 'en',
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[CHECKOUT/CART] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
