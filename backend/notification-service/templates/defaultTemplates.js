module.exports = [
  {
    name: 'otp_sms',
    channel: 'sms',
    subject: null,
    body_template: 'Ma OTP Minh Giang Pharmacy cua ban la {{otp}}. Ma co hieu luc {{ttl_minutes}} phut.',
  },
  {
    name: 'otp_email',
    channel: 'email',
    subject: 'Ma OTP xac thuc - Minh Giang Pharmacy',
    body_template: '<p>Ma OTP cua ban la <b>{{otp}}</b>.</p><p>Ma co hieu luc {{ttl_minutes}} phut.</p>',
  },
  {
    name: 'order_created_sms',
    channel: 'sms',
    subject: null,
    body_template: 'Don hang {{order_code}} da duoc ghi nhan. Tong tien: {{total_amount}} VND.',
  },
  {
    name: 'order_created_email',
    channel: 'email',
    subject: 'Minh Giang Pharmacy da nhan don hang {{order_code}}',
    body_template: '<p>Xin chao {{customer_name}},</p><p>Don hang {{order_code}} da duoc ghi nhan.</p><p>Tong tien: {{total_amount}} VND.</p>',
  },
  {
    name: 'order_status_sms',
    channel: 'sms',
    subject: null,
    body_template: 'Don hang {{order_code}} da chuyen sang trang thai: {{status_label}}.',
  },
  {
    name: 'order_status_email',
    channel: 'email',
    subject: 'Cap nhat don hang {{order_code}}',
    body_template: '<p>Xin chao {{customer_name}},</p><p>Don hang {{order_code}} da chuyen sang trang thai: <b>{{status_label}}</b>.</p>',
  },
  {
    name: 'password_reset_sms',
    channel: 'sms',
    subject: null,
    body_template: 'Ma dat lai mat khau Minh Giang Pharmacy cua ban la {{otp}}.',
  },
  {
    name: 'password_reset_email',
    channel: 'email',
    subject: 'Dat lai mat khau Minh Giang Pharmacy',
    body_template: '<p>Ma dat lai mat khau cua ban la <b>{{otp}}</b>.</p>',
  },
  {
    name: 'in_app_general',
    channel: 'in_app',
    subject: '{{title}}',
    body_template: '{{body}}',
  },
];
