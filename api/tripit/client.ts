import type {
  TripItActivity,
  TripItAir,
  TripItLodging,
  TripItObject,
  TripItObjectType,
  TripItRawResponse,
  TripItResponse,
  TripItTrip,
  TripItWritableObjectType,
  TripItWeather
} from "./types";

type ClientOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
};

type RequestBody = Record<string, unknown>;
type Primitive = string | number | boolean;

type ListTripsOptions = {
  traveler?: boolean | "all";
  past?: boolean;
  modifiedSince?: number;
  includeObjects?: boolean;
  pageNum?: number;
  pageSize?: number;
};

type ListObjectsOptions = {
  tripId?: string;
  type?: Exclude<TripItObjectType, "profile" | "trip">;
  traveler?: boolean | "all";
  past?: boolean;
  modifiedSince?: number;
  pageNum?: number;
  pageSize?: number;
};

export class TripItClient {
  private baseUrl: string;
  private fetcher: typeof fetch;

  constructor({ baseUrl, fetcher = fetch }: ClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetcher = fetcher;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async post<T>(path: string, body: RequestBody): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body)
    });
  }

  async put<T>(path: string, body: RequestBody): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body)
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  getObject<T extends TripItObject = TripItObject>(
    type: TripItObjectType,
    id: string,
    options: { includeObjects?: boolean } = {}
  ) {
    const filters: Record<string, Primitive> = {};
    if (options.includeObjects !== undefined) filters.include_objects = options.includeObjects;

    return this.requestTripIt<T>(buildV1Path(["get", type, "id", id], filters));
  }

  getTrip(id: string, options: { includeObjects?: boolean } = {}) {
    return this.getObject<TripItTrip>("trip", id, options);
  }

  listTrips(options: ListTripsOptions = {}) {
    return this.requestTripIt<TripItTrip[]>(
      buildV1Path(["list", "trip"], listTripFilters(options))
    );
  }

  listObjects<T extends TripItObject = TripItObject>(options: ListObjectsOptions = {}) {
    return this.requestTripIt<T[]>(
      buildV1Path(["list", "object"], listObjectFilters(options))
    );
  }

  createObject<T extends TripItObject = TripItObject>(
    type: TripItWritableObjectType,
    body: RequestBody
  ) {
    return this.requestTripIt<T>("/v1/create/format/json", {
      method: "POST",
      body: JSON.stringify(toTripItRequestBody(type, body))
    });
  }

  replaceObject<T extends TripItObject = TripItObject>(
    type: TripItWritableObjectType,
    id: string,
    body: RequestBody
  ) {
    return this.requestTripIt<T>(
      buildV1Path(["replace", type, "id", id]),
      {
        method: "POST",
        body: JSON.stringify(toTripItRequestBody(type, body))
      }
    );
  }

  deleteObject(type: TripItWritableObjectType, id: string) {
    return this.requestTripIt<{ id: string; deleted: true }>(
      buildV1Path(["delete", type, "id", id])
    );
  }

  listAir(tripId?: string) {
    return this.listObjects<TripItAir>({ tripId, type: "air" });
  }

  listActivities(tripId?: string) {
    return this.listObjects<TripItActivity>({ tripId, type: "activity" });
  }

  listLodging(tripId?: string) {
    return this.listObjects<TripItLodging>({ tripId, type: "lodging" });
  }

  listWeather(tripId?: string) {
    return this.listObjects<TripItWeather>({ tripId, type: "weather" });
  }

  private async requestTripIt<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<TripItResponse<T>> {
    const raw = await this.request<TripItRawResponse<Record<string, unknown>>>(path, init);
    return normalizeTripItResponse<T>(raw);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      }
    });

    if (!response.ok) {
      throw new Error(`TripIt proxy request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}

function buildV1Path(parts: Array<string | number | boolean>, filters: Record<string, Primitive> = {}) {
  const pathParts = [...parts, ...Object.entries(filters).flat()]
    .map((part) => encodeURIComponent(String(part)));
  return `/v1/${pathParts.join("/")}/format/json`;
}

function listTripFilters(options: ListTripsOptions) {
  const filters: Record<string, Primitive> = {};
  if (options.traveler !== undefined) filters.traveler = options.traveler;
  if (options.past !== undefined) filters.past = options.past;
  if (options.modifiedSince !== undefined) filters.modified_since = options.modifiedSince;
  if (options.includeObjects !== undefined) filters.include_objects = options.includeObjects;
  if (options.pageNum !== undefined) filters.page_num = options.pageNum;
  if (options.pageSize !== undefined) filters.page_size = options.pageSize;
  return filters;
}

function listObjectFilters(options: ListObjectsOptions) {
  const filters: Record<string, Primitive> = {};
  if (options.tripId) filters.trip_id = options.tripId;
  if (options.type) filters.type = options.type;
  if (options.traveler !== undefined) filters.traveler = options.traveler;
  if (options.past !== undefined) filters.past = options.past;
  if (options.modifiedSince !== undefined) filters.modified_since = options.modifiedSince;
  if (options.pageNum !== undefined) filters.page_num = options.pageNum;
  if (options.pageSize !== undefined) filters.page_size = options.pageSize;
  return filters;
}

function toTripItRequestBody(type: TripItWritableObjectType, body: RequestBody) {
  return {
    [tripItPayloadKey(type)]: body
  };
}

function tripItPayloadKey(type: TripItWritableObjectType) {
  if (type === "trip") return "Trip";
  return `${capitalize(type)}Object`;
}

function normalizeTripItResponse<T>(raw: TripItRawResponse<Record<string, unknown>>): TripItResponse<T> {
  const dataKeys = Object.keys(raw).filter(
    (key) =>
      ![
        "timestamp",
        "num_bytes",
        "numbytes",
        "page_num",
        "page_size",
        "max_page",
        "Warning",
        "Error"
      ].includes(key)
  );
  const data =
    dataKeys.length === 1 ? raw[dataKeys[0]] : Object.fromEntries(dataKeys.map((key) => [key, raw[key]]));

  return {
    timestamp: toOptionalNumber(raw.timestamp),
    num_bytes: toOptionalNumber(raw.num_bytes),
    numbytes: toOptionalNumber(raw.numbytes),
    page_num: toOptionalNumber(raw.page_num),
    page_size: toOptionalNumber(raw.page_size),
    max_page: toOptionalNumber(raw.max_page),
    warnings: normalizeMessageList(raw.Warning),
    errors: normalizeMessageList(raw.Error),
    data: data as T
  };
}

function normalizeMessageList(value: unknown) {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

function toOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
