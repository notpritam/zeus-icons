import type { IconEntry } from '../types';

// These are Hugeicons' actual families and names, in the website toolbar order.
// Only Stroke Rounded is included in the installed MIT package.
export const ICON_STYLES = [
  { id: 'bulk-rounded', name: 'Bulk', family: 'Rounded', label: 'Bulk Rounded' },
  { id: 'solid-rounded', name: 'Solid', family: 'Rounded', label: 'Solid Rounded' },
  { id: 'twotone-rounded', name: 'Twotone', family: 'Rounded', label: 'Twotone Rounded' },
  { id: 'duotone-rounded', name: 'Duotone', family: 'Rounded', label: 'Duotone Rounded' },
  { id: 'stroke-rounded', name: 'Stroke', family: 'Rounded', label: 'Stroke Rounded' },
  { id: 'duotone-standard', name: 'Duotone', family: 'Standard', label: 'Duotone Standard' },
  { id: 'solid-standard', name: 'Solid', family: 'Standard', label: 'Solid Standard' },
  { id: 'stroke-standard', name: 'Stroke', family: 'Standard', label: 'Stroke Standard' },
  { id: 'solid-sharp', name: 'Solid', family: 'Sharp', label: 'Solid Sharp' },
  { id: 'stroke-sharp', name: 'Stroke', family: 'Sharp', label: 'Stroke Sharp' },
] as const;
export type IconStyle = typeof ICON_STYLES[number]['id'];
export const DETAIL_STYLES: readonly IconStyle[] = [
  'stroke-standard', 'solid-standard', 'duotone-standard', 'stroke-rounded',
  'duotone-rounded', 'twotone-rounded', 'solid-rounded', 'bulk-rounded', 'stroke-sharp', 'solid-sharp',
];
export const FREE_STYLE: IconStyle = 'stroke-rounded';
export const STROKE_PRESETS = [0.5, 1, 1.5, 2, 3];
export const SIZE_PRESETS = [16, 20, 24, 28, 32, 36, 40, 44, 48, 64, 96, 128];
export function isIconStyle(value: unknown): value is IconStyle {
  return ICON_STYLES.some(style => style.id === value);
}
export function sourceSlug(icon: IconEntry): string {
  return decodeURIComponent(new URL(icon.sourceUrl).pathname.split('/').filter(Boolean).at(-1) ?? icon.id);
}
export function sourceUrl(icon: IconEntry, style: IconStyle): string {
  return `https://hugeicons.com/icon/${encodeURIComponent(sourceSlug(icon))}?style=${style}`;
}
export function previewUrl(icon: IconEntry, style: IconStyle, large = false): string {
  return style === FREE_STYLE && icon.freeAvailable !== false ? icon.localUrl : `https://ico.hugeicons.com/${encodeURIComponent(sourceSlug(icon))}-${style}@${large ? 3 : 2}x.webp`;
}
