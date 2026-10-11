import { createHash } from 'node:crypto';

// Browser metadata is grouped by icon identity. Full hashes and audit history
// stay in the source manifest; a content revision invalidates the SVG cache.
export function browserCatalog(manifest) {
  const styles = [...new Set(manifest.entries.map(e => e.style))];
  const methods = [...new Set(manifest.entries.map(e => e.geometry?.method ?? 'pixel-trace'))];
  const categories = [...new Set(manifest.entries.map(e => e.category ?? ''))];
  const icons = new Map();
  for (const e of manifest.entries) {
    if (e.sourceWidth !== e.sourceHeight) throw new Error(`Non-square reference: ${e.id}`);
    if (e.id !== `${e.name}-${e.style}`) throw new Error(`Mismatched identity: ${e.id}`);
    const key = e.svgUrl.slice('/traced/svg/'.length, -4);
    const reference = e.imageUrl.endsWith(`${key}-reference.webp`);
    if (!reference && !e.imageUrl.endsWith(`${key}.webp`)) throw new Error(`Unexpected reference identity: ${e.id}`);
    if (!icons.has(e.name)) icons.set(e.name, [e.name, categories.indexOf(e.category ?? ''), []]);
    icons.get(e.name)[2].push([styles.indexOf(e.style), e.overlap, e.paths, e.status === 'ready' ? 1 : 0,
      methods.indexOf(e.geometry?.method ?? 'pixel-trace'), e.sourceWidth, key === e.id ? '' : key, reference ? 1 : 0]);
  }
  return { packed: 3, count: manifest.count, requested: manifest.requested, ready: manifest.ready,
    revision: createHash('sha256').update(manifest.entries.map(e => e.svgSha256).join('')).digest('hex').slice(0, 12),
    styles, methods, categories, icons: [...icons.values()] };
}
