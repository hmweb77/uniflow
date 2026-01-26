// src/app/api/calendar/[eventId]/route.js

import { NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebase-admin';

// Format date to ICS format: YYYYMMDDTHHMMSSZ
function formatDateToICS(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Escape special characters for ICS
function escapeICS(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Generate ICS file content
function generateICS(eventData) {
  const { title, description, location, startDate, endDate, organizer, url } = eventData;
  
  // Generate unique ID for the event
  const uid = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 11) + '@uniflow.com';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Uniflow//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + formatDateToICS(new Date()),
    'DTSTART:' + formatDateToICS(startDate),
    'DTEND:' + formatDateToICS(endDate),
    'SUMMARY:' + escapeICS(title),
  ];

  if (description) {
    lines.push('DESCRIPTION:' + escapeICS(description));
  }
  
  if (location) {
    lines.push('LOCATION:' + escapeICS(location));
  }
  
  if (url) {
    lines.push('URL:' + escapeICS(url));
  }
  
  if (organizer) {
    lines.push('ORGANIZER;CN=' + escapeICS(organizer) + ':mailto:noreply@uniflow.com');
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('SEQUENCE:0');
  
  // Add reminder 1 hour before
  lines.push('BEGIN:VALARM');
  lines.push('TRIGGER:-PT1H');
  lines.push('ACTION:DISPLAY');
  lines.push('DESCRIPTION:Event starting in 1 hour');
  lines.push('END:VALARM');
  
  // Add reminder 24 hours before
  lines.push('BEGIN:VALARM');
  lines.push('TRIGGER:-PT24H');
  lines.push('ACTION:DISPLAY');
  lines.push('DESCRIPTION:Event starting tomorrow');
  lines.push('END:VALARM');
  
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
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

    // Generate description with meeting link
    let description = event.description || '';
    if (event.meetingLink) {
      description += '\n\nJoin the class: ' + event.meetingLink;
    }
    if (event.organizer) {
      description += '\n\nInstructor: ' + event.organizer;
    }

    // Generate ICS content
    const icsContent = generateICS({
      title: event.title,
      description: description,
      location: event.meetingLink || 'Online',
      startDate: eventDate,
      endDate: endDate,
      organizer: event.organizer,
      url: event.meetingLink,
    });

    // Create filename
    const safeTitle = event.title
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50)
      .toLowerCase();
    const filename = safeTitle + '.ics';

    // Return ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
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