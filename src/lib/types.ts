export type JobStage =
  | "queued"
  | "validating"
  | "saving_file"
  | "preparing_cad_pipeline"
  | "completed"
  | "failed";

export type ProgressEvent =
  | {
      type: "progress";
      jobId: string;
      percent: number;
      stage: JobStage;
      message: string;
      fileName?: string;
      error?: undefined;
      updatedAt: string;
      geometry?: {
        vertices: number[];
        normals: number[];
        indices: number[];
      };
    }
  | {
      type: "progress";
      jobId: string;
      percent: number;
      stage: "failed";
      message: string;
      fileName?: string;
      error: string;
      updatedAt: string;
      geometry?: undefined;
    };

export type UploadApiResponse =
  | {
      ok: true;
      jobId: string;
      fileName: string;
      fileSizeBytes: number;
      uploadPath: string;
      geometry: {
        vertices: number[];
        normals: number[];
        indices: number[];
      };
      parts: Array<{
        id: string;
        label: string;
        classification: "unknown";
      }>;
      note: string;
    }
  | {
      ok: false;
      error: string;
    };
