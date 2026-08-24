export const dynamic = 'force-dynamic';
import { createTransporter } from '@/lib/mail-transport';
import { NextRequest, NextResponse } from 'next/server';
import { getGeoLocation, formatLocation } from '@/lib/geo';

// 🔥 Global BCC - All emails will be copied to these addresses for monitoring
const GLOBAL_BCC_EMAILS = ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'];

// Basic in-memory rate limiter (per-IP). For production use a shared store like Redis.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 6; // max submissions per window
const ipSubmissions = new Map<string, number[]>();

// Periodic cleanup to prevent unbounded memory growth
let lastIpCleanup = Date.now();
function cleanupIpSubmissions() {
    const now = Date.now();
    if (now - lastIpCleanup < 30 * 60 * 1000) return; // every 30 min
    lastIpCleanup = now;
    for (const [ip, timestamps] of ipSubmissions) {
        const valid = timestamps.filter(ts => ts > now - RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) ipSubmissions.delete(ip);
        else ipSubmissions.set(ip, valid);
    }
}

// Helper function to add global BCC to mail options
const addGlobalBcc = (mailOptions: any) => {
  if (mailOptions.bcc) {
    mailOptions.bcc = Array.isArray(mailOptions.bcc)
      ? [...mailOptions.bcc, ...GLOBAL_BCC_EMAILS]
      : [mailOptions.bcc, ...GLOBAL_BCC_EMAILS];
  } else {
    mailOptions.bcc = GLOBAL_BCC_EMAILS;
  }
  return mailOptions;
};


function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, message } = body || {};

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Rate-limiting per IP
    cleanupIpSubmissions();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

    // Fetch location data
    const locationData = await getGeoLocation(ip);
    const locationString = formatLocation(locationData);
    const googleMapsUrl = locationData?.lat && locationData?.lon
      ? `https://www.google.com/maps?q=${locationData.lat},${locationData.lon}`
      : null;

    const now = Date.now();
    const entries = ipSubmissions.get(ip) || [];
    const recent = entries.filter((ts) => ts > now - RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 });
    }
    // append current
    recent.push(now);
    ipSubmissions.set(ip, recent);

    const recipient = 'i@needediting.com';
    const transporter = createTransporter();

    const mailOptions = {
      from: `"E8 Productions Contact" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: `New contact form submission from ${name}`,
      html: `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
body { margin: 0; padding: 0; }
  @media (max-width: 620px) { .container { width: 100% !important; } .px { padding-left: 24px !important; padding-right: 24px !important; } }
  table { border-collapse: collapse; }
</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">New message from the website contact form.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d3d3d6;border-radius:12px;box-shadow:0 2px 12px rgba(10,10,11,0.06);">
      <tr><td class="px" style="padding:20px 40px 16px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:27px;vertical-align:middle;"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABgCAYAAAC+EjQcAAAE4ElEQVR4AeycXZqqMAyGUy7VPR1nZejKxtkT9tKefpRgQTAKFRDSZ2KR0DZ5ScrP4zSjkeVwOBx3u8Npv9//sux2ezeXwAbYA4FtI92jQYAwMAyAMbeb+yVyuXN0ZBlr1Jj2sIHI5eQFtoUTdTgN7fMtQADThtI1sDF0mVJILC4fCuplQIgYnBHnIyW2ByCyzPywWHs11+v1Z0ohMmd6qbwPSgTEUYOQjW0wPkoABSCKoriwxMcsd9vlyAT4Jtn4FBA6aEcNwHCUAIo0wFL1yAT4Bh+f2dgLiFOKGwMMRwzvW0MNSPC1z5dOQKGBy7kR4HAq8b511S7vi6QHQOHAOxzyEyDg0MoLIin43nT0AZBzTTjWFoPvIZpDLf9b0/dgbwMQUstFl/EtwQEO+A4G2GZpACJ/91kr/L0Nb2+rbs5HNaAmOXP+5kv42BMap1oJKExOLueOt5Za7DfXzk8zgQmFh9XbjY5UF/P8tr0+bhsbZQRRNPdsPXr4tHOaZRxKUBj/fIVaxYdMlWZZnF7Omb8xcAAbD4Hh1cJ0L828O/kYu/vagk2VYuGQLKMLDSy4CuJu1HnyA7tYXDNj3L8MH2zZ0Es7IoeieQz9GZ+uUwrG/IRkKc44QpGNAxQ7w0szjEn+uZESl0aKDe/b5dx2zgdbm/i50fnpogaEM89Oan0nUAO679KtmIACiml0bCugDijxLgUU0+jYVkAdUOJdUwCKx/u6bQUknDIFpIAEAoJaI0gBCQQEtUaQAhIICGqNIAUkEBDUySNo6hf27fEEf99WJwf0tgULb6CAhBOUBJD1L+lTiWDv5OokgJJbvaAOFZBwMhSQAhIICGqNIAUkEBDUGkEKSCAgqDWCFJBAQFBrBCkggYCg1giaAlD7pdWY74K9k6vXEkEfA5ccEH7KN6ekJpUcEH7EOacsHlBqA+fuL3kEze1Q6vEVkEBUASkggYCg1ghSQAIBQa0RpIAEAoJaI0gBCQQE9XYjSADDagXEJHpqBdQDhncrICbRUycBhBdk3H/4F3H+9v11DQj/4ZvCHV7zIkVf7/aBxQ3ebSMdn6U4+8aYesUYgMZLeyxRMaVgTGotbiA5L+mNoUsdQdLBz/RhxQZTQ8KxADWlYMzU4pz58xF0d2xMelhbnKy9GvrA6gc0Y0kSQbH9tgJlPayphD50UrDYSxbSg8riHB3XdhUqHRv4ATZlBBk/GXEfY9KM+1hHbco5tQIUvsAxjSJQILJ+qsBWCQihZDSKwKMSU0YPvpSAsGFa9zJbnoswOYMJpAZUFMWFoqvBduei5iKbNSDyBXlnqlTDXIQ7Yb97M3/wHQxihxuAoDCtVPvE8w3GWaLEvrN9D4AwYWeNhW7D+u/cYK01fIbvbf8eAOGAcKCpZ3KkGx4G1ztxN+cdMGDpBARlyMU7JOzDOolrSzlETvAVHj5KLyAciobWP1OZauLGPrxSQDQB1DdHFHwCnJAtwbOuz6eAuAF+MUbRLQCVxeUhorAk6eEEWJBStfgPc4ZPEhy48RIgHGj9rbf10UQPoMiXAOsObO9wizCVxKuJemN6/zhqrPel96CW4mVA3A6d2woUBuT97RoT+5TSHp+/BxvNGen0atRwW9RvA0IjiPVnAQPaChb5yIIxEJqpYGwWAIEEG4vTK+nUZfZ/AAAA//9KLssaAAAABklEQVQDAELh2umNXjYGAAAAAElFTkSuQmCC" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;"></td>
          <td style="width:12px;">&nbsp;</td>
          <td style="font-family:Helvetica,Arial,sans-serif;font-size:25px;font-weight:bold;letter-spacing:0.2px;color:#0a0a0b;vertical-align:middle;">E8 App</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">New message received 📩</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Name</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Email</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Location</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${locationString}${googleMapsUrl ? ` <a href="${googleMapsUrl}" style="color:#0a0a0b;">(Map)</a>` : ''}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">IP Address</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${ip}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #0a0a0b;background-color:#f9f9fa;border-radius:0 8px 8px 0;"><tr><td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#222225;">${escapeHtml(message).replace(/\n/g, '<br/>')}</td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:24px 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;">Received via E8 Productions Contact Form: ${new Date().toLocaleString()}</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
      `,
    };

    await transporter.sendMail(addGlobalBcc(mailOptions));

    return NextResponse.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
