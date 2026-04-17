import { randomUUID } from "crypto";

import type { JobStage, ProgressEvent } from "@/lib/types";

type JobRecord = {
  jobId: string;
  fileName: string;
  percent: number;
  stage: JobStage;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type JobListener = (event: ProgressEvent) => void;

const store = globalThis as typeof globalThis & {
  __cadJobs?: Map<string, JobRecord>;
  __cadListeners?: Map<string, Set<JobListener>>;
};

const jobs = store.__cadJobs ?? new Map<string, JobRecord>();
const listeners = store.__cadListeners ?? new Map<string, Set<JobListener>>();

store.__cadJobs = jobs;
store.__cadListeners = listeners;

function toProgressEvent(job: JobRecord): ProgressEvent {
  if (job.stage === "failed") {
    return {
      type: "progress",
      jobId: job.jobId,
      percent: job.percent,
      stage: job.stage,
      message: job.message,
      fileName: job.fileName,
      error: job.error ?? "Nieznany błąd przetwarzania.",
      updatedAt: job.updatedAt,
    };
  }

  return {
    type: "progress",
    jobId: job.jobId,
    percent: job.percent,
    stage: job.stage,
    message: job.message,
    fileName: job.fileName,
    updatedAt: job.updatedAt,
  };
}

function emit(jobId: string) {
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  const subscribers = listeners.get(jobId);

  if (!subscribers) {
    return;
  }

  const event = toProgressEvent(job);

  for (const listener of subscribers) {
    listener(event);
  }
}

export function createJob(fileName: string) {
  const jobId = randomUUID();
  const now = new Date().toISOString();

  jobs.set(jobId, {
    jobId,
    fileName,
    percent: 0,
    stage: "queued",
    message: "Zadanie oczekuje na walidację pliku STEP/STP.",
    createdAt: now,
    updatedAt: now,
  });

  return jobId;
}

export function getJob(jobId: string) {
  return jobs.get(jobId);
}

export function getProgressEvent(jobId: string) {
  const job = jobs.get(jobId);

  return job ? toProgressEvent(job) : null;
}

export function updateJob(
  jobId: string,
  patch: Partial<Pick<JobRecord, "percent" | "stage" | "message" | "error">>,
) {
  const existing = jobs.get(jobId);

  if (!existing) {
    return null;
  }

  const next: JobRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  jobs.set(jobId, next);
  emit(jobId);

  return next;
}

export function failJob(jobId: string, error: string) {
  return updateJob(jobId, {
    percent: 100,
    stage: "failed",
    message: "Przetwarzanie przerwane.",
    error,
  });
}

export function subscribeToJob(jobId: string, listener: JobListener) {
  const bucket = listeners.get(jobId) ?? new Set<JobListener>();
  bucket.add(listener);
  listeners.set(jobId, bucket);

  return () => {
    const current = listeners.get(jobId);

    if (!current) {
      return;
    }

    current.delete(listener);

    if (current.size === 0) {
      listeners.delete(jobId);
    }
  };
}

export async function simulateInitialPipeline(jobId: string) {
  const steps: Array<{
    delayMs: number;
    percent: number;
    stage: JobStage;
    message: string;
  }> = [
    {
      delayMs: 500,
      percent: 45,
      stage: "saving_file",
      message: "Plik zapisany. Backend domyka inicjalizację joba.",
    },
    {
      delayMs: 700,
      percent: 70,
      stage: "preparing_cad_pipeline",
      message: "Przygotowanie joba pod przyszłą triangulację CadQuery/OpenCASCADE.",
    },
    {
      delayMs: 500,
      percent: 100,
      stage: "completed",
      message: "Upload zakończony. Backend jest gotowy na kolejny etap: triangulację STEP.",
    },
  ];

  for (const step of steps) {
    await new Promise((resolve) => {
      setTimeout(resolve, step.delayMs);
    });
    updateJob(jobId, step);
  }
}
