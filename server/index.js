import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { db, all, run, nowIso } from './db/index.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { errorHandler, HttpError } from './middleware/errors.js';
import { makeRouter } from './middleware/router.js';
import { attachSocket } from './socket.js';
import { reference } from './services/reference.js';
import { purgeOldOtps } from './services/otp.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import communityRoutes from './routes/communities.js';
import conversationRoutes from './routes/conversations.js';
import notificationRoutes from './routes/notifications.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import searchRoutes from './routes/search.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // CSRF defense: state-changing requests must come from our own origin.
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    let host;
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
    if (origin === config.clientOrigin || host === req.get('host')) return next();
    next(new HttpError(403, 'BAD_ORIGIN', 'Request blocked: unexpected origin.'));
  });

  if (!process.env.CC_QUIET) {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api')) {
          console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - start}ms${req.user ? ` u${req.user.id}` : ''}`);
        }
      });
      next();
    });
  }

  const api = makeRouter();
  api.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, db: 'ok', uptime: Math.round(process.uptime()) });
  });
  api.get('/meta', (req, res) => {
    res.json({
      allowedDomain: config.allowedDomain,
      maxUploadMb: config.maxUploadMb,
      departments: all('SELECT id, code, name, school FROM departments ORDER BY name'),
      programs: reference.programs,
      designations: reference.designations,
      subjectTags: reference.subjectTags,
      mentorTopics: reference.mentorTopics,
    });
  });
  app.use('/api', api);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', requireAuth, userRoutes);
  app.use('/api/posts', requireAuth, postRoutes);
  app.use('/api', requireAuth, commentRoutes);
  app.use('/api/communities', requireAuth, communityRoutes);
  app.use('/api/conversations', requireAuth, conversationRoutes);
  app.use('/api/notifications', requireAuth, notificationRoutes);
  app.use('/api/reports', requireAuth, reportRoutes);
  app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
  app.use('/api/search', requireAuth, searchRoutes);
  app.use('/api', (req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Unknown API route.')));

  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      fallthrough: false,
      immutable: true,
      maxAge: '365d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  // Serves the built PWA when present, so one process can run the whole app.
  if (fs.existsSync(config.clientDist)) {
    app.use(
      express.static(config.clientDist, {
        setHeaders: (res, file) => {
          if (file.endsWith('sw.js') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^(?!\/(api|uploads|socket\.io)\b).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

function housekeeping() {
  purgeOldOtps();
  run('DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < ?', new Date(Date.now() - 90 * 86_400_000).toISOString());
  run("UPDATE posts SET is_pinned = 0 WHERE is_pinned = 1 AND pinned_until IS NOT NULL AND pinned_until < ?", nowIso());
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(config.root, 'index.js');
if (isMain) {
  const app = createApp();
  const server = http.createServer(app);
  attachSocket(server);
  housekeeping();
  setInterval(housekeeping, 3_600_000).unref();
  server.listen(config.port, () => {
    const users = all('SELECT count(*) AS n FROM users')[0].n;
    console.log(`Campus Connect API on http://localhost:${config.port} (${users} users, db ${path.basename(config.dbPath)})`);
    if (!config.smtp.host) console.log('No SMTP configured: sign-up codes will be printed here.');
  });
}
