const pool = require('../db/pool');
const rabbitmq = require('../utils/rabbitmq');

async function startFlashsaleWorker() {
    // Wait until rabbitmq utility is connected
    if (!rabbitmq.isConnected()) {
        await rabbitmq.connectRabbitMQ();
    }

    const channel = rabbitmq.getChannel();
    if (!channel) {
        console.error('[Flashsale Worker] Cannot get RabbitMQ channel. Worker failed to start.');
        return;
    }

    const queueName = 'flashsale_orders';
    await channel.assertQueue(queueName, { durable: true });
    
    // Set prefetch to 1 to distribute load evenly and avoid overloading DB
    channel.prefetch(1);

    console.log(`[Flashsale Worker] Consumer worker started. Listening on queue "${queueName}"...`);

    channel.consume(queueName, async (msg) => {
        if (!msg) return;

        let payload;
        try {
            payload = JSON.parse(msg.content.toString());
        } catch (err) {
            console.error('[Flashsale Worker] Failed to parse message payload:', err.message);
            channel.ack(msg);
            return;
        }

        console.log(`[Flashsale Worker] Processing flashsale order for user: ${payload.customer_name || payload.customer_phone}`);
        
        const success = await createFlashsaleOrderTransaction(payload);
        if (success) {
            channel.ack(msg);
            console.log(`[Flashsale Worker] Order successfully created and processed.`);
        } else {
            // Requeue the message if it's a temporary DB error, or ack to discard if fatal
            // For safety in this system, we will log the failure and acknowledge to avoid infinite loops,
            // or we could retry up to N times. Let's acknowledge to avoid deadlock, but log critical details.
            channel.ack(msg);
            console.error(`[Flashsale Worker] Failed to process flashsale order payload. Msg acknowledged and discarded to prevent infinite loop:`, payload);
        }
    });
}

async function createFlashsaleOrderTransaction(payload) {
    let connection;
    try {
        const {
            customer_id,
            customer_name,
            customer_phone,
            subtotal,
            discount_amount,
            total_amount,
            payment_method,
            shipping_address,
            items,
            voucher_code
        } = payload;

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error('[Flashsale Worker Error] Invalid order items list.');
            return false;
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Generate Order Code (e.g., FLASH-YYMMDD-XXXX)
        const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        const orderCode = `FLASH-${todayStr}-${randomStr}`;

        // 2. Resolve Customer Code/ID
        let activeCustomerId = customer_id || null;
        if (!activeCustomerId && customer_phone) {
            // Helper logic inline for finding or auto-creating customer
            const [customers] = await connection.query(
                'SELECT id FROM mg_identity.customers WHERE phone = ? AND deleted_at IS NULL LIMIT 1',
                [customer_phone.trim()]
            );

            if (customers.length > 0) {
                activeCustomerId = customers[0].id;
            } else {
                // Auto create
                const [[maxResult]] = await connection.query('SELECT MAX(id) AS maxId FROM mg_identity.customers');
                const nextId = (maxResult && maxResult.maxId ? maxResult.maxId : 0) + 1;
                const customerCode = `KH-${String(nextId).padStart(4, '0')}`;
                const placeholderEmail = `${customer_phone.trim()}@minhgiang.vn`;
                const defaultPasswordHash = '$2a$12$BkyYpCpf7jQjc3.Bt/PLr.XKWCF0SJ6PDPN4keoR0qAoQ973tiWgy';
                const cName = customer_name || `Khách hàng ${customer_phone}`;

                const [insertResult] = await connection.query(`
                    INSERT INTO mg_identity.customers (
                        full_name, email, phone, password_hash, code, is_active
                    ) VALUES (?, ?, ?, ?, ?, 1)
                `, [cName, placeholderEmail, customer_phone.trim(), defaultPasswordHash, customerCode]);
                activeCustomerId = insertResult.insertId;
            }
        }

        // 3. Insert order into orders table (Default status is 'pending_approval' for Flashsale or 'confirmed')
        const [orderResult] = await connection.query(`
            INSERT INTO orders (
                order_code, order_channel, customer_id, customer_name, customer_phone,
                shipping_address, subtotal, shipping_fee, discount_amount, total_amount,
                payment_method, payment_status, order_status, requires_vat_invoice
            ) VALUES (?, 'web', ?, ?, ?, ?, ?, 0, ?, ?, ?, 'unpaid', 'pending_approval', 0)
        `, [
            orderCode, activeCustomerId, customer_name || 'Khách vãng lai', customer_phone || null,
            shipping_address || 'Nhận tại quầy', subtotal, discount_amount || 0, total_amount,
            payment_method || 'cod'
        ]);
        const orderId = orderResult.insertId;

        // 4. Insert order items
        const values = items.map(item => [
            orderId, item.product_id, item.product_name, item.unit_name || 'Hộp',
            item.quantity, item.unit_price, item.quantity * item.unit_price
        ]);
        await connection.query(`
            INSERT INTO order_items (
                order_id, product_id, product_name, unit_name,
                quantity, unit_price, total_price
            ) VALUES ?
        `, [values]);

        // 5. Deduct inventory from mg_catalog.batch_items according to FEFO
        for (const item of items) {
            let remainingToDeduct = item.quantity;

            const [batches] = await connection.query(`
                SELECT id, quantity_remaining 
                FROM mg_catalog.batch_items 
                WHERE product_id = ? AND quantity_remaining > 0 AND status IN ('available', 'near_expiry')
                ORDER BY expiry_date ASC
            `, [item.product_id]);

            for (const batch of batches) {
                if (remainingToDeduct <= 0) break;

                const deductAmount = Math.min(remainingToDeduct, batch.quantity_remaining);
                await connection.query(`
                    UPDATE mg_catalog.batch_items 
                    SET quantity_remaining = quantity_remaining - ? 
                    WHERE id = ?
                `, [deductAmount, batch.id]);

                remainingToDeduct -= deductAmount;
            }

            // Fallback to deduct from the first batch if remainingToDeduct > 0 and stock is forced
            if (remainingToDeduct > 0 && batches.length > 0) {
                await connection.query(`
                    UPDATE mg_catalog.batch_items 
                    SET quantity_remaining = quantity_remaining - ? 
                    WHERE id = ?
                `, [remainingToDeduct, batches[0].id]);
            }

            // Update product tag promotions sold quantity
            const [promos] = await connection.query(
                `SELECT id FROM mg_catalog.product_tag_promotions
                 WHERE product_id = ? AND tag_name = 'flash-sale' AND status = 'active' LIMIT 1`,
                [item.product_id]
            );
            if (promos.length > 0) {
                await connection.query(
                    `UPDATE mg_catalog.product_tag_promotions
                     SET sold_qty = sold_qty + ?
                     WHERE id = ?`,
                    [item.quantity, promos[0].id]
                );
            }
        }

        // 6. Handle Flashsale Promotion record if voucher_code / flashsale promo exists
        if (voucher_code) {
            const [activePromos] = await connection.query(
                `SELECT id, name, code, type FROM mg_cms.promotions
                 WHERE code = ? AND is_active = 1 LIMIT 1`,
                [voucher_code.trim().toUpperCase()]
            );
            if (activePromos.length > 0) {
                const promo = activePromos[0];
                await connection.query(`
                    INSERT INTO order_promotions (
                        order_id, promotion_id, promo_code_snapshot, promo_name_snapshot,
                        promo_type_snapshot, discount_value_snapshot, discount_applied
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    orderId, promo.id, promo.code, promo.name, promo.type, discount_amount || 0, discount_amount || 0
                ]);

                await connection.query(
                    `UPDATE mg_cms.promotions SET usage_count = usage_count + 1 WHERE id = ?`,
                    [promo.id]
                );
            }
        }

        await connection.commit();
        console.log(`[Flashsale Worker] Transaction committed for order code: ${orderCode}`);
        return true;

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('[Flashsale Worker Transaction Error]:', error);
        return false;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    startFlashsaleWorker
};
