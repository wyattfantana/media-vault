import 'dotenv/config';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔌 Connected to database');
    console.log(`📍 Database: ${process.env.POSTGRES_DB}@${process.env.POSTGRES_HOST}`);
    console.log('');

    // Read migration file
    const migrationPath = join(__dirname, '../migrations/006_add_jellyfin_formatting_columns.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Running migration: 006_add_jellyfin_formatting_columns.sql');
    console.log('');

    // Run migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Added columns to downloads table:');
    console.log('  - formatted_path (TEXT)');
    console.log('  - jellyfin_format (JSONB)');
    console.log('  - category (TEXT)');
    console.log('  - custom_folder (TEXT)');
    console.log('  - organize_by_uploader (BOOLEAN)');
    console.log('');

    // Verify columns exist
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'downloads'
      AND column_name IN ('formatted_path', 'jellyfin_format', 'category', 'custom_folder', 'organize_by_uploader')
      ORDER BY column_name;
    `);

    if (result.rows.length === 5) {
      console.log('✅ Verification passed - all columns present:');
      result.rows.forEach(row => {
        console.log(`  ✓ ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.warn(`⚠️  Warning: Expected 5 columns, found ${result.rows.length}`);
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.message.includes('already exists')) {
      console.log('');
      console.log('ℹ️  Columns may already exist. This is OK if re-running the migration.');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
