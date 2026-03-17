const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Shifts Routes — Ca làm việc tại quầy POS
 *
 * GET    /shifts           — Danh sách ca (kiosk + ngày hôm nay) ✅
 * GET    /shifts/:id       — Chi tiết ca ✅
 * POST   /shifts           — Mở ca mới (TODO) — trigger DB chặn 2 ca cùng kiosk
 * PUT    /shifts/:id/close — Đóng ca (TODO)
 */

// GET /shifts
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.kiosk_id, s.status,
              u.full_name AS opened_by_name,
              s.opening_cash, s.closing_cash,
              s.opened_at, s.closed_at
       FROM shifts s
       LEFT JOIN users u ON u.id = s.opened_by
       ORDER BY s.opened_at DESC
       LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /shifts/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM shifts WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /shifts — Mở ca mới
router.post('/', async (req, res) => {
  // TODO: 1. Validate { kiosk_id, opening_cash }
  //       2. INSERT INTO shifts (kiosk_id, opened_by, opening_cash, status='open', opened_at=NOW())
  //       3. DB trigger trg_shifts_one_open_per_kiosk sẽ tự chặn nếu kiosk đang có ca mở
  res.status(501).json({ success: false, message: 'TODO: implement POST /shifts (mở ca)' });
});

// PUT /shifts/:id/close — Đóng ca
router.put('/:id/close', async (req, res) => {
  // TODO: 1. Validate { closing_cash, closing_note }
  //       2. Tính tổng doanh thu ca trong orders
  //       3. UPDATE shifts SET status='closed', closed_at=NOW(), closing_cash=?, closed_by=?
  res.status(501).json({ success: false, message: 'TODO: implement PUT /shifts/:id/close (đóng ca)' });
});

module.exports = router;
