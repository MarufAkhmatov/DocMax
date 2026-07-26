import { Module } from '@nestjs/common';
import { FolderAccessService } from './folder-access.service';
import { FolderPermissionsService } from './folder-permissions.service';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService, FolderAccessService, FolderPermissionsService],
  exports: [FoldersService, FolderAccessService],
})
export class FoldersModule {}
