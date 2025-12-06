import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run SQL migrations from the migrations folder
 * This runs all .sql files in order on app startup
 */
export async function runSQLMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('🔄 Checking for SQL migrations...');

    // Get migrations folder path
    const migrationsPath = join(__dirname, '../migrations');

    // Read all .sql files
    const files = readdirSync(migrationsPath)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Run in alphabetical order (001_, 002_, etc.)

    if (files.length === 0) {
      console.log('   No SQL migrations found');
      return;
    }

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _sql_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Check which migrations have already run
    const executedResult = await client.query(
      'SELECT filename FROM _sql_migrations'
    );
    const executedMigrations = new Set(executedResult.rows.map(r => r.filename));

    let ranCount = 0;

    // Run each migration that hasn't been executed
    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`   ✓ ${file} (already executed)`);
        continue;
      }

      console.log(`   ▶ Running ${file}...`);

      try {
        const migrationSQL = readFileSync(join(migrationsPath, file), 'utf-8');

        // Run migration in a transaction
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query(
          'INSERT INTO _sql_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');

        console.log(`   ✅ ${file} completed`);
        ranCount++;
      } catch (error: any) {
        await client.query('ROLLBACK');

        // If error is about column already existing, that's OK - mark as executed anyway
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  ${file} - columns already exist, marking as executed`);
          await client.query(
            'INSERT INTO _sql_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
          ranCount++;
        } else {
          throw error;
        }
      }
    }

    if (ranCount > 0) {
      console.log(`✅ Ran ${ranCount} SQL migration(s)`);
    } else {
      console.log('✅ All SQL migrations up to date');
    }

  } catch (error: any) {
    console.error('❌ SQL migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}
