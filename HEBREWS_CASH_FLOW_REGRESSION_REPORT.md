# HEBREWS Daily Cash Flow Regression Report

**Execution date:** 2026-11-08  
**Branch:** `hebrews-dev`  
**Verified HEAD:** `ff6499dde84e5998770b25b8191822bf27d64a83`  
**Overall result:** PASS

## Scope

This run tested only the Daily Cash Flow Net Profit fix and related report consistency: overview, financial date-range, and daily cash-flow report values, zero and multiple inventory-loss cases, date filtering, and prevention of double deduction. No Staff Login workflow was tested.

The requested commit was verified locally, is the current HEAD on `hebrews-dev`, and is also contained by `origin/hebrews-dev`. The commit changes `backend/src/routes/reports.routes.js` to load confirmed inventory losses for cash-flow reporting. No application source code was modified during this regression run.

## Isolation and execution method

- Before any write, a direct Mongoose connection explicitly selected `hebrews_qa_test`. The actual `mongoose.connection.name` was checked and matched that name.
- The database contained zero documents across all existing collections before test setup. The test stopped before writing if the selected database did not match or was not empty.
- Synthetic data was written only to `hebrews_qa_test`: an Owner-role test principal for API authorization, capital transactions, expenses, stock movements, and posted daily sales. No credentials or connection strings are included in this report.
- The actual Express app was served on an ephemeral loopback port and the report endpoints were called over HTTP with an Owner authorization token. The login endpoint was not used.
- Only records created by this run were removed. Final counts verified zero documents in all 11 collections. No data in `hebrews_db` was accessed for writes.

## Results

### Requested baseline values

The baseline fixtures represented the specified financial values on 2026-11-08:

- Posted sales: ₱690 revenue, ₱340 COGS.
- Expenses: ₱1,000 total.
- Capital contributions: ₱12,000 total; owner withdrawal: ₱1,000.
- Stock purchases: ₱3,360.
- Two separate confirmed inventory-loss movements: ₱2 and ₱3, total ₱5.

| API result | Expected | Actual | Status |
|---|---:|---:|---|
| Overview net profit | -₱655 | -₱655 | PASS |
| Overview inventory loss | ₱5 | ₱5 | PASS |
| Financial date-range net profit (2026-11-08) | -₱655 | -₱655 | PASS |
| Financial date-range inventory loss (2026-11-08) | ₱5 | ₱5 | PASS |
| Daily Cash Flow net profit (2026-11-08) | -₱655 | -₱655 | PASS |
| Daily Cash Flow inventory loss (2026-11-08) | ₱5 | ₱5 | PASS |
| Daily Cash Flow closing cash | ₱7,330 | ₱7,330 | PASS |

Closing cash matched the expected equation:

`₱0 opening + ₱12,000 capital + ₱690 sales − ₱3,360 stock purchases − ₱1,000 expenses − ₱1,000 withdrawals = ₱7,330`

The inventory loss affects net profit but is not subtracted again from closing cash.

### Focused regression cases

| Test | Expected | Actual | Status |
|---|---|---|---|
| Zero-loss case with no business records | Overview, date-range, and daily net profit/loss are ₱0; closing cash ₱0 | All reported ₱0 | PASS |
| Multiple losses on the same day | Two movements totaling ₱5 are counted once | Two movements (₱2 + ₱3), reported total ₱5 | PASS |
| No double deduction | Net profit is ₱690 − ₱340 − ₱1,000 − ₱5 = -₱655 | -₱655; not -₱660 | PASS |
| Date filter: baseline date 2026-11-08 | Excludes a later loss dated 2026-11-09 | Net profit -₱655, loss ₱5 | PASS |
| Date filter: probe date 2026-11-09 | Includes only the later ₱7 loss and no sales/expenses | Net profit -₱7, loss ₱7 | PASS |
| Date filter: combined range 2026-11-08 to 2026-11-09 | Net profit -₱662; losses ₱12 | Net profit -₱662, losses ₱12 | PASS |
| Baseline overview after removing the date-filter probe | Returns to baseline -₱655 and ₱5 loss | -₱655, loss ₱5 | PASS |

## Test execution summary

- Focused existing unit suite, `node --test test/cash-flow.test.js`: **4 passed, 0 failed**.
- Isolated real-API regression assertions: **7 passed, 0 failed**.
- API endpoints exercised: `/api/reports/overview`, `/api/reports/financial`, and `/api/reports/cash-flow`.
- No Staff Login tests, broad system tests, builds, dependency changes, or source edits were performed.

## Remaining bugs and cleanup

**No remaining defect was found in the tested daily cash-flow net-profit, loss aggregation, date-filtering, or closing-cash behavior.** This result is limited to the tested report paths and synthetic data; it is not a full-system certification.

After cleanup, Mongoose still reported `hebrews_qa_test` as the selected database and every collection had zero documents. The previous `HEBREWS_FULL_SYSTEM_QA_REPORT.md` was not reused or modified.
