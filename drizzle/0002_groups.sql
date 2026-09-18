ALTER TABLE messages ADD COLUMN conversation_id INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, created_by INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS conversation_members (conversation_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY(conversation_id,user_id));
INSERT OR IGNORE INTO conversations(id,name,type,created_by,created_at) VALUES(1,'Main School Chat','main',0,0);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id,id);
