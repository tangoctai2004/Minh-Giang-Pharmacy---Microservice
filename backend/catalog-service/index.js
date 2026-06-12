const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const path    = require('path');
require('dotenv').config();

const routes = require('./routes');
const requestContext = require('./middlewares/requestContext');
const monitoring = require('./middlewares/monitoring');
const logger = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 8002;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '12mb' }));
app.use(requestContext);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/', routes);

app.get('/health', (req, res) => {
  res.json({ service: 'catalog-service', status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/metrics', (req, res) => {
  res.json({ success: true, data: monitoring.snapshot() });
});

app.use((err, req, res, _next) => {
  logger.error('unhandled_error', {
    requestId: req.requestId || null,
    path: req.originalUrl,
    message: err.message,
    stack: err.stack,
  });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Lỗi máy chủ nội bộ' });
});

app.listen(PORT, () => {
  logger.info('service_started', { port: PORT, url: `http://localhost:${PORT}` });
});
