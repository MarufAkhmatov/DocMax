import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentRelationsController } from './document-relations.controller';
import { DocumentRelationsService } from './document-relations.service';

@Module({
  imports: [DocumentsModule],
  controllers: [DocumentRelationsController],
  providers: [DocumentRelationsService],
})
export class DocumentRelationsModule {}
