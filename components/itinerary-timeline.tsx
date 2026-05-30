export type ItineraryTimelineItem = {
  id?: string;
  date?: string;
  time?: string;
  title?: string;
  location?: string;
  type?: string;
  confirmation?: string;
  notes?: string;
};

type ItineraryTimelineProps = {
  items?: unknown[] | null;
};

export function ItineraryTimeline({ items }: ItineraryTimelineProps) {
  const groupedItems = groupItems(items);

  if (groupedItems.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-line bg-white p-4 text-sm leading-6 text-slate-600">
        No itinerary items imported yet. Uploaded plans, booking confirmations, and
        route search results will appear here by date.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-line">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        Itinerary
      </p>

      <div className="mt-4 grid gap-5">
        {groupedItems.map((group) => (
          <section key={group.date} className="grid gap-3">
            <h4 className="text-sm font-black text-ink">{group.label}</h4>
            <ol className="relative grid gap-3 border-l border-line pl-5">
              {group.items.map((item, index) => (
                <li key={`${group.date}-${item.id || item.title}-${index}`} className="relative">
                  <span className="absolute -left-[1.7rem] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand ring-2 ring-blue-100" />
                  <div className="rounded-lg border border-line bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-ink">{item.title}</p>
                        {item.location ? (
                          <p className="mt-1 text-sm font-semibold text-slate-600">
                            {item.location}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.time ? <Badge>{item.time}</Badge> : null}
                        {item.type ? <Badge>{item.type}</Badge> : null}
                      </div>
                    </div>

                    {item.confirmation ? (
                      <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Confirmation {item.confirmation}
                      </p>
                    ) : null}

                    {item.notes ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.notes}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-line">
      {children}
    </span>
  );
}

function groupItems(items?: unknown[] | null) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map(normalizeItem)
    .filter((item): item is ItineraryTimelineItem & { title: string; date: string } =>
      Boolean(item?.title && item.date)
    )
    .sort((first, second) => {
      const firstTime = `${first.date} ${first.time || "00:00"}`;
      const secondTime = `${second.date} ${second.time || "00:00"}`;
      return firstTime.localeCompare(secondTime);
    });

  const groups = new Map<string, Array<ItineraryTimelineItem & { title: string; date: string }>>();

  normalizedItems.forEach((item) => {
    const group = groups.get(item.date) || [];
    group.push(item);
    groups.set(item.date, group);
  });

  return Array.from(groups.entries()).map(([date, group]) => ({
    date,
    label: formatDateLabel(date),
    items: group
  }));
}

function normalizeItem(item: unknown): ItineraryTimelineItem | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const dateTime =
    readString(record.date_time) ||
    readString(record.datetime) ||
    readString(record.starttime) ||
    readString(record.start_time);

  return {
    id: readString(record.id),
    date:
      readString(record.date) ||
      readString(record.start_date) ||
      readString(record.day) ||
      readDate(dateTime),
    time: readString(record.time) || readTime(dateTime),
    title: readString(record.title) || readString(record.name) || readString(record.summary),
    location: readString(record.location) || readString(record.address),
    type:
      readString(record.type) ||
      readString(record.segment_type) ||
      readString(record.kind) ||
      readString(record.category),
    confirmation:
      readString(record.confirmation) ||
      readString(record.confirmation_code) ||
      readString(record.confirmation_number),
    notes: readString(record.notes) || readString(record.description)
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDate(value?: string) {
  return value?.slice(0, 10);
}

function readTime(value?: string) {
  if (!value) return undefined;
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

function formatDateLabel(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsedDate);
}
