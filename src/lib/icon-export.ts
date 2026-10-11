import { assetUrl } from './asset-url';
export const DOWNLOAD_FORMATS = ['svg stroked', 'svg outlined', 'png', 'react'] as const;
export const COPY_FORMATS = ['svg stroked', 'svg outlined', 'png', 'jsx', 'react', 'flutter'] as const;
export type ExportFormat = typeof COPY_FORMATS[number];

export async function pngBlob(svg: string, size: number): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('PNG export is unavailable in this browser.');
    ctx.drawImage(image, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
export function jsxSvg(svg: string): string {
  return svg.replace(/([\w]+)-([a-z-]+)=/g, (_match, first: string, rest: string) => `${first}${rest.replace(/(^|-)([a-z])/g, (_: string, _dash: string, letter: string) => letter.toUpperCase())}=`);
}
export async function hugeiconsLicence(): Promise<string> {
  const response = await fetch(assetUrl('/LICENSE-hugeicons.txt'));
  if (!response.ok || !response.headers.get('content-type')?.includes('text/plain')) throw new Error('Licence could not be loaded. Try again.');
  return (await response.text()).trim();
}
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
