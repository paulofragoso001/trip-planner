import { getRedisConnection } from "@/lib/redis";
import {
  workerActiveJobs,
  workerFailedJobs,
  workerJobsTotal,
  workerQueuedJobs,
  workerQueueHealth,
  workerRetriesTotal,
  workerStalledJobs
} from "@/lib/prometheus";

type QueueHealth = {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: number;
  stalled: number;
  oldestActiveAgeMs: number | null;
  oldestWaitingAgeMs: number | null;
  healthy: boolean;
  lastCheckedAt: string;
};

type BullJob = {
  id?: string | number | null;
  name: string;
  data: unknown;
  opts: { attempts?: number };
  attemptsMade: number;
  failedReason?: string;
  processedOn?: number;
  timestamp?: number;
  getState: () => Promise<string>;
  retry: () => Promise<unknown>;
  moveToDelayed: (timestamp: number, token?: unknown) => Promise<unknown>;
};

type QueueInstance = {
  getWaiting: () => Promise<BullJob[]>;
  getActive: () => Promise<BullJob[]>;
  getDelayed: () => Promise<BullJob[]>;
  getFailed: (start?: number, end?: number) => Promise<BullJob[]>;
  getCompleted: () => Promise<BullJob[]>;
  getJobCounts: (...types: string[]) => Promise<Record<string, number>>;
  getStalledCount?: () => Promise<number>;
  close: () => Promise<void>;
};

type QueueEventsInstance = {
  on: (
    event: "stalled" | "failed" | "waiting" | "completed",
    handler: (event: Record<string, unknown>) => void | Promise<void>
  ) => void;
  close: () => Promise<void>;
};

type QueueConstructor = new (...args: unknown[]) => QueueInstance;
type QueueEventsConstructor = new (...args: unknown[]) => QueueEventsInstance;

const QUEUE_NAME = "flight-refresh";
const MONITOR_LOCK_KEY = "monitor:flight-refresh:leader";
const HEALTH_KEY = `monitor:health:${QUEUE_NAME}`;
const MONITOR_LOCK_TTL_MS = Number(process.env.FLIGHT_REFRESH_MONITOR_LOCK_TTL_MS || 45_000);
const STALE_ACTIVE_MS = 10 * 60_000;
const STALE_WAITING_MS = 15 * 60_000;
const CHECK_INTERVAL_MS = Number(process.env.FLIGHT_REFRESH_MONITOR_INTERVAL_MS || 30_000);

let queuePromise: Promise<QueueInstance> | null = null;
let queueEventsPromise: Promise<QueueEventsInstance> | null = null;

export async function startFlightRefreshMonitor() {
  const redis = await getRedisConnection();
  const token = await acquireLeaderLock();

  if (!token) return null;

  const queue = await getMonitorQueue();
  const queueEvents = await getMonitorQueueEvents();
  const timer = setInterval(async () => {
    try {
      await refreshLeaderLock(token);
      await monitorOnce();
    } catch (error) {
      console.error("flight-refresh monitor error", error);
    }
  }, CHECK_INTERVAL_MS);

  queueEvents.on("stalled", async ({ jobId }) => {
    workerStalledJobs.inc({ queue: QUEUE_NAME });
    console.warn("stalled job detected", { jobId, queue: QUEUE_NAME });
  });

  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    workerJobsTotal.inc({ queue: QUEUE_NAME, status: "failed" });
    console.warn("failed job detected", { jobId, failedReason, queue: QUEUE_NAME });
  });

  queueEvents.on("completed", async ({ jobId }) => {
    workerJobsTotal.inc({ queue: QUEUE_NAME, status: "completed" });
    console.info("completed job detected", { jobId, queue: QUEUE_NAME });
  });

  queueEvents.on("waiting", async ({ jobId }) => {
    console.info("job waiting", { jobId, queue: QUEUE_NAME });
  });

  await monitorOnce();

  return async function stop() {
    clearInterval(timer);
    await releaseLeaderLock(token);
    await queueEvents.close();
    await queue.close();
    await redis.del(`${MONITOR_LOCK_KEY}:stopped`);
  };
}

export async function getFlightRefreshHealth() {
  const redis = await getRedisConnection();
  const snapshot = await redis.get(HEALTH_KEY);

  if (snapshot) return JSON.parse(snapshot) as QueueHealth;
  return monitorOnce();
}

async function acquireLeaderLock() {
  const redis = await getRedisConnection();
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const ok = await redis.set(MONITOR_LOCK_KEY, token, "PX", MONITOR_LOCK_TTL_MS, "NX");
  return ok === "OK" ? token : null;
}

async function refreshLeaderLock(token: string) {
  const redis = await getRedisConnection();
  const current = await redis.get(MONITOR_LOCK_KEY);

  if (current === token) {
    await redis.pexpire(MONITOR_LOCK_KEY, MONITOR_LOCK_TTL_MS);
  }
}

async function releaseLeaderLock(token: string) {
  const redis = await getRedisConnection();
  const current = await redis.get(MONITOR_LOCK_KEY);

  if (current === token) {
    await redis.del(MONITOR_LOCK_KEY);
  }
}

async function getQueueHealth(): Promise<QueueHealth> {
  const queue = await getMonitorQueue();
  const [waiting, active, delayed, failed, completed, counts, stalled] =
    await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getDelayed(),
      queue.getFailed(),
      queue.getCompleted(),
      queue.getJobCounts("paused"),
      queue.getStalledCount ? queue.getStalledCount() : Promise.resolve(0)
    ]);
  const now = Date.now();
  const oldestActiveAgeMs =
    active.length > 0
      ? Math.max(...active.map((job) => (job.processedOn ? now - job.processedOn : 0)))
      : null;
  const oldestWaitingAgeMs =
    waiting.length > 0
      ? Math.max(...waiting.map((job) => (job.timestamp ? now - job.timestamp : 0)))
      : null;
  const healthy =
    (oldestActiveAgeMs === null || oldestActiveAgeMs < STALE_ACTIVE_MS) &&
    (oldestWaitingAgeMs === null || oldestWaitingAgeMs < STALE_WAITING_MS) &&
    failed.length < 50;

  workerActiveJobs.set({ queue: QUEUE_NAME }, active.length);
  workerQueuedJobs.set({ queue: QUEUE_NAME }, waiting.length);
  workerFailedJobs.set({ queue: QUEUE_NAME }, failed.length);
  workerQueueHealth.set({ queue: QUEUE_NAME }, healthy ? 1 : 0);

  return {
    queue: QUEUE_NAME,
    waiting: waiting.length,
    active: active.length,
    delayed: delayed.length,
    failed: failed.length,
    completed: completed.length,
    paused: counts.paused || 0,
    stalled: Number(stalled || 0),
    oldestActiveAgeMs,
    oldestWaitingAgeMs,
    healthy,
    lastCheckedAt: new Date().toISOString()
  };
}

async function moveStaleActiveJobsBackToWaiting() {
  const queue = await getMonitorQueue();
  const active = await queue.getActive();
  const now = Date.now();

  for (const job of active) {
    const runningFor = job.processedOn ? now - job.processedOn : 0;
    if (runningFor < STALE_ACTIVE_MS) continue;

    try {
      const state = await job.getState();
      if (state !== "active") continue;
      workerRetriesTotal.inc({ queue: QUEUE_NAME, reason: "stale-active" });
      await job.retry();
    } catch {
      try {
        workerRetriesTotal.inc({ queue: QUEUE_NAME, reason: "move-to-delayed" });
        await job.moveToDelayed(Date.now() + 60_000);
      } catch {
        // BullMQ may already have moved or failed the job by the time the monitor acts.
      }
    }
  }
}

async function deadLetterRepeatedFailures() {
  const redis = await getRedisConnection();
  const queue = await getMonitorQueue();
  const failed = await queue.getFailed(0, 20);

  for (const job of failed) {
    if (job.attemptsMade < (job.opts.attempts ?? 1)) continue;

    await redis.hset(
      "monitor:dead-letter",
      String(job.id),
      JSON.stringify({
        queue: QUEUE_NAME,
        jobId: job.id,
        name: job.name,
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason,
        failedAt: new Date().toISOString()
      })
    );
  }
}

async function writeHealthSnapshot(snapshot: QueueHealth) {
  const redis = await getRedisConnection();
  await redis.set(HEALTH_KEY, JSON.stringify(snapshot), "EX", 120);
}

async function monitorOnce() {
  const snapshot = await getQueueHealth();
  await writeHealthSnapshot(snapshot);

  if (!snapshot.healthy) {
    await moveStaleActiveJobsBackToWaiting();
    await deadLetterRepeatedFailures();
  }

  return snapshot;
}

async function getMonitorQueue() {
  if (!queuePromise) {
    queuePromise = createMonitorQueue();
  }

  return queuePromise;
}

async function getMonitorQueueEvents() {
  if (!queueEventsPromise) {
    queueEventsPromise = createMonitorQueueEvents();
  }

  return queueEventsPromise;
}

async function createMonitorQueue() {
  const [{ Queue }, connection] = await Promise.all([
    loadBullMq(),
    getRedisConnection()
  ]);

  return new Queue(QUEUE_NAME, { connection });
}

async function createMonitorQueueEvents() {
  const [{ QueueEvents }, connection] = await Promise.all([
    loadBullMq(),
    getRedisConnection()
  ]);

  return new QueueEvents(QUEUE_NAME, { connection });
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
    throw new Error("Install bullmq before using the flight refresh monitor.");
  }
}
