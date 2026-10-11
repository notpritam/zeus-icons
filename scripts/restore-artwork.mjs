import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
// The release repository keeps audit metadata compressed; SVGs are regular files.
try {
  const bytes = await readFile('public/traced/manifest.json.gz');
  await writeFile('public/traced/manifest.json', gunzipSync(bytes));
} catch (error) { if (error.code !== 'ENOENT') throw error; }
