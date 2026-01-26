// src/app/api/stats/route.js

import { NextResponse } from 'next/server';
import { adminDb } from '../../lib/firebase-admin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '28');

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch all events
    const eventsSnap = await adminDb.collection('events').get();
    const events = eventsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch all completed attendees
    const attendeesSnap = await adminDb
      .collection('attendees')
      .where('paymentStatus', '==', 'completed')
      .get();
    const attendees = attendeesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Calculate stats
    const totalRevenue = attendees.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

    // This month stats
    const attendeesThisMonth = attendees.filter((a) => {
      const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      return createdAt >= startOfMonth;
    });

    const revenueThisMonth = attendeesThisMonth.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

    // In range stats
    const attendeesInRange = attendees.filter((a) => {
      const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      return createdAt >= startDate;
    });

    const revenueInRange = attendeesInRange.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

    // Upcoming events
    const upcomingEvents = events.filter((event) => {
      const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
      return eventDate > now && event.status !== 'cancelled';
    });

    // Revenue per event
    const revenuePerEvent = events.map((event) => {
      const eventAttendees = attendees.filter((a) => a.eventId === event.id);
      const revenue = eventAttendees.reduce((sum, a) => sum + (a.amountPaid || 0), 0);
      return {
        eventId: event.id,
        eventTitle: event.title,
        ticketsSold: eventAttendees.length,
        revenue,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Top performing events
    const topEvents = revenuePerEvent.slice(0, 5);

    // Monthly breakdown
    const monthlyBreakdown = {};
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyBreakdown[monthKey] = { revenue: 0, tickets: 0 };
    }

    attendees.forEach((a) => {
      const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const monthKey = createdAt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (monthlyBreakdown[monthKey]) {
        monthlyBreakdown[monthKey].revenue += a.amountPaid || 0;
        monthlyBreakdown[monthKey].tickets += 1;
      }
    });

    return NextResponse.json({
      totalEvents: events.length,
      totalAttendees: attendees.length,
      totalRevenue,
      revenueThisMonth,
      ticketsThisMonth: attendeesThisMonth.length,
      revenueInRange,
      ticketsInRange: attendeesInRange.length,
      upcomingEventsCount: upcomingEvents.length,
      topEvents,
      monthlyBreakdown: Object.entries(monthlyBreakdown).map(([name, data]) => ({
        name,
        ...data,
      })),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}