// src/app/page.js

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../app/lib/firebase';
import Link from 'next/link';

export default function LandingPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    fetchPublicEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPublicEvents = async () => {
    try {
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(eventsRef, orderBy('date', 'asc'));
      const eventsSnap = await getDocs(eventsQuery);
      const eventsData = eventsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Filter: only upcoming events (date > now) and not cancelled
      const now = new Date();
      const upcomingEvents = eventsData.filter((event) => {
        if (event.status === 'cancelled') return false;
        const eventDate = parseDate(event.date);
        return eventDate > now;
      });
      
      // Take only the 3 soonest events
      setEvents(upcomingEvents.slice(0, 3));
    } catch (error) {
      console.error('Error fetching events:', error);
      // Fallback: try without ordering if index doesn't exist
      try {
        const eventsRef = collection(db, 'events');
        const eventsSnap = await getDocs(eventsRef);
        const eventsData = eventsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        const now = new Date();
        const upcomingEvents = eventsData
          .filter((event) => {
            if (event.status === 'cancelled') return false;
            const eventDate = parseDate(event.date);
            return eventDate > now;
          })
          .sort((a, b) => parseDate(a.date) - parseDate(b.date))
          .slice(0, 3);
        
        setEvents(upcomingEvents);
      } catch (err) {
        console.error('Fallback query also failed:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Parse date from various formats
  const parseDate = (timestamp) => {
    if (!timestamp) return new Date(0);
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp._seconds) return new Date(timestamp._seconds * 1000);
    return new Date(timestamp);
  };

  const formatDate = (timestamp) => {
    const date = parseDate(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp) => {
    const date = parseDate(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get lowest price from tickets or legacy price
  const getLowestPrice = (event) => {
    if (event.tickets && event.tickets.length > 0) {
      return Math.min(...event.tickets.map((t) => t.price || 0));
    }
    return event.price || 0;
  };

  const features = [
    {
      icon: '⚡',
      title: 'Instant Access',
      description: 'Pay once, get immediate access to your online class link via email.',
    },
    {
      icon: '🔒',
      title: 'Secure Payments',
      description: 'Powered by Stripe with support for cards, Apple Pay & Google Pay.',
    },
   
    {
      icon: '📱',
      title: 'Mobile Friendly',
      description: 'Register and access your classes from any device, anywhere.',
    },
  
  ];

  const steps = [
    {
      number: '01',
      title: 'Browse Events',
      description: 'Explore upcoming online classes and masterclasses from top educators.',
      icon: '🔍',
    },
    {
      number: '02',
      title: 'Register & Pay',
      description: 'Quick registration with secure payment. No account needed.',
      icon: '💳',
    },
    {
      number: '03',
      title: 'Join the Class',
      description: 'Receive your access link by email and join the live session.',
      icon: '🎥',
    },
  ];

  const testimonials = [
    {
      name: 'Marie L.',
      role: 'Business Student, ESCP',
      content: 'Super easy to register for classes! I received my Zoom link instantly after payment.',
      avatar: '👩‍🎓',
    },
    {
      name: 'Thomas D.',
      role: 'Engineering Student, Polytechnique',
      content: 'Finally a platform that makes it simple to access premium masterclasses. Love it!',
      avatar: '👨‍💻',
    },
    {
      name: 'Sarah M.',
      role: 'MBA Student, HEC Paris',
      content: 'The payment process is seamless. Apple Pay made checkout a breeze.',
      avatar: '👩‍💼',
    },
  ];

  const faqs = [
    {
      question: 'Do I need to create an account?',
      answer: 'No! Simply enter your name and email during registration. Your access link will be sent directly to your email.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'We accept all major credit cards, Apple Pay, and Google Pay through our secure Stripe payment system.',
    },
    {
      question: 'How do I access the online class?',
      answer: "After payment, you'll receive an email with the event details and a direct link to join the online class (Zoom or Google Meet).",
    },
    {
      question: 'Can I get a refund?',
      answer: 'Refund policies vary by event. Please contact the event organizer directly for refund requests.',
    },
    {
      question: 'Is my payment information secure?',
      answer: 'Absolutely! All payments are processed securely through Stripe. We never store your card details.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Uniflow</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/events" className="text-gray-600 hover:text-gray-900 transition-colors">
                Events
              </Link>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
                How it Works
              </a>
              <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors">
                FAQ
              </a>
              <Link
                href="/login"
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Admin Login
              </Link>
            </div>
            {/* Mobile menu button */}
            <Link
              href="/login"
              className="md:hidden px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-indigo-50 via-white to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full text-indigo-700 text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Now available for universities
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
              Online Classes,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                Made Simple
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto">
              The easiest way for students to discover and pay for premium online masterclasses. No account needed.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/events"
                className="px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/30 text-lg"
              >
                See All Events
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-lg"
              >
                How it Works
              </a>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['👩‍🎓', '👨‍💻', '👩‍💼', '👨‍🎓'].map((emoji, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border-2 border-white"
                    >
                      {emoji}
                    </div>
                  ))}
                </div>
                <span>500+ students registered</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="text-yellow-400">★</span>
                ))}
                <span className="ml-1">4.9/5 rating</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything you need for online classes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              A seamless experience for students and educators alike
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-all group"
              >
                <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How it works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in 3 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-indigo-300 to-purple-300"></div>
                )}
                <div className="bg-white rounded-2xl p-8 text-center relative z-10 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                    {step.icon}
                  </div>
                  <div className="text-sm font-bold text-indigo-600 mb-2">
                    STEP {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section id="events" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Upcoming Events
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Don&apos;t miss these upcoming online classes
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : events.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {events.map((event) => {
                  const price = getLowestPrice(event);
                  const hasMultipleTickets = event.tickets && event.tickets.length > 1;
                  
                  return (
                    <Link
                      key={event.id}
                      href={`/e/${event.slug}`}
                      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-indigo-100 transition-all"
                    >
                      {/* Event Banner */}
                      <div className="h-48 bg-gradient-to-br from-indigo-400 to-purple-500 relative overflow-hidden">
                        {event.bannerUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={event.bannerUrl}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-6xl opacity-50">🎓</span>
                          </div>
                        )}
                        {/* Price Badge */}
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                          {price === 0 ? (
                            <span className="font-bold text-green-600">Free</span>
                          ) : (
                            <span className="font-bold text-gray-900">
                              {hasMultipleTickets && 'From '}
                              {price} €
                            </span>
                          )}
                        </div>
                        {/* Language Badge */}
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-sm">
                          {event.language === 'fr' ? '🇫🇷' : '🇬🇧'}
                        </div>
                      </div>

                      {/* Event Info */}
                      <div className="p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                          {event.title}
                        </h3>
                        
                        {/* Organizer */}
                        {event.organizer && (
                          <p className="text-sm text-indigo-600 mb-2">
                            👤 {event.organizer}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                          <span className="flex items-center gap-1">
                            📅 {formatDate(event.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            🕐 {formatTime(event.date)}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                          {event.description || 'Join this amazing online class!'}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-600 font-medium group-hover:underline">
                            Register Now →
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              
              {/* See All Events Button */}
              <div className="text-center">
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/30 text-lg"
                >
                  See All Events
                  <span>→</span>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No upcoming events
              </h3>
              <p className="text-gray-500 mb-6">
                Check back soon for new classes!
              </p>
              <Link
                href="/events"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Browse All Events
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Loved by students
            </h2>
            <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
              See what our community has to say
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className="text-yellow-400">★</span>
                  ))}
                </div>
                <p className="text-white mb-6">&ldquo;{testimonial.content}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="text-indigo-200 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to know
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900">{faq.question}</span>
                  <span
                    className={`text-2xl text-gray-400 transition-transform ${
                      openFaq === index ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Ready to start learning?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Browse our upcoming events and register for your next online class today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/events"
              className="px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all hover:shadow-lg hover:shadow-indigo-500/30 text-lg"
            >
              See All Events
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-lg"
            >
              I&apos;m an Educator
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">U</span>
              </div>
              <span className="text-xl font-bold text-white">Uniflow</span>
            </div>
            <div className="flex items-center gap-8 text-sm">
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
            <p className="text-sm">
              © 2025 Uniflow. Made for universities.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}