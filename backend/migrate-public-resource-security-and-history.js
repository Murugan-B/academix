const db = require('./db');

async function migratePublicResourceSecurityAndHistory() {
  console.log('Starting Public Resource Security & Search History migration...');

  try {
    // 1. Add is_public column to student_resources table (Default FALSE - strictly private)
    await db.query(`
      ALTER TABLE student_resources 
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_student_resources_is_public ON student_resources(is_public);
      CREATE INDEX IF NOT EXISTS idx_student_resources_public_status ON student_resources(is_public, status);
    `);
    console.log('✓ Added is_public column and indexes to student_resources.');

    // 2. Add is_public column to materials table (Default FALSE - strictly private)
    await db.query(`
      ALTER TABLE materials 
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_materials_is_public ON materials(is_public);
    `);
    console.log('✓ Added is_public column and indexes to materials.');

    // 3. Create search_history table for persistent user web/image/public searches
    await db.query(`
      CREATE TABLE IF NOT EXISTS search_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        query TEXT NOT NULL,
        search_mode VARCHAR(50) NOT NULL DEFAULT 'web',
        result_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_search_history_user_created ON search_history(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_search_history_user_mode ON search_history(user_id, search_mode);
    `);
    console.log('✓ Created search_history table with user-scoped performance indexes.');

    // 4. Update ai_conversations to support conversation_type ('PUBLIC_AI_SEARCH' vs 'ASSISTANT')
    await db.query(`
      ALTER TABLE ai_conversations 
      ADD COLUMN IF NOT EXISTS conversation_type VARCHAR(50) DEFAULT 'ASSISTANT';

      CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_type ON ai_conversations(user_id, conversation_type);
    `);
    console.log('✓ Added conversation_type column and index to ai_conversations.');

    console.log('Public Resource Security & Search History migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message, err.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migratePublicResourceSecurityAndHistory();
