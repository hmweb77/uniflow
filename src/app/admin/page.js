// src/app/admin/page.js

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
    ticketsThisMonth: 0,
    upcomingEventsCount: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [ticketTypeData, setTicketTypeData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('28'); // days

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

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
      
      // Calculate total revenue from amountPaid field
      const totalRevenue = completedAttendees.reduce((sum, a) => sum + (a.amountPaid || 0), 0);

      // Calculate this month's stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfRange = new Date(now.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
      
      const attendeesInRange = completedAttendees.filter((a) => {
        const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        return createdAt >= startOfRange;
      });

      const attendeesThisMonth = completedAttendees.filter((a) => {
        const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        return createdAt >= startOfMonth;
      });

      const revenueThisMonth = attendeesThisMonth.reduce((sum, a) => sum + (a.amountPaid || 0), 0);
      const ticketsThisMonth = attendeesThisMonth.length;

      // Upcoming events (date > now)
      const upcoming = events
        .filter((event) => {
          const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
          return eventDate > now && event.status !== 'cancelled';
        })
        .sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateA - dateB;
        })
        .slice(0, 5);

      setUpcomingEvents(upcoming);

      setStats({
        totalEvents: events.length,
        totalAttendees: completedAttendees.length,
        totalRevenue,
        revenueThisMonth,
        ticketsThisMonth,
        upcomingEventsCount: upcoming.length,
      });

      setRecentEvents(events.slice(0, 5));

      // Recent orders (last 10)
      const recentOrdersList = completedAttendees
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        })
        .slice(0, 10)
        .map((attendee) => {
          const event = events.find((e) => e.id === attendee.eventId);
          return { ...attendee, eventTitle: event?.title || 'Unknown Event' };
        });

      setRecentOrders(recentOrdersList);

      // Prepare chart data (sales per event)
      const chartData = events.slice(0, 7).map((event) => {
        const eventAttendees = completedAttendees.filter((a) => a.eventId === event.id);
        const eventRevenue = eventAttendees.reduce((sum, a) => sum + (a.amountPaid || 0), 0);
        return {
          name: event.title?.substring(0, 15) + (event.title?.length > 15 ? '...' : ''),
          tickets: eventAttendees.length,
          revenue: eventRevenue,
        };
      });
      setChartData(chartData.reverse());

      // Ticket type distribution
      const ticketTypes = {};
      completedAttendees.forEach((a) => {
        const type = a.ticketName || 'General Admission';
        ticketTypes[type] = (ticketTypes[type] || 0) + 1;
      });
      const ticketTypeChartData = Object.entries(ticketTypes).map(([name, value]) => ({
        name,
        value,
      }));
      setTicketTypeData(ticketTypeChartData);

      // Monthly revenue data (last 6 months)
      const monthlyStats = {};
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = month.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        monthlyStats[monthKey] = { revenue: 0, tickets: 0 };
      }

      completedAttendees.forEach((a) => {
        const createdAt = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const monthKey = createdAt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        if (monthlyStats[monthKey]) {
          monthlyStats[monthKey].revenue += a.amountPaid || 0;
          monthlyStats[monthKey].tickets += 1;
        }
      });

      const monthlyChartData = Object.entries(monthlyStats).map(([name, data]) => ({
        name,
        revenue: data.revenue,
        tickets: data.tickets,
      }));
      setMonthlyData(monthlyChartData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer for next event
  const NextEventCountdown = ({ event }) => {
    const [countdown, setCountdown] = useState('');

    useEffect(() => {
      const calculateCountdown = () => {
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        const now = new Date();
        const diff = eventDate - now;

        if (diff <= 0) {
          setCountdown('Starting now!');
          return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
          setCountdown(`${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setCountdown(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setCountdown(`${minutes}m ${seconds}s`);
        }
      };

      calculateCountdown();
      const interval = setInterval(calculateCountdown, 1000);
      return () => clearInterval(interval);
    }, [event]);

    return <span className="font-mono text-indigo-600 font-semibold">{countdown}</span>;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (timestamp) => {
    if (!timestamp) return 'No date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return formatShortDate(timestamp);
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
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          >
            <option value="7">Last 7 Days</option>
            <option value="28">Last 28 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>
          <Link
            href="/admin/events/new"
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + Create Event
          </Link>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Next Event Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-indigo-200 text-sm font-medium">Next Event</span>
            <span className="text-2xl">📅</span>
          </div>
          {upcomingEvents.length > 0 ? (
            <>
              <p className="font-semibold text-lg mb-1 line-clamp-1">{upcomingEvents[0].title}</p>
              <NextEventCountdown event={upcomingEvents[0]} />
              <p className="text-indigo-200 text-xs mt-2">
                {formatShortDate(upcomingEvents[0].date)}
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-lg mb-1">No Event Upcoming</p>
              <p className="text-indigo-200 text-sm">Why not host one?</p>
            </>
          )}
        </div>

        {/* Orders Complete */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500 text-sm font-medium">Orders Complete</span>
            <span className="text-2xl">🎫</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.ticketsThisMonth}</p>
          <p className={`text-sm mt-1 ${stats.ticketsThisMonth > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {stats.ticketsThisMonth > 0 ? '↑' : '↓'} This month
          </p>
        </div>

        {/* Tickets Sold */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500 text-sm font-medium">Total Tickets Sold</span>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalAttendees}</p>
          <p className="text-sm text-gray-500 mt-1">All time</p>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-500 text-sm font-medium">Revenue This Month</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">€{stats.revenueThisMonth.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">
            Total: €{stats.totalRevenue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Events with Countdown */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
            <Link href="/admin/events" className="text-sm text-indigo-600 hover:underline">
              View All →
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg overflow-hidden flex-shrink-0">
                    {event.bannerUrl ? (
                      <img src={event.bannerUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">🎓</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{formatShortDate(event.date)}</span>
                      <span className="text-gray-300">•</span>
                      <NextEventCountdown event={event} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <p>No upcoming events</p>
              <Link href="/admin/events/new" className="text-indigo-600 hover:underline text-sm mt-2 inline-block">
                + Create Event
              </Link>
            </div>
          )}
        </div>

        {/* Latest Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Latest Orders</h2>
            <Link href="/admin/orders" className="text-sm text-indigo-600 hover:underline">
              View All →
            </Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name / Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tickets
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {order.name} {order.surname}
                        </p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {order.eventTitle}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                          1x {order.ticketName || 'General'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        €{order.amountPaid?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {getTimeAgo(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-2">🎫</div>
              <p>No orders yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
          {monthlyData.length > 0 && monthlyData.some((d) => d.revenue > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(v) => `€${v.toFixed(2)}`} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No revenue data yet
            </div>
          )}
        </div>

        {/* Tickets per Event */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tickets per Event</h2>
          {chartData.length > 0 && chartData.some((d) => d.tickets > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="tickets" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No ticket data yet
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Type Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Types</h2>
          {ticketTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={ticketTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {ticketTypeData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">
              No ticket data
            </div>
          )}
          {ticketTypeData.length > 0 && (
            <div className="mt-4 space-y-2">
              {ticketTypeData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600 truncate max-w-[150px]">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Events */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Events</h2>
            <Link href="/admin/events" className="text-sm text-indigo-600 hover:underline">
              Manage →
            </Link>
          </div>
          {recentEvents.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {recentEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/events/${event.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                      {event.bannerUrl ? (
                        <img src={event.bannerUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          🎓
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{event.title}</p>
                      <p className="text-sm text-gray-500">{formatShortDate(event.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {event.tickets?.length || 1} ticket{(event.tickets?.length || 1) > 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-500">From €{event.price || 0}</p>
                  </div>
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

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/events/new"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">➕</span>
            <span className="font-medium text-gray-700">Create Event</span>
          </Link>
          <Link
            href="/admin/orders"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">🎫</span>
            <span className="font-medium text-gray-700">View Orders</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">👥</span>
            <span className="font-medium text-gray-700">Customers</span>
          </Link>
          <Link
            href="/admin/events"
            className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">📊</span>
            <span className="font-medium text-gray-700">All Events</span>
          </Link>
        </div>
      </div>
    </div>
  );
}