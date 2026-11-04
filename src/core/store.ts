import { create } from 'zustand';
import type { Asset, Hotspot, Mat, Part, Project, RefView, SceneSettings, Vec3 } from './types';
import { STARTER } from '../templates';
import { matte, newId, projectFromBlueprint, type Blueprint } from '../templates/kit';

export type Tool = 'select' | 'translate' | 'rotate' | 'scale';
export type CamPreset = 'hero' | 'front' | 'back' | 'side' | 'top' | 'iso' | 'selection';
export type LeftTab = 'project' | 'import' | 'templates' | 'objects';

export interface Workflow {
  explored: boolean;
  selected: boolean;
  edited: boolean;
  reviewed: boolean;
  confirmed: boolean;
}

const NO_PROGRESS: Workflow = { explored: false, selected: false, edited: false, reviewed: false, confirmed: false };

interface Notice {
  kind: 'ok' | 'error' | 'info';
  text: string;
  nonce: number;
}

export interface Store {
  project: Project;
  selectedId: string | null;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastKeyAt: number;
  dirty: boolean;
  savedAt: string | null;

  tool: Tool;
  projection: 'perspective' | 'orthographic';
  showGrid: boolean;
  showAxes: boolean;
  panMode: boolean;
  reviewMode: boolean;
  leftTab: LeftTab;
  cameraCmd: { preset: CamPreset; nonce: number };
  workflow: Workflow;
  notice: Notice | null;
  showConfirm: boolean;
  showGuide: boolean;

  commit: (fn: (p: Project) => Project, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  patchPart: (id: string, patch: Partial<Part>, coalesceKey?: string) => void;
  patchMaterial: (id: string, patch: Partial<Mat>, coalesceKey?: string) => void;
  beginTransform: () => void;
  liveTransform: (id: string, t: Pick<Part, 'position' | 'rotation' | 'scale'>) => void;
  addPart: (part: Omit<Part, 'id' | 'parentId'> & { parentId?: string | null }) => string;
  removePart: (id: string) => void;
  duplicatePart: (id: string) => void;
  resetPart: (id: string) => void;
  patchScene: (patch: Partial<SceneSettings>, coalesceKey?: string) => void;
  patchProject: (patch: Partial<Project>, coalesceKey?: string) => void;
  addAsset: (asset: Asset) => void;
  addReference: (asset: Asset, view: RefView) => void;
  setRefView: (assetId: string, view: RefView) => void;
  removeReference: (assetId: string) => void;
  applyTexture: (id: string, assetId: string | null) => void;
  addSticker: (asset: Asset) => void;
  addHotspot: (partId: string) => void;
  patchHotspot: (id: string, patch: Partial<Hotspot>) => void;
  removeHotspot: (id: string) => void;
  saveVersion: (label: string) => void;
  restoreVersion: (id: string) => void;
  loadBlueprint: (bp: Blueprint) => void;
  loadProject: (project: Project, message?: string) => void;
  markSaved: (at: string) => void;
  setUI: (patch: Partial<Pick<Store, 'tool' | 'projection' | 'showGrid' | 'showAxes' | 'panMode' | 'reviewMode' | 'leftTab' | 'showConfirm' | 'showGuide'>>) => void;
  camera: (preset: CamPreset) => void;
  mark: (step: keyof Workflow) => void;
  notify: (kind: Notice['kind'], text: string) => void;
}

const COALESCE_MS = 900;

export const descendants = (parts: Part[], id: string): Part[] => {
  const out: Part[] = [];
  const walk = (pid: string) => {
    for (const p of parts) if (p.parentId === pid) { out.push(p); walk(p.id); }
  };
  walk(id);
  return out;
};

/** The meshes an edit affects: the part itself, or everything inside a group. */
export const meshesOf = (parts: Part[], id: string): Part[] => {
  const self = parts.find((p) => p.id === id);
  if (!self) return [];
  return self.kind === 'mesh' ? [self] : descendants(parts, id).filter((p) => p.kind === 'mesh');
};

export const useStore = create<Store>((set, get) => {
  const commit: Store['commit'] = (fn, key) => {
    const s = get();
    const merge = !!key && s.lastKey === key && Date.now() - s.lastKeyAt < COALESCE_MS;
    const next = { ...fn(s.project), updatedAt: new Date().toISOString() };
    set({
      project: next,
      past: merge ? s.past : [...s.past.slice(-99), s.project],
      future: [],
      lastKey: key ?? null,
      lastKeyAt: Date.now(),
      dirty: true,
      workflow: { ...s.workflow, edited: true },
    });
  };

  const fresh = (project: Project) => ({
    project, selectedId: null, past: [], future: [], lastKey: null, reviewMode: false,
    workflow: { ...NO_PROGRESS, confirmed: false },
    cameraCmd: { preset: 'hero' as CamPreset, nonce: get().cameraCmd.nonce + 1 },
  });

  return {
    project: projectFromBlueprint(STARTER),
    selectedId: null,
    past: [],
    future: [],
    lastKey: null,
    lastKeyAt: 0,
    dirty: false,
    savedAt: null,
    tool: 'translate',
    projection: 'perspective',
    showGrid: true,
    showAxes: false,
    panMode: false,
    reviewMode: false,
    leftTab: 'objects',
    cameraCmd: { preset: 'hero', nonce: 1 },
    workflow: NO_PROGRESS,
    notice: null,
    showConfirm: false,
    showGuide: true,

    commit,
    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future], lastKey: null, dirty: true,
        selectedId: prev.parts.some((p) => p.id === s.selectedId) ? s.selectedId : null,
      });
    },
    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        project: next, past: [...s.past, s.project], future: s.future.slice(1), lastKey: null, dirty: true,
        selectedId: next.parts.some((p) => p.id === s.selectedId) ? s.selectedId : null,
      });
    },
    select: (id) => set((s) => ({ selectedId: id, workflow: id ? { ...s.workflow, selected: true } : s.workflow })),

    patchPart: (id, patch, key) =>
      commit((p) => ({ ...p, parts: p.parts.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), key),

    patchMaterial: (id, patch, key) =>
      commit((p) => {
        const ids = new Set(meshesOf(p.parts, id).map((m) => m.id));
        return {
          ...p,
          parts: p.parts.map((x) => (ids.has(x.id) && x.material ? { ...x, material: { ...x.material, ...patch } } : x)),
        };
      }, key),

    beginTransform: () => {
      const s = get();
      set({ past: [...s.past.slice(-99), s.project], future: [], lastKey: null });
    },
    liveTransform: (id, t) =>
      set((s) => ({
        dirty: true,
        workflow: { ...s.workflow, edited: true },
        project: {
          ...s.project,
          updatedAt: new Date().toISOString(),
          parts: s.project.parts.map((x) => (x.id === id ? { ...x, ...t } : x)),
        },
      })),

    addPart: (part) => {
      const id = newId();
      const made: Part = { parentId: null, ...part, id };
      commit((p) => ({ ...p, parts: [...p.parts, made], baseline: { ...p.baseline, [id]: made } }));
      set({ selectedId: id, tool: 'translate' });
      return id;
    },

    removePart: (id) => {
      commit((p) => {
        const gone = new Set([id, ...descendants(p.parts, id).map((d) => d.id)]);
        return {
          ...p,
          parts: p.parts.filter((x) => !gone.has(x.id)),
          hotspots: p.hotspots.filter((h) => !gone.has(h.partId)),
        };
      });
      set({ selectedId: null });
    },

    duplicatePart: (id) => {
      const { project } = get();
      const source = project.parts.find((p) => p.id === id);
      if (!source) return;
      const map = new Map<string, string>();
      const family = [source, ...descendants(project.parts, id)];
      family.forEach((p) => map.set(p.id, newId()));
      const copies = family.map((p): Part => ({
        ...p,
        id: map.get(p.id)!,
        name: p.id === id ? `${p.name} copy` : p.name,
        parentId: p.id === id ? p.parentId : map.get(p.parentId!)!,
        position: p.id === id ? [p.position[0] + 0.4, p.position[1], p.position[2]] : p.position,
      }));
      commit((p) => {
        const baseline = { ...p.baseline };
        copies.forEach((c) => (baseline[c.id] = c));
        return { ...p, parts: [...p.parts, ...copies], baseline };
      });
      set({ selectedId: map.get(id)! });
    },

    resetPart: (id) =>
      commit((p) => {
        const ids = new Set([id, ...descendants(p.parts, id).map((d) => d.id)]);
        return { ...p, parts: p.parts.map((x) => (ids.has(x.id) && p.baseline[x.id] ? p.baseline[x.id] : x)) };
      }),

    patchScene: (patch, key) => commit((p) => ({ ...p, scene: { ...p.scene, ...patch } }), key),
    patchProject: (patch, key) => commit((p) => ({ ...p, ...patch }), key),

    addAsset: (asset) => commit((p) => ({ ...p, assets: { ...p.assets, [asset.id]: asset } })),
    addReference: (asset, view) =>
      commit((p) => ({
        ...p,
        assets: { ...p.assets, [asset.id]: asset },
        refs: [...p.refs, { assetId: asset.id, view }],
      })),
    setRefView: (assetId, view) =>
      commit((p) => ({ ...p, refs: p.refs.map((r) => (r.assetId === assetId ? { ...r, view } : r)) })),
    removeReference: (assetId) =>
      commit((p) => {
        const used = p.parts.some((x) => x.material?.textureId === assetId);
        const assets = { ...p.assets };
        if (!used) delete assets[assetId];
        return { ...p, assets, refs: p.refs.filter((r) => r.assetId !== assetId) };
      }),

    applyTexture: (id, assetId) =>
      commit((p) => {
        const ids = new Set(meshesOf(p.parts, id).map((m) => m.id));
        return {
          ...p,
          parts: p.parts.map((x) =>
            ids.has(x.id) && x.material
              ? { ...x, material: { ...x.material, textureId: assetId, texRepeat: x.material.texRepeat ?? [1, 1], texOffset: x.material.texOffset ?? [0, 0], texRotation: x.material.texRotation ?? 0 } }
              : x,
          ),
        };
      }),

    addSticker: (asset) => {
      const aspect = asset.width / Math.max(asset.height, 1);
      const w = aspect >= 1 ? 0.8 : 0.8 * aspect;
      const h = aspect >= 1 ? 0.8 / aspect : 0.8;
      const id = get().addPart({
        name: `Sticker: ${asset.name.replace(/\.[^.]+$/, '')}`,
        kind: 'mesh',
        geo: { type: 'plane', w, h },
        material: { ...matte('#ffffff', { roughness: 0.5, doubleSided: true, cutout: true }), textureId: asset.id, texRepeat: [1, 1], texOffset: [0, 0], texRotation: 0 },
        position: [0, 1.4, 1],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
      });
      set({ selectedId: id });
    },

    addHotspot: (partId) => {
      const part = get().project.parts.find((p) => p.id === partId);
      if (!part) return;
      commit((p) => ({ ...p, hotspots: [...p.hotspots, { id: newId(), partId, label: part.name, description: '' }] }));
    },
    patchHotspot: (id, patch) =>
      commit((p) => ({ ...p, hotspots: p.hotspots.map((h) => (h.id === id ? { ...h, ...patch } : h)) }), `hot-${id}`),
    removeHotspot: (id) => commit((p) => ({ ...p, hotspots: p.hotspots.filter((h) => h.id !== id) })),

    saveVersion: (label) => {
      const { project } = get();
      commit((p) => ({
        ...p,
        versions: [
          { id: newId(), label, savedAt: new Date().toISOString(), parts: project.parts, scene: project.scene, cmPerUnit: project.cmPerUnit },
          ...p.versions,
        ].slice(0, 20),
      }));
    },
    restoreVersion: (id) => {
      const version = get().project.versions.find((v) => v.id === id);
      if (!version) return;
      commit((p) => ({ ...p, parts: version.parts, scene: version.scene, cmPerUnit: version.cmPerUnit }));
      set({ selectedId: null });
      get().camera('hero');
    },

    loadBlueprint: (bp) => {
      const { project } = get();
      set({
        ...fresh(projectFromBlueprint(bp, { assets: project.assets, refs: project.refs, name: project.name, versions: project.versions, confirmed: project.confirmed })),
        dirty: true,
      });
    },
    loadProject: (project, message) => {
      set({ ...fresh(project), dirty: false, savedAt: project.updatedAt });
      if (message) get().notify('ok', message);
    },
    markSaved: (at) => set({ dirty: false, savedAt: at }),
    setUI: (patch) => set(patch),
    camera: (preset) => set((s) => ({ cameraCmd: { preset, nonce: s.cameraCmd.nonce + 1 } })),
    mark: (step) => set((s) => (s.workflow[step] ? s : { workflow: { ...s.workflow, [step]: true } })),
    notify: (kind, text) => set((s) => ({ notice: { kind, text, nonce: (s.notice?.nonce ?? 0) + 1 } })),
  };
});

export const round = (n: number, d = 4) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
export const roundVec = (v: Vec3, d = 4): Vec3 => [round(v[0], d), round(v[1], d), round(v[2], d)];
