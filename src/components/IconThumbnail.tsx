import { useState } from 'react';
import { assetUrl } from '../lib/asset-url';

// Key by URL at the call site, so a failed remote style never poisons the next preview.
export function IconThumbnail({ url, size, alt = '', testId }: { url: string; size: number; alt?: string; testId?: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="library-thumb-error" role="img" aria-label={alt || 'Preview unavailable'}>Preview unavailable</span>
    : <img data-testid={testId} src={assetUrl(url)} width={size} height={size} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
