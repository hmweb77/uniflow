// src/app/api/checkout/route.js
// SECURITY: Price is verified from database, NOT from client request

import { NextResponse } from 'next/server';
import { adminDb } from '../../lib/firebase-admin';

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
    // GET SERVER-SIDE PRICE FROM TICKET
    // ============================================
    
    let price;
    let resolvedTicketId = ticketId || 'default';
    let resolvedTicketName = 'General Admission';
    
    if (eventData.tickets && eventData.tickets.length > 0) {
      // Find the specific ticket
      const ticket = ticketId 
        ? eventData.tickets.find(t => t.id === ticketId)
        : eventData.tickets[0]; // Default to first ticket
      
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

    // Validate price
    if (typeof price !== 'number' || price <= 0 || !isFinite(price)) {
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
    // CREATE STRIPE CHECKOUT SESSION
    // ============================================
    
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    
    if (!appUrl) {
      console.error('NEXT_PUBLIC_APP_URL is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Sanitize inputs for metadata
    const sanitize = (str) => str ? String(str).slice(0, 200).replace(/[<>]/g, '') : '';

    // Build product name
    const productName = resolvedTicketName !== 'General Admission'
      ? `${eventData.title} - ${resolvedTicketName}`
      : eventData.title;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: customerEmail.toLowerCase().trim(),
      
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
              description: `Registration for ${eventData.title}`,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      
      // Metadata for webhook processing
      metadata: {
        eventId,
        ticketId: resolvedTicketId,
        ticketName: resolvedTicketName,
        customerName: sanitize(customerName) || '',
        customerSurname: sanitize(customerSurname) || '',
        customerEmail: customerEmail.toLowerCase().trim(),
      },
      
      success_url: `${appUrl}/success?lang=${locale}&event=${eventId}`,
      cancel_url: `${appUrl}/e/${eventData.slug || eventId}`,
      
      locale: locale === 'fr' ? 'fr' : 'auto',
      
      // Payment intent metadata for reconciliation
      payment_intent_data: {
        metadata: {
          eventId,
          ticketId: resolvedTicketId,
          ticketName: resolvedTicketName,
          customerEmail: customerEmail.toLowerCase().trim(),
        },
      },
      
      // Session expires in 30 minutes
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });

    return NextResponse.json({ url: session.url });
    
  } catch (error) {
    console.error('Checkout error:', error);
    
    // Don't expose internal errors
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