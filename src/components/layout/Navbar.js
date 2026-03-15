// src/components/layout/Navbar.js

'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LocaleToggle from '@/components/ui/LocaleToggle';
import CartButton from '@/components/CartButton';
import { useLocale } from '@/contexts/LocaleContext';
import { useTheme } from '@/contexts/ThemeContext';

const B1_ITEMS = [
  { href: '/classes?category=b1', labelEn: 'All B1 Courses', labelFr: 'Tous les cours B1' },
  { href: '/classes?category=b1&type=event', labelEn: 'B1 Live Classes', labelFr: 'Cours B1 en direct' },
  { href: '/classes?category=b1&type=bundle', labelEn: 'B1 Bundles', labelFr: 'Packs B1' },
  { href: '/classes?category=b1&type=product', labelEn: 'B1 Materials', labelFr: 'Supports B1' },
];

const B2_ITEMS = [
  { href: '/classes?category=b2', labelEn: 'All B2 Courses', labelFr: 'Tous les cours B2' },
  { href: '/classes?category=b2&type=event', labelEn: 'B2 Live Classes', labelFr: 'Cours B2 en direct' },
  { href: '/classes?category=b2&type=bundle', labelEn: 'B2 Bundles', labelFr: 'Packs B2' },
  { href: '/classes?category=b2&type=product', labelEn: 'B2 Materials', labelFr: 'Supports B2' },
];

function NavDropdown({ label, items, locale, color }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors hover:bg-[var(--bg-secondary)]"
        style={{ color }}
      >
        {label}
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-2 w-52 rounded-xl border shadow-xl py-2 z-50"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-light)',
          }}
        >
          {items.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 text-sm transition-colors hover:bg-[var(--bg-secondary)] ${i === 0 ? 'font-semibold' : ''}`}
              style={{ color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              {locale === 'fr' ? item.labelFr : item.labelEn}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { locale, t } = useLocale();
  const { theme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileB1Open, setMobileB1Open] = useState(false);
  const [mobileB2Open, setMobileB2Open] = useState(false);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 glass border-b"
      style={{ borderColor: 'var(--border-light)', height: 'var(--nav-height)' }}
    >
      <div className="container-wide h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/newLog.png"
            alt="Uniflow"
            width={44}
            height={44}
            className="rounded-lg"
            priority
          />
          <span className="text-lg font-bold hidden sm:block" style={{ color: 'var(--text-primary)' }}>
            UniFlow
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          <NavDropdown label="B1 Prep" items={B1_ITEMS} locale={locale} color="var(--color-primary-600)" />
          <NavDropdown label="B2 Prep" items={B2_ITEMS} locale={locale} color="var(--color-primary-600)" />
          <Link
            href="/classes"
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            {locale === 'fr' ? 'Tous les cours' : 'All Courses'}
          </Link>
        </div>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-1.5">
          <CartButton />
          <LocaleToggle />
          <ThemeToggle />
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-1.5">
          <CartButton />
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
            {/* B1 accordion */}
            <div>
              <button
                onClick={() => setMobileB1Open(!mobileB1Open)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--color-primary-600)' }}
              >
                B1 Prep
                <svg className={`w-4 h-4 transition-transform ${mobileB1Open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {mobileB1Open && (
                <div className="pl-4 space-y-0.5">
                  {B1_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                    >
                      {locale === 'fr' ? item.labelFr : item.labelEn}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* B2 accordion */}
            <div>
              <button
                onClick={() => setMobileB2Open(!mobileB2Open)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--color-primary-600)' }}
              >
                B2 Prep
                <svg className={`w-4 h-4 transition-transform ${mobileB2Open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {mobileB2Open && (
                <div className="pl-4 space-y-0.5">
                  {B2_ITEMS.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                    >
                      {locale === 'fr' ? item.labelFr : item.labelEn}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/classes"
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            >
              {locale === 'fr' ? 'Tous les cours' : 'All Courses'}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
