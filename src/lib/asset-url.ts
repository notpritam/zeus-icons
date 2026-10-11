/** Works on the standalone preview and MyZeus UI's /icons/ static mount. */
export function assetUrl(path: string): string {
  const artwork = import.meta.env.VITE_ICON_ASSET_ORIGIN as string | undefined;
  const packages = import.meta.env.VITE_PACKAGE_ASSET_ORIGIN as string | undefined;
  if (artwork && (path.startsWith('/traced/svg/') || path.startsWith('/icons/'))) return `${artwork}${path}`;
  if (packages && /^\/packages\/.*\.(tgz|tar\.gz)$/.test(path)) return `${packages}/${path.split('/').at(-1)}`;
  return path.startsWith('/') && !path.startsWith('//') ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path;
}
