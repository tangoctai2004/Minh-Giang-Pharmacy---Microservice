const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
require('dotenv').config();

const routes = require('./routes');

const app  = express();
const PORT = process.env.PORT || 8003;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/', routes);

app.get('/health', (req, res) => {
  res.json({ service: 'order-service', status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error('[order-service ERROR]', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Lỗi máy chủ nội bộ' });
});

const { connectRedis } = require('./utils/redis');
const { connectRabbitMQ } = require('./utils/rabbitmq');
const { startFlashsaleWorker } = require('./workers/flashsale.worker');

app.listen(PORT, async () => {
  console.log(`[order-service] ✅  http://localhost:${PORT}`);
  
  // Initialize Redis and RabbitMQ connections and start background workers
  try {
    await connectRedis();
    await connectRabbitMQ();
    startFlashsaleWorker();
  } catch (err) {
    console.error('[order-service Initialization Failed]:', err.message);
  }
});
