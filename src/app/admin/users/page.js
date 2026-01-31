// src/app/admin/users/page.js
// Users/Customers page - reads from both 'users' and 'attendees' collections

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateCSV, downloadCSV, generateXLS, downloadXLS } from '../../lib/utils';
import Link from 'next/link';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('totalSpent');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedUser, setSelectedUser] = useState(null);
  const [dataSource, setDataSource] = useState('auto'); // 'users', 'attendees', 'auto'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all events first (for event names)
      const eventsRef = collection(db, 'events');
      const eventsSnap = await getDocs(eventsRef);
      const eventsMap = {};
      eventsSnap.docs.forEach((doc) => {
        eventsMap[doc.id] = { id: doc.id, ...doc.data() };
      });
      setEvents(eventsMap);

      // Try to fetch from 'users' collection first
      let usersData = [];
      let source = 'attendees';

      try {
        const usersRef = collection(db, 'users');
        const usersSnap = await getDocs(query(usersRef, orderBy('createdAt', 'desc')));
        
        if (usersSnap.size > 0) {
          source = 'users';
          usersData = usersSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              email: data.email,
              name: data.name,
              surname: data.surname,
              totalSpent: data.totalSpent || 0,
              purchaseCount: data.purchaseCount || 0,
              events: data.events || [],
              createdAt: data.createdAt,
              lastPurchase: data.lastPurchase,
              // Build purchases from events
              purchases: (data.events || []).map((eventId) => ({
                eventId,
                eventTitle: eventsMap[eventId]?.title || 'Unknown Event',
              })),
            };
          });
        }
      } catch (usersErr) {
        console.log('Users collection not available, falling back to attendees');
      }

      // If no users collection data, build from attendees
      if (usersData.length === 0) {
        const attendeesRef = collection(db, 'attendees');
        const attendeesSnap = await getDocs(attendeesRef);
        const attendees = attendeesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Group attendees by email
        const usersMap = {};
        attendees.forEach((attendee) => {
          if (attendee.paymentStatus !== 'completed') return;

          const email = attendee.email?.toLowerCase();
          if (!email) return;

          if (!usersMap[email]) {
            usersMap[email] = {
              email: attendee.email,
              name: attendee.name,
              surname: attendee.surname,
              purchases: [],
              totalSpent: 0,
              firstPurchase: attendee.createdAt,
              lastPurchase: attendee.createdAt,
            };
          }

          const event = eventsMap[attendee.eventId];
          const purchaseAmount = attendee.amountPaid || event?.price || 0;

          usersMap[email].purchases.push({
            eventId: attendee.eventId,
            eventTitle: event?.title || attendee.eventTitle || 'Unknown Event',
            amount: purchaseAmount,
            date: attendee.createdAt,
            ticketName: attendee.ticketName,
          });

          usersMap[email].totalSpent += purchaseAmount;

          // Update name if more recent
          const attendeeDate = attendee.createdAt?.toDate?.() || new Date(attendee.createdAt);
          const lastDate = usersMap[email].lastPurchase?.toDate?.() || new Date(usersMap[email].lastPurchase);
          
          if (attendeeDate > lastDate) {
            usersMap[email].name = attendee.name || usersMap[email].name;
            usersMap[email].surname = attendee.surname || usersMap[email].surname;
            usersMap[email].lastPurchase = attendee.createdAt;
          }

          // Track first purchase
          const firstDate = usersMap[email].firstPurchase?.toDate?.() || new Date(usersMap[email].firstPurchase);
          if (attendeeDate < firstDate) {
            usersMap[email].firstPurchase = attendee.createdAt;
          }
        });

        // Convert to array and add purchaseCount
        usersData = Object.values(usersMap).map((user) => ({
          ...user,
          purchaseCount: user.purchases.length,
          events: user.purchases.map((p) => p.eventId),
        }));
      }

      setDataSource(source);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedUsers = [...users]
    .filter((user) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        user.email?.toLowerCase().includes(search) ||
        user.name?.toLowerCase().includes(search) ||
        user.surname?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'totalSpent':
          aVal = a.totalSpent || 0;
          bVal = b.totalSpent || 0;
          break;
        case 'purchases':
          aVal = a.purchaseCount || a.purchases?.length || 0;
          bVal = b.purchaseCount || b.purchases?.length || 0;
          break;
        case 'name':
          aVal = `${a.name || ''} ${a.surname || ''}`.toLowerCase();
          bVal = `${b.name || ''} ${b.surname || ''}`.toLowerCase();
          break;
        case 'lastPurchase':
          aVal = a.lastPurchase?.toDate?.() || new Date(a.lastPurchase || 0);
          bVal = b.lastPurchase?.toDate?.() || new Date(b.lastPurchase || 0);
          break;
        default:
          aVal = a.totalSpent || 0;
          bVal = b.totalSpent || 0;
      }
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

  const handleExportCSV = () => {
    const headers = [
      { key: 'name', label: 'First Name' },
      { key: 'surname', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'purchaseCount', label: 'Purchases' },
      { key: 'totalSpent', label: 'Total Spent (€)' },
      { key: 'courses', label: 'Courses' },
    ];

    const data = users.map((user) => ({
      name: user.name || '',
      surname: user.surname || '',
      email: user.email || '',
      purchaseCount: user.purchaseCount || user.purchases?.length || 0,
      totalSpent: (user.totalSpent || 0).toFixed(2),
      courses: (user.purchases || []).map((p) => p.eventTitle).join('; '),
    }));

    const csv = generateCSV(data, headers);
    downloadCSV(csv, `uniflow_customers_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportXLS = () => {
    const headers = [
      { key: 'name', label: 'First Name' },
      { key: 'surname', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'purchaseCount', label: 'Purchases' },
      { key: 'totalSpent', label: 'Total Spent (€)' },
      { key: 'courses', label: 'Courses' },
    ];

    const data = users.map((user) => ({
      name: user.name || '',
      surname: user.surname || '',
      email: user.email || '',
      purchaseCount: user.purchaseCount || user.purchases?.length || 0,
      totalSpent: (user.totalSpent || 0).toFixed(2),
      courses: (user.purchases || []).map((p) => p.eventTitle).join('; '),
    }));

    const xls = generateXLS(data, headers);
    downloadXLS(xls, `uniflow_customers_${new Date().toISOString().split('T')[0]}.xls`);
  };

  // Calculate totals
  const totalUsers = users.length;
  const totalRevenue = users.reduce((sum, user) => sum + (user.totalSpent || 0), 0);
  const totalPurchases = users.reduce((sum, user) => sum + (user.purchaseCount || user.purchases?.length || 0), 0);
  const avgSpentPerUser = totalUsers > 0 ? totalRevenue / totalUsers : 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">
            All users who purchased tickets
            <span className="ml-2 text-xs text-gray-400">
              (Source: {dataSource === 'users' ? 'users collection' : 'attendees collection'})
            </span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            disabled={users.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            📥 CSV
          </button>
          <button
            onClick={handleExportXLS}
            disabled={users.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            📊 Export XLS
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">{totalUsers}</p>
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
              <p className="text-xl font-bold text-gray-900">€{totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">🎫</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Purchases</p>
              <p className="text-xl font-bold text-gray-900">{totalPurchases}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg. per Customer</p>
              <p className="text-xl font-bold text-gray-900">€{avgSpentPerUser.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="totalSpent">Sort by: Total Spent</option>
              <option value="purchases">Sort by: Purchases</option>
              <option value="name">Sort by: Name</option>
              <option value="lastPurchase">Sort by: Last Purchase</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {sortedUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    Customer {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('purchases')}
                  >
                    Purchases {sortBy === 'purchases' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalSpent')}
                  >
                    Total Spent {sortBy === 'totalSpent' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('lastPurchase')}
                  >
                    Last Purchase {sortBy === 'lastPurchase' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedUsers.map((user, index) => (
                  <tr key={user.id || user.email || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.name || ''} {user.surname || ''}
                            {!user.name && !user.surname && <span className="text-gray-400">No name</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`mailto:${user.email}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {user.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                        {user.purchaseCount || user.purchases?.length || 0} event{(user.purchaseCount || user.purchases?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">
                        €{(user.totalSpent || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.lastPurchase)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers yet</h3>
            <p>Customers will appear here once they purchase tickets</p>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                  {(selectedUser.name || selectedUser.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedUser.name || ''} {selectedUser.surname || ''}
                    {!selectedUser.name && !selectedUser.surname && 'Customer'}
                  </h2>
                  <a
                    href={`mailto:${selectedUser.email}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {selectedUser.email}
                  </a>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.purchaseCount || selectedUser.purchases?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500">Events</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    €{(selectedUser.totalSpent || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-500">Total Spent</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDate(selectedUser.firstPurchase || selectedUser.createdAt)}
                  </p>
                  <p className="text-sm text-gray-500">First Purchase</p>
                </div>
              </div>

              {/* Enrolled Events */}
              <h3 className="font-semibold text-gray-900 mb-4">Enrolled Events</h3>
              <div className="space-y-3">
                {(selectedUser.purchases || []).length > 0 ? (
                  selectedUser.purchases.map((purchase, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">🎓</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{purchase.eventTitle}</p>
                          {purchase.ticketName && (
                            <p className="text-xs text-gray-500">{purchase.ticketName}</p>
                          )}
                          {purchase.date && (
                            <p className="text-sm text-gray-500">{formatDate(purchase.date)}</p>
                          )}
                        </div>
                      </div>
                      {purchase.amount !== undefined && (
                        <p className="font-semibold text-gray-900">€{purchase.amount.toFixed(2)}</p>
                      )}
                    </div>
                  ))
                ) : selectedUser.events?.length > 0 ? (
                  selectedUser.events.map((eventId, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <span className="text-lg">🎓</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {events[eventId]?.title || 'Unknown Event'}
                          </p>
                        </div>
                      </div>
                      <Link
                        href={`/admin/events/${eventId}`}
                        className="text-indigo-600 hover:underline text-sm"
                      >
                        View Event
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-4">No purchase history available</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <a
                href={`mailto:${selectedUser.email}`}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                📧 Send Email
              </a>
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-gray-600 font-medium hover:text-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}