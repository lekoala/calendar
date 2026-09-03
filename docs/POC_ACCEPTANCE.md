# POC acceptance checklist

Before deciding the core architecture is viable, one demo should prove the following without domain-specific code inside the engine.

## Scenario A — solo

- one agenda;
- 3-day time grid;
- ~30 events with several overlaps;
- background ranges;
- current time;
- custom event DOM;
- hover empty slot;
- select a range;
- drag event in time/day;
- resize start/end;
- external modal opened from event click;
- incremental remote update while keeping scroll/date.

## Scenario B — resources

- 2 resources × 3 days;
- resource → date headers;
- resource-specific backgrounds;
- drag event resource A → B;
- one read-only resource;
- range selection returns resource id.

## Scenario C — larger team

- 1 resource × 7 days;
- 2 resources × 3 days;
- 6 resources × 1 day;
- 6 resources × 3 days;
- 12 resources × 1 day;
- horizontal scrolling with a minimum column width remains predictable;
- no virtualization;
- no automatic hiding of resources or days;
- note where the view becomes UX limited rather than technically slow.

## Scenario D — async races

Rapidly switch date/resource sets with deliberately delayed source responses. Only the newest state may render.

## Scenario E — realtime

Simulate add/update/remove events every few seconds while a user is scrolled mid-day. No navigation/scroll reset.

## Stop conditions

Do not keep layering patches if the architecture requires:

- full grid rerender on every pointer move;
- domain-specific concepts to express generic interactions;
- duplicate solo/resource interaction engines;
- unbounded document/window listeners;
- resource drag implemented as application-specific special cases.

If these appear, fix the core boundary before adding features.
