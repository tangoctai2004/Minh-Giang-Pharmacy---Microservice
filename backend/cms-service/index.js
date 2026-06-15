const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const routes = require('./routes');

const path = require('path');

const app  = express();
const PORT = process.env.PORT || 8004;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/', routes);

app.get('/health', (req, res) => {
  res.json({ service: 'cms-service', status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error('[cms-service ERROR]', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Lỗi máy chủ nội bộ' });
});

app.listen(PORT, () => {
  console.log(`[cms-service] ✅  http://localhost:${PORT}`);
});
