import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import { init as sentryInit, setupExpressErrorHandler, expressIntegration } from '@sentry/node';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pinoHttp = require('pino-http');
import { AppDataSource } from './data-source.js';
import { clientsRouter } from './routes/clients.js';
import { estimatesRouter } from './routes/estimates.js';
import { invoicesRouter } from './routes/invoices.js';
import { productsRouter } from './routes/products.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { downloadsRouter } from './routes/downloads.js';
import { mediaRouter } from './routes/media.js';
import { jellyfinRouter } from './routes/jellyfin.js';
import searchRouter from './routes/search.js';
import { bookmarksRouter } from './routes/bookmarks.js';
import { presetsRouter } from './routes/presets.js';
import { analyticsRouter } from './routes/analytics.js';
import tmdbRouter from './routes/tmdb.js';
import { logger, httpLogger } from './logger.js';
import { downloadWorker } from './workers/download.worker.js';

// =========================================
// ENVIRONMENT VARIABLE VALIDATION (Issue #5)
// =========================================
const REQUIRED_VARS = ['POSTGRES_HOST', 'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
const OPTIONAL_VARS = ['SENTRY_DSN', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY', 'GOOGLE_CLIENT_ID', 'FACEBOOK_CLIENT_ID'];

logger.info('Validating environment variables...');
let hasErrors = false;

REQUIRED_VARS.forEach(varName => {
  if (!process.env[varName]) {
    logger.error({ variable: varName }, 'Missing required environment variable');
    hasErrors = true;
  }
});

if (hasErrors) {
  logger.fatal('Cannot start server without required environment variables. Please check your .env file.');
  process.exit(1);
}

OPTIONAL_VARS.forEach(varName => {
  if (!process.env[varName]) {
    logger.warn({ variable: varName }, 'Optional environment variable not set');
  }
});

logger.info('Environment variables validated');

// =========================================
// SENTRY INITIALIZATION (Issue #6)
// =========================================
const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN) {
  sentryInit({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [expressIntegration()],
  });
  logger.info('Sentry initialized');
} else {
  logger.warn('Sentry not configured (SENTRY_DSN missing)');
}

const app = express();
const PORT = process.env.PORT || 3001;

// =========================================
// SECURITY MIDDLEWARE
// =========================================

// HTTP request logging (should be early in the middleware chain)
app.use(pinoHttp({ logger: httpLogger }));

// Helmet for security headers (Issue #26)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// Multi-origin CORS (Issue #12)
const ALLOWED_ORIGINS = [
  'http://localhost:3001',           // Combined web + API server (same origin)
  'http://localhost:5173',           // Web dev (separate)
  'http://localhost:3000',           // Desktop dev
  'tauri://localhost',                // Tauri desktop
  'https://tauri.localhost',          // Tauri desktop (alternative)
  process.env.CORS_ORIGIN,            // Custom override
  process.env.PRODUCTION_URL,         // Production web
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin }, 'CORS blocked origin');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

// Session middleware for admin authentication
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 30 * 60 * 1000, // 30 minutes
    sameSite: 'strict',
  },
}));

// Better Auth is configured in auth.ts and exposed via /api/auth routes
// Authentication middleware is applied per-route in route handlers
logger.info('Better Auth configured - authentication available at /api/auth/*');

// =========================================
// HEALTH CHECK (no auth required)
// =========================================
app.get('/health', async (req, res) => {
  const checks: any = {
    database: { healthy: false, message: '' },
    typeorm: { healthy: false, message: '' },
    auth: { healthy: false, message: '' },
    sentry: { healthy: false, message: '' },
  };

  // Database connectivity check
  try {
    const result = await AppDataSource.query('SELECT NOW() as time');
    checks.database.healthy = true;
    checks.database.message = 'Connected';
    checks.database.responseTime = result[0]?.time ? 'OK' : 'Unknown';
  } catch (error) {
    checks.database.healthy = false;
    checks.database.message = error instanceof Error ? error.message : 'Connection failed';
  }

  // TypeORM initialization check
  checks.typeorm.healthy = AppDataSource.isInitialized;
  checks.typeorm.message = AppDataSource.isInitialized ? 'Initialized' : 'Not initialized';

  // Better Auth check (checks if OAuth providers are configured)
  const hasGoogleAuth = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  const hasFacebookAuth = !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET;
  checks.auth.healthy = true; // Email/password is always available
  checks.auth.message = 'Email/password enabled';
  if (hasGoogleAuth || hasFacebookAuth) {
    const providers = [];
    if (hasGoogleAuth) providers.push('Google');
    if (hasFacebookAuth) providers.push('Facebook');
    checks.auth.message += `, OAuth: ${providers.join(', ')}`;
  }

  // Sentry check
  if (SENTRY_DSN) {
    checks.sentry.healthy = true;
    checks.sentry.message = 'Configured';
  } else {
    checks.sentry.healthy = false;
    checks.sentry.message = 'Not configured (optional)';
  }

  // Determine overall health
  const isHealthy = checks.database.healthy && checks.typeorm.healthy;
  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: 'v1',
    environment: process.env.NODE_ENV || 'development',
    checks,
  });
});

// =========================================
// API ROUTES (all require authentication via requireAuth middleware)
// =========================================

// Admin routes (obscure path for security, separate auth system)
app.use('/system/control', adminRouter);

// Authentication routes (Better Auth)
app.use('/api/auth', authRouter);

// API v1 routes
app.use('/api/v1/clients', clientsRouter);
app.use('/api/v1/estimates', estimatesRouter);
app.use('/api/v1/invoices', invoicesRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/downloads', downloadsRouter);
app.use('/api/v1/media', mediaRouter);
app.use('/api/v1/jellyfin', jellyfinRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/bookmarks', bookmarksRouter);
app.use('/api/v1/presets', presetsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/tmdb', tmdbRouter);

// Legacy routes (redirect to v1 for backward compatibility)
app.use('/api/clients', clientsRouter);
app.use('/api/estimates', estimatesRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/products', productsRouter);

// =========================================
// STATIC FILE SERVING (Combined Web + API Server)
// =========================================
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from public directory (built web app)
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Web app not built yet. Run: npm run build:web' });
    }
  });
});

// =========================================
// ERROR HANDLERS
// =========================================

// Sentry error handler (must be before other error handlers)
if (SENTRY_DSN) {
  setupExpressErrorHandler(app);
}

// Global error handler (Issue #4 - hide stack traces in production)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error server-side
  logger.error({ err, path: req.path, method: req.method }, 'Request error');

  const isDevelopment = process.env.NODE_ENV !== 'production';

  // Only send detailed errors in development
  res.status(500).json({
    error: 'Internal server error',
    ...(isDevelopment && {
      message: err.message,
      stack: err.stack,
    }),
  });
});

// =========================================
// GRACEFUL SHUTDOWN (Issue #27)
// =========================================
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  // Stop download worker
  downloadWorker.stop();

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  // Stop download worker
  downloadWorker.stop();

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }

  process.exit(0);
});

// =========================================
// START SERVER
// =========================================
async function bootstrap() {
  try {
    logger.info('Connecting to database...');
    await AppDataSource.initialize();
    logger.info('Database connected (TypeORM initialized)');

    // Start download worker
    downloadWorker.start();

    app.listen(PORT, () => {
      logger.info({ port: PORT, url: `http://localhost:${PORT}` }, 'API server running');
      logger.info({ healthCheck: `http://localhost:${PORT}/health` }, 'Health check available');

      // Show security status
      const authMethods = ['Email/Password'];
      if (process.env.GOOGLE_CLIENT_ID) authMethods.push('Google OAuth');
      if (process.env.FACEBOOK_CLIENT_ID) authMethods.push('Facebook OAuth');

      logger.info({
        authentication: authMethods.join(', '),
        errorTracking: SENTRY_DSN ? 'enabled' : 'disabled',
        corsOrigins: ALLOWED_ORIGINS.length,
        environment: process.env.NODE_ENV || 'development',
      }, 'Security status');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
