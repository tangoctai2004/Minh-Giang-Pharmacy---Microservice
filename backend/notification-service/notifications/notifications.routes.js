const router = require('express').Router();
const pool = require('../db/pool');
const requireRole = require('../middlewares/requireRole');
const retryNotification = require('./retryNotification');

router.use(requireRole(['admin', 'pharmacist']));

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE 1 = 1';
    const params = [];

    ['channel', 'status', 'recipient_type', 'reference_type'].forEach((field) => {
      if (req.query[field]) {
        where += ` AND n.${field} = ?`;
        params.push(req.query[field]);
      }
    });

    if (req.query.recipient_id) {
      where += ' AND n.recipient_id = ?';
      params.push(req.query.recipient_id);
    }

    if (req.query.reference_id) {
      where += ' AND n.reference_id = ?';
      params.push(req.query.reference_id);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications n ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT n.id, n.template_id, t.name AS template_name, n.recipient_type,
              n.recipient_id, n.channel, n.reference_type, n.reference_id,
              n.payload, n.status, n.sent_at, n.created_at
         FROM notifications n
         LEFT JOIN notification_templates t ON t.id = n.template_id
         ${where}
         ORDER BY n.created_at DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const data = await retryNotification(req.params.id);
    res.json({
      success: true,
      message: 'Retry thong bao thanh cong',
      data,
    });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT n.*, t.name AS template_name, t.subject AS template_subject
         FROM notifications n
         LEFT JOIN notification_templates t ON t.id = n.template_id
        WHERE n.id = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ success: false, message: 'Khong tim thay thong bao' });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
