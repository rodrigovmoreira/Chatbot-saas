## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2025-02-19 - NoSQL Injection via Unsanitized Input
**Vulnerability:** MongoDB operators (like `$gt`, `$ne`) in user input were not sanitized, allowing potential authentication bypass or data leakage.
**Learning:** Express 4/5 does not sanitize request bodies by default. Even with ORMs like Mongoose, advanced operators in query payloads can alter logic.
**Prevention:** Implemented a reusable `mongoSanitize` middleware to recursively strip `$` and `.` keys from `req.body`, `req.query`, and `req.params`.
