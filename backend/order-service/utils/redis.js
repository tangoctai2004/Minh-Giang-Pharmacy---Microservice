const { createClient } = require('redis');

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisUrl = `redis://${redisHost}:${redisPort}`;

const redisClient = createClient({ url: redisUrl });
const redisSubscriber = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('[Redis Client Error]:', err));
redisSubscriber.on('error', (err) => console.error('[Redis Subscriber Error]:', err));

let isConnected = false;

// Lua script for atomic stock deduction and setting reservation slot
const deductStockScript = `
  local stockKey = KEYS[1]
  local reservationKey = KEYS[2]
  local qty = tonumber(ARGV[1])
  local ttl = tonumber(ARGV[2])

  local currentStock = redis.call('get', stockKey)
  if not currentStock or tonumber(currentStock) < qty then
      return 0 -- Out of stock / not preheated
  end

  redis.call('decrby', stockKey, qty)
  redis.call('set', reservationKey, qty, 'EX', ttl)
  return 1 -- Success
`;

let deductStockSha = null;

async function connectRedis() {
  if (isConnected) return;
  try {
    console.log(`[Redis] Connecting to Redis at ${redisUrl}...`);
    await redisClient.connect();
    await redisSubscriber.connect();
    isConnected = true;
    console.log('[Redis] Connected successfully!');

    // Enable keyspace events for expired keys
    try {
      await redisClient.configSet('notify-keyspace-events', 'Ex');
      console.log('[Redis] Keyspace notifications enabled ("Ex")');
    } catch (e) {
      console.warn('[Redis Warning] Failed to configSet notify-keyspace-events. Ensure it is enabled in redis.conf:', e.message);
    }

    // Load Lua script
    deductStockSha = await redisClient.scriptLoad(deductStockScript);
    console.log('[Redis] Lua stock deduction script loaded.');

    // Setup reservation expiration listener
    setupExpirationListener();
  } catch (err) {
    console.error('[Redis Connection Failed]:', err.message);
  }
}

function setupExpirationListener() {
  // Listen to expired keys in database 0
  const expiredChannel = '__keyevent@0__:expired';
  redisSubscriber.subscribe(expiredChannel, async (message) => {
    // Expected key format: flashsale:reservation:<user_id>:<product_id>
    if (message.startsWith('flashsale:reservation:')) {
      const parts = message.split(':');
      if (parts.length >= 4) {
        const productId = parts[3];
        console.log(`[Redis Expiry] Reservation expired for product ${productId}. Restoring stock by 1.`);
        try {
          const stockKey = `flashsale:stock:${productId}`;
          await redisClient.incrBy(stockKey, 1);
        } catch (err) {
          console.error('[Redis Expiry Error] Failed to restore stock:', err.message);
        }
      }
    }
  });
  console.log('[Redis] Subscribed to expired key events.');
}

async function reserveStock(userId, productId, qty = 1, ttl = 10) {
  if (!isConnected) await connectRedis();
  const stockKey = `flashsale:stock:${productId}`;
  const reservationKey = `flashsale:reservation:${userId}:${productId}`;

  try {
    const result = await redisClient.evalSha(deductStockSha, {
      keys: [stockKey, reservationKey],
      arguments: [String(qty), String(ttl)]
    });
    return result === 1; // true if success, false if out of stock
  } catch (err) {
    // Fallback to plain eval if SHA is not found (e.g., redis restarted)
    if (err.message.includes('NOSCRIPT')) {
      const result = await redisClient.eval(deductStockScript, {
        keys: [stockKey, reservationKey],
        arguments: [String(qty), String(ttl)]
      });
      return result === 1;
    }
    throw err;
  }
}

module.exports = {
  redisClient,
  connectRedis,
  reserveStock,
  isConnected: () => isConnected
};
