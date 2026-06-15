function normalizePhone(phone) {
  return String(phone || '').trim().replace(/[^\d+]/g, '');
}

async function sendSms({ phone, message }) {
  const normalizedPhone = normalizePhone(phone);
  const provider = process.env.SMS_PROVIDER || '';

  if (!normalizedPhone) {
    const err = new Error('Thieu truong "phone"');
    err.status = 400;
    throw err;
  }

  if (!message) {
    const err = new Error('Thieu truong "message"');
    err.status = 400;
    throw err;
  }

  if (!provider) {
    const err = new Error('Chưa cấu hình SMS_PROVIDER thật');
    err.status = 500;
    throw err;
  }

  if (provider === 'twilio') {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
      const err = new Error('Twilio chưa được cấu hình đầy đủ: cần TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM');
      err.status = 500;
      throw err;
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: normalizedPhone,
          Body: message,
        }),
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload.message || `Twilio gửi SMS thất bại (${response.status})`);
      err.status = response.status;
      throw err;
    }
    return {
      provider,
      provider_message_id: payload.sid || null,
    };
  }

  if (provider === 'generic_http') {
    const {
      SMS_API_URL,
      SMS_API_KEY,
      SMS_API_KEY_HEADER = 'Authorization',
      SMS_API_KEY_PREFIX = 'Bearer',
      SMS_BRAND_NAME,
      SMS_TO_FIELD = 'to',
      SMS_MESSAGE_FIELD = 'message',
      SMS_BRAND_FIELD = 'brand_name',
    } = process.env;
    if (!SMS_API_URL || !SMS_API_KEY) {
      const err = new Error('SMS generic_http chưa được cấu hình đầy đủ: cần SMS_API_URL và SMS_API_KEY');
      err.status = 500;
      throw err;
    }

    const body = {
      [SMS_TO_FIELD]: normalizedPhone,
      [SMS_MESSAGE_FIELD]: message,
    };
    if (SMS_BRAND_NAME) body[SMS_BRAND_FIELD] = SMS_BRAND_NAME;

    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SMS_API_KEY_HEADER]: SMS_API_KEY_PREFIX ? `${SMS_API_KEY_PREFIX} ${SMS_API_KEY}` : SMS_API_KEY,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const err = new Error(payload.message || payload.error || `Nhà cung cấp SMS trả lỗi (${response.status})`);
      err.status = response.status || 502;
      throw err;
    }
    return {
      provider,
      provider_message_id: payload.message_id || payload.id || payload.sid || null,
    };
  }

  const err = new Error(`SMS_PROVIDER="${provider}" chưa được hỗ trợ. Dùng twilio hoặc generic_http.`);
  err.status = 500;
  throw err;
}

module.exports = {
  normalizePhone,
  sendSms,
};
