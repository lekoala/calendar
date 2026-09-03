# Research and implementation guardrails

The project is informed by prior evaluation of commercial/open-source calendars and real scheduling UIs. That research is useful for **requirements and behavior**, not as permission to copy proprietary implementation.

## Safe approach

Use observed behavior to write independent requirements, for example:

- empty-slot hover preview;
- range selection ghost;
- right-click/long-press application action hook;
- external editor/modal;
- solo vs multi-resource views;
- realtime incremental updates.

Implement those requirements independently from the public contract and browser primitives.

Committed documentation must read as a standalone library: generic vocabulary only, fictitious example resources, no product-specific history, and no references to gitignored scratch or research directories.

## MIT code reuse

If an MIT-licensed project later provides an algorithm worth adapting:

1. confirm the exact file/version/license;
2. preserve required copyright/license notices;
3. document the origin in the adapted file or `NOTICE`;
4. avoid mixing in differently licensed premium/proprietary code;
5. keep the public API driven by this project's needs rather than cloning another library wholesale.

## FullCalendar experiment

A separate spike may still test whether FullCalendar Community + a small resource extension is lower maintenance than owning the renderer. This prototype does not assume that outcome and should remain useful as the independent-contract reference.
