CREATE TABLE uploaded_assets (id text PRIMARY KEY DEFAULT gen_random_uuid()::text, mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')), bytes bytea NOT NULL, uploaded_by text NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now(), CHECK(octet_length(bytes)<=2097152));
ALTER TABLE notifications ADD COLUMN recipient_email text;
