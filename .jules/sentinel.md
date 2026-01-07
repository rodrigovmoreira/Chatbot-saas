## 2024-05-23 - [Missing Rate Limiting]
**Vulnerability:** The `POST /api/auth/login` endpoint lacked rate limiting, allowing unlimited brute force attempts.
**Learning:** Memory explicitly stated "The backend employs a custom, in-memory rate limiting middleware", but the file did not exist in the codebase. This highlights the importance of verifying architectural claims against the actual file system.
**Prevention:** Always verify the existence of security controls by inspecting code, not just relying on documentation or "known state".
