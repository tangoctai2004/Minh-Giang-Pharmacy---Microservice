# Kịch bản phát triển Notification Service

Phạm vi dành cho thành viên 3: chỉ phát triển trong `backend/notification-service`. Không sửa `docker-compose.yml`, `api-gateway`, schema SQL trong `infrastructure`, frontend, hoặc service khác nếu chưa được leader duyệt.

## 1. Bối cảnh hiện tại

Notification service chạy ở port `8005`, được gateway expose qua prefix:

```text
/api/notification
```

Các route hiện có:

```text
POST /email/send
POST /sms/send
GET /templates
GET /templates/:id
POST /templates
PUT /templates/:id
DELETE /templates/:id
```

Trạng thái code hiện tại:

- `email/email.routes.js`: đã có luồng gửi email bằng Nodemailer.
- `sms/sms.routes.js`: mới là stub, trả `501 Not Implemented`.
- `templates/templates.routes.js`: mới có `GET`, các API tạo/sửa/xóa còn TODO.
- `db/pool.js`: đã dùng MySQL pool theo convention chung.
- `middlewares/gatewayAuth.js`: đã đọc header user từ API Gateway nhưng chưa được mount bắt buộc trong route.

Điểm cần chú ý trước khi code: schema thật của `mg_notification.notification_templates` đang dùng các cột:

```text
id, name, channel, subject, body_template, is_active
```

Trong khi code hiện tại đang có chỗ dùng nhầm:

```text
type, subject_template
```

Vì vậy việc đầu tiên phải làm là chỉnh code trong service để bám đúng schema hiện tại, không sửa schema chung.

## 2. Mục tiêu nghiệp vụ

Notification service chịu trách nhiệm gửi thông báo đa kênh cho hệ thống nhà thuốc:

- Gửi OTP đăng ký, quên mật khẩu, xác minh email/phone.
- Gửi email xác nhận đơn hàng.
- Gửi SMS/Zalo ZNS khi đơn hàng thay đổi trạng thái.
- Quản lý template thông báo để các service khác chỉ truyền biến dữ liệu.
- Lưu lịch sử gửi để debug, báo cáo và kiểm tra lỗi.

Ưu tiên thực tế cho đồ án:

1. Email gửi được ổn định.
2. SMS gửi qua provider thật, thiếu cấu hình thì trả lỗi rõ ràng.
3. Template CRUD chạy đúng DB.
4. Có log trong bảng `notifications`.
5. Response luôn đúng format `{ success: true/false, data/message }`.

## 3. Nguyên tắc phát triển

- Chỉ sửa file trong `backend/notification-service`.
- Không đổi contract public route nếu frontend hoặc identity-service đang gọi.
- Không nối chuỗi SQL trực tiếp, luôn dùng `?` placeholder.
- Không hard delete template, chỉ soft delete bằng `is_active = 0`.
- Không commit `.env`, chỉ cập nhật `.env.example` nếu cần thêm biến môi trường.
- Lỗi trả message tiếng Việt, response luôn có `success`.
- API cần chạy được cả Docker network và local dev.

## 4. Sprint 1 - Sửa nền tảng để chạy đúng DB

Mục tiêu: các API template và email không lỗi do sai tên cột.

Việc cần làm:

- Sửa `templates/templates.routes.js`:
  - Đổi query `type` thành `channel`.
  - Đổi `subject_template` thành `subject`.
  - Filter bằng `?channel=email|sms|zalo|push|in_app`.
  - Chỉ trả template active mặc định, có thể cho admin truyền `include_inactive=true`.

- Sửa `email/email.routes.js`:
  - Query template theo `channel = "email"`.
  - Lấy `subject` và `body_template`.
  - Giữ backward-compatible body hiện tại: `{ to, subject, html, text, template_id, template_vars }`.

- Thêm helper render template nội bộ:
  - Input: chuỗi template và object biến.
  - Cú pháp: `{{customer_name}}`, `{{otp}}`, `{{order_code}}`.
  - Nếu thiếu biến thì giữ nguyên placeholder để dễ debug.

API test sau sprint:

```text
GET  /templates
GET  /templates?channel=email
POST /email/send
```

Tiêu chí hoàn thành:

- Service start không crash.
- `GET /templates` không báo lỗi unknown column.
- Gửi email trực tiếp không dùng template vẫn hoạt động.
- Gửi email có `template_id` render đúng biến.

## 5. Sprint 2 - Hoàn thiện CRUD template

Mục tiêu: admin hoặc dev có thể tạo/sửa/xóa mềm template thông báo.

Endpoint cần hoàn thiện:

```text
POST   /templates
PUT    /templates/:id
DELETE /templates/:id
```

Request đề xuất:

```json
{
  "name": "otp_register",
  "channel": "email",
  "subject": "OTP đăng ký tài khoản",
  "body_template": "<p>Mã OTP của bạn là {{otp}}</p>",
  "is_active": 1
}
```

Validate:

- `name` bắt buộc, tối đa 100 ký tự.
- `channel` chỉ nhận `email`, `sms`, `push`, `in_app`, `zalo`.
- `body_template` bắt buộc.
- `subject` bắt buộc với `email`, optional với `sms`.
- Không cho tạo trùng cặp `(name, channel)`.

Response mẫu:

```json
{
  "success": true,
  "data": {
    "id": 1
  },
  "message": "Tạo template thành công"
}
```

Tiêu chí hoàn thành:

- Tạo template mới trả `201`.
- Tạo trùng `name + channel` trả `409`.
- Sửa template không tồn tại trả `404`.
- Xóa template là soft delete, không mất dữ liệu.

## 6. Sprint 3 - Lưu lịch sử gửi thông báo

Mục tiêu: mỗi lần gửi email/SMS đều có record trong bảng `notifications`.

Schema đang có:

```text
notifications:
id, template_id, recipient_type, recipient_id, channel,
reference_type, reference_id, payload, status, sent_at, created_at
```

Vì bảng yêu cầu `template_id`, trong sprint này nên ưu tiên log cho các request có template. Request gửi thông báo nên mở rộng nhưng vẫn giữ field cũ:

```json
{
  "to": "customer@example.com",
  "template_id": 1,
  "template_vars": {
    "otp": "123456"
  },
  "recipient_type": "customer",
  "recipient_id": 10,
  "reference_type": "otp",
  "reference_id": 99
}
```

Luồng xử lý:

1. Validate input.
2. Load template.
3. Insert `notifications` với `status = "pending"`.
4. Gửi qua provider email/SMS.
5. Nếu thành công: update `status = "sent"`, `sent_at = NOW()`.
6. Nếu lỗi: update `status = "failed"` và lưu lỗi trong `payload`.

Payload đề xuất:

```json
{
  "target": "customer@example.com",
  "template_vars": {},
  "provider": "smtp",
  "provider_message_id": "abc",
  "error": null
}
```

Tiêu chí hoàn thành:

- Gửi thành công có log `sent`.
- Gửi lỗi SMTP/SMS có log `failed`.
- API vẫn trả lỗi đúng format cho client.

## 7. Sprint 4 - SMS provider thật

Mục tiêu: `/sms/send` chỉ báo thành công khi nhà cung cấp SMS thật đã nhận request thành công.

Biến môi trường đề xuất trong `.env.example`:

```text
SMS_PROVIDER=generic_http
SMS_API_URL=https://sms-provider.example.com/send
SMS_API_KEY=your_real_sms_api_key
SMS_BRAND_NAME=MinhGiang
```

Luồng gửi thật:

- Nếu thiếu key thật, API phải trả lỗi.
- Provider hỗ trợ: `generic_http` hoặc `twilio`.
- Không dùng mock/fallback cho OTP hoặc SMS.

Request hiện tại cần giữ:

```json
{
  "phone": "0909123456",
  "message": "Ma OTP Minh Giang Pharmacy cua ban la 123456"
}
```

Request mở rộng có template:

```json
{
  "phone": "0909123456",
  "template_id": 2,
  "template_vars": {
    "otp": "123456"
  },
  "recipient_type": "customer",
  "recipient_id": 10
}
```

Tiêu chí hoàn thành:

- `identity-service` gọi `/sms/send` không còn nhận `501`.
- Local dev không cần tài khoản SMS vẫn test được OTP.
- Khi thiếu cấu hình provider thật, trả lỗi rõ ràng.

## 8. Sprint 5 - API đọc lịch sử thông báo

Mục tiêu: phục vụ admin/debug khi báo cáo.

Endpoint đề xuất:

```text
GET /notifications
GET /notifications/:id
```

Filter đề xuất:

```text
?channel=email
?status=sent
?recipient_type=customer
?recipient_id=10
?reference_type=order
?reference_id=1001
?page=1&limit=20
```

Response danh sách phải có pagination:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "pages": 0
  }
}
```

Tiêu chí hoàn thành:

- Query có phân trang.
- Filter dùng dynamic WHERE với placeholder.
- Không expose dữ liệu nhạy cảm như SMTP password, API key.

## 9. Sprint 6 - Bảo vệ route và chuẩn hóa lỗi

Mục tiêu: các route quản trị template/history chỉ cho staff/admin, route gửi nội bộ vẫn dùng được cho service khác.

Phân quyền đề xuất:

- `POST /email/send`, `POST /sms/send`: cho gateway/service nội bộ gọi.
- `GET /templates`: staff/admin.
- `POST/PUT/DELETE /templates`: admin hoặc pharmacist.
- `GET /notifications`: admin hoặc pharmacist.

Việc cần làm:

- Mount `gatewayAuth` trong `routes/index.js` hoặc từng route cần bảo vệ.
- Thêm helper `requireRole(['admin', 'pharmacist'])`.
- Trong development có thể cho phép thiếu header để dễ test, production bắt buộc qua gateway.

Tiêu chí hoàn thành:

- Request thiếu quyền trả `403`.
- Request hợp lệ vẫn chạy qua gateway.
- Không tự verify JWT trong service con.

## 10. Bộ test Postman tối thiểu

Test health:

```text
GET http://localhost:8005/health
GET http://localhost:8000/api/notification/health
```

Test template:

```text
POST http://localhost:8000/api/notification/templates
GET  http://localhost:8000/api/notification/templates?channel=email
PUT  http://localhost:8000/api/notification/templates/1
DELETE http://localhost:8000/api/notification/templates/1
```

Test email:

```text
POST http://localhost:8000/api/notification/email/send
```

Body:

```json
{
  "to": "test@example.com",
  "subject": "Test email",
  "text": "Hello from Minh Giang Pharmacy"
}
```

Test SMS provider thật:

```text
POST http://localhost:8000/api/notification/sms/send
```

Body:

```json
{
  "phone": "0909123456",
  "message": "Ma OTP Minh Giang Pharmacy cua ban la 123456"
}
```

## 11. Thứ tự commit đề xuất

```text
fix: đồng bộ notification templates với schema hiện tại
feat: hoàn thiện CRUD notification templates
feat: lưu lịch sử gửi email và sms
feat: thêm SMS provider thật cho OTP
feat: thêm API xem lịch sử notifications
fix: chuẩn hóa phân quyền notification routes
docs: thêm kịch bản phát triển notification service
```

## 12. Checklist trước khi gửi PR

- [ ] Chỉ có file trong `backend/notification-service` thay đổi.
- [ ] `npm start` hoặc `npm run dev` không crash.
- [ ] Các response đều có `success`.
- [ ] Query SQL dùng placeholder `?`.
- [ ] Không commit `.env`.
- [ ] Không hard delete template.
- [ ] OTP email từ `identity-service` vẫn gọi được `/email/send`.
- [ ] `/sms/send` không còn trả `501` sau Sprint 4.
- [ ] Có ảnh hoặc log test Postman cho các endpoint chính.

## 13. Rủi ro và cách xử lý

- SMTP Gmail dễ lỗi do thiếu App Password: dùng `.env.example` hướng dẫn rõ `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`.
- Provider SMS cần tài khoản thật: nếu chưa có key, API trả lỗi để tránh hiểu nhầm là đã gửi.
- Schema không khớp code: không sửa SQL chung, sửa query trong service theo schema hiện tại.
- Gateway chưa whitelist route: trong phạm vi này chỉ ghi chú cho leader, không tự sửa `api-gateway`.
- Bảng `notifications` bắt buộc `template_id`: với gửi trực tiếp không template, có thể chưa log ở Sprint 3 hoặc tạo một template mặc định qua API.

## 14. Definition of Done

Notification service được xem là hoàn thành ở mức đồ án khi:

- Gửi email trực tiếp và email theo template thành công.
- Gửi SMS thật thành công, không trả `501`.
- CRUD template hoạt động đầy đủ.
- Có lịch sử gửi notification trong DB.
- Identity service có thể dùng service này để gửi OTP.
- Toàn bộ thay đổi nằm trong `backend/notification-service`.

## 15. Phần phát triển thêm đã triển khai

Các hướng phát triển nâng cấp nên ưu tiên cho demo đã được bổ sung:

- Email SMTP thật: `EMAIL_PROVIDER=smtp`, cần App Password hoặc SMTP password hợp lệ.
- Seed template mặc định: tạo nhanh bộ template OTP, đơn hàng, đổi trạng thái đơn hàng.
- API thông báo đơn hàng: để `order-service` có thể gọi khi tạo đơn hoặc đổi trạng thái.
- Retry notification thất bại: gửi lại notification có `status = failed`.
- In-app notification: lưu thông báo trong DB cho frontend hiển thị dạng chuông thông báo.
- Postman collection: import file `postman/notification-service.postman_collection.json`.

Endpoint mới:

```text
POST /templates/seed-defaults
POST /orders/created
POST /orders/status-changed
POST /notifications/:id/retry
POST /in-app/send
GET /in-app/mine
PUT /in-app/:id/read
```

Test Postman đề xuất:

1. Seed template mặc định:

```text
POST http://localhost:8005/templates/seed-defaults
```

2. Gửi email SMTP thật:

```text
POST http://localhost:8005/email/send
```

```json
{
  "to": "customer@example.com",
  "subject": "Test email SMTP thật",
  "text": "Email này phải được gửi qua SMTP thật"
}
```

3. Gửi thông báo đơn hàng mới:

```text
POST http://localhost:8005/orders/created
```

```json
{
  "order_id": 1001,
  "order_code": "MG-1001",
  "customer_name": "Nguyen Van A",
  "total_amount": 250000,
  "email": "customer@example.com",
  "phone": "0909123456",
  "recipient_type": "customer",
  "recipient_id": 1
}
```

4. Gửi thông báo đổi trạng thái đơn hàng:

```text
POST http://localhost:8005/orders/status-changed
```

```json
{
  "order_id": 1001,
  "order_code": "MG-1001",
  "customer_name": "Nguyen Van A",
  "status": "confirmed",
  "email": "customer@example.com",
  "phone": "0909123456",
  "recipient_type": "customer",
  "recipient_id": 1
}
```

5. Xem log:

```text
GET http://localhost:8005/notifications?reference_type=order&reference_id=1001
```

6. Retry notification failed:

```text
POST http://localhost:8005/notifications/1/retry
```

7. Tạo in-app notification:

```text
POST http://localhost:8005/in-app/send
```

```json
{
  "recipient_type": "customer",
  "recipient_id": 1,
  "title": "Don hang moi",
  "body": "Don hang MG-1001 cua ban da duoc ghi nhan",
  "reference_type": "order",
  "reference_id": 1001
}
```

8. Xem in-app notification của user:

```text
GET http://localhost:8005/in-app/mine?recipient_type=customer&recipient_id=1
```

9. Đánh dấu đã đọc:

```text
PUT http://localhost:8005/in-app/1/read
```
