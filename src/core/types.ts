export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type Geo =
  | { type: 'box'; w: number; h: number; d: number; radius?: number }
  | { type: 'sphere'; r: number; thetaStart?: number; thetaLength?: number; phiStart?: number; phiLength?: number }
  | { type: 'cylinder'; rTop: number; rBottom: number; h: number; seg?: number; open?: boolean }
  | { type: 'cone'; r: number; h: number; seg?: number }
  | { type: 'torus'; r: number; tube: number; arc?: number }
  | { type: 'torusKnot'; r: number; tube: number; p: number; q: number }
  | { type: 'capsule'; r: number; h: number }
  | { type: 'plane'; w: number; h: number }
  | { type: 'lathe'; points: Vec2[]; phiStart?: number; phiLength?: number; seg?: number }
  | { type: 'tube'; points: Vec3[]; r: number; closed?: boolean }
  | { type: 'extrude'; outline: Vec2[]; depth: number; bevel?: number }
  | { type: 'buffer'; position: number[]; normal?: number[]; uv?: number[]; index?: number[] };

export interface Mat {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  doubleSided?: boolean;
  flatShading?: boolean;
  /** Keeps a texture's transparent pixels see-through (stickers and logos). */
  cutout?: boolean;
  textureId?: string | null;
  texRepeat?: Vec2;
  texOffset?: Vec2;
  texRotation?: number;
}

export interface Part {
  id: string;
  name: string;
  parentId: string | null;
  kind: 'group' | 'mesh';
  geo?: Geo;
  material?: Mat;
  position: Vec3;
  /** Degrees, XYZ order. */
  rotation: Vec3;
  scale: Vec3;
  visible: boolean;
}

export interface Asset {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  width: number;
  height: number;
}

export type RefView = 'front' | 'side' | 'back' | 'other';
export interface RefImage {
  assetId: string;
  view: RefView;
}

export type LightPreset = 'studio' | 'daylight' | 'sunset' | 'gallery' | 'night';

export interface SceneSettings {
  bgTop: string;
  bgBottom: string;
  lighting: LightPreset;
  lightIntensity: number;
  shadows: boolean;
}

export interface Hotspot {
  id: string;
  partId: string;
  label: string;
  description: string;
}

export interface SavedVersion {
  id: string;
  label: string;
  savedAt: string;
  parts: Part[];
  scene: SceneSettings;
  cmPerUnit: number;
}

export interface ConfirmedRecord {
  version: number;
  confirmedAt: string;
  modelSha256: string;
  modelBytes: number;
  parts: Part[];
  scene: SceneSettings;
  cmPerUnit: number;
}

export interface Framing {
  projection: 'perspective' | 'orthographic';
  position: Vec3;
  target: Vec3;
  fov: number;
}

export type ModelType = 'physical-product' | 'brand-mascot' | 'merchandise' | 'service-environment' | 'symbolic-object';

export const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  'physical-product': 'Physical product',
  'brand-mascot': 'Brand mascot',
  merchandise: 'Merchandise',
  'service-environment': 'Service environment',
  'symbolic-object': 'Symbolic object',
};

export const PROJECT_SCHEMA = 'venture3d.project/1';

export interface Project {
  schema: typeof PROJECT_SCHEMA;
  id: string;
  name: string;
  modelName: string;
  modelType: ModelType;
  description: string;
  /** Explains where the starting geometry came from. Shown in the Project tab and the handoff. */
  sourceNote: string;
  /** Real-world centimetres represented by one scene unit. */
  cmPerUnit: number;
  displayUnit: 'cm' | 'in';
  parts: Part[];
  /** Each part as it first appeared; "Reset this part" restores from here. */
  baseline: Record<string, Part>;
  assets: Record<string, Asset>;
  refs: RefImage[];
  scene: SceneSettings;
  hotspots: Hotspot[];
  versions: SavedVersion[];
  confirmed: ConfirmedRecord[];
  framing?: Framing;
  updatedAt: string;
}
