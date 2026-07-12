import { Module } from '@nestjs/common';
import { DocumentRelationsController } from './document-relations.controller';
import { DocumentRelationsService } from './document-relations.service';

@Module({
  controllers: [DocumentRelationsController],
  providers: [DocumentRelationsService],
})
export class DocumentRelationsModule {}
