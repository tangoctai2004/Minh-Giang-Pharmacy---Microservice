/**
 * toSlug — Chuyển đổi tiêu đề tiếng Việt sang URL slug SEO-friendly.
 * Ví dụ: "Bệnh Gút - Nguyên nhân và điều trị" → "benh-gut-nguyen-nhan-va-dieu-tri"
 */
function toSlug(value = '') {
  return String(value)
    .normalize('NFD')                         // Tách dấu khỏi chữ
    .replace(/[\u0300-\u036f]/g, '')          // Xoá dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')   // Xử lý đặc biệt chữ đ/Đ
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')             // Thay ký tự không hợp lệ bằng -
    .replace(/^-+|-+$/g, '');                 // Xoá dấu - đầu/cuối
}

/**
 * sanitizeHtml — Loại bỏ các thẻ và thuộc tính nguy hiểm khỏi HTML.
 * Đây là basic sanitizer phía server. Cho production nên dùng sanitize-html package.
 * Theo yêu cầu schema: content_sanitized PHẢI được render thay vì content thô.
 */
function sanitizeHtml(html = '') {
  if (!html) return '';
  // Xoá script tags và event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')  // Remove event handlers
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '');
}

module.exports = { toSlug, sanitizeHtml };
