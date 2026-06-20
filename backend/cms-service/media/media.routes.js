/**
 * media.routes.js — Quản lý thư viện media (ảnh, tài liệu, video)
 *
 * Module này quản lý METADATA của media đã được upload lên storage.
 * (Không xử lý upload thực tế — cần tích hợp Multer/S3 trong phiên bản sau)
 *
 * Staff+:
 *   GET  /media             — Danh sách media (filter + pagination)
 *   GET  /media/:id         — Chi tiết media
 *   POST /media             — Đăng ký metadata (URL đã có từ bên ngoài)
 *   DELETE /media/:id       — Soft delete (is_deleted = 1)
 *
 * Admin:
 *   GET  /media/admin/stats — Thống kê thư viện (tổng file, dung lượng)
 */
const router = require('express').Router();
const pool = require('../db/pool');
const requireRoles = require('../middlewares/requireRoles');
const { requireFields, validateEnum } = require('../middlewares/validate');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const MEDIA_TYPES = ['image', 'document', 'video', 'other'];

// Whitelist extension theo schema DB constraint
const SAFE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4', 'mov', 'webm', 'csv', 'xlsx', 'xls', 'doc', 'docx'];

const canRead = requireRoles(['admin', 'manager', 'pharmacist', 'staff']);
const canWrite = requireRoles(['admin', 'manager']);
const canDelete = requireRoles(['admin']);

// ──────────────────────────────────────────────
// STAFF+ ROUTES
// ──────────────────────────────────────────────

/**
 * GET /media
 * Query params:
 *   ?media_type=image|document|video|other   — lọc theo loại
 *   ?used_in=articles|banners|products        — lọc theo nơi dùng
 *   ?q=tên file                              — tìm theo tên
 *   ?page=1&limit=20
 */
router.get('/', canRead, async (req, res) => {
  try {
    const { media_type, used_in, q, page = 1, limit = 20 } = req.query;
    const offset = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit) || 20);
    const pageLimit = Math.min(50, Number(limit) || 20);

    const conditions = ['is_deleted = 0'];
    const params = [];

    if (media_type && MEDIA_TYPES.includes(media_type)) {
      conditions.push('media_type = ?');
      params.push(media_type);
    }
    if (used_in) {
      conditions.push('used_in = ?');
      params.push(used_in);
    }
    if (q && q.trim()) {
      conditions.push('(original_name LIKE ? OR alt_text LIKE ?)');
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM cms_media ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT id, original_name, file_url, thumbnail_url, file_size,
              mime_type, media_type, width, height, alt_text, tags,
              used_in, used_in_id, created_at
       FROM cms_media ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    res.json({
      success: true,
      data: rows,
      meta: {
        total: Number(total),
        page: Number(page),
        limit: pageLimit,
        total_pages: Math.ceil(Number(total) / pageLimit),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /media/admin/stats — Thống kê thư viện
 */
router.get('/admin/stats', canWrite, async (req, res) => {
  try {
    const [stats] = await pool.query(
      `SELECT
         media_type,
         COUNT(*) AS count,
         SUM(file_size) AS total_bytes
       FROM cms_media
       WHERE is_deleted = 0
       GROUP BY media_type`
    );

    const [[{ total_files, total_size }]] = await pool.query(
      `SELECT COUNT(*) AS total_files, COALESCE(SUM(file_size), 0) AS total_size
       FROM cms_media WHERE is_deleted = 0`
    );

    res.json({
      success: true,
      data: {
        total_files: Number(total_files),
        total_size_bytes: Number(total_size),
        total_size_mb: (Number(total_size) / 1024 / 1024).toFixed(2),
        by_type: stats,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /media/:id — Chi tiết media
 */
router.get('/:id', canRead, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      'SELECT * FROM cms_media WHERE id = ? AND is_deleted = 0',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy media' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /media — Đăng ký metadata media
 * Body: { original_name, stored_name, file_url, file_size, mime_type, media_type,
 *          thumbnail_url?, width?, height?, alt_text?, tags?, used_in?, used_in_id? }
 */
router.post(
  '/',
  canWrite,
  validateEnum('media_type', MEDIA_TYPES),
  async (req, res) => {
    try {
      const {
        original_name,
        stored_name,
        file_url,
        file_size,
        mime_type,
        media_type,
        data_base64,
        thumbnail_url = null,
        width = null,
        height = null,
        alt_text = null,
        tags = null,
        used_in = null,
        used_in_id = null,
      } = req.body;

      if (!original_name || !mime_type || !media_type) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu các trường bắt buộc: original_name, mime_type, media_type'
        });
      }

      let finalStoredName = stored_name;
      let finalFileUrl = file_url;
      let finalFileSize = file_size;
      let finalWidth = width ? Number(width) : null;
      let finalHeight = height ? Number(height) : null;

      if (data_base64) {
        let buffer = Buffer.from(data_base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''), 'base64');
        if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
          return res.status(400).json({ success: false, message: 'Dung lượng ảnh phải lớn hơn 0 và không quá 8MB' });
        }

        const isResizableImage = mime_type.startsWith('image/') && mime_type !== 'image/gif';
        if (isResizableImage) {
          try {
            const Jimp = require('jimp');
            const image = await Jimp.read(buffer);
            if (image.bitmap.width > 1200 || image.bitmap.height > 1200) {
              image.scaleToFit(1200, 1200);
            }
            image.quality(85);
            buffer = await image.getBufferAsync(mime_type);
            finalWidth = image.bitmap.width;
            finalHeight = image.bitmap.height;
          } catch (jimpErr) {
            console.error('Jimp image resize error in CMS:', jimpErr);
          }
        }

        const ext = mime_type === 'image/png' ? 'png' : (mime_type === 'image/webp' ? 'webp' : (mime_type === 'image/gif' ? 'gif' : 'jpg'));
        const safeOriginalName = path.basename(String(original_name), path.extname(String(original_name))).replace(/[^a-zA-Z0-9_-]/g, '');
        finalStoredName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeOriginalName}.${ext}`;
        
        const uploadDir = path.join(__dirname, '..', 'uploads', 'cms');
        await fs.mkdir(uploadDir, { recursive: true });
        const fullPath = path.join(uploadDir, finalStoredName);
        await fs.writeFile(fullPath, buffer);

        finalFileUrl = `/uploads/cms/${finalStoredName}`;
        finalFileSize = buffer.length;
      } else {
        if (!stored_name || !file_url || !file_size) {
          return res.status(400).json({
            success: false,
            message: 'Thiếu thông tin file: stored_name, file_url, file_size khi không có data_base64'
          });
        }
      }

      const ext = finalStoredName.split('.').pop()?.toLowerCase();
      if (!ext || !SAFE_EXTENSIONS.includes(ext)) {
        return res.status(400).json({
          success: false,
          message: `Extension .${ext} không được phép. Chỉ chấp nhận: ${SAFE_EXTENSIONS.join(', ')}`
        });
      }

      if (Number(finalFileSize) <= 0) {
        return res.status(400).json({ success: false, message: 'file_size phải lớn hơn 0' });
      }

      const [result] = await pool.query(
        `INSERT INTO cms_media
           (original_name, stored_name, file_url, thumbnail_url, file_size,
            mime_type, media_type, width, height, alt_text, tags,
            used_in, used_in_id, uploaded_by, file_extension)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          original_name,
          finalStoredName,
          finalFileUrl,
          thumbnail_url || finalFileUrl,
          Number(finalFileSize),
          mime_type,
          media_type,
          finalWidth,
          finalHeight,
          alt_text || original_name,
          tags ? JSON.stringify(tags) : null,
          used_in,
          used_in_id ? Number(used_in_id) : null,
          req.userId || null,
          ext,
        ]
      );

      res.status(201).json({ success: true, data: { id: result.insertId, file_url: finalFileUrl } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * DELETE /media/:id — Soft delete (is_deleted = 1)
 */
router.delete('/:id', canDelete, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.query(
      'UPDATE cms_media SET is_deleted = 1, deleted_at = NOW() WHERE id = ? AND is_deleted = 0',
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy media hoặc đã bị xoá' });
    }
    res.json({ success: true, message: 'Media đã bị xoá khỏi thư viện' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
