# Venture 3D Studio

A browser-based 3D design studio for Mission 2. It turns a product concept into an editable 3D model, then packages a confirmed model for Mission 3. There is nothing to install, and no accounts or paid services are needed.

**Workflow:** Import Concept → Create 3D Prototype → Explore → Customize → Confirm Model → Export Handoff

- [Student usage guide](docs/USAGE_GUIDE.md)
- [Handoff manifest schema](docs/MANIFEST_SCHEMA.md)
- [Completion report](docs/COMPLETION_REPORT.md)

## An honest note about images and 3D

The studio does **not** convert pictures into 3D. The doctor mascot starter was hand-built as about 120 editable parts during development, by looking at the Mission 1 concept image. It is a stylized approximation, not a reconstruction. Uploaded images are used as references, wrapped textures or stickers.

## Develop

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run e2e
```

`npm run e2e` tests the production build by driving the real interface in Microsoft Edge or Chrome, and checks exported models with the Khronos glTF validator. Run `npm run build` first. Add a URL to test a published copy:

```bash
node scripts/e2e.mjs https://liamsmith199.github.io/Venture-3d-studio/
```

## Stack

React, TypeScript, Vite, Three.js, React Three Fiber, Drei, Zustand and fflate. Projects are stored in IndexedDB. Pushing to `main` or `mission-2-studio` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/core/build.ts` | Turns project parts into Three.js geometry, materials and lights |
| `src/core/store.ts` | Project state, undo and redo, and editing actions |
| `src/core/persist.ts` | Browser saving, autosave recovery and project files |
| `src/core/gltf.ts` | GLB export, and importing a GLB as editable parts |
| `src/core/handoff.ts` | Confirm Model checks, preview, manifest and ZIP |
| `src/templates/` | The concept mascot and the seven starter templates |
| `src/components/` | Viewport, panels and the Confirm Model dialog |
| `src/viewer/` | A standalone GLB viewer that shares no code with the studio |
