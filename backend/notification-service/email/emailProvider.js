const nodemailer = require('nodemailer');
const path = require('path');

function createTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const err = new Error('SMTP chưa được cấu hình đầy đủ: cần SMTP_HOST, SMTP_USER, SMTP_PASS');
    err.status = 500;
    throw err;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendEmail({ to, subject, html, text }) {
  const provider = process.env.EMAIL_PROVIDER || 'smtp';

  if (provider !== 'smtp') {
    const err = new Error(`EMAIL_PROVIDER="${provider}" chưa được hỗ trợ. Hiện chỉ cho phép smtp thật.`);
    err.status = 500;
    throw err;
  }

  const transporter = createTransport();
  
  const attachments = [
    {
      filename: 'logo.png',
      path: path.join(__dirname, 'logo.png'),
      cid: 'logo',
    },
  ];

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${process.env.SMTP_FROM_NAME || 'Minh Giang Pharmacy'}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
    attachments,
  });

  return {
    provider,
    provider_message_id: info.messageId,
  };
}

module.exports = sendEmail;
