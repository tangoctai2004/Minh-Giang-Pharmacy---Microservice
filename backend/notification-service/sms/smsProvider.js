function normalizePhone(phone) {
  return String(phone || '').trim().replace(/[^\d+]/g, '');
}

async function sendSms({ phone, message }) {
  const normalizedPhone = normalizePhone(phone);
  const provider = process.env.SMS_PROVIDER || 'mock';

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

  if (provider === 'mock') {
    const success = process.env.SMS_MOCK_SUCCESS !== 'false';
    console.log(`[SMS mock] ${success ? 'sent' : 'failed'} to ${normalizedPhone}: ${message}`);

    if (!success) {
      const err = new Error('SMS mock gui that bai theo cau hinh SMS_MOCK_SUCCESS=false');
      err.status = 502;
      throw err;
    }

    return {
      provider,
      provider_message_id: `mock-${Date.now()}`,
    };
  }

  if (!process.env.SMS_API_KEY || !process.env.SMS_SECRET) {
    const err = new Error('SMS provider chua duoc cau hinh day du');
    err.status = 400;
    throw err;
  }

  const err = new Error(`SMS provider "${provider}" chua duoc ho tro. Hay dung SMS_PROVIDER=mock hoac cau hinh provider hop le`);
  err.status = 400;
  throw err;
}

module.exports = {
  normalizePhone,
  sendSms,
};
