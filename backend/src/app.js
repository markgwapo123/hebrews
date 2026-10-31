import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4200' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  app: 'Hebrews',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
}));

// Phase 1 foundation only: protected CRUD and sales posting routes are not yet exposed.
// All future write endpoints require authentication, RBAC, validation and audit logs.
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
export { app };
