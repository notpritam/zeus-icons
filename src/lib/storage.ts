import type { ProjectState } from '../types';

interface StorageOptions {
  databaseName?: string;
  factory?: IDBFactory;
}

const emptyState = (): ProjectState => ({ version: 1, icons: {} });

function readProject(value: unknown): ProjectState {
  if (value === undefined) return emptyState();
  if (value && typeof value === 'object' && 'version' in value && value.version === 1
    && 'icons' in value && value.icons !== null && typeof value.icons === 'object'
    && !Array.isArray(value.icons)) return value as ProjectState;
  throw new Error('Saved workspace data is invalid. Reload before saving changes.');
}

/** Property order is irrelevant: immutable React updates can rebuild the same object in a new order. */
function equal(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return leftKeys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]));
}

/** Each instance represents one tab; all instances share the same IndexedDB workspace. */
export function createStorage({ databaseName = 'free-icons-workbench', factory }: StorageOptions = {}) {
  let database: Promise<IDBDatabase> | undefined;
  let baseline: ProjectState | undefined;
  let queue: Promise<void> = Promise.resolve();

  function open(): Promise<IDBDatabase> {
    database ??= new Promise((resolve, reject) => {
      const request = (factory ?? globalThis.indexedDB).open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('project');
      request.onsuccess = () => {
        const connection = request.result;
        connection.onversionchange = () => { connection.close(); database = undefined; };
        resolve(connection);
      };
      request.onerror = () => { database = undefined; reject(request.error); };
    });
    return database;
  }

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    // A rejected save must not prevent a subsequent explicit reload or a retry.
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function loadState(): Promise<ProjectState> {
    return enqueue(async () => {
      const db = await open();
      const value = await new Promise<ProjectState>((resolve, reject) => {
        const transaction = db.transaction('project', 'readonly');
        const request = transaction.objectStore('project').get('current');
        let loaded: ProjectState;
        let failure: unknown;
        request.onsuccess = () => {
          try { loaded = readProject(request.result); }
          catch (error) { failure = error; transaction.abort(); }
        };
        transaction.oncomplete = () => resolve(loaded);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Workspace load was interrupted.'));
      });
      baseline = structuredClone(value);
      return value;
    });
  }

  async function saveState(state: ProjectState): Promise<void> {
    // Capture the call's state before waiting behind another save. Callers may keep editing.
    const next = structuredClone(state);
    return enqueue(async () => {
      if (!baseline) throw new Error('Load the workspace before saving changes.');
      const previous = baseline;
      const changed = [...new Set([...Object.keys(previous.icons), ...Object.keys(next.icons)])]
        .filter((id) => !equal(previous.icons[id], next.icons[id]));
      if (!changed.length) return;
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        // Read, conflict-check and patch in ONE readwrite transaction. IndexedDB serializes this
        // transaction against other tabs, so neither can overwrite between the check and put.
        const transaction = db.transaction('project', 'readwrite');
        const store = transaction.objectStore('project');
        const request = store.get('current');
        let failure: unknown;
        request.onsuccess = () => {
          try {
            const disk = readProject(request.result);
            const conflicts = changed.filter((id) => !equal(disk.icons[id], previous.icons[id]) && !equal(disk.icons[id], next.icons[id]));
            if (conflicts.length) {
              const names = conflicts.slice(0, 3).join(', ') + (conflicts.length > 3 ? '…' : '');
              throw new Error(`Another tab changed ${names}. Export your comparison report to keep your edits, then reload before saving.`);
            }
            const icons = { ...disk.icons };
            for (const id of changed) {
              if (Object.hasOwn(next.icons, id)) {
                Object.defineProperty(icons, id, { value: next.icons[id], enumerable: true, configurable: true, writable: true });
              } else delete icons[id];
            }
            store.put({ version: 1, icons } satisfies ProjectState, 'current');
          } catch (error) { failure = error; transaction.abort(); }
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Save was interrupted.'));
      });
      // Keep the tab's own submitted snapshot, not merged disk data: remote-only keys were never
      // present in its UI, and must not look like local deletions on that tab's next save.
      baseline = next;
    });
  }

  async function close(): Promise<void> {
    await queue;
    if (database) (await database).close();
    database = undefined;
  }

  return { loadState, saveState, close };
}

const storage = createStorage();
export const loadState = storage.loadState;
export const saveState = storage.saveState;
