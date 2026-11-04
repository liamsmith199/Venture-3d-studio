import { useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Box, Boxes, ChevronDown, ChevronRight, Circle, Cone, Cylinder, Download, Eye, EyeOff, FileUp, FolderOpen, History, Image as ImageIcon, LayoutTemplate, Pill, Save, Shapes, Square, Torus, Trash2, Upload,
} from 'lucide-react';
import { assetFromFile } from '../core/assets';
import { buildModel } from '../core/build';
import { exportGlb, projectFromGlb } from '../core/gltf';
import { download, parseProjectFile, safeFileName, saveProject } from '../core/persist';
import { useStore, type LeftTab } from '../core/store';
import { MODEL_TYPE_LABELS, type Geo, type ModelType, type Part, type RefView } from '../core/types';
import { TEMPLATES } from '../templates';
import { matte } from '../templates/kit';
import { live } from './Viewport';

const TABS: { key: LeftTab; label: string; icon: typeof Box }[] = [
  { key: 'project', label: 'Project', icon: FolderOpen },
  { key: 'import', label: 'Import', icon: ImageIcon },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'objects', label: 'Objects', icon: Boxes },
];

export function LeftPanel() {
  const tab = useStore((s) => s.leftTab);
  const setUI = useStore((s) => s.setUI);
  return (
    <aside className="panel left">
      <nav className="tabs">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setUI({ leftTab: key })} data-testid={`tab-${key}`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      <div className="panel-scroll">
        {tab === 'project' && <ProjectTab />}
        {tab === 'import' && <ImportTab />}
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'objects' && <ObjectsTab />}
      </div>
    </aside>
  );
}

export async function saveNow() {
  const s = useStore.getState();
  try {
    await saveProject(s.project);
    s.markSaved(new Date().toISOString());
    s.notify('ok', 'Saved in this browser. Use Export Project for a backup file you can move.');
  } catch (err) {
    s.notify('error', `Saving failed: ${(err as Error).message} Use Export Project to keep a copy.`);
  }
}

function ProjectTab() {
  const project = useStore((s) => s.project);
  const savedAt = useStore((s) => s.savedAt);
  const { patchProject, saveVersion, restoreVersion, loadProject, notify } = useStore.getState();
  const projectInput = useRef<HTMLInputElement>(null);
  const glbInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportProject = () => {
    download(`${safeFileName(project.name)}.venture3d.json`, JSON.stringify(project), 'application/json');
    notify('ok', 'Project backup downloaded.');
  };
  const exportModel = async () => {
    setBusy(true);
    try {
      download(`${safeFileName(project.modelName)}.glb`, await exportGlb(await buildModel(project)), 'model/gltf-binary');
      notify('ok', 'GLB model downloaded.');
    } catch (err) {
      notify('error', `GLB export failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      loadProject(parseProjectFile(await file.text()), `Opened "${file.name}".`);
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };
  const importGlb = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const made = await projectFromGlb(new Uint8Array(await file.arrayBuffer()), file.name, project);
      loadProject(made, `Imported "${file.name}" as editable parts.`);
    } catch (err) {
      notify('error', `That GLB could not be imported: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <label className="field"><span>Project name</span>
        <input value={project.name} data-testid="project-name" onChange={(e) => patchProject({ name: e.target.value }, 'project-name')} />
      </label>
      <label className="field"><span>Model name</span>
        <input value={project.modelName} onChange={(e) => patchProject({ modelName: e.target.value }, 'model-name')} />
      </label>
      <div className="source-note"><strong>Where this model came from</strong>{project.sourceNote}</div>

      <h4>Keep your work</h4>
      <div className="btn-grid">
        <button onClick={saveNow}><Save size={15} />Save</button>
        <button onClick={() => saveVersion(`Version ${project.versions.length + 1}`)} data-testid="save-version"><History size={15} />Save version</button>
        <button onClick={exportProject} data-testid="export-project"><Download size={15} />Export Project</button>
        <button onClick={() => projectInput.current?.click()}><Upload size={15} />Import Project</button>
        <button onClick={exportModel} disabled={busy} data-testid="export-glb"><Download size={15} />Export GLB</button>
        <button onClick={() => glbInput.current?.click()} disabled={busy}><FileUp size={15} />Import GLB</button>
      </div>
      <input ref={projectInput} type="file" hidden accept=".json,application/json" data-testid="import-project-input" onChange={(e) => { importProject(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={glbInput} type="file" hidden accept=".glb,model/gltf-binary" data-testid="import-glb-input" onChange={(e) => { importGlb(e.target.files?.[0]); e.target.value = ''; }} />
      <p className="hint">
        {savedAt ? `Last saved ${new Date(savedAt).toLocaleString()}. ` : ''}
        Browser saves can disappear if site data is cleared or you change computers. Export Project gives you a backup file.
      </p>

      <h4>Saved versions</h4>
      {project.versions.length === 0 && <p className="hint">Save a version before a big change so you can come back to it.</p>}
      {project.versions.map((v) => (
        <div className="row-item" key={v.id}>
          <div><b>{v.label}</b><small>{new Date(v.savedAt).toLocaleString()}</small></div>
          <button className="small" onClick={() => restoreVersion(v.id)} data-testid="restore-version">Restore</button>
        </div>
      ))}

      <h4>Confirmed models</h4>
      {project.confirmed.length === 0 && <p className="hint">Nothing confirmed yet. Confirm Model creates your Mission 3 handoff.</p>}
      {project.confirmed.map((c) => (
        <div className="row-item" key={c.version}>
          <div><b>Version {c.version}</b><small>{new Date(c.confirmedAt).toLocaleString()}</small></div>
          <small className="mono" title={c.modelSha256}>{c.modelSha256.slice(0, 8)}</small>
        </div>
      ))}
    </div>
  );
}

function ImportTab() {
  const project = useStore((s) => s.project);
  const { addReference, setRefView, removeReference, patchProject, notify } = useStore.getState();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const factor = project.displayUnit === 'in' ? 2.54 : 1;
  const [height, setHeight] = useState('');

  const upload = async (files: FileList | null) => {
    if (!files) return;
    const nextView: RefView[] = ['front', 'side', 'back'];
    let i = project.refs.length;
    for (const file of Array.from(files)) {
      try {
        addReference(await assetFromFile(file), nextView[i] ?? 'other');
        i++;
      } catch (err) {
        notify('error', (err as Error).message);
      }
    }
  };
  const applyHeight = () => {
    const wanted = parseFloat(height) * factor;
    const root = live.root;
    if (!root || !(wanted > 0)) return;
    const box = new THREE.Box3().setFromObject(root);
    const units = box.max.y - box.min.y;
    if (units > 0) {
      patchProject({ cmPerUnit: wanted / units });
      notify('ok', `Real-world height set to ${height} ${project.displayUnit}.`);
    }
  };

  return (
    <div className="stack">
      <div className="callout">
        <strong>Reference image or 3D model?</strong>
        A reference is a flat picture to look at while you design. The 3D model is the set of parts you edit. Uploading a picture does <em>not</em> turn it into 3D automatically.
      </div>
      <button
        className={`drop${drag ? ' over' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
      >
        <Upload size={20} />
        <b>Add your Mission 1 images</b>
        <small>Drop here or click. PNG, JPG or WebP.</small>
      </button>
      <input ref={input} type="file" hidden multiple accept="image/png,image/jpeg,image/webp" data-testid="reference-input" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />

      {project.refs.map((r) => {
        const asset = project.assets[r.assetId];
        if (!asset) return null;
        return (
          <div className="ref-row" key={r.assetId} data-testid="reference-row">
            <img src={asset.dataUrl} alt={asset.name} />
            <div>
              <small title={asset.name}>{asset.name}</small>
              <select value={r.view} aria-label="Which view this image shows" onChange={(e) => setRefView(r.assetId, e.target.value as RefView)}>
                <option value="front">Front view</option>
                <option value="side">Side view</option>
                <option value="back">Back view</option>
                <option value="other">Other / all views</option>
              </select>
            </div>
            <button className="icon" title="Remove this reference" onClick={() => removeReference(r.assetId)}><Trash2 size={15} /></button>
          </div>
        );
      })}

      <label className="field"><span>What are you designing?</span>
        <select value={project.modelType} onChange={(e) => patchProject({ modelType: e.target.value as ModelType })}>
          {Object.entries(MODEL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="field"><span>Short description</span>
        <textarea rows={4} value={project.description} data-testid="description" onChange={(e) => patchProject({ description: e.target.value }, 'description')} />
      </label>
      <label className="field"><span>Measurement units</span>
        <select value={project.displayUnit} onChange={(e) => patchProject({ displayUnit: e.target.value as 'cm' | 'in' })}>
          <option value="cm">Centimetres</option>
          <option value="in">Inches</option>
        </select>
      </label>
      <div className="field"><span>Approximate real-world height</span>
        <div className="inline">
          <input type="number" min="0" step="any" placeholder={`e.g. 120 ${project.displayUnit}`} value={height} data-testid="real-height" onChange={(e) => setHeight(e.target.value)} />
          <button onClick={applyHeight} data-testid="apply-height">Apply</button>
        </div>
        <small className="hint">Scales the whole model. Its look stays the same, but the measurements change.</small>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const current = useStore((s) => s.project);
  const { loadBlueprint, saveVersion, notify } = useStore.getState();
  return (
    <div className="stack">
      <p className="hint">Every template is made of real parts you can edit. Your current design is kept under Project &gt; Saved versions when you switch.</p>
      <div className="template-grid">
        {TEMPLATES.map((t) => {
          const top = t.scene?.bgTop ?? '#eef';
          const bottom = t.scene?.bgBottom ?? '#ccd';
          return (
            <button
              key={t.key}
              className={`template${t.key === 'concept' ? ' featured' : ''}${current.modelName === t.modelName ? ' on' : ''}`}
              style={{ background: `linear-gradient(160deg, ${top}, ${bottom})`, color: t.key === 'sculpture' ? '#f5f6fa' : '#17211d' }}
              data-testid={`template-${t.key}`}
              onClick={() => {
                saveVersion(`Before ${t.title}: ${current.modelName}`);
                loadBlueprint(t);
                notify('info', `${t.title} loaded. Your previous design is under Project > Saved versions.`);
              }}
            >
              <b>{t.title}</b>
              <small>{t.blurb}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ADDABLE: { label: string; icon: typeof Box; geo: Geo; y: number }[] = [
  { label: 'Box', icon: Box, geo: { type: 'box', w: 0.8, h: 0.8, d: 0.8 }, y: 0.4 },
  { label: 'Soft box', icon: Square, geo: { type: 'box', w: 0.8, h: 0.8, d: 0.8, radius: 0.1 }, y: 0.4 },
  { label: 'Ball', icon: Circle, geo: { type: 'sphere', r: 0.45 }, y: 0.45 },
  { label: 'Cylinder', icon: Cylinder, geo: { type: 'cylinder', rTop: 0.4, rBottom: 0.4, h: 0.9 }, y: 0.45 },
  { label: 'Cone', icon: Cone, geo: { type: 'cone', r: 0.42, h: 0.9 }, y: 0.45 },
  { label: 'Ring', icon: Torus, geo: { type: 'torus', r: 0.4, tube: 0.12 }, y: 0.52 },
  { label: 'Capsule', icon: Pill, geo: { type: 'capsule', r: 0.25, h: 0.6 }, y: 0.55 },
  { label: 'Panel', icon: Shapes, geo: { type: 'plane', w: 1, h: 1 }, y: 0.5 },
];

function ObjectsTab() {
  const parts = useStore((s) => s.project.parts);
  const selectedId = useStore((s) => s.selectedId);
  const { addPart } = useStore.getState();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const kids = new Map<string | null, Part[]>();
  for (const p of parts) {
    const list = kids.get(p.parentId) ?? [];
    list.push(p);
    kids.set(p.parentId, list);
  }
  const toggle = (id: string) => {
    const next = new Set(closed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setClosed(next);
  };
  // Groups start folded so a model with hundreds of pieces stays readable.
  const isOpen = (p: Part) => {
    const has = selectedId ? isAncestor(parts, p.id, selectedId) : false;
    return has || closed.has(p.id);
  };

  const rows = q
    ? parts.filter((p) => p.name.toLowerCase().includes(q)).map((p) => <Row key={p.id} part={p} depth={0} open={false} hasKids={false} onToggle={() => undefined} />)
    : renderTree(kids, null, 0, isOpen, toggle);

  return (
    <div className="stack">
      <h4>Add a part</h4>
      <div className="add-grid">
        {ADDABLE.map(({ label, icon: Icon, geo, y }) => (
          <button
            key={label}
            title={`Add a ${label.toLowerCase()}`}
            data-testid={`add-${label.toLowerCase().replace(' ', '-')}`}
            onClick={() => addPart({
              name: label, kind: 'mesh', geo, material: matte('#5bbfa0', { roughness: 0.45, doubleSided: geo.type === 'plane' }),
              position: [1.4, y, 0.6], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true,
            })}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <h4>Parts in your model <small>({parts.filter((p) => p.kind === 'mesh').length})</small></h4>
      <input className="search" placeholder="Find a part" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="tree" data-testid="scene-tree">{rows}</div>
    </div>
  );
}

function isAncestor(parts: Part[], ancestorId: string, id: string): boolean {
  let at = parts.find((p) => p.id === id);
  while (at?.parentId) {
    if (at.parentId === ancestorId) return true;
    const up = at.parentId;
    at = parts.find((p) => p.id === up);
  }
  return false;
}

function renderTree(kids: Map<string | null, Part[]>, parent: string | null, depth: number, isOpen: (p: Part) => boolean, toggle: (id: string) => void): React.ReactNode[] {
  return (kids.get(parent) ?? []).flatMap((p) => {
    const hasKids = !!kids.get(p.id)?.length;
    const open = hasKids && isOpen(p);
    return [
      <Row key={p.id} part={p} depth={depth} open={open} hasKids={hasKids} onToggle={() => toggle(p.id)} />,
      ...(open ? renderTree(kids, p.id, depth + 1, isOpen, toggle) : []),
    ];
  });
}

function Row({ part, depth, open, hasKids, onToggle }: { part: Part; depth: number; open: boolean; hasKids: boolean; onToggle: () => void }) {
  const selected = useStore((s) => s.selectedId === part.id);
  const { select, patchPart } = useStore.getState();
  return (
    <div className={`tree-row${selected ? ' on' : ''}${part.visible ? '' : ' off'}`} style={{ paddingLeft: 4 + depth * 14 }} data-testid="tree-row" data-name={part.name}>
      {hasKids ? (
        <button className="twist" aria-label={open ? 'Collapse' : 'Expand'} onClick={onToggle}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : <span className="twist" />}
      <button className="tree-name" onClick={() => select(part.id)} onDoubleClick={() => useStore.getState().camera('selection')} title="Click to select, double-click to zoom to it">
        {part.material && <i className="dot" style={{ background: part.material.color }} />}
        {!part.material && <Boxes size={13} className="groupicon" />}
        {part.name}
      </button>
      <button className="eye" title={part.visible ? 'Hide this part' : 'Show this part'} onClick={() => patchPart(part.id, { visible: !part.visible })}>
        {part.visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  );
}
