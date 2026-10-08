ALTER TABLE messages ADD COLUMN edited_at INTEGER;
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id,id);
