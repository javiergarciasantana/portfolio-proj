import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Proxy xpra containers through port 3000 to avoid cross-origin iframe block.
  // Each container runs on a dynamic host port; browser sees /xpra/<port>/* on
  // the same origin (3000) so X-Frame-Options: SAMEORIGIN is satisfied.
  const xpraProxy = createProxyMiddleware<any, any>({
    changeOrigin: true,
    ws: true,
    router: (req) => {
      const m = req.url?.match(/\/xpra\/(\d+)/);
      return m ? `http://localhost:${m[1]}` : undefined;
    },
    pathRewrite: (path: string) => path.replace(/^\/xpra\/\d+/, '') || '/',
  });

  app.use('/xpra', xpraProxy);

  // WebSocket upgrades bypass Express middleware — wire them up manually.
  const httpServer = app.getHttpServer();
  httpServer.on('upgrade', (req: any, socket: any, head: any) => {
    if ((req.url as string)?.startsWith('/xpra/')) {
      (xpraProxy as any).upgrade(req, socket, head);
    }
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
