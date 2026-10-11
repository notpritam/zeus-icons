import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { open } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
async function packageDownload(request: IncomingMessage, response: ServerResponse, next: () => void, root: 'public' | 'dist') {
  const pathname = request.url?.split('?')[0] ?? '';
  if (!/^\/packages\/(?:free-icons|zeus-icons)[\w.-]*\.(?:tgz|tar\.gz)$/.test(pathname) || !['GET', 'HEAD'].includes(request.method ?? '')) return next();
  try {
    const handle = await open(`${root}${pathname}`, 'r');
    const info = await handle.stat();
    response.setHeader('Content-Type', 'application/gzip');
    response.setHeader('Content-Length', info.size);
    response.setHeader('Content-Disposition', `attachment; filename="${pathname.split('/').at(-1)}"`);
    response.setHeader('Cache-Control', 'no-cache');
    if (request.method === 'HEAD') { await handle.close(); return response.end(); }
    const stream = handle.createReadStream();
    response.on('close', () => stream.destroy());
    stream.on('error', () => response.destroy()).pipe(response);
  } catch { next(); }
}
export default defineConfig({
  publicDir: process.env.ZEUS_STATIC_EXPORT === '1' ? false : 'public',
  appType: 'mpa',
  // Content-hashed modules are immutable. An open tab may request one long
  // after a deployment, so keep them when publishing the next build.
  build: { emptyOutDir: false },
  plugins: [react(), tailwindcss(), {
    name: 'compressed-generated-catalog',
    configureServer(server) { server.middlewares.use((request, response, next) => { void packageDownload(request, response, next, 'public'); }); },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        if (/^\/(?:assets\/.*-[\w-]+\.(?:js|css|wasm|woff2)|traced\/svg\/[^?]+\.svg\?v=[a-f0-9]+)$/.test(request.url ?? '')) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        next();
      });
      server.middlewares.use((request, response, next) => { void packageDownload(request, response, next, 'dist'); });
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?')[0];
        if (!['/traced/catalog.json', '/traced/catalog-v2.json', '/traced/catalog-v3.json'].includes(pathname ?? '') || !request.headers['accept-encoding']?.includes('gzip')) return next();
        try {
          const file = `dist${pathname}.gz`;
          const handle = await open(file, 'r');
          const info = await handle.stat();
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Content-Encoding', 'gzip');
          response.setHeader('Content-Length', info.size);
          response.setHeader('Cache-Control', 'no-cache');
          response.setHeader('Vary', 'Accept-Encoding');
          if (request.method === 'HEAD') { await handle.close(); return response.end(); }
          // The descriptor keeps this exact checkpoint even if publication
          // replaces the pathname between reading headers and streaming bytes.
          const stream = handle.createReadStream();
          response.on('close', () => stream.destroy());
          stream.on('error', () => response.destroy()).pipe(response);
        } catch { next(); }
      });
    },
  }, {
    name: 'restore-retired-outline-module',
    generateBundle(_, bundle) {
      const outline = Object.values(bundle).find(item => item.type === 'chunk' && item.name === 'outline-svg');
      if (!outline) throw new Error('Missing outline module');
      // This pre-retention deployment was already removed from disk. Its
      // public exports are unchanged; bridge that exact URL for open tabs.
      this.emitFile({ type: 'asset', fileName: 'assets/outline-svg-BuQc-UMe.js', source: `export * from './${outline.fileName.split('/').at(-1)}';\n` });
    },
  }],
  server: { host: '127.0.0.1', allowedHosts: ['.getbb.app'] },
  preview: { host: '127.0.0.1', allowedHosts: ['.getbb.app'], headers: { 'Cache-Control': 'no-cache' } },
});
