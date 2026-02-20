// src/app/api/checkout/product/route.js
// Checkout for digital products (paid via Stripe or free) – promo + campus like events

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '../../../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export async function POST(request) {
  try {
    const body = await request.json();
    const { productId, firstName, lastName, email, locale = 'en', promoCode, campus } = body;

    if (!productId || !email || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const productDoc = await adminDb.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = { id: productDoc.id, ...productDoc.data() };
    if (product.status !== 'published') {
      return NextResponse.json({ error: 'This product is not available' }, { status: 400 });
    }

    const unitPrice = Number(product.price) || 0;
    const normalizedEmail = email.toLowerCase().trim();

    // Apply promo (same logic as event checkout)
    let discountAmount = 0;
    let appliedPromo = null;

    if (promoCode) {
      const promosRef = adminDb.collection('promos');
      const promoSnap = await promosRef.where('code', '==', promoCode.toUpperCase()).limit(1).get();

      if (!promoSnap.empty) {
        const promoDoc = promoSnap.docs[0];
        const promo = promoDoc.data();

        const isValid =
          promo.active !== false &&
          (!promo.expiresAt || (promo.expiresAt.toDate ? promo.expiresAt.toDate() : new Date(promo.expiresAt)) > new Date()) &&
          (!promo.maxUses || (promo.usedCount || 0) < promo.maxUses) &&
          !promo.eventId &&
          (!promo.productId || promo.productId === productId);

        if (isValid) {
          if (promo.discountType === 'percentage') {
            discountAmount = Math.round(unitPrice * (promo.discountValue / 100) * 100) / 100;
          } else {
            discountAmount = Math.min(promo.discountValue, unitPrice);
          }
          appliedPromo = { id: promoDoc.id, code: promo.code, discountAmount };
        }
      }
    }

    const finalPrice = Math.max(0, unitPrice - discountAmount);

    // Free product (including 100% promo): create order and send email
    if (finalPrice === 0) {
      const orderData = {
        productId: product.id,
        productTitle: product.title,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        amountPaid: 0,
        paymentStatus: unitPrice === 0 ? 'free' : 'promo_free',
        promoCode: appliedPromo?.code || null,
        campus: campus || null,
        createdAt: FieldValue.serverTimestamp(),
      };

      await adminDb.collection('product_orders').add(orderData);

      if (appliedPromo?.id) {
        await adminDb.collection('promos').doc(appliedPromo.id).update({ usedCount: FieldValue.increment(1) });
      }

      if (process.env.BREVO_API_KEY) {
        try {
          const { sendEmail, getProductConfirmationEmailTemplate } = await import('../../../lib/brevo');
          const { subject, htmlContent, textContent } = getProductConfirmationEmailTemplate({
            customerName: firstName.trim(),
            productTitle: product.title,
            downloadUrl: product.downloadUrl || null,
            locale,
          });
          await sendEmail({ to: email, subject, htmlContent, textContent });
        } catch (emailErr) {
          console.error('[CHECKOUT/PRODUCT] Email send failed (non-blocking):', emailErr.message);
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      return NextResponse.json({
        success: true,
        type: 'free',
        redirectUrl: `${appUrl}/success?product=${productId}&lang=${locale}`,
      });
    }

    // Paid product: create Stripe checkout session with discounted amount
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const metadata = {
      orderType: 'product',
      productId: product.id,
      productTitle: (product.title || '').substring(0, 500),
      firstName: firstName.trim().substring(0, 500),
      lastName: lastName.trim().substring(0, 500),
      email: normalizedEmail,
      locale: locale === 'fr' ? 'fr' : 'en',
      promoCode: appliedPromo?.code || '',
      campus: (campus || '').substring(0, 500),
    };
    if (appliedPromo?.id) metadata.promoId = appliedPromo.id;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.title,
              description: (product.description || '').substring(0, 500) || undefined,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        },
      ],
      metadata,
      customer_email: email,
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&product=${productId}&lang=${locale}`,
      cancel_url: `${appUrl}/p/${product.slug || productId}?cancelled=true`,
      locale: locale === 'fr' ? 'fr' : 'en',
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[CHECKOUT/PRODUCT] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
