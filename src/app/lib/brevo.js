// src/app/lib/brevo.js
// Email service using Brevo (formerly Sendinblue)

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
  const senderEmail = process.env.EMAIL_SENDER_ADDRESS || 'noreply@uniflow.com';

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
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[BREVO] Response status:', response.status);
    console.log('[BREVO] Response body:', responseText);

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
  listId = 10,
}) {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey) {
    console.error('[BREVO] API key not configured for contacts');
    throw new Error('BREVO_API_KEY not set');
  }

  // Format date for Brevo (YYYY-MM-DD)
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
    },
    listIds: [listId],
    updateEnabled: true,
  };

  console.log('[BREVO] Adding contact:', email);

  try {
    const response = await fetch(`${BREVO_API_URL}/contacts`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
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
      
      // Ignore duplicate contact errors
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
 * Email template for event confirmation
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
    ? `🎓 Your registration for ${eventTitle}`
    : `🎓 Votre inscription pour ${eventTitle}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
      ${isEnglish ? '🎉 Registration Confirmed!' : '🎉 Inscription confirmée !'}
    </h1>
  </div>
  
  <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <p style="font-size: 18px; margin-bottom: 24px;">
      ${isEnglish ? `Hi <strong>${customerName}</strong>,` : `Bonjour <strong>${customerName}</strong>,`}
    </p>
    
    <p style="font-size: 16px; color: #4b5563;">
      ${isEnglish
        ? `Thank you for registering! Your spot for <strong>${eventTitle}</strong> is confirmed.`
        : `Merci pour votre inscription ! Votre place pour <strong>${eventTitle}</strong> est confirmée.`
      }
    </p>
    
    ${ticketName && ticketName !== 'General Admission'
      ? `<p style="font-size: 14px; color: #6b7280;">🎫 ${isEnglish ? 'Ticket' : 'Billet'}: <strong>${ticketName}</strong></p>`
      : ''
    }
    
    <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #667eea;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #374151;">
        ${isEnglish ? '📅 Event Details' : "📅 Détails de l'événement"}
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 100px;">${isEnglish ? 'Event:' : 'Événement :'}</td>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">${eventTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">${isEnglish ? 'Date:' : 'Date :'}</td>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">${eventDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">${isEnglish ? 'Time:' : 'Heure :'}</td>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">${eventTime}</td>
        </tr>
      </table>
    </div>
    
    ${meetingLink ? `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0 0 16px 0; font-size: 16px;">
        ${isEnglish ? '🔗 Your class access link:' : "🔗 Votre lien d'accès au cours :"}
      </p>
      <a href="${meetingLink}" style="display: inline-block; background: white; color: #667eea; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        ${isEnglish ? 'Join Class →' : 'Rejoindre le cours →'}
      </a>
      <p style="color: rgba(255,255,255,0.7); margin: 16px 0 0 0; font-size: 12px;">
        ${isEnglish ? "Save this link - you'll need it to join!" : 'Conservez ce lien - vous en aurez besoin !'}
      </p>
    </div>
    ` : `
    <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #fcd34d;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        ⚠️ ${isEnglish
          ? 'The class link will be sent separately before the event.'
          : "Le lien du cours sera envoyé séparément avant l'événement."
        }
      </p>
    </div>
    `}
    
    <!-- Calendar Section -->
    <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #bbf7d0;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #166534;">
        📅 ${isEnglish ? "Don't forget! Add to your calendar:" : 'Ne manquez pas ! Ajoutez à votre calendrier :'}
      </h3>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="${calendarGoogleUrl}" style="display: inline-block; background: white; color: #4285f4; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; border: 1px solid #e5e7eb;">
          📆 Google
        </a>
        <a href="${calendarOutlookUrl}" style="display: inline-block; background: white; color: #0078d4; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; border: 1px solid #e5e7eb;">
          📧 Outlook
        </a>
        <a href="${calendarIcsUrl}" style="display: inline-block; background: white; color: #374151; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; border: 1px solid #e5e7eb;">
          ⬇️ ${isEnglish ? 'Download .ics' : 'Télécharger .ics'}
        </a>
      </div>
    </div>
    
    <div style="border-top: 1px solid #e5e7eb; margin-top: 32px; padding-top: 24px;">
      <p style="color: #6b7280; font-size: 14px; margin: 0;">
        ${isEnglish
          ? "💡 <strong>Tip:</strong> Add this event to your calendar so you don't miss it!"
          : '💡 <strong>Conseil :</strong> Ajoutez cet événement à votre calendrier !'
        }
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0 0 8px 0;">Uniflow - ${isEnglish ? 'Learn without limits' : 'Apprenez sans limites'}</p>
    <p style="margin: 0;">
      ${isEnglish
        ? 'You received this email because you registered for an event.'
        : "Vous avez reçu cet email car vous vous êtes inscrit à un événement."
      }
    </p>
  </div>
</body>
</html>
  `;

  const textContent = isEnglish
    ? `Registration Confirmed!\n\nHi ${customerName},\n\nThank you for registering for ${eventTitle}.\n${ticketName ? `Ticket: ${ticketName}\n` : ''}\nEvent Details:\nDate: ${eventDate}\nTime: ${eventTime}\n\n${meetingLink ? `Access your online class: ${meetingLink}` : 'The class link will be sent before the event.'}\n\nAdd to your calendar:\nGoogle: ${calendarGoogleUrl}\nDownload .ics: ${calendarIcsUrl}\n\nSee you there!\nUniflow`
    : `Inscription confirmée !\n\nBonjour ${customerName},\n\nMerci de vous être inscrit(e) pour ${eventTitle}.\n${ticketName ? `Billet: ${ticketName}\n` : ''}\nDétails de l'événement:\nDate: ${eventDate}\nHeure: ${eventTime}\n\n${meetingLink ? `Accédez à votre cours: ${meetingLink}` : "Le lien du cours sera envoyé avant l'événement."}\n\nAjoutez à votre calendrier:\nGoogle: ${calendarGoogleUrl}\nTélécharger .ics: ${calendarIcsUrl}\n\nÀ bientôt !\nUniflow`;

  return { subject, htmlContent, textContent };
}

/**
 * Email template for 24-hour reminder
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
    ? `⏰ Reminder: ${eventTitle} is tomorrow!`
    : `⏰ Rappel: ${eventTitle} c'est demain !`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
      ${isEnglish ? '⏰ 24 Hours to Go!' : '⏰ Plus que 24 heures !'}
    </h1>
  </div>
  
  <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
    <p style="font-size: 18px; margin-bottom: 24px;">
      ${isEnglish ? `Hi ${customerName},` : `Bonjour ${customerName},`}
    </p>
    
    <p style="font-size: 16px; color: #4b5563;">
      ${isEnglish
        ? `Just a friendly reminder that <strong>${eventTitle}</strong> is happening tomorrow!`
        : `Petit rappel : <strong>${eventTitle}</strong> c'est demain !`
      }
    </p>
    
    <div style="background: #fef3c7; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; font-size: 16px; color: #92400e;">
        📅 <strong>${eventDate}</strong> ${isEnglish ? 'at' : 'à'} <strong>${eventTime}</strong>
      </p>
    </div>
    
    ${meetingLink ? `
    <div style="text-align: center; margin: 24px 0;">
      <a href="${meetingLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
        ${isEnglish ? '🔗 Save Your Class Link' : '🔗 Gardez votre lien'}
      </a>
    </div>
    ` : ''}
    
    <p style="color: #6b7280; font-size: 14px;">
      ${isEnglish
        ? "Make sure to be ready a few minutes before the class starts!"
        : "Assurez-vous d'être prêt quelques minutes avant le début du cours !"
      }
    </p>
  </div>
  
  <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">Uniflow - ${isEnglish ? 'Learn without limits' : 'Apprenez sans limites'}</p>
  </div>
</body>
</html>
  `;

  return { subject, htmlContent };
}