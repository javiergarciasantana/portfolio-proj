import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

const DBG = (...a: any[]) => console.log('[xpra-proxy]', new Date().toISOString(), ...a);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const xpraProxy = createProxyMiddleware<any, any>({
    changeOrigin: true,
    router: (req: any) => {
      const url: string = req.originalUrl ?? req.url ?? '';
      const m = url.match(/\/xpra\/(\d+)/);
      const target = m ? `http://localhost:${m[1]}` : null;
      DBG(`router  url="${url}" → target=${target}`);
      return target;
    },
    pathRewrite: (path: string) => {
      const m = path.match(/^\/(?:xpra\/)?(\d+)(\/.*)?$/);
      const rewritten = m ? (m[2] || '/') : '/';
      DBG(`rewrite path="${path}" → "${rewritten}"`);
      return rewritten;
    },
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        DBG(`→ proxy  ${req.method} ${req.originalUrl ?? req.url}  →  ${proxyReq.host}${proxyReq.path}`);
      },
      proxyRes: (proxyRes: any, req: any) => {
        DBG(`← resp   ${req.originalUrl ?? req.url}  status=${proxyRes.statusCode}`);
        if (proxyRes.headers['x-frame-options']) {
          DBG('  stripping X-Frame-Options:', proxyRes.headers['x-frame-options']);
          delete proxyRes.headers['x-frame-options'];
        }
        if (proxyRes.headers['content-security-policy']) {
          DBG('  stripping Content-Security-Policy');
          delete proxyRes.headers['content-security-policy'];
        }
      },
      error: (err: any, req: any, res: any) => {
        DBG(`ERROR  ${req.originalUrl ?? req.url}  ${err.message}`);
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(502).json({ error: 'xpra proxy error', message: err.message });
        }
      },
    },
  });

  app.use('/xpra', (req: any, res: any, next: any) => {
    const url: string = req.originalUrl ?? '';
    if (!/\/xpra\/\d+/.test(url)) {
      DBG(`SKIP  no port in url="${url}" — passing to next middleware`);
      return next();
    }
    return xpraProxy(req, res, next);
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[bootstrap] NestJS listening on port ${port}`);
}
bootstrap();
