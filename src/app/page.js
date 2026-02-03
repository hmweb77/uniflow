// src/app/page.js

'use client';

import PublicLayout from '@/components/layout/PublicLayout';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import UpcomingEventsSection from '@/components/landing/UpcomingEventsSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import FAQSection from '@/components/landing/FAQSection';
import CTASection from '@/components/landing/CTASection';

export default function LandingPage() {
  return (
    <PublicLayout>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <UpcomingEventsSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </PublicLayout>
  );
}