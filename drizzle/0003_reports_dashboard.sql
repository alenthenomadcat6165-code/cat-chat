ALTER TABLE reports ADD COLUMN details TEXT NOT NULL DEFAULT '';
ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
