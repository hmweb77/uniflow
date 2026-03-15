// src/app/admin/page.js
// Admin dashboard with combined attendees + product_orders data, tabs, and advanced KPIs

'use client';

import { useEffect, useState, useMemo } from 'react';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

const SUBJECT_COLORS = {
  stats: '#6366f1',
  accounting: '#f59e0b',
  psychology: '#ec4899',
  law: '#10b981',
  'computer-skills': '#3b82f6',
};

const SUBJECT_LABELS = {
  stats: 'Statistics',
  accounting: 'Accounting',
  psychology: 'Psychology',
  law: 'Law',
  'computer-skills': 'Computer Skills',
};

function NextEventCountdown({ event }) {
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

  return <span className="font-mono text-white font-semibold">{countdown}</span>;
}

function StatCard({ label, value, subtitle, icon, gradient }) {
  if (gradient) {
    return (
      <div className={`bg-gradient-to-br ${gradient} rounded-xl p-6 text-white`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-white/70 text-sm font-medium">{label}</span>
          <span className="text-2xl">{icon}</span>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        {subtitle && <p className="text-white/70 text-sm mt-1">{subtitle}</p>}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-500 text-sm font-medium">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [allOrders, setAllOrders] = useState([]); // combined attendees + product_orders
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState({});
  const [users, setUsers] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('28');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch events
      const eventsSnap = await getDocs(query(collection(db, 'events'), orderBy('createdAt', 'desc')));
      const eventsData = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEvents(eventsData);

      // Fetch products
      const productsSnap = await getDocs(collection(db, 'products'));
      const productsMap = {};
      productsSnap.docs.forEach((doc) => {
        productsMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setProducts(productsMap);

      // Fetch attendees (event orders)
      const attendeesSnap = await getDocs(collection(db, 'attendees'));
      const eventOrders = attendeesSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((a) => ['completed', 'paid', 'free', 'promo_free'].includes(a.paymentStatus))
        .map((order) => {
          const event = eventsData.find((e) => e.id === order.eventId);
          return {
            ...order,
            orderType: 'event',
            itemTitle: event?.title || order.eventTitle || 'Unknown Event',
            subject: event?.subject || '',
            tags: event?.tags || [],
          };
        });

      // Fetch product orders
      const productOrdersSnap = await getDocs(collection(db, 'product_orders'));
      const productOrders = productOrdersSnap.docs.map((doc) => {
        const data = doc.data();
        const product = productsMap[data.productId] || {};
        return {
          id: doc.id,
          ...data,
          orderType: 'product',
          itemTitle: data.productTitle || product.title || 'Unknown Product',
          subject: product.subject || '',
          tags: product.tags || [],
          productType: product.type || 'product',
        };
      });

      // Combined orders
      const combined = [...eventOrders, ...productOrders].sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      setAllOrders(combined);

      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      setUsers(usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));

      // Upcoming events
      const now = new Date();
      const upcoming = eventsData
        .filter((e) => {
          const d = e.date?.toDate ? e.date.toDate() : new Date(e.date);
          return d > now && e.status !== 'cancelled' && !e.archived;
        })
        .sort((a, b) => {
          const dA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dA - dB;
        })
        .slice(0, 5);
      setUpcomingEvents(upcoming);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Derived stats
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeMs = parseInt(timeRange) * 24 * 60 * 60 * 1000;
    const startOfRange = new Date(now.getTime() - rangeMs);

    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

    const ordersThisMonth = allOrders.filter((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return d >= startOfMonth;
    });
    const revenueThisMonth = ordersThisMonth.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

    const ordersInRange = allOrders.filter((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      return d >= startOfRange;
    });
    const revenueInRange = ordersInRange.reduce((sum, o) => sum + (o.amountPaid || 0), 0);

    const avgOrderValue = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;

    // Returning customers
    const returningUsers = users.filter((u) => (u.purchaseCount || 0) > 1);
    const returningRate = users.length > 0 ? (returningUsers.length / users.length) * 100 : 0;

    // Promo usage
    const ordersWithPromo = allOrders.filter((o) => o.promoCode || o.promoApplied);

    return {
      totalOrders: allOrders.length,
      totalRevenue,
      revenueThisMonth,
      ordersThisMonth: ordersThisMonth.length,
      ordersInRange: ordersInRange.length,
      revenueInRange,
      avgOrderValue,
      totalCustomers: users.length,
      returningCustomers: returningUsers.length,
      returningRate,
      promoOrders: ordersWithPromo.length,
      promoRate: allOrders.length > 0 ? (ordersWithPromo.length / allOrders.length) * 100 : 0,
      totalEvents: events.length,
    };
  }, [allOrders, users, events, timeRange]);

  // Monthly revenue data (last 6 months) - combined
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = month.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      months[key] = { revenue: 0, orders: 0, events: 0, products: 0 };
    }

    allOrders.forEach((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (months[key]) {
        months[key].revenue += o.amountPaid || 0;
        months[key].orders += 1;
        if (o.orderType === 'event') months[key].events += 1;
        else months[key].products += 1;
      }
    });

    return Object.entries(months).map(([name, data]) => ({ name, ...data }));
  }, [allOrders]);

  // Revenue by subject
  const revenueBySubject = useMemo(() => {
    const subjectMap = {};
    allOrders.forEach((o) => {
      const subject = o.subject || 'other';
      if (!subjectMap[subject]) subjectMap[subject] = { revenue: 0, orders: 0 };
      subjectMap[subject].revenue += o.amountPaid || 0;
      subjectMap[subject].orders += 1;
    });
    return Object.entries(subjectMap)
      .map(([subject, data]) => ({
        name: SUBJECT_LABELS[subject] || (subject === 'other' ? 'Other' : subject),
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        fill: SUBJECT_COLORS[subject] || '#94a3b8',
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [allOrders]);

  // B1 vs B2 cohort
  const cohortData = useMemo(() => {
    const b1 = { revenue: 0, orders: 0 };
    const b2 = { revenue: 0, orders: 0 };
    const other = { revenue: 0, orders: 0 };

    allOrders.forEach((o) => {
      const tags = o.tags || [];
      if (tags.includes('cohort:b1')) {
        b1.revenue += o.amountPaid || 0;
        b1.orders += 1;
      } else if (tags.includes('cohort:b2')) {
        b2.revenue += o.amountPaid || 0;
        b2.orders += 1;
      } else {
        other.revenue += o.amountPaid || 0;
        other.orders += 1;
      }
    });

    return [
      { name: 'B1', revenue: Math.round(b1.revenue * 100) / 100, orders: b1.orders, fill: '#6366f1' },
      { name: 'B2', revenue: Math.round(b2.revenue * 100) / 100, orders: b2.orders, fill: '#8b5cf6' },
      { name: 'Other', revenue: Math.round(other.revenue * 100) / 100, orders: other.orders, fill: '#94a3b8' },
    ];
  }, [allOrders]);

  // Revenue by campus
  const revenueByCampus = useMemo(() => {
    const campusMap = {};
    allOrders.forEach((o) => {
      const campus = o.campus || 'Unknown';
      if (!campusMap[campus]) campusMap[campus] = { revenue: 0, orders: 0 };
      campusMap[campus].revenue += o.amountPaid || 0;
      campusMap[campus].orders += 1;
    });
    return Object.entries(campusMap)
      .map(([name, data]) => ({
        name,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [allOrders]);

  // Top products by revenue
  const topProducts = useMemo(() => {
    const productMap = {};
    allOrders.forEach((o) => {
      const key = o.orderType === 'product' ? o.productId : o.eventId;
      const title = o.itemTitle;
      if (!key) return;
      if (!productMap[key]) productMap[key] = { title, revenue: 0, orders: 0, type: o.orderType };
      productMap[key].revenue += o.amountPaid || 0;
      productMap[key].orders += 1;
    });
    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [allOrders]);

  // Recent orders (last 10)
  const recentOrders = useMemo(() => allOrders.slice(0, 10), [allOrders]);

  const formatShortDate = (timestamp) => {
    if (!timestamp) return 'No date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'customers', label: 'Customers' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your events, products, and sales</p>
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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ OVERVIEW TAB ═══════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Next Event Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-indigo-200 text-sm font-medium">Next Event</span>
              </div>
              {upcomingEvents.length > 0 ? (
                <>
                  <p className="font-semibold text-lg mb-1 line-clamp-1">{upcomingEvents[0].title}</p>
                  <NextEventCountdown event={upcomingEvents[0]} />
                  <p className="text-indigo-200 text-xs mt-2">{formatShortDate(upcomingEvents[0].date)}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-lg mb-1">No Event Upcoming</p>
                  <p className="text-indigo-200 text-sm">Why not host one?</p>
                </>
              )}
            </div>

            <StatCard
              label="Orders This Month"
              value={stats.ordersThisMonth}
              subtitle={`${stats.totalOrders} all time`}
              icon="🛒"
            />
            <StatCard
              label="Revenue This Month"
              value={`€${stats.revenueThisMonth.toFixed(2)}`}
              subtitle={`Total: €${stats.totalRevenue.toFixed(2)}`}
              icon="💰"
            />
            <StatCard
              label="Avg Order Value"
              value={`€${stats.avgOrderValue.toFixed(2)}`}
              subtitle={`${stats.totalCustomers} customers`}
              icon="📊"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Events */}
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
                <Link href="/admin/events" className="text-sm text-indigo-600 hover:underline">View All</Link>
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
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">E</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{event.title}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">{formatShortDate(event.date)}</span>
                          <span className="text-gray-300">-</span>
                          <NextEventCountdown event={event} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
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
                <Link href="/admin/orders" className="text-sm text-indigo-600 hover:underline">View All</Link>
              </div>
              {recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentOrders.map((order) => (
                        <tr key={`${order.orderType}-${order.id}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">
                              {order.firstName || order.name} {order.lastName || order.surname}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                                order.orderType === 'product' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {order.orderType === 'product' ? 'PRD' : 'EVT'}
                              </span>
                              <span className="text-sm text-gray-600 truncate max-w-[200px]">{order.itemTitle}</span>
                            </div>
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
              {monthlyData.some((d) => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No revenue data yet</div>
              )}
            </div>

            {/* Monthly Orders */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Orders</h2>
              {monthlyData.some((d) => d.orders > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} name="Total" />
                    <Line type="monotone" dataKey="events" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="Events" />
                    <Line type="monotone" dataKey="products" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b' }} name="Products" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No order data yet</div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/admin/events/new" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-sm font-bold">+</span>
                <span className="font-medium text-gray-700">Create Event</span>
              </Link>
              <Link href="/admin/orders" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 text-sm font-bold">O</span>
                <span className="font-medium text-gray-700">View Orders</span>
              </Link>
              <Link href="/admin/users" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 text-sm font-bold">C</span>
                <span className="font-medium text-gray-700">Customers</span>
              </Link>
              <Link href="/admin/products" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all">
                <span className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-sm font-bold">P</span>
                <span className="font-medium text-gray-700">Products</span>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ REVENUE TAB ═══════════════════════ */}
      {activeTab === 'revenue' && (
        <>
          {/* Revenue KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Total Revenue" value={`€${stats.totalRevenue.toFixed(2)}`} subtitle={`${stats.totalOrders} orders`} icon="💰" />
            <StatCard label="Revenue This Month" value={`€${stats.revenueThisMonth.toFixed(2)}`} subtitle={`${stats.ordersThisMonth} orders`} icon="📈" />
            <StatCard label="Avg Order Value" value={`€${stats.avgOrderValue.toFixed(2)}`} icon="📊" />
            <StatCard label="Promo Usage" value={`${stats.promoRate.toFixed(1)}%`} subtitle={`${stats.promoOrders} orders with promo`} icon="🏷️" />
          </div>

          {/* Revenue by Subject */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Subject</h2>
              {revenueBySubject.length > 0 && revenueBySubject.some((d) => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenueBySubject} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {revenueBySubject.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No subject data yet</div>
              )}
            </div>

            {/* B1 vs B2 Cohort */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">B1 vs B2 Cohorts</h2>
              {cohortData.some((d) => d.orders > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={cohortData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="revenue"
                      >
                        {cohortData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {cohortData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                          <span className="text-gray-600">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-gray-900">€{item.revenue.toFixed(2)}</span>
                          <span className="text-gray-400 ml-2">({item.orders} orders)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  No cohort data yet. Tag products/events with cohort:b1 or cohort:b2.
                </div>
              )}
            </div>
          </div>

          {/* Revenue by Campus + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Campus</h2>
              {revenueByCampus.length > 0 && revenueByCampus.some((d) => d.revenue > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenueByCampus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                    <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} />
                    <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No campus data yet</div>
              )}
            </div>

            {/* Top Products/Events by Revenue */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Top Items by Revenue</h2>
              </div>
              {topProducts.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {topProducts.map((item, i) => (
                    <div key={i} className="px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                          item.type === 'product' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {item.type === 'product' ? 'PRD' : 'EVT'}
                        </span>
                        <span className="text-sm text-gray-900 truncate">{item.title}</span>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="font-semibold text-gray-900">€{item.revenue.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{item.orders} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">No data yet</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════ CUSTOMERS TAB ═══════════════════════ */}
      {activeTab === 'customers' && (
        <>
          {/* Customer KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard label="Total Customers" value={stats.totalCustomers} icon="👥" />
            <StatCard label="Returning Customers" value={stats.returningCustomers} subtitle={`${stats.returningRate.toFixed(1)}% return rate`} icon="🔄" />
            <StatCard label="Avg Order Value" value={`€${stats.avgOrderValue.toFixed(2)}`} icon="📊" />
            <StatCard label="Total Orders" value={stats.totalOrders} subtitle={`€${stats.totalRevenue.toFixed(2)} revenue`} icon="🛒" />
          </div>

          {/* Customer insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Returning vs New */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New vs Returning Customers</h2>
              {users.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'New', value: stats.totalCustomers - stats.returningCustomers, fill: '#6366f1' },
                          { name: 'Returning', value: stats.returningCustomers, fill: '#10b981' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        <Cell fill="#6366f1" />
                        <Cell fill="#10b981" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex justify-center gap-8 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-gray-600">New ({stats.totalCustomers - stats.returningCustomers})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span className="text-gray-600">Returning ({stats.returningCustomers})</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">No customer data yet</div>
              )}
            </div>

            {/* Top customers */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Top Customers</h2>
              </div>
              {users.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {users
                    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
                    .slice(0, 10)
                    .map((user) => (
                      <div key={user.id} className="px-6 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.firstName || user.name || ''} {user.lastName || user.surname || ''}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="font-semibold text-gray-900">€{(user.totalSpent || 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{user.purchaseCount || 0} orders</p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">No customer data yet</div>
              )}
            </div>
          </div>

          {/* Campus distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Customers by Campus</h2>
            {revenueByCampus.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {revenueByCampus.map((campus) => (
                  <div key={campus.name} className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm font-medium text-gray-900">{campus.name}</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-1">{campus.orders}</p>
                    <p className="text-xs text-gray-500">orders</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400">No campus data</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
