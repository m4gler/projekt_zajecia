import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  Res,
  Sse,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StepService } from './step.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as fs from 'fs';

@Controller('api/step')
export class StepController {
  constructor(private readonly stepService: StepService) {
    // Ensure uploads directory exists
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
      },
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ext === '.step' || ext === '.stp') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Dozwolone są tylko pliki z rozszerzeniem .step lub .stp.'), false);
        }
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Brak pliku w polu `file`.');
    }

    const jobId = this.stepService.createJob(file.originalname);
    
    // Start processing in background
    setTimeout(() => {
      this.stepService.processStepFile(jobId, file.path, file.originalname);
    }, 100);

    return {
      ok: true,
      jobId,
      fileName: file.originalname,
      fileSizeBytes: file.size,
      note: 'Upload zakończony. Nasłuchuj na SSE aby uzyskać progres i geometrię.',
    };
  }

  @Sse('progress/:jobId/stream')
  progressStream(@Param('jobId') jobId: string): Observable<MessageEvent> {
    const stream = this.stepService.getJobStream(jobId);
    if (!stream) {
      throw new BadRequestException('Nie znaleziono zadania');
    }
    
    return stream.pipe(
      map((jobRecord) => {
        return {
          data: jobRecord,
        } as MessageEvent;
      }),
    );
  }
}
