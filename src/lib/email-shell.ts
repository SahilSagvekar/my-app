// src/lib/email-shell.ts
//
// Shared HTML shell (logo header + card + footer) for every E8 billing
// email. This exact markup used to be copy-pasted in four separate places
// (sendPaymentNotificationEmail in email.ts, plus sendBillingWarningEmail
// and sendPortalLockedEmail in the Stripe webhook, plus an unused template
// file) — a tweak to the logo, footer text, or colors had to be made in
// every copy by hand, or they'd silently drift apart. Now there's exactly
// one copy; callers only supply the rows that go inside the card.
//
// Logo: this used to be a base64 data: URI embedded directly in the HTML.
// That's why the logo showed as broken in Gmail (and other clients) even
// though the base64 decoded to a perfectly valid PNG — most major email
// clients, Gmail included, strip or refuse to render inline data: URIs in
// image src attributes as a spam/security measure. A real HTTPS URL is
// the only reliable way to get an image to render in email — same fix
// already applied in email-notifications.ts.
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.e8productions.com';
const LOGO_URL = `${BASE_URL}/assets/e8-logo-black.png`;

export function renderEmailShell(opts: {
  previewText: string; // hidden preheader text shown in inbox previews
  contentHtml: string; // <tr> rows rendered inside the card, after the logo header
}): string {
  return `
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${opts.previewText}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d3d3d6;border-radius:12px;box-shadow:0 2px 12px rgba(10,10,11,0.06);">
      <tr><td class="px" style="padding:20px 40px 16px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:27px;vertical-align:middle;"><img src="${LOGO_URL}" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;"></td>
          <td style="width:12px;">&nbsp;</td>
          <td style="font-family:Helvetica,Arial,sans-serif;font-size:25px;font-weight:bold;letter-spacing:0.2px;color:#0a0a0b;vertical-align:middle;">E8 App</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
${opts.contentHtml}
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC &middot; e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>`;
}