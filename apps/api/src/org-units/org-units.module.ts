import { Module } from '@nestjs/common';
import { FoldersModule } from '../folders/folders.module';
import { OrgUnitsController } from './org-units.controller';
import { OrgUnitsService } from './org-units.service';
import { OrgStructureSnapshotsService } from './org-structure-snapshots.service';

@Module({
  imports: [FoldersModule],
  controllers: [OrgUnitsController],
  providers: [OrgUnitsService, OrgStructureSnapshotsService],
})
export class OrgUnitsModule {}
