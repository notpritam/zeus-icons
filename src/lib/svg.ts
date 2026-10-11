import type { IconNode, SvgSettings } from '../types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SOURCE_LENGTH = 1_048_576;
const MAX_ELEMENTS = 10_000;
const MAX_DEPTH = 64;
let renderSequence = 0;
const NUMBER = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][-+]?\\d+)?';
const numberPattern = new RegExp(`^${NUMBER}$`);
const allowedElements = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc',
]);
const geometryElements = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const definitionElements = new Set(['defs', 'clipPath', 'mask', 'linearGradient', 'radialGradient']);
const numberAttributes = new Set([
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
  'fx', 'fy', 'fr', 'stroke-width', 'stroke-miterlimit', 'stroke-dashoffset', 'pathLength',
]);
const opacityAttributes = new Set(['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'offset']);
const paintAttributes = new Set(['fill', 'stroke', 'color', 'stop-color']);
const presentationAttributes = new Set([
  ...paintAttributes, ...opacityAttributes, 'stroke-width', 'stroke-miterlimit', 'stroke-dashoffset',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'clip-path',
  'mask', 'visibility', 'display',
]);
const enumAttributes: Record<string, readonly string[]> = {
  'stroke-linecap': ['butt', 'round', 'square'],
  'stroke-linejoin': ['miter', 'round', 'bevel'],
  'fill-rule': ['nonzero', 'evenodd'], 'clip-rule': ['nonzero', 'evenodd'],
  'visibility': ['visible', 'hidden', 'collapse'], 'display': ['none', 'inline'],
  'clipPathUnits': ['userSpaceOnUse', 'objectBoundingBox'],
  'maskUnits': ['userSpaceOnUse', 'objectBoundingBox'],
  'maskContentUnits': ['userSpaceOnUse', 'objectBoundingBox'],
  'gradientUnits': ['userSpaceOnUse', 'objectBoundingBox'],
  'spreadMethod': ['pad', 'reflect', 'repeat'],
};

function numeric(value: string): number | undefined {
  if (!numberPattern.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= 100_000_000 ? parsed : undefined;
}

function numberList(value: string): number[] | undefined {
  const parts = value.trim().split(/[\s,]+/);
  if (!parts.length || parts.some((part) => numeric(part) === undefined)) return undefined;
  return parts.map(Number);
}

function parseViewBox(value: string): [number, number, number, number] {
  const values = numberList(value);
  if (!values || values.length !== 4 || values[2] <= 0 || values[3] <= 0
    || values[2] < 0.000001 || values[3] < 0.000001) {
    throw new Error('SVG viewBox must contain four finite numbers with positive width and height.');
  }
  return values as [number, number, number, number];
}

function isColor(value: string): boolean {
  // This grammar excludes CSS variables, escapes, URLs, expressions and external paint servers.
  if (/^(?:none|currentColor|transparent)$/i.test(value)) return true;
  if (/^#[\da-f]{3,8}$/i.test(value) && [4, 5, 7, 9].includes(value.length)) return true;
  if (/^[a-z]+$/i.test(value)) return true; // Unknown CSS color names are inert in SVG.
  return /^(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/]+\)$/i.test(value);
}

function validTransform(value: string): boolean {
  const expression = /([a-zA-Z]+)\(([^()]*)\)/g;
  let cursor = 0;
  let count = 0;
  for (const match of value.matchAll(expression)) {
    if (!/^[\s,]*$/.test(value.slice(cursor, match.index))) return false;
    const values = numberList(match[2]);
    const counts: Record<string, number[]> = { matrix: [6], translate: [1, 2], scale: [1, 2], rotate: [1, 3], skewX: [1], skewY: [1] };
    if (!values || !counts[match[1]]?.includes(values.length)) return false;
    cursor = match.index + match[0].length;
    if (++count > 64) return false;
  }
  return count > 0 && /^[\s,]*$/.test(value.slice(cursor));
}

function validPath(value: string): boolean {
  const tokenPattern = new RegExp(`[AaCcHhLlMmQqSsTtVvZz]|${NUMBER}`, 'g');
  const tokens = [...value.matchAll(tokenPattern)];
  if (!tokens.length || !/^[Mm]$/.test(tokens[0][0])) return false;
  let cursor = 0;
  for (const token of tokens) {
    if (!/^[\s,]*$/.test(value.slice(cursor, token.index))) return false;
    cursor = token.index + token[0].length;
    if (token[0].length > 1 && numeric(token[0]) === undefined) return false;
  }
  if (!/^[\s,]*$/.test(value.slice(cursor))) return false;
  const arities: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  let index = 0;
  let draws = false;
  while (index < tokens.length) {
    const command = tokens[index++][0].toUpperCase();
    if (!(command in arities)) return false;
    const args: number[] = [];
    while (index < tokens.length && !/^[a-z]$/i.test(tokens[index][0])) {
      const argument = numeric(tokens[index++][0]);
      if (argument === undefined) return false;
      args.push(argument);
    }
    const arity = arities[command];
    if (arity === 0) { if (args.length) return false; continue; }
    if (!args.length || args.length % arity !== 0) return false;
    if (command === 'A') {
      for (let start = 0; start < args.length; start += 7) {
        if (args[start] < 0 || args[start + 1] < 0 || ![0, 1].includes(args[start + 3]) || ![0, 1].includes(args[start + 4])) return false;
      }
    }
    if (command !== 'M' || args.length > 2) draws = true;
  }
  return draws;
}

function safeAttribute(name: string, value: string): boolean {
  if (value.length > 250_000) return false;
  if (numberAttributes.has(name)) return numeric(value.replace(/px$/, '')) !== undefined;
  if (opacityAttributes.has(name)) return numeric(value.replace(/%$/, '')) !== undefined;
  if (paintAttributes.has(name)) return isColor(value) || /^(?:url\(#[A-Za-z_][\w.-]*\))$/.test(value);
  if (name === 'clip-path' || name === 'mask') return value === 'none' || /^url\(#[A-Za-z_][\w.-]*\)$/.test(value);
  if (enumAttributes[name]) return enumAttributes[name].includes(value);
  if (name === 'id') return /^[A-Za-z_][\w.-]{0,127}$/.test(value);
  if (name === 'd') return validPath(value);
  if (name === 'points') { const points = numberList(value); return Boolean(points && points.length >= 4 && points.length % 2 === 0); }
  if (name === 'transform' || name === 'gradientTransform') return validTransform(value);
  if (name === 'stroke-dasharray') return value === 'none' || Boolean(numberList(value)?.every((item) => item >= 0));
  return false;
}

function hasGeometry(element: Element): boolean {
  const get = (name: string) => Number(element.getAttribute(name) ?? 0);
  switch (element.localName) {
    case 'path': return element.hasAttribute('d');
    case 'circle': return get('r') > 0;
    case 'ellipse': return get('rx') > 0 && get('ry') > 0;
    case 'rect': return get('width') > 0 && get('height') > 0;
    case 'line': return get('x1') !== get('x2') || get('y1') !== get('y2');
    case 'polygon': case 'polyline': return element.hasAttribute('points');
    default: return false;
  }
}

/** Discard inert export headers before XML parsing so external DTDs are never resolved. */
function withoutDocumentType(input: string): string {
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!\s*(DOCTYPE|ENTITY)\b/gi;
  const whitespace = '[ \\t\\r\\n]';
  const literal = '(?:"[^"]*"|\'[^\']*\')';
  const standardDoctype = new RegExp(`^<!DOCTYPE${whitespace}+svg(?:${whitespace}+(?:PUBLIC${whitespace}+${literal}${whitespace}+${literal}|SYSTEM${whitespace}+${literal}))?${whitespace}*>`);
  let start = -1;
  let end = -1;
  for (let token = tokens.exec(input); token; token = tokens.exec(input)) {
    if (!token[1]) continue; // Declaration-like text inside comments, CDATA and PIs is inert.
    if (token[1].toUpperCase() === 'ENTITY') {
      throw new Error('SVG custom entities are not supported. Export a plain SVG.');
    }
    const prolog = input.slice(0, token.index).replace(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>/g, '');
    if (start !== -1 || prolog.trim() || !/^<!DOCTYPE[ \t\r\n]+svg\b/.test(input.slice(token.index))) {
      throw new Error('The file is not a valid SVG document.');
    }
    const declaration = standardDoctype.exec(input.slice(token.index));
    if (!declaration) {
      throw new Error('SVG custom document definitions and entities are not supported. Export a plain SVG.');
    }
    start = token.index;
    end = start + declaration[0].length;
    tokens.lastIndex = end;
  }
  return start === -1 ? input : input.slice(0, start) + input.slice(end);
}

function parseSvg(input: string): Document {
  if (typeof input !== 'string' || !input.trim()) throw new Error('The SVG file is empty.');
  if (input.length > MAX_SOURCE_LENGTH) throw new Error('SVG files must be smaller than 1 MB.');
  const parsed = new DOMParser().parseFromString(withoutDocumentType(input), 'image/svg+xml');
  const root = parsed.documentElement;
  if (parsed.querySelector('parsererror') || root.localName !== 'svg'
    || (root.namespaceURI !== null && root.namespaceURI !== SVG_NS)) {
    throw new Error('The file is not a valid SVG document.');
  }
  return parsed;
}

/** Parse XML into a fresh, allowlisted SVG tree. No untrusted markup is inserted into HTML. */
export function sanitizeSvg(input: string): { svg: string; viewBox: string } {
  const source = parseSvg(input).documentElement;
  const rawViewBox = source.getAttribute('viewBox');
  const width = numeric((source.getAttribute('width') ?? '24').replace(/px$/, ''));
  const height = numeric((source.getAttribute('height') ?? '24').replace(/px$/, ''));
  const viewBox = parseViewBox(rawViewBox ?? `0 0 ${width ?? 24} ${height ?? 24}`).join(' ');
  const target = document.implementation.createDocument(SVG_NS, 'svg');
  const output = target.documentElement;
  let count = 0;
  let geometryCount = 0;
  const ids = new Set<string>();

  function copy(from: Element, into: Element, depth: number, inDefinition: boolean): void {
    if (++count > MAX_ELEMENTS || depth > MAX_DEPTH) throw new Error('The SVG contains too many elements or nested groups.');
    for (const attribute of from.attributes) {
      const { name } = attribute;
      const value = attribute.value.trim();
      if (name !== 'style' && safeAttribute(name, value)) {
        if (name !== 'id' || !ids.has(value)) {
          into.setAttribute(name, numberAttributes.has(name) ? value.replace(/px$/, '') : value);
          if (name === 'id') ids.add(value);
        }
      }
    }
    // Apply safe styles last to match SVG cascade precedence.
    if (from.hasAttribute('style')) {
      for (const rule of (from.getAttribute('style') ?? '').split(';')) {
        const colon = rule.indexOf(':');
        const property = rule.slice(0, colon).trim();
        const value = rule.slice(colon + 1).trim();
        if (colon > 0 && presentationAttributes.has(property) && safeAttribute(property, value)) into.setAttribute(property, value);
      }
    }
    if (!inDefinition && geometryElements.has(into.localName) && hasGeometry(into)) geometryCount++;
    if (into.localName === 'title' || into.localName === 'desc') {
      into.textContent = from.textContent?.slice(0, 1_000) ?? '';
      return;
    }
    for (const child of from.children) {
      // Nested SVGs have their own viewport semantics: omit rather than silently misrender them.
      if (!allowedElements.has(child.localName) || child.localName === 'svg'
        || (child.namespaceURI !== null && child.namespaceURI !== SVG_NS)) continue;
      const cloned = target.createElementNS(SVG_NS, child.localName);
      into.appendChild(cloned);
      copy(child, cloned, depth + 1, inDefinition || definitionElements.has(child.localName));
    }
  }
  copy(source, output, 0, false);
  if (!geometryCount) throw new Error('The SVG has no supported drawable geometry.');
  const elements = [output, ...output.querySelectorAll('*')];
  const byId = new Map(elements.filter((element) => element.id).map((element) => [element.id, element]));
  for (const element of elements) {
    for (const attribute of [...element.attributes]) {
      const match = /^url\(#(.+)\)$/.exec(attribute.value);
      if (!match) continue;
      const referenced = byId.get(match[1]);
      const expected = attribute.name === 'clip-path' ? ['clipPath'] : attribute.name === 'mask' ? ['mask'] : ['linearGradient', 'radialGradient'];
      // Definition-to-definition paint references are intentionally unsupported, preventing cycles.
      if (!referenced || !expected.includes(referenced.localName) || element.closest('defs,clipPath,mask,linearGradient,radialGradient')) {
        element.setAttribute(attribute.name, 'none');
      }
    }
  }
  output.setAttribute('viewBox', viewBox);
  output.setAttribute('width', '24');
  output.setAttribute('height', '24');
  return { svg: new XMLSerializer().serializeToString(output), viewBox };
}

function validateSettings(settings: SvgSettings): void {
  if (!Number.isFinite(settings.strokeWidth) || settings.strokeWidth < 0 || settings.strokeWidth > 24
    || !Number.isFinite(settings.scale) || settings.scale < 0.01 || settings.scale > 100
    || !Number.isFinite(settings.x) || Math.abs(settings.x) > 240
    || !Number.isFinite(settings.y) || Math.abs(settings.y) > 240) {
    throw new Error('SVG settings require a stroke width of 0–24, scale of 0.01–100 and offsets within ±240.');
  }
}

/**
 * Fit to a 24-unit viewport; user offsets and requested stroke widths use those same units.
 * Strokes compensate for fit/user scale; authored inner transforms retain native SVG semantics
 * (including direction-dependent stroke scaling for non-uniform transforms).
 */
export function renderSvg(svg: string, settings: SvgSettings, color?: string): string {
  validateSettings(settings);
  if (color !== undefined && (!isColor(color) || color === 'none')) throw new Error('Preview color must be a CSS color.');
  const clean = sanitizeSvg(svg);
  const source = parseSvg(clean.svg).documentElement;
  const [minX, minY, width, height] = parseViewBox(clean.viewBox);
  const fit = 24 / Math.max(width, height);
  const factor = fit * settings.scale;
  const translateX = 12 + settings.x - (minX + width / 2) * factor;
  const translateY = 12 + settings.y - (minY + height / 2) * factor;
  const target = document.implementation.createDocument(SVG_NS, 'svg');
  const output = target.documentElement;
  output.setAttribute('viewBox', '0 0 24 24');
  output.setAttribute('width', '24');
  output.setAttribute('height', '24');
  const fitGroup = target.createElementNS(SVG_NS, 'g');
  fitGroup.setAttribute('transform', `matrix(${factor} 0 0 ${factor} ${translateX} ${translateY})`);
  output.appendChild(fitGroup);
  const authoredGroup = target.createElementNS(SVG_NS, 'g');
  for (const attribute of source.attributes) {
    if (!['xmlns', 'viewBox', 'width', 'height'].includes(attribute.name)) authoredGroup.setAttribute(attribute.name, attribute.value);
  }
  for (const child of source.childNodes) authoredGroup.appendChild(target.importNode(child, true));
  fitGroup.appendChild(authoredGroup);
  const normalizedStroke = String(settings.strokeWidth / factor);
  for (const element of [authoredGroup, ...authoredGroup.querySelectorAll('*')]) {
    if (geometryElements.has(element.localName) || element.hasAttribute('stroke-width') || element === authoredGroup) {
      element.setAttribute('stroke-width', normalizedStroke);
    }
    if (color !== undefined) {
      for (const name of ['fill', 'stroke', 'color', 'stop-color']) {
        const value = element.getAttribute(name);
        if (value !== null && value !== 'none' && value !== 'transparent' && !value.startsWith('url(')) element.setAttribute(name, color);
      }
    }
  }
  if (color !== undefined) {
    authoredGroup.setAttribute('color', color);
    // An SVG with no explicit fill inherits black; the preview override must recolor that too.
    if (!authoredGroup.hasAttribute('fill')) authoredGroup.setAttribute('fill', color);
  }
  // SVG IDs share the surrounding HTML document's namespace. Give each rendered instance
  // unique IDs so two inline previews with an ordinary id="paint" cannot borrow each other's
  // gradient, clip or mask. Fresh short IDs also avoid unbounded prefixes after re-importing.
  const prefix = `fi-${++renderSequence}-`;
  const ids = new Map<string, string>();
  const elements = [authoredGroup, ...authoredGroup.querySelectorAll('*')];
  for (const element of elements) {
    const id = element.getAttribute('id');
    if (id !== null) {
      const scoped = `${prefix}${ids.size}`;
      ids.set(id, scoped);
      element.setAttribute('id', scoped);
    }
  }
  for (const element of elements) {
    for (const attribute of [...element.attributes]) {
      const referencedId = /^url\(#(.+)\)$/.exec(attribute.value)?.[1];
      const scoped = referencedId ? ids.get(referencedId) : undefined;
      if (scoped) element.setAttribute(attribute.name, `url(#${scoped})`);
    }
  }
  return new XMLSerializer().serializeToString(output);
}

/** A normal-size, single-colour preview and export, independent of comparison alignment. */
export function renderPreview(svg: string, strokeWidth: number, color: string, size: number): string {
  if (!Number.isFinite(size) || size < 16 || size > 256) throw new Error('Preview size must be 16–256 pixels.');
  const root = parseSvg(renderSvg(svg, { strokeWidth, scale: 1, x: 0, y: 0 }, color)).documentElement;
  root.setAttribute('width', String(size));
  root.setAttribute('height', String(size));
  return new XMLSerializer().serializeToString(root);
}

/** Convert package nodes through the same XML sanitizer used for user imports. */
export function serializeIcon(nodes: IconNode[], strokeWidth = 1.5, color = 'currentColor'): string {
  if (!Number.isFinite(strokeWidth) || strokeWidth < 0 || strokeWidth > 24 || !isColor(color)) throw new Error('Invalid icon stroke or color.');
  const doc = document.implementation.createDocument(SVG_NS, 'svg');
  const root = doc.documentElement;
  root.setAttribute('viewBox', '0 0 24 24');
  root.setAttribute('fill', 'none');
  root.setAttribute('color', color);
  root.setAttribute('stroke', 'currentColor');
  root.setAttribute('stroke-width', String(strokeWidth));
  // Mirror HugeiconsIcon's ordering: translucent secondary layers are painted first.
  const sorted = [...nodes].sort(([, a], [, b]) => b.opacity !== undefined ? 1 : a.opacity !== undefined ? -1 : 0);
  for (const [tag, attributes] of sorted) {
    if (!allowedElements.has(tag)) continue;
    const element = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'key') continue;
      const attribute = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      element.setAttribute(attribute, String(value));
    }
    // HugeiconsIcon applies strokeProps after node attrs. A root-only override is ineffective
    // because package nodes normally contain their own strokeWidth and stroke declarations.
    element.setAttribute('stroke-width', String(strokeWidth));
    element.setAttribute('stroke', 'currentColor');
    root.appendChild(element);
  }
  return sanitizeSvg(new XMLSerializer().serializeToString(root)).svg;
}

async function rasterize(svg: string, size: number): Promise<ImageData> {
  const clean = sanitizeSvg(svg);
  const source = parseSvg(clean.svg).documentElement;
  source.setAttribute('width', String(size));
  source.setAttribute('height', String(size));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)], { type: 'image/svg+xml' }));
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { img.src = ''; reject(new Error('SVG rasterization timed out.')); }, 10_000);
      img.onload = () => { window.clearTimeout(timer); resolve(); };
      img.onerror = () => { window.clearTimeout(timer); reject(new Error('The browser could not render this SVG.')); };
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas rendering is not available in this browser.');
    context.drawImage(img, 0, 0, size, size);
    return context.getImageData(0, 0, size, size);
  } finally {
    img.onload = img.onerror = null;
    URL.revokeObjectURL(url);
  }
}

/**
 * Alpha-weighted intersection-over-union: sum(min(alpha)) / sum(max(alpha)).
 * Transparent background contributes nothing; antialiasing and fill/stroke opacity contribute
 * proportionately. Hue is ignored both by the score and changed-pixel mask. Two empty renders
 * score zero because there is no covered geometry to establish a match.
 */
export async function compareSvg(reference: string, candidate: string, size = 256): Promise<{
  similarity: number; changedPixels: number; totalPixels: number; diffImage: string;
}> {
  if (!Number.isInteger(size) || size < 24 || size > 1024) throw new Error('Comparison size must be an integer from 24 to 1024.');
  const [left, right] = await Promise.all([rasterize(reference, size), rasterize(candidate, size)]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is not available in this browser.');
  const diff = context.createImageData(size, size);
  let intersection = 0;
  let union = 0;
  let changedPixels = 0;
  for (let offset = 0; offset < left.data.length; offset += 4) {
    const a = left.data[offset + 3];
    const b = right.data[offset + 3];
    intersection += Math.min(a, b);
    union += Math.max(a, b);
    const difference = Math.abs(a - b);
    if (difference !== 0) {
      changedPixels++;
      // Cyan = reference-only coverage; orange = candidate-only coverage.
      diff.data[offset] = a > b ? 14 : 245;
      diff.data[offset + 1] = a > b ? 165 : 115;
      diff.data[offset + 2] = a > b ? 233 : 35;
      diff.data[offset + 3] = difference;
    }
  }
  context.putImageData(diff, 0, 0);
  return { similarity: union === 0 ? 0 : intersection / union * 100, changedPixels, totalPixels: size * size, diffImage: canvas.toDataURL('image/png') };
}
