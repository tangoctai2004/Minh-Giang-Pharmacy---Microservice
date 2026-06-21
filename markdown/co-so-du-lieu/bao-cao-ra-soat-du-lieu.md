# Data + DB Audit Report

Audit date: 2026-06-07

Scope:

- MySQL schemas: `mg_identity`, `mg_catalog`, `mg_order`, `mg_cms`, `mg_notification`
- Seed scripts: compact baseline, daily activity, and acceptance verification
- API smoke: gateway, catalog, order, returns, notification template
- Daily activity seed: `PH12-*` records for the current DB date

## Executive Summary

The database is good enough for a pharmacy microservice demo and backend integration work.
The core business data is relationally consistent and passes the acceptance gate in
`verify.sql`.

Overall rating: **9/10**

Strong points:

- Clean relational coverage across catalog, inventory, customers, orders, prescriptions,
  returns, and notifications.
- Pharmacy-specific rules are represented: Rx verification, batch/expiry handling,
  FEFO-style stock, return-to-stock control, delivery scope, loyalty, notification queues.
- Delivery business scope is now clear: Minh Giang Pharmacy at
  `918 An Duong Vuong, Thanh pho Hoa Binh`, delivery within Hoa Binh, max 8km.
- A clean rebuild using `run_all.sh` executes the active schema/seed set and the final QA gate.

Main remaining risk:

- Product image URLs are intentionally preserved from the live seed source so the frontend can
  render real product images. If brand-pure media is required later, generate/host replacement
  image files first, then rewrite URLs.
- A few backend routes were still behind the schema; Phase 10 fixed the order list/detail
  route mismatch discovered during smoke testing.
- The seed phase files have been consolidated into `schemas/`, `seeds/`, and `verify.sql`.

## Current Totals

| Area | Count |
| --- | ---: |
| Products | 4000 |
| Active products | 3000 |
| Pending review products | 1000 |
| Active Rx products | 126 |
| Active products with sellable stock | 2686 |
| Active products intentionally without sellable stock | 314 |
| Batch items | 6033 |
| Orders | 300 |
| Prescriptions | 60 |
| Returns | 48 |
| Notifications | 453 |

Additional daily activity after Phase 12:

| Area | Count |
| --- | ---: |
| PH12 orders for current DB date | 36 |
| PH12 order items | 72 |
| PH12 inbound batches | 3 |
| PH12 inbound batch items | 20 |
| PH12 inbound movement rows | 20 |
| PH12 outbound sale movement rows | 56 |
| PH12 notifications | 40 |

## Inventory Health

| Batch status | Rows | Remaining quantity |
| --- | ---: | ---: |
| available | 4203 | 355505 |
| near_expiry | 905 | 68310 |
| expired | 309 | 8175 |
| depleted | 616 | 0 |

Assessment:

- Healthy for demo and stock workflows.
- Includes available, near-expiry, expired, and depleted cases.
- QA confirms no negative stock and no remaining quantity above received quantity.
- QA confirms expired batches are not marked sellable.

## Order Coverage

| Channel | Status | Count |
| --- | --- | ---: |
| web | pending_approval | 30 |
| web | completed | 60 |
| web | cancelled | 30 |
| pos | confirmed | 30 |
| pos | picking | 30 |
| pos | shipping | 30 |
| pos | completed | 90 |

Assessment:

- Good lifecycle coverage for POS and web.
- Web orders include Hoa Binh shipping text and reference the 918 An Duong Vuong store.
- QA confirms order subtotal and total amount match order items.

## Prescription Coverage

| Status | Count |
| --- | ---: |
| pending | 10 |
| verified | 35 |
| rejected | 7 |
| expired | 8 |

Assessment:

- Good Rx workflow coverage.
- Verified prescriptions are attached to Rx order items.
- QA confirms no non-verified or expired prescription is used for dispensing.

## Return Coverage

| Status | Count |
| --- | ---: |
| pending | 12 |
| approved | 8 |
| rejected | 4 |
| completed | 24 |

Assessment:

- Good after-sales coverage.
- Return-to-stock is only used for completed returns.
- Rx products are not returned automatically.
- Rejected returns have zero refund.

## Notification Coverage

| Recipient | Channel | Status | Count |
| --- | --- | --- | ---: |
| customer | email | pending | 28 |
| customer | email | sent | 71 |
| customer | email | failed | 2 |
| customer | sms | pending | 22 |
| customer | sms | sent | 103 |
| customer | sms | failed | 4 |
| customer | in_app | pending | 10 |
| customer | in_app | sent | 8 |
| customer | zalo | sent | 45 |
| staff | in_app | pending | 80 |
| admin | in_app | sent | 80 |

Assessment:

- Good coverage for customer, staff, and admin notification states.
- QA confirms references to templates, orders, prescriptions, returns, and batches resolve.
- QA confirms Phase 8 payloads include the store address.

## API Smoke Results

| Area | Endpoint | Result |
| --- | --- | --- |
| Gateway | `GET /health` | Pass |
| Catalog | `GET /api/catalog/products?status=active&page=1&limit=3` | Pass |
| Catalog | `GET /products/:id` direct service | Pass |
| Order | `GET /orders/stats` direct service | Pass after Phase 10 fix |
| Order | `GET /orders?page=1&limit=2` direct service | Pass after Phase 10 fix |
| Returns | `POST /returns` with Rx item | Pass: blocked with business error |
| Notification | `GET /templates?channel=email` direct service | Pass |
| Notification | `GET /templates/:id` direct service | Pass |

Discovered and fixed during Phase 10:

- `backend/order-service/orders/orders.routes.js` used `is_active` on `orders` and
  `order_items`, but the current schema does not have those columns.
- The route now reads the current schema correctly.

## Phase 11 Brand/Media Cleanup

Phase 11 resolved the earlier catalog identity issues:

| Check | Remaining count |
| --- | ---: |
| Product SKU uses `TS-` prefix | 0 |
| Product specifications include source URL or `Nguồn dữ liệu` row | 0 |
| Manufacturer placeholder remains | 0 |
| CMS article thumbnail points to `trungsoncare.com` | 0 |

Media note:

- Product media links are live external URLs by design.
- Do not rewrite product media links without serving replacement files.

## Final Assessment

The DB is structurally and relationally strong now. For a microservice pharmacy project,
it covers enough real business flows:

- browse catalog
- sell POS/web
- reserve and deduct stock
- handle Rx prescriptions
- process returns/refunds
- notify customers/staff/admin
- enforce delivery scope
- rebuild and QA automatically

The next best improvement is not adding more rows. It is **API/test hardening**:
turn the smoke checks into repeatable service-level tests and add real static media serving
for the new Minh Giang image paths if the frontend needs product images to render.
