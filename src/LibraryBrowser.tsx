import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Download01Icon, Menu01Icon } from '@hugeicons/core-free-icons';
import type { Catalog, IconEntry } from './types';
import { ICON_STYLES, FREE_STYLE, isIconStyle, previewUrl, sourceSlug, type IconStyle } from './lib/icon-styles';
import { findTrace, traceSvgUrl, unpackCatalog, type TracedCatalog } from './lib/traced-icons';
import { IconThumbnail } from './components/IconThumbnail';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Modal } from './components/Controls';
import IconDetail from './components/IconDetail';
import './library.css';
import './zeus-theme.css';
import { assetUrl } from './lib/asset-url';
import { PackagesDialog } from './components/PackagesDialog';
import { ZeusHeader, ZeusSearchFab } from './components/ZeusHeader';

const PAGE_SIZE = 80;
const initial = new URLSearchParams(window.location.search);
export default function LibraryBrowser() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [traces, setTraces] = useState<TracedCatalog>();
  const [builtOnly, setBuiltOnly] = useState(initial.get('built') === '1');
  useEffect(() => {
    const abort = new AbortController();
    void fetch(assetUrl('/traced/catalog-v3.json'), { signal: abort.signal }).then(async response => {
      if (!response.ok) response = await fetch(assetUrl('/traced/catalog-v2.json'), { signal: abort.signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Could not load generated icons.');
      const data = unpackCatalog(await response.json());
      if (!abort.signal.aborted) setTraces(data);
    }).catch(() => { /* The original free collection remains available. */ });
    return () => abort.abort();
  }, []);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState(initial.get('q') ?? '');
  const deferred = useDeferredValue(query);
  const [style, setStyle] = useState<IconStyle | 'all'>(isIconStyle(initial.get('style')) ? initial.get('style') as IconStyle : 'all');
  const [category, setCategory] = useState(initial.get('category') ?? 'all');
  const [page, setPage] = useState(() => Math.max(0, Number(initial.get('page')) || 0));
  const [selected, setSelected] = useState(initial.get('selected') ?? '');
  const [selectedStyle, setSelectedStyle] = useState<IconStyle>(isIconStyle(initial.get('variant')) ? initial.get('variant') as IconStyle : FREE_STYLE);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => {
    document.querySelector('.library-discovery')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    search.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const abort = new AbortController(); setError('');
    void fetch(assetUrl('/catalog.json'), { signal: abort.signal }).then(async response => {
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('The collection could not be loaded. Try again.');
      const data = await response.json() as Catalog;
      if (!abort.signal.aborted) { setCatalog(data); setCategory(current => current === 'all' || data.categories.some(item => item.id === current) ? current : 'all'); }
    }).catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'The collection could not be loaded.'); });
    return () => abort.abort();
  }, [attempt]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !document.querySelector('[role="dialog"]')) { event.preventDefault(); search.current?.focus(); } };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  const sourceIcons = useMemo(() => {
    const icons = new Map((catalog?.icons ?? []).map(icon => [sourceSlug(icon), icon]));
    for (const entry of traces?.entries ?? []) {
      const existing = icons.get(entry.name);
      if (existing) {
        if (entry.category && (existing.categories.length !== 1 || existing.categories[0] !== entry.category)) icons.set(entry.name, { ...existing, categories: [entry.category] });
        continue;
      }
      const icon: IconEntry = { id: entry.name, name: entry.name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' '), categories: entry.category ? [entry.category] : [], sourceUrl: entry.sourceUrl, exportName: '', referenceUrl: '', localUrl: '', freeAvailable: false };
      icons.set(entry.name, icon);
    }
    return [...icons.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  }, [catalog, traces]);
  const paidBrowsing = style !== 'all' && style !== FREE_STYLE;
  const browsingIcons = builtOnly || paidBrowsing ? sourceIcons : catalog?.icons ?? [];
  const filtered = useMemo(() => {
    const terms = deferred.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const styles = ICON_STYLES.filter(item => builtOnly ? style === 'all' || item.id === style : item.id === (style === 'all' ? FREE_STYLE : style));
    return browsingIcons.filter(icon => category === 'all' || icon.categories.includes(category)).flatMap(icon => styles.filter(item => (!builtOnly || findTrace(traces, icon, item.id)) && terms.every(term => `${icon.id} ${icon.name} ${item.label} ${icon.categories.join(' ')}`.toLowerCase().includes(term))).map(item => ({ icon, style: item })));
  }, [browsingIcons, style, category, deferred, traces, builtOnly]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!builtOnly && !paidBrowsing) return counts;
    for (const icon of sourceIcons) {
      if (!builtOnly) { for (const key of ['all', ...icon.categories]) counts.set(key, (counts.get(key) ?? 0) + 1); continue; }
      for (const item of ICON_STYLES) {
        if ((style === 'all' || item.id === style) && findTrace(traces, icon, item.id)) {
          for (const key of ['all', ...icon.categories]) counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [sourceIcons, traces, builtOnly, style, paidBrowsing]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.floor(page), pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const current = sourceIcons.find(icon => icon.id === selected);
  const baseCount = catalog?.icons.length ?? 6025;
  const activeCategory = catalog?.categories.find(item => item.id === category);
  const currentStyle = ICON_STYLES.find(item => item.id === style);
  useEffect(() => {
    if (!catalog) return;
    const params = new URLSearchParams({ library: '1' });
    if (style !== 'all') params.set('style', style);
    if (builtOnly) params.set('built', '1');
    if (category !== 'all') params.set('category', category);
    if (deferred) params.set('q', deferred);
    if (safePage) params.set('page', String(safePage));
    if (current) { params.set('selected', current.id); params.set('variant', selectedStyle); }
    history.replaceState(null, '', `?${params}`);
  }, [catalog, style, category, deferred, safePage, current, selectedStyle, builtOnly]);
  function chooseCategory(id: string) { setCategory(id); setPage(0); setCategoriesOpen(false); }
  function chooseStyle(id: IconStyle | 'all') { setStyle(id); setPage(0); }
  function movePage(delta: number) { setPage(safePage + delta); document.querySelector('.library-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  return <div className="library-shell">
    <ZeusHeader onSearch={focusSearch} actions={<><Button variant="outline" size="sm" className="zeus-packages" onClick={() => setPackagesOpen(true)}>Packages</Button><Button size="sm" className="zeus-download" asChild><a href={assetUrl("/free-icons.zip")} download aria-label="Download free icons" title="6,025 Stroke Rounded SVGs with MIT attribution"><HugeiconsIcon icon={Download01Icon} /><span>Download free icons</span></a></Button></>} />
    <section className="library-discovery" aria-label="Find icons"><div className="library-search"><HugeiconsIcon icon={Search01Icon} size={22} /><Input ref={search} aria-label="Search collection" placeholder={`Search ${baseCount.toLocaleString()} icons…`} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><kbd>/</kbd></div><div className="library-style-bar" aria-label="Filter by style"><Button variant="ghost" aria-pressed={style === 'all'} onClick={() => chooseStyle('all')}>All</Button>{['Rounded', 'Standard', 'Sharp'].map(group => <div className="library-style-group" role="group" aria-label={group} key={group}><span>{group}</span>{ICON_STYLES.filter(item => item.family === group).map(item => <Button variant="ghost" key={item.id} aria-pressed={style === item.id} onClick={() => chooseStyle(item.id)}>{item.name}{item.id === FREE_STYLE && <small>Free</small>}</Button>)}</div>)}</div></section>
    <div className="library-body"><main className="library-results"><div className="library-results-heading"><div><h1>{activeCategory?.name ?? (currentStyle ? `${currentStyle.label} icons` : builtOnly ? 'Traced SVGs' : 'All icons')}</h1><p>{catalog ? `${filtered.length.toLocaleString()} icons` : 'Loading collection…'}<span>{builtOnly ? 'Built from reference images' : style === 'all' || style === FREE_STYLE ? 'Stroke Rounded · Free' : 'Pro styles'}</span></p></div><div className="library-results-actions">{traces && <Button variant="outline" size="sm" aria-pressed={builtOnly} onClick={() => { setBuiltOnly(value => !value); setPage(0); setStyle('all'); }}>{builtOnly ? 'All icons' : `Traced SVGs (${traces.count})`}</Button>}<Button variant="outline" size="sm" className="library-category-trigger" onClick={() => setCategoriesOpen(true)}><HugeiconsIcon icon={Menu01Icon} />Categories</Button>{currentStyle?.id === FREE_STYLE && <Button variant="outline" size="sm" asChild><a href={assetUrl("/free-icons.zip")} download><HugeiconsIcon icon={Download01Icon} />Free pack</a></Button>}</div></div><p className="library-origin-line">{catalog?.icons.length.toLocaleString() ?? '6,025'} free SVGs{traces ? ` · ${traces.count.toLocaleString()} image traces built` : ''}. <button onClick={() => setAboutOpen(true)}>About this collection</button></p>
      {error ? <div className="empty-state" role="alert"><strong>{error}</strong><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry collection</Button></div> : !catalog ? <div className="library-grid" aria-label="Loading icons">{Array.from({ length: 32 }, (_, index) => <div className="library-skeleton" key={index} />)}</div> : !visible.length ? <div className="empty-state"><strong>No matching icons</strong><p>Try another name, style or category.</p><Button variant="outline" onClick={() => { setQuery(''); setCategory('all'); setStyle('all'); setBuiltOnly(false); setPage(0); }}>Reset filters</Button></div> : <div className="library-grid">{visible.map(({ icon, style: item }) => <button className="library-card" key={`${icon.id}:${item.id}`} aria-label={`Preview ${icon.name}, ${item.label}`} onClick={() => { setSelected(icon.id); setSelectedStyle(item.id); }}><div><IconThumbnail key={(findTrace(traces, icon, item.id) ? traceSvgUrl(findTrace(traces, icon, item.id)!) : previewUrl(icon, item.id))} url={(findTrace(traces, icon, item.id) ? traceSvgUrl(findTrace(traces, icon, item.id)!) : previewUrl(icon, item.id))} size={36} /></div><span title={icon.name}>{icon.name}</span><small>{item.label}{item.id !== FREE_STYLE && (findTrace(traces, icon, item.id) ? ' · Traced' : ' · Reference')}</small></button>)}</div>}
      <footer className="library-pagination"><span>{filtered.length ? `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : '0 results'}</span><div><Button variant="outline" size="sm" aria-label="Previous collection page" disabled={!safePage} onClick={() => movePage(-1)}>Previous</Button><span>{safePage + 1} / {pageCount}</span><Button variant="outline" size="sm" aria-label="Next collection page" disabled={safePage + 1 === pageCount} onClick={() => movePage(1)}>Next</Button></div></footer>
    </main></div><footer className="library-footer"><a href="https://myzeusui.com/">Zeus Icons · MyZeus UI</a><a href="https://github.com/notpritam/zeus-icons">GitHub</a><span>{catalog?.icons.length.toLocaleString() ?? '6,025'} free SVGs · 10 original style names</span><a href={assetUrl("/LICENSE-hugeicons.txt")} target="_blank" rel="noreferrer">Attribution</a></footer>
    {current && <IconDetail key={current.id} icon={current} style={selectedStyle} onStyle={setSelectedStyle} traces={traces} onClose={() => setSelected('')} />}
    <PackagesDialog open={packagesOpen} onOpenChange={setPackagesOpen} />
    <ZeusSearchFab onSearch={focusSearch} />
    <Modal title="Categories" description="Browse the collection by subject." open={categoriesOpen} onOpenChange={setCategoriesOpen}><div className="library-category-dialog"><Button variant="ghost" onClick={() => chooseCategory('all')}>All icons</Button>{catalog?.categories.map(item => <Button variant="ghost" key={item.id} onClick={() => chooseCategory(item.id)}>{item.name}<span>{(builtOnly || paidBrowsing ? categoryCounts.get(item.id) ?? 0 : item.actualCount).toLocaleString()}</span></Button>)}</div></Modal>
    <Modal title="About & licence" description={`${baseCount.toLocaleString()} free Stroke Rounded SVGs.`} open={aboutOpen} onOpenChange={setAboutOpen}><div className="library-about"><p>The free pack contains the original <strong>@hugeicons/core-free-icons {catalog?.packageVersion}</strong> pack, under the MIT licence. Downloads retain its attribution.</p><p>Rounded, Standard and Sharp use Hugeicons’ original style names. The other nine styles use public images from Hugeicons. Available image traces are labelled and have their own source notices; they are separate from the MIT free pack and are approximations, not original Pro SVG files.</p><div><a href={assetUrl("/LICENSE-hugeicons.txt")} target="_blank" rel="noreferrer">Hugeicons MIT licence ↗</a><a href="https://hugeicons.com/styles" target="_blank" rel="noreferrer">Original styles ↗</a></div></div></Modal>
  </div>;
}
