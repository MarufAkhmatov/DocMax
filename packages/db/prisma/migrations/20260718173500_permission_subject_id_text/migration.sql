-- AlterTable
-- permissions.subject_id ROLE (enum qiymati, masalan "EDITOR") yoki USER/ORG_UNIT (uuid) bo'lishi
-- mumkin — jadval hali bo'sh bo'lgani uchun to'g'ridan-to'g'ri text'ga o'tkazish xavfsiz.
ALTER TABLE "permissions" ALTER COLUMN "subject_id" TYPE TEXT;
