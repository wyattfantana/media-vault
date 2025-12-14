import 'dotenv/config';
import { Pool } from 'pg';
import { Kysely, PostgresDialect, sql } from 'kysely';

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const db = new Kysely({
  dialect: new PostgresDialect({ pool }),
});

async function migrate() {
  console.log('Creating Better Auth tables...');

  try {
    // Create users table
    await db.schema
      .createTable('user')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('email', 'text', (col) => col.notNull().unique())
      .addColumn('emailVerified', 'boolean', (col) => col.notNull().defaultTo(false))
      .addColumn('image', 'text')
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('updatedAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('twoFactorEnabled', 'boolean', (col) => col.defaultTo(false))
      .addColumn('role', 'text', (col) => col.defaultTo('user'))
      .addColumn('banned', 'boolean', (col) => col.defaultTo(false))
      .addColumn('banReason', 'text')
      .addColumn('banExpires', 'timestamp')
      .execute();
    console.log('✓ Created user table');

    // Create sessions table
    await db.schema
      .createTable('session')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('expiresAt', 'timestamp', (col) => col.notNull())
      .addColumn('token', 'text', (col) => col.notNull().unique())
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('updatedAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('ipAddress', 'text')
      .addColumn('userAgent', 'text')
      .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
      .execute();
    console.log('✓ Created session table');

    // Create accounts table (for OAuth)
    await db.schema
      .createTable('account')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('accountId', 'text', (col) => col.notNull())
      .addColumn('providerId', 'text', (col) => col.notNull())
      .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
      .addColumn('accessToken', 'text')
      .addColumn('refreshToken', 'text')
      .addColumn('idToken', 'text')
      .addColumn('accessTokenExpiresAt', 'timestamp')
      .addColumn('refreshTokenExpiresAt', 'timestamp')
      .addColumn('scope', 'text')
      .addColumn('password', 'text')
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('updatedAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .execute();
    console.log('✓ Created account table');

    // Create verification table
    await db.schema
      .createTable('verification')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('identifier', 'text', (col) => col.notNull())
      .addColumn('value', 'text', (col) => col.notNull())
      .addColumn('expiresAt', 'timestamp', (col) => col.notNull())
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('updatedAt', 'timestamp')
      .execute();
    console.log('✓ Created verification table');

    // Create member table (for organization plugin)
    await db.schema
      .createTable('member')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('organizationId', 'text', (col) => col.notNull())
      .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
      .addColumn('role', 'text', (col) => col.notNull())
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .execute();
    console.log('✓ Created member table');

    // Create organization table
    await db.schema
      .createTable('organization')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('slug', 'text', (col) => col.unique())
      .addColumn('logo', 'text')
      .addColumn('createdAt', 'timestamp', (col) => col.notNull().defaultTo(sql`now()`))
      .addColumn('metadata', 'text')
      .execute();
    console.log('✓ Created organization table');

    // Create invitation table (for organization plugin)
    await db.schema
      .createTable('invitation')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('organizationId', 'text', (col) => col.notNull())
      .addColumn('email', 'text', (col) => col.notNull())
      .addColumn('role', 'text')
      .addColumn('status', 'text', (col) => col.notNull())
      .addColumn('expiresAt', 'timestamp', (col) => col.notNull())
      .addColumn('inviterId', 'text', (col) => col.notNull().references('user.id'))
      .execute();
    console.log('✓ Created invitation table');

    console.log('\n✅ Better Auth database migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
