## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2024-05-22 - Missing NoSQL Injection Protection
**Vulnerability:** `express-mongo-sanitize` was documented in memory/expectations but missing in `server.js` and `package.json`.
**Learning:** Documentation and Memory can drift from Codebase reality. Critical security middleware must be explicitly verified in the entry point (`server.js`).
**Prevention:** Always verify security controls by inspecting the code, not just relying on documentation or "known" state.
