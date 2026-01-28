## 2024-05-23 - [Missing Index on Periodic Scheduler]
**Learning:** The `scheduler.js` service queries `Appointment` every minute for every business config. While `userId` is indexed, the query filters heavily by `status` (enum) and `start` (date range). Without a compound index, this operation scales poorly as appointment history grows.
**Action:** Always check models used in `cron` jobs for compound indexes covering the exact query filter fields (ESR rule: Equality, Sort/Status, Range). Added `{ userId: 1, status: 1, start: 1 }` to `Appointment`.

## 2024-05-23 - [Missing Index on Message History]
**Learning:** The `messageHandler` queries `Message` model (using `getLastMessages`) for every incoming message to build context. The query sorts by `{ timestamp: -1 }` filtering by `contactId`. Without an index, this becomes an O(N) scan as chat history grows.
**Action:** Added compound index `{ contactId: 1, timestamp: -1 }` to `Message` model. This optimizes both the context lookup (reverse chronological) and the Chat UI history fetch (chronological).

## 2026-01-27 - [React 19 Compatibility with React Scripts 5]
**Learning:** The project uses `react-scripts` v5.0.1 with `react` v19.2.0. This combination causes `npm test` to fail with `AggregateError` during basic component rendering in JSDOM, likely due to hydration/environment mismatches in the test runner. Standard `render(<App />)` tests fail even for empty components.
**Action:** When working in this environment, rely on `npm run build` for syntax/compilation verification and manual testing for functionality. Do not block on `npm test` failures if they are environmental `AggregateError`s related to React 19.

## 2026-01-28 - [Redundant N+1 Checks in Bulk Operations]
**Learning:** The campaign scheduler employed a "belt and suspenders" approach where it pre-filtered the target audience in a batch query (O(1)) but then re-verified each item's exclusion status in the loop (O(N)). This redundancy creates massive unnecessary DB load during high-volume broadcasts.
**Action:** When refactoring bulk operations, explicitly trust the initial batch filter. Pass a flag (e.g., `skipExclusionCheck`) to the per-item processor to bypass the redundant individual checks while maintaining the safety check for single-item processing contexts.
