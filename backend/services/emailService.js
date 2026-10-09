const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    // Development / Fallback transporter
    transporter = nodemailer.createTransport({
      jsonTransport: true // Returns JSON of message for safe logging without external network
    });
  }

  return transporter;
}

/**
 * Send OTP for Password Reset or Email Verification
 */
async function sendOtpEmail({ to, otp, purpose = 'PASSWORD_RESET', userName }) {
  const mailTransporter = getTransporter();
  const from = process.env.EMAIL_FROM || '"Academix Security" <security@academix.edu>';

  const isReset = purpose === 'PASSWORD_RESET';
  const subject = isReset ? 'Your Academix Password Reset Code' : 'Verify Your Academix Email';
  const title = isReset ? 'Password Reset Verification' : 'Email Verification';
  const instruction = isReset
    ? 'We received a request to reset your password for your Academix account.'
    : 'Welcome to Academix! Use the code below to verify your email address and activate your account.';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .body { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
          .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .otp-container { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #4338ca; font-family: monospace; }
          .expiry { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
          .warning { font-size: 12px; color: #dc2626; background: #fef2f2; border-left: 3px solid #ef4444; padding: 10px 14px; border-radius: 6px; margin-bottom: 24px; }
          .footer { border-top: 1px solid #f1f5f9; padding: 20px 28px; font-size: 11px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Academix</h1>
          </div>
          <div class="body">
            <div class="greeting">Hello ${userName || 'there'},</div>
            <div class="text">${instruction}</div>
            
            <div class="otp-container">
              <div class="otp-code">${otp}</div>
              <div class="expiry">This verification code expires in 10 minutes.</div>
            </div>

            <div class="warning">
              <strong>Security Notice:</strong> If you did not request this verification code, please ignore this email or update your account credentials immediately. Never share your OTP with anyone.
            </div>

            <div class="text" style="margin-bottom: 0;">
              Best regards,<br>
              <strong>The Academix Security Team</strong>
            </div>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Academix Academic Platform. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  const info = await mailTransporter.sendMail({
    from,
    to,
    subject,
    text: `${title}\n\nYour 6-digit verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, please disregard.`,
    html,
  });

  return info;
}

module.exports = {
  sendOtpEmail,
};
