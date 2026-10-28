# Framework integration

`<calendar-view>` is a standard custom element. There is no framework runtime
and no adapter package to install: use a ref, assign complex data as properties,
attach DOM listeners, and clean them up.

The examples below assume:

```js
import "@lekoala/calendar/calendar.css";
import "@lekoala/calendar/define";
```

`@lekoala/calendar/define` registers the element. The bare
`@lekoala/calendar` import exports `CalendarViewElement` and
`defineCalendarView` without registering anything, which is useful for tests
or for registering a custom tag name.

## Rules that apply to every framework

- **Attributes are strings.** `view`, `date`, `slot-min`, `slot-max` and
  `slot-duration` are fine as attributes.
- **Data is a property.** Assign `events`, `resources`, `backgrounds` and
  `resourceGroups` as JavaScript arrays on the element, never as serialized
  attributes.
- **Configuration happens after mount.** Call `configure({ timeZone, locale,
  eventSource, ... })` once the element exists.
- **Configuring a source does not fetch it.** `configure({ eventSource })`
  only installs the source; call `await el.refetchEvents()` (or navigate) to
  load it.
- **Listen to DOM events.** Use `addEventListener("calendar:select", ...)`
  and remove it on unmount. The events bubble and are composed.
- **Do not recreate the element on every render.** Keep the same node and
  update properties/configuration, or selection, scroll and focus are lost.

## React

```jsx
import { useEffect, useRef } from "react";
import "@lekoala/calendar/calendar.css";
import "@lekoala/calendar/define";

export function Calendar({ events, resources, options, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.events = events;
    el.resources = resources;
    el.configure(options ?? {});

    // Installing a source does not load it.
    if (options?.eventSource) void el.refetchEvents();
  }, [events, resources, options]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onSelect) return;
    const handler = (event) => onSelect(event.detail);
    el.addEventListener("calendar:select", handler);
    return () => el.removeEventListener("calendar:select", handler);
  }, [onSelect]);

  return <calendar-view ref={ref} view="week" />;
}
```

Notes:

- Keep `options` referentially stable (memoize it). A new object on every
  render calls `configure()` and schedules another render.
- If the element is inside a component that can unmount, the cleanup above is
  enough: the element owns its own source abort and timers.
- TypeScript users may need a JSX intrinsic declaration for `calendar-view`;
  the package ships `custom-elements.json` and DOM declarations, not a
  framework-specific JSX namespace.

## Vue 3

```vue
<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import "@lekoala/calendar/calendar.css";
import "@lekoala/calendar/define";

const props = defineProps({
  events: { type: Array, default: () => [] },
  resources: { type: Array, default: () => [] },
  options: { type: Object, default: () => ({}) },
});
const emit = defineEmits(["select"]);
const el = ref(null);

function onSelect(event) {
  emit("select", event.detail);
}

onMounted(() => {
  el.value.events = props.events;
  el.value.resources = props.resources;
  el.value.configure(props.options);
  if (props.options.eventSource) void el.value.refetchEvents();
  el.value.addEventListener("calendar:select", onSelect);
});

onBeforeUnmount(() => {
  el.value?.removeEventListener("calendar:select", onSelect);
});

watch(
  () => props.events,
  (events) => {
    if (el.value) el.value.events = events;
  },
);

watch(
  () => props.resources,
  (resources) => {
    if (el.value) el.value.resources = resources;
  },
);

watch(
  () => props.options,
  (options) => {
    if (!el.value) return;
    el.value.configure(options);
    if (options.eventSource) void el.value.refetchEvents();
  },
);
</script>

<template>
  <calendar-view ref="el" view="week" />
</template>
```

Notes:

- Do not put `:events="events"` on the tag: Vue would set an attribute, not
  the property. Assign it in `onMounted`/`watch` as shown.
- If `options` contains `eventSource`, watch it and call `refetchEvents()`
  after `configure()`, otherwise the new source is installed but not loaded.

## Svelte

```svelte
<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import "@lekoala/calendar/calendar.css";
  import "@lekoala/calendar/define";

  export let events = [];
  export let resources = [];
  export let options = {};

  const dispatch = createEventDispatcher();
  let el;
  let off = null;

  onMount(() => {
    el.events = events;
    el.resources = resources;
    el.configure(options);
    if (options.eventSource) void el.refetchEvents();
    const handler = (event) => dispatch("select", event.detail);
    el.addEventListener("calendar:select", handler);
    off = () => el.removeEventListener("calendar:select", handler);
  });

  onDestroy(() => off?.());

  $: if (el) el.events = events;
  $: if (el) el.resources = resources;
</script>

<calendar-view bind:this={el} view="week" />
```

For Svelte 5, replace the `export let` props and `$:` statements with
`$props()` and `$effect()` while keeping the same property assignment and
listener cleanup.

## Loading state

`calendar:loading` brackets every source run, including aborted/superseded
ones:

```js
el.addEventListener("calendar:loading", (event) => {
  spinner.hidden = !event.detail.loading;
});
```

A failed source dispatches `calendar:loaderror` and keeps the previous valid
data. Do not clear the calendar from `calendar:render`.

## SSR and server rendering

Import `@lekoala/calendar/define` only in the browser. The bare main entry is
side-effect-free, so a server bundle can import `CalendarViewElement` without
touching `customElements`. Render the tag on the server only as an empty
host; the client attaches data after mount.

## Further reading

- [API](API.md)
- [Integration boundaries](INTEGRATION.md)
- [Data sources and realtime](DATA_AND_REALTIME.md)
- [Recipes](RECIPES.md)
