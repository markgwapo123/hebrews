# Hebrews backend — development status

Express + Mongoose REST API. **Development code, not production-certified.**

## Environment
Copy `.env.example` to `.env` inside `backend/` and fill the private values.
Never commit passwords or the real Atlas URI. Rotate any previously shared database password.

```bash
cd backend
npm install
npm run create-owner
npm run dev
```

The owner bootstrap is deliberately one-time only. Password must have at least 12 characters.
MongoDB Atlas must allow connections from the backend host. MongoDB transactions require a replica set (Atlas cluster). Set a strong `JWT_SECRET` (at least 32 characters).

## Implemented endpoints
- `GET /api/health` — backend and database state
- `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/catalog/categories`, `GET/POST /api/catalog/products`
- `PATCH /api/manage/categories/:id`, `PATCH /api/manage/products/:id`
- `POST /api/manage/inventory-items`, `PATCH /api/manage/inventory-items/:id`
- `GET /api/manage/recipes`, `PUT /api/manage/recipes/:productId`
- `GET /api/inventory`, `GET /api/inventory/low-stock`
- `GET /api/stock/movements`, `POST /api/stock/receive`, `POST /api/stock/adjust`
- `GET/POST /api/sales` — sale posting with inventory validation and transaction
- `GET/POST /api/finance/expenses`, `GET/POST /api/finance/capital`
- `GET /api/owner/summary`, `GET /api/reports/financial?from=YYYY-MM-DD&to=YYYY-MM-DD`, `GET /api/reports/audit`

## Roles
Owner: dashboard, product management, inventory, stock, finance and reports.
Staff: login, catalog viewing, and sales entry/listing. **No staff dashboard**.

## Important constraints
- Inventory units for recipes and stock must match exactly (e.g., ml with ml). No implicit g/kg or ml/l conversion.
- Ready-made products must link to an inventory item of kind `ready_made`.
- Prepared products need a recipe with ingredient requirements and optional packaging.
- `entryKey` is a client-generated unique identifier for a daily sales submission; reuse prevents duplicate posting.
- Sales cannot post with insufficient stock. The sale and stock movements are wrapped in a transaction.
- The financial report is basic; refunds, discounts, taxes, payment reconciliation, inventory valuation, cost allocation and sophisticated period accounting are not yet supported.
- Staff sales entries are not yet limited by configurable permissions.
- **Not yet integration-tested** against a real Atlas database. Do not deploy for real business use without tests, backup and security review.
