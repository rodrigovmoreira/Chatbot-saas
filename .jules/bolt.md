## 2025-05-27 - Auth Response Structure
**Learning:** The `POST /api/auth/register` endpoint returns `user.id` instead of `user._id` in its JSON response, unlike standard Mongoose serialization. Tests consuming this endpoint must access `res.body.user.id` to avoid `undefined` errors when querying the database.
**Action:** Always inspect the controller's response structure before writing integration tests, or use `res.body.user.id || res.body.user._id` safely.

## 2025-05-27 - MongoDB Compound Indexing
**Learning:** Adding a compound index `{ businessId: 1, isHandover: 1, tags: 1 }` to the `Contact` model optimizes the campaign targeting query. This supports the ESR (Equality, Sort, Range) rule where equality checks (`businessId`, `isHandover`) precede the range/multikey check (`tags`).
**Action:** When optimizing queries filtering by multiple fields, prioritize compound indexes that follow ESR to prevent collection scans.
