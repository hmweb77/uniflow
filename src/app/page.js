// src/app/page.js

'use client';

import PublicLayout from '@/components/layout/PublicLayout';
import HeroSection from '@/components/landing/HeroSection';
import StatsSection from '@/components/landing/StatsSection';
import SubjectsSection from '@/components/landing/SubjectsSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import UpcomingEventsSection from '@/components/landing/UpcomingEventsSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import FAQSection from '@/components/landing/FAQSection';
import CTASection from '@/components/landing/CTASection';

export default function LandingPage() {
  return (
    <PublicLayout>
      <HeroSection />
      <StatsSection />
      <SubjectsSection />
      <UpcomingEventsSection />
      <FeaturesSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
    </PublicLayout>
  );
}
