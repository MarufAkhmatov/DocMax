import { Module } from '@nestjs/common';
import { FileIndexService } from './file-index.service';

@Module({
  providers: [FileIndexService],
  exports: [FileIndexService],
})
export class FileIndexModule {}
