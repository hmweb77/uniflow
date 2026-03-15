// src/components/CountdownBanner.js
// Global exam countdown banner, reads from site_config.examCountdowns

'use client';

import { useEffect, useState } from 'react';

export default function CountdownBanner({ countdowns, locale }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!countdowns || countdowns.length === 0) return null;

  // Filter to active countdowns that haven't passed
  const active = countdowns.filter((c) => {
    if (!c.active) return false;
    const target = c.date?.toDate ? c.date.toDate() : new Date(c.date);
    return target > now;
  });

  if (active.length === 0) return null;

  // Show the nearest countdown
  const nearest = active.sort((a, b) => {
    const dA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const dB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return dA - dB;
  })[0];

  const target = nearest.date?.toDate ? nearest.date.toDate() : new Date(nearest.date);
  const diff = target - now;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return (
    <div
      className="w-full py-3 px-4 text-center text-sm font-medium"
      style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
      }}
    >
      <span className="mr-2">{nearest.label}</span>
      <span className="font-mono font-bold">
        {days > 0 && `${days}d `}{hours}h {minutes}m {seconds}s
      </span>
      {nearest.category && (
        <span className="ml-2 opacity-70 text-xs">({nearest.category})</span>
      )}
    </div>
  );
}
