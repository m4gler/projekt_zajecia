import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Subject, Observable } from 'rxjs';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

export interface JobRecord {
  jobId: string;
  fileName: string;
  percent: number;
  stage: string;
  message: string;
  error?: string;
  geometry?: any;
  parts?: any[];
  groupedParts?: any[];
  assemblySteps?: any[];
}

@Injectable()
export class StepService {
  private readonly logger = new Logger(StepService.name);
  private jobs = new Map<string, JobRecord>();
  private jobSubjects = new Map<string, Subject<JobRecord>>();
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    let apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    if (apiKey) {
      apiKey = apiKey.trim();
      this.logger.log(`Loading OpenRouter API Key...`);
      this.openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: apiKey,
        defaultHeaders: {
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "CAD Assembly Studio",
        }
      });
    } else {
      this.logger.warn('OPENROUTER_API_KEY NOT FOUND IN CONFIG');
    }
  }

  createJob(fileName: string): string {
    const jobId = uuidv4();
    const job: JobRecord = {
      jobId,
      fileName,
      percent: 0,
      stage: 'queued',
      message: 'Zadanie oczekuje na walidację',
    };
    this.jobs.set(jobId, job);
    this.jobSubjects.set(jobId, new Subject<JobRecord>());
    return jobId;
  }

  getJob(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  getJobStream(jobId: string): Observable<JobRecord> | undefined {
    return this.jobSubjects.get(jobId)?.asObservable();
  }

  updateJob(jobId: string, patch: Partial<JobRecord>) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, patch);
      this.jobSubjects.get(jobId)?.next(job);
    }
  }

  async processStepFile(jobId: string, filePath: string, originalName: string) {
    this.updateJob(jobId, {
      percent: 10,
      stage: 'processing',
      message: 'Rozpoczęto analizę geometrii 3D...',
    });

    try {
      const pythonScript = path.join(process.cwd(), 'python_worker', 'cad_processor.py');
      const pythonProcess = spawn('python', [pythonScript, filePath]);

      let outputData = '';
      let errorData = '';

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        this.logger.error(`Python Error: ${data}`);
      });

      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          this.updateJob(jobId, {
            percent: 100,
            stage: 'failed',
            message: 'Błąd przetwarzania pliku STEP',
            error: errorData || 'Unknown error from Python worker',
          });
          return;
        }

        try {
          const jsonStart = outputData.indexOf('{');
          const jsonEnd = outputData.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = outputData.substring(jsonStart, jsonEnd + 1);
            const result = JSON.parse(jsonStr);

            if (result.error) {
              this.updateJob(jobId, {
                percent: 100,
                stage: 'failed',
                message: 'Błąd z biblioteki CAD',
                error: result.error,
              });
            } else {
              this.updateJob(jobId, {
                percent: 70,
                stage: 'ai_analysis',
                message: 'Generowanie instrukcji montażu przez AI...',
                geometry: result.geometry,
                parts: result.parts,
                groupedParts: result.groupedParts,
              });

              // Run AI analysis
              try {
                const assemblySteps = await this.generateAssemblyInstructions(result.parts);
                this.updateJob(jobId, {
                  percent: 100,
                  stage: 'completed',
                  message: 'Przetwarzanie zakończone pomyślnie!',
                  assemblySteps,
                });
              } catch (aiErr) {
                 this.logger.error('AI Error:', aiErr);
                 this.updateJob(jobId, {
                  percent: 100,
                  stage: 'completed',
                  message: 'Przetwarzanie CAD zakończone pomyślnie (Błąd analizy AI).',
                  error: aiErr.message,
                });
              }
            }
          } else {
             this.updateJob(jobId, {
                percent: 100,
                stage: 'failed',
                message: 'Błąd odczytu danych',
                error: 'Invalid JSON from worker',
              });
          }
        } catch (err) {
          this.updateJob(jobId, {
            percent: 100,
            stage: 'failed',
            message: 'Błąd parsowania wyników',
            error: err.message,
          });
        }
      });
    } catch (err) {
      this.updateJob(jobId, {
        percent: 100,
        stage: 'failed',
        message: 'Błąd systemu',
        error: err.message,
      });
    }
  }

  async generateAssemblyInstructions(parts: any[]) {
    if (!this.openai) {
       this.logger.warn("No OPENROUTER_API_KEY found, returning mock instructions.");
       return this.getMockInstructions(parts);
    }

    const prompt = `
      Jesteś ekspertem ds. projektowania mebli IKEA.
      Przeanalizuj poniższą listę wyodrębnionych części mebla z pliku STEP i wygeneruj listę kroków montażowych.
      Zwróć wynik TYLKO w formacie JSON (tablica obiektów). 
      Format jednego obiektu kroku:
      {
        "stepNumber": 1,
        "title": "Krótki tytuł kroku",
        "description": "Opis co z czym połączyć",
        "partIndices": [0, 5],
        "partRoles": { "0": "panel boczny", "5": "konfirmat" },
        "contextPartIndices": []
      }

      Części:
      ${JSON.stringify(parts, null, 2)}
    `;

    try {
      // Używamy topowego darmowego modelu z OpenRouter
      const response = await this.openai.chat.completions.create({
        model: "google/gemini-2.0-flash-lite-preview-02-05:free",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from OpenRouter");

      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.steps && Array.isArray(parsed.steps)) return parsed.steps;
      if (parsed.instructions && Array.isArray(parsed.instructions)) return parsed.instructions;
      
      return [parsed];
    } catch (error) {
      this.logger.error("OpenRouter call failed", error);
      return this.getMockInstructions(parts);
    }
  }

  private getMockInstructions(parts: any[]) {
    const numParts = parts.length;
    return [
      {
        stepNumber: 1,
        title: "Inwentaryzacja",
        description: `Wykryto ${numParts} części mebla. Przygotuj wszystkie elementy według wykazu BOM widocznego powyżej.`,
        partIndices: parts.slice(0, Math.min(2, numParts)).map(p => p.id),
        partRoles: {}
      },
      {
        stepNumber: 2,
        title: "Złożenie podstawy",
        description: "Połącz główne panele nośne wykorzystując łączniki zidentyfikowane jako najmniejsze elementy.",
        partIndices: parts.slice(Math.min(2, numParts), Math.min(5, numParts)).map(p => p.id),
        partRoles: {}
      }
    ];
  }
}

