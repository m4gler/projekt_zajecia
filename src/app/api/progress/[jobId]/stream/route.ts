import { getProgressEvent, subscribeToJob } from "@/lib/job-store";

export const runtime = "nodejs";

function serializeSseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  const initial = getProgressEvent(jobId);

  if (!initial) {
    return new Response("Job not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(serializeSseEvent(initial)));

      unsubscribe = subscribeToJob(jobId, (event) => {
        controller.enqueue(encoder.encode(serializeSseEvent(event)));
      });

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
      }

      unsubscribe();

      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
