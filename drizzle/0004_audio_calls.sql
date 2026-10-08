CREATE TABLE IF NOT EXISTS call_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, started_by INTEGER NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER);
CREATE TABLE IF NOT EXISTS call_participants (call_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, left_at INTEGER, PRIMARY KEY(call_id,user_id));
CREATE TABLE IF NOT EXISTS call_signals (id INTEGER PRIMARY KEY AUTOINCREMENT, call_id INTEGER NOT NULL, from_user_id INTEGER NOT NULL, to_user_id INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_call_sessions_room ON call_sessions(conversation_id,ended_at);
CREATE INDEX IF NOT EXISTS idx_call_signals_target ON call_signals(call_id,to_user_id,id);
