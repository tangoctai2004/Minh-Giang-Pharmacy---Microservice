const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendEmail({ to, subject, html, text }) {
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  if (provider === 'mock') {
    const success = process.env.EMAIL_MOCK_SUCCESS !== 'false';
    console.log(`[Email mock] ${success ? 'sent' : 'failed'} to ${to}: ${subject}`);

    if (!success) {
      const err = new Error('Email mock gui that bai theo cau hinh EMAIL_MOCK_SUCCESS=false');
      err.status = 502;
      throw err;
    }

    return {
      provider,
      provider_message_id: `mock-email-${Date.now()}`,
    };
  }

  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${process.env.SMTP_FROM_NAME || 'Minh Giang Pharmacy'}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });

  return {
    provider,
    provider_message_id: info.messageId,
  };
}

module.exports = sendEmail;
