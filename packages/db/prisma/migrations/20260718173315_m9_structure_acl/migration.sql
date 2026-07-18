-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "acl_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "org_structure_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "reason" TEXT NOT NULL,
    "org_unit_id" UUID,
    "triggered_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_structure_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_structure_snapshots_org_id_created_at_idx" ON "org_structure_snapshots"("org_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_folder_id_subject_type_subject_id_key" ON "permissions"("folder_id", "subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "org_structure_snapshots" ADD CONSTRAINT "org_structure_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_structure_snapshots" ADD CONSTRAINT "org_structure_snapshots_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
