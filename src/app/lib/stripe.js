// src/app/lib/stripe.js

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export async function createCheckoutSession({
  eventId,
  eventTitle,
  price,
  ticketId,
  ticketName,
  customerEmail,
  customerName,
  customerSurname,
  successUrl,
  cancelUrl,
  locale = 'en',
}) {
  const productName = ticketName && ticketName !== 'General Admission'
    ? `${eventTitle} - ${ticketName}`
    : eventTitle;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: productName,
            description: `Registration for ${eventTitle}`,
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      eventId,
      ticketId: ticketId || 'default',
      ticketName: ticketName || 'General Admission',
      customerName: customerName || '',
      customerSurname: customerSurname || '',
      customerEmail,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: locale === 'fr' ? 'fr' : 'auto',
    payment_intent_data: {
      metadata: {
        eventId,
        ticketId: ticketId || 'default',
        ticketName: ticketName || 'General Admission',
        customerName: customerName || '',
        customerSurname: customerSurname || '',
        customerEmail,
      },
    },
    payment_method_options: {
      card: {
        setup_future_usage: undefined,
      },
    },
  });

  return session;
}