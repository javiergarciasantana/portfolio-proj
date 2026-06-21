import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Configure the WebSocket Proxy
  const vncProxy = createProxyMiddleware({
    target: 'http://127.0.0.1', 
    changeOrigin: true,
    ws: true,
    router: (req) => {

      if (!req.url) return 'http://127.0.0.1';
      // Extracts the port from the URL (e.g., /vnc/6090 -> 6090)
      const port = req.url.split('/')[2];
      return `http://127.0.0.1:${port}`;
    },
    pathRewrite: {
      '^/vnc/\\d+': '/', // Rewrites the URL so websockify accepts it
    },
  });

  // 2. Tell NestJS to use this proxy for any URL starting with /vnc
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
