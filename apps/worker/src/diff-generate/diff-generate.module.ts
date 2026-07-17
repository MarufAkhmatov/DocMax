import { Module } from '@nestjs/common';
import { DiffGenerateService } from './diff-generate.service';

@Module({
  providers: [DiffGenerateService],
  exports: [DiffGenerateService],
})
export class DiffGenerateModule {}
