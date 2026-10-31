# Hebrews architecture

Three tiers: Angular browser UI → Express REST API → MongoDB Atlas via Mongoose.

**Owner:** only role with dashboard, financial KPIs, reports and administration.

**Staff:** no dashboard. Authorized operational pages only, including manual daily sales entry.

Planned modules: product categories, recipes, ingredients, ready-made goods, packaging (cup sizes, lids, straws), stock movements, daily sales, capital, expenses, profit reporting, audit logs.

Sales recording must validate inventory, avoid negative stock, and use atomic transactions. Store historical price and cost snapshots. Keep capital separate from profit. Show `NOT AVAILABLE RIGHT NOW` for unavailable products.

Phase 1 contains scaffolding only. Authentication, inventory and financial processing are not yet implemented.
