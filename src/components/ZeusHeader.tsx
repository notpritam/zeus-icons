import { useEffect, useState, type ReactNode } from 'react';

// MyZeus UI site chrome for /icons/: the same brand, navigation, search trigger and
// light/dark preference as the rest of myzeusui.com. The theme is shared through the
// site's `zeus:theme` storage key and the `dark` class on <html>.
const THEME_KEY = 'zeus:theme';
const THEME_EVENT = 'zeus:theme-change';
const LINKS = [
  ['Libraries', '/'],
  ['Components', '/components/'],
  ['Templates', '/showcase/#templates'],
  ['Icons', '/icons/'],
  ['Docs', '/foundations/'],
  ['Playground', '/playground/'],
] as const;

function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'));
    const storage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      document.documentElement.classList.toggle('dark', event.newValue === 'dark');
      sync();
    };
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(THEME_EVENT, sync); window.removeEventListener('storage', storage); };
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light'); } catch { /* private mode keeps the session choice */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#0b0d12' : '#ffffff');
    window.dispatchEvent(new Event(THEME_EVENT));
    setDark(next);
  };
  return { dark, toggle };
}

const Brand = () => <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M22 9.999V20C22 20.5523 21.5523 21 21 21H13V9.999H22ZM11 15.999V21H3C2.44772 21 2 20.5523 2 20V15.999H11ZM11 3V13.999H2V4C2 3.44772 2.44772 3 3 3H11ZM21 3C21.5523 3 22 3.44772 22 4V7.999H13V3H21Z" /></svg>;
const Moon = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M10 7C10 10.866 13.134 14 17 14C18.9584 14 20.729 13.1957 21.9995 11.8995C22 11.933 22 11.9665 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C12.0335 2 12.067 2 12.1005 2.00049C10.8043 3.27098 10 5.04157 10 7ZM4 12C4 16.4183 7.58172 20 12 20C15.0583 20 17.7158 18.2839 19.062 15.7621C18.3945 15.9187 17.7035 16 17 16C12.0294 16 8 11.9706 8 7C8 6.29648 8.08133 5.60547 8.2379 4.938C5.71611 6.28423 4 8.9417 4 12Z" /></svg>;
const Sun = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18ZM12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM11 1H13V4H11V1ZM11 20H13V23H11V20ZM3.51472 4.92893L4.92893 3.51472L7.05025 5.63604L5.63604 7.05025L3.51472 4.92893ZM16.9497 18.364L18.364 16.9497L20.4853 19.0711L19.0711 20.4853L16.9497 18.364ZM19.0711 3.51472L20.4853 4.92893L18.364 7.05025L16.9497 5.63604L19.0711 3.51472ZM5.63604 16.9497L7.05025 18.364L4.92893 20.4853L3.51472 19.0711L5.63604 16.9497ZM23 11V13H20V11H23ZM4 11V13H1V11H4Z" /></svg>;
export const SearchGlyph = ({ size = 17 }: { size?: number }) => <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z" /></svg>;

export function ZeusHeader({ onSearch, actions }: { onSearch: () => void; actions: ReactNode }) {
  const { dark, toggle } = useDarkMode();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey) { event.preventDefault(); onSearch(); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [onSearch]);
  const links = LINKS.map(([label, href]) => <a key={href} href={href} aria-current={href === '/icons/' ? 'page' : undefined}>{label}</a>);
  return <div className="zeus-bar" data-scrolled={scrolled || undefined}>
    <header className="zeus-header">
      <div className="zeus-header-start">
        <a className="zeus-brand" href="/" aria-label="Zeus UI home"><Brand /><span>Zeus UI</span></a>
        <nav className="zeus-nav" aria-label="Main navigation">{links}</nav>
      </div>
      <div className="zeus-header-end">
        <button type="button" className="zeus-search-trigger" aria-label="Search icons" aria-keyshortcuts="Meta+K Control+K" onClick={onSearch}><SearchGlyph /><span>Search</span><kbd>⌘ K</kbd></button>
        <button type="button" className="zeus-theme" aria-label={dark ? 'Use light mode' : 'Use dark mode'} title={dark ? 'Light mode' : 'Dark mode'} onClick={toggle}>{dark ? <Sun /> : <Moon />}</button>
        {actions}
      </div>
      <nav className="zeus-mobile-nav" aria-label="Mobile navigation">{links}</nav>
    </header>
  </div>;
}

/** Phones: a floating search button that steps aside while a field or dialog is active. */
export function ZeusSearchFab({ onSearch }: { onSearch: () => void }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(Boolean(document.activeElement?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]')));
    const later = () => setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', later);
    // Dialogs portal into <body>; watch for them so the button never covers one.
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true });
    return () => { document.removeEventListener('focusin', update); document.removeEventListener('focusout', later); observer.disconnect(); };
  }, []);
  return <button type="button" className="zeus-search-fab" aria-label="Open search" data-hidden={hidden || undefined} onClick={onSearch}><SearchGlyph size={22} /></button>;
}
