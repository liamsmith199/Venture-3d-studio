import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Copy, Focus, Lock, MapPin, RotateCcw, Trash2, Unlock, Upload } from 'lucide-react';
import { assetFromFile } from '../core/assets';
import { LIGHT_PRESETS } from '../core/build';
import { meshesOf, round, useStore } from '../core/store';
import type { Geo, LightPreset, Mat, Part, Vec3 } from '../core/types';
import { ColorField, NumberField, Section, Slider } from './ui';
import { live } from './Viewport';

const MATERIAL_PRESETS: { label: string; patch: Partial<Mat>; swatch: string }[] = [
  { label: 'Matte', patch: { roughness: 0.85, metalness: 0, opacity: 1 }, swatch: 'linear-gradient(135deg,#a8b0ad,#8b9390)' },
  { label: 'Glossy', patch: { roughness: 0.15, metalness: 0, opacity: 1 }, swatch: 'radial-gradient(circle at 30% 25%,#fff,#6d9a8c 45%,#3e5f55)' },
  { label: 'Ceramic', patch: { roughness: 0.28, metalness: 0, opacity: 1 }, swatch: 'radial-gradient(circle at 30% 25%,#fff,#ece7dc 55%,#c8c2b4)' },
  { label: 'Fabric', patch: { roughness: 1, metalness: 0, opacity: 1 }, swatch: 'repeating-linear-gradient(45deg,#8f8a80,#8f8a80 2px,#a39e93 2px,#a39e93 4px)' },
  { label: 'Metal', patch: { roughness: 0.22, metalness: 1, opacity: 1 }, swatch: 'linear-gradient(135deg,#eef1f4,#7b838b 50%,#d8dde1)' },
  { label: 'Brushed', patch: { roughness: 0.5, metalness: 0.9, opacity: 1 }, swatch: 'repeating-linear-gradient(90deg,#aab0b5,#aab0b5 1px,#94999e 1px,#94999e 3px)' },
  { label: 'Gold', patch: { color: '#d9a441', roughness: 0.25, metalness: 1, opacity: 1 }, swatch: 'linear-gradient(135deg,#f8e29a,#b98526 55%,#efd27f)' },
  { label: 'Glass', patch: { roughness: 0.08, metalness: 0, opacity: 0.35 }, swatch: 'linear-gradient(135deg,#ffffff66,#a6d8e888)' },
];

const PALETTE = ['#f6f6f3', '#2e2120', '#7fdcb4', '#1f3a78', '#d9191f', '#2fa34a', '#ffb627', '#7b4a2c', '#3b82f6', '#a855f7', '#ec4899', '#111827'];

const BACKGROUNDS: { label: string; top: string; bottom: string }[] = [
  { label: 'Mint', top: '#f4fcf8', bottom: '#d5ebe0' },
  { label: 'White', top: '#ffffff', bottom: '#eceeee' },
  { label: 'Sky', top: '#eaf4ff', bottom: '#c3dbf5' },
  { label: 'Peach', top: '#fff4ec', bottom: '#f6d5c1' },
  { label: 'Slate', top: '#3a4453', bottom: '#1b222c' },
  { label: 'Ink', top: '#1a2030', bottom: '#090c14' },
];

const GEO_FIELDS: Partial<Record<Geo['type'], [string, string][]>> = {
  box: [['w', 'Width'], ['h', 'Height'], ['d', 'Depth'], ['radius', 'Corner softness']],
  sphere: [['r', 'Radius']],
  cylinder: [['rTop', 'Top radius'], ['rBottom', 'Bottom radius'], ['h', 'Height']],
  cone: [['r', 'Base radius'], ['h', 'Height']],
  torus: [['r', 'Ring radius'], ['tube', 'Thickness']],
  torusKnot: [['r', 'Radius'], ['tube', 'Thickness']],
  capsule: [['r', 'Radius'], ['h', 'Length']],
  plane: [['w', 'Width'], ['h', 'Height']],
  tube: [['r', 'Thickness']],
  extrude: [['depth', 'Depth']],
};

function useSizeOf(id: string | null, deps: unknown[]) {
  const [size, setSize] = useState<Vec3 | null>(null);
  useEffect(() => {
    const measure = () => {
      const obj = id ? live.objects.get(id) : live.root;
      if (!obj) return setSize(null);
      const box = new THREE.Box3().setFromObject(obj);
      if (box.isEmpty()) return setSize(null);
      const v = box.getSize(new THREE.Vector3());
      setSize([v.x, v.y, v.z]);
    };
    measure();
    // The 3D scene applies edits a moment after the panel updates, so measure again.
    const t = setTimeout(measure, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ...deps]);
  return size;
}

export function Inspector() {
  const selected = useStore((s) => s.project.parts.find((p) => p.id === s.selectedId) ?? null);
  return (
    <aside className="panel right">
      <div className="panel-scroll">
        {selected ? <PartPanels part={selected} /> : <NoSelection />}
        <LightingPanel />
      </div>
    </aside>
  );
}

function NoSelection() {
  const parts = useStore((s) => s.project.parts);
  const cmPerUnit = useStore((s) => s.project.cmPerUnit);
  const unit = useStore((s) => s.project.displayUnit);
  const size = useSizeOf(null, [parts, cmPerUnit]);
  const f = (unit === 'in' ? 1 / 2.54 : 1) * cmPerUnit;
  return (
    <>
      <div className="empty-card">
        <b>Nothing selected</b>
        <p>Click any part of the model, or choose one in the Objects list, to change it. Click again to step into smaller pieces.</p>
      </div>
      {size && (
        <Section title="Whole model size">
          <div className="dim-read" data-testid="model-size">
            <span><em>W</em>{round(size[0] * f, 1)}</span><span><em>H</em>{round(size[1] * f, 1)}</span><span><em>D</em>{round(size[2] * f, 1)}</span><b>{unit}</b>
          </div>
        </Section>
      )}
    </>
  );
}

function PartPanels({ part }: { part: Part }) {
  const project = useStore((s) => s.project);
  const { patchPart, removePart, duplicatePart, resetPart, addHotspot, camera } = useStore.getState();
  const [locked, setLocked] = useState(true);
  const unit = project.displayUnit;
  const unitF = (unit === 'in' ? 1 / 2.54 : 1) * project.cmPerUnit;
  const size = useSizeOf(part.id, [part, project.parts, project.cmPerUnit]);

  const setPos = (i: number, shown: number) => {
    const position = [...part.position] as Vec3;
    position[i] = round(shown / unitF, 4);
    patchPart(part.id, { position }, `pos-${part.id}-${i}`);
  };
  const setRot = (i: number, deg: number) => {
    const rotation = [...part.rotation] as Vec3;
    rotation[i] = deg;
    patchPart(part.id, { rotation }, `rot-${part.id}-${i}`);
  };
  const setScale = (i: number, pct: number) => {
    const v = Math.max(pct, 0.1) / 100;
    const scale = [...part.scale] as Vec3;
    if (locked) {
      const ratio = v / (scale[i] || 1);
      scale[0] = round(scale[0] * ratio, 4);
      scale[1] = round(scale[1] * ratio, 4);
      scale[2] = round(scale[2] * ratio, 4);
    } else {
      scale[i] = round(v, 4);
    }
    patchPart(part.id, { scale }, `scale-${part.id}-${i}`);
  };
  const setDim = (i: number, shown: number) => {
    if (!size || size[i] <= 0 || shown <= 0) return;
    const ratio = shown / unitF / size[i];
    const scale = [...part.scale] as Vec3;
    if (locked) {
      scale[0] = round(scale[0] * ratio, 4);
      scale[1] = round(scale[1] * ratio, 4);
      scale[2] = round(scale[2] * ratio, 4);
    } else {
      scale[i] = round(scale[i] * ratio, 4);
    }
    patchPart(part.id, { scale }, `dim-${part.id}-${i}`);
  };

  return (
    <>
      <div className="part-head">
        <input aria-label="Part name" value={part.name} data-testid="part-name" onChange={(e) => patchPart(part.id, { name: e.target.value }, `name-${part.id}`)} />
        <div className="part-actions">
          <button title="Zoom to this part (F)" onClick={() => camera('selection')}><Focus size={15} /></button>
          <button title="Duplicate (Ctrl+D)" data-testid="duplicate" onClick={() => duplicatePart(part.id)}><Copy size={15} /></button>
          <button title="Reset this part to how it started" data-testid="reset-part" onClick={() => resetPart(part.id)}><RotateCcw size={15} /></button>
          <button title="Add a feature hotspot for your website" data-testid="add-hotspot" onClick={() => addHotspot(part.id)}><MapPin size={15} /></button>
          <button title="Delete (Del)" className="danger" data-testid="delete" onClick={() => removePart(part.id)}><Trash2 size={15} /></button>
        </div>
      </div>

      <Section title="Dimensions" hint="Approximate real-world size. If the part is turned, this measures the space it takes up.">
        <div className="tri">
          {(['Width', 'Height', 'Depth'] as const).map((label, i) => (
            <NumberField key={label} label={label} step={1} min={0} suffix={unit} testId={`dim-${label.toLowerCase()}`} value={size ? round(size[i] * unitF, 2) : 0} onChange={(n) => setDim(i, n)} />
          ))}
        </div>
        <button className="linkish" onClick={() => setLocked(!locked)} data-testid="lock-ratio">
          {locked ? <Lock size={13} /> : <Unlock size={13} />}
          {locked ? 'Proportions locked: all sides resize together' : 'Proportions free: each side resizes alone'}
        </button>
      </Section>

      <Section title="Position, turn and size">
        <div className="tri-label">Position ({unit})</div>
        <div className="tri">
          {['X', 'Y', 'Z'].map((a, i) => <NumberField key={a} label={a} step={1} testId={`pos-${a.toLowerCase()}`} value={round(part.position[i] * unitF, 2)} onChange={(n) => setPos(i, n)} />)}
        </div>
        <div className="tri-label">Turn (degrees)</div>
        <div className="tri">
          {['X', 'Y', 'Z'].map((a, i) => <NumberField key={a} label={a} step={5} testId={`rot-${a.toLowerCase()}`} value={round(part.rotation[i], 1)} onChange={(n) => setRot(i, n)} />)}
        </div>
        <div className="tri-label">Size (%)</div>
        <div className="tri">
          {['X', 'Y', 'Z'].map((a, i) => <NumberField key={a} label={a} step={5} min={0.1} testId={`scale-${a.toLowerCase()}`} value={round(part.scale[i] * 100, 1)} onChange={(n) => setScale(i, n)} />)}
        </div>
      </Section>

      <ShapePanel part={part} />
      <MaterialPanel part={part} />
      <TexturePanel part={part} />
      <HotspotPanel part={part} />
    </>
  );
}

function ShapePanel({ part }: { part: Part }) {
  const { patchPart } = useStore.getState();
  const fields = part.geo ? GEO_FIELDS[part.geo.type] : undefined;
  if (!part.geo || !fields) return null;
  const geo = part.geo as Record<string, any> & Geo;
  return (
    <Section title="Shape" defaultOpen={false} hint="Changes the part itself, not just how it is stretched.">
      <div className="tri two">
        {fields.filter(([k]) => geo[k] !== undefined || k === 'radius').map(([k, label]) => (
          <NumberField key={k} label={label} step={0.01} min={0} value={geo[k] ?? 0} onChange={(n) => {
            if (k !== 'radius' && k !== 'depth' && n <= 0) return;
            patchPart(part.id, { geo: { ...part.geo!, [k]: n } as Geo }, `geo-${part.id}-${k}`);
          }} />
        ))}
      </div>
    </Section>
  );
}

function MaterialPanel({ part }: { part: Part }) {
  const parts = useStore((s) => s.project.parts);
  const { patchMaterial } = useStore.getState();
  const meshes = meshesOf(parts, part.id);
  const mat = meshes[0]?.material;
  if (!mat) return null;
  const many = meshes.length > 1;
  const key = (k: string) => `mat-${part.id}-${k}`;
  return (
    <Section title="Color and material" hint={many ? `Changes all ${meshes.length} pieces in this group.` : undefined} testId="material-section">
      <ColorField label="Color" value={mat.color} testId="color" onChange={(color) => patchMaterial(part.id, { color }, key('color'))} />
      <div className="palette">
        {PALETTE.map((c) => (
          <button key={c} style={{ background: c }} title={c} aria-label={`Use color ${c}`} onClick={() => patchMaterial(part.id, { color: c })} />
        ))}
      </div>
      <div className="presets">
        {MATERIAL_PRESETS.map((p) => (
          <button key={p.label} data-testid={`preset-${p.label.toLowerCase()}`} onClick={() => patchMaterial(part.id, p.patch)}>
            <i style={{ background: p.swatch }} />
            {p.label}
          </button>
        ))}
      </div>
      <Slider label="Shine" value={1 - mat.roughness} testId="shine" format={(n) => `${Math.round(n * 100)}%`} onChange={(n) => patchMaterial(part.id, { roughness: round(1 - n, 3) }, key('rough'))} />
      <Slider label="Metallic" value={mat.metalness} testId="metal" format={(n) => `${Math.round(n * 100)}%`} onChange={(n) => patchMaterial(part.id, { metalness: n }, key('metal'))} />
      <Slider label="Solid" value={mat.opacity} min={0.05} testId="opacity" format={(n) => `${Math.round(n * 100)}%`} onChange={(n) => patchMaterial(part.id, { opacity: n }, key('opacity'))} />
    </Section>
  );
}

function TexturePanel({ part }: { part: Part }) {
  const parts = useStore((s) => s.project.parts);
  const assets = useStore((s) => s.project.assets);
  const { applyTexture, addAsset, addSticker, patchMaterial, notify } = useStore.getState();
  const textureInput = useRef<HTMLInputElement>(null);
  const stickerInput = useRef<HTMLInputElement>(null);
  const meshes = meshesOf(parts, part.id);
  const mat = meshes[0]?.material;
  if (!mat) return null;
  const list = Object.values(assets);
  const key = (k: string) => `tex-${part.id}-${k}`;
  const rep = mat.texRepeat ?? [1, 1];
  const off = mat.texOffset ?? [0, 0];

  const useFile = async (file: File | undefined, how: 'texture' | 'sticker') => {
    if (!file) return;
    try {
      const asset = await assetFromFile(file);
      if (how === 'texture') {
        addAsset(asset);
        applyTexture(part.id, asset.id);
      } else {
        addAsset(asset);
        addSticker(asset);
      }
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  return (
    <Section title="Images and branding" defaultOpen={false} testId="texture-section" hint="Wrap an image over this part, or add it as a movable sticker such as a logo. Images are saved inside your project and the exported model.">
      <div className="btn-grid">
        <button onClick={() => textureInput.current?.click()}><Upload size={15} />Wrap image</button>
        <button onClick={() => stickerInput.current?.click()}><Upload size={15} />Add sticker</button>
      </div>
      <input ref={textureInput} type="file" hidden accept="image/png,image/jpeg,image/webp" data-testid="texture-input" onChange={(e) => { useFile(e.target.files?.[0], 'texture'); e.target.value = ''; }} />
      <input ref={stickerInput} type="file" hidden accept="image/png,image/jpeg,image/webp" data-testid="sticker-input" onChange={(e) => { useFile(e.target.files?.[0], 'sticker'); e.target.value = ''; }} />
      {list.length > 0 && (
        <label className="field"><span>Image on this part</span>
          <select value={mat.textureId ?? ''} onChange={(e) => applyTexture(part.id, e.target.value || null)}>
            <option value="">None</option>
            {list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      {mat.textureId && (
        <>
          <Slider label="Repeat across" value={rep[0]} min={0.25} max={8} step={0.05} onChange={(n) => patchMaterial(part.id, { texRepeat: [n, rep[1]] }, key('rx'))} />
          <Slider label="Repeat up" value={rep[1]} min={0.25} max={8} step={0.05} onChange={(n) => patchMaterial(part.id, { texRepeat: [rep[0], n] }, key('ry'))} />
          <Slider label="Slide across" value={off[0]} min={-1} max={1} onChange={(n) => patchMaterial(part.id, { texOffset: [n, off[1]] }, key('ox'))} />
          <Slider label="Slide up" value={off[1]} min={-1} max={1} onChange={(n) => patchMaterial(part.id, { texOffset: [off[0], n] }, key('oy'))} />
          <Slider label="Turn" value={mat.texRotation ?? 0} min={-180} max={180} step={1} format={(n) => `${n}°`} onChange={(n) => patchMaterial(part.id, { texRotation: n }, key('rot'))} />
          <button className="linkish" onClick={() => applyTexture(part.id, null)}>Remove image from this part</button>
        </>
      )}
    </Section>
  );
}

function HotspotPanel({ part }: { part: Part }) {
  const hotspots = useStore((s) => s.project.hotspots);
  const { patchHotspot, removeHotspot } = useStore.getState();
  const mine = hotspots.filter((h) => h.partId === part.id);
  if (!mine.length) return null;
  return (
    <Section title="Feature hotspot" hint="Optional labels for your website. They appear as pins in Review and are saved in the manifest.">
      {mine.map((h) => (
        <div key={h.id} className="stack tight">
          <input value={h.label} aria-label="Hotspot label" data-testid="hotspot-label" onChange={(e) => patchHotspot(h.id, { label: e.target.value })} />
          <textarea rows={2} placeholder="Why this feature matters to a customer" value={h.description} data-testid="hotspot-description" onChange={(e) => patchHotspot(h.id, { description: e.target.value })} />
          <button className="linkish" onClick={() => removeHotspot(h.id)}>Remove hotspot</button>
        </div>
      ))}
    </Section>
  );
}

function LightingPanel() {
  const scene = useStore((s) => s.project.scene);
  const { patchScene } = useStore.getState();
  return (
    <Section title="Lighting and background" testId="lighting-section">
      <div className="light-grid">
        {(Object.keys(LIGHT_PRESETS) as LightPreset[]).map((k) => (
          <button key={k} className={scene.lighting === k ? 'on' : ''} title={LIGHT_PRESETS[k].hint} data-testid={`light-${k}`} onClick={() => patchScene({ lighting: k })}>
            {LIGHT_PRESETS[k].label}
          </button>
        ))}
      </div>
      <Slider label="Brightness" value={scene.lightIntensity} min={0.2} max={2} format={(n) => `${Math.round(n * 100)}%`} onChange={(n) => patchScene({ lightIntensity: n }, 'light-power')} />
      <label className="check">
        <input type="checkbox" checked={scene.shadows} onChange={(e) => patchScene({ shadows: e.target.checked })} />
        Show shadows
      </label>
      <div className="bg-grid">
        {BACKGROUNDS.map((b) => (
          <button key={b.label} title={b.label} aria-label={`${b.label} background`} style={{ background: `linear-gradient(${b.top},${b.bottom})` }} onClick={() => patchScene({ bgTop: b.top, bgBottom: b.bottom })} />
        ))}
      </div>
      <ColorField label="Background top" value={scene.bgTop} testId="bg-top" onChange={(c) => patchScene({ bgTop: c }, 'bg-top')} />
      <ColorField label="Background bottom" value={scene.bgBottom} onChange={(c) => patchScene({ bgBottom: c }, 'bg-bottom')} />
    </Section>
  );
}
