## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2026-01-26 - Express 5 Query Property Immutability
**Vulnerability:** Middleware attempting to reassign `req.query` (e.g., `req.query = sanitize(req.query)`) threw `TypeError: Cannot set property query...` in Express 5 environment.
**Learning:** Express 5 treats `req.query` as a getter/read-only property in certain contexts or configurations, preventing direct reassignment.
**Prevention:** Security middleware should modify `req.query` properties in-place (mutation) rather than attempting to replace the entire object reference.
