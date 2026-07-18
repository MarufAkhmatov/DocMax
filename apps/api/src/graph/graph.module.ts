import { Module } from '@nestjs/common';
import { FoldersModule } from '../folders/folders.module';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';

@Module({
  imports: [FoldersModule],
  controllers: [GraphController],
  providers: [GraphService],
})
export class GraphModule {}
