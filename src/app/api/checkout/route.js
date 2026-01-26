// src/app/api/checkout/route.js

import { NextResponse } from 'next/server';
import { createCheckoutSession } from '../../lib/stripe';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      eventId,
      eventTitle,
      price,
      customerName,
      customerSurname,
      customerEmail,
      locale = 'en',
    } = body;

    // Validate required fields
    if (!eventId || !eventTitle || !price || !customerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await createCheckoutSession({
      eventId,
      eventTitle,
      price,
      customerEmail,
      customerName,
      customerSurname,
      successUrl: `${appUrl}/success?lang=${locale}`,
      cancelUrl: `${appUrl}/e/${eventId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}