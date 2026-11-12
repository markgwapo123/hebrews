# HEBREWS Full-System QA Report

## Executive summary

**Overall assessment: NOT READY for a complete Owner/Staff workflow.** The isolated end-to-end run verified the primary Owner sales, inventory, receipts, financial, reporting, and reset workflows. Two failures were confirmed: valid Staff credentials cannot log in, and the daily cash-flow report's net profit omits confirmed inventory losses. A frontend API URL hardcoded to localhost also required test-only request routing to reach the isolated backend.

No application source code or dependencies were changed. All sample records were created in the verified `hebrews_qa_test` database, then reset and removed. A final Mongoose check confirmed that every collection in that database contains zero documents. The QA backend and frontend servers were stopped.

## Scope and safeguards

- Read the existing backend environment configuration without displaying credentials or connection strings.
- Explicitly selected `hebrews_qa_test` in Mongoose and verified `mongoose.connection.name` matched before writing any sample records. The database was empty before test setup.
- Ran the backend on port 5500 with the test database selected and the frontend on port 4200.
- Port 5000 already had a listener. It was left untouched. Browser requests intended for the frontend's configured API origin were intercepted and routed to port 5500; no test request was sent to the existing listener.
- Used synthetic Owner and Staff accounts and synthetic business records only. No external email, payment, or notification operation was run.
- Reset was executed only after verifying the isolated database and its synthetic contents. The reset removed business records; the two synthetic user records it preserved were then deleted individually.
- Final verification: all 11 collections in `hebrews_qa_test` had zero documents. Ports 5500 and 4200 were no longer listening.

## Automated and integration checks

| Check | Status | Result |
|---|---|---|
| Angular production build | PASS | Completed to a temporary output directory, which was removed afterward. |
| TypeScript type check | PASS | `tsc --noEmit` completed successfully. |
| Backend JavaScript syntax | PASS | 28 JavaScript files checked successfully. |
| Existing backend unit tests | PASS | 4/4 passed. |
| Main isolated API test suite | FAIL | 132 passed, 1 failed out of 133 checks. The failure was valid Staff login. |
| Additional product/stock-policy API checks | PASS | 7/7 passed. |
| Cross-module financial comparison | FAIL | Cash-flow net profit differed by ₱5 from reports that include confirmed inventory losses. |
| Browser end-to-end testing | PASS / FAIL | Owner workflows and responsive checks passed; the Staff login workflow failed. See module results below. |
| Linting | NOT EXECUTED | No lint command was run in this test pass. |

Across the counted API and financial assertions, 139 passed and 2 failed. Browser checks are reported separately and are not included in that count.

## Sample data and calculation results

The test database was populated with the five requested categories and eight requested products, using the supplied base prices and costs. Representative inventory included the requested ingredients and packaging, plus synthetic recipe/test items. Seven sample-product recipes, drink variants, inventory movements, capital transactions, expenses, and sales were created through the isolated test setup and APIs.

| Transaction | Revenue | COGS | Gross profit | Result |
|---|---:|---:|---:|---|
| Iced Coffee × 2, Chicken Silog × 1, Bottled Water × 2 | ₱340 | ₱155 | ₱185 | Posted |
| Milk Tea × 3, French Fries × 2 | ₱450 | ₱195 | ₱255 | Voided; retained in receipt history |
| Pork Silog × 1, Cheesecake × 2 | ₱350 | ₱185 | ₱165 | Posted |
| **Before voiding** | **₱1,140** | **₱535** | **₱605** | **Matched expected baseline** |
| **After voiding Transaction 2** | **₱690** | **₱340** | **₱350** | **Matched expected posted totals** |

Configured variants used the same listed base prices and costs for the tested transaction lines. A separate synthetic kiosk sale was also created and voided during UI testing; it did not alter the posted totals above.

Other verified totals:

- Capital contributions: ₱12,000; owner withdrawal: ₱1,000; net contributed capital after withdrawal: ₱11,000.
- Operating expenses: ₱1,000 (electricity ₱500, water ₱200, other ₱300).
- Synthetic stock purchases: ₱3,360.
- Confirmed inventory loss: ₱5.
- Closing cash: **₱7,330**, matching ₱0 opening cash + ₱12,000 capital + ₱690 posted sales − ₱3,360 stock purchases − ₱1,000 expenses − ₱1,000 withdrawal.
- Report overview and date-range net profit were both **-₱655** after accounting for the ₱5 loss. The daily cash-flow report showed **-₱650**, which is the confirmed reporting defect below.

## Module results

| Module / workflow | Status | Observed result |
|---|---|---|
| Owner authentication | PASS | Synthetic Owner login succeeded; dashboard and owner routes were accessible. |
| Staff authentication | FAIL | Valid synthetic Staff credentials returned HTTP 401 `Invalid credentials`. |
| Invalid credentials / authorization | PASS | Invalid login was rejected. A signed Staff token was rejected from owner-only routes with HTTP 403. |
| Session handling | PASS | Authenticated Owner requests worked during the browser/API run. |
| Dashboard | PASS | Owner dashboard, sales graph, date filter, and displayed sales/profit/capital values were exercised and agreed with posted test sales. |
| Inventory CRUD and history | PASS | Synthetic inventory/product setup, edit, stock-in, stock-count, and movement/history flows were exercised. Low-stock and out-of-stock states were observable. |
| Recipes and product links | PASS | Recipe and inventory links were exercised; insufficient tracked stock was rejected. |
| Kiosk cart and checkout | PASS | Quantity/cart calculations and confirmation were exercised in API and browser flows; receipts were created and persisted. |
| Physical stock on checkout | PASS | Checkout did not decrement tracked physical stock. Stock changes came from explicit inventory operations. |
| Sold-out / untracked products | PASS | A tracked zero-stock product was unavailable and checkout was rejected with HTTP 409. An untracked synthetic product followed the observed policy and remained orderable. |
| Daily sales | PASS | Date-selected totals and transaction/product summaries matched the posted test sales. |
| Receipt history, search, details, status | PASS | History, search, status filtering, and receipt details were exercised. |
| Void sale | PASS | Transaction 2 remained in receipt history but was excluded from posted revenue and profit. Browser void flow also succeeded. |
| Receipt printing | NOT EXECUTED | No print dialog was opened. |
| Capital, expenses, withdrawals | PASS | Synthetic entries and history were exercised; totals matched the supplied amounts. |
| Cash-flow report | FAIL | Closing cash matched the expected equation; net profit omitted confirmed inventory loss (₱5). |
| Overview/date-range reports | PASS | Report net profit included confirmed loss and matched at -₱655. |
| Reset confirmation and role restrictions | PASS | Incorrect confirmation was rejected; Staff reset request received 403; UI required the exact phrase. Reset ran only against the verified QA database. |
| Impossible business date | PASS | `2026-02-30` was rejected with HTTP 400. |
| Negative/zero quantities, invalid IDs, duplicates, insufficient stock, invalid void, and date-range cases | PASS | Exercised against the isolated test backend; invalid requests were rejected, duplicate sales keys were prevented, and insufficient stock was not permitted. |
| Responsive layout | PASS | Nine Owner pages were measured at 1920, 1366, 1024, 768, 430, and 375 px. No page-level horizontal overflow was measured; table content stayed within scrollable table containers. |
| Mobile navigation / keyboard interaction | PASS | Mobile navigation was exercised and basic keyboard focus/navigation was checked. |
| Full accessibility audit | NOT EXECUTED | Screen-reader behavior, comprehensive keyboard focus management, and color contrast were not evaluated. |
| Failure screenshots | NOT EXECUTED | No saved screenshot was retained for a visual failure; the failures were API/report calculation issues. |

## Confirmed findings

### 1. Valid Staff credentials cannot authenticate

- **Severity:** Medium
- **Status:** FAIL
- **Module:** Authentication / Staff access
- **Files:** [auth.routes.js](./backend/src/routes/auth.routes.js) (line 13); [auth.js](./backend/src/middleware/auth.js) (line 9)
- **Reproduction:** In the isolated QA environment, submit the valid synthetic Staff username and password to the login endpoint.
- **Expected:** A valid supported Staff account should authenticate and receive access limited to Staff-authorized features.
- **Actual:** Login returned HTTP 401 `Invalid credentials`. A separately signed Staff token was correctly denied owner-only routes with HTTP 403.
- **Root cause:** The login handler accepts only users whose role is `owner`; this condition rejects Staff users before a token can be issued.
- **Recommended follow-up:** Confirm whether Staff login is intended to be supported. If so, define and test the Staff permission boundary while allowing Staff authentication.

### 2. Daily cash-flow net profit omits confirmed inventory loss

- **Severity:** Medium
- **Status:** FAIL
- **Module:** Reports / Daily cash flow
- **Files:** [cash-flow.js](./backend/src/utils/cash-flow.js) (line 22); [reports.routes.js](./backend/src/routes/reports.routes.js) (line 55)
- **Reproduction:** In isolated data, create a confirmed ₱5 inventory loss, then compare daily cash-flow net profit with overview/date-range report net profit for the same date.
- **Expected:** Daily cash-flow net profit should account for confirmed losses consistently with the report's stated net-profit rule and the other report endpoints.
- **Actual:** Overview/date-range net profit was -₱655, while daily cash-flow net profit was -₱650. Closing cash was correctly ₱7,330.
- **Root cause:** The daily cash-flow calculation uses sales minus COGS minus operating expenses and does not include confirmed inventory loss. The cash-flow route loads stock-in movements for purchase deductions but does not incorporate loss movements into the net-profit calculation.
- **Recommended follow-up:** Include confirmed inventory losses in the daily net-profit calculation and add a regression test comparing cash-flow and date-range results.

### 3. Frontend API origin is fixed to localhost:5000

- **Severity:** Low (configuration / portability warning)
- **Status:** WARNING
- **Module:** Frontend API integration
- **File:** [main.ts](./frontend/src/main.ts) (line 422)
- **Reproduction:** Start the frontend while the backend is on a different origin/port. The frontend still sends API requests to `http://localhost:5000/api`.
- **Expected:** The API origin should be configurable for the active environment.
- **Actual:** The test backend had to run on port 5500 because port 5000 was already occupied; browser requests were routed to the isolated backend with test-only interception.
- **Root cause:** The API base URL is hardcoded in the frontend.
- **Recommended follow-up:** Use the project's environment-specific API configuration so development, QA, and deployment origins can be selected without editing application code.

## Not executed / limitations

- No test request was sent to the existing listener on port 5000, and its identity was not inspected.
- No production or existing development database was written to.
- No payment, email, or third-party notification integration was triggered.
- No print dialog, full accessibility audit, or saved visual-failure screenshot was produced.
- No dependency was installed or changed. No source fix was made.
- Security testing was limited to safe authentication/authorization and input-validation behavior needed for the QA flows; no destructive exploit attempts were performed.

## Worktree and cleanup

The requested report is the only file created for this deliverable. Existing worktree changes were preserved and not made by this QA run: `frontend/angular.json` was already modified, and `backend/package-lock.json` and `frontend/package-lock.json` were already untracked. The temporary production build output was removed. The isolated QA database is empty, and the QA application servers are stopped.
