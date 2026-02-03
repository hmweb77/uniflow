// src/components/layout/Navbar.js

'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';
import { useLocale } from '@/contexts/LocaleContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function Navbar() {
  const { t } = useLocale();
  const { theme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: '/', label: t.nav.home },
    { href: '/events', label: t.nav.events },
    { href: '/#how-it-works', label: t.nav.howItWorks },
    { href: '/#faq', label: t.nav.faq },
  ];

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('#')[0]) && href !== '/';
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 glass border-b"
      style={{ borderColor: 'var(--border-light)', height: 'var(--nav-height)' }}
    >
      <div className="container-wide h-full flex items-center justify-between">
        {/* Logo — direct image */}
        <Link href="/" className="flex items-center group">
          <Image
            src={theme === 'dark' ? '/logoB.png' : '/logg.png'}
            alt="Uniflow"
            width={44}
            height={44}
            className="rounded-lg -mr-1"
            priority
          />
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Uniflow
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
          <Link href="/login" className="btn btn-primary btn-sm ml-2">
            {t.nav.adminLogin}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="btn btn-ghost btn-sm"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-light)',
          }}
        >
          <div className="container-wide py-4 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-[var(--color-primary-600)] bg-[var(--color-primary-50)] dark:bg-[rgba(51,115,245,0.1)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block btn btn-primary btn-md mt-3 text-center"
            >
              {t.nav.adminLogin}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}