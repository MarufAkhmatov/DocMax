/*
  Warnings:

  - You are about to drop the column `doc_type` on the `documents` table. All the data in the column will be lost.
  - Added the required column `doc_type_id` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "documents_org_id_doc_type_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "doc_type",
ADD COLUMN     "doc_type_id" UUID NOT NULL;

-- DropEnum
DROP TYPE "DocType";

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_types_org_id_name_key" ON "document_types"("org_id", "name");

-- CreateIndex
CREATE INDEX "documents_org_id_doc_type_id_idx" ON "documents"("org_id", "doc_type_id");

-- AddForeignKey
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_doc_type_id_fkey" FOREIGN KEY ("doc_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
