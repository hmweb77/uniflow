// src/app/lib/calendar.js

/**
 * Generate calendar links for various providers
 */

// Format date for Google Calendar URL (YYYYMMDDTHHMMSSZ)
function formatDateForGoogle(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }
  
  // Format date for Outlook/Yahoo (ISO format)
  function formatDateForOutlook(date) {
    return date.toISOString();
  }
  
  /**
   * Generate Google Calendar "Add Event" URL
   */
  export function getGoogleCalendarUrl({ title, description, location, startDate, endDate }) {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
      details: description || '',
      location: location || '',
      ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  
  /**
   * Generate Outlook.com Calendar "Add Event" URL
   */
  export function getOutlookCalendarUrl({ title, description, location, startDate, endDate }) {
    const params = new URLSearchParams({
      subject: title,
      body: description || '',
      location: location || '',
      startdt: formatDateForOutlook(startDate),
      enddt: formatDateForOutlook(endDate),
      path: '/calendar/action/compose',
      rru: 'addevent',
    });
  
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }
  
  /**
   * Generate Yahoo Calendar "Add Event" URL
   */
  export function getYahooCalendarUrl({ title, description, location, startDate, endDate }) {
    // Yahoo uses a different date format
    const formatYahooDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, '');
    };
  
    // Calculate duration in hours and minutes
    const durationMs = endDate - startDate;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`;
  
    const params = new URLSearchParams({
      v: '60',
      title: title,
      st: formatYahooDate(startDate),
      dur: duration,
      desc: description || '',
      in_loc: location || '',
    });
  
    return `https://calendar.yahoo.com/?${params.toString()}`;
  }
  
  /**
   * Generate ICS file download URL
   */
  export function getICSDownloadUrl(eventId, appUrl) {
    return `${appUrl}/api/calendar/${eventId}`;
  }
  
  /**
   * Generate all calendar links for an event
   */
  export function getAllCalendarLinks({ eventId, title, description, location, startDate, endDate, appUrl }) {
    // Default end date: 1.5 hours after start
    const end = endDate || new Date(startDate.getTime() + 90 * 60 * 1000);
  
    return {
      google: getGoogleCalendarUrl({ title, description, location, startDate, endDate: end }),
      outlook: getOutlookCalendarUrl({ title, description, location, startDate, endDate: end }),
      yahoo: getYahooCalendarUrl({ title, description, location, startDate, endDate: end }),
      ics: getICSDownloadUrl(eventId, appUrl),
    };
  }