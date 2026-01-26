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
      ticketId,
      ticketName,
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

    // Validate price is positive
    if (price <= 0) {
      return NextResponse.json(
        { error: 'Invalid price' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    const session = await createCheckoutSession({
      eventId,
      eventTitle,
      price,
      ticketId: ticketId || 'default',
      ticketName: ticketName || 'General Admission',
      customerEmail,
      customerName,
      customerSurname,
      // Include eventId in success URL for calendar feature
      successUrl: `${appUrl}/success?lang=${locale}&event=${eventId}`,
      cancelUrl: `${appUrl}/e/${eventId}`,
      locale,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}