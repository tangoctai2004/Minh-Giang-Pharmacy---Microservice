const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const routes = require('./routes');

const app  = express();
const PORT = process.env.PORT || 8001;

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', routes);

// ── Health check (Gateway gọi để kiểm tra service alive) ─────────────────────
app.get('/health', (req, res) => {
  res.json({
    service:   'identity-service',
    status:    'ok',
    uptime:    `${process.uptime().toFixed(1)}s`,
    timestamp: new Date().toISOString(),
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[identity-service ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ',
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[identity-service] ✅  http://localhost:${PORT}`);
});
