import { useState } from 'react';
import { Tabs } from 'radix-ui';
import { FRAMEWORKS, componentSource, componentUsage, componentExtension, splitSvg, type Framework } from '../lib/component-source';
import { assetUrl } from '../lib/asset-url';
import { packageInstall } from '../lib/package-install';
import { hugeiconsLicence } from '../lib/icon-export';
import { Button } from './ui/button';
import { downloadText } from './Controls';

export function FrameworkCode({ name, svg, notice, customGeometry = false, strokeWidth }: { name: string; svg: string; notice?: string; customGeometry?: boolean; strokeWidth?: number }) {
  const [framework, setFramework] = useState<Framework>('React');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const settings = { ...(svg ? splitSvg(svg).defaults : { size: 24, color: 'currentColor', opacity: 1 }), strokeWidth };
  const snapshot = customGeometry || (framework !== 'React' && strokeWidth !== undefined && strokeWidth !== 1.5);
  const install = snapshot ? undefined : packageInstall(framework);
  let usage = componentUsage(framework, name, settings);
  if (snapshot && framework === 'React') usage = usage.replace(/from 'zeus-icons\/[^']+'/, `from './${name}'`).replace(`{ ${name} }`, name);
  if (snapshot && framework === 'Flutter') usage = usage.replace(/'package:zeus_icons\/[^']+'/, `'./${name}.dart'`);
  async function copyText(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage('Could not access the clipboard. Select and copy the code instead.'); }
  }
  async function exportSource(copy: boolean) {
    if (!svg || busy) return;
    setBusy(true); setMessage('');
    try {
      const source = componentSource(framework, name, svg, notice ?? await hugeiconsLicence());
      if (copy) await navigator.clipboard.writeText(source);
      else downloadText(`${name}.${componentExtension(framework)}`, source, 'text/plain');
      setMessage(`${framework} ${framework === 'Web' ? 'SVG' : 'component'} ${copy ? 'copied' : 'downloaded'}.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not export component.'); }
    finally { setBusy(false); }
  }
  return <Tabs.Root value={framework} onValueChange={value => { setFramework(value as Framework); setMessage(''); }} className="icon-code component-code">
    <h3>Use in your app</h3>
    <Tabs.List aria-label="Framework" className="icon-framework-tabs">{FRAMEWORKS.map(value => <Tabs.Trigger value={value} key={value}>{value}</Tabs.Trigger>)}</Tabs.List>
    <Tabs.Content value={framework}>
      {install && <div className="component-install"><div className="component-step-heading"><span>Install</span><a href={assetUrl(install.url)} download>Download {framework} package ↗</a></div><pre data-testid="package-install"><code>{install.command}</code></pre><p>{install.instruction}</p></div>}
      {!install && <p>{snapshot ? 'Download this component to keep your custom stroke geometry.' : `Download the ${framework === 'Web' ? 'SVG' : 'component'} below into your project.`}{framework === 'React native' ? ' Requires react-native-svg.' : framework === 'Svelte' ? ' Svelte 5.' : framework === 'Flutter' ? ' Requires flutter_svg.' : ''}</p>}
      <div className="component-step-heading"><span>Use</span></div>
      <pre data-testid="component-usage"><code>{usage}</code></pre>
      <div className="component-code-actions"><Button size="sm" disabled={!svg} onClick={() => { void copyText(usage, 'Usage'); }}>Copy usage</Button>{install && <Button size="sm" variant="outline" onClick={() => { void copyText(install.command, 'Install command'); }}>Copy install</Button>}</div>
      <details className="component-source-details" key={`${framework}:${snapshot}`} open={!install}>
        <summary>Component source</summary>
        <div className="component-code-actions"><Button size="sm" variant="outline" disabled={!svg || busy} onClick={() => { void exportSource(true); }}>Copy component</Button><Button size="sm" variant="outline" disabled={!svg || busy} onClick={() => { void exportSource(false); }}>Download component</Button></div>
        <pre data-testid="component-source"><code>{svg ? componentSource(framework, name, svg, notice ?? 'Original Hugeicons free artwork · MIT. Copy/download includes the complete licence.') : ''}</code></pre>
      </details>
      <p aria-live="polite">{message}</p>
    </Tabs.Content>
  </Tabs.Root>;
}
