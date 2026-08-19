import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { errorHandler, notFound } from './middleware/error';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads'), { fallthrough: false, maxAge: '7d' }));
  app.use('/api', apiRouter);

  // Server/LAN mode can serve the built React workspace and API from one origin.
  // Client PCs then use http://SERVER_IP:PORT without a shared SQLite file.
  const rendererDirectory = path.resolve(process.env.RENDERER_DIR || path.join('release', 'renderer'));
  const rendererIndex = path.join(rendererDirectory, 'index.html');
  if (process.env.SERVE_RENDERER === 'true' && fs.existsSync(rendererIndex)) {
    app.use(express.static(rendererDirectory, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(rendererIndex);
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
