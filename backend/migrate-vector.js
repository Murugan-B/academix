const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Enable pgvector
    console.log('Enabling vector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // Create material_chunks table for RAG embeddings
    console.log('Creating material_chunks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS material_chunks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding vector(768),
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(material_id, chunk_index)
      )
    `);
    
    console.log('Creating vector index...');
    // Create HNSW index for fast similarity search
    await client.query(`
      CREATE INDEX IF NOT EXISTS material_chunks_embedding_idx 
      ON material_chunks USING hnsw (embedding vector_cosine_ops)
    `);

    await client.query('COMMIT');
    console.log('Vector Database migration successful!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
