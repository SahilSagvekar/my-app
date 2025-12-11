import nodemailer from 'nodemailer';

// Check if email is configured
const isEmailConfigured = () => {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
};

// Create transporter only if configured
const createTransporter = () => {
  if (!isEmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Gmail requires this for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


};

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
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .otp-box { 
              background-color: #f3f4f6; 
              border: 2px dashed #3b82f6;
              padding: 20px;
              text-align: center;
              border-radius: 8px;
              margin: 30px 0;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #1f2937;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 style="color: #111827;">Password Reset Request</h1>
            
            <p>Hello,</p>
            
            <p>You requested to reset your password for your E8 Productions account.</p>
            
            <p>Your One-Time Password (OTP) is:</p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 5px 0;">
                <li>This OTP will expire in 10 minutes</li>
                <li>Do not share this OTP with anyone</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
            
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
              <p><strong>E8 Productions</strong></p>
              <p>© ${new Date().getFullYear()} E8 Productions. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error; // Re-throw so API can handle it
  }
}