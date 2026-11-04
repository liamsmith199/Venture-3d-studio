import * as THREE from 'three';
import type { Geo, Mat, Part, Project, SceneSettings, Vec3, ModelType } from '../core/types';
import { PROJECT_SCHEMA } from '../core/types';

export const newId = () => Math.random().toString(36).slice(2, 11);

export const matte = (color: string, over: Partial<Mat> = {}): Mat => ({
  color, roughness: 0.6, metalness: 0, opacity: 1, ...over,
});

interface Opts {
  p?: Vec3;
  r?: Vec3;
  s?: Vec3;
}

/** Collects parts in tree order while a template or starter model is being authored. */
export class Kit {
  parts: Part[] = [];
  private stack: (string | null)[] = [null];

  private add(name: string, kind: Part['kind'], o: Opts, geo?: Geo, material?: Mat): Part {
    const part: Part = {
      id: newId(), name, kind, parentId: this.stack[this.stack.length - 1],
      position: o.p ?? [0, 0, 0], rotation: o.r ?? [0, 0, 0], scale: o.s ?? [1, 1, 1],
      visible: true,
    };
    if (geo) part.geo = geo;
    if (material) part.material = { ...material };
    this.parts.push(part);
    return part;
  }

  mesh(name: string, geo: Geo, material: Mat, o: Opts = {}) {
    return this.add(name, 'mesh', o, geo, material);
  }

  group(name: string, o: Opts, build: () => void) {
    const part = this.add(name, 'group', o);
    this.stack.push(part.id);
    build();
    this.stack.pop();
    return part;
  }

  /** A tapered cylinder running from point a to point b. */
  limb(name: string, a: Vec3, b: Vec3, rA: number, rB: number, material: Mat) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    return this.mesh(name, { type: 'cylinder', rTop: rB, rBottom: rA, h: dir.length() }, material, {
      p: [mid.x, mid.y, mid.z], r: pointAlong(dir),
    });
  }
}

/** Euler angles in degrees that turn a shape's +Y axis to face along dir. */
export function pointAlong(dir: THREE.Vector3): Vec3 {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  const f = 180 / Math.PI;
  return [e.x * f, e.y * f, e.z * f];
}

export const DEFAULT_SCENE: SceneSettings = {
  bgTop: '#f2fbf6', bgBottom: '#d6ece1', lighting: 'studio', lightIntensity: 1, shadows: true,
};

export interface Blueprint {
  key: string;
  title: string;
  blurb: string;
  modelName: string;
  modelType: ModelType;
  description: string;
  /** Real-world height of the model, in centimetres. */
  heightCm: number;
  /** Height of the authored model, in scene units. */
  heightUnits: number;
  scene?: Partial<SceneSettings>;
  sourceNote: string;
  build: (k: Kit) => void;
}

export function projectFromBlueprint(bp: Blueprint, keep?: Partial<Pick<Project, 'assets' | 'refs' | 'name' | 'versions' | 'confirmed'>>): Project {
  const kit = new Kit();
  bp.build(kit);
  const baseline: Record<string, Part> = {};
  for (const p of kit.parts) baseline[p.id] = p;
  return {
    schema: PROJECT_SCHEMA,
    id: newId(),
    name: keep?.name ?? 'My Venture Project',
    modelName: bp.modelName,
    modelType: bp.modelType,
    description: bp.description,
    sourceNote: bp.sourceNote,
    cmPerUnit: bp.heightCm / bp.heightUnits,
    displayUnit: 'cm',
    parts: kit.parts,
    baseline,
    assets: keep?.assets ?? {},
    refs: keep?.refs ?? [],
    scene: { ...DEFAULT_SCENE, ...bp.scene },
    hotspots: [],
    versions: keep?.versions ?? [],
    confirmed: keep?.confirmed ?? [],
    updatedAt: new Date().toISOString(),
  };
}
