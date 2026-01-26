// src/app/api/calendar/redirect/[eventId]/route.js

import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';

// Format date for Google Calendar URL (YYYYMMDDTHHMMSSZ)
function formatDateForGoogle(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Format date for Outlook (ISO format)
function formatDateForOutlook(date) {
  return date.toISOString();
}

export async function GET(request, { params }) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') || 'google';

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event from Firestore
    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = eventDoc.data();

    // Parse event date
    let eventDate;
    if (event.date && typeof event.date.toDate === 'function') {
      eventDate = event.date.toDate();
    } else if (event.date && event.date._seconds) {
      eventDate = new Date(event.date._seconds * 1000);
    } else {
      eventDate = new Date(event.date);
    }

    // Set end date (default: 1.5 hours after start)
    const endDate = new Date(eventDate);
    endDate.setMinutes(endDate.getMinutes() + 90);

    // Build description
    let description = event.description || '';
    if (event.meetingLink) {
      description += '\n\nJoin the class: ' + event.meetingLink;
    }
    if (event.organizer) {
      description += '\n\nInstructor: ' + event.organizer;
    }

    const location = event.meetingLink || 'Online';

    let redirectUrl;

    switch (provider) {
      case 'google': {
        const params = new URLSearchParams({
          action: 'TEMPLATE',
          text: event.title,
          dates: `${formatDateForGoogle(eventDate)}/${formatDateForGoogle(endDate)}`,
          details: description,
          location: location,
        });
        redirectUrl = `https://calendar.google.com/calendar/render?${params.toString()}`;
        break;
      }

      case 'outlook': {
        const params = new URLSearchParams({
          subject: event.title,
          body: description,
          location: location,
          startdt: formatDateForOutlook(eventDate),
          enddt: formatDateForOutlook(endDate),
          path: '/calendar/action/compose',
          rru: 'addevent',
        });
        redirectUrl = `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
        break;
      }

      case 'yahoo': {
        // Yahoo uses a different format
        const formatYahooDate = (date) => {
          return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
        };
        
        const durationMs = endDate - eventDate;
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        const duration = `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;

        const params = new URLSearchParams({
          v: '60',
          title: event.title,
          st: formatYahooDate(eventDate),
          dur: duration,
          desc: description,
          in_loc: location,
        });
        redirectUrl = `https://calendar.yahoo.com/?${params.toString()}`;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Redirect to the calendar URL
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error generating calendar redirect:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar link' },
      { status: 500 }
    );
  }
}