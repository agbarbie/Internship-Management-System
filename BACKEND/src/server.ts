import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import authRoutes      from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import taskRoutes      from './routes/tasks';
import internRoutes    from './routes/interns';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SERVE HTML PAGES ──────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API ROUTES ────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/interns',   internRoutes);

// ── HEALTH CHECK ──────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status:    'OK',
    message:   '✅ InternHub API is running',
    timestamp: new Date().toISOString(),
  });
});

// ── FALLBACK — serve landing page for all other routes
// app.get('*path', (_req: Request, res: Response) => {
//   res.sendFile(path.join(__dirname, '../public', 'landing', 'landingpage.html'));
// });

// ── START SERVER ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀  InternHub server running at http://localhost:${PORT}`);
});

export default app;