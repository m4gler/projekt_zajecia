"use client";

import { useEffect, useRef, useState } from "react";

import type { ProgressEvent, UploadApiResponse } from "@/lib/types";

type UploadState = "idle" | "uploading" | "streaming" | "done" | "error";

const stageLabels: Record<string, string> = {
  idle: "Gotowe do startu",
  queued: "W kolejce",
  validating: "Walidacja pliku",
  saving_file: "Zapis pliku",
  preparing_cad_pipeline: "Przygotowanie modelu",
  completed: "Zakończono",
  failed: "Błąd",
};

const statusLabels: Record<UploadState, string> = {
  idle: "Oczekiwanie",
  uploading: "Wysyłanie",
  streaming: "Przetwarzanie",
  done: "Gotowe",
  error: "Błąd",
};

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function UploadDashboard() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const source = new EventSource(`/api/progress/${jobId}/stream`);
    eventSourceRef.current = source;
    setStatus((current) => (current === "done" ? current : "streaming"));

    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as ProgressEvent;

      setProgress(payload);

      if (payload.stage === "completed") {
        setStatus("done");
        source.close();
        eventSourceRef.current = null;
      }

      if (payload.stage === "failed") {
        setStatus("error");
        setError(payload.error ?? payload.message);
        source.close();
        eventSourceRef.current = null;
      }
    };

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [jobId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Najpierw wybierz plik STEP lub STP.");
      return;
    }

    setStatus("uploading");
    setError(null);
    setProgress(null);
    setJobId(null);
    eventSourceRef.current?.close();

    const formData = new FormData();
    formData.append("file", selectedFile);

    const response = await fetch("/api/step/upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as UploadApiResponse;

    if (!response.ok || !payload.ok) {
      setStatus("error");
      setError(payload.ok ? "Upload nie powiódł się." : payload.error);
      return;
    }

    setJobId(payload.jobId);
  }

  return (
    <div className="grid min-h-screen place-items-center p-6 lg:p-8">
      <div className="grid-surface w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/70 bg-white/80 shadow-panel backdrop-blur">
        <div className="grid gap-10 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
          <section className="space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                CAD Assembly Studio
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Prześlij model mebla i uruchom analizę pliku STEP.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  Jedno miejsce do obsługi modeli CAD, kontroli przebiegu przetwarzania i
                  przygotowania materiałów pod instrukcję montażu.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Format</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">STEP / STP</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Standardowe pliki CAD dla modeli meblowych.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Limit</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Do 50 MB</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Wygodny upload bez dodatkowych kroków po stronie użytkownika.
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">Na żywo</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Pasek postępu i aktualny etap pracy bez odświeżania strony.
                </p>
              </div>
            </div>

            <form
              className="space-y-6 rounded-[30px] border border-slate-200 bg-slate-50/90 p-6"
              onSubmit={handleSubmit}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Przesyłanie pliku
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">
                    Wybierz model do analizy
                  </div>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {statusLabels[status]}
                </div>
              </div>

              <label
                className="flex cursor-pointer flex-col gap-3 rounded-[24px] border border-dashed border-slate-300 bg-white p-6 transition hover:border-teal-600 hover:bg-teal-50/40"
                htmlFor="step-file"
              >
                <span className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
                  Plik źródłowy
                </span>
                <span className="text-2xl font-semibold text-slate-900">
                  {selectedFile ? selectedFile.name : "Kliknij, aby wybrać plik STEP lub STP"}
                </span>
                <span className="text-sm leading-6 text-slate-600">
                  Najlepiej użyć modelu pojedynczego mebla lub jednego kompletnego złożenia.
                </span>
              </label>

              <input
                accept=".step,.stp"
                className="hidden"
                id="step-file"
                name="file"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setError(null);
                }}
                type="file"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Nazwa pliku</div>
                  <div className="mt-2 truncate text-sm font-semibold text-slate-900">
                    {selectedFile ? selectedFile.name : "Nie wybrano"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Rozmiar</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedFile ? formatBytes(selectedFile.size) : "0 B"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Typ</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">Model CAD</div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-slate-600">
                  Po wysłaniu pliku status będzie aktualizowany automatycznie w panelu po prawej.
                </p>
                <button
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={!selectedFile || status === "uploading" || status === "streaming"}
                  type="submit"
                >
                  {status === "uploading" || status === "streaming"
                    ? "Trwa przetwarzanie"
                    : "Rozpocznij analizę"}
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-5 rounded-[30px] bg-slate-950 p-6 text-white">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Sesja przetwarzania
              </div>
              <div className="text-2xl font-semibold text-white">Panel statusu</div>
              <p className="text-sm leading-6 text-slate-400">
                Aktualny przebieg operacji dla ostatnio wysłanego pliku.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Identyfikator</div>
              <div className="font-[family-name:var(--font-mono)] text-sm text-slate-200">
                {jobId ?? "Jeszcze nie utworzono"}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Postęp</span>
                <span>{progress?.percent ?? 0}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Stan</div>
                <div className="mt-2 text-xl font-semibold text-white">{statusLabels[status]}</div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Etap</div>
                <div className="mt-2 text-xl font-semibold text-white">
                  {stageLabels[progress?.stage ?? "idle"] ?? progress?.stage ?? "Gotowe do startu"}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Komunikat</div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {error ?? progress?.message ?? "Wybierz plik i uruchom analizę modelu."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Wybrany plik</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {selectedFile ? selectedFile.name : "Brak aktywnego pliku"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {selectedFile
                  ? `Rozmiar: ${formatBytes(selectedFile.size)}`
                  : "Po wyborze pliku zobaczysz tu jego podstawowe informacje."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(15,118,110,0.14))] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Aktualny etap</div>
              <div className="mt-2 text-xl font-semibold text-white">
                {progress ? `${progress.percent}%` : "0%"}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Proces aktualizuje się automatycznie podczas przetwarzania modelu.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
