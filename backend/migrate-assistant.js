const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Enabling uuid-ossp and vector extensions if needed...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    console.log('Creating ai_conversations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
        selected_provider VARCHAR(50) DEFAULT 'local',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating indexes for ai_conversations...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated_at ON ai_conversations(updated_at DESC);
    `);

    console.log('Creating ai_messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant')),
        content TEXT NOT NULL,
        provider VARCHAR(50) DEFAULT 'local',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating index for ai_messages...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at ASC);
    `);

    console.log('Creating ai_chat_attachments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_chat_attachments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        message_id UUID REFERENCES ai_messages(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size INTEGER NOT NULL,
        file_url TEXT NOT NULL,
        extracted_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating index for ai_chat_attachments...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_chat_attachments_conversation_id ON ai_chat_attachments(conversation_id);
    `);

    console.log('Creating temporary_ai_material_chunks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS temporary_ai_material_chunks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        attachment_id UUID NOT NULL REFERENCES ai_chat_attachments(id) ON DELETE CASCADE,
        conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding vector(768),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(attachment_id, chunk_index)
      )
    `);

    console.log('Creating index for temporary_ai_material_chunks...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_temp_chunks_conversation_id ON temporary_ai_material_chunks(conversation_id);
    `);

    await client.query('COMMIT');
    console.log('AI Assistant database migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
