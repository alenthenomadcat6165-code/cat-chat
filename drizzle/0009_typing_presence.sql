CREATE TABLE IF NOT EXISTS typing_presence (conversation_id INTEGER NOT NULL, user_id INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(conversation_id,user_id));
CREATE INDEX IF NOT EXISTS idx_typing_presence_chat ON typing_presence(conversation_id,updated_at);
