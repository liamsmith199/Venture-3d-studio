// End-to-end test of the real studio in Microsoft Edge (or Chrome), driving the actual UI.
//   node scripts/e2e.mjs                     Tests the production build through vite preview.
//   node scripts/e2e.mjs https://site/path/  Tests a published copy.
//   node scripts/e2e.mjs --deliver <folder>  Also saves a clean confirmed handoff to <folder>.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { unzipSync, strFromU8 } from 'fflate';
import validator from 'gltf-validator';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test-output');
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const deliverAt = args.includes('--deliver') ? resolve(args[args.indexOf('--deliver') + 1]) : null;
const urlArg = args.find((a) => a.startsWith('http'));
const BASE = urlArg ?? 'http://localhost:4173/Venture-3d-studio/';

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
  }
}
const section = (t) => console.log(`\n${t}`);
const sha = (b) => createHash('sha256').update(b).digest('hex');

// A small checkerboard PNG, built here so the test needs no image files.
function testPng(path, a = [230, 60, 40], b = [250, 240, 80]) {
  const size = 64;
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const start = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      const c = ((x >> 3) + (y >> 3)) % 2 ? a : b;
      rows.set(c, start + 1 + x * 3);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

/** Runs the Khronos validator, then reads the counts straight from the GLB's own JSON chunk. */
async function validateGlb(bytes, name) {
  const data = new Uint8Array(bytes);
  const report = await validator.validateBytes(data, { uri: name, maxIssues: 50 });
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const json = JSON.parse(Buffer.from(data.subarray(20, 20 + view.getUint32(12, true))).toString());
  const triangles = (json.meshes ?? []).flatMap((m) => m.primitives).reduce((sum, p) => {
    const a = json.accessors[p.indices ?? p.attributes.POSITION];
    return sum + a.count / 3;
  }, 0);
  return {
    issues: report.issues,
    magicOk: view.getUint32(0, true) === 0x46546c67,
    meshNodes: (json.nodes ?? []).filter((n) => n.mesh !== undefined).length,
    images: (json.images ?? []).length,
    embeddedImages: (json.images ?? []).filter((i) => i.bufferView !== undefined && !i.uri).length,
    externalRefs: [...(json.images ?? []), ...(json.buffers ?? [])].filter((x) => x.uri).length,
    triangles,
  };
}

function findEdge() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ];
  return candidates.find(existsSync);
}

async function startPreview() {
  if (urlArg) return null;
  const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(BASE)).ok) return child;
    } catch {
      // Still starting.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error('vite preview did not start');
}

const server = await startPreview();
process.on('exit', () => server?.kill());
const executablePath = findEdge();
if (!executablePath) throw new Error('Edge or Chrome is needed to run these tests.');
const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const pageErrors = [];
const badRequests = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`${m.text()} ${m.location().url}`);
});
page.on('response', (r) => {
  if (r.status() >= 400) badRequests.push(`${r.status()} ${r.url()}`);
});
page.setDefaultTimeout(60000);

const T = (id) => page.locator(`[data-testid="${id}"]`);
const state = (fn, arg) => page.evaluate(`(${fn})(window.__venture.useStore.getState(), window.__venture.live, ${JSON.stringify(arg ?? null)})`);
const wait = (ms) => page.waitForTimeout(ms);
const part = (name) => state(`(s, l, n) => s.project.parts.find((p) => p.name === n)`, name);
const canvas = page.locator('canvas').first();
async function canvasBox() {
  return canvas.boundingBox();
}
async function selectInTree(name) {
  await page.evaluate((n) => {
    const s = window.__venture.useStore.getState();
    s.setUI({ leftTab: 'objects' });
    s.select(s.project.parts.find((p) => p.name === n).id);
  }, name);
  await wait(250);
}
async function downloadOf(clicker) {
  const [dl] = await Promise.all([page.waitForEvent('download'), clicker()]);
  const path = join(out, dl.suggestedFilename());
  await dl.saveAs(path);
  return { path, name: dl.suggestedFilename(), bytes: readFileSync(path) };
}
async function openSection(testId) {
  const sec = T(testId);
  if (!(await sec.evaluate((el) => el.classList.contains('open')))) await sec.locator('.section-head').click();
}

const pngA = join(out, 'test-texture.png');
const pngB = join(out, 'test-reference.png');
testPng(pngA);
testPng(pngB, [40, 90, 220], [220, 240, 255]);

// ---------------------------------------------------------------------
section('Load');
await page.goto(BASE);
await canvas.waitFor();
await wait(2500);
check('Studio opens with a starter model, not an empty screen', (await state(`(s) => s.project.parts.length`)) > 50);
check('Guide is shown on first visit', await T('guide').isVisible());
await T('guide-close').click();
const shot1 = await page.screenshot({ path: join(out, '01-loaded.png') });
const box0 = await canvasBox();
const canvasShot = await page.screenshot({ clip: box0 });
check('3D canvas draws something', canvasShot.length > 20000, `${(canvasShot.length / 1024).toFixed(0)} KB screenshot`);
void shot1;

section('Import a reference image');
await T('tab-import').click();
await T('reference-input').setInputFiles(pngB);
await T('reference-row').waitFor();
check('Reference appears in the Import list', (await T('reference-row').count()) === 1);
check('Reference stays visible beside the 3D view', await T('reference-dock').isVisible());
await page.locator('[data-testid="reference-row"] select').selectOption('side');
check('Reference view can be labelled', (await state(`(s) => s.project.refs[0].view`)) === 'side');
await T('description').fill('Test description for the handoff.');
check('Description can be edited', (await state(`(s) => s.project.description`)) === 'Test description for the handoff.');
await T('real-height').fill('150');
await T('apply-height').click();
await wait(200);
const cmPerUnit = await state(`(s) => s.project.cmPerUnit`);
check('Real-world height changes the model scale', Math.abs(cmPerUnit * 3.0 - 150) < 15, `${cmPerUnit.toFixed(1)} cm per unit`);

section('Camera');
const framing = () => state(`(s, l) => l.framing`);
const dist = (f) => Math.hypot(f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]);
await T('reset-view').click();
await wait(1200);
const b = await canvasBox();
const cx = b.x + b.width / 2;
const cy = b.y + b.height / 2;
const f0 = await framing();
await page.mouse.move(b.x + 60, cy + 160);
await page.mouse.down();
await page.mouse.move(b.x + 220, cy + 120, { steps: 6 });
await page.mouse.up();
await wait(500);
const f1 = await framing();
check('Drag orbits the camera', Math.hypot(f1.position[0] - f0.position[0], f1.position[2] - f0.position[2]) > 0.3);
check('Exploring is ticked in the guided steps', await T('flow-explored').evaluate((el) => el.classList.contains('done')));
await page.mouse.move(cx, cy);
await page.mouse.wheel(0, -500);
await wait(600);
const f2 = await framing();
check('Scroll zooms the camera', dist(f2) < dist(f1), `${dist(f1).toFixed(2)} to ${dist(f2).toFixed(2)}`);
await page.mouse.move(b.x + 80, cy);
await page.mouse.down({ button: 'right' });
await page.mouse.move(b.x + 180, cy + 40, { steps: 5 });
await page.mouse.up({ button: 'right' });
await wait(500);
const f3 = await framing();
check('Right-drag pans the view', Math.hypot(f3.target[0] - f2.target[0], f3.target[1] - f2.target[1]) > 0.02);
await T('pan').click();
await page.mouse.move(b.x + 80, cy);
await page.mouse.down();
await page.mouse.move(b.x + 150, cy + 30, { steps: 5 });
await page.mouse.up();
await wait(500);
const f4 = await framing();
check('Pan mode pans with left-drag', Math.hypot(f4.target[0] - f3.target[0], f4.target[1] - f3.target[1]) > 0.02);
await T('pan').click();
for (const [view, axis] of [['front', 2], ['side', 0], ['top', 1]]) {
  await T(`view-${view}`).click();
  await wait(1200);
  const f = await framing();
  const v = [f.position[0] - f.target[0], f.position[1] - f.target[1], f.position[2] - f.target[2]];
  const d = Math.hypot(...v);
  check(`${view} view looks along the right axis`, Math.abs(v[axis]) / d > 0.99);
}
await T('view-iso').click();
await wait(1200);
const iso = await framing();
check('Isometric view looks from a corner', Math.abs(iso.position[0] - iso.target[0]) > 1 && Math.abs(iso.position[1] - iso.target[1]) > 1);
await T('orthographic').click();
await wait(1200);
check('Flat (orthographic) camera works', await state(`(s, l) => l.camera.isOrthographicCamera === true`));
await T('view-front').click();
await wait(1200);
await page.screenshot({ path: join(out, '02-orthographic-front.png') });
await T('perspective').click();
await wait(800);
check('Perspective camera returns', await state(`(s, l) => l.camera.isPerspectiveCamera === true`));
await T('grid').click();
await T('axes').click();
check('Grid and axes can be toggled', (await state(`(s) => !s.showGrid && s.showAxes`)));
await T('grid').click();
await T('axes').click();
await T('light-sunset').click();
check('Lighting preset changes', (await state(`(s) => s.project.scene.lighting`)) === 'sunset');
await T('light-studio').click();
await T('bg-top').fill('#fff1e0');
check('Background color changes', (await state(`(s) => s.project.scene.bgTop`)) === '#fff1e0');

section('Select parts');
await T('reset-view').click();
await wait(1200);
await page.mouse.click(cx, cy);
await wait(300);
const sel1 = await state(`(s) => s.selectedId && s.project.parts.find((p) => p.id === s.selectedId).name`);
check('Clicking the model selects a component', !!sel1, `selected ${sel1}`);
check('Selected component is shown in the inspector', (await T('part-name').inputValue()) === sel1);
await page.mouse.click(cx, cy);
await wait(300);
const sel2 = await state(`(s) => s.selectedId && s.project.parts.find((p) => p.id === s.selectedId).name`);
check('Clicking again steps into a smaller piece', !!sel2 && sel2 !== sel1, `selected ${sel2}`);
await T('tab-objects').click();
await page.locator('.tree-row[data-name="Apple"] .tree-name').click();
check('Choosing from the object list selects it', (await T('part-name').inputValue()) === 'Apple');
const groupRow = page.locator('.tree-row[data-name="Apple"]');
check('Object list shows the active part', await groupRow.evaluate((el) => el.classList.contains('on')));

section('Change size, position, color and material');
await wait(300);
const widthBefore = parseFloat(await T('dim-width').inputValue());
await T('dim-width').fill(String(+(widthBefore * 2).toFixed(2)));
await T('part-name').click();
await wait(400);
const appleScale = (await part('Apple')).scale;
check('Typing a dimension resizes the part', Math.abs(appleScale[0] - 2) < 0.05, `scale ${appleScale[0]}`);
await wait(200);
const widthAfter = parseFloat(await T('dim-width').inputValue());
check('Dimension readout updates', Math.abs(widthAfter - widthBefore * 2) < widthBefore * 0.1, `${widthBefore} to ${widthAfter}`);
await T('undo').click();
await wait(200);
check('Undo restores the size', (await part('Apple')).scale[0] === 1);
await T('redo').click();
await wait(200);
check('Redo re-applies the size', Math.abs((await part('Apple')).scale[0] - 2) < 0.05);
await T('undo').click();
await T('pos-x').fill('-90');
await T('part-name').click();
await wait(200);
check('Typing a position moves the part', (await part('Apple')).position[0] < -0.6);
await T('rot-y').fill('45');
await T('part-name').click();
check('Typing a turn rotates the part', (await part('Apple')).rotation[1] === 45);
await T('scale-z').fill('150');
await T('part-name').click();
check('Typing a size percent resizes the part', Math.abs((await part('Apple')).scale[2] - 1.5) < 0.01);
await T('reset-part').click();
await wait(200);
const appleReset = await part('Apple');
check('Reset puts a part back how it started', appleReset.rotation[1] === 0 && appleReset.scale[2] === 1);

await selectInTree('Lab coat');
await T('color').fill('#3366cc');
await wait(200);
const coatColor = await state(`(s) => s.project.parts.find((p) => p.name === 'Coat body').material.color`);
check('Changing a group color changes the pieces inside', coatColor === '#3366cc', coatColor);
await T('preset-metal').click();
const coatMat = await state(`(s) => s.project.parts.find((p) => p.name === 'Coat body').material`);
check('Material preset applies', coatMat.metalness === 1);
await T('preset-matte').click();
await T('opacity').fill('0.6');
check('Transparency slider applies', (await state(`(s) => s.project.parts.find((p) => p.name === 'Coat body').material.opacity`)) === 0.6);
await T('opacity').fill('1');
check('Making a change ticks the guided steps', await T('flow-edited').evaluate((el) => el.classList.contains('done')));

section('Drag the 3D gizmo');
await selectInTree('Broccoli');
await T('tool-translate').click();
await T('view-front').click();
await wait(1300);
const before = (await part('Broccoli')).position;
const scr = await page.evaluate(() => {
  const { useStore, live } = window.__venture;
  const id = useStore.getState().selectedId;
  const obj = live.objects.get(id);
  obj.updateWorldMatrix(true, false);
  const v = obj.getWorldPosition(live.camera.position.clone());
  v.project(live.camera);
  return [v.x, v.y];
});
const b2 = await canvasBox();
const gx = b2.x + ((scr[0] + 1) / 2) * b2.width;
const gy = b2.y + ((1 - scr[1]) / 2) * b2.height;
// The gizmo points its X arrow toward the camera's side, which is left for a part right of center.
await page.mouse.move(gx - 45, gy);
await wait(200);
await page.mouse.down();
await page.mouse.move(gx - 105, gy, { steps: 8 });
await page.mouse.up();
await wait(400);
const after = (await part('Broccoli')).position;
check('Dragging the move arrow moves the part', Math.abs(after[0] - before[0]) > 0.05, `x ${before[0]} to ${after[0]}`);
await T('undo').click();
await wait(200);
check('Undo reverses a gizmo drag', (await part('Broccoli')).position[0] === before[0]);

section('Add, duplicate, rename and delete');
const count0 = await state(`(s) => s.project.parts.length`);
await T('tab-objects').click();
await T('add-ball').click();
await wait(200);
check('Adding a part works', (await state(`(s) => s.project.parts.length`)) === count0 + 1);
await T('part-name').fill('Test ball');
check('Renaming a part works', !!(await part('Test ball')));
await T('duplicate').click();
await wait(200);
check('Duplicating a part works', !!(await part('Test ball copy')));
await T('delete').click();
await wait(200);
check('Deleting a part works', !(await part('Test ball copy')));

section('Textures and stickers');
await selectInTree('Test ball');
await openSection('texture-section');
await T('texture-input').setInputFiles(pngA);
await page.waitForFunction(() => {
  const s = window.__venture.useStore.getState();
  return s.project.parts.find((p) => p.name === 'Test ball').material.textureId;
});
check('Uploaded image is applied as a texture', true);
await T('sticker-input').setInputFiles(pngA);
await page.waitForFunction(() => window.__venture.useStore.getState().project.parts.some((p) => p.name.startsWith('Sticker:')));
check('Uploaded image is added as a sticker', true);
await wait(600);
await page.screenshot({ path: join(out, '03-edited.png') });

section('Hotspot');
await selectInTree('Apple');
await T('add-hotspot').click();
await T('hotspot-label').fill('Healthy choice');
await T('hotspot-description').fill('Shows the nutrition focus.');
check('Feature hotspot is stored', (await state(`(s) => s.project.hotspots[0].label`)) === 'Healthy choice');

section('Save and reload');
await T('tab-project').click();
await T('project-name').fill('E2E Project');
await T('save').click();
await page.waitForFunction(() => !window.__venture.useStore.getState().dirty);
const savedParts = await state(`(s) => s.project.parts.length`);
await page.reload();
await canvas.waitFor();
await wait(2000);
check('Project survives a page reload', (await state(`(s) => s.project.name`)) === 'E2E Project' && (await state(`(s) => s.project.parts.length`)) === savedParts);
check('Saved texture survives a reload', await state(`(s) => { const t = s.project.parts.find((p) => p.name === 'Test ball').material.textureId; return !!s.project.assets[t]; }`));
check('Saved reference survives a reload', (await T('reference-dock').isVisible()));
await page.evaluate(() => window.__venture.useStore.getState().patchProject({ name: 'E2E Autosaved' }));
await wait(1600);
await page.reload();
await canvas.waitFor();
await wait(1500);
check('Autosave recovers the latest work', (await state(`(s) => s.project.name`)) === 'E2E Autosaved');

section('Export and import');
await T('tab-project').click();
await T('save-version').click();
check('A version can be saved', (await state(`(s) => s.project.versions.length`)) >= 1);
const projectFile = await downloadOf(() => T('export-project').click());
const projectJson = JSON.parse(projectFile.bytes.toString());
check('Project backup downloads as a file', projectJson.schema === 'venture3d.project/1', `${(projectFile.bytes.length / 1024).toFixed(0)} KB`);
await page.evaluate(() => {
  const s = window.__venture.useStore.getState();
  s.patchPart(s.project.parts.find((p) => p.name === 'Face').id, { visible: false });
});
await T('restore-version').first().click();
await wait(400);
check('Saved version restores', (await part('Face')).visible === true);
await page.evaluate(() => window.__venture.useStore.getState().patchProject({ name: 'Changed' }));
await T('import-project-input').setInputFiles(projectFile.path);
await wait(800);
check('Project backup imports again', (await state(`(s) => s.project.name`)) === 'E2E Autosaved' && (await state(`(s) => s.project.parts.length`)) === projectJson.parts.length);
writeFileSync(join(out, 'not-a-project.json'), '{"hello":1}');
await T('import-project-input').setInputFiles(join(out, 'not-a-project.json'));
await T('notice').waitFor();
check('A wrong file gives a clear error', (await T('notice').innerText()).includes('not a Venture 3D project'));
check('A wrong file does not replace the project', (await state(`(s) => s.project.name`)) === 'E2E Autosaved');

const glbFile = await downloadOf(() => T('export-glb').click());
const glbReport = await validateGlb(glbFile.bytes, glbFile.name);
check('Exported GLB passes the Khronos glTF validator', glbReport.issues.numErrors === 0, `${glbReport.issues.numErrors} errors, ${glbReport.issues.numWarnings} warnings`);
const edited = await state(`(s) => ({ meshes: s.project.parts.filter((p) => p.kind === 'mesh' && p.visible).length, textured: s.project.parts.filter((p) => p.material?.textureId).length })`);
check('GLB holds every part', glbReport.meshNodes === edited.meshes, `${glbReport.meshNodes} of ${edited.meshes} meshes`);
check('GLB embeds its textures', glbReport.images > 0 && glbReport.embeddedImages === glbReport.images && glbReport.externalRefs === 0, `${glbReport.embeddedImages} embedded`);
await T('import-glb-input').setInputFiles(glbFile.path);
await page.waitForFunction((n) => window.__venture.useStore.getState().project.parts.filter((p) => p.kind === 'mesh').length === n, edited.meshes);
await wait(1200);
check('GLB reimports as editable parts', true, `${edited.meshes} parts`);
check('Reimported GLB keeps textures', (await state(`(s) => s.project.parts.filter((p) => p.material?.textureId).length`)) === edited.textured);
await page.screenshot({ path: join(out, '04-reimported-glb.png') });
await T('import-project-input').setInputFiles(projectFile.path);
await wait(800);

section('Confirm Model');
await T('review').click();
await wait(500);
check('Review mode can be entered', await state(`(s) => s.reviewMode`));
check('Review is ticked in the guided steps', await T('flow-reviewed').evaluate((el) => el.classList.contains('done')));
await page.screenshot({ path: join(out, '05-review.png') });
await T('review').click();
await T('reset-view').click();
await wait(1200);
await T('confirm-model').click();
await T('download-handoff').waitFor({ timeout: 120000 });
await page.screenshot({ path: join(out, '06-confirmed.png') });
for (const k of ['scene', 'export', 'reload', 'assets', 'preview', 'package']) {
  check(`Confirm step "${k}" succeeded`, (await T(`step-${k}`).getAttribute('data-state')) === 'ok');
}
const zipFile = await downloadOf(() => T('download-handoff').click());
check('ZIP has the required name', zipFile.name === 'Venture_3D_Confirmed_Handoff.zip');

async function checkHandoff(bytes, label) {
  const files = unzipSync(new Uint8Array(bytes));
  for (const f of ['model.glb', 'model-manifest.json', 'project.json', 'preview.png', 'README.txt']) {
    check(`${label}: ZIP contains ${f}`, !!files[f]?.length, files[f] ? `${(files[f].length / 1024).toFixed(0)} KB` : 'missing');
  }
  const manifest = JSON.parse(strFromU8(files['model-manifest.json']));
  for (const key of ['schemaVersion', 'projectName', 'modelName', 'modelType', 'confirmedAt', 'dimensions', 'camera', 'scene', 'description', 'hotspots', 'files']) {
    check(`${label}: manifest has ${key}`, manifest[key] !== undefined);
  }
  check(`${label}: model checksum matches manifest`, sha(files['model.glb']) === manifest.files.model.sha256);
  check(`${label}: project checksum matches manifest`, sha(files['project.json']) === manifest.files.project.sha256);
  check(`${label}: preview checksum matches manifest`, sha(files['preview.png']) === manifest.files.preview.sha256);
  check(`${label}: manifest filenames are relative`, Object.values(manifest.files).every((f) => !/^([a-z]+:|\/)/i.test(f.path)));
  const pngSig = Buffer.from(files['preview.png'].subarray(0, 4)).toString('hex');
  check(`${label}: preview.png is a real PNG`, pngSig === '89504e47');
  const report = await validateGlb(files['model.glb'], 'model.glb');
  check(`${label}: model.glb passes the Khronos validator`, report.magicOk && report.issues.numErrors === 0, `${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings, ${report.triangles} triangles`);
  check(`${label}: model.glb matches the manifest counts`, report.meshNodes === manifest.stats.meshes && report.triangles === manifest.stats.triangles);
  check(`${label}: no outside file references`, report.externalRefs === 0);
  const project = JSON.parse(strFromU8(files['project.json']));
  check(`${label}: project.json can be reopened`, project.schema === 'venture3d.project/1' && project.parts.length > 0);
  check(`${label}: project.json records the confirmed snapshot`, project.confirmed?.[0]?.modelSha256 === manifest.files.model.sha256);
  return { files, manifest };
}
const handoff = await checkHandoff(zipFile.bytes, 'Handoff');
check('Hotspot reaches the manifest', handoff.manifest.hotspots[0]?.label === 'Healthy choice' && Array.isArray(handoff.manifest.hotspots[0].position));
check('Scale reaches the manifest', handoff.manifest.dimensions.height > 100, `${handoff.manifest.dimensions.height} cm tall`);
await T('confirm-close').click();
check('Confirmed version is listed', (await state(`(s) => s.project.confirmed[0].version`)) >= 1);
check('Confirm ticks the guided steps', await T('flow-confirmed').evaluate((el) => el.classList.contains('done')));

section('View the model in a separate Three.js page');
writeFileSync(join(out, 'handoff-model.glb'), handoff.files['model.glb']);
const viewer = await context.newPage();
await viewer.goto(new URL('viewer.html', BASE).href);
await viewer.locator('#file').setInputFiles(join(out, 'handoff-model.glb'));
await viewer.waitForFunction(() => window.viewerResult);
const vr = await viewer.evaluate(() => window.viewerResult);
check('Standalone viewer loads model.glb', vr.meshes === handoff.manifest.stats.meshes, `${vr.meshes} meshes`);
check('Standalone viewer sees the right size', Math.abs(vr.height * 100 - handoff.manifest.dimensions.height) < 1, `${(vr.height * 100).toFixed(1)} cm`);
await viewer.waitForTimeout(1500);
const vShot = await viewer.screenshot({ path: join(out, '07-standalone-viewer.png') });
check('Standalone viewer draws the model', vShot.length > 20000);
await viewer.close();

section('Confirm refuses a broken model');
await page.evaluate(() => {
  const s = window.__venture.useStore.getState();
  s.commit((p) => ({ ...p, parts: p.parts.map((x) => ({ ...x, visible: false })) }));
});
await T('confirm-model').click();
await T('confirm-error').waitFor();
const errorText = await T('confirm-error').innerText();
check('Empty scene shows a specific error', errorText.includes('nothing to export'), errorText.split('\n')[1]);
check('No download is offered after a failure', (await T('download-handoff').count()) === 0);
await page.locator('.modal footer button').click();
await T('undo').click();
await wait(300);

section('Templates');
await T('tab-templates').click();
for (const key of ['bottle', 'box', 'bag', 'mascot', 'merch', 'room', 'sculpture']) {
  await T(`template-${key}`).click();
  await wait(900);
  const n = await state(`(s) => s.project.parts.filter((p) => p.kind === 'mesh').length`);
  await page.screenshot({ path: join(out, `template-${key}.png`) });
  await T('tab-project').click();
  const t = await downloadOf(() => T('export-glb').click());
  const r = await validateGlb(t.bytes, t.name);
  check(`${key} template is editable and exports`, n >= 5 && r.issues.numErrors === 0 && r.meshNodes === n, `${n} parts, ${r.issues.numErrors} errors`);
  await T('tab-templates').click();
}
await T('template-concept').click();
await wait(1000);
check('Concept starter can be reopened', (await state(`(s) => s.project.modelName`)) === 'Doctor Mascot');

if (deliverAt) {
  section('Create the clean deliverable');
  const clean = await context.newPage();
  await page.close();
  await clean.goto(BASE);
  await clean.evaluate(() => new Promise((res) => {
    const r = indexedDB.deleteDatabase('venture-3d-studio');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  }));
  await clean.reload();
  await clean.locator('canvas').first().waitFor();
  await clean.waitForTimeout(2500);
  await clean.evaluate(() => window.__venture.useStore.getState().setUI({ showGuide: false }));
  await clean.locator('[data-testid="reset-view"]').click();
  await clean.waitForTimeout(1500);
  mkdirSync(deliverAt, { recursive: true });
  await clean.screenshot({ path: join(deliverAt, 'studio-screenshot.png') });
  const projectDl = await Promise.all([clean.waitForEvent('download'), clean.locator('[data-testid="tab-project"]').click().then(() => clean.locator('[data-testid="export-project"]').click())]);
  await projectDl[0].saveAs(join(deliverAt, 'Doctor_Mascot_Starter.venture3d.json'));
  await clean.locator('[data-testid="confirm-model"]').click();
  await clean.locator('[data-testid="download-handoff"]').waitFor({ timeout: 120000 });
  const [dl] = await Promise.all([clean.waitForEvent('download'), clean.locator('[data-testid="download-handoff"]').click()]);
  const target = join(deliverAt, dl.suggestedFilename());
  await dl.saveAs(target);
  const { files, manifest } = await checkHandoff(readFileSync(target), 'Deliverable');
  writeFileSync(join(deliverAt, 'model.glb'), files['model.glb']);
  writeFileSync(join(deliverAt, 'preview.png'), files['preview.png']);
  console.log(`  Saved to ${deliverAt}: ${manifest.modelName}, ${manifest.dimensions.height} cm tall, ${manifest.stats.meshes} parts`);
}

section('Browser health');
check('No JavaScript errors during the run', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));
check('No failed downloads of site files', badRequests.length === 0, badRequests.slice(0, 5).join(' | '));

await browser.close();
server?.kill();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`Failed:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
