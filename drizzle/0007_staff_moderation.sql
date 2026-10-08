ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN suspended_until INTEGER;
ALTER TABLE users ADD COLUMN warnings_count INTEGER NOT NULL DEFAULT 0;
UPDATE users SET account_status='banned' WHERE banned=1;
UPDATE users SET role='founder' WHERE role='creator';
CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, issued_by INTEGER NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL, acknowledged_at INTEGER);
CREATE TABLE IF NOT EXISTS moderation_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER NOT NULL, target_id INTEGER NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id,acknowledged_at,created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target ON moderation_actions(target_id,created_at);
