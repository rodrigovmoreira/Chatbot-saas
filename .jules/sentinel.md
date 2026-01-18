## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2024-05-23 - Express 5 Getter-Only Properties vs Sanitization
**Vulnerability:** NoSQL Injection due to missing sanitization of input ($ operators).
**Learning:** Express 5 makes `req.query` and `req.params` getter-only properties in some contexts. Middleware that attempts to replace `req.query = sanitize(req.query)` fails with a TypeError.
**Prevention:** When modifying `req.query` or `req.params` in Express middleware, modify the object in-place (delete keys and re-assign) instead of trying to replace the entire object reference.
