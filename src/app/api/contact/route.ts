import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

// Basic in-memory rate limiter (per-IP). For production use a shared store like Redis.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 6; // max submissions per window
const ipSubmissions = new Map<string, number[]>();


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
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const now = Date.now();
    const entries = ipSubmissions.get(ip) || [];
    const recent = entries.filter((ts) => ts > now - RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 });
    }
    // append current
    recent.push(now);
    ipSubmissions.set(ip, recent);

    const recipient = 'mitaligadge24@gmail.com';

    // If SMTP isn't configured we log the submission (development mode)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📧 CONTACT FORM SUBMISSION (DEV MODE)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`To: ${recipient}`);
      console.log(`From: ${name} <${email}>`);
      console.log('Message:');
      console.log(message);
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      return NextResponse.json({ message: 'Message logged (dev mode) - no SMTP configured' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"E8 Productions Contact" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: `New contact form submission from ${name}`,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
        <hr/>
        <p>Received: ${new Date().toISOString()}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('Contact API error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
