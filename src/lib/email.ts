import nodemailer from 'nodemailer';

// 🔥 Global BCC - All emails will be copied to this address for monitoring
const GLOBAL_BCC_EMAIL = 'sahilsagvekar230@gmail.com';

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

// Helper function to add global BCC to mail options
const addGlobalBcc = (mailOptions: any) => {
  // Add BCC - if there's already a BCC, append to it
  if (mailOptions.bcc) {
    mailOptions.bcc = Array.isArray(mailOptions.bcc)
      ? [...mailOptions.bcc, GLOBAL_BCC_EMAIL]
      : [mailOptions.bcc, GLOBAL_BCC_EMAIL];
  } else {
    mailOptions.bcc = GLOBAL_BCC_EMAIL;
  }
  return mailOptions;
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
    await transporter.sendMail(addGlobalBcc(mailOptions));
    console.log(`✅ Email sent successfully to ${email}`);
  } catch (error) {
    console.error('Failed to send email:', error);
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


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .credentials-box {
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-item {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .credential-item:last-child {
              border-bottom: none;
            }
            .credential-label {
              font-weight: 600;
              color: #6b7280;
            }
            .credential-value {
              font-family: 'Courier New', monospace;
              background: #f3f4f6;
              padding: 4px 8px;
              border-radius: 4px;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #6b7280;
              font-size: 14px;
            }
            .important {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎬 Welcome to E8 Productions!</h1>
          </div>
          
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            
            <p>We're excited to have you join the E8 Productions team as a <strong>${role}</strong>! 🎉</p>
            
            <p>Your account has been created and you can now access the E8 Productions management system.</p>
            
            <div class="credentials-box">
              <h3 style="margin-top: 0;">📝 Your Login Credentials</h3>
              
              <div class="credential-item">
                <span class="credential-label">Email:</span>
                <span class="credential-value">${email}</span>
              </div>
              
              <div class="credential-item">
                <span class="credential-label">Temporary Password:</span>
                <span class="credential-value">${tempPassword}</span>
              </div>
              
              <div class="credential-item">
                <span class="credential-label">Role:</span>
                <span class="credential-value">${role}</span>
              </div>
            </div>
            
            <div class="important">
              <strong>⚠️ Important Security Note:</strong>
              <p style="margin: 10px 0 0 0;">
                This is a temporary password. You will be prompted to change it on your first login. 
                Please do not share these credentials with anyone.
              </p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.BASE_URLL || 'http://localhost:3000'}/dashboard" class="button">
                Access Dashboard →
              </a>
            </div>
            
            <h3>📚 Getting Started</h3>
            <ol>
              <li>Click the button above to access the dashboard</li>
              <li>Log in with your email and temporary password</li>
              <li>Set up your new password when prompted</li>
              <li>Complete your profile information</li>
            </ol>
            
            <p>If you have any questions or need assistance, please don't hesitate to reach out to your manager or the admin team.</p>
            
            <p>Looking forward to working with you!</p>
            
            <p>Best regards,<br>
            <strong>The E8 Productions Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This email was sent from E8 Productions Management System</p>
            <p>If you believe you received this email in error, please contact your administrator.</p>
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
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
            .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #007bff; 
              color: white; 
              text-decoration: none; 
              border-radius: 5px !important; 
              font-weight: bold;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color: #007bff;">Daily Activity Report</h2>
              <p>Period: ${formattedDate} (up to 7:00 PM EST)</p>
            </div>
            
            <p>Hi Eric,</p>
            
            <p>The daily activity report for the production team has been generated.</p>
            
            <div class="stats">
              <strong>Summary:</strong><br>
              • Total actions recorded: ${logCount}<br>
              • Report Type: CSV Export
            </div>
            
            <p>You can download or view the full report by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${reportUrl}" class="button" style="color: white;">Download CSV Report</a>
            </div>
            
            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              This is an automated report generated by the E8 Productions Management System.
            </p>
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
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
            .header { text-align: center; padding-bottom: 20px; }
            .stats { display: flex; justify-content: space-around; background: #f0f7ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .stat-box { text-align: center; }
            .stat-num { font-size: 24px; font-weight: bold; color: #007bff; }
            .stat-label { font-size: 14px; color: #666; }
            .details { margin-top: 20px; }
            .client-row { padding: 10px; border-bottom: 1px solid #f9f9f9; }
            .success { color: #28a745; font-weight: bold; }
            .skipped { color: #dc3545; font-size: 13px; }
            .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🤖 Hello Sahil!</h1>
              <p>Your "Task Machine" just finished its morning work!</p>
            </div>

            <p>I woke up at ${new Date(data.timestamp).toLocaleTimeString()} and checked all our clients to make sure their schedules are ready.</p>

            <div class="stats">
              <div class="stat-box">
                <div class="stat-num">${data.results.reduce((acc, curr) => acc + (curr.created || 0), 0)}</div>
                <div class="stat-label">New Tasks Made</div>
              </div>
              <div class="stat-box">
                <div class="stat-num">${data.results.reduce((acc, curr) => acc + (curr.skipped || 0), 0)}</div>
                <div class="stat-label">Clients Skipped</div>
              </div>
            </div>

            <div class="details">
              <h3>📝 Here is what I did:</h3>
              ${data.results.map(res => `
                <div class="client-row">
                  <strong>${res.name}</strong>: 
                  ${res.created > 0 ? `<span class="success">I made ${res.created} new tasks!</span>` : `<span class="skipped">I skipped this because ${res.skippedReason || 'the schedule is already full.'}</span>`}
                </div>
              `).join('')}
            </div>

            <p><strong>Why did I do this?</strong> To make sure your editors have work ready for them and you don't have to click "Create" a hundred times!</p>

            <div class="footer">
              <p>This report was sent automatically by the E8 Productions Robot.</p>
              <p>Timestamp: ${data.timestamp}</p>
            </div>
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
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 700px; margin: 0 auto; padding: 25px; border: 1px solid #eef; border-radius: 12px; background: #fff; }
            .header { border-bottom: 3px solid #007bff; padding-bottom: 15px; margin-bottom: 25px; }
            .user-card { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 15px; border-left: 4px solid #007bff; }
            .user-name { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 8px; }
            .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .metric { font-size: 14px; }
            .metric-count { font-weight: bold; color: #3b82f6; }
            .button-container { text-align: center; margin: 30px 0; }
            .download-button {
              background-color: #007bff;
              color: white !important;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              display: inline-block;
            }
            .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
            .summary-title { font-size: 20px; color: #111827; }
            .highlight-green { color: #10b981; font-weight: bold; }
            .highlight-red { color: #ef4444; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="summary-title">📊 Executive Production Summary</h1>
              <p style="color: #6b7280; font-size: 15px;">Activity for ${formattedDate}</p>
            </div>

            <p>Hello,</p>
            <p>Here is the simplified production report for today. You can see the high-level stats below or download the full summary file.</p>

            <div class="button-container">
              <a href="${data.summaryUrl}" class="download-button">📥 Download Summary CSV</a>
            </div>

            <div class="details">
              ${data.stats.length === 0 ? '<p>No activity recorded for this period.</p>' : data.stats.map(user => `
                <div class="user-card">
                  <div class="user-name">${user.userName} (${user.role})</div>
                  <div class="metric-grid">
                    ${user.inProgress > 0 ? `<div class="metric">🚀 Started Tasks: <span class="metric-count">${user.inProgress}</span></div>` : ''}
                    ${user.readyForQc > 0 ? `<div class="metric">📤 Sent to QC: <span class="metric-count">${user.readyForQc}</span></div>` : ''}
                    ${user.approved > 0 ? `<div class="metric">✅ Approved: <span class="highlight-green">${user.approved}</span></div>` : ''}
                    ${user.rejected > 0 ? `<div class="metric">❌ Rejected: <span class="highlight-red">${user.rejected}</span></div>` : ''}
                    ${user.clientApproved > 0 ? `<div class="metric">🌟 Client Approved: <span class="highlight-green">${user.clientApproved}</span></div>` : ''}
                    ${user.clientRejected > 0 ? `<div class="metric">⚠️ Client Revisions: <span class="highlight-red">${user.clientRejected}</span></div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="footer">
              <p>Automated Report by E8 Productions Management System</p>
              <p>© ${new Date().getFullYear()} E8 Productions</p>
            </div>
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
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
        <h2 style="color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px;">📦 Monthly S3 → NAS Archive</h2>
        <p>The monthly archival process for <strong>${data.month}</strong> has completed.</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <table width="100%">
            <tr>
              <td><strong>Bucket:</strong></td>
              <td>${data.bucket}</td>
            </tr>
            <tr>
              <td><strong>Status:</strong></td>
              <td style="color: ${data.results.failed > 0 ? '#dc3545' : '#28a745'}; font-weight: bold;">
                ${data.results.failed > 0 ? 'Completed with Errors' : 'Success'}
              </td>
            </tr>
            <tr>
              <td><strong>Files Transferred:</strong></td>
              <td>${data.results.transferred}</td>
            </tr>
            <tr>
              <td><strong>Total Data Moved:</strong></td>
              <td>${formatSize(data.results.totalSize)}</td>
            </tr>
          </table>
        </div>

        <h3 style="color: #555;">🏢 Breakdown by Company:</h3>
        <table width="100%" style="border-collapse: collapse;">
          <tr style="background: #eee;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Company</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Files</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Size</th>
          </tr>
          ${Object.entries(data.results.companyStats).map(([name, stats]) => `
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">${name}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${stats.count}</td>
              <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatSize(stats.size)}</td>
            </tr>
          `).join('')}
        </table>

        ${data.results.errors.length > 0 ? `
          <h3 style="color: #dc3545; margin-top: 30px;">❌ Errors encountered (${data.results.failed}):</h3>
          <ul style="background: #fff5f5; color: #b91c1c; padding: 15px; border-radius: 8px; list-style-position: inside; font-size: 13px;">
            ${data.results.errors.slice(0, 5).map(err => `<li>${err}</li>`).join('')}
            ${data.results.errors.length > 5 ? `<li>...and ${data.results.errors.length - 5} more</li>` : ''}
          </ul>
        ` : ''}

        <p style="font-size: 12px; color: #888; margin-top: 30px; text-align: center; border-top: 1px solid #eee; padding-top: 15px;">
          This report was generated automatically by the E8 Productions Archival System.
        </p>
      </div>
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
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 20px; }
            .job-card { background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0; border-radius: 4px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Job Posted! 🎬</h2>
            </div>
            <div class="content">
              <p>Hello Team,</p>
              <p>A new videography job has been posted and is open for bidding.</p>
              
              <div class="job-card">
                <h3>${jobDetails.title}</h3>
                <p><strong>📍 Location:</strong> ${jobDetails.location || 'TBD'}</p>
                <p><strong>📅 Date:</strong> ${jobDetails.date}</p>
              </div>

              <p>Log in to the portal to view full details and submit your bid.</p>
              
              <div style="text-align: center; margin-top: 25px;">
                <a href="${jobDetails.link}" class="button" style="color: white;">View Job & Bid</a>
              </div>
            </div>
            <div class="footer">
              <p>E8 Productions • Videographer Portal</p>
            </div>
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
      <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 20px; }
            .details-box { background: #f0fdf4; padding: 15px; border: 1px solid #bbf7d0; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>You're Hired! 🎉</h2>
            </div>
            <div class="content">
              <p>Hi ${recipient.name},</p>
              <p>Great news! Your bid for <strong>${jobDetails.title}</strong> has been accepted.</p>
              
              <div class="details-box">
                <p><strong>Job:</strong> ${jobDetails.title}</p>
                <p><strong>Date:</strong> ${jobDetails.date}</p>
                <p><strong>Approved Rate:</strong> $${jobDetails.amount}</p>
              </div>

              <p>Please check the portal for further instructions regarding the shoot.</p>
              
              <div style="text-align: center; margin-top: 25px;">
                <a href="${jobDetails.link}" class="button" style="color: white;">Open Job Details</a>
              </div>
            </div>
            <div class="footer">
              <p>E8 Productions • Videographer Portal</p>
            </div>
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
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #ef4444; border-radius: 10px; }
            .header { background: #fee2e2; color: #991b1b; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 20px; }
            .info-box { background: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 12px; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚨 Screenshot Detected!</h2>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p>A potential screenshot attempt was detected on the login screen by a user.</p>
              
              <div class="info-box">
                <p><strong>📧 User Email (if entered):</strong> ${data.email || 'Not provided'}</p>
                <p><strong>🌐 IP Address:</strong> ${data.ip}</p>
                <p><strong>📱 Device Info:</strong> ${data.userAgent}</p>
                <p><strong>⏰ Timestamp:</strong> ${data.timestamp}</p>
              </div>

              <p>This is an automated security notification. If this activity is unexpected, please investigate further.</p>
            </div>
            <div class="footer">
              <p>E8 Productions Security System</p>
            </div>
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
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 0;">
          <div style="max-width: 700px; margin: 0 auto; padding: 30px 20px;">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%); color: white; padding: 35px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700;">📋 Daily Team Summary</h1>
              <p style="margin: 0; opacity: 0.85; font-size: 15px;">${formattedDate}</p>
              <p style="margin: 8px 0 0 0; opacity: 0.7; font-size: 13px;">Report Period: ${report.periodStart} → ${report.periodEnd}</p>
            </div>

            <!-- Stats Bar -->
            <div style="background: #ffffff; padding: 20px 30px; display: flex; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <td width="50%" style="text-align: center; padding: 10px;">
                    <div style="font-size: 32px; font-weight: 800; color: #1e293b;">${report.totalTeamMembers}</div>
                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Active Team Members</div>
                  </td>
                  <td width="50%" style="text-align: center; padding: 10px; border-left: 1px solid #e2e8f0;">
                    <div style="font-size: 32px; font-weight: 800; color: #3b82f6;">${report.totalTasksMoved}</div>
                    <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Total Task Actions</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Download Button -->
            ${csvDownloadUrl ? `
            <div style="background: #ffffff; padding: 20px 30px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <a href="${csvDownloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);">📥 Download Full CSV Report</a>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;">CSV file includes team summary, login/logout activity, and detailed task history</p>
            </div>
            ` : ''}

            <!-- User Cards -->
            <div style="background: #f8fafc; padding: 25px 20px; border-radius: 0 0 16px 16px;">
              <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #1e293b; padding-left: 5px;">Team Activity Breakdown</h2>
              ${noActivityHtml}
              ${userCardsHtml}
            </div>

            <!-- Footer -->
            <div style="text-align: center; margin-top: 25px; padding: 15px;">
              ${csvDownloadUrl ? `<p style="font-size: 12px; margin: 0 0 8px 0;"><a href="${csvDownloadUrl}" style="color: #3b82f6; text-decoration: underline;">📥 Download CSV Report</a> (link valid for 7 days)</p>` : ''}
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">Automated Daily Report by E8 Productions Management System</p>
              <p style="font-size: 11px; color: #cbd5e1; margin: 5px 0 0 0;">© ${new Date().getFullYear()} E8 Productions. Report generated at ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST</p>
            </div>
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
   CLIENT REVIEW REMINDER
   Sent to Eric AND the client when tasks have been in CLIENT_REVIEW > 4 days.
   Call once per client group – pass all overdue tasks for that client.
───────────────────────────────────────────────────────────────────────────── */
export async function sendClientReviewReminderEmail(data: {
  clientName: string;
  clientEmails: string[];   // all emails for that client
  tasks: Array<{
    id: string;
    title: string;
    daysInReview: number;
    dashboardUrl: string;   // deep-link to that task's review screen
  }>;
}) {
  const ERIC_EMAIL = 'eric@e8productions.com';
  const APP_URL = process.env.BASE_URL || process.env.NEXTAUTH_URL || 'https://e8productions.com';

  // Deduplicate recipients: Eric + all client emails, case-insensitive
  const allRecipients = Array.from(
    new Set([ERIC_EMAIL, ...data.clientEmails].map(e => e.toLowerCase().trim()))
  );

  // Build task rows for the HTML table
  const taskRows = data.tasks.map(t => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 500;">
        ${t.title || 'Untitled Task'}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="
          display: inline-block;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 13px;
          font-weight: 600;
          background: ${t.daysInReview >= 7 ? '#fee2e2' : '#fef3c7'};
          color: ${t.daysInReview >= 7 ? '#b91c1c' : '#92400e'};
        ">
          ${t.daysInReview} day${t.daysInReview !== 1 ? 's' : ''}
        </span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <a href="${t.dashboardUrl}"
           style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 13px;">
          Review Now →
        </a>
      </td>
    </tr>
  `).join('');

  const subject = data.tasks.length === 1
    ? `⏰ Reminder: "${data.tasks[0].title}" is awaiting your review`
    : `⏰ Reminder: ${data.tasks.length} tasks are awaiting review for ${data.clientName}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Review Reminder</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: 'Segoe UI', Arial, sans-serif; color: #374151;">

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px;">
                  <p style="margin: 0 0 4px 0; font-size: 13px; color: #93c5fd; letter-spacing: 1px; text-transform: uppercase;">E8 Productions</p>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">
                    ⏰ Review Reminder
                  </h1>
                  <p style="margin: 8px 0 0; color: #bfdbfe; font-size: 14px;">
                    ${data.tasks.length} task${data.tasks.length !== 1 ? 's' : ''} for <strong>${data.clientName}</strong> ${data.tasks.length !== 1 ? 'are' : 'is'} awaiting review
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 40px;">
                  <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #374151;">
                    Hi there,<br/><br/>
                    The following task${data.tasks.length !== 1 ? 's' : ''} for <strong>${data.clientName}</strong> ${data.tasks.length !== 1 ? 'have' : 'has'} been sitting in <em>Client Review</em> for <strong>more than 4 days</strong> without any action.
                    Please take a moment to review ${data.tasks.length !== 1 ? 'them' : 'it'} and provide your feedback.
                  </p>

                  <!-- Task table -->
                  <table width="100%" cellpadding="0" cellspacing="0"
                    style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 28px;">
                    <thead>
                      <tr style="background: #f9fafb;">
                        <th style="padding: 11px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Task</th>
                        <th style="padding: 11px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; width: 110px;">Waiting</th>
                        <th style="padding: 11px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; width: 120px;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${taskRows}
                    </tbody>
                  </table>

                  <!-- CTA -->
                  <div style="text-align: center; margin: 8px 0 24px;">
                    <a href="${APP_URL}/dashboard"
                       style="display: inline-block; padding: 14px 32px; background: #2563eb; color: #ffffff;
                              text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;
                              box-shadow: 0 2px 6px rgba(37,99,235,0.35);">
                      Go to Dashboard →
                    </a>
                  </div>

                  <p style="margin: 0; font-size: 13px; color: #9ca3af; line-height: 1.6;">
                    If you have already reviewed these tasks, please disregard this message.<br/>
                    This reminder is sent automatically after <strong>4 days</strong> without a response.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                    © ${new Date().getFullYear()} E8 Productions · Automated Reminder System
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

    </body>
    </html>
  `;

  const transporter2 = createTransporter();
  if (!transporter2) {
    console.log('[ClientReviewReminder] Email not configured – skipping send.');
    console.log(`[ClientReviewReminder] Would have sent to: ${allRecipients.join(', ')}`);
    return { sent: 0, skipped: allRecipients.length };
  }

  let sent = 0;
  // Send individually so each recipient only sees their own address
  for (const recipient of allRecipients) {
    try {
      await transporter2.sendMail(addGlobalBcc({
        from: `"E8 Productions" <${process.env.SMTP_USER}>`,
        to: recipient,
        subject,
        html,
      }));
      console.log(`✅ [ClientReviewReminder] Sent to ${recipient}`);
      sent++;
    } catch (err) {
      console.error(`❌ [ClientReviewReminder] Failed to send to ${recipient}:`, err);
    }
  }

  return { sent, total: allRecipients.length };
}

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
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 35px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px;">✍️ Signature Requested</h1>
              <p style="margin: 0; opacity: 0.85; font-size: 15px;">${data.senderName} has requested your signature</p>
            </div>
            <div style="background: #ffffff; padding: 32px 30px; border-radius: 0 0 16px 16px;">
              <p>Hi ${data.signerName},</p>
              <p><strong>${data.senderName}</strong> has sent you a document to review and sign:</p>
              <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <h3 style="margin: 0 0 4px 0; color: #1e293b;">${data.contractTitle}</h3>
              </div>
              ${data.message ? `
                <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 14px 18px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0; font-size: 14px; color: #92400e;"><strong>Message from sender:</strong></p>
                  <p style="margin: 8px 0 0; font-size: 14px; color: #78350f;">${data.message}</p>
                </div>
              ` : ''}
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.signingUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">Review & Sign Document</a>
              </div>
              <p style="font-size: 13px; color: #94a3b8; text-align: center;">Or copy this link: <a href="${data.signingUrl}" style="color: #2563eb; word-break: break-all;">${data.signingUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">This signing link is unique to you. Do not share it with others.<br/>© ${new Date().getFullYear()} E8 Productions</p>
            </div>
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
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
            <div style="background: linear-gradient(135deg, #065f46 0%, #059669 100%); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 22px;">✅ Signature Received</h1>
            </div>
            <div style="background: #ffffff; padding: 28px 30px; border-radius: 0 0 16px 16px;">
              <p>Hi ${data.recipientName},</p>
              <p><strong>${data.signerName}</strong> has successfully signed the document <strong>"${data.contractTitle}"</strong>.</p>
              <p>Log in to your dashboard to view the contract status and track remaining signatures.</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; padding: 12px 28px; background: #059669; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Contract</a>
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
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 0 auto; padding: 30px 20px;">
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #7c3aed 100%); color: white; padding: 35px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="margin: 0 0 8px 0; font-size: 24px;">🎉 Contract Completed!</h1>
              <p style="margin: 0; opacity: 0.85;">All parties have signed</p>
            </div>
            <div style="background: #ffffff; padding: 28px 30px; border-radius: 0 0 16px 16px;">
              <p>Hi ${data.recipientName},</p>
              <p>Great news! All signers have completed signing <strong>"${data.contractTitle}"</strong>.</p>
              <p>The fully signed document is now available for download in your dashboard.</p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${data.downloadUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">📥 Download Signed Contract</a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">A copy of this signed document has been stored securely.<br/>© ${new Date().getFullYear()} E8 Productions</p>
            </div>
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

  const mailOptions = {
    from: `"E8 Productions Billing" <${process.env.SMTP_USER}>`,
    to: PAYMENTS_EMAIL,
    subject: subjects[data.type],
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${statusColors[data.type]}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .label { color: #6b7280; font-weight: 500; }
            .value { color: #111827; font-weight: 600; }
            .amount { font-size: 24px; color: ${statusColors[data.type]}; font-weight: bold; }
            .btn { display: inline-block; padding: 12px 24px; background: ${statusColors[data.type]}; color: white; text-decoration: none; border-radius: 6px; margin: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">${statusLabels[data.type]}</h1>
            </div>
            <div class="content">
              <div style="text-align: center; margin-bottom: 20px;">
                <div class="amount">$${data.amount.toFixed(2)}</div>
              </div>
              
              <div class="detail-row">
                <span class="label">Invoice Number</span>
                <span class="value">${data.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="label">Client</span>
                <span class="value">${data.clientName}</span>
              </div>
              <div class="detail-row">
                <span class="label">Client Email</span>
                <span class="value">${data.clientEmail}</span>
              </div>
              ${data.failureReason ? `
              <div class="detail-row">
                <span class="label">Failure Reason</span>
                <span class="value" style="color: #ef4444;">${data.failureReason}</span>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 20px;">
                ${data.invoiceUrl ? `<a href="${data.invoiceUrl}" class="btn">View Invoice</a>` : ''}
                ${data.pdfUrl ? `<a href="${data.pdfUrl}" class="btn" style="background: #6b7280;">Download PDF</a>` : ''}
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions); // No BCC needed, this IS the payment notification
    console.log(`✅ Payment notification (${data.type}) sent to ${PAYMENTS_EMAIL}`);
  } catch (error) {
    console.error(`❌ Failed to send payment notification:`, error);
  }
}