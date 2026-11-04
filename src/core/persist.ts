import { PROJECT_SCHEMA, type Project } from './types';

const DB = 'venture-3d-studio';
const STORE = 'kv';
const SAVED = 'saved';
const RECOVERY = 'recovery';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Browser storage is unavailable.'));
  });
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Saving to browser storage failed.'));
  });
  db.close();
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await open();
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

export const saveProject = async (project: Project) => {
  await put(SAVED, project);
  await put(RECOVERY, project);
  navigator.storage?.persist?.().catch(() => undefined);
};

export const saveRecovery = (project: Project) => put(RECOVERY, project);

/** Returns the most recently changed copy, either the saved project or the autosave. */
export async function loadLatest(): Promise<{ project: Project; source: 'saved' | 'recovery' } | null> {
  const [saved, recovery] = await Promise.all([get<Project>(SAVED), get<Project>(RECOVERY)]);
  if (saved && recovery) {
    return recovery.updatedAt > saved.updatedAt ? { project: recovery, source: 'recovery' } : { project: saved, source: 'saved' };
  }
  if (saved) return { project: saved, source: 'saved' };
  if (recovery) return { project: recovery, source: 'recovery' };
  return null;
}

export function parseProjectFile(text: string): Project {
  let data: Partial<Project>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON, so it cannot be a Venture 3D project.');
  }
  if (data.schema !== PROJECT_SCHEMA) {
    throw new Error(`This is not a Venture 3D project file (expected schema "${PROJECT_SCHEMA}").`);
  }
  if (!Array.isArray(data.parts) || typeof data.assets !== 'object' || !data.scene) {
    throw new Error('This project file is incomplete: parts, assets or scene settings are missing.');
  }
  for (const part of data.parts) {
    const id = part.material?.textureId;
    if (id && !data.assets![id]) throw new Error(`"${part.name}" uses a texture that is missing from this file.`);
  }
  return {
    baseline: {}, refs: [], hotspots: [], versions: [], confirmed: [], displayUnit: 'cm', sourceNote: '',
    ...data,
  } as Project;
}

export function download(name: string, data: Blob | Uint8Array | string, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const safeFileName = (name: string) => name.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Venture_Project';
