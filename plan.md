## POS Search Field Focus Investigation

1. Review `ItemsSelector` component logic around clearing and focusing inputs after invoice submission.
2. Trace event flow from invoice submission (`Invoice.js`) to ensure no UI locks or overlays remain.
3. Inspect any global styles or body-level mutations triggered post-print that could block pointer events in Chrome.
4. Formulate hypotheses for Chrome-specific behavior (e.g., stale pointer-events, focus lock, hidden overlay).
5. Validate findings and implement targeted fix.
6. Test in Chrome and Firefox; document outcome and any remaining caveats.

