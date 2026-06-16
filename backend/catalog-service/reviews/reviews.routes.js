const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');

const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'hidden'];
const canModerateReviews = requireRoles(['admin', 'manager', 'pharmacist']);

function toPositiveInt(value, fallback = 1) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanText(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : null;
}

function maskName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Khách hàng Minh Giang';
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}***`;
}

function getReviewSafetyIssue(comment = '') {
  const text = String(comment || '').toLowerCase();
  const riskyPatterns = [
    'uống gấp đôi',
    'uống quá liều',
    'tự tăng liều',
    'thay thuốc bác sĩ',
    'bỏ thuốc bác sĩ',
    'chữa khỏi',
    'khỏi hẳn',
    'cam kết khỏi',
  ];
  return riskyPatterns.find((pattern) => text.includes(pattern)) || null;
}

async function getProduct(productId) {
  const [[product]] = await pool.query(
    `SELECT id, name, requires_prescription, status
     FROM products
     WHERE id = ?`,
    [productId]
  );
  return product || null;
}

async function getVerifiedPurchase(customerId, productId) {
  if (!customerId || !productId) return null;
  const [rows] = await pool.query(
    `SELECT o.id AS order_id, oi.id AS order_item_id, o.created_at
     FROM mg_order.orders o
     JOIN mg_order.order_items oi ON oi.order_id = o.id
     WHERE o.customer_id = ?
       AND oi.product_id = ?
       AND o.order_status = 'completed'
       AND COALESCE(o.is_active, 1) = 1
       AND COALESCE(oi.is_active, 1) = 1
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT 1`,
    [customerId, productId]
  );
  return rows[0] || null;
}

async function getCustomer(customerId) {
  if (!customerId) return null;
  const [[customer]] = await pool.query(
    `SELECT id, full_name, code
     FROM mg_identity.customers
     WHERE id = ?
       AND deleted_at IS NULL
       AND is_active = 1`,
    [customerId]
  );
  return customer || null;
}

async function getReviewSummary(productId) {
  const [rows] = await pool.query(
    `SELECT rating, COUNT(*) AS count
     FROM product_reviews
     WHERE product_id = ?
       AND status = 'approved'
     GROUP BY rating`,
    [productId]
  );
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((row) => {
    counts[Number(row.rating)] = Number(row.count || 0);
  });
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const ratingSum = Object.entries(counts).reduce((sum, [rating, count]) => sum + Number(rating) * count, 0);
  const average = total > 0 ? Number((ratingSum / total).toFixed(1)) : 0;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: counts[rating],
    percent: total > 0 ? Math.round((counts[rating] / total) * 100) : 0,
  }));
  return { average, total, distribution };
}

function publicReview(row) {
  return {
    id: row.id,
    product_id: row.product_id,
    rating: Number(row.rating),
    title: row.title,
    comment: row.comment,
    is_verified_purchase: Boolean(Number(row.is_verified_purchase || 0)),
    customer_name: maskName(row.customer_name),
    created_at: row.created_at,
  };
}

router.get('/products/:productId/reviews/summary', async (req, res) => {
  try {
    const productId = toPositiveInt(req.params.productId, 0);
    if (!productId) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });

    const product = await getProduct(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    res.json({ success: true, data: await getReviewSummary(productId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/products/:productId/reviews', async (req, res) => {
  try {
    const productId = toPositiveInt(req.params.productId, 0);
    const page = toPositiveInt(req.query.page, 1);
    const limit = clamp(toPositiveInt(req.query.limit, 5), 1, 30);
    const offset = (page - 1) * limit;

    if (!productId) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });

    const product = await getProduct(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM product_reviews
       WHERE product_id = ?
         AND status = 'approved'`,
      [productId]
    );
    const [rows] = await pool.query(
      `SELECT pr.*, c.full_name AS customer_name
       FROM product_reviews pr
       LEFT JOIN mg_identity.customers c ON c.id = pr.customer_id
       WHERE pr.product_id = ?
         AND pr.status = 'approved'
       ORDER BY pr.created_at DESC, pr.id DESC
       LIMIT ? OFFSET ?`,
      [productId, limit, offset]
    );

    res.json({
      success: true,
      data: rows.map(publicReview),
      pagination: {
        page,
        limit,
        total: Number(countRow.total || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/products/:productId/reviews/eligibility', async (req, res) => {
  try {
    const productId = toPositiveInt(req.params.productId, 0);
    if (!productId) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });

    if (!req.userId || req.userType !== 'customer') {
      return res.json({
        success: true,
        data: { can_review: false, reason: 'login_required', message: 'Đăng nhập để viết đánh giá sau khi mua hàng.' },
      });
    }

    const product = await getProduct(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const [[existing]] = await pool.query(
      `SELECT id, status
       FROM product_reviews
       WHERE product_id = ?
         AND customer_id = ?
       LIMIT 1`,
      [productId, req.userId]
    );
    if (existing) {
      return res.json({
        success: true,
        data: { can_review: false, reason: 'already_reviewed', review_status: existing.status, message: 'Bạn đã gửi đánh giá cho sản phẩm này.' },
      });
    }

    const purchase = await getVerifiedPurchase(req.userId, productId);
    if (!purchase) {
      return res.json({
        success: true,
        data: { can_review: false, reason: 'purchase_required', message: 'Chỉ khách đã mua sản phẩm và hoàn tất đơn hàng mới có thể đánh giá.' },
      });
    }

    res.json({
      success: true,
      data: {
        can_review: true,
        reason: null,
        order_id: purchase.order_id,
        order_item_id: purchase.order_item_id,
        message: 'Bạn có thể gửi đánh giá. Đánh giá sẽ hiển thị sau khi nhà thuốc duyệt.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/products/:productId/reviews', async (req, res) => {
  try {
    const productId = toPositiveInt(req.params.productId, 0);
    const rating = Number.parseInt(req.body.rating, 10);
    const title = cleanText(req.body.title, 160);
    const comment = cleanText(req.body.comment, 1200);

    if (!productId) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });
    if (!req.userId || req.userType !== 'customer') {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập bằng tài khoản khách hàng để đánh giá.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn số sao từ 1 đến 5.' });
    }
    if (!comment || comment.length < 10) {
      return res.status(400).json({ success: false, message: 'Nội dung đánh giá cần ít nhất 10 ký tự.' });
    }

    const product = await getProduct(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });

    const customer = await getCustomer(req.userId);
    if (!customer) return res.status(403).json({ success: false, message: 'Tài khoản khách hàng không còn hoạt động.' });

    const [[existing]] = await pool.query(
      `SELECT id FROM product_reviews WHERE product_id = ? AND customer_id = ? LIMIT 1`,
      [productId, req.userId]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Bạn đã gửi đánh giá cho sản phẩm này.' });
    }

    const purchase = await getVerifiedPurchase(req.userId, productId);
    if (!purchase) {
      return res.status(403).json({ success: false, message: 'Chỉ khách đã mua sản phẩm và hoàn tất đơn hàng mới có thể đánh giá.' });
    }

    const safetyIssue = getReviewSafetyIssue(`${title || ''} ${comment || ''}`);
    const moderationNote = safetyIssue
      ? `Hệ thống lưu ý nội dung có cụm từ nhạy cảm: ${safetyIssue}`
      : null;

    const [result] = await pool.query(
      `INSERT INTO product_reviews (
         product_id, customer_id, order_id, order_item_id, rating, title, comment,
         status, is_verified_purchase, moderation_note
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?)`,
      [productId, req.userId, purchase.order_id, purchase.order_item_id, rating, title, comment, moderationNote]
    );

    res.status(201).json({
      success: true,
      message: 'Đã gửi đánh giá. Nhà thuốc sẽ kiểm duyệt trước khi hiển thị.',
      data: { id: result.insertId, status: 'pending' },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/reviews', canModerateReviews, async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1);
    const limit = clamp(toPositiveInt(req.query.limit, 20), 1, 100);
    const offset = (page - 1) * limit;
    const status = REVIEW_STATUSES.includes(req.query.status) ? req.query.status : null;
    const rating = req.query.rating ? Number.parseInt(req.query.rating, 10) : null;
    const productId = req.query.product_id ? toPositiveInt(req.query.product_id, 0) : null;
    const q = cleanText(req.query.q, 120);

    const where = [];
    const params = [];
    if (status) {
      where.push('pr.status = ?');
      params.push(status);
    }
    if (rating && rating >= 1 && rating <= 5) {
      where.push('pr.rating = ?');
      params.push(rating);
    }
    if (productId) {
      where.push('pr.product_id = ?');
      params.push(productId);
    }
    if (q) {
      where.push('(p.name LIKE ? OR c.full_name LIKE ? OR pr.comment LIKE ? OR pr.title LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM product_reviews pr
       JOIN products p ON p.id = pr.product_id
       LEFT JOIN mg_identity.customers c ON c.id = pr.customer_id
       ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT pr.*, p.name AS product_name, p.sku AS product_sku,
              c.full_name AS customer_name, c.phone AS customer_phone
       FROM product_reviews pr
       JOIN products p ON p.id = pr.product_id
       LEFT JOIN mg_identity.customers c ON c.id = pr.customer_id
       ${whereSql}
       ORDER BY FIELD(pr.status, 'pending', 'approved', 'rejected', 'hidden'), pr.created_at DESC, pr.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        rating: Number(row.rating),
        is_verified_purchase: Boolean(Number(row.is_verified_purchase || 0)),
      })),
      pagination: { page, limit, total: Number(countRow.total || 0) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/admin/reviews/:id/:action', canModerateReviews, async (req, res) => {
  try {
    const reviewId = toPositiveInt(req.params.id, 0);
    const action = req.params.action;
    const allowedActions = ['approve', 'reject', 'hide'];
    if (!reviewId || !allowedActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Thao tác kiểm duyệt không hợp lệ.' });
    }

    const statusByAction = {
      approve: 'approved',
      reject: 'rejected',
      hide: 'hidden',
    };
    const status = statusByAction[action];
    const moderationNote = cleanText(req.body.moderation_note, 500);

    const [result] = await pool.query(
      `UPDATE product_reviews
       SET status = ?,
           moderation_note = ?,
           approved_at = CASE WHEN ? = 'approved' THEN NOW() ELSE approved_at END,
           approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
           hidden_at = CASE WHEN ? = 'hidden' THEN NOW() ELSE hidden_at END
       WHERE id = ?`,
      [status, moderationNote, status, status, req.userId || null, status, reviewId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đánh giá.' });
    }

    res.json({ success: true, message: 'Đã cập nhật trạng thái đánh giá.', data: { id: reviewId, status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
