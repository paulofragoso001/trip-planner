"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type DraggableItem = {
  id: string;
  title: string;
  location: string | null;
  lat?: number | null;
  lng?: number | null;
  segment_type?: string | null;
  provider?: string | null;
  confirmation_code?: string | null;
  date_time?: string | null;
  flight_number?: string | null;
  airline?: string | null;
  departure_airport?: string | null;
  arrival_airport?: string | null;
  scheduled_departure?: string | null;
  estimated_departure?: string | null;
  gate?: string | null;
  terminal?: string | null;
  flight_status?: string | null;
  last_status_checked_at?: string | null;
  flight_lat?: number | null;
  flight_lng?: number | null;
  flight_altitude?: number | null;
  flight_bearing?: number | null;
  flight_speed?: number | null;
  flight_position_updated_at?: string | null;
  departure_airport_lat?: number | null;
  departure_airport_lng?: number | null;
  arrival_airport_lat?: number | null;
  arrival_airport_lng?: number | null;
};

export type DashboardTimelineItem = DraggableItem & {
  position?: number | null;
  notes?: string | null;
};

type DraggableListProps<TItem extends DraggableItem> = {
  items: TItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onReorder: (items: TItem[]) => void;
};

export default function DraggableList<TItem extends DraggableItem>({
  items,
  selectedId,
  onSelect,
  onReorder
}: DraggableListProps<TItem>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div
          className="mt-5 grid gap-3"
          data-testid="timeline-list"
          role="list"
          aria-label="Trip itinerary"
        >
          {items.map((item, index) => {
            const currentDateKey = item.date_time ? new Date(item.date_time).toDateString() : "unscheduled";
            const previousItem = items[index - 1];
            const previousDateKey = previousItem?.date_time
              ? new Date(previousItem.date_time).toDateString()
              : "unscheduled";
            const showDateHeader = index === 0 || currentDateKey !== previousDateKey;

            return (
              <div className="grid gap-3" key={item.id}>
                {showDateHeader ? (
                  <div className="rounded-lg bg-[#f2f2f6] px-4 py-3 text-sm font-black text-[#6f675c]" role="presentation">
                    {formatDateHeader(item.date_time)}
                  </div>
                ) : null}
                <SortableItem
                  id={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={onSelect}
                />
              </div>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem<TItem extends DraggableItem>({
  id,
  item,
  selected = false,
  onSelect
}: {
  id: string;
  item: TItem;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging
  } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const time = formatTimeParts(item.date_time);

  return (
    <article
      ref={setNodeRef}
      aria-label={`${item.title}, ${formatSegmentType(item.segment_type)}`}
      className={`rounded-2xl border p-4 transition ${
        selected ? "border-brand bg-blue-50" : "border-line hover:bg-slate-50"
      } ${isDragging ? "opacity-70 shadow-panel" : ""}`}
      data-testid={`timeline-item-${id}`}
      role="listitem"
      style={style}
      onClick={() => onSelect?.(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect?.(id);
        }
      }}
    >
      <div className="grid gap-4 md:grid-cols-[96px_56px_minmax(0,1fr)_auto]">
        <div className="text-left md:text-right">
          <p className="text-lg font-black text-ink">{time.time}</p>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#6f675c]">{time.zone}</p>
        </div>
        <div className="relative hidden justify-center md:flex" aria-hidden="true">
          <span className="absolute bottom-[-1rem] top-11 w-1 rounded-full bg-[#9a9a9a]" />
          <span className="relative z-10 grid h-11 w-11 place-items-center rounded-full bg-[#8d8d8d] text-lg font-black text-white">
            {segmentIcon(item.segment_type)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a8175]">
            {formatSegmentType(item.segment_type)}
          </div>
          <h3 className="mt-1 font-black">{item.title}</h3>
          <p className="mt-1 text-sm text-[#6f675c]">{item.location || "No location"}</p>
          {item.date_time ? (
            <p className="mt-1 text-sm text-[#6f675c]">{formatTime(item.date_time)}</p>
          ) : null}
          {item.provider || item.confirmation_code ? (
            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <span>{item.provider || "Provider pending"}</span>
              <span>{item.confirmation_code ? `Conf. ${item.confirmation_code}` : "No confirmation"}</span>
            </div>
          ) : null}
          {isFlightItem(item) ? (
            <FlightStatusSummary item={item} />
          ) : null}
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-black/10 px-3 py-2 text-xs font-bold text-brand"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Actions
          </button>
        <button
          ref={setActivatorNodeRef}
          type="button"
          data-testid={`timeline-drag-handle-${id}`}
          aria-label={`Drag ${item.title}`}
          className="cursor-grab rounded-full border border-black/10 px-3 py-2 text-xs font-bold active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          Drag
        </button>
        </div>
      </div>
    </article>
  );
}

function FlightStatusSummary({ item }: { item: DraggableItem }) {
  const status = item.flight_status || "scheduled";
  const statusLabel = formatFlightStatus(status);
  const detailParts = [
    item.flight_number,
    item.airline,
    item.departure_airport && item.arrival_airport
      ? `${item.departure_airport} to ${item.arrival_airport}`
      : null
  ].filter(Boolean);

  return (
    <div
      className="mt-3 rounded-xl border border-black/10 bg-white p-3 text-xs"
      data-testid={`flight-status-${item.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 font-black uppercase tracking-[0.08em] ${
            status === "cancelled"
              ? "bg-red-100 text-red-700"
              : status === "delayed"
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-evergreen"
          }`}
        >
          {statusLabel}
        </span>
        {detailParts.length ? (
          <span className="font-bold text-[#6f675c]">{detailParts.join(" · ")}</span>
        ) : null}
      </div>
      <div className="mt-2 grid gap-1 text-[#6f675c] sm:grid-cols-2">
        <span>{item.estimated_departure ? `Estimated ${formatTime(item.estimated_departure)}` : "Estimated time pending"}</span>
        <span>{[item.terminal ? `Terminal ${item.terminal}` : null, item.gate ? `Gate ${item.gate}` : null].filter(Boolean).join(" · ") || "Gate pending"}</span>
      </div>
    </div>
  );
}

function isFlightItem(item: DraggableItem) {
  const type = item.segment_type?.toLowerCase() ?? "";
  return Boolean(
    item.flight_status ||
      item.flight_number ||
      item.gate ||
      type.includes("air") ||
      type.includes("flight")
  );
}

function formatFlightStatus(value: string) {
  return value.replace(/_/g, " ");
}

function formatSegmentType(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "activity";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatDateHeader(value?: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function formatTimeParts(value?: string | null) {
  if (!value) {
    return { time: "TBD", zone: "" };
  }

  const date = new Date(value);
  return {
    time: new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(date),
    zone:
      new Intl.DateTimeFormat(undefined, {
        timeZoneName: "short"
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? ""
  };
}

function segmentIcon(value?: string | null) {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("air") || normalized.includes("flight")) return "A";
  if (normalized.includes("hotel")) return "H";
  if (normalized.includes("meeting")) return "M";
  if (normalized.includes("transport")) return "T";
  return "P";
}
