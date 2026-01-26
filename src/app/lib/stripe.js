// src/lib/stripe.js

import Stripe from 'stripe';

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Helper to create checkout session
export async function createCheckoutSession({
  eventId,
  eventTitle,
  price,
  customerEmail,
  customerName,
  customerSurname,
  successUrl,
  cancelUrl,
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: eventTitle,
            description: `Registration for ${eventTitle}`,
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      eventId,
      customerName,
      customerSurname,
      customerEmail,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: 'auto', // Auto-detect language
    payment_intent_data: {
      metadata: {
        eventId,
        customerName,
        customerSurname,
        customerEmail,
      },
    },
  });

  return session;
}