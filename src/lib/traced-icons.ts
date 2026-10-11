import { sanitizeSvg } from './svg';
import type { IconEntry } from '../types';
import { sourceSlug, type IconStyle } from './icon-styles';

export interface TracedIcon {
  id: string; name: string; category?: string; style: IconStyle; sourceUrl: string;
  svgUrl: string; imageUrl: string; sourceWidth: number; sourceHeight: number;
  svgSha256?: string; revision?: string;
  overlap: number; paths: number; status: 'ready' | 'needs-review';
  geometry?: { method: 'shape-model' | 'pixel-trace' | 'matched-centrelines' | 'fitted-contours'; model?: string; constraints?: string[] };
}
export interface TracedCatalog { count: number; requested: number; ready: number; entries: TracedIcon[]; }
type PackedEntry = [string, IconStyle, string, string, number, number, TracedIcon['status'], NonNullable<TracedIcon['geometry']>['method'], number, number, string?, string?];
interface BrowserCatalog { packed: 3; count: number; requested: number; ready: number; revision: string; styles: IconStyle[]; methods: NonNullable<TracedIcon['geometry']>['method'][]; categories: string[]; icons: [string, number, [number, number, number, number, number, number, string, number][]][]; }
export function unpackCatalog(data: TracedCatalog | BrowserCatalog | { packed: 1 | 2; count: number; requested: number; ready: number; entries: PackedEntry[] }): TracedCatalog {
  if (!('packed' in data)) return data;
  if (data.packed === 3) return { count: data.count, requested: data.requested, ready: data.ready, entries: data.icons.flatMap(([name, category, variants]) => variants.map(([styleIndex, overlap, paths, ready, method, dimension, override, reference]) => {
    const style = data.styles[styleIndex], id = `${name}-${style}`, key = override || id;
    return { id, name, style, category: data.categories[category], sourceUrl: `https://hugeicons.com/icon/${encodeURIComponent(name)}?style=${style}`,
      svgUrl: `/traced/svg/${key}.svg`, imageUrl: `/traced/images/${key}${reference ? '-reference' : ''}.webp`,
      overlap, paths, status: ready ? 'ready' as const : 'needs-review' as const, geometry: { method: data.methods[method] },
      sourceWidth: dimension, sourceHeight: dimension, revision: data.revision };
  })) };
  return { count: data.count, requested: data.requested, ready: data.ready, entries: data.entries.map(([name, style, category, key, overlap, paths, status, method, sourceWidth, sourceHeight, imageUrl, svgSha256]) => ({
    id: `${name}-${style}`, name, style, category, sourceUrl: `https://hugeicons.com/icon/${encodeURIComponent(name)}?style=${style}`,
    svgUrl: `/traced/svg/${key}.svg`, imageUrl: data.packed === 2 && imageUrl === ':' ? `/traced/images/${key}-reference.webp` : imageUrl ?? `/traced/images/${key}.webp`, overlap, paths, status, geometry: { method }, sourceWidth, sourceHeight, svgSha256,
  })) };
}
export function traceDescription(entry: TracedIcon): string {
  return entry.geometry?.method === 'shape-model' ? 'Geometric reconstruction' : entry.geometry?.method === 'matched-centrelines' ? 'Matched geometric paths' : entry.geometry?.method === 'fitted-contours' ? 'Fitted shapes and curves' : 'Image trace';
}
const indexes = new WeakMap<TracedCatalog, Map<string, TracedIcon>>();
const slugs = new WeakMap<IconEntry, string>();
export function findTrace(catalog: TracedCatalog | undefined, icon: IconEntry, style: IconStyle): TracedIcon | undefined {
  if (!catalog) return undefined;
  let index = indexes.get(catalog);
  if (!index) { index = new Map(catalog.entries.map(entry => [`${entry.name}:${entry.style}`, entry])); indexes.set(catalog, index); }
  let slug = slugs.get(icon);
  if (!slug) { slug = sourceSlug(icon); slugs.set(icon, slug); }
  return index.get(`${slug}:${style}`);
}
export function traceNotice(entry: TracedIcon): string {
  return `Generated image trace; not the original Hugeicons Pro SVG.\nSource: ${entry.sourceUrl}\nReference artwork: Hugeicons. Not covered by the application's MIT license.\n${traceDescription(entry)} from ${entry.sourceWidth} x ${entry.sourceHeight} pixels; default alpha overlap ${entry.overlap}%.`;
}
export async function renderTrace(source: string, stroke: number, size: number, color: string, alpha: number, sharp: boolean): Promise<string> {
  const clean = sanitizeSvg(source).svg;
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  const root = doc.documentElement;
  root.setAttribute('width', String(size)); root.setAttribute('height', String(size));
  root.setAttribute('color', color); root.setAttribute('opacity', String(alpha / 100));
  const delta = stroke - 1.5;
  if (Math.abs(delta) > .0001) {
    const { getEngine } = await import('./outline-svg');
    const kit = await getEngine();
    for (const element of doc.querySelectorAll('path')) {
      let path = kit.Path.MakeFromSVGString(element.getAttribute('d')!);
      if (!path) throw new Error('Could not adjust this vector contour.');
      // Boolean cutouts may use even-odd winding. Keep that fill rule when
      // changing weight, or an enclosed hole can turn into a filled region.
      if (element.getAttribute('fill-rule') === 'evenodd') {
        const builder = new kit.PathBuilder(path);
        builder.setFillType(kit.FillType.EvenOdd);
        path.delete(); path = builder.detachAndDelete();
      }
      // Exported contours are fills, including reconstructed centreline models.
      // Expand/shrink the silhouette by half the requested stroke difference.
      const border = path.makeStroked({ width: Math.abs(delta), join: sharp ? kit.StrokeJoin.Miter : kit.StrokeJoin.Round, cap: kit.StrokeCap.Round, precision: 4 });
      if (!border) { path.delete(); throw new Error('Could not adjust this vector contour.'); }
      const changed = kit.Path.MakeFromOp(path, border, delta > 0 ? kit.PathOp.Union : kit.PathOp.Difference);
      border.delete(); path.delete();
      if (!changed) throw new Error('Could not adjust this vector contour.');
      element.setAttribute('d', changed.toSVGString());
      element.setAttribute('fill-rule', changed.getFillType() === kit.FillType.EvenOdd ? 'evenodd' : 'nonzero');
      changed.delete();
    }
  }
  return new XMLSerializer().serializeToString(root);
}

export function traceSvgUrl(entry: TracedIcon): string {
  const revision = entry.svgSha256?.slice(0, 12) ?? entry.revision;
  return revision ? `${entry.svgUrl}?v=${revision}` : entry.svgUrl;
}
