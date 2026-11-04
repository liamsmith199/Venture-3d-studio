import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { buildModel, createLightRig, environmentIntensity, gradientTexture, LIGHT_PRESETS } from './build';
import { exportGlb, modelStats, parseGlb, readGlbJson } from './gltf';
import { MODEL_TYPE_LABELS, type Framing, type Project } from './types';
import { round } from './store';

export const HANDOFF_ZIP = 'Venture_3D_Confirmed_Handoff.zip';
export const MANIFEST_SCHEMA = 'venture3d.handoff/1.0';
const SIZE_WARN_BYTES = 25 * 1024 * 1024;

export type StepState = 'pending' | 'running' | 'ok' | 'error';
export interface Step {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
}

export const CONFIRM_STEPS: Pick<Step, 'key' | 'label'>[] = [
  { key: 'scene', label: 'Check that the scene is usable' },
  { key: 'export', label: 'Export real 3D geometry to GLB' },
  { key: 'reload', label: 'Reload the GLB separately and compare it' },
  { key: 'assets', label: 'Check that textures are inside the file' },
  { key: 'preview', label: 'Render a preview from the exported model' },
  { key: 'package', label: 'Build and verify the handoff ZIP' },
];

export interface HandoffResult {
  zip: Uint8Array;
  glb: Uint8Array;
  previewUrl: string;
  manifest: any;
  warnings: string[];
  project: Project;
}

async function sha256(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Renders any model in its own short-lived WebGL context, separate from the editor. */
export async function renderPreview(model: THREE.Object3D, project: Project, framing: Framing, width = 1200, height = 900): Promise<Uint8Array> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = project.scene.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const background = gradientTexture(project.scene.bgTop, project.scene.bgBottom);
  scene.background = background;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = environmentIntensity(project.scene);

  const clone = model.clone(true);
  // The glTF loader keeps node scale, so metres are converted back to authoring units here.
  const toUnits = 100 / project.cmPerUnit;
  const holder = new THREE.Group();
  holder.scale.setScalar(toUnits);
  holder.add(clone);
  clone.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(holder);
  holder.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(holder);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.01);
  scene.add(createLightRig(project.scene, radius, center));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(radius * 40, radius * 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = box.min.y - 0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(framing.fov, width / height, radius / 100, radius * 40);
  camera.position.set(...framing.position);
  camera.lookAt(...framing.target);
  renderer.render(scene, camera);

  const blob = await new Promise<Blob | null>((resolve) => renderer.domElement.toBlob(resolve, 'image/png'));
  floor.geometry.dispose();
  (floor.material as THREE.Material).dispose();
  background.dispose();
  env.dispose();
  pmrem.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  if (!blob) throw new Error('The browser could not create the preview image.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** A framing that shows the whole model when the student has not chosen one. */
export function defaultFraming(project: Project, box: THREE.Box3): Framing {
  const toUnits = 100 / project.cmPerUnit;
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(toUnits);
  const radius = (box.getSize(new THREE.Vector3()).length() / 2) * toUnits;
  const fov = 35;
  const dist = (radius / Math.sin((fov * Math.PI) / 360)) * 1.08;
  const dir = new THREE.Vector3(0.4, 0.14, 1).normalize();
  const pos = center.clone().addScaledVector(dir, dist);
  return { projection: 'perspective', position: [pos.x, pos.y, pos.z], target: [center.x, center.y, center.z], fov };
}

function readme(project: Project, manifest: any): string {
  const d = manifest.dimensions;
  return `VENTURE 3D STUDIO: CONFIRMED MODEL HANDOFF
==========================================
Project: ${project.name}
Model:   ${project.modelName} (${MODEL_TYPE_LABELS[project.modelType]})
Version: ${manifest.modelVersion}, confirmed ${manifest.confirmedAt}
Size:    ${d.width} x ${d.height} x ${d.depth} ${d.unit} (width x height x depth)

WHAT IS IN THIS ZIP
model.glb            The confirmed 3D model. Textures are stored inside the file.
model-manifest.json  Machine-readable details (see schemaVersion).
project.json         Editable copy. Open it with Import Project in the studio.
preview.png          A picture rendered from model.glb.
README.txt           This file.

FOR MISSION 3
1. Keep this ZIP. Unzip it when you are ready to add the model to your website.
2. Put model.glb, model-manifest.json and preview.png together in one website folder.
3. Show model.glb with a Three.js GLTFLoader or the <model-viewer> web component.
4. Use "camera", "scene" and "hotspots" in model-manifest.json to match this design.
5. Use preview.png as the loading image and as the fallback if 3D is unavailable.

GOOD TO KNOW
- GLB units are metres. Y is up and the front of the model faces +Z.
- Check model.glb against files.model.sha256 in the manifest to confirm it is unchanged.
- Confirming did not publish anything or change your venture website.
- Source: ${project.sourceNote}
`;
}

export async function runConfirm(
  project: Project,
  framing: Framing | undefined,
  onStep: (key: string, state: StepState, detail?: string) => void,
): Promise<HandoffResult> {
  const warnings: string[] = [];
  let current = 'scene';
  const start = (key: string) => {
    current = key;
    onStep(key, 'running');
  };
  try {
    // 1. Scene
    start('scene');
    const visibleMeshes = project.parts.filter((p) => p.kind === 'mesh' && p.visible);
    if (!visibleMeshes.length) throw new Error('There is nothing to export. Add a part or show a hidden part first.');
    for (const p of project.parts) {
      if (![...p.position, ...p.rotation, ...p.scale].every(Number.isFinite)) {
        throw new Error(`"${p.name}" has an invalid position, rotation or size. Reset that part and try again.`);
      }
      if (p.scale.some((s) => s === 0)) throw new Error(`"${p.name}" has a size of zero, which cannot be exported.`);
    }
    const missing = visibleMeshes.find((p) => p.material?.textureId && !project.assets[p.material.textureId]);
    if (missing) throw new Error(`"${missing.name}" uses a texture that is missing from this project.`);
    const model = await buildModel(project);
    const built = modelStats(model);
    const builtSize = built.box.getSize(new THREE.Vector3());
    if (built.box.isEmpty() || ![builtSize.x, builtSize.y, builtSize.z].every((v) => Number.isFinite(v) && v >= 0)) {
      throw new Error('The model has no measurable size, so it cannot be exported.');
    }
    onStep('scene', 'ok', `${built.meshes} parts, ${built.triangles.toLocaleString()} triangles`);

    // 2. Export
    start('export');
    const glb = await exportGlb(model);
    if (glb.byteLength < 100) throw new Error('The exported GLB is unexpectedly empty.');
    if (glb.byteLength > SIZE_WARN_BYTES) warnings.push(`The model is ${(glb.byteLength / 1048576).toFixed(1)} MB, which may load slowly on a website. Try smaller images.`);
    onStep('export', 'ok', `${(glb.byteLength / 1024).toFixed(0)} KB`);

    // 3. Independent reload
    start('reload');
    const reloaded = await parseGlb(glb);
    const check = modelStats(reloaded);
    if (check.meshes !== built.meshes) throw new Error(`The reloaded GLB has ${check.meshes} parts, but ${built.meshes} were exported.`);
    if (check.triangles !== built.triangles) throw new Error(`The reloaded GLB has ${check.triangles} triangles, but ${built.triangles} were exported.`);
    const a = check.box.getSize(new THREE.Vector3());
    const b = builtSize;
    if (a.distanceTo(b) > 0.01 * Math.max(b.length(), 0.001)) throw new Error('The reloaded GLB has a different size from the design.');
    onStep('reload', 'ok', `${check.meshes} parts match`);

    // 4. Assets
    start('assets');
    const json = readGlbJson(glb);
    const external = (json.images ?? []).filter((i: any) => i.uri);
    const buffers = (json.buffers ?? []).filter((x: any) => x.uri);
    if (external.length || buffers.length) throw new Error('The GLB points at outside files, so it would break when moved.');
    const usedTextures = new Set(visibleMeshes.map((p) => p.material?.textureId).filter(Boolean));
    if (usedTextures.size && !(json.images ?? []).length) throw new Error('Textures were applied, but none reached the GLB.');
    let reloadedMaps = 0;
    reloaded.traverse((o) => {
      if (((o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined)?.map) reloadedMaps++;
    });
    const expectedMaps = visibleMeshes.filter((p) => p.material?.textureId).length;
    if (reloadedMaps !== expectedMaps) throw new Error(`${expectedMaps} parts have textures, but only ${reloadedMaps} kept them after reloading.`);
    onStep('assets', 'ok', usedTextures.size ? `${(json.images ?? []).length} embedded, no outside links` : 'No textures used, no outside links');

    // 5. Preview from the exported model, not the editor scene
    start('preview');
    const useFraming = framing ?? project.framing ?? defaultFraming(project, check.box);
    const preview = await renderPreview(reloaded, project, useFraming);
    if (preview.byteLength < 2000) throw new Error('The preview image came out blank.');
    onStep('preview', 'ok', '1200 x 900 PNG');

    // 6. Package
    start('package');
    const version = (project.confirmed[0]?.version ?? 0) + 1;
    const confirmedAt = new Date().toISOString();
    const modelSha = await sha256(glb);
    const center = check.box.getCenter(new THREE.Vector3());
    const unitToMetres = project.cmPerUnit / 100;
    const toMetres = (v: number[]) => v.map((n) => round(n * unitToMetres, 4));
    const worldOfPart = await hotspotPositions(project);

    const nextProject: Project = {
      ...project,
      framing: useFraming,
      updatedAt: confirmedAt,
      confirmed: [
        { version, confirmedAt, modelSha256: modelSha, modelBytes: glb.byteLength, parts: project.parts, scene: project.scene, cmPerUnit: project.cmPerUnit },
        ...project.confirmed,
      ].slice(0, 10),
    };
    const projectBytes = strToU8(JSON.stringify(nextProject));

    const manifest = {
      schemaVersion: MANIFEST_SCHEMA,
      projectName: project.name,
      modelName: project.modelName,
      modelType: project.modelType,
      modelVersion: version,
      confirmedAt,
      generator: 'Venture 3D Studio',
      description: project.description,
      sourceNote: project.sourceNote,
      dimensions: {
        width: round(a.x * 100, 2), height: round(a.y * 100, 2), depth: round(a.z * 100, 2), unit: 'cm',
        center: { x: round(center.x, 4), y: round(center.y, 4), z: round(center.z, 4), unit: 'm' },
      },
      coordinateSystem: { up: '+Y', front: '+Z', units: 'metres' },
      camera: {
        projection: useFraming.projection,
        position: toMetres(useFraming.position),
        target: toMetres(useFraming.target),
        fovDegrees: useFraming.fov,
      },
      scene: {
        backgroundTop: project.scene.bgTop,
        backgroundBottom: project.scene.bgBottom,
        lighting: project.scene.lighting,
        lightingLabel: LIGHT_PRESETS[project.scene.lighting]?.label,
        lightIntensity: project.scene.lightIntensity,
        shadows: project.scene.shadows,
      },
      hotspots: project.hotspots.map((h) => ({
        id: h.id, label: h.label, description: h.description, part: project.parts.find((p) => p.id === h.partId)?.name ?? '',
        position: worldOfPart.get(h.partId) ?? null,
      })),
      stats: { meshes: check.meshes, triangles: check.triangles, embeddedImages: (json.images ?? []).length },
      files: {
        model: { path: 'model.glb', bytes: glb.byteLength, sha256: modelSha },
        project: { path: 'project.json', bytes: projectBytes.byteLength, sha256: await sha256(projectBytes) },
        preview: { path: 'preview.png', bytes: preview.byteLength, sha256: await sha256(preview) },
        readme: { path: 'README.txt' },
      },
    };

    const zip = zipSync({
      'model.glb': [glb, { level: 6 }],
      'model-manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
      'project.json': projectBytes,
      'preview.png': [preview, { level: 0 }],
      'README.txt': strToU8(readme(project, manifest)),
    });

    const opened = unzipSync(zip);
    for (const name of ['model.glb', 'model-manifest.json', 'project.json', 'preview.png', 'README.txt']) {
      if (!opened[name]?.byteLength) throw new Error(`The ZIP is missing ${name}.`);
    }
    if ((await sha256(opened['model.glb'])) !== modelSha) throw new Error('model.glb in the ZIP does not match its checksum.');
    onStep('package', 'ok', `${(zip.byteLength / 1024).toFixed(0)} KB, 5 files checked`);

    const previewUrl = URL.createObjectURL(new Blob([preview as BlobPart], { type: 'image/png' }));
    return { zip, glb, previewUrl, manifest, warnings, project: nextProject };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onStep(current, 'error', message);
    throw err instanceof Error ? err : new Error(message);
  }
}

/** The centre of each hotspot's part, in the metres used by model.glb. */
async function hotspotPositions(project: Project): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!project.hotspots.length) return out;
  const named = {
    ...project,
    parts: project.parts.map((p) => ({ ...p, name: `__${p.id}` })),
  };
  const model = await buildModel(named);
  model.updateMatrixWorld(true);
  for (const h of project.hotspots) {
    const obj = model.getObjectByName(`__${h.partId}`);
    if (!obj) continue;
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    out.set(h.partId, [round(c.x, 4), round(c.y, 4), round(c.z, 4)]);
  }
  return out;
}
