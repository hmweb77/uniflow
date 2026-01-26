// src/app/api/calendar/[eventId]/route.js

import { NextResponse } from 'next/server';
import { adminDb } from '../../../lib/firebase-admin';

// Generate ICS file content
function generateICS({ title, description, location, startDate, endDate, organizer, url }) {
  // Format date to ICS format: YYYYMMDDTHHMMSSZ
  const formatDateToICS = (date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  // Escape special characters for ICS
  const escapeICS = (text) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  // Generate unique ID for the event
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@uniflow.com`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uniflow//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateToICS(new Date())}`,
    `DTSTART:${formatDateToICS(startDate)}`,
    `DTEND:${formatDateToICS(endDate)}`,
    `SUMMARY:${escapeICS(title)}`,
    description ? `DESCRIPTION:${escapeICS(description)}` : '',
    location ? `LOCATION:${escapeICS(location)}` : '',
    url ? `URL:${escapeICS(url)}` : '',
    organizer ? `ORGANIZER;CN=${escapeICS(organizer)}:mailto:noreply@uniflow.com` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    // Add reminder 1 hour before
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Event starting in 1 hour',
    'END:VALARM',
    // Add reminder 24 hours before
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Event starting tomorrow',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return icsContent;
}

export async function GET(request, { params }) {
  try {
    const { eventId } = await params;

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

    // Generate description with meeting link
    let description = event.description || '';
    if (event.meetingLink) {
      description += `\n\n🔗 Join the class: ${event.meetingLink}`;
    }
    if (event.organizer) {
      description += `\n\n👤 Instructor: ${event.organizer}`;
    }

    // Generate ICS content
    const icsContent = generateICS({
      title: event.title,
      description,
      location: event.meetingLink || 'Online',
      startDate: eventDate,
      endDate,
      organizer: event.organizer,
      url: event.meetingLink,
    });

    // Create filename
    const safeTitle = event.title
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50)
      .toLowerCase();
    const filename = `${safeTitle}.ics`;

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error generating calendar file:', error);
    return NextResponse.json(
      { error: 'Failed to generate calendar file' },
      { status: 500 }
    );
  }
}