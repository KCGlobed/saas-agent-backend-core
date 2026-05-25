const nodemailer = require('nodemailer');

/**
 * Sends a password reset email using SMTP if configured in .env,
 * otherwise falls back to Ethereal Email (which logs a clickable preview URL to the terminal).
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} name - Recipient's name
 * @param {string} resetUrl - Password reset link
 */
async function sendResetPasswordEmail(toEmail, name, resetUrl) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = process.env.SMTP_PORT || 587;
  const from = process.env.SMTP_FROM || '"AI Platform Support" <noreply@aiplatform.com>';

  let transporter;

  if (host && user && pass) {
    console.log('[Email] SMTP credentials configured. Sending real email...');
    transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465, // true for 465, false for other ports
      auth: { user, pass }
    });
  } else {
    console.log('[Email] SMTP credentials not set. Setting up simulated Ethereal Email transport...');
    // Create Ethereal test account on the fly for development
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.error('[Email] Failed to create Ethereal Email test account:', err.message);
      console.log(`\n======================================================`);
      console.log(`DEVELOPMENT HELPER - RESET PASSWORD URL:`);
      console.log(`${resetUrl}`);
      console.log(`======================================================\n`);
      return;
    }
  }

  const mailOptions = {
    from,
    to: toEmail,
    subject: 'Reset Your Password - AI Platform',
    text: `Hello ${name || 'User'},\n\nYou requested to reset your password. Please click the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nAI Platform Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f1eefb; border-radius: 12px; background-color: #faf9fd;">
        <div style="background-color: #a13e99; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">Reset Your Password</h1>
        </div>
        <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
          <p style="font-size: 16px; color: #334155; line-height: 1.6;">Hello <strong>${name || 'there'}</strong>,</p>
          <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
            We received a request to reset the password for your account on our AI Multi-Tenant Platform.
            Please click the button below to choose a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #a13e99; color: white; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(161,62,153,0.25);">
              Reset Password Now
            </a>
          </div>
          <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
            <strong>Important:</strong> This link is only valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.
          </p>
          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
          <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
            If you're having trouble clicking the button, copy and paste the URL below into your browser: <br>
            <a href="${resetUrl}" style="color: #a13e99;">${resetUrl}</a>
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
          © ${new Date().getFullYear()} AI Platform. All rights reserved.
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Email] Email sent successfully to:', toEmail);
    
    // Ethereal fallback helper to output the clickable preview link in the terminal console!
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n======================================================`);
      console.log(`SIMULATED EMAIL SENT! View it live at:`);
      console.log(`👉 ${previewUrl} 👈`);
      console.log(`======================================================\n`);
    }
  } catch (err) {
    console.error('[Email] Error sending email:', err.message);
    // If SMTP fails, print the reset URL in the console as a final fallback
    console.log(`\n======================================================`);
    console.log(`DEVELOPMENT HELPER - RESET PASSWORD URL:`);
    console.log(`${resetUrl}`);
    console.log(`======================================================\n`);
  }
}

module.exports = { sendResetPasswordEmail };
