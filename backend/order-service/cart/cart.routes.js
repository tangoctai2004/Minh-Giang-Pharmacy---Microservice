const router = require('express').Router();

// GET /cart
router.get('/',             (req, res) => res.status(501).json({ success: false, message: 'TODO: GET /cart — lấy giỏ hàng hiện tại của customer' }));
// POST /cart/items — Thêm sản phẩm
router.post('/items',       (req, res) => res.status(501).json({ success: false, message: 'TODO: POST /cart/items — thêm sản phẩm vào giỏ' }));
// PUT /cart/items/:id — Đổi số lượng
router.put('/items/:id',    (req, res) => res.status(501).json({ success: false, message: 'TODO: PUT /cart/items/:id — đổi số lượng' }));
// DELETE /cart/items/:id
router.delete('/items/:id', (req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /cart/items/:id — xoá khỏi giỏ' }));
// DELETE /cart — Xoá toàn bộ giỏ
router.delete('/',          (req, res) => res.status(501).json({ success: false, message: 'TODO: DELETE /cart — xoá toàn bộ giỏ hàng' }));

module.exports = router;
