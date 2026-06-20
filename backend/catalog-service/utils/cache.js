const { createClient } = require('redis');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = process.env.REDIS_PORT || 6379;

const client = createClient({
  url: `redis://${redisHost}:${redisPort}`
});

let isReady = false;

client.on('error', (err) => {
  console.error('[Redis Cache Error]:', err.message);
  isReady = false;
});

client.on('connect', () => {
  console.log(`[Redis Cache] Connecting to Redis at ${redisHost}:${redisPort}...`);
});

client.on('ready', () => {
  console.log('[Redis Cache] Connected and ready to use!');
  isReady = true;
});

client.on('end', () => {
  console.warn('[Redis Cache] Connection closed.');
  isReady = false;
});

// Khởi chạy kết nối bất đồng bộ
client.connect().catch((err) => {
  console.error('[Redis Cache] Connection failed, caching is disabled.', err.message);
});

module.exports = {
  async get(key) {
    if (!isReady) return null;
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error(`[Redis Cache] GET error for key ${key}:`, err.message);
      return null;
    }
  },

  async set(key, value, ttlSeconds = 300) {
    if (!isReady) return false;
    try {
      const serialized = JSON.stringify(value);
      await client.set(key, serialized, {
        EX: ttlSeconds
      });
      return true;
    } catch (err) {
      console.error(`[Redis Cache] SET error for key ${key}:`, err.message);
      return false;
    }
  },

  async del(key) {
    if (!isReady) return false;
    try {
      await client.del(key);
      return true;
    } catch (err) {
      console.error(`[Redis Cache] DEL error for key ${key}:`, err.message);
      return false;
    }
  },

  async clearByPrefix(prefix) {
    if (!isReady) return false;
    try {
      let cursor = 0;
      do {
        // Sử dụng SCAN thay thế KEYS để không chặn CPU của Redis
        const reply = await client.scan(cursor, {
          MATCH: `${prefix}*`,
          COUNT: 100
        });
        cursor = reply.cursor;
        const keys = reply.keys;
        if (keys.length > 0) {
          await client.del(keys);
        }
      } while (cursor !== 0);
      return true;
    } catch (err) {
      console.error(`[Redis Cache] clearByPrefix error for prefix ${prefix}:`, err.message);
      return false;
    }
  }
};
