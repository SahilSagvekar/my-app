// src/lib/whatsapp.ts
// Extension point for WhatsApp notifications — not wired to a provider yet.
// No WhatsApp Business/Twilio account exists for this project. Once one is
// set up, fill in WHATSAPP_* env vars and implement sendWhatsAppMessage below
// (e.g. Twilio's WhatsApp API or Meta's WhatsApp Cloud API — both work off
// the same "to phone number + text/template" shape used here).

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_API_TOKEN);
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; debug?: boolean; error?: string }> {
  if (!isWhatsAppConfigured()) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 WHATSAPP NOT CONFIGURED — message not sent');
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { success: false, debug: true, error: 'WhatsApp not configured' };
  }

  // No provider wired in yet — set WHATSAPP_PROVIDER + credentials and
  // implement the actual API call here (Twilio or Meta Cloud API).
  console.error('[WhatsApp] Provider flagged as configured but no send implementation exists yet.');
  return { success: false, error: 'WhatsApp provider not implemented' };
}
