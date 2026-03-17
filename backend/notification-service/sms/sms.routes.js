const router = require('express').Router();

/**
 * POST /sms/send
 * Body: { phone, message }
 *
 * TODO: Tích hợp nhà cung cấp SMS thực tế (ví dụ: ESMS, SpeedSMS, Viettel eSMS…)
 *
 * Hướng dẫn tích hợp ESMS (https://esms.vn/):
 *   1. npm install axios
 *   2. Thêm ESMS_API_KEY và ESMS_SECRET_KEY vào .env
 *   3. Gọi POST https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/
 *      với body { ApiKey, Content, Phone, SmsType: 2, SecretKey, Brandname }
 *   4. Kiểm tra response CodeResult === '100' để xác nhận thành công
 */
router.post('/send', (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, message: 'Thiếu trường "phone" hoặc "message"' });
  }

  // Stub response — thay bằng lời gọi API thực tế
  res.status(501).json({
    success: false,
    message: 'TODO: Tích hợp SMS provider (ESMS / SpeedSMS / …)',
    received: { phone, message },
  });
});

module.exports = router;
