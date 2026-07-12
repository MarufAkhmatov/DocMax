-- ============================================================================
-- pgvector HNSW indeks — Prisma'ning @@index turlari (BTree/Hash/Gist/Gin/SpGist/Brin)
-- orasida yo'q, shuning uchun bu YAGONA indeks har doim qo'lda SQL orqali qo'shiladi
-- (schema.prisma bosh izohiga qarang — bu migratsiyalar orasidagi yagona doimiy istisno).
-- ============================================================================
CREATE INDEX embeddings_vector_hnsw_idx ON embeddings USING hnsw (vector vector_cosine_ops);

-- ============================================================================
-- Runtime "app" roli — jadval egasi emas (migratsiyalarni "docmax" bajaradi).
-- Postgres'da jadval EGASIGA REVOKE ta'sir qilmaydi, shuning uchun audit_logs
-- append-only qoidasini (CLAUDE.md 3-qoida) haqiqatan DB darajasida majburlash
-- uchun alohida, egasi bo'lmagan rol kerak. API/worker runtime'da shu rol orqali
-- ulanadi (packages/db/src/tenant-client.ts — APP_DATABASE_URL).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'docmax_app') THEN
    CREATE ROLE docmax_app LOGIN PASSWORD 'docmax_app';
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO docmax_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO docmax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO docmax_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO docmax_app;

-- Kelgusi migratsiyalarda yaratiladigan jadvallar uchun ham avtomatik amal qiladi
-- (migratsiyalarni har doim "docmax" egasi bajaradi).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO docmax_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO docmax_app;

-- audit_logs: append-only (CLAUDE.md 3-qoida, TZ-0 §3) — faqat SELECT + INSERT.
REVOKE UPDATE, DELETE ON audit_logs FROM docmax_app;
