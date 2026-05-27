import { getFlightRefreshQueue, makeFlightRefreshJobId } from "@/lib/flight-refresh-queue";
import { recordJobStart, workerJobsTotal } from "@/lib/prometheus";
import { refreshSingleFlightTruth } from "@/lib/flight-refresh-truth";
import { getRedisConnection } from "@/lib/redis";
import type {
  FlightRefreshJobData,
  FlightRefreshResult
} from "@/types/flight-refresh";

type BullJob<T> = {
  id?: string | number | null;
  name: string;
  data: T;
  updateProgress: (progress: number) => Promise<void>;
};

type WorkerConstructor = new (
  name: string,
  processor: (job: BullJob<FlightRefreshJobData>) => Promise<FlightRefreshResult>,
  options: Record<string, unknown>
) => WorkerInstance;

type WorkerInstance = {
  on: (
    event: "failed" | "completed",
    handler: (job: BullJob<FlightRefreshJobData> | undefined, error?: Error) => void | Promise<void>
  ) => void;
};

const concurrency = Number(process.env.FLIGHT_REFRESH_CONCURRENCY || 5);
const lockTtlMs = Number(process.env.FLIGHT_REFRESH_LOCK_TTL_MS || 120000);
const jobTtlSeconds = Number(process.env.FLIGHT_REFRESH_JOB_TTL_SECONDS || 3600);

let workerPromise: Promise<WorkerInstance> | null = null;

export async function startFlightRefreshWorker() {
  if (!workerPromise) {
    workerPromise = createFlightRefreshWorker();
  }

  return workerPromise;
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

async function createFlightRefreshWorker() {
  const [{ Worker }, connection] = await Promise.all([
    loadBullMq(),
    getRedisConnection()
  ]);
  const worker = new Worker(
    "flight-refresh",
    async (job: BullJob<FlightRefreshJobData>) => {
      const key = lockKey(job.data);
      const token = await acquireLock(key);

      if (!token) {
        workerJobsTotal.inc({ queue: "flight-refresh", status: "skipped-locked" });
        return {
          refreshed: false,
          cached: true,
          flightId: null,
          updatedAt: new Date().toISOString()
        };
      }

      const stopTimer = recordJobStart(job.name);
      let status = "completed";

      try {
        const result = await refreshFlightTruth(job.data);
        await job.updateProgress(100);
        workerJobsTotal.inc({ queue: "flight-refresh", status: "completed" });
        return result;
      } catch (error) {
        status = "failed";
        workerJobsTotal.inc({ queue: "flight-refresh", status: "failed" });
        throw error;
      } finally {
        stopTimer({ status });
        await releaseLock(key, token);
      }
    },
    {
      connection,
      concurrency,
      prefix: "wayline"
    }
  );

  worker.on("failed", async (job, error) => {
    console.error("flight-refresh failed", job?.id, error?.message);
  });

  worker.on("completed", async (job) => {
    const redis = await getRedisConnection();
    const payload = JSON.stringify({
      jobId: job?.id,
      completedAt: new Date().toISOString()
    });

    await redis.set(`flight-refresh:done:${job?.id}`, payload, "EX", jobTtlSeconds);
  });

  return worker;
}

function lockKey(data: FlightRefreshJobData) {
  return `flight-refresh:lock:${data.tripId}:${data.itemId}`;
}

async function acquireLock(key: string) {
  const redis = await getRedisConnection();
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const result = await redis.set(key, token, "PX", lockTtlMs, "NX");
  return result === "OK" ? token : null;
}

async function releaseLock(key: string, token: string) {
  const redis = await getRedisConnection();
  const current = await redis.get(key);

  if (current === token) {
    await redis.del(key);
  }
}

async function refreshFlightTruth(
  data: FlightRefreshJobData
): Promise<FlightRefreshResult> {
  return refreshSingleFlightTruth(data);
}

async function loadBullMq(): Promise<{ Worker: WorkerConstructor }> {
  try {
    const importer = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{ Worker: WorkerConstructor }>;

    return await importer("bullmq");
  } catch {
    throw new Error("Install bullmq before starting the flight refresh worker.");
  }
}
