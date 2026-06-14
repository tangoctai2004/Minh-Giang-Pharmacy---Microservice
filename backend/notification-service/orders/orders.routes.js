const router = require('express').Router();
const sendTemplatedNotification = require('../notifications/sendTemplatedNotification');

const STATUS_LABELS = {
  pending: 'Cho xac nhan',
  pending_approval: 'Cho duyet',
  confirmed: 'Da xac nhan',
  preparing: 'Dang chuan bi',
  shipping: 'Dang giao hang',
  completed: 'Hoan thanh',
  cancelled: 'Da huy',
};

function buildTargets(body) {
  const targets = [];

  if (body.email) {
    targets.push({ channel: 'email', target: body.email });
  }

  if (body.phone) {
    targets.push({ channel: 'sms', target: body.phone });
  }

  return targets;
}

async function sendOrderNotifications({ body, templatePrefix, extraVars = {} }) {
  const targets = buildTargets(body);
  if (!targets.length) {
    const err = new Error('Can co email hoac phone de gui thong bao');
    err.status = 400;
    throw err;
  }

  const templateVars = {
    customer_name: body.customer_name || 'Quy khach',
    order_code: body.order_code,
    total_amount: body.total_amount == null ? '' : String(body.total_amount),
    ...extraVars,
  };

  const results = [];
  const errors = [];

  for (const item of targets) {
    try {
      const result = await sendTemplatedNotification({
        templateName: `${templatePrefix}_${item.channel}`,
        channel: item.channel,
        target: item.target,
        templateVars,
        recipientType: body.recipient_type || 'customer',
        recipientId: body.recipient_id,
        referenceType: 'order',
        referenceId: body.order_id,
      });
      results.push(result);
    } catch (err) {
      errors.push({
        channel: item.channel,
        target: item.target,
        message: err.message,
      });
    }
  }

  return { results, errors };
}

router.post('/created', async (req, res) => {
  try {
    if (!req.body.order_id || !req.body.order_code || !req.body.recipient_id) {
      return res.status(400).json({
        success: false,
        message: 'Thieu order_id, order_code hoac recipient_id',
      });
    }

    const data = await sendOrderNotifications({
      body: req.body,
      templatePrefix: 'order_created',
    });

    res.status(data.errors.length ? 207 : 200).json({
      success: data.errors.length === 0,
      message: data.errors.length ? 'Gui thong bao don hang mot phan that bai' : 'Gui thong bao don hang thanh cong',
      data,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.post('/status-changed', async (req, res) => {
  try {
    if (!req.body.order_id || !req.body.order_code || !req.body.recipient_id || !req.body.status) {
      return res.status(400).json({
        success: false,
        message: 'Thieu order_id, order_code, recipient_id hoac status',
      });
    }

    const data = await sendOrderNotifications({
      body: req.body,
      templatePrefix: 'order_status',
      extraVars: {
        status: req.body.status,
        status_label: req.body.status_label || STATUS_LABELS[req.body.status] || req.body.status,
      },
    });

    res.status(data.errors.length ? 207 : 200).json({
      success: data.errors.length === 0,
      message: data.errors.length ? 'Gui thong bao trang thai don hang mot phan that bai' : 'Gui thong bao trang thai don hang thanh cong',
      data,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
