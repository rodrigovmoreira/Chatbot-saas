## 2024-06-03 - [React.memo in Polling Components]
**Learning:** Polling data (e.g., setInterval fetching) creates new object references on every successful fetch, even if content is identical. This triggers React re-renders for the entire component tree.
**Action:** Extract list items into separate components and wrap them in React.memo. This ensures that even if the parent re-renders due to a state update (like a new array reference), the children only re-render if their specific props change.

