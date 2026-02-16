// src/app/admin/layout.js

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import Link from 'next/link';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: 'D' },
  { name: 'Events', href: '/admin/events', icon: 'E' },
  { name: 'Orders', href: '/admin/orders', icon: 'O' },
  { name: 'Customers', href: '/admin/users', icon: 'C' },
  { name: 'Categories', href: '/admin/categories', icon: 'T' },
  { name: 'Campuses', href: '/admin/campuses', icon: 'M' },
  { name: 'Promos', href: '/admin/promos', icon: 'P' },
  { name: 'Products', href: '/admin/products', icon: 'R' },
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="admin-dashboard min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-xl font-bold text-indigo-600">Uniflow</span>
            </Link>
            <p className="text-xs text-gray-400 mt-1">Admin Dashboard</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                    isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-semibold ${
                    isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}

            <div className="my-4 border-t border-gray-200"></div>

            <Link
              href="/admin/events/new"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              <span className="w-7 h-7 rounded flex items-center justify-center text-xs font-semibold bg-gray-100 text-gray-500">+</span>
              <span className="font-medium">Create Event</span>
            </Link>

            <Link
              href="/classes"
              target="_blank"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              <span className="w-7 h-7 rounded flex items-center justify-center text-xs font-semibold bg-gray-100 text-gray-500">S</span>
              <span className="font-medium">Student Page</span>
            </Link>

            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
            >
              <span className="w-7 h-7 rounded flex items-center justify-center text-xs font-semibold bg-gray-100 text-gray-500">W</span>
              <span className="font-medium">View Site</span>
            </Link>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">U</span>
              </div>
              <span className="font-bold text-indigo-600">Uniflow</span>
            </Link>
            <div className="w-10" />
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
