const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const routes = require('./routes');

const app  = express();
const PORT = process.env.PORT || 8005;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/', routes);

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error('[notification-service ERROR]', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Lỗi máy chủ nội bộ' });
});

app.listen(PORT, () => {
  console.log(`[notification-service] ✅  http://localhost:${PORT}`);
});
