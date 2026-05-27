export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: string, payload: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
        );
      }

      async function sendMetrics() {
        try {
          const { getFlightRefreshHealth } = await import("@/workers/monitor.worker");
          const health = await getFlightRefreshHealth();
          const timestamp = new Date().toISOString();

          send("metrics", {
            type: "metrics",
            timestamp,
            health: {
              status: health.healthy ? "healthy" : "degraded",
              service: "flight-refresh-monitor",
              queue: health,
              timestamp
            }
          });
        } catch (error) {
          send("stream-error", {
            type: "error",
            message: error instanceof Error ? error.message : "Could not stream metrics"
          });
        }
      }

      send("connected", {
        type: "connected",
        ok: true,
        timestamp: new Date().toISOString()
      });

      void sendMetrics();
      const timer = setInterval(sendMetrics, 5_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    }
  });
}
