import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request, Response, NextFunction } from 'express';

// Whitelist only the 4 websockify ports the session pool allocates (BASE_WS=6090, GUI_CAP=4)
const ALLOWED_VNC_PORTS = new Set([6090, 6091, 6092, 6093]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  // 1. Configure the WebSocket Proxy
  const vncProxy = createProxyMiddleware({
    target: 'http://127.0.0.1',
    changeOrigin: true,
    ws: true,
    router: (req) => {
      if (!req.url) return 'http://127.0.0.1';
      // Extracts the port from the URL (e.g., /vnc/6090 -> 6090)
      const port = parseInt(req.url.split('/')[2] ?? '', 10);
      if (!ALLOWED_VNC_PORTS.has(port)) return 'http://127.0.0.1';
      return `http://127.0.0.1:${port}`;
    },
    pathRewrite: {
      '^/vnc/\\d+': '/', // Rewrites the URL so websockify accepts it
    },
  });

  // 2. Validate port before proxying — rejects requests to non-whitelisted ports
  // req.originalUrl = /vnc/6090/... (never stripped), so index 2 is the port
  app.use('/vnc', (req: Request, res: Response, next: NextFunction) => {
    const port = parseInt(req.originalUrl.split('/')[2] ?? '', 10);
    if (!ALLOWED_VNC_PORTS.has(port)) {
      res.status(400).json({ error: 'Invalid VNC port' });
      return;
    }
    next();
  });
  app.use('/vnc', vncProxy);

  // 3. Start the HTTP server
  const server = await app.listen(process.env.PORT ?? 3000);

  // 4. Safely share the WebSocket "upgrade" event with Socket.io
  server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/vnc')) {
      vncProxy.upgrade(req, socket, head);
    }
  });

}
bootstrap();
