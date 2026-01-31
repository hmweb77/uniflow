// src/app/api/debug/webhook-test/route.js
// DEBUG: Test webhook configuration and email sending

import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';
import { sendEmail, getConfirmationEmailTemplate, addContactToBrevo } from '../../../lib/brevo';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  const config = {
    timestamp: new Date().toISOString(),
    environment: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✅ Set (hidden)' : '❌ Missing',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set (hidden)' : '❌ Missing',
      BREVO_API_KEY: process.env.BREVO_API_KEY ? '✅ Set (hidden)' : '❌ Missing',
      EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME || '⚠️ Default: Uniflow',
      EMAIL_SENDER_ADDRESS: process.env.EMAIL_SENDER_ADDRESS || '⚠️ Default: noreply@uniflow.com',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '❌ Missing',
      FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID ? '✅ Set' : '⚠️ Using service account',
    },
  };

  // Test Firebase connection
  try {
    const testQuery = await adminDb.collection('events').limit(1).get();
    config.firebase = {
      status: '✅ Connected',
      eventsCount: testQuery.size,
    };
    
    // Count attendees
    const attendeesQuery = await adminDb.collection('attendees').limit(100).get();
    config.firebase.attendeesCount = attendeesQuery.size;
    
    // Count users
    try {
      const usersQuery = await adminDb.collection('users').limit(100).get();
      config.firebase.usersCount = usersQuery.size;
    } catch {
      config.firebase.usersCount = '⚠️ Collection may not exist yet';
    }
  } catch (err) {
    config.firebase = {
      status: '❌ Error',
      error: err.message,
    };
  }

  // Test email if action=test-email&email=xxx
  if (action === 'test-email') {
    const testEmail = searchParams.get('email');
    
    if (!testEmail) {
      return NextResponse.json({
        ...config,
        emailTest: {
          status: '⚠️ Provide email parameter',
          example: '/api/debug/webhook-test?action=test-email&email=your@email.com'
        }
      });
    }

    if (!process.env.BREVO_API_KEY) {
      return NextResponse.json({
        ...config,
        emailTest: {
          status: '❌ Cannot test - BREVO_API_KEY not configured',
        }
      });
    }

    try {
      const template = getConfirmationEmailTemplate({
        customerName: 'Test User',
        eventId: 'test-123',
        eventTitle: 'Test Event - Debug',
        eventDate: 'Saturday, February 1, 2025',
        eventTime: '10:00',
        meetingLink: 'https://zoom.us/j/123456789',
        ticketName: 'Test Ticket',
        locale: 'en',
      });

      const result = await sendEmail({
        to: testEmail,
        subject: '[TEST] ' + template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
      });

      config.emailTest = {
        status: '✅ Email sent',
        to: testEmail,
        result,
      };
    } catch (err) {
      config.emailTest = {
        status: '❌ Email failed',
        error: err.message,
        details: err.toString(),
      };
    }
  }

  // List recent attendees if action=list-attendees
  if (action === 'list-attendees') {
    try {
      const attendeesQuery = await adminDb
        .collection('attendees')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      
      config.recentAttendees = attendeesQuery.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email,
        eventTitle: doc.data().eventTitle || doc.data().eventId,
        amountPaid: doc.data().amountPaid,
        paymentStatus: doc.data().paymentStatus,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    } catch (err) {
      config.recentAttendees = { error: err.message };
    }
  }

  // List users if action=list-users  
  if (action === 'list-users') {
    try {
      const usersQuery = await adminDb
        .collection('users')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      
      config.recentUsers = usersQuery.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email,
        name: doc.data().name,
        totalSpent: doc.data().totalSpent,
        purchaseCount: doc.data().purchaseCount,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      }));
    } catch (err) {
      config.recentUsers = { error: err.message };
    }
  }

  return NextResponse.json(config, {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST: Simulate a webhook for testing
export async function POST(request) {
  try {
    const body = await request.json();
    const { eventId, customerEmail, customerName, customerSurname, amount } = body;

    if (!eventId || !customerEmail) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        required: ['eventId', 'customerEmail'],
        optional: ['customerName', 'customerSurname', 'amount']
      }, { status: 400 });
    }

    // Get event
    const eventDoc = await adminDb.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const eventData = eventDoc.data();

    const normalizedEmail = customerEmail.toLowerCase().trim();
    const now = new Date();
    const testSessionId = `test_${Date.now()}`;

    // Create attendee
    const attendeeData = {
      eventId,
      eventTitle: eventData.title,
      name: customerName || 'Test',
      surname: customerSurname || 'User',
      email: normalizedEmail,
      paymentStatus: 'completed',
      stripeSessionId: testSessionId,
      stripePaymentIntent: `pi_test_${Date.now()}`,
      amountPaid: amount || eventData.price || 10,
      currency: 'eur',
      ticketId: 'test',
      ticketName: 'Test Ticket',
      ticketIncludes: [],
      createdAt: now,
      processedAt: now,
      isTest: true,
    };

    const attendeeRef = await adminDb.collection('attendees').add(attendeeData);

    // Create/update user
    const existingUserQuery = await adminDb
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    let userId;
    if (existingUserQuery.empty) {
      const userRef = await adminDb.collection('users').add({
        email: normalizedEmail,
        name: customerName || 'Test',
        surname: customerSurname || 'User',
        createdAt: now,
        updatedAt: now,
        totalSpent: attendeeData.amountPaid,
        purchaseCount: 1,
        events: [eventId],
        lastPurchase: now,
      });
      userId = userRef.id;
    } else {
      const userDoc = existingUserQuery.docs[0];
      userId = userDoc.id;
      const existing = userDoc.data();
      const events = existing.events || [];
      if (!events.includes(eventId)) events.push(eventId);
      
      await userDoc.ref.update({
        updatedAt: now,
        totalSpent: (existing.totalSpent || 0) + attendeeData.amountPaid,
        purchaseCount: (existing.purchaseCount || 0) + 1,
        events,
        lastPurchase: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Test order created',
      attendeeId: attendeeRef.id,
      userId,
      data: attendeeData,
    });

  } catch (err) {
    console.error('Debug POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}