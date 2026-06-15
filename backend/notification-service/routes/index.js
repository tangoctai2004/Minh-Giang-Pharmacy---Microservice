const router = require('express').Router();

router.use('/email',     require('../email/email.routes'));
router.use('/sms',       require('../sms/sms.routes'));
router.use('/templates', require('../templates/templates.routes'));
router.use('/notifications', require('../notifications/notifications.routes'));
router.use('/orders', require('../orders/orders.routes'));
router.use('/in-app', require('../in-app/inApp.routes'));

// GET / — Danh sách endpoints
router.get('/', (req, res) => {
  res.json({
    service: 'notification-service',
    endpoints: [
      'POST /api/notification/email/send',
      'POST /api/notification/sms/send',
      'GET  /api/notification/templates',
      'GET  /api/notification/templates/:id',
      'POST /api/notification/templates',
      'PUT  /api/notification/templates/:id',
      'DELETE /api/notification/templates/:id',
      'GET  /api/notification/notifications',
      'GET  /api/notification/notifications/:id',
      'POST /api/notification/notifications/:id/retry',
      'POST /api/notification/orders/created',
      'POST /api/notification/orders/status-changed',
      'POST /api/notification/in-app/send',
      'GET  /api/notification/in-app/mine',
      'PUT  /api/notification/in-app/:id/read',
    ],
  });
});

module.exports = router;
