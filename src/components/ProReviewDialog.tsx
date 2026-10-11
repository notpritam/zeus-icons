import { useEffect, useMemo, useState } from 'react';
import batch from '../data/pro-review.json';
import type { IconEntry } from '../types';
import { Modal, downloadText } from './Controls';
import { Button } from './ui/button';
import { Input } from './ui/input';

const storageKey = `free-icons:${batch.batch}:${batch.capturedAt}:reviewed`;
const styleNotes: Record<string, string> = {
  'solid-sharp': 'Filled shapes with crisp edges. Compare silhouette, endpoints and negative space.',
  'stroke-sharp': 'Outlined shapes with crisp edges. Compare corners and line endings to the rounded baseline.',
  'bulk-rounded': 'Rounded shapes with tones applied to fills. Look at the separation between filled regions.',
  'solid-rounded': 'Rounded, filled shapes. Compare their weight and interior cutouts to the outline baseline.',
  'twotone-rounded': 'Rounded outlines with separate tones on the strokes. Look for lighter outline segments.',
  'duotone-rounded': 'Rounded shapes with tones on both strokes and fills. Compare the shaded interior regions.',
  'duotone-standard': 'Standard contours with tones on strokes and fills. Compare the contour and the shaded regions.',
  'solid-standard': 'Filled shapes in the Standard family. Compare contour, weight and interior openings.',
  'stroke-standard': 'Outlined shapes in the Standard family. Compare contour and line endings.',
};
const focus: Record<string, string> = {
  '1st-bracket': 'Focus on the two bracket tips and their thickness. A simple pair of curves can look very similar across styles at small sizes.',
  '1st-bracket-circle': 'Focus on the circular container: outline, filled disc or shaded interior, and how the brackets remain visible inside it.',
  '1st-bracket-square': 'Focus on the square’s corners and fill, then the negative space around the brackets.',
  '24-hours-clock': 'Focus on the clock body, hand and the “24” digits. Check which elements remain outlined and which become filled.',
  '2nd-bracket': 'Focus on the bracket corners and end caps. These are subtle differences on an otherwise simple symbol.',
  '2nd-bracket-circle': 'Focus on the circle and the inner brackets separately; the container’s fill makes the style difference easier to see.',
  '2nd-bracket-square': 'Focus on the outer corners, inner bracket corners and the contrast between the container and its contents.',
  '3d-move': 'Focus on the arrowheads, axis junction and which axes use the lighter tone.',
  '3d-printer': 'Focus on the printer frame, nozzle and print bed. Compare the filled sections and internal gaps.',
  '3d-rotate': 'Focus on the circular rings and arrowheads. Check the overlaps and the separation of lighter regions.',
  '3d-scale': 'Focus on the three axes, their endpoint shapes and the central junction.',
  '3-d-view': 'Focus on the cube’s filled faces and the framing corners. This batch contains only its Solid Sharp variant.',
};
const label = (value: string) => value.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
function readReviewed(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && batch.entries.some(entry => entry.id === id)) : [];
  } catch { return []; }
}
function SourcePreview({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="pro-preview-error">Preview unavailable.<br />Open the original below.</span> : <img src={url} alt={`Pro reference: ${name}`} width={64} height={64} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
export default function ProReviewDialog({ open, onOpenChange, icons }: { open: boolean; onOpenChange: (open: boolean) => void; icons: IconEntry[] }) {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [reviewed, setReviewed] = useState(readReviewed);
  const [storageError, setStorageError] = useState(false);
  const entry = batch.entries[selected];
  const free = icons.find(icon => icon.id === entry.name);
  const matching = useMemo(() => batch.entries.filter(icon => `${icon.name} ${icon.style} ${icon.category}`.includes(query.toLowerCase().trim().replaceAll(' ', '-'))), [query]);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(reviewed)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [reviewed]);
  function toggleReviewed() { setReviewed(current => current.includes(entry.id) ? current.filter(id => id !== entry.id) : [...current, entry.id]); }
  return <Modal title="Pro review · Batch 01" description="100 paid style variants · 12 icon names · website order" open={open} onOpenChange={onOpenChange} wide>
    <div className="pro-batch-summary"><span><strong>{reviewed.length} / 100</strong> reviewed</span><span>Stroke Rounded excluded from the queue</span></div>
    <details className="pro-explainer"><summary>Why do free and Pro look similar?</summary><p>They share icon subjects. Free includes Stroke Rounded; the full collection adds nine paid combinations. Simple outlines may differ only at corners and line endings. Filled and shaded styles make the difference more visible.</p><div className="pro-style-table"><table><thead><tr><th>Family</th><th>Free</th><th>Paid variants</th></tr></thead><tbody><tr><td>Rounded</td><td>Stroke</td><td>Solid, Bulk, Duotone, Twotone</td></tr><tr><td>Standard</td><td>—</td><td>Stroke, Solid, Duotone</td></tr><tr><td>Sharp</td><td>—</td><td>Stroke, Solid</td></tr></tbody></table></div><p>Size, stroke width and color already work with the free set. Pro supplies additional artwork, Figma assets and private packages. Free is MIT licensed; Pro uses a paid seat licence and does not permit redistribution of reusable source icons.</p><p><a href="https://hugeicons.com/styles" target="_blank" rel="noreferrer">Style guide ↗</a> · <a href="https://hugeicons.com/pricing" target="_blank" rel="noreferrer">Plans ↗</a> · <a href="https://hugeicons.com/license-agreement" target="_blank" rel="noreferrer">Licence ↗</a></p></details>
    <div className="pro-review-layout">
      <div className="pro-queue"><Input aria-label="Search Pro batch" placeholder="Find a name or style…" value={query} onChange={event => setQuery(event.target.value)} /><div className="pro-queue-list" aria-label="Pro review queue">{matching.map(icon => <button key={icon.id} aria-pressed={entry.id === icon.id} onClick={() => setSelected(icon.number - 1)}><span className="pro-ordinal">{icon.number.toString().padStart(3, '0')}</span><span><strong>{label(icon.name)}</strong><small>{label(icon.style)}</small></span>{reviewed.includes(icon.id) && <span className="pro-reviewed" aria-label="Reviewed">✓</span>}</button>)}{matching.length === 0 && <p className="pro-no-results">No matching variants.</p>}</div></div>
      <section className="pro-review-detail" aria-label="Selected Pro variant"><div className="pro-entry-meta"><span>#{entry.number} / 100</span><span>{label(entry.category)}</span></div><h3>{label(entry.name)}</h3><p className="pro-style-name">{label(entry.style)} <span>PRO</span></p><div className="pro-comparison"><figure><div className="pro-preview-frame"><SourcePreview key={entry.id} url={entry.previewUrl} name={`${label(entry.name)} ${label(entry.style)}`} /></div><figcaption>Pro · {label(entry.style)}</figcaption></figure><figure><div className="pro-preview-frame">{free ? <img src={free.localUrl} alt="Free Stroke Rounded comparison" width={64} height={64} /> : <span>No free match</span>}</div><figcaption>Free · Stroke Rounded</figcaption></figure></div><p className="pro-reference-caption">Site preview beside our free package SVG. The free icon is only a comparison reference.</p><p className="pro-style-note">{styleNotes[entry.style]}</p><p className="pro-focus">{focus[entry.name]}</p><a className="pro-source-link" href={entry.sourceUrl} target="_blank" rel="noreferrer">Open this style on Hugeicons ↗</a><div className="pro-review-actions"><Button variant={reviewed.includes(entry.id) ? 'outline' : 'default'} size="sm" onClick={toggleReviewed} aria-pressed={reviewed.includes(entry.id)}>{reviewed.includes(entry.id) ? 'Reviewed ✓' : 'Mark reviewed'}</Button><div><Button variant="outline" size="icon-sm" aria-label="Previous Pro variant" disabled={selected === 0} onClick={() => setSelected(value => value - 1)}>‹</Button><Button variant="outline" size="icon-sm" aria-label="Next Pro variant" disabled={selected === batch.entries.length - 1} onClick={() => setSelected(value => value + 1)}>›</Button></div></div></section>
    </div>
    {storageError && <p role="alert">Review progress could not be saved in this browser. Download the review list to keep it.</p>}
    <div className="pro-review-footer"><p>Snapshot {batch.capturedAt.slice(0, 10)} · <a href="/?library=1&built=1">Open generated image traces ↗</a></p><Button variant="outline" size="sm" onClick={() => downloadText('pro-review-001.json', JSON.stringify({ ...batch, reviewedIds: reviewed }, null, 2))}>Download review list</Button></div>
  </Modal>;
}
