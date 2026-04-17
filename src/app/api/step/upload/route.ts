import { NextResponse } from "next/server";

import {
  createJob,
  failJob,
  simulateInitialPipeline,
  updateJob,
} from "@/lib/job-store";
import {
  hasAcceptedStepExtension,
  MAX_STEP_FILE_SIZE_BYTES,
  persistUpload,
} from "@/lib/step-upload";
import type { UploadApiResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let jobId = "";

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json<UploadApiResponse>(
        {
          ok: false,
          error: "Brak pliku w polu `file`.",
        },
        { status: 400 },
      );
    }

    jobId = createJob(file.name);

    updateJob(jobId, {
      percent: 5,
      stage: "validating",
      message: "Sprawdzanie rozszerzenia i limitu 50 MB.",
    });

    if (!hasAcceptedStepExtension(file.name)) {
      failJob(jobId, "Dozwolone są tylko pliki z rozszerzeniem .step lub .stp.");

      return NextResponse.json<UploadApiResponse>(
        {
          ok: false,
          error: "Dozwolone są tylko pliki z rozszerzeniem .step lub .stp.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_STEP_FILE_SIZE_BYTES) {
      failJob(jobId, "Plik przekracza limit 50 MB.");

      return NextResponse.json<UploadApiResponse>(
        {
          ok: false,
          error: "Plik przekracza limit 50 MB.",
        },
        { status: 413 },
      );
    }

    updateJob(jobId, {
      percent: 20,
      stage: "saving_file",
      message: "Walidacja zakończona, trwa zapis pliku na dysku.",
    });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = await persistUpload(file.name, bytes);

    void simulateInitialPipeline(jobId);

    return NextResponse.json<UploadApiResponse>({
      ok: true,
      jobId,
      fileName: file.name,
      fileSizeBytes: file.size,
      uploadPath: upload.relativePath,
      geometry: {
        vertices: [],
        normals: [],
        indices: [],
      },
      parts: [],
      note: "To jest pierwszy etap: upload, kolejka i stream postępu są gotowe. Triangulacja STEP zostanie dodana w następnym kroku.",
    });
  } catch (error) {
    if (jobId) {
      failJob(
        jobId,
        error instanceof Error ? error.message : "Nie udało się przetworzyć uploadu.",
      );
    }

    return NextResponse.json<UploadApiResponse>(
      {
        ok: false,
        error: "Upload nie powiódł się.",
      },
      { status: 500 },
    );
  }
}
