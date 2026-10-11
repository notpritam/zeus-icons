import { execFileSync } from 'node:child_process';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const out = join(root, '.local/site');
// Artwork and packages come from the package release; the browser has its own version
// (a browser-only release such as 0.1.1 keeps loading v0.1.0 artwork and packages).
const version = JSON.parse(await readFile(join(root, 'public/packages/manifest.json'))).version;
const siteVersion = JSON.parse(await readFile(join(root, 'package.json'))).version;
execFileSync('npm', ['run', 'build', '--', '--base=/icons/', '--outDir=.local/site', '--emptyOutDir'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, ZEUS_STATIC_EXPORT: '1',
    VITE_ICON_ASSET_ORIGIN: `https://raw.githubusercontent.com/notpritam/zeus-icons/v${version}/public`,
    VITE_PACKAGE_ASSET_ORIGIN: `https://github.com/notpritam/zeus-icons/releases/download/v${version}` },
});
// MyZeus UI stays a small static export. Immutable artwork is in the public
// GitHub source tag; release archives are downloaded directly from GitHub.
for (const file of ['catalog.json', 'free-icons.zip', 'LICENSE-hugeicons.txt', 'LICENSE-canvaskit.txt', 'LICENSE-manrope.txt', 'LICENSE-geist.txt', 'traced/catalog-v3.json', 'packages/manifest.json']) {
  const target = join(out, file); await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, 'public', file), target);
}
await writeFile(join(out, 'build.json'), JSON.stringify({ name: 'Zeus Icons', version: siteVersion, packageVersion: version, count: 60331, base: '/icons/', builtAt: new Date().toISOString() }, null, 2));
console.log(`MyZeus UI export ready: ${out}`);
