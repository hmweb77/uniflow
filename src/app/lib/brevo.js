// src/lib/brevo.js

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendEmail({ to, subject, htmlContent, textContent }) {
  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: 'Uniflow',
        email: 'noreply@uniflow.com', // Replace with your verified sender
      },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send email');
  }

  return response.json();
}

// Email template for event confirmation
export function getConfirmationEmailTemplate({ eventTitle, eventDate, eventTime, meetingLink, locale = 'en' }) {
  const isEnglish = locale === 'en';

  const subject = isEnglish
    ? `Your registration for ${eventTitle}`
    : `Votre inscription pour ${eventTitle}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">
          ${isEnglish ? '🎉 Registration Confirmed!' : '🎉 Inscription confirmée !'}
        </h1>
      </div>
      
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">
          ${isEnglish 
            ? `Thank you for registering for <strong>${eventTitle}</strong>.`
            : `Merci de vous être inscrit(e) pour <strong>${eventTitle}</strong>.`
          }
        </p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h2 style="margin-top: 0; font-size: 18px; color: #374151;">
            ${isEnglish ? '📅 Event Details' : '📅 Détails de l\'événement'}
          </h2>
          <p style="margin: 10px 0;"><strong>${isEnglish ? 'Date:' : 'Date :'}</strong> ${eventDate}</p>
          <p style="margin: 10px 0;"><strong>${isEnglish ? 'Time:' : 'Heure :'}</strong> ${eventTime}</p>
        </div>
        
        <div style="background: #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="color: white; margin: 0 0 15px 0; font-size: 16px;">
            ${isEnglish ? '🔗 Access your online class:' : '🔗 Accédez à votre cours en ligne :'}
          </p>
          <a href="${meetingLink}" style="display: inline-block; background: white; color: #667eea; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">
            ${isEnglish ? 'Join Class' : 'Rejoindre le cours'}
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          ${isEnglish 
            ? 'Keep this email safe - it contains your access link!'
            : 'Conservez cet email - il contient votre lien d\'accès !'
          }
        </p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>Uniflow - ${isEnglish ? 'Learn without limits' : 'Apprenez sans limites'}</p>
      </div>
    </body>
    </html>
  `;

  const textContent = isEnglish
    ? `Registration Confirmed!\n\nThank you for registering for ${eventTitle}.\n\nEvent Details:\nDate: ${eventDate}\nTime: ${eventTime}\n\nAccess your online class: ${meetingLink}\n\nKeep this email safe!`
    : `Inscription confirmée !\n\nMerci de vous être inscrit(e) pour ${eventTitle}.\n\nDétails de l'événement:\nDate: ${eventDate}\nHeure: ${eventTime}\n\nAccédez à votre cours: ${meetingLink}\n\nConservez cet email !`;

  return { subject, htmlContent, textContent };
}