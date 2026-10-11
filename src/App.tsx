import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Download01Icon, Upload01Icon, Menu01Icon } from '@hugeicons/core-free-icons';
import type { Catalog, Candidate, ProjectState, SavedIcon } from './types';
import { DEFAULT_SETTINGS } from './types';
import { loadState, saveState } from './lib/storage';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import Inspector, { type ViewMode } from './components/Inspector';
import { NumberInput } from './components/NumberInput';
import ImportDialog from './components/ImportDialog';
import CoverageDialog from './components/CoverageDialog';
import ProReviewDialog from './components/ProReviewDialog';
const PAGE_SIZE = 60;
const initialQuery = new URLSearchParams(window.location.search);
type Filter = 'all' | 'imported' | 'reviewed' | 'unreviewed';
export default function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [failure, setFailure] = useState('');
  const [state, setState] = useState<ProjectState>({ version: 1, icons: {} });
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Loading workspace…');
  const [storageError, setStorageError] = useState('');
  const [category, setCategory] = useState(initialQuery.get('category') ?? 'all');
  const [query, setQuery] = useState(initialQuery.get('q') ?? '');
  const [selectedId, setSelectedId] = useState(initialQuery.get('icon') ?? '');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [proOpen, setProOpen] = useState(initialQuery.get('review') === 'pro-001');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [gridSize, setGridSize] = useState(32);
  const [view, setView] = useState<ViewMode>(() => { const requested = initialQuery.get('view'); return requested && ['preview', 'overlay', 'side', 'difference', 'image'].includes(requested) ? requested as ViewMode : 'preview'; });
  const searchInput = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  useEffect(() => {
    const abort = new AbortController();
    void fetch('/catalog.json', { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('Catalogue is unavailable. Please reload in a moment.'); return response.json() as Promise<Catalog>; }).then(data => {
      if (abort.signal.aborted) return;
      setCatalog(data);
      setSelectedId(current => data.icons.some(icon => icon.id === current) ? current : data.icons.find(icon => icon.id === 'home-01')?.id ?? data.icons[0]?.id ?? '');
      setCategory(current => current === 'all' || data.categories.some(entry => entry.id === current) ? current : 'all');
    }).catch(error => { if (!abort.signal.aborted) setFailure(error instanceof Error ? error.message : 'Could not load catalogue.'); });
    void loadState().then(saved => { if (!abort.signal.aborted) { setState(saved); setReady(true); setInitialized(true); setSaveStatus('Saved in this browser'); } }).catch(() => { if (!abort.signal.aborted) { setInitialized(true); setStorageError('Browser storage is unavailable. Export your report to keep your edits.'); setSaveStatus('Changes are not being saved.'); } });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaveStatus('Saving…');
    const timer = setTimeout(() => { void saveState(state).then(() => { setSaveStatus('Saved in this browser'); setStorageError(''); }).catch(error => { setSaveStatus('Changes are not being saved.'); setStorageError(error instanceof Error ? error.message : 'Could not save. Export your report to keep changes.'); }); }, 250);
    return () => clearTimeout(timer);
  }, [state, ready]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    function keyboard(event: KeyboardEvent) { if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); searchInput.current?.focus(); } }
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  }, []);
  useEffect(() => {
    if (!catalog) return;
    const search = new URLSearchParams({ workspace: 'compare' });
    if (selectedId) search.set('icon', selectedId);
    if (proOpen) search.set('review', 'pro-001');
    if (view !== 'preview') search.set('view', view);
    if (category !== 'all') search.set('category', category);
    if (deferredQuery) search.set('q', deferredQuery);
    history.replaceState(null, '', `?${search.toString()}`);
  }, [catalog, selectedId, category, deferredQuery, view, proOpen]);
  const filtered = useMemo(() => {
    const terms = deferredQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (catalog?.icons ?? []).filter(icon => (category === 'all' || icon.categories.includes(category)) && terms.every(term => `${icon.id} ${icon.name} ${icon.exportName}`.toLowerCase().includes(term)) && (filter === 'all' || filter === 'imported' && state.icons[icon.id]?.candidate || filter === 'reviewed' && state.icons[icon.id]?.reviewed || filter === 'unreviewed' && !state.icons[icon.id]?.reviewed));
  }, [catalog, category, deferredQuery, filter, state.icons]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const selected = catalog?.icons.find(icon => icon.id === selectedId);
  const selectedIndex = filtered.findIndex(icon => icon.id === selectedId);
  const importedCount = Object.values(state.icons).filter(value => value.candidate).length;
  const reviewedCount = Object.values(state.icons).filter(value => value.reviewed).length;
  const activeCategory = catalog?.categories.find(entry => entry.id === category);
  const coverageIssues = catalog ? catalog.coverage.missingFromPackage.length + catalog.coverage.missingFromWebsite.length + catalog.coverage.categoryMismatches.length : 0;
  function selectCategory(id: string) { setCategory(id); setPage(0); setSidebarOpen(false); const first = catalog?.icons.find(icon => id === 'all' || icon.categories.includes(id)); if (first) setSelectedId(first.id); grid.current?.scrollTo({ top: 0 }); }
  function updateIcon(value: SavedIcon) { setState(current => ({ ...current, icons: { ...current.icons, [selectedId]: value } })); }
  function importIcons(items: { id: string; candidate: Candidate }[]) {
    setState(current => { const icons = { ...current.icons }; for (const item of items) icons[item.id] = { preview: icons[item.id]?.preview, candidate: item.candidate, imageReference: icons[item.id]?.imageReference, settings: { ...DEFAULT_SETTINGS }, reviewed: false }; return { ...current, icons }; });
    setToast(`${items.length} ${items.length === 1 ? 'SVG imported' : 'SVGs imported'} and mapped.`);
    if (items[0]) { setSelectedId(items[0].id); setCategory('all'); setQuery(''); setFilter('imported'); setPage(0); }
  }
  function selectIcon(id: string) { setSelectedId(id); if (window.innerWidth < 1000) setTimeout(() => document.querySelector('.inspector')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40); }
  function navigate(delta: number) { const index = selectedIndex + delta; if (filtered[index]) { setSelectedId(filtered[index].id); setPage(Math.floor(index / PAGE_SIZE)); } }
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><Button variant="ghost" size="icon-sm" className="mobile-menu" aria-label="Open categories" onClick={() => setSidebarOpen(value => !value)}><HugeiconsIcon icon={Menu01Icon} /></Button><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><a href="/">Free Icons</a><span className="workbench-label">Workbench</span></div><div className="header-actions"><Button variant="outline" size="sm" onClick={() => setProOpen(true)} disabled={!catalog}>Pro review</Button><Button variant="ghost" size="sm" onClick={() => setCoverageOpen(true)} disabled={!catalog || !initialized}>Coverage {coverageIssues > 0 && <span className="issue-count">{coverageIssues}</span>}</Button><Button variant="outline" size="sm" className="import-action" onClick={() => setImportOpen(true)} disabled={!catalog || !initialized}><HugeiconsIcon icon={Upload01Icon} />Import SVGs</Button><Button size="sm" asChild><a href="/free-icons.zip" download><HugeiconsIcon icon={Download01Icon} /><span>Download free set</span></a></Button></div></header>
    <div className="workspace">
      {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close categories" onClick={() => setSidebarOpen(false)} />}
      <nav className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Icon categories"><div className="library-heading"><span className="library-symbol">▦</span><div><strong>Hugeicons</strong><span>Free stroke rounded</span></div><span className="free-badge">MIT</span></div><Button variant="ghost" className={`category-link all-link ${category === 'all' ? 'active' : ''}`} aria-pressed={category === 'all'} onClick={() => selectCategory('all')}><span>All icons</span><span>{catalog?.icons.length.toLocaleString() ?? '—'}</span></Button><div className="sidebar-section-title">Categories <span>{catalog?.categories.length ?? '—'}</span></div><div className="category-list">{catalog?.categories.map(entry => <Button key={entry.id} variant="ghost" className={`category-link ${category === entry.id ? 'active' : ''}`} aria-pressed={category === entry.id} onClick={() => selectCategory(entry.id)}><span>{entry.name}</span><span>{entry.actualCount}</span></Button>)}</div><div className="sidebar-footer"><div><span className="status-light" />Open source collection</div><p>Official MIT artwork.<br />Pro styles are not included.</p><a href="/LICENSE-hugeicons.txt" target="_blank" rel="noreferrer">View licence ↗</a></div></nav>
      <main className="catalogue"><div className="catalogue-intro"><div className="catalogue-breadcrumb">Library <span>/</span> Stroke rounded</div><h1>{activeCategory?.name ?? 'Free icons'}</h1><p>{activeCategory ? `${activeCategory.actualCount} icons, mapped to the original ${activeCategory.name} category.` : 'Preview and customize the free collection. Compare your SVGs when you need to.'}</p><div className="catalogue-meta"><span>{catalog?.icons.length.toLocaleString() ?? '—'} package icons</span><span>{catalog?.categories.length ?? '—'} categories</span><span>{importedCount} imported</span><span>{reviewedCount} reviewed</span></div></div>
        <div className="catalogue-tools">{storageError && <div className="storage-error" role="alert"><p>{storageError}</p><Button size="xs" variant="outline" onClick={() => setCoverageOpen(true)}>Export report</Button></div>}<div className="search-box"><HugeiconsIcon icon={Search01Icon} size={18} /><Input ref={searchInput} aria-label="Search icons" placeholder="Search icons by name…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><kbd>/</kbd></div><div className="filter-row"><div className="filter-tabs" aria-label="Filter icons">{([['all', 'All icons'], ['imported', 'Imported'], ['reviewed', 'Reviewed'], ['unreviewed', 'To review']] as const).map(([id, label]) => <Button key={id} variant="ghost" size="sm" aria-pressed={filter === id} onClick={() => { setFilter(id); setPage(0); }}>{label}</Button>)}</div><div className="grid-size"><label htmlFor="grid-size">Size</label><NumberInput id="grid-size" aria-label="Grid icon size" min={16} max={48} value={gridSize} onValueChange={setGridSize} /></div></div><div className="result-count"><span>{filtered.length.toLocaleString()} {filtered.length === 1 ? 'icon' : 'icons'}{deferredQuery ? ` matching “${deferredQuery}”` : ''}</span><span>Original category mapping</span></div></div>
        <div className="grid-scroll" ref={grid}>{failure ? <div className="empty-state" role="alert"><strong>Could not open the catalogue</strong><p>{failure}</p><Button onClick={() => window.location.reload()}>Reload catalogue</Button></div> : !catalog ? <div className="loading-grid">{Array.from({ length: 24 }, (_, index) => <div key={index} />)}</div> : visible.length === 0 ? <div className="empty-state"><HugeiconsIcon icon={Search01Icon} size={32} /><strong>No matching icons</strong><p>Try another name or category, or reset the filters.</p><Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); setCategory('all'); setPage(0); }}>Reset filters</Button></div> : <div className="icon-grid">{visible.map(icon => <button key={icon.id} className={`icon-card ${selectedId === icon.id ? 'selected' : ''}`} aria-label={`Preview ${icon.name}`} aria-pressed={selectedId === icon.id} onClick={() => selectIcon(icon.id)}><div className="icon-preview"><img src={icon.localUrl} alt="" loading="lazy" width={gridSize} height={gridSize} /></div><span className="icon-name" title={icon.name}>{icon.name}</span>{state.icons[icon.id]?.reviewed ? <span className="card-badge reviewed" title="Reviewed">✓</span> : state.icons[icon.id]?.candidate ? <span className="card-badge imported" title="Imported SVG">•</span> : null}</button>)}</div>}</div>
        <footer className="catalogue-footer"><span>{filtered.length ? `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}` : '0 icons'}</span><div><Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={safePage === 0} onClick={() => { setPage(safePage - 1); grid.current?.scrollTo({ top: 0 }); }}>‹</Button><span>{safePage + 1} / {pageCount}</span><Button variant="outline" size="icon-sm" aria-label="Next page" disabled={safePage + 1 >= pageCount} onClick={() => { setPage(safePage + 1); grid.current?.scrollTo({ top: 0 }); }}>›</Button></div></footer>
      </main>
      {selected && initialized ? <Inspector key={selected.id} icon={selected} mode={view} setMode={setView} saved={state.icons[selected.id]} onChange={updateIcon} onImport={() => setImportOpen(true)} notify={setToast} onNavigate={navigate} canPrevious={selectedIndex > 0} canNext={selectedIndex >= 0 && selectedIndex + 1 < filtered.length} /> : <aside className="inspector inspector-placeholder">{initialized ? 'Select an icon to compare.' : 'Loading saved workspace…'}</aside>}
    </div>
    <footer className="app-status"><span><i />{saveStatus}</span><span>Hugeicons free {catalog?.packageVersion ?? ''}<a href="https://hugeicons.com/icons/stroke-rounded" target="_blank" rel="noreferrer">Source catalogue ↗</a></span></footer>
    {catalog && <><ProReviewDialog open={proOpen} onOpenChange={setProOpen} icons={catalog.icons} /><ImportDialog open={importOpen} onOpenChange={setImportOpen} icons={catalog.icons} onImport={importIcons} /><CoverageDialog catalog={catalog} state={state} open={coverageOpen} onOpenChange={setCoverageOpen} /></>}
    {toast && <div className="toast" role="status">{toast}<Button variant="ghost" size="icon-xs" aria-label="Dismiss message" onClick={() => setToast('')}>×</Button></div>}
  </div>;
}
