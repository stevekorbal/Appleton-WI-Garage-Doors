import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import contactHandler from './api/contact.ts';

function generateSitemapPlugin() {
  return {
    name: 'generate-sitemap-plugin',
    buildStart() {
      try {
        execSync('node scripts/generate-sitemap.js', { stdio: 'inherit' });
      } catch (err) {
        console.error('[Sitemap Plugin] Error running generate-sitemap.js:', err);
      }
    }
  };
}

function contactApiPlugin() {
  return {
    name: 'contact-api-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/contact', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
          return;
        }

        let rawBody = '';
        req.on('data', (chunk: any) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          try {
            let body = {};
            if (rawBody) {
              try {
                body = JSON.parse(rawBody);
              } catch {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, message: 'Invalid JSON payload' }));
                return;
              }
            }

            const mockReq = {
              method: req.method,
              body,
              headers: req.headers
            };

            const mockRes = {
              statusCode: 200,
              headers: {} as Record<string, string>,
              setHeader(key: string, val: string) {
                this.headers[key] = val;
                res.setHeader(key, val);
              },
              status(code: number) {
                this.statusCode = code;
                res.statusCode = code;
                return this;
              },
              json(data: any) {
                res.statusCode = this.statusCode || 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              }
            };

            await contactHandler(mockReq, mockRes);
          } catch (err) {
            console.error('[Vite Dev /api/contact Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: "Sorry, we couldn't send your request. Please call us directly." }));
          }
        });
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [generateSitemapPlugin(), contactApiPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
