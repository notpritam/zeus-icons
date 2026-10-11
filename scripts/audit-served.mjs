import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers/promises';

// Check the server, not just files on disk: Vite's public-file index can go stale
// when catalogue sync replaces whole directories under a running dev process.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:8937');
const started = performance.now();
const catalog = JSON.parse(await readFile('public/catalog.json', 'utf8'));
let traces;
try { traces = JSON.parse(await readFile('public/traced/manifest.json', 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
// systemd runs this immediately after spawning the preview process.
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch(new URL('/catalog.json', base), { method: 'HEAD', signal: AbortSignal.timeout(1000) });
    if (response.status === 200) break;
  } catch { /* The process may still be binding its port. */ }
  if (attempt < 39) await setTimeout(250);
}
const assets = [
  { url: '/catalog.json', type: 'application/json' },
  ...catalog.icons.flatMap(icon => [
    { url: icon.localUrl, type: 'image/svg+xml' },
    { url: icon.referenceUrl, type: 'application/json' },
  ]),
  { url: '/free-icons.zip', type: 'application/zip' },
  { url: '/LICENSE-hugeicons.txt', type: 'text/plain' },
  { url: '/LICENSE-canvaskit.txt', type: 'text/plain' },

];
if (traces) assets.push(
  { url: '/traced/manifest.json', type: 'application/json' },
  { url: '/traced/catalog.json', type: 'application/json' },
  { url: '/traced/catalog-v2.json', type: 'application/json' },
  { url: '/traced/progress.json', type: 'application/json' },
  ...traces.entries.flatMap(entry => [{ url: entry.svgUrl, type: 'image/svg+xml' }, { url: entry.imageUrl, type: 'image/webp' }]),
);
try {
  const packages = JSON.parse(await readFile('public/packages/manifest.json', 'utf8'));
  assets.push({ url: '/packages/manifest.json', type: 'application/json' });
  for (const item of packages.packages) assets.push({ url: item.url, type: 'application/gzip' });
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const failures = [];
let next = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (next < assets.length) {
    const asset = assets[next++];
    try {
      const response = await fetch(new URL(asset.url, base), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
      if (response.status !== 200 || contentType !== asset.type) {
        await response.body?.cancel();
        throw new Error(`Expected 200 ${asset.type}; received ${response.status} ${contentType}`);
      }
      const [actual, expected] = await Promise.all([response.arrayBuffer(), readFile(`public${asset.url}`)]);
      if (!expected.equals(Buffer.from(actual))) throw new Error('Served bytes differ from the catalogue on disk');
    } catch (error) { failures.push({ url: asset.url, error: error instanceof Error ? error.message : String(error) }); }
  }
}));
for (const url of ['/variants/offset/home-01.svg', '/downloads/free-icons-all.zip', '/library.json', '/variants-manifest.json', '/icons/does-not-exist.svg']) {
  const response = await fetch(new URL(url, base));
  if (response.status !== 404) failures.push({ url, error: `Retired or missing asset returned ${response.status}, expected 404` });
  await response.body?.cancel();
}
console.log(JSON.stringify({ status: failures.length ? 'failed' : 'passed', origin: base.origin,
  icons: catalog.icons.length, checkedAssets: assets.length, failedAssets: failures.length,
  durationSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), failures: failures.slice(0,20) }, null, 2));
if (failures.length) process.exitCode = 1;
