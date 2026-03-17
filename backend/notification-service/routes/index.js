const router = require('express').Router();

router.use('/email',     require('../email/email.routes'));
router.use('/sms',       require('../sms/sms.routes'));
router.use('/templates', require('../templates/templates.routes'));

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
    ],
  });
});

module.exports = router;
