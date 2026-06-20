const amqp = require('amqplib');

const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const queueName = 'flashsale_orders';

let connection = null;
let channel = null;
let isConnected = false;

async function connectRabbitMQ() {
  if (isConnected) return;
  try {
    console.log(`[RabbitMQ] Connecting to RabbitMQ at ${rabbitmqUrl}...`);
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    await channel.assertQueue(queueName, { durable: true });
    isConnected = true;
    console.log(`[RabbitMQ] Connected successfully and queue "${queueName}" asserted.`);
  } catch (err) {
    console.error('[RabbitMQ Connection Failed]:', err.message);
  }
}

async function publishFlashsaleOrder(payload) {
  if (!isConnected) await connectRabbitMQ();
  try {
    const msgBuffer = Buffer.from(JSON.stringify(payload));
    channel.sendToQueue(queueName, msgBuffer, { persistent: true });
    console.log(`[RabbitMQ] Published flashsale order for user ${payload.customer_id || payload.customer_phone} to queue.`);
    return true;
  } catch (err) {
    console.error('[RabbitMQ Publish Error]:', err.message);
    return false;
  }
}

module.exports = {
  connectRabbitMQ,
  publishFlashsaleOrder,
  getChannel: () => channel,
  getConnection: () => connection,
  isConnected: () => isConnected
};
