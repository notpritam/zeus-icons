import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { browserCatalog } from './browser-catalog.mjs';
const manifest = JSON.parse(await readFile('public/traced/manifest.json'));
const catalog = browserCatalog(manifest);
const json = JSON.stringify(catalog);
await writeFile('public/traced/catalog-v3.json', json);
await writeFile('public/traced/catalog-v3.json.gz', gzipSync(json));
console.log(`Browser catalogue: ${catalog.count} variants, ${gzipSync(json).length} compressed bytes.`);
