import type { IconEntry } from '../types';

/** Exact name normalization only. Numbers and meaningful name segments are retained. */
export function normalizeIconName(name: string): string {
  let normalized = name.split(/[\\/]/).pop()?.replace(/\.svg$/i, '') ?? '';
  normalized = normalized.normalize('NFKC').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  let previous: string;
  do {
    previous = normalized;
    normalized = normalized.replace(/(?:strokerounded|icon)$/, '');
  } while (normalized !== previous);
  return normalized;
}

/** A collision is deliberately unmapped: importing must never silently pick the wrong icon. */
export function matchIconName(filename: string, icons: IconEntry[]): IconEntry | undefined {
  const name = normalizeIconName(filename);
  if (!name) return undefined;
  const matches = icons.filter((icon) => [icon.id, icon.name, icon.exportName]
    .some((value) => normalizeIconName(value) === name));
  return matches.length === 1 ? matches[0] : undefined;
}
