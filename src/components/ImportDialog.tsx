import { useMemo, useRef, useState } from 'react';
import type { Candidate, IconEntry } from '../types';
import { matchIconName } from '../lib/mapping';
import { sanitizeSvg } from '../lib/svg';
import { Modal } from './Controls';
import { Button } from './ui/button';
import { Input } from './ui/input';
interface ImportRow { filename: string; svg?: string; target: string; error?: string; }
export default function ImportDialog({ open, onOpenChange, icons, onImport }: { open: boolean; onOpenChange: (open: boolean) => void; icons: IconEntry[]; onImport: (items: { id: string; candidate: Candidate }[]) => void }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const available = useMemo(() => new Set(icons.map(icon => icon.id)), [icons]);
  const targets = rows.filter(row => row.svg && available.has(row.target)).map(row => row.target);
  const duplicate = new Set(targets).size !== targets.length;
  const matched = rows.filter(row => row.svg && available.has(row.target));
  async function read(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length > 7000 || list.reduce((sum, file) => sum + file.size, 0) > 60_000_000) { setError('Choose up to 7,000 SVG files, with a combined size below 60 MB.'); return; }
    setReading(true); setError('');
    const next: ImportRow[] = [];
    for (const file of list) {
      try {
        if (!file.name.toLowerCase().endsWith('.svg')) throw new Error('Choose an SVG file.');
        if (file.size > 500_000) throw new Error('This SVG is larger than 500 KB.');
        const { svg } = sanitizeSvg(await file.text());
        next.push({ filename: file.name, svg, target: matchIconName(file.name, icons)?.id ?? '' });
      } catch (cause) { next.push({ filename: file.name, target: '', error: cause instanceof Error ? cause.message : 'Could not read this file.' }); }
    }
    setRows(next); setReading(false);
  }
  return <Modal title="Import your SVGs" description="Match files to the reference catalogue by name, then check the mapping before importing." open={open} onOpenChange={onOpenChange} wide>
    <input ref={input} type="file" accept=".svg,image/svg+xml" multiple className="sr-only" aria-label="Choose SVG files" onChange={event => { if (event.target.files) void read(event.target.files); event.target.value = ''; }} />
    <button className="dropzone" disabled={reading} onClick={() => input.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void read(event.dataTransfer.files); }}><span className="drop-symbol">↥</span><strong>{reading ? 'Reading SVGs…' : 'Drop SVG files here'}</strong><span>or browse files · exact names match automatically</span></button>
    {error && <p role="alert" className="error-text">{error}</p>}
    {rows.length > 0 && <><div className="import-summary"><strong>{matched.length} of {rows.length} mapped</strong><span>{rows.length - matched.length} need attention</span></div><datalist id="catalog-targets">{icons.map(icon => <option value={icon.id} key={icon.id}>{icon.name}</option>)}</datalist><div className="mapping-table"><table><thead><tr><th>Your file</th><th>Reference icon</th><th>Status</th></tr></thead><tbody>{rows.map((row, i) => <tr key={`${i}-${row.filename}`}><td title={row.filename}>{row.filename}</td><td>{row.error ? <span className="error-text">{row.error}</span> : <Input list="catalog-targets" aria-label={`Map ${row.filename}`} placeholder="Find an icon by slug…" value={row.target} onChange={event => setRows(current => current.map((entry, index) => index === i ? { ...entry, target: event.target.value } : entry))} />}</td><td><span className={available.has(row.target) && row.svg ? 'mapped-dot' : 'unmatched-dot'} />{row.error ? 'Invalid' : available.has(row.target) ? 'Mapped' : 'Unmatched'}</td></tr>)}</tbody></table></div>{duplicate && <p role="alert" className="error-text">Two files point to the same icon. Give each file a different reference before importing.</p>}</>}
    <div className="modal-footer"><p>Only mapped files are imported. Existing local imports with the same mapping are replaced.</p><Button disabled={matched.length === 0 || duplicate || reading} onClick={() => { onImport(matched.map(row => ({ id: row.target, candidate: { svg: row.svg!, filename: row.filename, importedAt: new Date().toISOString() } }))); setRows([]); onOpenChange(false); }}>Import {matched.length || ''} {matched.length === 1 ? 'icon' : 'icons'}</Button></div>
  </Modal>;
}
