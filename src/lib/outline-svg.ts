import type { CanvasKit, Path } from 'canvaskit-wasm';
import wasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url';

let engine: Promise<CanvasKit> | undefined;
export function getEngine() {
  engine ??= import('canvaskit-wasm').then(module => module.default({ locateFile: () => wasmUrl })).catch(error => { engine = undefined; throw error; });
  return engine;
}
function inherited(element: Element, name: string, fallback: string): string {
  return element.getAttribute(name) ?? (element.parentElement ? inherited(element.parentElement, name, fallback) : fallback);
}
function geometry(element: Element, kit: CanvasKit): Path | null {
  const n = (name: string) => Number(element.getAttribute(name) ?? 0);
  let d = element.getAttribute('d') ?? '';
  if (element.localName === 'circle' || element.localName === 'ellipse') {
    const x = n('cx'), y = n('cy'), rx = n(element.localName === 'circle' ? 'r' : 'rx'), ry = n(element.localName === 'circle' ? 'r' : 'ry');
    d = `M ${x - rx} ${y} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
  } else if (element.localName === 'rect') {
    const x = n('x'), y = n('y'), w = n('width'), h = n('height');
    const rx = Math.min(w / 2, Number(element.getAttribute('rx') ?? element.getAttribute('ry') ?? 0));
    const ry = Math.min(h / 2, Number(element.getAttribute('ry') ?? element.getAttribute('rx') ?? 0));
    d = rx && ry ? `M${x + rx} ${y} H${x + w - rx} A${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V${y + h - ry} A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H${x + rx} A${rx} ${ry} 0 0 1 ${x} ${y + h - ry} V${y + ry} A${rx} ${ry} 0 0 1 ${x + rx} ${y} Z` : `M${x} ${y} h${w} v${h} h${-w} Z`;
  } else if (element.localName === 'line') {
    d = `M${n('x1')} ${n('y1')} L${n('x2')} ${n('y2')}`;
  } else if (element.localName === 'polyline' || element.localName === 'polygon') {
    d = `M${element.getAttribute('points')}${element.localName === 'polygon' ? 'Z' : ''}`;
  }
  return kit.Path.MakeFromSVGString(d);
}

/** Vector expansion of the installed free pack. This does not trace a raster image.
 * Transforms and element opacity apply once to the combined fill and expanded stroke.
 */
export async function outlineSvg(svg: string): Promise<string> {
  const kit = await getEngine();
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const ns = 'http://www.w3.org/2000/svg';
  for (const element of [...doc.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon')]) {
    const stroke = inherited(element, 'stroke', 'none');
    if (stroke === 'none') continue;
    // No dashed strokes occur in the installed package. Refuse unsupported imported geometry.
    if (inherited(element, 'stroke-dasharray', 'none') !== 'none') throw new Error('Dashed strokes cannot be outlined. Use SVG stroked.');
    const path = geometry(element, kit);
    if (!path) throw new Error('The icon could not be outlined. Use SVG stroked.');
    const cap = inherited(element, 'stroke-linecap', 'butt'), join = inherited(element, 'stroke-linejoin', 'miter');
    const outlined = path.makeStroked({ width: Number(inherited(element, 'stroke-width', '1')), precision: 4,
      cap: cap === 'round' ? kit.StrokeCap.Round : cap === 'square' ? kit.StrokeCap.Square : kit.StrokeCap.Butt,
      join: join === 'round' ? kit.StrokeJoin.Round : join === 'bevel' ? kit.StrokeJoin.Bevel : kit.StrokeJoin.Miter,
      miter_limit: Number(inherited(element, 'stroke-miterlimit', '4')) });
    path.delete();
    if (!outlined) throw new Error('The icon could not be outlined. Use SVG stroked.');
    const expanded = doc.createElementNS(ns, 'path');
    expanded.setAttribute('d', outlined.toSVGString());
    outlined.delete();
    expanded.setAttribute('fill', stroke);
    expanded.setAttribute('fill-rule', 'nonzero');
    expanded.setAttribute('fill-opacity', inherited(element, 'stroke-opacity', '1'));
    const group = doc.createElementNS(ns, 'g');
    for (const attr of ['transform', 'opacity', 'clip-path', 'mask', 'visibility', 'display', 'id']) {
      if (element.hasAttribute(attr)) group.setAttribute(attr, element.getAttribute(attr)!);
    }
    if (inherited(element, 'fill', 'black') !== 'none') {
      const fill = element.cloneNode(true) as Element;
      for (const attr of [...group.attributes]) fill.removeAttribute(attr.name);
      group.appendChild(fill);
    }
    group.appendChild(expanded);
    element.replaceWith(group);
  }
  for (const element of [doc.documentElement, ...doc.querySelectorAll('*')]) {
    for (const attr of [...element.attributes]) if (attr.name === 'stroke' || attr.name.startsWith('stroke-')) element.removeAttribute(attr.name);
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
