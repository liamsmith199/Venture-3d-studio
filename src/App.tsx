import { useEffect, useState } from 'react';
import {
  Axis3d, Check, CircleHelp, Eye, Grid3x3, Hand, Images, Move, MousePointer2, PackageCheck, PanelLeft, PanelRight, Play, Redo2, Rotate3d, Save, Scaling, Undo2, X,
} from 'lucide-react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Inspector } from './components/Inspector';
import { LeftPanel, saveNow } from './components/LeftPanel';
import { Viewport } from './components/Viewport';
import { useStore, type CamPreset, type Tool, type Workflow } from './core/store';

const TOOLS: { key: Tool; label: string; tip: string; icon: typeof Move }[] = [
  { key: 'select', label: 'Select', tip: 'Select only (Q)', icon: MousePointer2 },
  { key: 'translate', label: 'Move', tip: 'Drag the arrows to move (W)', icon: Move },
  { key: 'rotate', label: 'Turn', tip: 'Drag the rings to turn (E)', icon: Rotate3d },
  { key: 'scale', label: 'Resize', tip: 'Drag the handles to resize (R)', icon: Scaling },
];

const VIEWS: { key: CamPreset; label: string }[] = [
  { key: 'front', label: 'Front' },
  { key: 'side', label: 'Side' },
  { key: 'back', label: 'Back' },
  { key: 'top', label: 'Top' },
  { key: 'iso', label: 'Isometric' },
];

const FLOW: { key: keyof Workflow; label: string; tip: string }[] = [
  { key: 'explored', label: 'Explore', tip: 'Drag in the 3D view to look around your model.' },
  { key: 'selected', label: 'Select', tip: 'Click a part of the model.' },
  { key: 'edited', label: 'Change', tip: 'Change a color, size, material or shape.' },
  { key: 'reviewed', label: 'Review', tip: 'Press Review to see a clean turntable view.' },
  { key: 'confirmed', label: 'Confirm', tip: 'Press Confirm Model to create your handoff.' },
];

const GUIDE_KEY = 'venture3d.guide.dismissed';

function TopBar({ onLeft, onRight }: { onLeft: () => void; onRight: () => void }) {
  const name = useStore((s) => s.project.name);
  const dirty = useStore((s) => s.dirty);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const review = useStore((s) => s.reviewMode);
  const { undo, redo, setUI, mark } = useStore.getState();
  return (
    <header className="topbar">
      <button className="icon only-narrow" onClick={onLeft} aria-label="Toggle left panel"><PanelLeft size={18} /></button>
      <div className="brand"><i /><b>Venture 3D Studio</b></div>
      <span className="project-title" title={name}>{name}</span>
      <span className={`save-state${dirty ? ' dirty' : ''}`} data-testid="save-state">{dirty ? 'Autosaving' : 'Saved'}</span>
      <div className="spacer" />
      <button className="icon" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo} data-testid="undo"><Undo2 size={17} /></button>
      <button className="icon" title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={redo} data-testid="redo"><Redo2 size={17} /></button>
      <button className="ghost hide-tiny" title="Save in this browser (Ctrl+S)" onClick={saveNow} data-testid="save"><Save size={16} /><span>Save</span></button>
      <button
        className={`ghost${review ? ' active' : ''}`}
        title="See your model without tools, slowly turning"
        data-testid="review"
        onClick={() => {
          if (!review) mark('reviewed');
          setUI({ reviewMode: !review });
        }}
      >
        {review ? <Eye size={16} /> : <Play size={16} />}<span>{review ? 'Exit review' : 'Review'}</span>
      </button>
      <button className="confirm" onClick={() => setUI({ showConfirm: true, reviewMode: false })} data-testid="confirm-model">
        <PackageCheck size={18} />Confirm Model
      </button>
      <button className="icon hide-tiny" title="Show the quick guide" onClick={() => setUI({ showGuide: true })}><CircleHelp size={17} /></button>
      <button className="icon only-narrow" onClick={onRight} aria-label="Toggle right panel"><PanelRight size={18} /></button>
    </header>
  );
}

function FlowStrip() {
  const workflow = useStore((s) => s.workflow);
  const next = FLOW.find((f) => !workflow[f.key]);
  return (
    <div className="flow" data-testid="flow">
      <ol>
        {FLOW.map((f, i) => (
          <li key={f.key} className={workflow[f.key] ? 'done' : next?.key === f.key ? 'now' : ''} title={f.tip} data-testid={`flow-${f.key}`}>
            <i>{workflow[f.key] ? <Check size={11} strokeWidth={3} /> : i + 1}</i>{f.label}
          </li>
        ))}
      </ol>
      <p>{next ? next.tip : 'Done! Your handoff is ready for Mission 3.'}</p>
    </div>
  );
}

function ToolRail() {
  const tool = useStore((s) => s.tool);
  const setUI = useStore((s) => s.setUI);
  return (
    <div className="rail">
      {TOOLS.map(({ key, label, tip, icon: Icon }) => (
        <button key={key} className={tool === key ? 'on' : ''} title={tip} data-testid={`tool-${key}`} onClick={() => setUI({ tool: key })}>
          <Icon size={17} /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function ViewBar() {
  const projection = useStore((s) => s.projection);
  const showGrid = useStore((s) => s.showGrid);
  const showAxes = useStore((s) => s.showAxes);
  const panMode = useStore((s) => s.panMode);
  const { setUI, camera } = useStore.getState();
  return (
    <div className="viewbar">
      <div className="seg">
        {VIEWS.map((v) => <button key={v.key} data-testid={`view-${v.key}`} onClick={() => camera(v.key)}>{v.label}</button>)}
      </div>
      <button className="pill" data-testid="reset-view" title="Show the whole model again" onClick={() => camera('hero')}>Reset view</button>
      <div className="seg">
        <button className={projection === 'perspective' ? 'on' : ''} data-testid="perspective" title="Natural view with depth" onClick={() => setUI({ projection: 'perspective' })}>Perspective</button>
        <button className={projection === 'orthographic' ? 'on' : ''} data-testid="orthographic" title="Flat view, good for comparing to a reference" onClick={() => setUI({ projection: 'orthographic' })}>Flat</button>
      </div>
      <button className={`square${panMode ? ' on' : ''}`} title="Pan: drag to slide the view" data-testid="pan" onClick={() => setUI({ panMode: !panMode })}><Hand size={16} /></button>
      <button className={`square${showGrid ? ' on' : ''}`} title="Floor grid" data-testid="grid" onClick={() => setUI({ showGrid: !showGrid })}><Grid3x3 size={16} /></button>
      <button className={`square${showAxes ? ' on' : ''}`} title="Direction arrows (red X, green Y, blue Z)" data-testid="axes" onClick={() => setUI({ showAxes: !showAxes })}><Axis3d size={16} /></button>
    </div>
  );
}

function ReferenceDock() {
  const refs = useStore((s) => s.project.refs);
  const assets = useStore((s) => s.project.assets);
  const setUI = useStore((s) => s.setUI);
  const [open, setOpen] = useState(true);
  const [big, setBig] = useState<string | null>(null);
  if (!refs.length) {
    return (
      <button className="ref-cta" onClick={() => setUI({ leftTab: 'import' })} data-testid="ref-cta">
        <Images size={15} />Add your concept image as a reference
      </button>
    );
  }
  return (
    <div className="dock" data-testid="reference-dock">
      <button className="dock-head" onClick={() => setOpen(!open)}><Images size={14} />References ({refs.length})</button>
      {open && (
        <div className="dock-items">
          {refs.map((r) => {
            const a = assets[r.assetId];
            if (!a) return null;
            return (
              <button key={r.assetId} onClick={() => setBig(a.dataUrl)} title="Click to enlarge">
                <img src={a.dataUrl} alt={`${r.view} reference`} />
                <span>{r.view}</span>
              </button>
            );
          })}
        </div>
      )}
      {big && (
        <div className="lightbox" onClick={() => setBig(null)}>
          <img src={big} alt="Enlarged reference" />
          <small>Reference image only. It is not part of the 3D model.</small>
        </div>
      )}
    </div>
  );
}

function Guide() {
  const setUI = useStore((s) => s.setUI);
  const close = () => {
    setUI({ showGuide: false });
    try {
      localStorage.setItem(GUIDE_KEY, '1');
    } catch {
      // Private windows can block storage. The guide just shows again next time.
    }
  };
  return (
    <div className="guide" data-testid="guide">
      <button className="icon closer" onClick={close} aria-label="Close guide" data-testid="guide-close"><X size={16} /></button>
      <h3>Welcome to your 3D studio</h3>
      <p>Your concept is already here as an editable 3D starter, made of parts you can change.</p>
      <ul>
        <li><b>Look around:</b> drag to orbit, scroll or pinch to zoom, right-drag to pan.</li>
        <li><b>Change it:</b> click a part, then use the panel on the right.</li>
        <li><b>Finish:</b> press Review, then Confirm Model to create your handoff.</li>
      </ul>
      <button className="primary" onClick={close}>Start designing</button>
    </div>
  );
}

function Notice() {
  const notice = useStore((s) => s.notice);
  const [shown, setShown] = useState<typeof notice>(null);
  useEffect(() => {
    if (!notice) return;
    setShown(notice);
    const t = setTimeout(() => setShown(null), notice.kind === 'error' ? 9000 : 4500);
    return () => clearTimeout(t);
  }, [notice]);
  if (!shown) return null;
  return <div className={`notice ${shown.kind}`} role="status" data-testid="notice">{shown.text}</div>;
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveNow();
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && k === 'd') {
        e.preventDefault();
        if (s.selectedId) s.duplicatePart(s.selectedId);
      } else if (mod) {
        return;
      } else if (k === 'q') s.setUI({ tool: 'select' });
      else if (k === 'w') s.setUI({ tool: 'translate' });
      else if (k === 'e') s.setUI({ tool: 'rotate' });
      else if (k === 'r') s.setUI({ tool: 'scale' });
      else if (k === 'f') s.camera(s.selectedId ? 'selection' : 'hero');
      else if (k === 'escape') s.select(null);
      else if ((k === 'delete' || k === 'backspace') && s.selectedId) s.removePart(s.selectedId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function Studio3DFallback() {
  return (
    <div className="no-webgl">
      <b>3D is not available in this browser</b>
      <p>Turn on hardware acceleration in your browser settings, or try a current version of Chrome, Edge, Firefox or Safari.</p>
    </div>
  );
}

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export default function App() {
  const showConfirm = useStore((s) => s.showConfirm);
  const showGuide = useStore((s) => s.showGuide);
  const review = useStore((s) => s.reviewMode);
  const [drawer, setDrawer] = useState<'left' | 'right' | null>(null);
  const [webgl] = useState(hasWebGL);
  useShortcuts();

  useEffect(() => {
    try {
      if (localStorage.getItem(GUIDE_KEY)) useStore.getState().setUI({ showGuide: false });
    } catch {
      // Keep showing the guide if storage is blocked.
    }
  }, []);

  return (
    <div className={`app${drawer ? ` drawer-${drawer}` : ''}${review ? ' reviewing' : ''}`}>
      <TopBar onLeft={() => setDrawer(drawer === 'left' ? null : 'left')} onRight={() => setDrawer(drawer === 'right' ? null : 'right')} />
      <FlowStrip />
      <LeftPanel />
      <main className="stagearea">
        {webgl ? <Viewport /> : <Studio3DFallback />}
        {!review && <ToolRail />}
        <ReferenceDock />
        <ViewBar />
        {showGuide && <Guide />}
        <Notice />
      </main>
      <Inspector />
      {showConfirm && <ConfirmDialog />}
    </div>
  );
}
