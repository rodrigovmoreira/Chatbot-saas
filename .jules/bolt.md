## 2024-05-23 - [Missing Index on Periodic Scheduler]
**Learning:** The `scheduler.js` service queries `Appointment` every minute for every business config. While `userId` is indexed, the query filters heavily by `status` (enum) and `start` (date range). Without a compound index, this operation scales poorly as appointment history grows.
**Action:** Always check models used in `cron` jobs for compound indexes covering the exact query filter fields (ESR rule: Equality, Sort/Status, Range). Added `{ userId: 1, status: 1, start: 1 }` to `Appointment`.

## 2024-05-23 - [Missing Index on Message History]
**Learning:** The `messageHandler` queries `Message` model (using `getLastMessages`) for every incoming message to build context. The query sorts by `{ timestamp: -1 }` filtering by `contactId`. Without an index, this becomes an O(N) scan as chat history grows.
**Action:** Added compound index `{ contactId: 1, timestamp: -1 }` to `Message` model. This optimizes both the context lookup (reverse chronological) and the Chat UI history fetch (chronological).
