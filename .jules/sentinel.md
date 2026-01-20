## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2024-05-23 - Express req.query Immutability
**Vulnerability:** Middleware attempting to reassign `req.query` (e.g. `req.query = sanitized`) caused `TypeError: Cannot set property query...` in some environments.
**Learning:** `req.query` can be a getter-only property depending on Express configuration/version or test environment.
**Prevention:** Always modify `req.query` and `req.params` in-place (e.g., delete keys and re-add) rather than reassigning the object reference.
