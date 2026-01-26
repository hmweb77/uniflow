// src/app/api/calendar/redirect/[eventId]/route.js

import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';
import {
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  getYahooCalendarUrl,
} from '../../../../lib/calendar';

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
    if (event.date?.toDate) {
      eventDate = event.date.toDate();
    } else if (event.date?._seconds) {
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
      description += `\n\nJoin the class: ${event.meetingLink}`;
    }
    if (event.organizer) {
      description += `\n\nInstructor: ${event.organizer}`;
    }

    // Calendar event data
    const calendarData = {
      title: event.title,
      description,
      location: event.meetingLink || 'Online',
      startDate: eventDate,
      endDate,
    };

    // Generate URL based on provider
    let redirectUrl;
    switch (provider) {
      case 'google':
        redirectUrl = getGoogleCalendarUrl(calendarData);
        break;
      case 'outlook':
        redirectUrl = getOutlookCalendarUrl(calendarData);
        break;
      case 'yahoo':
        redirectUrl = getYahooCalendarUrl(calendarData);
        break;
      default:
        redirectUrl = getGoogleCalendarUrl(calendarData);
    }

    // Redirect to calendar provider
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error generating calendar redirect:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar link' },
      { status: 500 }
    );
  }
}