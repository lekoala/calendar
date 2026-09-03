import { eventGeometry } from "../core/geometry.js";
import { layoutEvents } from "../core/layout.js";

function clockToMinutes(value) {
  const [hour, minute = "0"] = String(value).split(":");
  return Number(hour) * 60 + Number(minute);
}

function eventMinutes(isoLike) {
  // Prototype shortcut: the public model is Temporal/ZonedDateTime, but this
  // renderer only needs wall-clock geometry for the first spike.
  // TODO: parse through the shared Temporal adapter once timezone/view logic lands.
  const match = String(isoLike).match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

export function renderTimeGrid({
  dates,
  resources,
  events,
  backgrounds,
  options,
  eventContent,
  dayHeaderContent,
  resourceHeaderContent,
}) {
  const fragment = document.createDocumentFragment();
  const root = document.createElement("div");
  root.className = "cv-grid";

  const axis = document.createElement("div");
  axis.className = "cv-axis";
  root.append(axis);

  const startMinutes = clockToMinutes(options.slotMin);
  const endMinutes = clockToMinutes(options.slotMax);
  const pxPerMinute = options.pxPerMinute;
  const totalHeight = (endMinutes - startMinutes) * pxPerMinute;
  axis.style.height = `${totalHeight}px`;

  for (let minute = startMinutes; minute <= endMinutes; minute += 60) {
    const label = document.createElement("div");
    label.className = "cv-axis-label";
    label.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
    label.textContent = `${String(Math.floor(minute / 60)).padStart(2, "0")}:00`;
    axis.append(label);
  }

  const columns = resources.length
    ? resources.flatMap((resource) => dates.map((date) => ({ date, resource })))
    : dates.map((date) => ({ date, resource: null }));

  root.style.gridTemplateColumns = `3.5rem repeat(${Math.max(1, columns.length)}, minmax(var(--calendar-column-min), 1fr))`;

  for (const column of columns) {
    const day = document.createElement("section");
    day.className = "cv-day";
    day.dataset.date = column.date.toString();
    if (column.resource) day.dataset.resourceId = column.resource.id;

    const header = document.createElement("header");
    header.className = "cv-day-header";
    const headerContent = column.resource
      ? resourceHeaderContent?.({ date: column.date, resource: column.resource, element: header })
      : dayHeaderContent?.({ date: column.date, element: header });
    if (headerContent instanceof Node) header.append(headerContent);
    else if (headerContent != null) header.textContent = String(headerContent);
    else
      header.textContent = column.resource
        ? `${column.resource.title} · ${column.date.toString()}`
        : column.date.toString();
    day.append(header);

    const body = document.createElement("div");
    body.className = "cv-day-body";
    body.style.height = `${totalHeight}px`;

    for (let minute = startMinutes; minute <= endMinutes; minute += 60) {
      const line = document.createElement("div");
      line.className = "cv-hour-line";
      line.style.top = `${(minute - startMinutes) * pxPerMinute}px`;
      body.append(line);
    }

    for (const background of backgrounds) {
      const sameResource =
        !column.resource || !background.resourceId || background.resourceId === column.resource.id;
      const sameDay = String(background.start).startsWith(column.date.toString());
      if (!sameResource || !sameDay) continue;
      const geometry = eventGeometry({
        startMinutes: eventMinutes(background.start),
        endMinutes: eventMinutes(background.end),
        dayStartMinutes: startMinutes,
        pxPerMinute,
        gap: 0,
      });
      const node = document.createElement("div");
      node.className = ["cv-background", ...(background.classNames ?? [])].join(" ");
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      body.append(node);
    }

    const dayEvents = events.filter((event) => {
      const sameDay = String(event.start).startsWith(column.date.toString());
      const sameResource = !column.resource || event.resourceId === column.resource.id;
      return sameDay && sameResource;
    });

    for (const item of layoutEvents(dayEvents)) {
      const { event } = item;
      const geometry = eventGeometry({
        startMinutes: eventMinutes(event.start),
        endMinutes: eventMinutes(event.end),
        dayStartMinutes: startMinutes,
        pxPerMinute,
      });
      const node = document.createElement("button");
      node.type = "button";
      node.className = ["cv-event", ...(event.classNames ?? [])].join(" ");
      node.dataset.eventId = event.id;
      node.style.top = `${geometry.top}px`;
      node.style.height = `${geometry.height}px`;
      node.style.left = `${item.left * 100}%`;
      node.style.width = `${item.width * 100}%`;
      node.setAttribute("aria-label", `${event.title ?? "Event"}, ${event.start} – ${event.end}`);

      const content = eventContent?.({ event, date: column.date, resource: column.resource, element: node });
      if (content instanceof Node) node.append(content);
      else node.textContent = content == null ? (event.title ?? "Event") : String(content);

      body.append(node);
    }

    // TODO: hover-slot overlay, selection ghost, current-time line and resize handles.
    day.append(body);
    root.append(day);
  }

  fragment.append(root);
  return fragment;
}
