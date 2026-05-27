type RedisConnection = {
  set: (...args: unknown[]) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<unknown>;
  hset: (...args: unknown[]) => Promise<unknown>;
  pexpire: (key: string, milliseconds: number) => Promise<unknown>;
};

let connection: RedisConnection | null = null;

export async function getRedisConnection() {
  if (connection) return connection;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  const { default: IORedis } = await loadIoredis();
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true
  }) as RedisConnection;

  return connection;
}

async function loadIoredis(): Promise<{ default: new (...args: unknown[]) => unknown }> {
  try {
    const importer = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{ default: new (...args: unknown[]) => unknown }>;

    return await importer("ioredis");
  } catch {
    throw new Error("Install ioredis before using the Redis flight refresh worker.");
  }
}
