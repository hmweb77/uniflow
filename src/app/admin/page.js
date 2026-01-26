// src/app/admin/page.js

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    totalRevenue: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch events
      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(query(eventsRef, orderBy('createdAt', 'desc')));
      const events = eventsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Fetch attendees
      const attendeesRef = collection(db, 'attendees');
      const attendeesSnap = await getDocs(attendeesRef);
      const attendees = attendeesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate stats
      const completedAttendees = attendees.filter((a) => a.paymentStatus === 'completed');
      const totalRevenue = events.reduce((sum, event) => {
        const eventAttendees = completedAttendees.filter((a) => a.eventId === event.id);
        return sum + eventAttendees.length * (event.price || 0);
      }, 0);

      setStats({
        totalEvents: events.length,
        totalAttendees: completedAttendees.length,
        totalRevenue,
      });

      setRecentEvents(events.slice(0, 5));

      // Prepare chart data (sales per event)
      const chartData = events.slice(0, 7).map((event) => {
        const eventAttendees = completedAttendees.filter((a) => a.eventId === event.id);
        return {
          name: event.title?.substring(0, 15) + (event.title?.length > 15 ? '...' : ''),
          tickets: eventAttendees.length,
          revenue: eventAttendees.length * (event.price || 0),
        };
      });
      setChartData(chartData.reverse());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your events and sales</p>
        </div>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Create Event
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🎓</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Tickets Sold</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAttendees}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalRevenue.toFixed(2)} €</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets per Event */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tickets per Event</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="tickets" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data yet
            </div>
          )}
        </div>

        {/* Revenue per Event */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue per Event (€)</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
        </div>
        {recentEvents.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {recentEvents.map((event) => (
              <Link
                key={event.id}
                href={`/admin/events/${event.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                    {event.bannerUrl ? (
                      <img
                        src={event.bannerUrl}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        🎓
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-500">{event.price} €</p>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <p>No events yet. Create your first event!</p>
            <Link
              href="/admin/events/new"
              className="inline-block mt-4 text-indigo-600 hover:underline"
            >
              Create Event →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}