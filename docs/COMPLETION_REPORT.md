# Mission 2 Completion Report

**Published studio:** https://liamsmith199.github.io/Venture-3d-studio/
**Standalone GLB viewer:** https://liamsmith199.github.io/Venture-3d-studio/viewer.html
**Source:** https://github.com/liamsmith199/Venture-3d-studio (branch `mission-2-studio`)

## What works

All of these were tested on the published site by `scripts/e2e.mjs`, which drives the real interface in Microsoft Edge. The final run had 147 passed and 0 failed.

- Reference image upload, front, side and back labels, description, object type and real-world height
- Orbit, zoom, pan, reset, perspective and flat views, and front, side, back, top and isometric presets
- Selecting parts in the 3D view and the object list, including stepping from a group into a single piece
- Dimensions, position, turn and size by typing, and moving by dragging the gizmo
- Colors, material presets, shine, metallic and transparency sliders, lighting presets and backgrounds
- Add, duplicate, rename, delete, undo, redo, reset a part, and restore a saved version
- Wrapped image textures and movable stickers, both saved in the project and embedded in the GLB
- Save, reload, autosave recovery, and project file export and import, including a clear error for a wrong file
- GLB export and reimport as editable parts, with textures kept
- Seven templates, each editable and each exporting a valid GLB
- Confirm Model, which refuses an empty scene with a specific error and offers no download

## How the handoff was checked

- `model.glb` had 0 errors and 0 warnings in the Khronos glTF validator.
- A separate Three.js page that shares no studio code loaded and drew the model at the right size.
- All five required ZIP files are present, and the model, project and preview checksums match the manifest.
- The file holds no outside links.

The saved deliverable was created on the published site from the unedited starter: 118 parts, 120 cm tall, 120,764 triangles, a 3.6 MB GLB and a 1.4 MB ZIP.

## Limitations

- **No automatic image-to-3D.** The doctor mascot is a stylized approximation hand-built from the concept image during development. The browser does not convert images into models.
- **The concept image is not bundled.** Its file was not available on disk, so it must be uploaded in the Import tab. The saved handoff contains no reference image.
- **The 120 cm height is an estimate.** It can be changed in the Import tab.
- **Coverage gaps.** Automated tests ran in Edge with software 3D rendering. Firefox, Safari, real touch and pinch gestures, and physical graphics cards were not tested. Dragging the turn and resize gizmos was not automated, although the same values are tested by typing.
- **Small screens.** At 390 and 820 pixels wide, the test only confirmed that Confirm Model stays on screen. The studio is designed for laptops.
- **Rotated parts.** Dimensions measure the space a turned part takes up, so they are approximate.
- **Imported GLBs.** Animations, rigging and morph targets are not kept. Position numbers for parts inside an imported model are approximate.
- **Browser saves.** They can be lost if site data is cleared or the computer changes, so use Export Project for a backup.

## Repository notes

- The work is on `mission-2-studio`, which GitHub made the default branch because the repository was empty. `main` does not exist.
- Pages deployment rules allow both `main` and `mission-2-studio`.
- The venture website was not changed.
