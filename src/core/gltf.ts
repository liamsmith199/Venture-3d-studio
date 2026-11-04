import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Asset, Mat, Part, Project, Vec3 } from './types';
import { round } from './store';
import { matte, newId } from '../templates/kit';

export function exportGlb(model: THREE.Object3D): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      model,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
        else reject(new Error('The exporter did not produce a binary GLB file.'));
      },
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
      { binary: true, onlyVisible: true, maxTextureSize: 2048 },
    );
  });
}

export function parseGlb(bytes: Uint8Array): Promise<THREE.Group> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      buffer, '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

/** Reads the JSON chunk straight out of the GLB, without going through Three.js. */
export function readGlbJson(bytes: Uint8Array): any {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('This file is not a GLB model.');
  const length = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
}

export function modelStats(model: THREE.Object3D) {
  let meshes = 0;
  let triangles = 0;
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  const box = new THREE.Box3().setFromObject(model);
  return { meshes, triangles: Math.round(triangles), box };
}

function imageToAsset(tex: THREE.Texture, name: string): Asset | null {
  const img = tex.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return { id: newId(), name, mime: 'image/png', dataUrl: canvas.toDataURL('image/png'), width: img.width, height: img.height };
}

const toVec3 = (v: { x: number; y: number; z: number }): Vec3 => [round(v.x, 5), round(v.y, 5), round(v.z, 5)];
const f = 180 / Math.PI;

/**
 * Turns a GLB into editable parts, keeping its node tree, geometry, materials and textures.
 * Animations, skinning and morph targets are not kept because the studio has no tools for them.
 */
export async function projectFromGlb(bytes: Uint8Array, fileName: string, base: Project): Promise<Project> {
  const scene = await parseGlb(bytes);
  const { meshes, box } = modelStats(scene);
  if (!meshes) throw new Error('This GLB has no visible meshes to edit.');
  const size = box.getSize(new THREE.Vector3());
  const heightMetres = size.y || Math.max(size.x, size.z);
  if (!isFinite(heightMetres) || heightMetres <= 0) throw new Error('This GLB has an empty or invalid size.');

  // Authoring scale: the imported model is shown about 3 units tall, like the templates.
  const normal = 3 / heightMetres;
  const center = box.getCenter(new THREE.Vector3());
  const parts: Part[] = [];
  const assets = { ...base.assets };
  const seen = new Map<THREE.Texture, string>();

  const rootId = newId();
  parts.push({
    id: rootId, name: fileName.replace(/\.glb$/i, ''), parentId: null, kind: 'group',
    position: toVec3({ x: -center.x * normal, y: -box.min.y * normal, z: -center.z * normal }),
    rotation: [0, 0, 0], scale: [normal, normal, normal], visible: true,
  });

  const walk = (obj: THREE.Object3D, parentId: string) => {
    const mesh = obj as THREE.Mesh;
    const id = newId();
    const part: Part = {
      id, parentId, name: obj.name || (mesh.isMesh ? 'Mesh' : 'Group'),
      kind: mesh.isMesh ? 'mesh' : 'group',
      position: toVec3(obj.position),
      rotation: toVec3({ x: obj.rotation.x * f, y: obj.rotation.y * f, z: obj.rotation.z * f }),
      scale: toVec3(obj.scale),
      visible: obj.visible,
    };
    if (mesh.isMesh) {
      const g = mesh.geometry;
      part.geo = {
        type: 'buffer',
        position: Array.from(g.attributes.position.array),
        normal: g.attributes.normal ? Array.from(g.attributes.normal.array) : undefined,
        uv: g.attributes.uv ? Array.from(g.attributes.uv.array) : undefined,
        index: g.index ? Array.from(g.index.array) : undefined,
      };
      const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      const material: Mat = matte(`#${source.color?.getHexString() ?? 'cccccc'}`, {
        roughness: source.roughness ?? 0.6,
        metalness: source.metalness ?? 0,
        opacity: source.opacity ?? 1,
        doubleSided: source.side === THREE.DoubleSide,
        flatShading: source.flatShading,
      });
      if (source.map) {
        let assetId = seen.get(source.map);
        if (!assetId) {
          const asset = imageToAsset(source.map, source.map.name || `${part.name} texture`);
          if (asset) {
            assets[asset.id] = asset;
            assetId = asset.id;
            seen.set(source.map, asset.id);
          }
        }
        if (assetId) {
          material.textureId = assetId;
          material.cutout = source.transparent;
          material.texRepeat = [source.map.repeat.x, source.map.repeat.y];
          material.texOffset = [source.map.offset.x, source.map.offset.y];
          material.texRotation = source.map.rotation * f;
        }
      }
      part.material = material;
    }
    parts.push(part);
    obj.children.forEach((c) => walk(c, id));
  };
  scene.children.forEach((c) => walk(c, rootId));

  const baseline: Record<string, Part> = {};
  parts.forEach((p) => (baseline[p.id] = p));
  return {
    ...base,
    id: newId(),
    modelName: fileName.replace(/\.glb$/i, ''),
    sourceNote: `Imported from the GLB file "${fileName}". Parts can be edited, but animations and rigging are not kept.`,
    cmPerUnit: (heightMetres * 100) / 3,
    parts,
    baseline,
    assets,
    hotspots: [],
    framing: undefined,
    updatedAt: new Date().toISOString(),
  };
}
