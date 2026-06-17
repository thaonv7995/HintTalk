/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'node:http';
import https from 'node:https';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'generic-proxy',
      configureServer(server) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url && req.url.startsWith('/api-proxy')) {
            const targetHeader = req.headers['x-proxy-target'];
            let targetBase: URL;
            try {
              targetBase = new URL(String(targetHeader || '').replace(/\/+$/, ''));
            } catch {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Missing or invalid X-Proxy-Target header');
              req.resume();
              return;
            }

            if (targetBase.protocol !== 'https:' && targetBase.protocol !== 'http:') {
              res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('X-Proxy-Target protocol must be http or https');
              req.resume();
              return;
            }

            const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const targetPathname = parsedUrl.pathname.replace(/^\/api-proxy/, '') || '/';
            const targetPath = `${targetBase.pathname.replace(/\/+$/, '')}${targetPathname}${parsedUrl.search}`;

            const chunks: any[] = [];
            let size = 0;
            req.on('data', (c: any) => {
              size += c.length;
              if (size > 8 * 1024 * 1024) {
                res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Request body too large');
                req.destroy();
                return;
              }
              chunks.push(c);
            });

            req.on('end', () => {
              if (res.headersSent) return;
              const body = Buffer.concat(chunks);

              const headers = { ...req.headers };
              delete headers['x-proxy-target'];
              delete headers['host'];
              delete headers['connection'];
              delete headers['keep-alive'];

              const targetUrl = new URL(targetPath, targetBase);
              const clientModule = targetUrl.protocol === 'https:' ? https : http;
              const opt = {
                hostname: targetUrl.hostname,
                port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                path: `${targetUrl.pathname}${targetUrl.search}`,
                method: req.method,
                headers,
              };

              const preq = clientModule.request(opt, (pres) => {
                res.writeHead(pres.statusCode || 502, pres.headers);
                pres.pipe(res);
              });

              preq.setTimeout(30000, () => {
                preq.destroy(new Error('Generic proxy timeout'));
              });

              preq.on('error', (e) => {
                if (res.headersSent) return;
                res.writeHead(502).end(String(e.message));
              });

              if (body.length) preq.write(body);
              preq.end();
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    proxy: {
      '/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/openai/, ''),
      },
      '/voca-api': {
        target: 'http://127.0.0.1:22053',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/voca-api/, ''),
      },
    },
  },
});
