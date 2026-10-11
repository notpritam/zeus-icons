import { useEffect, useState } from 'react';
import { Modal } from './Controls';
import { Button } from './ui/button';
import { assetUrl } from '../lib/asset-url';
import { packageInstall } from '../lib/package-install';

interface PackageManifest { count: number; version: string; packages: { framework: 'React' | 'Flutter'; url: string; bytes: number }[] }
export function PackagesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [manifest, setManifest] = useState<PackageManifest>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    void fetch(assetUrl('/packages/manifest.json'), { signal: abort.signal, cache: 'no-cache' }).then(async response => {
      if (!response.ok) throw new Error('Package downloads are temporarily unavailable.');
      const data = await response.json() as PackageManifest;
      if (!abort.signal.aborted) { setManifest(data); setError(''); }
    }).catch(cause => { if (!abort.signal.aborted) setError(String(cause)); });
    return () => abort.abort();
  }, [open]);
  async function copyInstall(framework: 'React' | 'Flutter') {
    try { await navigator.clipboard.writeText(packageInstall(framework)!.command); setMessage(`${framework} install command copied.`); }
    catch { setMessage('Could not access the clipboard. Select and copy the command instead.'); }
  }
  return <Modal title="Install icon packages" description={manifest ? `${manifest.count.toLocaleString()} components · v${manifest.version}` : 'Install the collection in your project.'} open={open} onOpenChange={onOpenChange}>
    <div className="package-downloads">{error ? <p role="alert">{error}</p> : !manifest ? <p>Loading packages…</p> : manifest.packages.map(item => <section key={item.framework}><h3>{item.framework}</h3><p>{item.framework === 'React' ? 'Import a named component. Size, color, opacity, SVG props and TypeScript are included; per-icon imports keep bundles small.' : 'Use named Flutter widgets with size, color, opacity and semantics.'}</p><pre>{packageInstall(item.framework)!.command}</pre><div className="component-code-actions"><Button size="sm" onClick={() => { void copyInstall(item.framework); }}>Copy {item.framework} install</Button><Button size="sm" variant="outline" asChild><a href={assetUrl(item.url)} download>Download {item.framework} · {(item.bytes / 1024 / 1024).toFixed(1)} MB</a></Button></div><p>{packageInstall(item.framework)!.instruction}</p></section>)}<p aria-live="polite">{message}</p><p>Versioned packages are hosted on GitHub Releases. Component source is also available inside each icon.</p><p>Original free artwork retains its MIT licence. Generated artwork has separate source notices and review status in each package.</p></div>
  </Modal>;
}
