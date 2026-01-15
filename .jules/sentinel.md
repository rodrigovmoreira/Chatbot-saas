## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2026-01-15 - Missing NoSQL Injection Sanitization
**Vulnerability:** The application was missing middleware to sanitize inputs against NoSQL injection (specifically removing keys starting with `$` or containing `.`).
**Learning:** Even if `express-mongo-sanitize` is mentioned in documentation or memory, it must be verified in the actual codebase (package.json and server.js).
**Prevention:** Explicitly verify presence of security middleware during security audits and ensure critical middleware is registered globally in `server.js`.
