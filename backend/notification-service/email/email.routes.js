const router       = require('express').Router();
const nodemailer   = require('nodemailer');
const pool         = require('../db/pool');

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * POST /email/send
 * Body: { to, subject, html?, text?, template_id? }
 *   - Nếu truyền template_id: lấy template từ DB, render rồi gửi
 *   - Nếu không: gửi trực tiếp với html/text
 */
router.post('/send', async (req, res) => {
  const { to, subject, html, text, template_id, template_vars } = req.body;

  if (!to) return res.status(400).json({ success: false, message: 'Thiếu trường "to"' });

  try {
    let mailHtml = html;
    let mailText = text;
    let mailSubject = subject;

    // Nếu có template_id, lấy nội dung từ DB và render
    if (template_id) {
      const [[tmpl]] = await pool.query(
        'SELECT subject_template, body_template FROM notification_templates WHERE id = ? AND type = "email" AND is_active = 1',
        [template_id]
      );
      if (!tmpl) return res.status(404).json({ success: false, message: 'Template không tồn tại hoặc đã bị vô hiệu hoá' });

      // Đơn giản: thay {{key}} bằng giá trị trong template_vars
      const vars = template_vars || {};
      mailSubject = (tmpl.subject_template || subject || 'Thông báo từ Minh Giang Pharmacy')
        .replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
      mailHtml = tmpl.body_template
        .replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
    }

    if (!mailSubject) return res.status(400).json({ success: false, message: 'Thiếu trường "subject"' });
    if (!mailHtml && !mailText) return res.status(400).json({ success: false, message: 'Thiếu nội dung html hoặc text' });

    const transporter = createTransport();
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Minh Giang Pharmacy'}" <${process.env.SMTP_USER}>`,
      to,
      subject: mailSubject,
      html:    mailHtml,
      text:    mailText,
    });

    res.json({ success: true, message: 'Email đã gửi thành công', messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
