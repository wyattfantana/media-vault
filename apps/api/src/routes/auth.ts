import express from 'express';
import { auth } from '../auth.js';
import { toNodeHandler } from 'better-auth/node';

export const authRouter = express.Router();

// Better Auth handles all auth routes through a single handler
// Routes: /api/auth/sign-up, /api/auth/sign-in, /api/auth/sign-out, etc.
authRouter.all('*', toNodeHandler(auth));
