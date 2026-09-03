export function normalizeEvent(event) {
  if (!event || event.id == null || !event.start || !event.end) {
    throw new TypeError("Event requires id, start and end");
  }
  const { classNames, extendedProps, ...rest } = event;
  return {
    editable: true,
    ...rest,
    id: String(event.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  };
}

export function isMovable(event, calendarEditable) {
  return event.movable ?? event.editable ?? calendarEditable ?? true;
}

export function isResizable(event, calendarEditable) {
  return event.resizable ?? event.editable ?? calendarEditable ?? true;
}

export function normalizeBackground(background) {
  if (!background || background.id == null || !background.start || !background.end) {
    throw new TypeError("Background requires id, start and end");
  }
  const { classNames, extendedProps, ...rest } = background;
  return {
    ...rest,
    id: String(background.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  };
}

export function normalizeResource(resource) {
  if (!resource || resource.id == null) {
    throw new TypeError("Resource requires id");
  }
  const { classNames, extendedProps, ...rest } = resource;
  return {
    title: String(resource.id),
    selectable: true,
    droppable: true,
    ...rest,
    id: String(resource.id),
    classNames: Array.from(classNames ?? []),
    extendedProps: { ...(extendedProps ?? {}) },
  };
}
