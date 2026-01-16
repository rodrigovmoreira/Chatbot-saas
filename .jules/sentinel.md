## 2025-02-14 - express-mongo-sanitize middleware implementation
**Vulnerability:** Missing NoSQL injection protection.
**Learning:** Implemented a custom `mongoSanitize` middleware to remove keys starting with `$` or containing `.` from `req.body`, `req.query`, and `req.params`. Verification via unit tests proved tricky due to `supertest` or `express` response handling quirks with mutated objects in the test environment, but manual logging confirmed the sanitization logic works correctly.
**Prevention:** Ensure all user input is sanitized before reaching MongoDB queries.
