/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { unpackCatalog, traceSvgUrl } from './traced-icons';

describe('compact browser catalogue', () => {
  it('preserves every icon identity, style, asset, tone metadata and review state', () => {
    const packed = JSON.parse(readFileSync('public/traced/catalog-v3.json', 'utf8'));
    const previous = unpackCatalog(JSON.parse(readFileSync('public/traced/catalog-v2.json', 'utf8')));
    const current = unpackCatalog(packed);
    expect(current.count).toBe(previous.count);
    const byId = new Map(current.entries.map(entry => [entry.id, entry]));
    expect(byId.size).toBe(previous.count);
    for (const entry of previous.entries) {
      const next = byId.get(entry.id)!;
      const { svgSha256: _hash, ...before } = entry;
      const { revision: _revision, ...after } = next;
      expect(after).toEqual(before);
      expect(traceSvgUrl(next)).toBe(`${entry.svgUrl}?v=${packed.revision}`);
    }
  });
});
