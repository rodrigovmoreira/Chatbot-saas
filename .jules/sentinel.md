## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.
