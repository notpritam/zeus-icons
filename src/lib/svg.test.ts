import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HugeiconsIcon } from '@hugeicons/react';
import { AbacusIcon, AccessibilityIcon, AddCircleIcon } from '@hugeicons/core-free-icons';
import { DEFAULT_SETTINGS, type IconNode } from '../types';
import { compareSvg, renderSvg, sanitizeSvg, serializeIcon } from './svg';

const path = '<path d="M2 2L22 22"/>';
const svg = (contents = path, attributes = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${attributes}>${contents}</svg>`;
const parse = (value: string) => new DOMParser().parseFromString(value, 'image/svg+xml').documentElement;

describe('SVG import sanitizer', () => {
  it('removes active content, external resources, event handlers and unsafe CSS using XML parsing', () => {
    const imported = svg(`
      <script>alert(1)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">bad</div></foreignObject>
      <image href="https://example.com/tracker"/><use href="https://example.com/icons.svg#icon"/>
      <style>path { fill: url(https://example.com/paint); }</style>
      <a href="javascript:alert(1)"><path d="M0 0L2 2"/></a>
      <path onclick="alert(1)" d="M2 2L22 22" fill="url(https://example.com/paint)"
        style="stroke: #aabbcc; stroke-width: 2; fill-opacity: 0.4; filter: url(https://example.com/filter); background: url(https://example.com/a)"/>
    `, 'onload="alert(1)"');
    const clean = sanitizeSvg(imported).svg;
    expect(clean).not.toMatch(/script|foreignObject|image|use|onclick|onload|style=|https:\/\/example|javascript|<a[ >]/);
    const geometry = parse(clean).querySelector('path');
    expect(geometry?.getAttribute('stroke')).toBe('#aabbcc');
    expect(geometry?.getAttribute('fill-opacity')).toBe('0.4');
    expect(geometry?.getAttribute('stroke-width')).toBe('2');
  });

  it('preserves paints, opacity, valid paths and safe gradients/clipping', () => {
    const clean = parse(sanitizeSvg(svg(`
      <defs><linearGradient id="paint"><stop offset="0%" stop-color="#fff" stop-opacity="0.25"/><stop offset="100%" stop-color="#000"/></linearGradient>
      <clipPath id="clip"><circle cx="12" cy="12" r="10"/></clipPath></defs>
      <path d="M2 2 C3 4 5 6 8 9 A2 3 45 0 1 20 20 Z" fill="url(#paint)" clip-path="url(#clip)" fill-opacity=".4" stroke-opacity="50%"/>
    `)).svg);
    expect(clean.querySelector('path')?.getAttribute('fill')).toBe('url(#paint)');
    expect(clean.querySelector('path')?.getAttribute('clip-path')).toBe('url(#clip)');
    expect(clean.querySelector('path')?.getAttribute('fill-opacity')).toBe('.4');
    expect(clean.querySelector('stop')?.getAttribute('stop-opacity')).toBe('0.25');
  });

  it('removes missing and recursive definition references', () => {
    const clean = parse(sanitizeSvg(svg('<defs><clipPath id="clip"><path d="M1 1L2 2" clip-path="url(#clip)"/></clipPath></defs><path d="M2 2L22 22" fill="url(#missing)" clip-path="url(#clip)"/>')).svg);
    expect(clean.querySelector('clipPath path')?.getAttribute('clip-path')).toBe('none');
    expect(clean.lastElementChild?.getAttribute('fill')).toBe('none');
    expect(clean.lastElementChild?.getAttribute('clip-path')).toBe('url(#clip)');
  });

  it('respects inline style precedence and keeps SVG-root paint inheritance', () => {
    const clean = parse(sanitizeSvg(svg('<path style="stroke: red; fill-opacity: .3" stroke="blue" d="M1 1L5 5"/>', 'fill="none" stroke="currentColor"')).svg);
    expect(clean.getAttribute('fill')).toBe('none');
    expect(clean.getAttribute('stroke')).toBe('currentColor');
    expect(clean.querySelector('path')?.getAttribute('stroke')).toBe('red');
  });

  it.each([
    '<!DOCTYPE svg>',
    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
    "<!DOCTYPE svg SYSTEM 'https://example.com/unused.dtd'>",
    '<!DOCTYPE\nsvg\nPUBLIC\n"-//W3C//DTD SVG 1.0//EN"\n"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd"\n>',
  ])('imports standard SVG document headers without retaining a DTD: %s', (doctype) => {
    const input = `\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n<!-- Exported icon -->\n${doctype}\n${svg('<title>Home &amp; office &#35;1</title>' + path)}`;
    const clean = sanitizeSvg(input).svg;
    expect(clean).not.toMatch(/DOCTYPE|unused\.dtd|svg1[01]\.dtd/);
    expect(parse(clean).querySelector('title')?.textContent).toBe('Home & office #1');
    expect(parse(clean).querySelector('path')?.getAttribute('d')).toBe('M2 2L22 22');
    expect(() => renderSvg(input, DEFAULT_SETTINGS)).not.toThrow();
  });

  it('does not mistake comments, CDATA or processing instructions for declarations', () => {
    const input = `<?export example="<!DOCTYPE svg>"?><!-- <!ENTITY ignored "text"> -->${svg('<title><![CDATA[<!DOCTYPE svg> and <!ENTITY text>]]></title>' + path)}`;
    const clean = parse(sanitizeSvg(input).svg);
    expect(clean.querySelector('title')?.textContent).toBe('<!DOCTYPE svg> and <!ENTITY text>');
  });

  it.each([
    '<!DOCTYPE svg [<!ENTITY custom "expanded">]>',
    '<!DOCTYPE svg [<!ENTITY custom SYSTEM "file:///etc/passwd">]>',
    '<!DOCTYPE svg [<!ENTITY % remote SYSTEM "https://example.com/entity.dtd">%remote;]>',
    '<!DOCTYPE svg [<!ATTLIST svg fill CDATA "red">]>',
    '<!ENTITY custom "expanded">',
  ])('rejects custom DTD definitions before XML parsing: %s', (declaration) => {
    const parser = vi.spyOn(DOMParser.prototype, 'parseFromString');
    try {
      expect(() => sanitizeSvg(declaration + svg())).toThrow(/definitions|entities/);
      expect(parser).not.toHaveBeenCalled();
    } finally { parser.mockRestore(); }
  });

  it.each([
    `<!DOCTYPE svg><!DOCTYPE svg>${svg()}`,
    svg('<!DOCTYPE svg>' + path),
    '<!DOCTYPE html><html><body>Sign in</body></html>',
    `<!DOCTYPE svg SYSTEM "unfinished>${svg()}`,
    `<!DOCTYPE svg SYSTEM "unused.dtd">${svg('<title>&custom;</title>' + path)}`,
  ])('rejects malformed documents and unresolved entities: %s', (input) => {
    expect(() => sanitizeSvg(input)).toThrow();
  });

  it.each([
    ['', 'empty'], ['<html/>', 'valid SVG'], ['<svg><path></svg>', 'valid SVG'],
    ['<!DOCTYPE svg [<!ENTITY x "boom">]><svg>&x;</svg>', 'entities'],
    [svg('<script>bad()</script>'), 'geometry'], [svg('<path d="M2 2"/>'), 'geometry'],
    [svg('<path d="M1 1A2 3 0 4 4 5 6"/>'), 'geometry'],
    [svg('<path d="M0 0LNaN 5"/>'), 'geometry'],
    [svg('<defs><path d="M1 1L5 5"/></defs>'), 'geometry'],
    ['<svg xmlns="urn:not-svg"><path d="M1 1L5 5"/></svg>', 'valid SVG'],
    ['<svg viewBox="0 0 0 24"><path d="M1 1L5 5"/></svg>', 'viewBox'],
    ['<svg viewBox="0 0 Infinity 24"><path d="M1 1L5 5"/></svg>', 'viewBox'],
  ])('rejects invalid input %s', (input, message) => {
    expect(() => sanitizeSvg(input)).toThrow(message);
  });

  it('rejects oversized and excessively nested files', () => {
    expect(() => sanitizeSvg(' '.repeat(1_048_576) + '<svg/>')).toThrow('1 MB');
    expect(() => sanitizeSvg(svg('<g>'.repeat(65) + path + '</g>'.repeat(65)))).toThrow('nested');
  });

  it('derives a missing viewBox from physical dimensions and accepts XML with no namespace', () => {
    const clean = sanitizeSvg('<svg width="48px" height="32px"><rect width="48" height="32"/></svg>');
    expect(clean.viewBox).toBe('0 0 48 32');
    expect(parse(clean.svg).namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

describe('SVG normalization and rendering', () => {
  it('centers non-square, offset viewBoxes and applies user scale and offsets in output units', () => {
    const input = '<svg viewBox="10 20 48 24" fill="none" stroke="#123456"><path d="M10 20L58 44"/></svg>';
    const root = parse(renderSvg(input, { strokeWidth: 2, scale: 2, x: 3, y: -4 }));
    expect(root.getAttribute('viewBox')).toBe('0 0 24 24');
    // (34,32), the input center, maps to (15,8); fit=.5, user scale=2.
    expect(root.firstElementChild?.getAttribute('transform')).toBe('matrix(1 0 0 1 -19 -24)');
    expect(root.querySelector('path')?.getAttribute('stroke-width')).toBe('2');
    expect(root.querySelector('[stroke]')?.getAttribute('stroke')).toBe('#123456');
    const fitted = parse(renderSvg(input, DEFAULT_SETTINGS));
    expect(fitted.firstElementChild?.getAttribute('transform')).toBe('matrix(0.5 0 0 0.5 -5 -4)');
    expect(fitted.querySelector('path')?.getAttribute('stroke-width')).toBe('3');
    expect(fitted.querySelector('[vector-effect]')).toBeNull();
  });

  it('keeps 24-viewBox defaults geometrically identical and retains authored transforms and opacity', () => {
    const input = svg('<g transform="translate(1 2)"><path d="M2 2L20 20" opacity=".7" fill-opacity=".4" stroke-opacity=".5"/></g>', 'fill="none" stroke="currentColor" stroke-width="1.5"');
    const rendered = parse(renderSvg(input, DEFAULT_SETTINGS));
    expect(rendered.firstElementChild?.getAttribute('transform')).toBe('matrix(1 0 0 1 0 0)');
    expect(rendered.querySelector('[transform="translate(1 2)"]')).not.toBeNull();
    const geometry = rendered.querySelector('path');
    expect(geometry?.getAttribute('d')).toBe('M2 2L20 20');
    expect(geometry?.getAttribute('stroke-width')).toBe('1.5');
    expect(geometry?.getAttribute('opacity')).toBe('.7');
    expect(geometry?.getAttribute('fill-opacity')).toBe('.4');
    expect(geometry?.getAttribute('stroke-opacity')).toBe('.5');
  });

  it('overrides preview paint while preserving unpainted geometry and fill/stroke opacity', () => {
    const input = svg('<path d="M2 2L20 20" fill="none" stroke="#f00" stroke-opacity=".3"/><circle cx="12" cy="12" r="2" fill="#abc" fill-opacity=".4"/>');
    const rendered = parse(renderSvg(input, DEFAULT_SETTINGS, '#00ff00'));
    expect(rendered.querySelector('path')?.getAttribute('stroke')).toBe('#00ff00');
    expect(rendered.querySelector('path')?.getAttribute('fill')).toBe('none');
    expect(rendered.querySelector('path')?.getAttribute('stroke-opacity')).toBe('.3');
    expect(rendered.querySelector('circle')?.getAttribute('fill')).toBe('#00ff00');
    expect(rendered.querySelector('circle')?.getAttribute('fill-opacity')).toBe('.4');
    expect(parse(renderSvg(svg('<rect width="10" height="10"/>'), DEFAULT_SETTINGS, 'red')).querySelector('g g')?.getAttribute('fill')).toBe('red');
  });

  it('rejects non-finite rendering settings and external preview paint', () => {
    expect(() => renderSvg(svg(), { ...DEFAULT_SETTINGS, scale: 0 })).toThrow('settings');
    expect(() => renderSvg(svg(), { ...DEFAULT_SETTINGS, x: NaN })).toThrow('settings');
    expect(() => renderSvg(svg(), DEFAULT_SETTINGS, 'url(https://example.com)')).toThrow('color');
  });

  it('isolates inline gradient, clip and mask IDs between rendered instances', () => {
    const imported = svg('<defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient><clipPath id="clip"><circle r="10"/></clipPath><mask id="mask"><rect width="24" height="24" fill="white"/></mask></defs><rect width="24" height="24" fill="url(#paint)" clip-path="url(#clip)" mask="url(#mask)"/>');
    const left = parse(renderSvg(imported, DEFAULT_SETTINGS));
    const right = parse(renderSvg(imported, DEFAULT_SETTINGS));
    const leftIds = [...left.querySelectorAll('[id]')].map((element) => element.id);
    const rightIds = [...right.querySelectorAll('[id]')].map((element) => element.id);
    expect(leftIds.every((id) => !rightIds.includes(id))).toBe(true);
    for (const rendered of [left, right]) {
      const geometry = rendered.querySelector('g g > rect');
      expect(geometry?.getAttribute('fill')).toBe(`url(#${rendered.querySelector('linearGradient')?.id})`);
      expect(geometry?.getAttribute('clip-path')).toBe(`url(#${rendered.querySelector('clipPath')?.id})`);
      expect(geometry?.getAttribute('mask')).toBe(`url(#${rendered.querySelector('mask')?.id})`);
      expect(() => sanitizeSvg(new XMLSerializer().serializeToString(rendered))).not.toThrow();
    }
  });

  it('serializes package nodes with safe defaults and converts camelCase attributes', () => {
    const rendered = parse(serializeIcon([['path', { d: 'M2 2L22 22', strokeLinecap: 'round', fillOpacity: 0.5, key: 'abc' }]]));
    expect(rendered.getAttribute('stroke')).toBe('currentColor');
    expect(rendered.getAttribute('stroke-width')).toBe('1.5');
    expect(rendered.getAttribute('fill')).toBe('none');
    expect(rendered.querySelector('path')?.getAttribute('stroke-linecap')).toBe('round');
    expect(rendered.querySelector('path')?.getAttribute('fill-opacity')).toBe('0.5');
    expect(rendered.querySelector('[key]')).toBeNull();
  });

  it.each([0.5, 1.5, 2.5])('matches official wrapper node paints/order at stroke width %s', (strokeWidth) => {
    const opacityFixture: IconNode[] = [
      ['path', { d: 'M2 12L22 12', stroke: '#f00', strokeWidth: 1.5, strokeLinecap: 'round' }],
      ['circle', { cx: 12, cy: 12, r: 8, fill: 'currentColor', fillOpacity: 0.6, opacity: 0.3, strokeWidth: 1.5 }],
      ['rect', { x: 8, y: 8, width: 8, height: 8, fill: '#00ff00', opacity: 0.5, strokeWidth: 1.5 }],
    ];
    const fixtures: IconNode[][] = [[...AbacusIcon], [...AccessibilityIcon], [...AddCircleIcon], opacityFixture];
    const snapshot = (root: Element) => ({
      color: root.getAttribute('color'), stroke: root.getAttribute('stroke'), width: root.getAttribute('stroke-width'),
      nodes: [...root.children].map((element) => ({
        tag: element.localName,
        attributes: Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value])),
      })),
    });
    for (const nodes of fixtures) {
      const original = JSON.stringify(nodes);
      const official = parse(renderToStaticMarkup(createElement(HugeiconsIcon, { icon: nodes, strokeWidth, color: '#123456' })));
      const serialized = parse(serializeIcon(nodes, strokeWidth, '#123456'));
      expect(snapshot(serialized)).toEqual(snapshot(official));
      expect(JSON.stringify(nodes)).toBe(original);
    }
  });
});

describe('alpha coverage comparison', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function mockRaster(alphas: number[][], error = false) {
    const originalURL = URL;
    const revoke = vi.fn();
    let images = 0;
    let drawnImage = 0;
    vi.stubGlobal('URL', class extends originalURL {
      static createObjectURL = vi.fn(() => `blob:mock-${images++}`);
      static revokeObjectURL = revoke;
    });
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      imageIndex = 0;
      set src(value: string) {
        this.imageIndex = Number(value.split('-').pop());
        queueMicrotask(() => error ? this.onerror?.() : this.onload?.());
      }
    });
    const context = {
      drawImage: (img: { imageIndex: number }) => { drawnImage = img.imageIndex; },
      getImageData: () => {
        const data = new Uint8ClampedArray(24 * 24 * 4);
        for (let index = 0; index < alphas[drawnImage].length; index++) {
          data[index * 4] = drawnImage ? 255 : 0; // Deliberately different hues.
          data[index * 4 + 3] = alphas[drawnImage][index];
        }
        return { data, width: 24, height: 24, colorSpace: 'srgb' };
      },
      createImageData: () => ({ data: new Uint8ClampedArray(24 * 24 * 4) }),
      putImageData: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    return { revoke, context };
  }

  it('uses coverage IoU, ignoring empty background and RGB hue', async () => {
    const { revoke } = mockRaster([[255, 128, 0], [255, 0, 255]]);
    const result = await compareSvg(svg(), svg(), 24);
    expect(result.similarity).toBeCloseTo(255 / (255 + 128 + 255) * 100);
    expect(result.changedPixels).toBe(2);
    expect(result.totalPixels).toBe(576);
    expect(result.diffImage).toBe('data:image/png;base64,mock');
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('scores identical alpha coverage at 100 despite different RGB values', async () => {
    mockRaster([[255, 128, 0], [255, 128, 0]]);
    expect(await compareSvg(svg(), svg(), 24)).toMatchObject({ similarity: 100, changedPixels: 0 });
  });

  it('does not award an empty canvas a perfect score', async () => {
    mockRaster([[], []]);
    expect(await compareSvg(svg(), svg(), 24)).toMatchObject({ similarity: 0, changedPixels: 0 });
  });

  it('revokes blob URLs on image load errors', async () => {
    const { revoke } = mockRaster([[], []], true);
    await expect(compareSvg(svg(), svg(), 24)).rejects.toThrow('could not render');
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it('rejects abusive raster dimensions before allocating a canvas', async () => {
    await expect(compareSvg(svg(), svg(), 8192)).rejects.toThrow('24 to 1024');
  });
});
