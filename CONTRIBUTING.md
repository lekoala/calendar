# Contributing

This is an early architecture-first prototype.

Before adding behavior:

1. read `AGENTS.md` and `docs/FOUNDATIONS.md`;
2. add/adjust the public contract in `docs/API.md` if needed;
3. keep domain-specific behavior outside the core;
4. extract pure date/geometry/layout logic before adding DOM complexity;
5. add unit tests for pure helpers and browser tests for actual interaction;
6. update the relevant demo when the behavior becomes user-visible.

The current priority is a clean `timeGrid` + `resourceTimeGrid` foundation, not feature count.
