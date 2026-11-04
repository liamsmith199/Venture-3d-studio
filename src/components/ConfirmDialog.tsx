import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, Download, Loader2, PackageCheck, X } from 'lucide-react';
import { CONFIRM_STEPS, HANDOFF_ZIP, runConfirm, type HandoffResult, type Step, type StepState } from '../core/handoff';
import { download, safeFileName, saveProject } from '../core/persist';
import { useStore } from '../core/store';
import { live } from './Viewport';

const ICON: Record<StepState, React.ReactNode> = {
  pending: <CircleDashed size={17} />,
  running: <Loader2 size={17} className="spin" />,
  ok: <CheckCircle2 size={17} />,
  error: <AlertCircle size={17} />,
};

export function ConfirmDialog() {
  const setUI = useStore((s) => s.setUI);
  const [steps, setSteps] = useState<Step[]>(CONFIRM_STEPS.map((s) => ({ ...s, state: 'pending' })));
  const [result, setResult] = useState<HandoffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const s = useStore.getState();
      const framing = live.framing?.projection === 'perspective' ? live.framing : undefined;
      try {
        const out = await runConfirm(s.project, framing, (key, state, detail) => {
          setSteps((list) => list.map((x) => (x.key === key ? { ...x, state, detail } : x)));
        });
        // The confirmed snapshot is stored apart from the parts still being edited.
        s.patchProject({ confirmed: out.project.confirmed, framing: out.project.framing });
        s.mark('confirmed');
        setResult(out);
        try {
          await saveProject(useStore.getState().project);
          s.markSaved(new Date().toISOString());
        } catch (err) {
          setSaveWarning(`The ZIP is ready, but saving in this browser failed: ${(err as Error).message}`);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);

  const close = () => setUI({ showConfirm: false });

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label="Confirm Model">
      <div className="modal">
        <header>
          <div>
            <h2><PackageCheck size={21} />Confirm Model</h2>
            <p>This checks your design and packages it for Mission 3. Nothing gets published.</p>
          </div>
          <button className="icon" onClick={close} aria-label="Close" data-testid="confirm-close"><X size={18} /></button>
        </header>
        <div className="modal-body">
          <ol className="steps">
            {steps.map((s) => (
              <li key={s.key} className={s.state} data-testid={`step-${s.key}`} data-state={s.state}>
                {ICON[s.state]}
                <div><b>{s.label}</b>{s.detail && <small>{s.detail}</small>}</div>
              </li>
            ))}
          </ol>
          <div className="result">
            {result && <img src={result.previewUrl} alt="Preview rendered from the exported model" data-testid="confirm-preview" />}
            {result && <p className="version">Version {result.manifest.modelVersion}, {result.manifest.dimensions.width} x {result.manifest.dimensions.height} x {result.manifest.dimensions.depth} cm</p>}
            {!result && !error && <div className="waiting"><Loader2 size={28} className="spin" />Checking your model</div>}
            {error && (
              <div className="failure" data-testid="confirm-error">
                <AlertCircle size={22} />
                <b>Your model was not confirmed</b>
                <p>{error}</p>
                <small>No handoff file was created. Fix this, then press Confirm Model again.</small>
              </div>
            )}
          </div>
        </div>
        {result && result.warnings.map((w) => <p className="warn" key={w}>{w}</p>)}
        {saveWarning && <p className="warn">{saveWarning}</p>}
        <footer>
          {result ? (
            <>
              <button className="ghost" data-testid="download-glb" onClick={() => download(`${safeFileName(result.project.modelName)}.glb`, result.glb, 'model/gltf-binary')}>
                <Download size={16} />Model only (.glb)
              </button>
              <button className="primary" data-testid="download-handoff" onClick={() => download(HANDOFF_ZIP, result.zip, 'application/zip')}>
                <Download size={17} />Download {HANDOFF_ZIP}
              </button>
            </>
          ) : (
            <button className="ghost" onClick={close}>{error ? 'Back to editing' : 'Cancel'}</button>
          )}
        </footer>
      </div>
    </div>
  );
}
