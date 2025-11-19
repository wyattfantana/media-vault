import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { admin, organization } from 'better-auth/plugins';

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create Kysely instance for Better Auth
const db = new Kysely({
  dialect: new PostgresDialect({
    pool,
  }),
});

export const auth = betterAuth({
  database: {
    db,
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true when email service is configured
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      enabled: !!process.env.FACEBOOK_CLIENT_ID,
    },
  },
  plugins: [
    admin(), // Admin plugin for role management
    organization(), // Organization/team management
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  rateLimit: {
    enabled: true,
    window: 60, // 1 minute
    max: 10, // 10 requests per minute
  },
  trustedOrigins: [
    'http://localhost:5173', // Web app
    'http://localhost:3000', // Desktop app
    'tauri://localhost',     // Tauri
    process.env.CORS_ORIGIN,
  ].filter(Boolean) as string[],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
