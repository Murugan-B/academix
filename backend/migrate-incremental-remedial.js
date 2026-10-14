require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runIncrementalRemedialMigration() {
  const client = await pool.connect();
  try {
    console.log('=== Starting Incremental Remedial Plan Architecture Migration ===');
    await client.query('BEGIN');

    // 1. Ensure uuid extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 2. Enhance cohort_remedial_plans with versioning and staleness tracking
    console.log('Enhancing cohort_remedial_plans table...');
    await client.query(`
      ALTER TABLE cohort_remedial_plans 
      ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS last_incremental_update_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    // 3. Remedial Plan Items table (stores decomposed plan sections with individual versioning)
    console.log('Creating remedial_plan_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS remedial_plan_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        plan_id UUID NOT NULL REFERENCES cohort_remedial_plans(id) ON DELETE CASCADE,
        item_key VARCHAR(100) NOT NULL,
        title VARCHAR(255),
        content JSONB NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'STALE', 'RECOMPUTING', 'FAILED')),
        last_error TEXT,
        last_recomputed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_plan_item UNIQUE (plan_id, item_key)
      );

      CREATE INDEX IF NOT EXISTS idx_remedial_items_plan_id ON remedial_plan_items(plan_id);
      CREATE INDEX IF NOT EXISTS idx_remedial_items_status ON remedial_plan_items(status);
      CREATE INDEX IF NOT EXISTS idx_remedial_items_key ON remedial_plan_items(item_key);
    `);

    // 4. Remedial Item Dependencies table
    console.log('Creating remedial_item_dependencies table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS remedial_item_dependencies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id UUID NOT NULL REFERENCES remedial_plan_items(id) ON DELETE CASCADE,
        dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN (
          'ASSESSMENT_EVIDENCE',
          'ROOT_CONCEPT',
          'PREREQUISITE_PATH',
          'SOURCE_MATERIAL',
          'AUTHORIZATION_SCOPE'
        )),
        target_id VARCHAR(255) NOT NULL,
        expected_state JSONB NOT NULL,
        is_valid BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_item_dep UNIQUE (item_id, dependency_type, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_remedial_deps_item_id ON remedial_item_dependencies(item_id);
      CREATE INDEX IF NOT EXISTS idx_remedial_deps_type_target ON remedial_item_dependencies(dependency_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_remedial_deps_valid ON remedial_item_dependencies(is_valid);
    `);

    // 5. Remedial Plan Audit History table
    console.log('Creating remedial_plan_audit_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS remedial_plan_audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        plan_id UUID NOT NULL REFERENCES cohort_remedial_plans(id) ON DELETE CASCADE,
        trigger_type VARCHAR(100) NOT NULL CHECK (trigger_type IN (
          'ASSESSMENT_UPDATE',
          'PREREQUISITE_GRAPH_CHANGE',
          'MATERIAL_REPLACED',
          'PERMISSION_REVOKED',
          'MANUAL_TRIGGER',
          'INITIAL_GENERATION'
        )),
        trigger_details JSONB DEFAULT '{}'::jsonb,
        affected_item_keys TEXT[] DEFAULT '{}'::text[],
        old_version_summary JSONB DEFAULT '{}'::jsonb,
        new_version_summary JSONB DEFAULT '{}'::jsonb,
        outcome VARCHAR(50) NOT NULL CHECK (outcome IN ('SUCCESS', 'FAILED', 'NO_OP')),
        latency_ms INTEGER DEFAULT 0,
        ai_calls_made INTEGER DEFAULT 0,
        error_message TEXT,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_remedial_audit_plan ON remedial_plan_audit_log(plan_id);
      CREATE INDEX IF NOT EXISTS idx_remedial_audit_trigger ON remedial_plan_audit_log(trigger_type);
      CREATE INDEX IF NOT EXISTS idx_remedial_audit_created ON remedial_plan_audit_log(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('=== Incremental Remedial Plan Architecture Migration Succeeded! ===');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runIncrementalRemedialMigration();
