import { lazy, Suspense } from 'react';
const LibraryBrowser = lazy(() => import('./LibraryBrowser'));
const params = new URLSearchParams(window.location.search);
// Old saved links open their icon in the same modal as collection cards.
if (params.has('workspace') || params.has('icon') || params.has('view') || params.has('review')) {
  if (!params.has('selected') && params.has('icon')) params.set('selected', params.get('icon')!);
  for (const key of ['workspace', 'icon', 'view', 'review']) params.delete(key);
  params.set('library', '1');
  history.replaceState(null, '', `?${params}`);
}
export default function Root() {
  return <Suspense fallback={<div className="empty-state">Loading icons…</div>}><LibraryBrowser /></Suspense>;
}
