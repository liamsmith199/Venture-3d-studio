import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Asset, Geo, Mat, Part, Project, SceneSettings } from './types';

const D2R = Math.PI / 180;

export function createGeometry(geo: Geo): THREE.BufferGeometry {
  switch (geo.type) {
    case 'box':
      return geo.radius
        ? new RoundedBoxGeometry(geo.w, geo.h, geo.d, 4, Math.min(geo.radius, Math.min(geo.w, geo.h, geo.d) / 2 - 1e-3))
        : new THREE.BoxGeometry(geo.w, geo.h, geo.d);
    case 'sphere':
      return new THREE.SphereGeometry(
        geo.r, 40, 28,
        geo.phiStart ?? 0, geo.phiLength ?? Math.PI * 2,
        geo.thetaStart ?? 0, geo.thetaLength ?? Math.PI,
      );
    case 'cylinder':
      return new THREE.CylinderGeometry(geo.rTop, geo.rBottom, geo.h, geo.seg ?? 40, 1, geo.open ?? false);
    case 'cone':
      return new THREE.ConeGeometry(geo.r, geo.h, geo.seg ?? 32);
    case 'torus':
      return new THREE.TorusGeometry(geo.r, geo.tube, 20, 64, geo.arc ?? Math.PI * 2);
    case 'torusKnot':
      return new THREE.TorusKnotGeometry(geo.r, geo.tube, 180, 24, geo.p, geo.q);
    case 'capsule':
      return new THREE.CapsuleGeometry(geo.r, geo.h, 10, 28);
    case 'plane':
      return new THREE.PlaneGeometry(geo.w, geo.h);
    case 'lathe':
      return new THREE.LatheGeometry(
        geo.points.map(([x, y]) => new THREE.Vector2(x, y)),
        geo.seg ?? 56, geo.phiStart ?? 0, geo.phiLength ?? Math.PI * 2,
      );
    case 'tube': {
      const curve = new THREE.CatmullRomCurve3(geo.points.map((p) => new THREE.Vector3(...p)), geo.closed ?? false);
      return new THREE.TubeGeometry(curve, Math.max(24, geo.points.length * 14), geo.r, 12, geo.closed ?? false);
    }
    case 'extrude': {
      const shape = new THREE.Shape(geo.outline.map(([x, y]) => new THREE.Vector2(x, y)));
      const bevel = geo.bevel ?? 0;
      return new THREE.ExtrudeGeometry(shape, {
        depth: geo.depth,
        bevelEnabled: bevel > 0,
        bevelSize: bevel,
        bevelThickness: bevel,
        bevelSegments: 3,
        curveSegments: 16,
      });
    }
    case 'buffer': {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(geo.position, 3));
      if (geo.normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normal, 3));
      if (geo.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(geo.uv, 2));
      if (geo.index) g.setIndex(geo.index);
      if (!geo.normal) g.computeVertexNormals();
      return g;
    }
  }
}

export function createTexture(image: HTMLImageElement, mat: Mat): THREE.Texture {
  const tex = new THREE.Texture(image);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...(mat.texRepeat ?? [1, 1]));
  tex.offset.set(...(mat.texOffset ?? [0, 0]));
  tex.rotation = (mat.texRotation ?? 0) * D2R;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createMaterial(mat: Mat, map: THREE.Texture | null): THREE.MeshStandardMaterial {
  const transparent = mat.opacity < 1 || !!(mat.cutout && map);
  return new THREE.MeshStandardMaterial({
    color: map ? '#ffffff' : mat.color,
    roughness: mat.roughness,
    metalness: mat.metalness,
    opacity: mat.opacity,
    transparent,
    depthWrite: !transparent,
    side: mat.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: mat.flatShading ?? false,
    map,
  });
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(asset: Asset): Promise<HTMLImageElement> {
  let pending = imageCache.get(asset.id);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`The image "${asset.name}" could not be read.`));
      img.src = asset.dataUrl;
    });
    imageCache.set(asset.id, pending);
  }
  return pending;
}

export function applyTransform(obj: THREE.Object3D, part: Part) {
  obj.position.set(...part.position);
  obj.rotation.set(part.rotation[0] * D2R, part.rotation[1] * D2R, part.rotation[2] * D2R);
  obj.scale.set(...part.scale);
}

/** Builds the model as plain Three.js objects, with no editor helpers. Used for export. */
export async function buildModel(project: Pick<Project, 'parts' | 'assets' | 'cmPerUnit' | 'modelName'>): Promise<THREE.Group> {
  const root = new THREE.Group();
  root.name = project.modelName || 'Model';
  // glTF units are metres, so the root carries the real-world size.
  root.scale.setScalar(project.cmPerUnit / 100);
  const made = new Map<string, THREE.Object3D>();

  for (const part of project.parts) {
    if (!part.visible) continue;
    let obj: THREE.Object3D;
    if (part.kind === 'mesh' && part.geo && part.material) {
      const id = part.material.textureId;
      let map: THREE.Texture | null = null;
      if (id) {
        const asset = project.assets[id];
        if (!asset) throw new Error(`"${part.name}" uses a texture that is missing from this project.`);
        map = createTexture(await loadImage(asset), part.material);
      }
      obj = new THREE.Mesh(createGeometry(part.geo), createMaterial(part.material, map));
      obj.castShadow = true;
      obj.receiveShadow = true;
    } else {
      obj = new THREE.Group();
    }
    obj.name = part.name;
    applyTransform(obj, part);
    made.set(part.id, obj);
  }
  for (const part of project.parts) {
    const obj = made.get(part.id);
    if (!obj) continue;
    const parent = part.parentId ? made.get(part.parentId) : root;
    // A part inside a hidden group stays hidden.
    if (parent) parent.add(obj);
    else if (!part.parentId) root.add(obj);
  }
  return root;
}

export function gradientTexture(top: string, bottom: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const fill = ctx.createLinearGradient(0, 0, 0, 256);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface RigSpec {
  label: string;
  hint: string;
  key: string;
  keyPower: number;
  keyDir: [number, number, number];
  fill: string;
  fillPower: number;
  sky: string;
  ground: string;
  ambient: number;
  env: number;
}

export const LIGHT_PRESETS: Record<SceneSettings['lighting'], RigSpec> = {
  studio: { label: 'Studio', hint: 'Clean, even product light', key: '#ffffff', keyPower: 2.1, keyDir: [3, 6, 4], fill: '#dfeaff', fillPower: 0.7, sky: '#ffffff', ground: '#c9d4cf', ambient: 0.7, env: 0.55 },
  daylight: { label: 'Daylight', hint: 'Bright, natural sun', key: '#fff4dc', keyPower: 2.8, keyDir: [5, 8, 2], fill: '#bcd8ff', fillPower: 0.6, sky: '#cfe8ff', ground: '#b9c7a8', ambient: 0.8, env: 0.5 },
  sunset: { label: 'Sunset', hint: 'Warm, low, dramatic', key: '#ffb074', keyPower: 2.8, keyDir: [6, 2.6, 3], fill: '#8d7dff', fillPower: 0.75, sky: '#ffc9a3', ground: '#6a4a63', ambient: 0.55, env: 0.35 },
  gallery: { label: 'Gallery', hint: 'Focused spotlight feel', key: '#fff8ee', keyPower: 3.2, keyDir: [1.5, 8, 2.5], fill: '#ffffff', fillPower: 0.25, sky: '#d8d8d8', ground: '#55504c', ambient: 0.35, env: 0.3 },
  night: { label: 'Night', hint: 'Cool, moody contrast', key: '#a9c4ff', keyPower: 2.1, keyDir: [-4, 6, 3], fill: '#57e0c0', fillPower: 0.7, sky: '#32405e', ground: '#10141f', ambient: 0.5, env: 0.22 },
};

/** Lights for both the editor viewport and the preview render, so the two match. */
export function createLightRig(settings: SceneSettings, radius: number, center: THREE.Vector3): THREE.Group {
  const spec = LIGHT_PRESETS[settings.lighting] ?? LIGHT_PRESETS.studio;
  const power = settings.lightIntensity;
  const rig = new THREE.Group();
  rig.name = 'Lights';

  const key = new THREE.DirectionalLight(spec.key, spec.keyPower * power);
  const dir = new THREE.Vector3(...spec.keyDir).normalize();
  key.position.copy(center).addScaledVector(dir, radius * 4);
  key.target.position.copy(center);
  key.castShadow = settings.shadows;
  key.shadow.mapSize.set(2048, 2048);
  const span = radius * 1.8;
  Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.01, far: radius * 10 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02 * radius;
  rig.add(key, key.target);

  const fill = new THREE.DirectionalLight(spec.fill, spec.fillPower * power);
  fill.position.copy(center).add(new THREE.Vector3(-dir.x, 0.25, dir.z * 0.6).multiplyScalar(radius * 4));
  fill.target.position.copy(center);
  rig.add(fill, fill.target);

  rig.add(new THREE.HemisphereLight(spec.sky, spec.ground, spec.ambient * power));
  return rig;
}

export function environmentIntensity(settings: SceneSettings): number {
  return (LIGHT_PRESETS[settings.lighting] ?? LIGHT_PRESETS.studio).env * settings.lightIntensity;
}
