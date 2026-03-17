const router = require('express').Router();
const pool   = require('../db/pool');

/**
 * Batches Routes — Phiếu nhập hàng (mg_catalog.batches + batch_items)
 *
 * GET  /batches          — Danh sách phiếu nhập ✅
 * GET  /batches/:id      — Chi tiết phiếu nhập kèm batch_items ✅
 * POST /batches          — Tạo phiếu nhập mới (TODO)
 * PUT  /batches/:id      — Cập nhật phiếu (chỉ khi status=draft) (TODO)
 */

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.code, b.status, b.invoice_number,
              s.name AS supplier_name,
              b.total_amount, b.paid_amount, b.received_at, b.created_at
       FROM batches b
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       ORDER BY b.created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[batch]] = await pool.query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (!batch) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
    const [items] = await pool.query(
      `SELECT bi.*, p.name AS product_name, p.code AS product_code, p.unit
       FROM batch_items bi
       LEFT JOIN products p ON p.id = bi.product_id
       WHERE bi.batch_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...batch, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /batches — tạo phiếu nhập hàng' }));
router.put('/:id', (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /batches/:id' }));

module.exports = router;
