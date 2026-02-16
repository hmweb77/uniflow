// src/app/lib/brevo.js
// Email service using Brevo (formerly Sendinblue)
// Updated: Professional templates, no emojis, sober design

const BREVO_API_URL = 'https://api.brevo.com/v3';

/**
 * Send a transactional email via Brevo
 */
export async function sendEmail({ to, subject, htmlContent, textContent }) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.error('[BREVO] API key not configured');
    throw new Error('BREVO_API_KEY environment variable is not set');
  }

  const senderName = process.env.EMAIL_SENDER_NAME || 'Uniflow';
  const senderEmail = process.env.EMAIL_SENDER_ADDRESS || 'uniflow.escp@gmail.com';

  console.log('[BREVO] Sending email to:', to);
  console.log('[BREVO] Subject:', subject);
  console.log('[BREVO] From:', `${senderName} <${senderEmail}>`);

  const payload = {
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent,
  };

  try {
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[BREVO] Response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }
      console.error('[BREVO] API error:', errorData);
      throw new Error(errorData.message || `Brevo API error: ${response.status}`);
    }

    const result = JSON.parse(responseText);
    console.log('[BREVO] Email sent successfully, messageId:', result.messageId);
    return result;
  } catch (err) {
    console.error('[BREVO] Send email error:', err);
    throw err;
  }
}

/**
 * Add or update a contact in Brevo
 */
export async function addContactToBrevo({
  email,
  firstName,
  lastName,
  eventDate,
  eventTitle,
  meetingLink,
  eventId,
  ticketType,
  campus,
  listId = 10,
}) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.error('[BREVO] API key not configured for contacts');
    throw new Error('BREVO_API_KEY not set');
  }

  let formattedDate = '';
  if (eventDate) {
    const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
    formattedDate = date.toISOString().split('T')[0];
  }

  const contactData = {
    email,
    attributes: {
      FIRSTNAME: firstName || '',
      LASTNAME: lastName || '',
      EVENT_DATE: formattedDate,
      EVENT_TITLE: eventTitle || '',
      MEETING_LINK: meetingLink || '',
      EVENT_ID: eventId || '',
      TICKET_TYPE: ticketType || '',
      CAMPUS: campus || '',
    },
    listIds: [listId],
    updateEnabled: true,
  };

  try {
    const response = await fetch(`${BREVO_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(contactData),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { message: responseText };
      }

      if (errorData.code === 'duplicate_parameter') {
        console.log('[BREVO] Contact already exists, updated');
        return true;
      }

      console.error('[BREVO] Contact API error:', errorData);
      throw new Error(errorData.message || 'Failed to add contact');
    }

    console.log('[BREVO] Contact added successfully');
    return true;
  } catch (err) {
    console.error('[BREVO] Add contact error:', err);
    throw err;
  }
}

/**
 * Professional confirmation email template - sober, no emojis
 */
export function getConfirmationEmailTemplate({
  customerName = 'Student',
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  meetingLink,
  ticketName,
  locale = 'en',
}) {
  const isEnglish = locale === 'en';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uniflow.com';

  const calendarIcsUrl = `${appUrl}/api/calendar/${eventId}`;
  const calendarGoogleUrl = `${appUrl}/api/calendar/redirect/${eventId}?provider=google`;
  const calendarOutlookUrl = `${appUrl}/api/calendar/redirect/${eventId}?provider=outlook`;

  const subject = isEnglish
    ? `Registration confirmed: ${eventTitle}`
    : `Inscription confirmee: ${eventTitle}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f7;">
  
  <!-- Header -->
  <div style="background-color: #1a1a2e; padding: 32px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.3px;">
      ${isEnglish ? 'Registration Confirmed' : 'Inscription Confirmee'}
    </h1>
  </div>
  
  <!-- Body -->
  <div style="background: #ffffff; padding: 36px 30px; border-bottom: 1px solid #e8e8ed;">
    <p style="font-size: 16px; margin: 0 0 20px 0; color: #1a1a2e;">
      ${isEnglish ? `Hello ${customerName},` : `Bonjour ${customerName},`}
    </p>
    
    <p style="font-size: 15px; color: #48485c; margin: 0 0 24px 0;">
      ${isEnglish
        ? `Your registration for <strong style="color: #1a1a2e;">${eventTitle}</strong> has been confirmed.`
        : `Votre inscription pour <strong style="color: #1a1a2e;">${eventTitle}</strong> est confirmee.`
      }
    </p>
    
    ${ticketName && ticketName !== 'General Admission'
      ? `<p style="font-size: 14px; color: #48485c; margin: 0 0 24px 0;">Ticket: <strong>${ticketName}</strong></p>`
      : ''
    }
    
    <!-- Event Details Card -->
    <div style="background: #f5f5f7; border-radius: 8px; padding: 24px; margin: 0 0 24px 0; border: 1px solid #e8e8ed;">
      <h2 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #48485c; text-transform: uppercase; letter-spacing: 0.5px;">
        ${isEnglish ? 'Event Details' : "Details de l'evenement"}
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6e6e80; font-size: 14px; width: 80px; vertical-align: top;">${isEnglish ? 'Event' : 'Cours'}</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1a1a2e; font-size: 14px;">${eventTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6e6e80; font-size: 14px; vertical-align: top;">Date</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1a1a2e; font-size: 14px;">${eventDate}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6e6e80; font-size: 14px; vertical-align: top;">${isEnglish ? 'Time' : 'Heure'}</td>
          <td style="padding: 6px 0; font-weight: 600; color: #1a1a2e; font-size: 14px;">${eventTime}</td>
        </tr>
      </table>
    </div>
    
    <!-- Meeting Link -->
    ${meetingLink ? `
    <div style="text-align: center; margin: 0 0 24px 0;">
      <p style="color: #48485c; margin: 0 0 12px 0; font-size: 14px;">
        ${isEnglish ? 'Your class access link:' : "Votre lien d'acces au cours :"}
      </p>
      <a href="${meetingLink}" style="display: inline-block; background-color: #1a1a2e; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${isEnglish ? 'Join Class' : 'Rejoindre le cours'}
      </a>
      <p style="color: #6e6e80; margin: 12px 0 0 0; font-size: 12px;">
        ${isEnglish ? "Save this link. You will need it to join." : 'Conservez ce lien, vous en aurez besoin.'}
      </p>
    </div>
    ` : `
    <div style="background: #fff8e6; border-radius: 6px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #f0e0b0;">
      <p style="color: #7a6520; margin: 0; font-size: 14px;">
        ${isEnglish
          ? 'The class link will be sent separately before the event.'
          : "Le lien du cours sera envoye separement avant l'evenement."
        }
      </p>
    </div>
    `}
    
    <!-- Calendar Links -->
    <div style="background: #f0f7f0; border-radius: 6px; padding: 16px; margin: 0 0 24px 0; border: 1px solid #d4e8d4;">
      <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #2d5a2d;">
        ${isEnglish ? 'Add to your calendar' : 'Ajouter a votre calendrier'}
      </p>
      <div>
        <a href="${calendarGoogleUrl}" style="display: inline-block; background: #ffffff; color: #1a1a2e; padding: 6px 14px; border-radius: 4px; text-decoration: none; font-size: 13px; border: 1px solid #d4e8d4; margin-right: 6px; margin-bottom: 6px;">Google</a>
        <a href="${calendarOutlookUrl}" style="display: inline-block; background: #ffffff; color: #1a1a2e; padding: 6px 14px; border-radius: 4px; text-decoration: none; font-size: 13px; border: 1px solid #d4e8d4; margin-right: 6px; margin-bottom: 6px;">Outlook</a>
        <a href="${calendarIcsUrl}" style="display: inline-block; background: #ffffff; color: #1a1a2e; padding: 6px 14px; border-radius: 4px; text-decoration: none; font-size: 13px; border: 1px solid #d4e8d4; margin-bottom: 6px;">${isEnglish ? 'Download .ics' : 'Telecharger .ics'}</a>
      </div>
    </div>

    <!-- Spam Notice -->
    <div style="background: #f5f5f7; border-radius: 6px; padding: 14px; margin: 0 0 8px 0; text-align: center;">
      <p style="color: #6e6e80; font-size: 13px; margin: 0;">
        ${isEnglish
          ? 'Did not receive this email? Please check your spam or junk folder.'
          : "Vous n'avez pas recu cet email ? Verifiez votre dossier spam ou courrier indesirable."
        }
      </p>
    </div>
  </div>
  
  <!-- Footer -->
  <div style="text-align: center; padding: 24px; color: #6e6e80; font-size: 12px;">
    <p style="margin: 0 0 4px 0;">Uniflow</p>
    <p style="margin: 0;">
      ${isEnglish
        ? 'You received this email because you registered for an event.'
        : "Vous avez recu cet email suite a votre inscription a un evenement."
      }
    </p>
  </div>
</body>
</html>
  `;

  const textContent = isEnglish
    ? `Registration Confirmed\n\nHello ${customerName},\n\nYour registration for ${eventTitle} has been confirmed.\n${ticketName ? `Ticket: ${ticketName}\n` : ''}\nEvent Details:\nDate: ${eventDate}\nTime: ${eventTime}\n\n${meetingLink ? `Access your class: ${meetingLink}` : 'The class link will be sent before the event.'}\n\nAdd to calendar:\nGoogle: ${calendarGoogleUrl}\nDownload .ics: ${calendarIcsUrl}\n\nDid not receive this email? Check your spam folder.\n\nUniflow`
    : `Inscription Confirmee\n\nBonjour ${customerName},\n\nVotre inscription pour ${eventTitle} est confirmee.\n${ticketName ? `Billet: ${ticketName}\n` : ''}\nDetails:\nDate: ${eventDate}\nHeure: ${eventTime}\n\n${meetingLink ? `Acces au cours: ${meetingLink}` : "Le lien sera envoye avant l'evenement."}\n\nAjouter au calendrier:\nGoogle: ${calendarGoogleUrl}\nTelecharger .ics: ${calendarIcsUrl}\n\nVous n'avez pas recu cet email ? Verifiez votre dossier spam.\n\nUniflow`;

  return { subject, htmlContent, textContent };
}

/**
 * Thank-you / post-event email template
 */
export function getThankYouEmailTemplate({
  customerName = 'Student',
  eventTitle,
  feedbackFormUrl,
  locale = 'en',
}) {
  const isEnglish = locale === 'en';

  const subject = isEnglish
    ? `Thank you for attending: ${eventTitle}`
    : `Merci d'avoir participe : ${eventTitle}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f7;">
  
  <div style="background-color: #1a1a2e; padding: 32px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">
      ${isEnglish ? 'Thank You for Attending' : 'Merci pour votre participation'}
    </h1>
  </div>
  
  <div style="background: #ffffff; padding: 36px 30px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">
      ${isEnglish ? `Hello ${customerName},` : `Bonjour ${customerName},`}
    </p>
    
    <p style="font-size: 15px; color: #48485c; margin: 0 0 24px 0;">
      ${isEnglish
        ? `Thank you for attending <strong>${eventTitle}</strong>. We hope you found the session valuable.`
        : `Merci d'avoir participe a <strong>${eventTitle}</strong>. Nous esperons que la session vous a ete utile.`
      }
    </p>
    
    ${feedbackFormUrl ? `
    <div style="background: #f5f5f7; border-radius: 8px; padding: 24px; margin: 0 0 24px 0; text-align: center; border: 1px solid #e8e8ed;">
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #1a1a2e; font-weight: 600;">
        ${isEnglish ? 'Your feedback matters' : 'Votre avis compte'}
      </p>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #48485c;">
        ${isEnglish
          ? 'Help us improve by sharing your experience.'
          : 'Aidez-nous a nous ameliorer en partageant votre experience.'
        }
      </p>
      <a href="${feedbackFormUrl}" style="display: inline-block; background-color: #1a1a2e; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${isEnglish ? 'Share Feedback' : 'Donner mon avis'}
      </a>
    </div>
    ` : ''}
    
    <p style="font-size: 14px; color: #6e6e80;">
      ${isEnglish ? 'Best regards,' : 'Cordialement,'}
      <br>
      ${isEnglish ? 'The Uniflow Team' : "L'equipe Uniflow"}
    </p>
  </div>
  
  <div style="text-align: center; padding: 24px; color: #6e6e80; font-size: 12px;">
    <p style="margin: 0;">Uniflow</p>
  </div>
</body>
</html>
  `;

  return { subject, htmlContent };
}

/**
 * 24-hour reminder template - professional, no emojis
 */
export function get24HourReminderTemplate({
  customerName = 'Student',
  eventTitle,
  eventDate,
  eventTime,
  meetingLink,
  locale = 'en',
}) {
  const isEnglish = locale === 'en';

  const subject = isEnglish
    ? `Reminder: ${eventTitle} is tomorrow`
    : `Rappel : ${eventTitle} c'est demain`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f7;">
  
  <div style="background-color: #1a1a2e; padding: 32px 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">
      ${isEnglish ? 'Event Reminder' : 'Rappel'}
    </h1>
  </div>
  
  <div style="background: #ffffff; padding: 36px 30px;">
    <p style="font-size: 16px; margin: 0 0 20px 0;">
      ${isEnglish ? `Hello ${customerName},` : `Bonjour ${customerName},`}
    </p>
    
    <p style="font-size: 15px; color: #48485c; margin: 0 0 24px 0;">
      ${isEnglish
        ? `This is a reminder that <strong>${eventTitle}</strong> is taking place tomorrow.`
        : `Rappel : <strong>${eventTitle}</strong> a lieu demain.`
      }
    </p>
    
    <div style="background: #f5f5f7; border-radius: 8px; padding: 20px; margin: 0 0 24px 0; border: 1px solid #e8e8ed;">
      <p style="margin: 0; font-size: 15px; color: #1a1a2e; font-weight: 600;">
        ${eventDate} ${isEnglish ? 'at' : 'a'} ${eventTime}
      </p>
    </div>
    
    ${meetingLink ? `
    <div style="text-align: center; margin: 0 0 24px 0;">
      <a href="${meetingLink}" style="display: inline-block; background-color: #1a1a2e; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
        ${isEnglish ? 'Save Your Class Link' : 'Gardez votre lien'}
      </a>
    </div>
    ` : ''}
    
    <p style="font-size: 14px; color: #6e6e80;">
      ${isEnglish
        ? 'Make sure to be ready a few minutes before the class starts.'
        : "Assurez-vous d'etre pret quelques minutes avant le debut du cours."
      }
    </p>
  </div>
  
  <div style="text-align: center; padding: 24px; color: #6e6e80; font-size: 12px;">
    <p style="margin: 0;">Uniflow</p>
  </div>
</body>
</html>
  `;

  return { subject, htmlContent };
}
