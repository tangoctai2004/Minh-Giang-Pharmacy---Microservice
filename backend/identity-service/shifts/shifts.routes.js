const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Shifts Routes — Ca làm việc tại quầy POS
 *
 * GET    /shifts           — Danh sách ca (kiosk + ngày hôm nay) ✅
 * GET    /shifts/:id       — Chi tiết ca ✅
 * POST   /shifts           — Mở ca mới ✅ — trigger DB chặn 2 ca cùng kiosk
 * POST   /shifts/open      — Alias mở ca mới (theo api-mapping spec) ✅
 * PUT    /shifts/:id/close — Đóng ca ✅
 */

// GET /shifts
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.kiosk_id, s.status,
              u.full_name AS opened_by_name,
              s.opening_cash, s.closing_cash,
              s.shift_start, s.shift_end
       FROM shifts s
       LEFT JOIN users u ON u.id = s.user_id
       ORDER BY s.shift_start DESC
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
// POST /shifts/open — Alias (api-mapping spec)
async function openShiftHandler(req, res) {
  try {
    const { kiosk_id, opening_cash } = req.body;
    const userId = req.userId; // From JWT middleware

    // 1. Validate input
    if (!kiosk_id || opening_cash === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp kiosk_id và opening_cash',
      });
    }

    if (typeof opening_cash !== 'number' || opening_cash < 0) {
      return res.status(400).json({
        success: false,
        message: 'opening_cash phải là số dương',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa xác thực người dùng',
      });
    }

    // 2. Check user exists
    const [[user]] = await pool.query(
      'SELECT id, full_name FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhân viên',
      });
    }

    // 3. Check no other open shift for same kiosk
    const [[openShift]] = await pool.query(
      `SELECT id FROM shifts WHERE kiosk_id = ? AND status = 'open' LIMIT 1`,
      [kiosk_id]
    );
    if (openShift) {
      return res.status(409).json({
        success: false,
        message: `Kiosk ${kiosk_id} đang có ca mở. Vui lòng đóng ca trước khi mở ca mới`,
      });
    }

    // 4. INSERT new shift
    const [result] = await pool.query(
      `INSERT INTO shifts (user_id, kiosk_id, shift_start, opening_cash, status)
       VALUES (?, ?, NOW(), ?, 'open')`,
      [userId, kiosk_id, opening_cash]
    );

    // 5. Fetch and return created shift
    const [[shift]] = await pool.query(
      `SELECT id, user_id, kiosk_id, shift_start, opening_cash, status,
              total_cash_sales, total_card_sales, total_qr_sales
       FROM shifts WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Mở ca thành công',
      data: shift,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
router.post('/', openShiftHandler);
router.post('/open', openShiftHandler);

// PUT /shifts/:id/close — Đóng ca
router.put('/:id/close', async (req, res) => {
  try {
    const { id } = req.params;
    const { closing_cash, notes } = req.body;

    // 1. Validate input
    if (closing_cash === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp closing_cash',
      });
    }

    if (typeof closing_cash !== 'number' || closing_cash < 0) {
      return res.status(400).json({
        success: false,
        message: 'closing_cash phải là số dương',
      });
    }

    // 2. Check shift exists and is open
    const [[shift]] = await pool.query(
      `SELECT id, status, opening_cash, total_cash_sales, total_card_sales, total_qr_sales
       FROM shifts WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ca làm việc',
      });
    }

    if (shift.status !== 'open') {
      return res.status(409).json({
        success: false,
        message: 'Ca này đã đóng rồi, không thể đóng lại',
      });
    }

    // 3. Calculate cash difference (closing_cash - opening_cash - (total cash sales - total card sales - total qr sales))
    // Expected cash = opening_cash + total_cash_sales
    const expectedCash = parseFloat(shift.opening_cash) + parseFloat(shift.total_cash_sales);
    const cashDifference = parseFloat(closing_cash) - expectedCash;

    // 4. UPDATE shift with closing info
    await pool.query(
      `UPDATE shifts
       SET shift_end = NOW(),
           closing_cash = ?,
           status = 'closed',
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [closing_cash, notes || null, id]
    );

    // 5. Fetch and return updated shift
    const [[updatedShift]] = await pool.query(
      `SELECT id, user_id, kiosk_id, shift_start, shift_end, opening_cash, closing_cash,
              total_cash_sales, total_card_sales, total_qr_sales, status, notes
       FROM shifts WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Đóng ca thành công',
      data: {
        ...updatedShift,
        cash_difference: cashDifference.toFixed(2),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
