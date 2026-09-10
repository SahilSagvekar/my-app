// Every send in this file goes through the notifications queue now — see
// src/lib/mail-transport.ts. Workers can't open raw SMTP sockets, so the
// actual send happens in e8-file-server (a real Node container); this
// file's ~24 functions are otherwise unchanged, since createTransporter()
// still returns an object with the same sendMail(mailOptions) shape.
import { createTransporter, isEmailConfigured } from '@/lib/mail-transport';
import { renderEmailShell } from '@/lib/email-shell';

// 🔥 Global BCC - All emails will be copied to these addresses for monitoring
const GLOBAL_BCC_EMAILS = ['sahilsagvekar230@gmail.com', 'eric@e8productions.com'];

// Helper function to add global BCC to mail options
const addGlobalBcc = (mailOptions: any) => {
  // Add BCC - if there's already a BCC, append to it
  if (mailOptions.bcc) {
    mailOptions.bcc = Array.isArray(mailOptions.bcc)
      ? [...mailOptions.bcc, ...GLOBAL_BCC_EMAILS]
      : [mailOptions.bcc, ...GLOBAL_BCC_EMAILS];
  } else {
    mailOptions.bcc = GLOBAL_BCC_EMAILS;
  }
  return mailOptions;
};


export async function sendMeetingNotesEmail(data: {
  to: string;
  cc?: string[];
  clientName: string;
  meetingDate: Date;
  pdfBuffer: Buffer;
  docTitle: string;
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [DEV] Meeting notes for ${data.clientName} would be sent to ${data.to}`);
    return { success: true, debug: true };
  }

  const dateLabel = data.meetingDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.to,
    cc: data.cc && data.cc.length > 0 ? data.cc : undefined,
    subject: `Meeting Notes — ${data.clientName} — ${dateLabel}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Meeting notes from your session with E8 Productions are attached.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Meeting notes are attached</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${data.clientName},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Attached are the notes from our meeting on <strong>${dateLabel}</strong>. Let us know if you have any questions.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">Attachment: ${data.docTitle}.pdf</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
    attachments: [
      {
        filename: `${data.docTitle}.pdf`,
        content: data.pdfBuffer,
      },
    ],
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Meeting notes email sent to ${data.to} (${data.clientName})`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send meeting notes email:`, error);
    return { success: false, error: (error as any).message };
  }
}

export async function sendOTPEmail(email: string, otp: string) {
  const transporter = createTransporter();

  // If no email configured, just log to console (development mode)
  if (!transporter) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL NOT CONFIGURED - Development Mode');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${email}`);
    console.log(`OTP: ${otp}`);
    console.log(`Expires: 10 minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return; // Don't throw error, just return
  }

  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Password Reset OTP - E8 Productions',
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your password reset code for E8 Productions.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Reset your password</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hello,</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">You requested to reset your password for your E8 Productions account. Enter this code to continue:</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#f4f4f5;border:1px dashed #c7c7cc;border-radius:8px;text-align:center;padding:20px;">
          <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0a0a0b;">${otp}</span>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">This code expires in 10 minutes. Don't share it with anyone. If you didn't request this, you can safely ignore this email.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error; // Re-throw so API can handle it
  }
}

export async function sendLoginOTPEmail(email: string, otp: string) {
  const transporter = createTransporter();

  // If no email configured, just log to console (development mode)
  if (!transporter) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL NOT CONFIGURED - Development Mode');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`To: ${email}`);
    console.log(`Login OTP: ${otp}`);
    console.log(`Expires: 10 minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return; // Don't throw error, just return
  }

  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your Login Verification Code - E8 Productions',
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your login verification code for E8 Productions.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Verify your login</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hello,</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Someone is signing in to your E8 Productions account. Enter this code to complete the login:</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#f4f4f5;border:1px dashed #c7c7cc;border-radius:8px;text-align:center;padding:20px;">
          <span style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0a0a0b;">${otp}</span>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">This code expires in 10 minutes. If you didn't try to log in, change your password immediately.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Login OTP email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send login OTP email:', error);
    throw error; // Re-throw so API can handle it
  }
}

export async function sendRawEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 EMAIL NOT CONFIGURED - Development Mode');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { success: true, debug: true };
  }

  try {
    await transporter.sendMail(addGlobalBcc({
      from: `"E8 Productions" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    }));
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return { success: false, error: (error as any).message };
  }
}


const transporter = createTransporter();

export async function sendWelcomeEmail({
  email,
  name,
  role,
  tempPassword,
}: {
  email: string;
  name: string;
  role: string;
  tempPassword: string;
}) {
  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Welcome to E8 Productions! 🎬',
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Welcome to E8 Productions — your account is ready.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Welcome to E8 Productions</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${name},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">We're excited to have you join the E8 Productions as a <strong>${role}</strong>. Your account has been created and you can now access the management system.</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Email</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:'Courier New',monospace;font-size:13px;color:#0a0a0b;">${email}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Temporary Password</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:'Courier New',monospace;font-size:13px;color:#0a0a0b;">${tempPassword}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Role</td><td style="padding:12px 16px;text-align:right;font-family:'Courier New',monospace;font-size:13px;color:#0a0a0b;">${role}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">This is a temporary password — you'll be prompted to set a new one on first login. Don't share these credentials with anyone.</td></tr>
      <tr><td class="px" align="center" style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${process.env.BASE_URLL || 'http://localhost:3000'}/dashboard" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Access Dashboard</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">This email was sent from the E8 App. If you believe you received it in error, contact your administrator.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC · e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log('Welcome email sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

// ============================================================================
// ROLE ASSIGNMENT NOTIFICATION
// ============================================================================
export async function sendRoleAssignedEmail(data: {
  email: string;
  name: string;
  newRole: string;
  previousRole?: string | null;
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [DEV] Role assigned: ${data.email} → ${data.newRole}`);
    return { success: true, debug: true };
  }

  const formatRole = (r: string) =>
    r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();

  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.email,
    subject: `Your role has been updated — ${formatRole(data.newRole)}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your role on the E8 Productions platform has been updated.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Your role has been updated 🔄</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${data.name},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Your role on the E8 Productions platform has been updated by an admin.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;"><tr><td style="padding:20px;text-align:center;">
          ${data.previousRole ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#a8a397;text-decoration:line-through;">${formatRole(data.previousRole)}</div>` : ''}
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;color:#0a0a0b;margin-top:4px;">${formatRole(data.newRole)}</div>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222225;">This may change what you see and what you're able to do on the dashboard. If anything looks off, log back in to refresh your access.</td></tr>
      <tr><td class="px" align="center" style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${process.env.BASE_URLL || process.env.BASE_URL || 'http://localhost:3000'}/dashboard" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Go to Dashboard</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">If you weren't expecting this change, please reach out to an admin.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC · e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Role assignment email sent to ${data.email} (${data.previousRole || '—'} → ${data.newRole})`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send role assignment email to ${data.email}:`, error);
    return { success: false, error };
  }
}

// Test email configuration
export async function testEmailConfig() {
  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
}

export async function sendActivityReportEmail(reportUrl: string, date: Date, logCount: number) {
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: `"E8 Productions Automation" <${process.env.SMTP_USER}>`,
    to: "Eric@e8productions.com",
    subject: `Daily Activity Report - ${formattedDate}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Daily activity report is ready.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Daily Activity Report 📊</td></tr>
      <tr><td class="px" style="padding:6px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b6b72;">Period: ${formattedDate} (up to 7:00 PM EST)</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi Eric, the daily activity report for the production team has been generated.</td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Total Actions Recorded</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;font-weight:bold;">${logCount}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Report Type</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">CSV Export</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 24px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${reportUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Download CSV Report</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">This is an automated report generated by the E8 App.</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Activity report email sent to Eric@e8productions.com`);
  } catch (error) {
    console.error('❌ Failed to send activity report email:', error);
  }
}

export async function sendCronReportEmail(data: {
  results: any[];
  timestamp: string;
}) {
  const mailOptions = {
    from: `"E8 Robot" <${process.env.SMTP_USER}>`,
    to: "sahilsagvekar230@GMAIL.COM",
    subject: `🤖 Daily Task Machine Report - ${new Date().toLocaleDateString()}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your Task Machine finished its morning run.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Hello Sahil</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Your Task Machine just finished its morning work. I woke up at ${new Date(data.timestamp).toLocaleTimeString()} and checked all our clients to make sure their schedules are ready.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:22px;font-weight:bold;color:#0a0a0b;">${data.results.reduce((acc, curr) => acc + (curr.created || 0), 0)}</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">New Tasks Made</div></td>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:22px;font-weight:bold;color:#0a0a0b;">${data.results.reduce((acc, curr) => acc + (curr.skipped || 0), 0)}</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">Clients Skipped</div></td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:14px;color:#0a0a0b;">Here is what I did:</td></tr>
      <tr><td class="px" style="padding:8px 40px 0 40px;">
        ${data.results.map(res => `
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.8;color:#222225;padding:8px 0;border-bottom:1px solid #f4f4f5;">
          <strong>${res.name}</strong>: ${res.created > 0 ? `I made ${res.created} new tasks!` : `I skipped this because ${res.skippedReason || 'the schedule is already full.'}`}
        </div>
        `).join('')}
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">Why did I do this? To make sure your editors have work ready for them and you don't have to click "Create" a hundred times.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">Sent automatically by the E8 Productions Robot &middot; ${data.timestamp}</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Cron report email sent to Sahil`);
  } catch (error) {
    console.error('❌ Failed to send cron report email:', error);
  }
}

export async function sendExecutiveSummaryReportEmail(data: {
  date: Date;
  stats: any[];
  summaryUrl: string;
}) {
  const formattedDate = data.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const mailOptions = {
    from: `"E8 Production Robot" <${process.env.SMTP_USER}>`,
    to: "Eric@e8productions.com",
    subject: `📊 Executive Production Summary - ${formattedDate}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Executive production summary for today.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Executive Production Summary 📊</td></tr>
      <tr><td class="px" style="padding:6px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b6b72;">Activity for ${formattedDate}</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hello, here is the simplified production report for today. You can see the high-level stats below or download the full summary file.</td></tr>
      <tr><td class="px" align="center" style="padding:20px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${data.summaryUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Download Summary CSV</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        ${data.stats.length === 0 ? `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#8a8a91;">No activity recorded for this period.</p>` : data.stats.map(user => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #0a0a0b;background-color:#f9f9fa;border-radius:0 8px 8px 0;margin-bottom:10px;"><tr><td style="padding:12px 16px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#0a0a0b;">${user.userName} (${user.role})</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6b72;margin-top:4px;">Started: ${user.inProgress} · Sent to QC: ${user.readyForQc} · Approved: ${user.approved} · Rejected: ${user.rejected} · Client Approved: ${user.clientApproved} · Client Revisions: ${user.clientRejected}</div>
        </td></tr></table>
        `).join('')}
      </td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">Automated Report by E8 App</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Executive summary report sent to Eric`);
  } catch (error) {
    console.error('❌ Failed to send executive summary report email:', error);
  }
}

export async function sendNasArchivalReportEmail(data: {
  month: string;
  results: {
    transferred: number;
    failed: number;
    totalSize: number;
    errors: string[];
    companyStats: Record<string, { count: number, size: number }>;
  };
  bucket: string;
  dryRun: boolean;
}) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const mailOptions = {
    from: `"E8 Archiver" <${process.env.SMTP_USER}>`,
    to: "sahilsagvekar230@gmail.com",
    subject: `📦 S3 → NAS Archive Report: ${data.month} ${data.dryRun ? '[DRY RUN]' : ''}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Monthly S3 to NAS archival report.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Monthly R2 → NAS Archive</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">The monthly archival process for <strong>${data.month}</strong> has completed.${data.dryRun ? ' [DRY RUN]' : ''}</td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Bucket</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.bucket}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Status</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;font-weight:bold;">${data.results.failed > 0 ? 'Completed with Errors' : 'Success'}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Files Transferred</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.results.transferred}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Total Data Moved</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${formatSize(data.results.totalSize)}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:14px;color:#0a0a0b;">Breakdown by Company</td></tr>
      <tr><td class="px" style="padding:8px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;overflow:hidden;">
          <tr style="background-color:#f4f4f5;"><td style="padding:8px 12px;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;text-transform:uppercase;">Company</td><td style="padding:8px 12px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;text-transform:uppercase;">Files</td><td style="padding:8px 12px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a8a91;text-transform:uppercase;">Size</td></tr>
          ${Object.entries(data.results.companyStats).map(([name, stats]) => `
          <tr><td style="padding:8px 12px;border-top:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#222225;">${name}</td><td style="padding:8px 12px;border-top:1px solid #e7e7e9;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#222225;">${stats.count}</td><td style="padding:8px 12px;border-top:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#222225;">${formatSize(stats.size)}</td></tr>
          `).join('')}
        </table>
      </td></tr>
      ${data.results.errors.length > 0 ? `<tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#b91c1c;"><strong>Errors encountered (${data.results.failed}):</strong><br>${data.results.errors.slice(0, 5).map(err => `${err}`).join('<br>')}${data.results.errors.length > 5 ? `<br>...and ${data.results.errors.length - 5} more` : ''}</td></tr>` : ''}
      <tr><td class="px" style="padding:16px 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">This report was generated automatically by the E8 App.</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ NAS Archival report email sent to Sahil`);
  } catch (error) {
    console.error('❌ Failed to send NAS archival report email:', error);
  }
}


export async function sendNewJobNotificationEmail(
  recipients: { email: string; name: string }[],
  jobDetails: { title: string; location: string; date: string; link: string }
) {
  const mailOptions = {
    from: `"E8 Jobs" <${process.env.SMTP_USER}>`,
    subject: `🎥 New Job Opportunity: ${jobDetails.title}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">A new videography job is open for bidding.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">New job posted</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hello Team,</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">A new videography job has been posted and is open for bidding.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #0a0a0b;background-color:#f9f9fa;border-radius:0 8px 8px 0;"><tr><td style="padding:14px 18px;">
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#0a0a0b;">${jobDetails.title}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;margin-top:6px;">Location: ${jobDetails.location || 'TBD'}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;margin-top:2px;">Date: ${jobDetails.date}</div>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222225;">Log in to the portal to view full details and submit your bid.</td></tr>
      <tr><td class="px" align="center" style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${jobDetails.link}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">View Job &amp; Bid</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions &middot; Videographer Portal</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `
  };

  // Send individually to each recipient to avoid exposing emails
  // Using Promise.all for parallel sending
  const promises = recipients.map(recipient => {
    const personalizedOptions = {
      ...mailOptions,
      to: recipient.email,
    };
    return transporter.sendMail(personalizedOptions).catch(err => {
      console.error(`Failed to send job notification to ${recipient.email}:`, err);
    });
  });

  try {
    await Promise.all(promises);
    console.log(`✅ Job notification sent to ${recipients.length} videographers.`);
  } catch (error) {
    console.error('❌ Error sending job notifications:', error);
  }
}

export async function sendBidAcceptedEmail(
  recipient: { email: string; name: string },
  jobDetails: { title: string; date: string; amount: number; link: string }
) {
  const mailOptions = {
    from: `"E8 Jobs" <${process.env.SMTP_USER}>`,
    to: recipient.email,
    subject: `🎉 Bid Accepted: ${jobDetails.title}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your bid has been accepted.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">You're hired</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${recipient.name},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Your bid for <strong>${jobDetails.title}</strong> has been accepted.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Job</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;font-weight:bold;">${jobDetails.title}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Date</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${jobDetails.date}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Approved Rate</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;font-weight:bold;">$${jobDetails.amount}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222225;">Please check the portal for further instructions regarding the shoot.</td></tr>
      <tr><td class="px" align="center" style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${jobDetails.link}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Open Job Details</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions &middot; Videographer Portal</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Bid accepted email sent to ${recipient.email}`);
  } catch (error) {
    console.error('❌ Failed to send bid acceptance email:', error);
  }
}
export async function sendScreenshotAlertEmail(data: {
  email: string | null;
  userAgent: string;
  ip: string;
  timestamp: string;
}) {
  const mailOptions = {
    from: `"E8 Security Alert" <${process.env.SMTP_USER}>`,
    to: "Eric@e8productions.com",
    subject: `🚨 Security Alert: Login Screen Screenshot Detected`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">A potential screenshot attempt was detected on the login screen.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Screenshot detected on login screen</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hello Admin,</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">A potential screenshot attempt was detected on the login screen by a user.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">User Email</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.email || 'Not provided'}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">IP Address</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.ip}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Device Info</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.userAgent}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Timestamp</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.timestamp}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">This is an automated security notification. If this activity is unexpected, please investigate further.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions Security System</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Screenshot alert email sent to Eric`);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send screenshot alert email:', error);
    return { success: false, error };
  }
}

// ============================================================================
// DAILY SUMMARY REPORT EMAIL
// ============================================================================
export async function sendDailySummaryReportEmail(report: {
  date: string;
  periodStart: string;
  periodEnd: string;
  users: any[];
  totalTasksMoved: number;
  totalTeamMembers: number;
}, csvDownloadUrl?: string) {
  const formattedDate = new Date(report.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Helper: Get role emoji
  const getRoleEmoji = (role: string) => {
    const r = role?.toLowerCase();
    if (r === 'editor') return '✂️';
    if (r === 'qc') return '🔍';
    if (r === 'scheduler') return '📅';
    if (r === 'client') return '👤';
    if (r === 'admin') return '🛡️';
    if (r === 'manager') return '📋';
    if (r === 'videographer') return '🎥';
    return '👤';
  };

  // Helper: Get role card border color
  const getRoleBorderColor = (role: string) => {
    const r = role?.toLowerCase();
    if (r === 'editor') return '#3b82f6';      // blue
    if (r === 'qc') return '#8b5cf6';          // purple
    if (r === 'scheduler') return '#f59e0b';   // amber
    if (r === 'client') return '#10b981';      // green
    if (r === 'admin') return '#ef4444';       // red
    if (r === 'manager') return '#06b6d4';     // cyan
    return '#6b7280';                           // gray
  };

  // Build user cards HTML
  const userCardsHtml = report.users.map(user => {
    const metrics: string[] = [];

    if (user.tasksMovedToInProgress > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #2563eb;">${user.tasksMovedToInProgress}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Started / In Progress</div>
        </div>
      `);
    }

    if (user.tasksMovedToReadyForQC > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #fefce8; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #ca8a04;">${user.tasksMovedToReadyForQC}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Sent to QC</div>
        </div>
      `);
    }

    if (user.tasksQCApproved > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #16a34a;">${user.tasksQCApproved}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">QC Approved</div>
        </div>
      `);
    }

    if (user.tasksQCRejected > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #dc2626;">${user.tasksQCRejected}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">QC Rejected</div>
        </div>
      `);
    }

    if (user.tasksScheduled > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #ea580c;">${user.tasksScheduled}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Scheduled / Posted</div>
        </div>
      `);
    }

    if (user.tasksClientApproved > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #059669;">${user.tasksClientApproved}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Client Approved</div>
        </div>
      `);
    }

    if (user.tasksClientRejected > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #dc2626;">${user.tasksClientRejected}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Client Revisions</div>
        </div>
      `);
    }

    if (user.filesUploaded > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #0284c7;">${user.filesUploaded}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Files Uploaded</div>
        </div>
      `);
    }

    if (user.tasksCreated > 0) {
      metrics.push(`
        <div style="display: inline-block; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 8px 14px; margin: 4px;">
          <div style="font-size: 22px; font-weight: 700; color: #7c3aed;">${user.tasksCreated}</div>
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Tasks Created</div>
        </div>
      `);
    }

    // Build login/logout timeline HTML
    let loginLogoutHtml = '';
    const events = user.loginLogoutEvents || [];
    if (events.length > 0) {
      const eventRows = events.map((evt: any) => {
        const icon = evt.action === 'login' ? '🟢' : '🔴';
        const label = evt.action === 'login' ? 'Logged In' : 'Logged Out';
        const timeStr = new Date(evt.time).toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const locationStr = evt.location ? ` — ${evt.location}` : '';
        return `<div style="padding: 4px 0; font-size: 13px; color: #475569;">${icon} <strong>${label}</strong> at ${timeStr} EST${locationStr}</div>`;
      }).join('');

      loginLogoutHtml = `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e2e8f0;">
          <div style="font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Session Activity</div>
          ${eventRows}
        </div>
      `;
    }

    const borderColor = getRoleBorderColor(user.role);
    const roleEmoji = getRoleEmoji(user.role);

    // Show "No task activity" message if user only has login/logout but no task metrics
    const hasTaskActivity = (user.tasksMovedToInProgress || 0) + (user.tasksMovedToReadyForQC || 0) +
      (user.tasksQCApproved || 0) + (user.tasksQCRejected || 0) + (user.tasksScheduled || 0) +
      (user.tasksClientApproved || 0) + (user.tasksClientRejected || 0) +
      (user.filesUploaded || 0) + (user.tasksCreated || 0) > 0;

    const noTaskActivityMsg = !hasTaskActivity && events.length > 0
      ? '<div style="text-align: center; color: #94a3b8; font-size: 13px; font-style: italic; padding: 8px 0;">No task activity — session only</div>'
      : '';

    return `
      <div style="background: #ffffff; border-radius: 10px; padding: 20px; margin-bottom: 16px; border-left: 5px solid ${borderColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <div style="margin-bottom: 12px;">
          <span style="font-size: 18px; font-weight: 700; color: #1e293b;">${roleEmoji} ${user.userName}</span>
          <span style="display: inline-block; background: ${borderColor}15; color: ${borderColor}; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; margin-left: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${user.role}</span>
        </div>
        <div style="text-align: center;">
          ${metrics.join('')}
        </div>
        ${noTaskActivityMsg}
        ${loginLogoutHtml}
      </div>
    `;
  }).join('');

  // No-activity message
  const noActivityHtml = report.users.length === 0
    ? '<p style="text-align: center; color: #94a3b8; font-style: italic; padding: 30px;">No task activity recorded for this period.</p>'
    : '';

  const mailOptions = {
    from: `"E8 Production Robot" <${process.env.SMTP_USER}>`,
    to: "Eric@e8productions.com",
    // to: "sahilsagvekar230@gmail.com",
    subject: `📋 Daily Team Summary - ${formattedDate}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Daily team activity summary.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Daily Team Summary 📝</td></tr>
      <tr><td class="px" style="padding:6px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b6b72;">${formattedDate} · Report Period: ${report.periodStart} → ${report.periodEnd}</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:22px;font-weight:bold;color:#0a0a0b;">${report.totalTeamMembers}</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">Active Team Members</div></td>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:22px;font-weight:bold;color:#0a0a0b;">${report.totalTasksMoved}</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">Total Task Actions</div></td>
        </tr></table>
      </td></tr>
      ${csvDownloadUrl ? `<tr><td class="px" align="center" style="padding:20px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${csvDownloadUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Download Full CSV Report</a>
        </td></tr></table>
      </td></tr>` : ''}
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        ${noActivityHtml}
        ${userCardsHtml}
      </td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">Automated Daily Report by E8 App</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Daily summary report sent to Eric@e8productions.com`);
  } catch (error) {
    console.error('❌ Failed to send daily summary report email:', error);
    throw error;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CLIENT REVIEW REMINDER — see src/lib/client-review-reminders.ts. The old
   version of this function lived here and was dead code (never called from
   anywhere); rebuilt from scratch as part of the Client Review Status &
   Reminder System, co-located with the rest of that feature instead.
───────────────────────────────────────────────────────────────────────────── */

// ============================================================================
// CONTRACT SIGNING EMAILS
// ============================================================================

export async function sendContractSigningInvite(data: {
  signerName: string;
  signerEmail: string;
  contractTitle: string;
  senderName: string;
  signingUrl: string;
  message?: string;
}) {
  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.signerEmail,
    subject: `✍️ Signature Requested: ${data.contractTitle}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">A document is waiting for your signature.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Signature requested</td></tr>
      <tr><td class="px" style="padding:6px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b6b72;">${data.senderName} has requested your signature</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${data.signerName}, <strong>${data.senderName}</strong> has sent you a document to review and sign:</td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #0a0a0b;background-color:#f9f9fa;border-radius:0 8px 8px 0;"><tr><td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#0a0a0b;">${data.contractTitle}</td></tr></table>
      </td></tr>
      ${data.message ? `<tr><td class="px" style="padding:14px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed #c7c7cc;border-radius:8px;"><tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#222225;"><strong>Message from sender:</strong><br>${data.message}</td></tr></table>
      </td></tr>` : ''}
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${data.signingUrl}" style="display:block;padding:14px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Review &amp; Sign Document</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;text-align:center;">This signing link is unique to you. Do not share it with others.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Contract signing invite sent to ${data.signerEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send signing invite to ${data.signerEmail}:`, error);
    throw error;
  }
}

export async function sendContractSignedNotification(data: {
  recipientEmail: string;
  recipientName: string;
  signerName: string;
  contractTitle: string;
}) {
  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.recipientEmail,
    subject: `✅ ${data.signerName} signed "${data.contractTitle}"`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">A signer has completed their signature.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Signature received</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${data.recipientName},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;"><strong>${data.signerName}</strong> has successfully signed the document <strong>"${data.contractTitle}"</strong>. Log in to your dashboard to view the contract status and track remaining signatures.</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard" style="display:block;padding:12px 28px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">View Contract</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Contract signed notification sent to ${data.recipientEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send signed notification:`, error);
  }
}

export async function sendContractCompletedEmail(data: {
  recipientEmail: string;
  recipientName: string;
  contractTitle: string;
  downloadUrl: string;
}) {
  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.recipientEmail,
    subject: `🎉 Contract Completed: ${data.contractTitle}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">All parties have signed your contract.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Contract completed</td></tr>
      <tr><td class="px" style="padding:6px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b6b72;">All parties have signed</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${data.recipientName}, great news — all signers have completed signing <strong>"${data.contractTitle}"</strong>. The fully signed document is now available for download in your dashboard.</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${data.downloadUrl}" style="display:block;padding:14px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Download Signed Contract</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;text-align:center;">A copy of this signed document has been stored securely.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Contract completed email sent to ${data.recipientEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send completed email:`, error);
  }
}

export async function sendContractReminderEmail(data: {
  signerName: string;
  signerEmail: string;
  contractTitle: string;
  senderName: string;
  signingUrl: string;
}) {
  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.signerEmail,
    subject: `⏰ Reminder: Please sign "${data.contractTitle}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
            <div style="background: linear-gradient(135deg, #92400e 0%, #f59e0b 100%); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">⏰ Signature Reminder</h1>
            </div>
            <div style="background: #ffffff; padding: 28px 30px; border-radius: 0 0 16px 16px;">
              <p>Hi ${data.signerName},</p>
              <p>This is a friendly reminder from <strong>${data.senderName}</strong> that the following document is still awaiting your signature:</p>
              <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0; color: #92400e;">${data.contractTitle}</h3>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${data.signingUrl}" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">Review & Sign Now</a>
              </div>
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">© ${new Date().getFullYear()} E8 Productions</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Contract reminder sent to ${data.signerEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send contract reminder:`, error);
    throw error;
  }
}

// ==========================================
// PAYMENT NOTIFICATION EMAILS
// ==========================================

const PAYMENTS_EMAIL = 'payments@e8productions.com';

interface PaymentNotificationData {
  type: 'invoice_sent' | 'invoice_paid' | 'payment_failed';
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  invoiceUrl?: string;
  pdfUrl?: string;
  failureReason?: string;
}

export async function sendPaymentNotificationEmail(data: PaymentNotificationData) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [DEV] Payment notification: ${data.type} for ${data.invoiceNumber}`);
    return;
  }

  const subjects: Record<string, string> = {
    invoice_sent: `Invoice ${data.invoiceNumber} sent to ${data.clientName}`,
    invoice_paid: `✅ Invoice ${data.invoiceNumber} paid by ${data.clientName}`,
    payment_failed: `❌ Payment failed for Invoice ${data.invoiceNumber}`,
  };

  const statusColors: Record<string, string> = {
    invoice_sent: '#3b82f6',
    invoice_paid: '#22c55e',
    payment_failed: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    invoice_sent: 'Invoice Sent',
    invoice_paid: 'Payment Received',
    payment_failed: 'Payment Failed',
  };

  const contentHtml = `
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">${statusLabels[data.type]}</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:28px;font-weight:bold;color:#0a0a0b;text-align:center;">$${data.amount.toFixed(2)}</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Invoice Number</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;font-weight:bold;">${data.invoiceNumber}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Client</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.clientName}</td></tr>
          <tr><td style="padding:12px 16px;${data.failureReason ? 'border-bottom:1px solid #e7e7e9;' : ''}font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Client Email</td><td style="padding:12px 16px;${data.failureReason ? 'border-bottom:1px solid #e7e7e9;' : ''}text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.clientEmail}</td></tr>
          ${data.failureReason ? `<tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Failure Reason</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#ef4444;">${data.failureReason}</td></tr>` : ''}
        </table>
      </td></tr>
      <tr><td class="px" align="center" style="padding:20px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          ${data.invoiceUrl ? `<td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b"><a href="${data.invoiceUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">View Invoice</a></td><td style="width:10px;">&nbsp;</td>` : ''}
          ${data.pdfUrl ? `<td style="background-color:#ffffff;border:1px solid #d3d3d6;text-align:center;border-radius:8px;"><a href="${data.pdfUrl}" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#0a0a0b;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Download PDF</a></td>` : ''}
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">Any questions or concerns on payment, email <a href="mailto:payments@e8productions.com" style="color:#0a0a0b;">payments@e8productions.com</a>.</td></tr>`;

  const mailOptions = {
    from: `"E8 Productions Billing" <${process.env.SMTP_USER}>`,
    to: PAYMENTS_EMAIL,
    subject: subjects[data.type],
    html: renderEmailShell({ previewText: 'Payment status update for an E8 invoice.', contentHtml }),
  };

  try {
    await transporter.sendMail(mailOptions); // No BCC needed, this IS the payment notification
    console.log(`✅ Payment notification (${data.type}) sent to ${PAYMENTS_EMAIL}`);
  } catch (error) {
    console.error(`❌ Failed to send payment notification:`, error);
  }
}

// ==========================================
// STORAGE ALERT EMAILS
// ==========================================

export async function sendStorageAlertEmail(data: {
  to: string[];
  clientName: string;
  percentage: number;
  used: string;
  limit: string;
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [DEV] Storage alert: ${data.percentage}% for ${data.clientName}`);
    return;
  }

  const isCritical = data.percentage >= 95;
  const color = isCritical ? '#ef4444' : '#f59e0b';
  const emoji = isCritical ? '🚨' : '⚠️';
  const urgency = isCritical ? 'Critical' : 'Warning';

  const mailOptions = {
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: data.to.join(', '),
    subject: `${emoji} Storage ${urgency}: ${data.percentage}% capacity reached - ${data.clientName}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your raw footage storage is approaching capacity.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Storage ${isCritical ? 'critical' : 'warning'}</td></tr>
      <tr><td class="px" style="padding:24px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${data.clientName},</td></tr>
      <tr><td class="px" style="padding:14px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Your raw footage storage has reached <strong>${data.percentage}%</strong> capacity.</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:middle;">
            <div style="background-color:#e7e7e9;border-radius:999px;height:10px;overflow:hidden;">
              <div style="background-color:#e11d1d;height:100%;width:${Math.min(data.percentage, 100)}%;"></div>
            </div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:18px;font-weight:bold;color:#0a0a0b;">${data.used}</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">Used</div></td>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:18px;font-weight:bold;color:#0a0a0b;">${data.limit}</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">Limit</div></td>
          <td style="text-align:center;font-family:Helvetica,Arial,sans-serif;"><div style="font-size:18px;font-weight:bold;color:#0a0a0b;">${data.percentage}%</div><div style="font-size:11px;color:#8a8a91;text-transform:uppercase;">Capacity</div></td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222225;">${isCritical ? 'Uploads will be blocked once you reach 100% capacity.' : 'Consider upgrading your plan or managing your files.'} To continue uploading without interruption, please upgrade your storage plan.</td></tr>
      <tr><td class="px" align="center" style="padding:28px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${process.env.BASE_URL || 'https://e8-app.vercel.app'}/settings/billing" style="display:block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Upgrade Storage Plan</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b6b72;">Need help? Contact us at support@e8productions.com</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Storage alert (${data.percentage}%) sent to ${data.to.join(', ')}`);
  } catch (error) {
    console.error(`❌ Failed to send storage alert:`, error);
  }
}

// ==========================================
// CLIENT FEEDBACK ("Report a Problem") EMAIL
// ==========================================

export async function sendClientFeedbackEmail(data: {
  clientName: string;
  userName: string;
  userEmail: string;
  message: string;
  pageUrl: string;
  userAgent: string;
  screenshotBase64: string | null; // data URL, e.g. "data:image/png;base64,...."
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`📧 [DEV] Client feedback from ${data.userName} (${data.clientName}): ${data.message || '(no message)'}`);
    return { success: true, debug: true };
  }

  const attachments = [];
  if (data.screenshotBase64) {
    const base64Data = data.screenshotBase64.replace(/^data:image\/\w+;base64,/, "");
    attachments.push({
      filename: "screenshot.jpg",
      content: base64Data,
      encoding: "base64" as const,
      cid: "feedback-screenshot",
    });
  }

  const mailOptions = {
    from: `"E8 Feedback" <${process.env.SMTP_USER}>`,
    to: "sahilsagvekar230@gmail.com",
    subject: `📸 Feedback from ${data.clientName} — ${data.userName}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">New feedback submitted from a client portal user.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">New feedback</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e7e7e9;border-radius:8px;">
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">From</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.clientName}</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Reported by</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.userName} (${data.userEmail})</td></tr>
          <tr><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Page</td><td style="padding:12px 16px;border-bottom:1px solid #e7e7e9;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.pageUrl}</td></tr>
          <tr><td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6b72;">Device</td><td style="padding:12px 16px;text-align:right;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#0a0a0b;">${data.userAgent}</td></tr>
        </table>
      </td></tr>
      <tr><td class="px" style="padding:16px 40px 0 40px;">
        ${data.message
          ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:2px solid #0a0a0b;background-color:#f9f9fa;border-radius:0 8px 8px 0;"><tr><td style="padding:14px 18px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#222225;white-space:pre-wrap;">${data.message}</td></tr></table>`
          : `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#8a8a91;">No message was included — just the screenshot.</p>`}
      </td></tr>
      ${data.screenshotBase64 ? `<tr><td class="px" style="padding:16px 40px 0 40px;"><img src="cid:feedback-screenshot" alt="Screenshot" style="width:100%;border-radius:8px;border:1px solid #e7e7e9;display:block;" /></td></tr>` : ''}
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
    `,
    attachments,
  };

  try {
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Client feedback email sent for ${data.clientName} (${data.userName})`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send client feedback email:`, error);
    return { success: false, error: (error as any).message };
  }
}