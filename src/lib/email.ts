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
