const router = require('express').Router();
const pool   = require('../db/pool');
const { hasPermission } = require('../middlewares/rbac');

function canOpenShift(req) {
  return req.userType === 'staff'
    && (req.userRole === 'admin'
      || req.userRole === 'pharmacist'
      || req.userRole === 'cashier'
      || hasPermission(req, 'pos.access'));
}

function canViewShifts(req) {
  return canOpenShift(req);
}

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
  if (!canViewShifts(req)) {
    return res.status(req.userId ? 403 : 401).json({ success: false, message: 'Không có quyền xem ca làm việc' });
  }

  try {
    let { page, limit, startDate, endDate, search, status } = req.query;
    
    // Normalize page and limit
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let queryParams = [];

    if (startDate) {
      whereClauses.push("s.shift_start >= ?");
      queryParams.push(`${startDate} 00:00:00`);
    }
    if (endDate) {
      whereClauses.push("s.shift_start <= ?");
      queryParams.push(`${endDate} 23:59:59`);
    }
    if (search) {
      whereClauses.push("(u.full_name LIKE ? OR s.kiosk_id LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      if (status === 'open') {
        whereClauses.push("s.status = 'open'");
      } else if (status === 'matched') {
        whereClauses.push("s.status = 'closed' AND s.cash_difference = 0");
      } else if (status === 'reconcile_pending') {
        whereClauses.push("s.status = 'closed' AND s.cash_difference != 0 AND s.reconciliation_status != 'approved'");
      } else if (status === 'approved') {
        whereClauses.push("s.reconciliation_status = 'approved'");
      }
    }

    const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    // 1. Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM shifts s
      LEFT JOIN users u ON u.id = s.user_id
      ${whereSql}
    `;
    const [[{ total }]] = await pool.query(countQuery, queryParams);

    // 2. Fetch data page
    const dataQuery = `
      SELECT s.id, s.kiosk_id, s.status,
             u.full_name AS opened_by_name,
             s.opening_cash, s.closing_cash,
             s.total_cash_sales, s.total_card_sales, s.total_qr_sales,
             s.expected_closing_cash, s.cash_difference, s.reconciliation_status,
             s.shift_start, s.shift_end, s.notes, s.approved_at, s.approval_note,
             u2.full_name AS approved_by_name
      FROM shifts s
      LEFT JOIN users u ON u.id = s.user_id
      LEFT JOIN users u2 ON u2.id = s.approved_by
      ${whereSql}
      ORDER BY s.shift_start DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataQuery, [...queryParams, limit, offset]);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /shifts/:id
router.get('/:id', async (req, res) => {
  if (!canViewShifts(req)) {
    return res.status(req.userId ? 403 : 401).json({ success: false, message: 'Không có quyền xem ca làm việc' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT s.*, 
              u.full_name AS opened_by_name,
              u2.full_name AS approved_by_name
       FROM shifts s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN users u2 ON u2.id = s.approved_by
       WHERE s.id = ?`,
      [req.params.id]
    );
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

    if (!canOpenShift(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ dược sĩ, thu ngân hoặc admin được mở ca POS',
      });
    }

    // 2. Check user exists
    const [[user]] = await pool.query(
      `SELECT u.id, u.full_name, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_active = 1`,
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
      `SELECT id, user_id, status, opening_cash, total_cash_sales, total_card_sales, total_qr_sales
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

    if (req.userRole !== 'admin' && shift.user_id !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người mở ca hoặc admin được đóng ca này',
      });
    }

    // 3. Calculate cash difference (closing_cash - opening_cash - (total cash sales - total card sales - total qr sales))
    // Expected cash = opening_cash + total_cash_sales
    const expectedCash = parseFloat(shift.opening_cash) + parseFloat(shift.total_cash_sales);
    const cashDifference = parseFloat(closing_cash) - expectedCash;
    const reconciliationStatus = cashDifference === 0
      ? 'matched'
      : (cashDifference > 0 ? 'excess' : 'shortage');

    // 4. UPDATE shift with closing info
    await pool.query(
      `UPDATE shifts
       SET shift_end = NOW(),
           closing_cash = ?,
           expected_closing_cash = ?,
           cash_difference = ?,
           reconciliation_status = ?,
           status = 'closed',
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [closing_cash, expectedCash, cashDifference, reconciliationStatus, notes || null, id]
    );

    // 5. Fetch and return updated shift
    const [[updatedShift]] = await pool.query(
      `SELECT id, user_id, kiosk_id, shift_start, shift_end, opening_cash, closing_cash,
              total_cash_sales, total_card_sales, total_qr_sales, status, notes,
              expected_closing_cash, cash_difference, reconciliation_status
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

// PUT /shifts/:id/reconcile/approve — Admin duyệt chênh lệch ca làm việc
router.put('/:id/reconcile/approve', async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Chỉ quản trị viên mới có quyền duyệt chênh lệch' });
  }

  try {
    const { id } = req.params;
    const { approval_note } = req.body;

    const [result] = await pool.query(
      `UPDATE shifts
       SET reconciliation_status = 'approved',
           approved_by = ?,
           approved_at = NOW(),
           approval_note = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.userId, approval_note || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc' });
    }

    res.json({ success: true, message: 'Duyệt chênh lệch ca thành công' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /shifts/:id/sales — Cộng doanh số đơn hàng vào ca POS (Internal)
router.post('/:id/sales', async (req, res) => {
  const isTrusted = Boolean(
    process.env.INTERNAL_SERVICE_TOKEN &&
    req.headers['x-internal-token'] === process.env.INTERNAL_SERVICE_TOKEN
  );
  if (!isTrusted && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Chỉ chấp nhận cuộc gọi nội bộ.' });
  }

  try {
    const { id } = req.params;
    const { payment_method, amount } = req.body || {};

    if (!payment_method || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin payment_method hoặc amount' });
    }

    const saleAmount = Number(amount);
    if (isNaN(saleAmount) || saleAmount < 0) {
      return res.status(400).json({ success: false, message: 'amount không hợp lệ' });
    }

    let fieldToUpdate = '';
    const cleanMethod = String(payment_method).trim().toLowerCase();
    if (cleanMethod === 'cash') {
      fieldToUpdate = 'total_cash_sales';
    } else if (cleanMethod === 'card_visa' || cleanMethod === 'card') {
      fieldToUpdate = 'total_card_sales';
    } else if (cleanMethod === 'qr_transfer' || cleanMethod === 'qr' || cleanMethod === 'momo' || cleanMethod === 'vnpay') {
      fieldToUpdate = 'total_qr_sales';
    } else {
      fieldToUpdate = 'total_cash_sales'; // fallback
    }

    const [result] = await pool.query(
      `UPDATE shifts 
       SET ${fieldToUpdate} = ${fieldToUpdate} + ? 
       WHERE id = ? AND status = 'open'`,
      [saleAmount, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc đang mở' });
    }

    res.json({ success: true, message: 'Đã cộng doanh số vào ca làm việc' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /shifts/active/:userId — Tìm ca đang mở của nhân viên (Internal/Staff)
router.get('/active/:userId', async (req, res) => {
  const isTrusted = Boolean(
    process.env.INTERNAL_SERVICE_TOKEN &&
    req.headers['x-internal-token'] === process.env.INTERNAL_SERVICE_TOKEN
  );
  if (!isTrusted && !canViewShifts(req)) {
    return res.status(req.userId ? 403 : 401).json({ success: false, message: 'Không có quyền truy cập.' });
  }

  try {
    const userId = Number(req.params.userId);
    const [[shift]] = await pool.query(
      `SELECT id, user_id, kiosk_id, status FROM shifts WHERE user_id = ? AND status = 'open' LIMIT 1`,
      [userId]
    );
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Không có ca làm việc nào đang mở cho nhân viên này' });
    }
    res.json({ success: true, data: shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
