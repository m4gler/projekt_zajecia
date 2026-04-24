export type JobStage =
  | "queued"
  | "validating"
  | "saving_file"
  | "processing"
  | "preparing_cad_pipeline"
  | "ai_analysis"
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
      assemblySteps?: any[];
      groupedParts?: any[];
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
      assemblySteps?: undefined;
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
