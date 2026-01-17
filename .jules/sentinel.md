## 2024-05-22 - In-Memory Rate Limiting
**Vulnerability:** Rate limiting relies on in-memory Maps (`backend/middleware/rateLimiters.js`).
**Learning:** This implementation resets on server restart and does not share state across multiple instances (e.g., if scaled horizontally).
**Prevention:** Future scaling efforts must migrate rate limiting to a shared store (Redis) to ensure consistent enforcement and persistence.

## 2024-05-22 - Missing NoSQL Injection Protection
**Vulnerability:** The application lacked input sanitization against MongoDB NoSQL injection attacks (e.g., keys starting with `$`).
**Learning:** Standard security middleware like `express-mongo-sanitize` was missing despite using Mongoose, exposing the app to query manipulation via nested objects in `req.body` or `req.query`.
**Prevention:** Always include a sanitization middleware that recursively strips `$` and `.` from inputs before they reach the database layer.
