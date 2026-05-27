import { getRedisConnection } from "@/lib/redis";
import type { FlightRefreshJobData } from "@/types/flight-refresh";

export const FLIGHT_REFRESH_QUEUE = "flight-refresh";

type QueueConstructor = new (...args: unknown[]) => FlightQueue;
type QueueEventsConstructor = new (...args: unknown[]) => unknown;
type FlightQueue = {
  add: (
    name: string,
    data: FlightRefreshJobData,
    options: Record<string, unknown>
  ) => Promise<{ id?: string | number | null }>;
};

let queuePromise: Promise<FlightQueue> | null = null;
let queueEventsPromise: Promise<unknown> | null = null;

export async function getFlightRefreshQueue() {
  if (!queuePromise) {
    queuePromise = createFlightRefreshQueue();
  }

  return queuePromise;
}

export async function getFlightRefreshQueueEvents() {
  if (!queueEventsPromise) {
    queueEventsPromise = createFlightRefreshQueueEvents();
  }

  return queueEventsPromise;
}

export async function enqueueFlightRefresh(data: FlightRefreshJobData) {
  const queue = await getFlightRefreshQueue();
  const jobId = makeFlightRefreshJobId(data);

  return queue.add("refresh-flight", data, {
    jobId,
    priority: 1,
    delay: 0
  });
}

export function makeFlightRefreshJobId(input: FlightRefreshJobData) {
  return `refresh:${input.tripId}:${input.itemId}:${input.carrier}:${input.flightNumber}:${input.year}-${input.month}-${input.day}`;
}

async function createFlightRefreshQueue() {
  const [{ Queue }, connection] = await Promise.all([
    loadBullMq(),
    getRedisConnection()
  ]);

  return new Queue(FLIGHT_REFRESH_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 }
    }
  });
}

async function createFlightRefreshQueueEvents() {
  const [{ QueueEvents }, connection] = await Promise.all([
    loadBullMq(),
    getRedisConnection()
  ]);

  return new QueueEvents(FLIGHT_REFRESH_QUEUE, { connection });
}

async function loadBullMq(): Promise<{
  Queue: QueueConstructor;
  QueueEvents: QueueEventsConstructor;
}> {
  try {
    const importer = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{
      Queue: QueueConstructor;
      QueueEvents: QueueEventsConstructor;
    }>;

    return await importer("bullmq");
  } catch {
    throw new Error("Install bullmq before using the Redis flight refresh queue.");
  }
}
