-- This is an empty migration.
-- Enable UUID generator (Postgres)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

UPDATE "role_requests"
SET "id" = gen_random_uuid()
WHERE "id" IS NULL;
