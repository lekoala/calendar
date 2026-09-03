# Roadmap

The sequence is designed to prove the difficult core before adding breadth.

## Milestone 0 — skeleton (this zip)

- project/docs/testing scaffold;
- Temporal dependency and date helpers;
- Light-DOM custom element + explicit registration;
- basic `timeGrid`/`resourceTimeGrid` column rendering;
- minimal event/background geometry;
- incremental event mutation API;
- source API/race guard placeholder;
- core unit tests + browser smoke tests.

Exit condition: repository is a coherent starting point, not a production calendar.

## Milestone 1 — canonical model + solo TimeGrid

- finalize Event/Background/Resource normalization;
- Temporal parsing/serialization contract;
- visible range/navigation (`prev/next/today`);
- slot grid and current-time indicator;
- keyed event rendering;
- stable scroll preservation;
- custom event renderer;
- event click/keyboard activation;
- async source lifecycle.

Tests: date/DST, source races, rendering, click/keyboard.

## Milestone 2 — overlap layout + hover/select

- real overlap algorithm;
- hit-testing primitive;
- empty-slot hover preview;
- click selection;
- drag range selection + ghost;
- snap rules;
- cancellable selection events.

Tests: overlap matrix + pointer coordinates + selection residual-click suppression.

## Milestone 3 — event drag/resize

- Pointer Events state machine;
- event drag within/across day;
- resize end + resize start;
- mirror/ghost;
- autoscroll;
- read-only/`selectable`/`droppable`/`movable`/`resizable` states;
- application commit/revert contract.

Tests: normal/rejected/cancelled/lost-pointer paths.

## Milestone 4 — resourceTimeGrid

- resource/date column derivation;
- `resource → dates` headers only in v0.x;
- resource-aware event/background slicing;
- resource hit testing;
- drag resource A → B;
- `selectable`/`droppable` and `movable`/`resizable` enforcement;
- 1-day team-style view and 3-day comparison view.

Acceptance fixtures: 1×7, 2×3, 6×1, 6×3, 12×1. Manual stress: 12×3, 6×7. Columns keep a minimum width with horizontal scroll; never hide resources automatically.

## Milestone 5 — mobile + accessibility hardening

- touch thresholds/long press if retained;
- responsive density guidance;
- keyboard navigation model;
- non-pointer move/resize commands;
- reduced motion / forced colors;
- cross-browser Chromium/Firefox/WebKit.

## Milestone 6 — month + list

- month renderer;
- list renderer;
- render hooks;
- view switching/cache reuse;
- summary use cases without forcing giant resource grids.

## Milestone 7 — package/release engineering

Adopt the combobox-style release model:

- dist ESM/classic build as appropriate;
- CSS output;
- `.d.ts` generation;
- `custom-elements.json`;
- `sync` command;
- generated drift gate;
- package tarball contract;
- demo against distributable output;
- CI browser matrix.

## Post-0.x candidates (only with use cases)

- generic mini-calendar/date navigator package;
- resource grouping metadata;
- resource header grouping/order modes;
- optional recurrence adapter;
- framework adapters;
- advanced all-day lane;
- drag from external sources;
- print/export helpers.

Still not automatically planned: virtualization, Gantt, enterprise resource timeline/tree-grid.
