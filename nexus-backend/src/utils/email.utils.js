const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

exports.sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"Nexus Platform" <${process.env.EMAIL_FROM}>`,
    to,
    subject,
    html,
    text
  };
  return await transporter.sendMail(mailOptions);
};

exports.sendPasswordResetEmail = async (user, resetToken) => {
  const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await exports.sendEmail({
    to: user.email,
    subject: 'Nexus – Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below (valid for 10 minutes):</p>
      <a href="${resetURL}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset Password</a>
      <p>If you didn't request this, please ignore this email.</p>
    `
  });
};

exports.sendOTPEmail = async (user, otp) => {
  await exports.sendEmail({
    to: user.email,
    subject: 'Nexus – Your 2FA Verification Code',
    html: `
      <h2>Two-Factor Authentication</h2>
      <p>Hi ${user.name},</p>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing:8px;font-size:36px;color:#6366f1;">${otp}</h1>
      <p>This code expires in 5 minutes.</p>
    `
  });
};

exports.sendMeetingInviteEmail = async (recipient, meeting, organizer) => {
  await exports.sendEmail({
    to: recipient.email,
    subject: `Nexus – Meeting Invite: ${meeting.title}`,
    html: `
      <h2>Meeting Invitation</h2>
      <p>Hi ${recipient.name},</p>
      <p><strong>${organizer.name}</strong> has invited you to a meeting:</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td><strong>Title:</strong></td><td>${meeting.title}</td></tr>
        <tr><td><strong>Date:</strong></td><td>${new Date(meeting.scheduledAt).toLocaleString()}</td></tr>
        <tr><td><strong>Duration:</strong></td><td>${meeting.duration} minutes</td></tr>
        <tr><td><strong>Type:</strong></td><td>${meeting.type}</td></tr>
      </table>
      <p>${meeting.description || ''}</p>
      <p>Log in to Nexus to accept or reject this invitation.</p>
    `
  });
};
