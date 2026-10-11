import { useEffect, useMemo, useState } from 'react';
import { DropdownMenu, Select } from 'radix-ui';
import type { IconEntry } from '../types';
import { ICON_STYLES, DETAIL_STYLES, FREE_STYLE, STROKE_PRESETS, previewUrl, sourceUrl, type IconStyle } from '../lib/icon-styles';
import { renderPreview } from '../lib/svg';
import { traceDescription, traceSvgUrl, findTrace, renderTrace, traceNotice, type TracedCatalog } from '../lib/traced-icons';
import { COPY_FORMATS, DOWNLOAD_FORMATS, downloadBlob, hugeiconsLicence, jsxSvg, pngBlob, type ExportFormat } from '../lib/icon-export';
import { Button } from './ui/button';
import { Modal, downloadText } from './Controls';
import { IconColorControl } from './IconColorControl';
import { IconThumbnail } from './IconThumbnail';
import { assetUrl as assetUrlForRequest } from '../lib/asset-url';
import { FrameworkCode } from './FrameworkCode';
import { componentName, componentSource } from '../lib/component-source';

function PresetSelect({ label, value, options, suffix = '', disabled, onChange }: { label: string; value: number; options: number[]; suffix?: string; disabled: boolean; onChange: (value: number) => void }) {
  return <Select.Root value={String(value)} onValueChange={value => onChange(Number(value))} disabled={disabled}><Select.Trigger className="icon-preset-trigger" aria-label={label}><Select.Value /> <Select.Icon>⌄</Select.Icon></Select.Trigger><Select.Portal><Select.Content className="icon-control-menu" position="popper" sideOffset={6}><Select.Viewport>{options.map(option => <Select.Item className="icon-menu-item" key={option} value={String(option)}><Select.ItemText>{option}{suffix}</Select.ItemText><Select.ItemIndicator aria-hidden="true">✓</Select.ItemIndicator></Select.Item>)}</Select.Viewport></Select.Content></Select.Portal></Select.Root>;
}
function ExportButton({ action, format, formats, disabled, onFormat, onExport }: { action: 'Download' | 'Copy'; format: ExportFormat; formats: readonly ExportFormat[]; disabled: boolean; onFormat: (format: ExportFormat) => void; onExport: () => void }) {
  return <div className="icon-export-button"><Button variant={action === 'Copy' ? 'outline' : 'default'} disabled={disabled} onClick={onExport}>{action} <span>{format}</span></Button><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant={action === 'Copy' ? 'outline' : 'default'} aria-label={`${action} format`} disabled={disabled}>⌄</Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="icon-control-menu" sideOffset={6} align="end"><DropdownMenu.RadioGroup value={format} onValueChange={value => onFormat(value as ExportFormat)}>{formats.map(item => <DropdownMenu.RadioItem className="icon-menu-item" value={item} key={item}>{item}<DropdownMenu.ItemIndicator aria-hidden="true">✓</DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>)}</DropdownMenu.RadioGroup></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>;
}
export default function IconDetail({ icon, style, onStyle, onClose, traces }: { traces?: TracedCatalog; icon: IconEntry; style: IconStyle; onStyle: (style: IconStyle) => void; onClose: () => void }) {
  const [source, setSource] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const [traceRender, setTraceRender] = useState({ key: '', svg: '', error: '' });
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const size = 24;
  const [stroke, setStroke] = useState(1.5);
  const [color, setColor] = useState('currentColor');
  const [alpha, setAlpha] = useState(100);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<ExportFormat>('svg stroked');
  const [copyFormat, setCopyFormat] = useState<ExportFormat>('svg stroked');
  const definition = ICON_STYLES.find(item => item.id === style)!;
  const trace = findTrace(traces, icon, style);
  const available = (style === FREE_STYLE && icon.freeAvailable !== false) || Boolean(trace);
  const assetUrl = (trace ? traceSvgUrl(trace) : undefined) ?? (style === FREE_STYLE && icon.freeAvailable !== false ? icon.localUrl : '');
  const renderKey = `${assetUrl}:${stroke}:${size}:${color}:${alpha}`;
  const traceFormats = ['svg outlined', 'png', 'react'] as const;
  const traceCopyFormats = ['svg outlined', 'png', 'jsx', 'react'] as const;
  useEffect(() => {
    if (trace) { setDownloadFormat('svg outlined'); setCopyFormat('svg outlined'); }
    else { setDownloadFormat('svg stroked'); setCopyFormat('svg stroked'); }
    setMessage('');
  }, [trace?.id, style]);
  useEffect(() => {
    const abort = new AbortController(); setSource(''); setError(''); setLoadedUrl('');
    if (!assetUrl) return () => abort.abort();
    void fetch(assetUrlForRequest(assetUrl), { signal: abort.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('image/svg+xml')) throw new Error('The SVG could not be loaded. Try again.');
      const text = await response.text(); if (!abort.signal.aborted) { setSource(text); setLoadedUrl(assetUrl); }
    }).catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load icon.'); });
    return () => abort.abort();
  }, [assetUrl, attempt]);
  useEffect(() => {
    if (!trace || !source || loadedUrl !== assetUrl) return;
    let active = true;
    void renderTrace(source, stroke, size, color, alpha, style.endsWith('sharp')).then(svg => {
      if (active) setTraceRender({ key: renderKey, svg, error: '' });
    }).catch(cause => { if (active) setTraceRender({ key: renderKey, svg: '', error: String(cause) }); });
    return () => { active = false; };
  }, [trace, source, loadedUrl, assetUrl, stroke, size, color, alpha, style, renderKey]);
  const freeRender = useMemo(() => {
    if (!source || loadedUrl !== assetUrl || trace) return { svg: '', error: '' };
    try {
      const doc = new DOMParser().parseFromString(renderPreview(source, stroke, color, size), 'image/svg+xml');
      if (alpha !== 100) doc.documentElement.setAttribute('opacity', String(alpha / 100));
      return { svg: new XMLSerializer().serializeToString(doc.documentElement), error: '' };
    } catch (cause) { return { svg: '', error: cause instanceof Error ? cause.message : 'Could not render icon.' }; }
  }, [source, loadedUrl, assetUrl, trace, size, stroke, color, alpha]);
  const rendered = trace ? traceRender.key === renderKey ? traceRender : { svg: '', error: '' } : freeRender;
  const name = componentName(trace?.name ?? icon.id, style, icon.exportName);
  async function exportIcon(copy: boolean) {
    if (!available || !rendered.svg || busy) return;
    const format = copy ? copyFormat : downloadFormat;
    setBusy(true); setMessage('');
    try {
      if (format === 'png') {
        // Start clipboard write within the click gesture (Safari requires this).
        const png = pngBlob(rendered.svg, size);
        if (copy) await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        else downloadBlob(`${icon.id}-${style}.png`, await png);
      } else {
        const licence = trace ? traceNotice(trace) : await hugeiconsLicence();
        const svg = format === 'svg outlined' && !trace ? await (await import('../lib/outline-svg')).outlineSvg(rendered.svg) : rendered.svg;
        const jsx = jsxSvg(svg);
        const content = format === 'react' ? componentSource('React', name, svg, licence)
          : format === 'jsx' ? `{/*\n${licence}\n*/}\n${jsx}\n`
          : format === 'flutter' ? componentSource('Flutter', name, svg, licence)
          : `<!--\n${licence}\n-->\n${svg}\n`;
        if (copy) await navigator.clipboard.writeText(content);
        else downloadText(`${icon.id}-${style}.${format === 'react' ? 'tsx' : 'svg'}`, content, format === 'react' ? 'text/plain' : 'image/svg+xml');
      }
      setMessage(`${format.toUpperCase()} ${copy ? 'copied' : 'downloaded'}.`);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Export failed. Try again.'); }
    finally { setBusy(false); }
  }
  function reset() { setStroke(1.5); setColor('currentColor'); setAlpha(100); setMessage(''); }
  const disabled = !available || busy || !rendered.svg || Boolean(error || rendered.error);
  return <Modal title={`${icon.name} Icon – ${definition.label}`} description={trace ? `Generated SVG · ${traceDescription(trace)}` : available ? 'Free · Stroke Rounded' : style === FREE_STYLE ? 'Free style · Reference preview' : 'Pro · Reference preview'} open onOpenChange={value => { if (!value) onClose(); }} wide>
    <div className="library-detail"><div><div className="library-stage">{!available ? <IconThumbnail key={style} url={previewUrl(icon, style, true)} size={216} alt={`${icon.name}, ${definition.label}`} testId="pro-reference-preview" /> : error || rendered.error ? <div role="alert"><p>{error || rendered.error}</p><Button variant="outline" size="sm" onClick={() => setAttempt(value => value + 1)}>Retry SVG</Button></div> : rendered.svg ? <img data-testid="icon-preview" src={`data:image/svg+xml,${encodeURIComponent(rendered.svg)}`} width={size} height={size} alt={`${icon.name}, ${definition.label}`} /> : <p>Loading artwork…</p>}</div><div className="library-detail-styles" aria-label="Choose icon style">{DETAIL_STYLES.map(id => { const item = ICON_STYLES.find(item => item.id === id)!; return <button key={id} title={item.label} aria-label={`Use ${item.label} style`} aria-pressed={style === id} onClick={() => { onStyle(id); setMessage(''); }}><IconThumbnail key={(findTrace(traces, icon, id) ? traceSvgUrl(findTrace(traces, icon, id)!) : previewUrl(icon, id))} url={(findTrace(traces, icon, id) ? traceSvgUrl(findTrace(traces, icon, id)!) : previewUrl(icon, id))} size={24} /><span>{item.label}</span>{id === FREE_STYLE && <small>FREE</small>}</button>; })}</div></div>
      <div className="library-detail-controls"><h3>Customize:</h3><div className="icon-customize-row"><PresetSelect label="Stroke" value={stroke} options={STROKE_PRESETS} disabled={!available} onChange={setStroke} /><IconColorControl color={color} alpha={alpha} disabled={!available} onChange={(next, opacity) => { setColor(next); setAlpha(opacity); }} /><Button variant="ghost" size="icon" aria-label="Reset to default" title="Reset to default" disabled={!available} onClick={reset}>↺</Button></div>
        <div className="library-export-actions"><ExportButton action="Download" format={downloadFormat} formats={trace ? traceFormats : DOWNLOAD_FORMATS} disabled={disabled} onFormat={setDownloadFormat} onExport={() => { void exportIcon(false); }} /><ExportButton action="Copy" format={copyFormat} formats={trace ? traceCopyFormats : COPY_FORMATS} disabled={disabled} onFormat={setCopyFormat} onExport={() => { void exportIcon(true); }} /></div><p className="library-export-status" role="status">{busy ? 'Preparing export…' : message}</p>
        {trace && <p className="trace-quality">{trace.sourceWidth} × {trace.sourceHeight} reference · {trace.overlap.toFixed(2)}% default alpha overlap{trace.status === 'needs-review' && <strong>Needs refinement</strong>}</p>}
        {available ? <FrameworkCode name={name} svg={rendered.svg} notice={trace ? traceNotice(trace) : undefined} customGeometry={Boolean(trace) && stroke !== 1.5} strokeWidth={trace ? undefined : stroke} /> : <div className="icon-pro-notice"><strong>{style === FREE_STYLE ? 'Free SVG unavailable for this source name' : 'SVG not generated yet'}</strong><p>{style === FREE_STYLE ? 'The source website lists this name separately; its exact artwork is not in the installed free pack.' : 'An SVG is unavailable for this variant. Its source preview may also be unavailable.'}</p><Button variant="outline" asChild><a href={sourceUrl(icon, style)} target="_blank" rel="noreferrer">View on Hugeicons ↗</a></Button></div>}
        <div className="library-provenance">{trace && <p>Generated from the public reference image. Source artwork: Hugeicons. Separate from the MIT free pack.</p>}{available && <a href={sourceUrl(icon, style)} target="_blank" rel="noreferrer">View on Hugeicons ↗</a>}</div>
      </div>
    </div>
  </Modal>;
}
