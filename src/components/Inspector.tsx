import { useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { IconNode, IconEntry, SavedIcon, SvgSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { compareSvg, renderPreview, renderSvg, serializeIcon } from '../lib/svg';
import { Control, downloadText } from './Controls';
import { Button } from './ui/button';
import { Input } from './ui/input';
export type ViewMode = 'preview' | 'overlay' | 'side' | 'difference' | 'image';
type Difference = Awaited<ReturnType<typeof compareSvg>>;
function SvgPreview({ svg, className = '' }: { svg: string; className?: string }) { return <div className={`svg-content ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />; }
export default function Inspector({ icon, saved, mode, setMode, onChange, onImport, notify, onNavigate, canPrevious, canNext }: { icon: IconEntry; saved?: SavedIcon; mode: ViewMode; setMode: (mode: ViewMode) => void; onChange: (value: SavedIcon) => void; onImport: () => void; notify: (message: string) => void; onNavigate: (delta: number) => void; canPrevious: boolean; canNext: boolean }) {
  const [asset, setAsset] = useState<{ id: string; nodes: IconNode[]; svg: string }>();
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [opacity, setOpacity] = useState(65);
  const [difference, setDifference] = useState<Difference>();
  const [diffError, setDiffError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const imageFile = useRef<HTMLInputElement>(null);
  const settings = saved?.settings ?? DEFAULT_SETTINGS;
  const referenceStroke = saved?.referenceStroke ?? 1.5;
  const previewSize = saved?.preview?.size ?? 64;
  const previewColor = saved?.preview?.color ?? '#252b29';
  const updatePreview = (patch: Partial<NonNullable<SavedIcon['preview']>>) => onChange({ ...saved, settings, reviewed: saved?.reviewed ?? false, preview: { size: previewSize, color: previewColor, ...patch } });
  const setReferenceStroke = (value: number) => onChange({ ...saved, settings, reviewed: false, referenceStroke: value });
  const current = asset?.id === icon.id ? asset : undefined;
  useEffect(() => {
    const abort = new AbortController();
    setAsset(undefined); setLoadError(''); setImageError(''); setImageUrl('');
    async function load() {
      const responses = await Promise.all([fetch(icon.referenceUrl, { signal: abort.signal, cache: 'no-cache' }), fetch(icon.localUrl, { signal: abort.signal, cache: 'no-cache' })]);
      if (responses.some(response => !response.ok)) throw new Error('This icon could not be loaded. Try selecting it again.');
      if (responses.some(response => /(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get('content-type') ?? ''))) {
        throw new Error('The server returned a web page instead of an icon file. Reload the workbench and try again.');
      }
      const [nodes, svg] = await Promise.all([responses[0].json() as Promise<IconNode[]>, responses[1].text()]);
      if (!abort.signal.aborted) setAsset({ id: icon.id, nodes, svg });
    }
    void load().catch(error => { if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load icon.'); });
    return () => abort.abort();
  }, [icon.id, icon.referenceUrl, icon.localUrl, loadAttempt]);
  const geometry = useMemo(() => {
    if (!current) return undefined;
    try {
      const svg = saved?.candidate?.svg ?? current.svg;
      return { reference: serializeIcon(current.nodes, referenceStroke, '#000000'), candidate: renderSvg(svg, settings), coloured: renderSvg(svg, settings, '#e3795c'), preview: renderPreview(svg, settings.strokeWidth, previewColor, previewSize) };
    } catch (cause) { return { error: cause instanceof Error ? cause.message : 'Could not render SVG.' }; }
  }, [current, saved?.candidate?.svg, settings, referenceStroke, previewColor, previewSize]);
  useEffect(() => {
    setDifference(undefined); setDiffError('');
    if (mode === 'preview' || !geometry?.reference || !geometry?.candidate) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void compareSvg(geometry.reference!, geometry.candidate!, 256).then(result => { if (!cancelled) setDifference(result); }).catch(error => { if (!cancelled) setDiffError(error instanceof Error ? error.message : 'Comparison unavailable.'); });
    }, 140);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [geometry, mode]);
  function updateSettings(patch: Partial<SvgSettings>) { onChange({ ...saved, settings: { ...settings, ...patch }, reviewed: false }); }
  function referenceImage(url: string, name: string) { setImageError(''); onChange({ ...saved, settings, reviewed: false, imageReference: { url, name } }); setMode('image'); }
  async function uploadImage(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type) || file.size > 5_000_000) { setImageError('Choose a PNG, JPEG, WebP, GIF or AVIF below 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => referenceImage(String(reader.result), file.name);
    reader.onerror = () => setImageError('Could not read the image.');
    reader.readAsDataURL(file);
  }
  function addImageUrl() {
    try {
      const url = new URL(imageUrl);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS image URL.');
      referenceImage(url.href, url.hostname);
    } catch { setImageError('Enter a valid HTTP or HTTPS image URL.'); }
  }
  async function exportSvg(copy = false) {
    if (!geometry?.candidate) return;
    try {
      let text = mode === 'preview' ? geometry.preview! : geometry.candidate;
      if (!saved?.candidate) {
        const response = await fetch('/LICENSE-hugeicons.txt');
        if (!response.ok) throw new Error('Could not load the MIT licence. Try downloading again.');
        const licence = (await response.text()).replaceAll('--', '—');
        text = `<!--\n${licence}\n-->\n${text}`;
      }
      if (copy) { await navigator.clipboard.writeText(text); notify('SVG copied.'); }
      else { downloadText(`${icon.id}.svg`, text, 'image/svg+xml'); notify('Local SVG downloaded.'); }
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not export SVG.'); }
  }
  const score = difference?.similarity;
  return <aside className="inspector" aria-label="Icon comparison">
    <div className="inspector-heading"><span className="section-label">{mode === 'preview' ? 'Icon preview' : 'Compare icon'}</span><div className="inspector-navigation"><Button variant="ghost" size="icon-xs" aria-label="Previous icon" disabled={!canPrevious} onClick={() => onNavigate(-1)}>‹</Button><Button variant="ghost" size="icon-xs" aria-label="Next icon" disabled={!canNext} onClick={() => onNavigate(1)}>›</Button></div></div>
    <div className="icon-title"><h2>{icon.name}</h2><a href={icon.sourceUrl} target="_blank" rel="noreferrer" title="Open original free icon" aria-label="Open original free icon">↗</a></div>
    <div className="icon-subtitle">Stroke rounded <span>24 × 24</span><span className="free-badge">MIT</span></div>
    <div className="view-tabs" role="tablist" aria-label="Comparison view">{([['preview', 'Preview'], ['overlay', 'Overlay'], ['side', 'Side by side'], ['difference', 'Difference'], ['image', 'Image']] as const).map(([id, label]) => <Button key={id} variant="ghost" size="sm" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}>{label}</Button>)}</div>
    <div className={`comparison-stage ${mode === 'side' ? 'stage-split' : mode === 'preview' ? 'stage-normal' : ''}`} data-testid="comparison-stage">
      {!current && !loadError && <p className="stage-message">Loading icon…</p>}
      {(loadError || geometry?.error) && <div className="stage-error"><p className="stage-message error-text" role="alert">{loadError || geometry?.error}</p>{loadError && <Button variant="outline" size="sm" onClick={() => setLoadAttempt(value => value + 1)}>Retry icon</Button>}</div>}
      {current && geometry?.candidate && <>
        {mode === 'preview' && <div className="normal-preview" data-testid="normal-preview" style={{ width: previewSize, height: previewSize }}><SvgPreview svg={geometry.preview!} /></div>}
        {mode === 'overlay' && <div className="drawing-board"><div className="svg-content"><HugeiconsIcon icon={current.nodes} size={240} strokeWidth={referenceStroke} color="#4e70bb" /></div><SvgPreview svg={geometry.coloured!} className="candidate-layer" /><style>{`.candidate-layer { opacity: ${opacity / 100}; }`}</style></div>}
        {mode === 'side' && <><div className="split-preview"><div className="mini-board"><HugeiconsIcon icon={current.nodes} size={160} strokeWidth={referenceStroke} color="#4e70bb" /></div><span>Reference</span></div><div className="split-preview"><div className="mini-board"><SvgPreview svg={geometry.coloured!} /></div><span>Local SVG</span></div></>}
        {mode === 'difference' && (difference ? <div className="drawing-board diff-board"><img src={difference.diffImage} alt="Pixel difference between source and local SVG" /></div> : <p className="stage-message">{diffError || 'Comparing coverage…'}</p>)}
        {mode === 'image' && (saved?.imageReference ? <div className="drawing-board image-board"><img referrerPolicy="no-referrer" src={saved.imageReference.url} alt={saved.imageReference.name} onError={() => setImageError('This image could not be loaded. Try uploading the file instead.')} /><div style={{ opacity: opacity / 100 }}><SvgPreview svg={geometry.coloured!} /></div></div> : <div className="image-empty"><span>▧</span><strong>Add a reference image</strong><p>Upload an image or paste its URL below, then align your SVG over it.</p></div>)}
      </>}
      <div className="stage-coordinate">{mode === 'preview' ? 'Actual size' : '0, 0'}</div><div className="stage-size">{mode === 'preview' ? `${previewSize} × ${previewSize} px` : '24 × 24'}</div>
    </div>
    {mode !== 'preview' && <>
    <div className="comparison-legend"><span><i className="reference-dot" />{mode === 'image' ? 'Reference image' : 'Hugeicons reference'}</span><span><i className="candidate-dot" />{saved?.candidate ? 'Imported SVG' : 'Local MIT copy'}</span></div>
    <div className="comparison-score" aria-live="polite"><div><span className={`score-dot ${score !== undefined && score < 99.9 ? 'score-different' : ''}`} /><strong>{mode === 'image' ? 'Visual alignment' : score === undefined ? 'Comparing…' : `${score.toFixed(2)}% shape overlap`}</strong></div><span>{mode === 'image' ? 'Image is not scored' : difference ? `${difference.changedPixels.toLocaleString()} changed pixels` : diffError || 'At 256 × 256'}</span></div>
    <p className="metric-note">{mode === 'image' ? 'Image references are visual only. Adjust scale and position to line up your SVG.' : 'Overlap measures ink coverage, not empty space. Colour is ignored.'}</p>
    </>}
    {mode === 'image' && <div className="image-controls"><input ref={imageFile} className="sr-only" aria-label="Choose reference image" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={event => { void uploadImage(event.target.files?.[0]); event.target.value = ''; }} /><Button variant="outline" size="sm" onClick={() => imageFile.current?.click()}>Upload image</Button><div className="url-input"><Input aria-label="Reference image URL" placeholder="https://…/reference.png" value={imageUrl} onChange={event => setImageUrl(event.target.value)} /><Button size="sm" variant="secondary" onClick={addImageUrl}>Load</Button></div>{saved?.imageReference && <div className="image-file"><span>{saved.imageReference.name}</span><Button variant="ghost" size="xs" onClick={() => { const next = { ...saved, settings, reviewed: false }; delete next.imageReference; onChange(next); }}>Remove</Button></div>}{imageError && <p role="alert" className="error-text">{imageError}</p>}</div>}
    {mode !== 'preview' ? <>
    <div className="adjustment-heading"><h3>Fine-tune alignment</h3><Button variant="ghost" size="xs" onClick={() => { onChange({ ...saved, settings: { ...DEFAULT_SETTINGS }, referenceStroke: 1.5, reviewed: false }); setOpacity(65); }}>Reset</Button></div>
    <div className="controls-grid"><Control label="Local stroke" value={settings.strokeWidth} min={0.25} max={4} step={0.05} suffix="px" onChange={strokeWidth => updateSettings({ strokeWidth })} /><Control label="Reference stroke" value={referenceStroke} min={0.25} max={4} step={0.05} suffix="px" onChange={setReferenceStroke} /><Control label="Scale" value={Math.round(settings.scale * 100)} min={25} max={200} step={1} suffix="%" onChange={scale => updateSettings({ scale: scale / 100 })} /><Control label="Overlay opacity" value={opacity} min={0} max={100} step={1} suffix="%" onChange={setOpacity} /><Control label="Horizontal" value={settings.x} min={-12} max={12} step={0.1} suffix="px" onChange={x => updateSettings({ x })} /><Control label="Vertical" value={settings.y} min={-12} max={12} step={0.1} suffix="px" onChange={y => updateSettings({ y })} /></div>
    </> : <section className="preview-controls" aria-label="Customize icon">
      <div className="adjustment-heading"><h3>Customize icon</h3><Button variant="ghost" size="xs" onClick={() => onChange({ ...saved, settings: { ...settings, strokeWidth: 1.5 }, reviewed: false, preview: { size: 64, color: '#252b29' } })}>Reset preview</Button></div>
      <div className="controls-grid"><Control label="Preview size" value={previewSize} min={16} max={256} step={1} suffix="px" onChange={size => updatePreview({ size })} /><Control label="Stroke width" value={settings.strokeWidth} min={0.25} max={4} step={0.05} suffix="px" onChange={strokeWidth => updateSettings({ strokeWidth })} /></div>
      <div className="preview-presets" aria-label="Common icon sizes">{[24, 32, 48, 64, 96, 128].map(size => <Button key={size} variant="outline" size="xs" aria-label={`Preview at ${size} pixels`} aria-pressed={previewSize === size} onClick={() => updatePreview({ size })}>{size}</Button>)}</div>
      <div className="preview-color"><label htmlFor="preview-color">Color</label><Input id="preview-color" type="color" aria-label="Preview color" value={previewColor} onChange={event => updatePreview({ color: event.target.value })} /><span>{previewColor}</span></div>
      <p className="preview-help">Copy or download at this size, stroke and color.</p>
    </section>}
    <div className="local-source"><div><strong>Local artwork</strong><span title={saved?.candidate?.filename}>{saved?.candidate?.filename ?? `${icon.id}.svg`}</span></div><Button variant="outline" size="sm" onClick={onImport}>Import SVG</Button></div>
    <div className="inspector-actions"><Button variant={saved?.reviewed ? 'secondary' : 'outline'} onClick={() => onChange({ ...saved, settings, reviewed: !saved?.reviewed })}>{saved?.reviewed ? '✓ Reviewed' : 'Mark reviewed'}</Button><Button disabled={!geometry?.candidate} onClick={() => { void exportSvg(); }}>Download SVG</Button></div>
    <Button className="copy-svg" variant="outline" size="sm" disabled={!geometry?.candidate} onClick={() => { void exportSvg(true); }}>Copy SVG</Button>
    <details className="svg-code"><summary>Inspect SVG</summary><pre>{(mode === 'preview' ? geometry?.preview : geometry?.candidate) ?? 'Loading…'}</pre></details>
  </aside>;
}
