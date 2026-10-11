import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { ProjectState, SavedIcon } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { createStorage } from './storage';

const icon = (x = 0, reviewed = false): SavedIcon => ({ settings: { ...DEFAULT_SETTINGS, x }, reviewed });
const project = (icons: Record<string, SavedIcon>): ProjectState => ({ version: 1, icons });

describe('workspace persistence across independent tabs', () => {
  let factory: IDBFactory;
  beforeEach(() => { factory = new IDBFactory(); });
  const client = () => createStorage({ factory });

  it('loads an empty project, saves imports/settings and restores them in another client', async () => {
    const first = client();
    expect(await first.loadState()).toEqual(project({}));
    const saved = project({ home: { ...icon(1, true), candidate: { svg: '<svg/>', filename: 'HomeIcon.svg', importedAt: '2026-10-07T00:00:00Z' } } });
    await first.saveState(saved);
    expect(await client().loadState()).toEqual(saved);
  });

  it('merges different icons from stale tabs without reverting remote-only or remote-edited keys', async () => {
    const first = client();
    const second = client();
    await first.loadState();
    await first.saveState(project({ home: icon(), mail: icon() }));
    await second.loadState();
    await first.saveState(project({ home: icon(2), mail: icon(), calendar: icon(4) }));
    await second.saveState(project({ home: icon(), mail: icon(3) }));
    expect(await client().loadState()).toEqual(project({ home: icon(2), mail: icon(3), calendar: icon(4) }));
    // The second tab still doesn't know about calendar. A later save must preserve it again.
    await second.saveState(project({ home: icon(), mail: icon(5) }));
    expect(await client().loadState()).toEqual(project({ home: icon(2), mail: icon(5), calendar: icon(4) }));
  });

  it('rejects a same-icon conflict atomically, including unrelated changes in the rejected save', async () => {
    const first = client();
    const second = client();
    await first.loadState();
    await first.saveState(project({ home: icon(), mail: icon() }));
    await second.loadState();
    await first.saveState(project({ home: icon(2), mail: icon() }));
    await expect(second.saveState(project({ home: icon(3), mail: icon(4) }))).rejects.toThrow(/Another tab changed home.*Export.*reload/);
    expect(await client().loadState()).toEqual(project({ home: icon(2), mail: icon() }));
    // Failure keeps the stale baseline, so retrying does not quietly overwrite the winner.
    await expect(second.saveState(project({ home: icon(3) }))).rejects.toThrow('Another tab changed home');
    await second.loadState();
    await second.saveState(project({ home: icon(3), mail: icon() }));
    expect((await client().loadState()).icons.home.settings.x).toBe(3);
  });

  it('serializes simultaneous same-icon writes across tabs and lets exactly one win', async () => {
    const first = client();
    const second = client();
    await Promise.all([first.loadState(), second.loadState()]);
    const results = await Promise.allSettled([
      first.saveState(project({ home: icon(1) })),
      second.saveState(project({ home: icon(2) })),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect([1, 2]).toContain((await client().loadState()).icons.home.settings.x);
  });

  it('queues saves in one tab and captures each call before caller-side mutations', async () => {
    const first = client();
    await first.loadState();
    const one = project({ home: icon(1) });
    const two = project({ home: icon(2) });
    const savingOne = first.saveState(one);
    const savingTwo = first.saveState(two);
    one.icons.home.settings.x = 99;
    two.icons.home.settings.x = 99;
    await Promise.all([savingOne, savingTwo]);
    expect((await client().loadState()).icons.home.settings.x).toBe(2);
  });

  it('accepts identical concurrent edits and property-order differences without false conflicts', async () => {
    const first = client();
    const second = client();
    await Promise.all([first.loadState(), second.loadState()]);
    await first.saveState(project({ home: icon(2, true) }));
    const same = { reviewed: true, settings: { y: 0, x: 2, scale: 1, strokeWidth: 1.5 } };
    await expect(second.saveState(project({ home: same }))).resolves.toBeUndefined();
    expect(await client().loadState()).toEqual(project({ home: icon(2, true) }));
  });

  it('persists removal of candidate fields without discarding another tab’s icon', async () => {
    const first = client();
    const second = client();
    await first.loadState();
    await first.saveState(project({ home: { ...icon(), candidate: { svg: '<svg/>', filename: 'home.svg', importedAt: '' } } }));
    await second.loadState();
    await first.saveState(project({ home: { ...icon(), candidate: { svg: '<svg/>', filename: 'home.svg', importedAt: '' } }, mail: icon(2) }));
    await second.saveState(project({ home: icon() }));
    expect(await client().loadState()).toEqual(project({ home: icon(), mail: icon(2) }));
  });

  it('does not overwrite remote edits when autosaving an unchanged local snapshot', async () => {
    const first = client();
    const second = client();
    await first.loadState();
    await first.saveState(project({ home: icon() }));
    const stale = await second.loadState();
    await first.saveState(project({ home: icon(4) }));
    await second.saveState(stale);
    expect((await client().loadState()).icons.home.settings.x).toBe(4);
  });

  it('isolates the baseline from mutations to the object returned by loadState', async () => {
    const first = client();
    await first.loadState();
    await first.saveState(project({ home: icon() }));
    const loaded = await first.loadState();
    loaded.icons.home.settings.x = 3;
    await first.saveState(loaded);
    expect((await client().loadState()).icons.home.settings.x).toBe(3);
  });

  it('requires initialization instead of saving an unknown baseline over existing data', async () => {
    await expect(client().saveState(project({ home: icon() }))).rejects.toThrow('Load the workspace');
  });
});
