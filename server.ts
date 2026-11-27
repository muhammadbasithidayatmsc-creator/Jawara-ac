import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { initDb } from './server/db.ts';
import { createApiRouter } from './server/routes.ts';

async function startServer() {
  initDb();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Parse JSON for standard API requests (restore endpoint uses express.raw)
  app.use((req, res, next) => {
    if (req.path === '/api/database/restore') {
      next();
      return;
    }
    express.json({ limit: '5mb' })(req, res, next);
  });

  app.use('/api', createApiRouter());

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build dist/index.html tidak ditemukan. Jalankan npm run build.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`JAWARA AC server berjalan di http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server JAWARA AC:', err);
  process.exit(1);
});
