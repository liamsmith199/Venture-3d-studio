import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadLatest, saveRecovery } from './core/persist';
import { useStore } from './core/store';
import { live } from './components/Viewport';
import './styles.css';

// Lets the automated tests in scripts/e2e.mjs read the studio's state.
(window as unknown as { __venture: unknown }).__venture = { useStore, live };

async function boot() {
  try {
    const found = await loadLatest();
    if (found) {
      useStore.getState().loadProject(
        found.project,
        found.source === 'recovery' ? 'Recovered your most recent autosaved work.' : 'Your saved project was restored.',
      );
    }
  } catch (err) {
    useStore.getState().notify('error', `Your saved work could not be read: ${(err as Error).message} Starting with the concept model.`);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let warned = false;
  useStore.subscribe((s, prev) => {
    if (s.project === prev.project) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const state = useStore.getState();
      try {
        await saveRecovery(state.project);
        if (useStore.getState().project === state.project) state.markSaved(new Date().toISOString());
        warned = false;
      } catch (err) {
        if (!warned) state.notify('error', `Autosave failed: ${(err as Error).message} Use Export Project to keep a copy.`);
        warned = true;
      }
    }, 900);
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot();
