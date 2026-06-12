# Minh Giang Pharmacy Seed Data Handoff

This dataset is designed for a small pharmacy microservice demo centered on:

- Store: Nha Thuoc Minh Giang
- Main address: 918 An Duong Vuong, Thanh pho Hoa Binh
- Delivery scope: Thanh pho Hoa Binh, max radius 8km

## Rebuild Command

Run from the repository root:

```bash
bash infrastructure/database/run_all.sh
```

The script rebuilds the MySQL schemas and runs the acceptance checks at the end.
If any critical business rule fails, `99_verify_seed_quality.sql` stops the script.

## Seed Scripts

The detailed phase scripts are archived in `archive/seed_phases/` for traceability.
The active rebuild flow is intentionally compact:

| File | Purpose |
| --- | --- |
| `90_seed_demo_baseline.sql` | Consolidated baseline demo data: catalog cleanup, inventory batches, sale units, customers, orders, prescriptions, returns, notifications, and brand/media cleanup |
| `91_seed_daily_activity.sql` | Daily inbound stock, POS/web sales, stock outflows, loyalty and notifications for `CURDATE()` |
| `99_verify_seed_quality.sql` | Validate core data and business rules |

## Current Dataset Totals

Verified after a clean `run_all.sh` rebuild:

| Area | Count |
| --- | ---: |
| Products | 4000 |
| Active products | 3000 |
| Pending review products | 1000 |
| Batch items | 6033 |
| Orders | 300 |
| Prescriptions | 60 |
| Returns | 48 |
| Notifications | 453 |

The daily activity script adds extra records on top of these baseline counts each time the database is
rebuilt for the current day.

## Business Rules Covered

- Active products have manufacturer, active ingredient, and registration number.
- Visible seed text uses Minh Giang branding.
- Customer addresses are scoped to Hoa Binh.
- Web delivery addresses stay in Hoa Binh and reference the 918 An Duong Vuong store scope.
- Delivery config is enabled with an 8km radius.
- Inventory never has negative remaining quantity or remaining greater than received.
- Expired batches are not sellable.
- Product unit barcodes do not collide with product barcodes.
- Order subtotal and total amount match order items.
- Rx order items only use verified, unexpired prescriptions.
- Returns do not include Rx items and do not restock unless completed.
- Notification references resolve to real order, prescription, return, batch, and template records.
- Notification payloads include the store address.
- Product SKUs use `MG-` prefix.
- Product source URL specifications are removed from demo-facing data.

## Service Schema Fixes Included

The seed work also aligns service code with the database schema:

- `backend/order-service/returns/returns.routes.js`
  - Uses `return_code`, `order_channel`, `refund_amount`, `refund_method`.
  - Inserts `return_items.quantity_returned`.
  - Rejects automatic returns for prescription items.

- `backend/notification-service/email/email.routes.js`
  - Uses `notification_templates.subject` and `channel = 'email'`.

- `backend/notification-service/templates/templates.routes.js`
  - Uses `channel` and `subject`.
  - Provides basic create, update, and soft delete operations.

## Demo Checklist

- Catalog browsing: active products, pending review products, product units.
- Inventory: FEFO batches, near-expiry/expired/depleted stock, movement history.
- Customers: loyalty tiers, Hoa Binh addresses.
- Checkout/order: POS and web order statuses.
- Delivery: web orders are in the supported Hoa Binh radius.
- Prescription: pending/verified/expired/rejected prescriptions and verified Rx order items.
- Returns: pending/approved/rejected/completed return cases.
- Notifications: customer, staff, admin messages across email, SMS, in-app, and Zalo.
- Today activity: `PH12-*` orders, inbound stock, outbound sale movements, loyalty earn rows, and order notifications.
- QA: rerun `99_verify_seed_quality.sql` or full `run_all.sh`.

## Media Note

Product image URLs are intentionally preserved from the live seed source so the frontend can
render real product images instead of falling back to default placeholders. Do not rewrite
`products.image_url`, `products.gallery`, or `product_images.public_url` unless matching static
files are created and served by the catalog service.
