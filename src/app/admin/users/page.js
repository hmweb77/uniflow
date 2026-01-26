// src/app/admin/users/page.js

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateCSV, downloadCSV } from '../../lib/utils';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('totalSpent'); // totalSpent, name, purchases
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedUser, setSelectedUser] = useState(null);

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

      // Fetch all attendees
      const attendeesRef = collection(db, 'attendees');
      const attendeesSnap = await getDocs(attendeesRef);
      const attendees = attendeesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Group attendees by email to create user profiles
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
          eventTitle: event?.title || 'Unknown Event',
          amount: purchaseAmount,
          date: attendee.createdAt,
        });

        usersMap[email].totalSpent += purchaseAmount;

        // Update name if more recent
        if (attendee.createdAt > usersMap[email].lastPurchase) {
          usersMap[email].name = attendee.name;
          usersMap[email].surname = attendee.surname;
          usersMap[email].lastPurchase = attendee.createdAt;
        }

        // Track first purchase
        if (attendee.createdAt < usersMap[email].firstPurchase) {
          usersMap[email].firstPurchase = attendee.createdAt;
        }
      });

      // Convert to array
      const usersArray = Object.values(usersMap);
      setUsers(usersArray);
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
          aVal = a.totalSpent;
          bVal = b.totalSpent;
          break;
        case 'purchases':
          aVal = a.purchases.length;
          bVal = b.purchases.length;
          break;
        case 'name':
          aVal = `${a.name} ${a.surname}`.toLowerCase();
          bVal = `${b.name} ${b.surname}`.toLowerCase();
          break;
        case 'lastPurchase':
          aVal = a.lastPurchase?.toDate?.() || new Date(a.lastPurchase);
          bVal = b.lastPurchase?.toDate?.() || new Date(b.lastPurchase);
          break;
        default:
          aVal = a.totalSpent;
          bVal = b.totalSpent;
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
      name: user.name,
      surname: user.surname,
      email: user.email,
      purchaseCount: user.purchases.length,
      totalSpent: user.totalSpent.toFixed(2),
      courses: user.purchases.map((p) => p.eventTitle).join('; '),
    }));

    const csv = generateCSV(data, headers);
    downloadCSV(csv, 'uniflow_customers.csv');
  };

  // Calculate totals
  const totalUsers = users.length;
  const totalRevenue = users.reduce((sum, user) => sum + user.totalSpent, 0);
  const totalPurchases = users.reduce((sum, user) => sum + user.purchases.length, 0);
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
          <p className="text-gray-500 mt-1">All users who purchased tickets</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={users.length === 0}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📥 Export CSV
        </button>
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
              <p className="text-xl font-bold text-gray-900">{totalRevenue.toFixed(2)} €</p>
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
              <p className="text-xl font-bold text-gray-900">{avgSpentPerUser.toFixed(2)} €</p>
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
                  <tr key={user.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.name} {user.surname}
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
                        {user.purchases.length} course{user.purchases.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">
                        {user.totalSpent.toFixed(2)} €
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
                  {selectedUser.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedUser.name} {selectedUser.surname}
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
                    {selectedUser.purchases.length}
                  </p>
                  <p className="text-sm text-gray-500">Courses</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedUser.totalSpent.toFixed(2)} €
                  </p>
                  <p className="text-sm text-gray-500">Total Spent</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {formatDate(selectedUser.firstPurchase)}
                  </p>
                  <p className="text-sm text-gray-500">First Purchase</p>
                </div>
              </div>

              {/* Purchase History */}
              <h3 className="font-semibold text-gray-900 mb-4">Purchase History</h3>
              <div className="space-y-3">
                {selectedUser.purchases.map((purchase, index) => (
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
                        <p className="text-sm text-gray-500">{formatDate(purchase.date)}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">{purchase.amount.toFixed(2)} €</p>
                  </div>
                ))}
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