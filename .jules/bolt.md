## 2024-05-23 - [Missing Index on Periodic Scheduler]
**Learning:** The `scheduler.js` service queries `Appointment` every minute for every business config. While `userId` is indexed, the query filters heavily by `status` (enum) and `start` (date range). Without a compound index, this operation scales poorly as appointment history grows.
**Action:** Always check models used in `cron` jobs for compound indexes covering the exact query filter fields (ESR rule: Equality, Sort/Status, Range). Added `{ userId: 1, status: 1, start: 1 }` to `Appointment`.

## 2024-05-23 - [Missing Index on Message History]
**Learning:** The `messageHandler` queries `Message` model (using `getLastMessages`) for every incoming message to build context. The query sorts by `{ timestamp: -1 }` filtering by `contactId`. Without an index, this becomes an O(N) scan as chat history grows.
**Action:** Added compound index `{ contactId: 1, timestamp: -1 }` to `Message` model. This optimizes both the context lookup (reverse chronological) and the Chat UI history fetch (chronological).

## 2025-01-17 - [N+1 Query in Campaign Scheduler]
**Learning:** The `campaignScheduler` was iterating over all potential contacts and checking `CampaignLog.exists()` individually inside the loop. This created an O(N) query pattern (N+1 problem) scaling with contact list size.
**Action:** Refactored to pre-fetch exclusion lists (contacts who already received the campaign) using `CampaignLog.distinct()`. Then used `_id: { $nin: excludedIds }` in the main `Contact.find()` query. This reduces DB round-trips from N+1 to 2.
