const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('--- Running AI Learning Migration ---');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_learning_cache (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic_tag VARCHAR(255) NOT NULL,
        material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
        content JSONB NOT NULL,
        provider VARCHAR(50) DEFAULT 'gemini',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_student_topic_material UNIQUE (student_id, topic_tag, material_id)
      );
    `);
    console.log('✓ Created ai_learning_cache table');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_learning_cache_student_topic ON ai_learning_cache(student_id, topic_tag);
    `);
    console.log('✓ Created index on ai_learning_cache');

    console.log('AI Learning migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
