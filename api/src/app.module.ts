import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StepModule } from './step/step.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    StepModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
