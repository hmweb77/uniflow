// src/app/admin/orders/page.js

'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateCSV, downloadCSV, generateXLS, downloadXLS } from '../../lib/utils';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [selectedTicketType, setSelectedTicketType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all events
      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(eventsRef);
      const eventsMap = {};
      eventsSnap.docs.forEach((doc) => {
        eventsMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setEvents(eventsMap);

      // Fetch all attendees (orders)
      const attendeesRef = collection(db, 'attendees');
      const attendeesSnap = await getDocs(attendeesRef);
      const ordersData = attendeesSnap.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((a) => a.paymentStatus === 'completed')
        .map((order) => {
          const event = eventsMap[order.eventId];
          return {
            ...order,
            eventTitle: event?.title || 'Unknown Event',
            eventDate: event?.date,
          };
        });

      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filters
  const eventOptions = useMemo(() => {
    const uniqueEvents = new Set(orders.map((o) => o.eventId));
    return Array.from(uniqueEvents)
      .map((id) => ({
        id,
        title: events[id]?.title || 'Unknown Event',
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [orders, events]);

  const ticketTypeOptions = useMemo(() => {
    const types = new Set(orders.map((o) => o.ticketName || 'General Admission'));
    return Array.from(types).sort();
  }, [orders]);

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      result = result.filter((order) => {
        const fullName = `${order.name || ''} ${order.surname || ''}`.toLowerCase();
        const email = (order.email || '').toLowerCase();
        const orderId = (order.id || '').toLowerCase();
        return fullName.includes(search) || email.includes(search) || orderId.includes(search);
      });
    }

    // Event filter
    if (selectedEvent !== 'all') {
      result = result.filter((order) => order.eventId === selectedEvent);
    }

    // Ticket type filter
    if (selectedTicketType !== 'all') {
      result = result.filter(
        (order) => (order.ticketName || 'General Admission') === selectedTicketType
      );
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((order) => {
        const orderDate = order.createdAt?.toDate
          ? order.createdAt.toDate()
          : new Date(order.createdAt);
        return orderDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((order) => {
        const orderDate = order.createdAt?.toDate
          ? order.createdAt.toDate()
          : new Date(order.createdAt);
        return orderDate <= toDate;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'date':
          aVal = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          bVal = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          break;
        case 'name':
          aVal = `${a.name || ''} ${a.surname || ''}`.toLowerCase();
          bVal = `${b.name || ''} ${b.surname || ''}`.toLowerCase();
          break;
        case 'amount':
          aVal = a.amountPaid || 0;
          bVal = b.amountPaid || 0;
          break;
        case 'event':
          aVal = a.eventTitle?.toLowerCase() || '';
          bVal = b.eventTitle?.toLowerCase() || '';
          break;
        default:
          aVal = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          bVal = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [orders, searchTerm, selectedEvent, selectedTicketType, dateFrom, dateTo, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedEvent, selectedTicketType, dateFrom, dateTo]);

  // Format helpers
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getShortOrderId = (id) => '#' + id.substring(0, 8).toLowerCase();

  // Export functions
  const handleExportCSV = () => {
    const headers = [
      { key: 'orderId', label: 'Order ID' },
      { key: 'name', label: 'First Name' },
      { key: 'surname', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'eventTitle', label: 'Event' },
      { key: 'ticketName', label: 'Ticket Type' },
      { key: 'amountPaid', label: 'Amount Paid (€)' },
      { key: 'createdAt', label: 'Date' },
    ];

    const data = filteredOrders.map((order) => ({
      orderId: getShortOrderId(order.id),
      name: order.name || '',
      surname: order.surname || '',
      email: order.email || '',
      eventTitle: order.eventTitle || '',
      ticketName: order.ticketName || 'General Admission',
      amountPaid: order.amountPaid?.toFixed(2) || '0.00',
      createdAt: formatDate(order.createdAt),
    }));

    const csv = generateCSV(data, headers);
    downloadCSV(csv, `uniflow_orders_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportXLS = () => {
    const headers = [
      { key: 'orderId', label: 'Order ID' },
      { key: 'name', label: 'First Name' },
      { key: 'surname', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'eventTitle', label: 'Event' },
      { key: 'ticketName', label: 'Ticket Type' },
      { key: 'amountPaid', label: 'Amount Paid (€)' },
      { key: 'createdAt', label: 'Date' },
    ];

    const data = filteredOrders.map((order) => ({
      orderId: getShortOrderId(order.id),
      name: order.name || '',
      surname: order.surname || '',
      email: order.email || '',
      eventTitle: order.eventTitle || '',
      ticketName: order.ticketName || 'General Admission',
      amountPaid: order.amountPaid?.toFixed(2) || '0.00',
      createdAt: formatDate(order.createdAt),
    }));

    const xls = generateXLS(data, headers);
    downloadXLS(xls, `uniflow_orders_${new Date().toISOString().split('T')[0]}.xls`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedEvent('all');
    setSelectedTicketType('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    searchTerm || selectedEvent !== 'all' || selectedTicketType !== 'all' || dateFrom || dateTo;

  // Calculate summary stats for filtered results
  const filteredStats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
    const uniqueEvents = new Set(filteredOrders.map((o) => o.eventId)).size;
    return {
      count: filteredOrders.length,
      revenue: totalRevenue,
      events: uniqueEvents,
    };
  }, [filteredOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 mt-1">
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            📥 Export CSV
          </button>
          <button
            onClick={handleExportXLS}
            disabled={filteredOrders.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            📊 Export as XLS
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">🎫</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-xl font-bold text-gray-900">{filteredStats.count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900">€{filteredStats.revenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Events</p>
              <p className="text-xl font-bold text-gray-900">{filteredStats.events}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search by name, email, or order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Event Filter */}
          <div className="w-full lg:w-auto">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Events</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>

          {/* Ticket Type Filter */}
          <div className="w-full lg:w-auto">
            <select
              value={selectedTicketType}
              onChange={(e) => setSelectedTicketType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Ticket Types</option>
              {ticketTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters and Sort */}
        <div className="flex flex-col lg:flex-row gap-4 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 whitespace-nowrap">To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>

          <div className="flex-1"></div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="amount">Sort by Amount</option>
              <option value="event">Sort by Event</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
            </button>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {paginatedOrders.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid / Tickets
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-indigo-600 font-medium">
                          {getShortOrderId(order.id)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/events/${order.eventId}`}
                          className="text-gray-900 hover:text-indigo-600 font-medium truncate block max-w-xs"
                        >
                          {order.eventTitle}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {order.name} {order.surname}
                          </p>
                          <a
                            href={`mailto:${order.email}`}
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            {order.email}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">
                            €{order.amountPaid?.toFixed(2) || '0.00'}
                          </span>
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                            🎫 1
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-500">per page</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <div className="text-6xl mb-4">🎫</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p>
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Orders will appear here when customers purchase tickets'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}