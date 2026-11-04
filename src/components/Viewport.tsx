import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Grid, Html, OrbitControls, OrthographicCamera, PerspectiveCamera, TransformControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createGeometry, createLightRig, createMaterial, createTexture, environmentIntensity, gradientTexture, loadImage } from '../core/build';
import { round, roundVec, useStore, type CamPreset } from '../core/store';
import type { Framing, Part, Vec3 } from '../core/types';

/** Handles to the live scene, for the panels and for Confirm Model. */
export const live = {
  objects: new Map<string, THREE.Object3D>(),
  root: null as THREE.Group | null,
  framing: null as Framing | null,
  camera: null as THREE.Camera | null,
};

const R2D = 180 / Math.PI;
const D2R = Math.PI / 180;

function useAssetImage(assetId?: string | null) {
  const asset = useStore((s) => (assetId ? s.project.assets[assetId] : undefined));
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let on = true;
    if (!asset) {
      setImage(null);
      return;
    }
    loadImage(asset).then((img) => on && setImage(img)).catch(() => on && setImage(null));
    return () => {
      on = false;
    };
  }, [asset]);
  return image;
}

function PartMesh({ part, onPick }: { part: Part; onPick: (e: ThreeEvent<MouseEvent>, id: string) => void }) {
  const image = useAssetImage(part.material?.textureId);
  const geometry = useMemo(() => createGeometry(part.geo!), [part.geo]);
  const material = useMemo(() => {
    const m = part.material!;
    return createMaterial(m, image && m.textureId ? createTexture(image, m) : null);
  }, [part.material, image]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => {
    material.map?.dispose();
    material.dispose();
  }, [material]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow onClick={(e) => onPick(e, part.id)} />;
}

function PartNode({ part, kids, onPick }: { part: Part; kids: Map<string | null, Part[]>; onPick: (e: ThreeEvent<MouseEvent>, id: string) => void }) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    const obj = ref.current;
    if (!obj) return;
    live.objects.set(part.id, obj);
    return () => {
      if (live.objects.get(part.id) === obj) live.objects.delete(part.id);
    };
  }, [part.id]);
  return (
    <group
      ref={ref}
      visible={part.visible}
      position={part.position}
      rotation={[part.rotation[0] * D2R, part.rotation[1] * D2R, part.rotation[2] * D2R]}
      scale={part.scale}
    >
      {part.kind === 'mesh' && part.geo && part.material && <PartMesh part={part} onPick={onPick} />}
      {kids.get(part.id)?.map((k) => <PartNode key={k.id} part={k} kids={kids} onPick={onPick} />)}
    </group>
  );
}

const gizmo = { busy: false, endedAt: 0 };

function Model() {
  const parts = useStore((s) => s.project.parts);
  const cmPerUnit = useStore((s) => s.project.cmPerUnit);
  void cmPerUnit;
  const kids = useMemo(() => {
    const map = new Map<string | null, Part[]>();
    for (const p of parts) {
      const list = map.get(p.parentId) ?? [];
      list.push(p);
      map.set(p.parentId, list);
    }
    return map;
  }, [parts]);

  // First click picks the larger group; clicking inside it again steps down to the single piece.
  const onPick = (e: ThreeEvent<MouseEvent>, id: string) => {
    e.stopPropagation();
    if (e.delta > 4 || gizmo.busy || performance.now() - gizmo.endedAt < 200) return;
    const s = useStore.getState();
    if (s.reviewMode) return;
    const chain: string[] = [];
    let at: Part | undefined = s.project.parts.find((p) => p.id === id);
    while (at) {
      chain.unshift(at.id);
      const up: string | null = at.parentId;
      at = up ? s.project.parts.find((p) => p.id === up) : undefined;
    }
    const i = s.selectedId ? chain.indexOf(s.selectedId) : -1;
    s.select(i >= 0 && i < chain.length - 1 ? chain[i + 1] : chain[0]);
  };

  return (
    <group ref={(g) => { live.root = g; }}>
      {kids.get(null)?.map((p) => <PartNode key={p.id} part={p} kids={kids} onPick={onPick} />)}
    </group>
  );
}

function Stage() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const settings = useStore((s) => s.project.scene);
  const parts = useStore((s) => s.project.parts);
  const [rig, setRig] = useState<THREE.Group | null>(null);
  const [floorY, setFloorY] = useState(0);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.environmentIntensity = environmentIntensity(settings);
  }, [scene, settings]);

  useEffect(() => {
    const tex = gradientTexture(settings.bgTop, settings.bgBottom);
    scene.background = tex;
    return () => {
      scene.background = null;
      tex.dispose();
    };
  }, [scene, settings.bgTop, settings.bgBottom]);

  // Lights and floor follow the model's size once its parts have mounted.
  useEffect(() => {
    const id = setTimeout(() => {
      const root = live.root;
      if (!root) return;
      const box = new THREE.Box3().setFromObject(root);
      if (box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.5);
      setRig(createLightRig(settings, radius, center));
      setFloorY(box.min.y);
    }, 30);
    return () => clearTimeout(id);
  }, [settings, parts]);

  useEffect(() => () => rig?.traverse((o) => (o as THREE.Light).dispose?.()), [rig]);

  return (
    <>
      {rig && <primitive object={rig} />}
      {settings.shadows && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY - 0.002, 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[200, 200]} />
          <shadowMaterial opacity={0.22} />
        </mesh>
      )}
    </>
  );
}

function Helpers() {
  const showGrid = useStore((s) => s.showGrid);
  const showAxes = useStore((s) => s.showAxes);
  const review = useStore((s) => s.reviewMode);
  if (review) return null;
  return (
    <>
      {showGrid && (
        <Grid
          position={[0, -0.001, 0]} infiniteGrid fadeDistance={26} fadeStrength={1.6} cellSize={0.25} sectionSize={1}
          cellThickness={0.5} sectionThickness={1} cellColor="#7c8f88" sectionColor="#51635d" raycast={() => null}
        />
      )}
      {showAxes && <axesHelper args={[1.6]} raycast={() => null} />}
    </>
  );
}

function SelectionBox() {
  const selectedId = useStore((s) => s.selectedId);
  const review = useStore((s) => s.reviewMode);
  const helper = useMemo(() => {
    const h = new THREE.BoxHelper(new THREE.Object3D(), '#12b886');
    h.raycast = () => null;
    (h.material as THREE.LineBasicMaterial).depthTest = false;
    (h.material as THREE.LineBasicMaterial).transparent = true;
    h.renderOrder = 10;
    return h;
  }, []);
  useFrame(() => {
    const obj = selectedId ? live.objects.get(selectedId) : null;
    helper.visible = !!obj && !review;
    if (obj) {
      helper.setFromObject(obj);
    }
  });
  return <primitive object={helper} />;
}

function Gizmo() {
  const selectedId = useStore((s) => s.selectedId);
  const tool = useStore((s) => s.tool);
  const review = useStore((s) => s.reviewMode);
  const parts = useStore((s) => s.project.parts);
  const [object, setObject] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    // A new part's object appears a frame after the selection changes.
    const id = requestAnimationFrame(() => setObject(selectedId ? live.objects.get(selectedId) ?? null : null));
    return () => cancelAnimationFrame(id);
  }, [selectedId, parts]);

  if (!object || !selectedId || tool === 'select' || review) return null;
  const pull = () => {
    useStore.getState().liveTransform(selectedId, {
      position: roundVec([object.position.x, object.position.y, object.position.z]),
      rotation: roundVec([object.rotation.x * R2D, object.rotation.y * R2D, object.rotation.z * R2D], 3),
      scale: roundVec([object.scale.x, object.scale.y, object.scale.z]).map((n) => (Math.abs(n) < 0.001 ? 0.001 : n)) as Vec3,
    });
  };
  return (
    <TransformControls
      object={object}
      mode={tool}
      size={0.85}
      onMouseDown={() => {
        gizmo.busy = true;
        useStore.getState().beginTransform();
      }}
      onMouseUp={() => {
        gizmo.busy = false;
        gizmo.endedAt = performance.now();
        pull();
      }}
      onObjectChange={() => {
        if (gizmo.busy) pull();
      }}
    />
  );
}

const DIRS: Record<Exclude<CamPreset, 'selection'>, Vec3> = {
  hero: [0.42, 0.16, 1],
  front: [0, 0, 1],
  back: [0, 0, -1],
  side: [1, 0, 0],
  top: [0, 1, 0.0015],
  iso: [1, 0.8, 1],
};

function CameraRig() {
  const projection = useStore((s) => s.projection);
  const cmd = useStore((s) => s.cameraCmd);
  const panMode = useStore((s) => s.panMode);
  const review = useStore((s) => s.reviewMode);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useRef<any>(null);
  const pending = useRef<CamPreset | null>('hero');
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; fromZ: number; toZ: number; t: number } | null>(null);
  const lastCamera = useRef<THREE.Camera | null>(null);
  const lastView = useRef({ pos: new THREE.Vector3(1, 1, 6), target: new THREE.Vector3(0, 1.4, 0) });
  const userMoved = useRef(false);

  useEffect(() => {
    pending.current = cmd.preset;
    userMoved.current = false;
  }, [cmd]);

  // Keep the model framed when the window changes, unless the student has moved the camera.
  useEffect(() => {
    if (!userMoved.current) pending.current = useStore.getState().cameraCmd.preset;
  }, [size.width, size.height]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || c.object !== camera) return;

    // After switching projection, keep looking from the same place.
    if (lastCamera.current !== camera) {
      const first = lastCamera.current === null;
      lastCamera.current = camera;
      if (!first) {
        camera.position.copy(lastView.current.pos);
        c.target.copy(lastView.current.target);
        if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
          const dist = lastView.current.pos.distanceTo(lastView.current.target);
          const ortho = camera as THREE.OrthographicCamera;
          ortho.zoom = size.height / (2 * dist * Math.tan((35 * Math.PI) / 360));
          ortho.updateProjectionMatrix();
        }
        c.update();
      }
    }

    if (pending.current) {
      const root = live.root;
      const preset = pending.current;
      const selected = useStore.getState().selectedId;
      const focus = preset === 'selection' && selected ? live.objects.get(selected) : root;
      const box = focus ? new THREE.Box3().setFromObject(focus) : new THREE.Box3();
      if (!box.isEmpty()) {
        pending.current = null;
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05);
        const dir = preset === 'selection'
          ? camera.position.clone().sub(c.target).normalize()
          : new THREE.Vector3(...DIRS[preset]).normalize();
        const aspect = size.width / Math.max(size.height, 1);
        const fit = radius * 1.12 / Math.min(1, aspect);
        const isOrtho = (camera as THREE.OrthographicCamera).isOrthographicCamera;
        const dist = isOrtho ? radius * 8 : fit / Math.sin((35 * Math.PI) / 360);
        anim.current = {
          from: camera.position.clone(), to: center.clone().addScaledVector(dir, dist),
          fromT: c.target.clone(), toT: center,
          fromZ: camera.zoom, toZ: isOrtho ? size.height / (2 * fit) : 1, t: 0,
        };
      }
    }

    if (anim.current) {
      const a = anim.current;
      a.t = Math.min(1, a.t + dt / 0.55);
      const e = 1 - Math.pow(1 - a.t, 3);
      camera.position.lerpVectors(a.from, a.to, e);
      c.target.lerpVectors(a.fromT, a.toT, e);
      camera.zoom = THREE.MathUtils.lerp(a.fromZ, a.toZ, e);
      camera.updateProjectionMatrix();
      c.update();
      if (a.t >= 1) anim.current = null;
    }

    lastView.current.pos.copy(camera.position);
    lastView.current.target.copy(c.target);
    live.camera = camera;
    live.framing = {
      projection,
      position: roundVec([camera.position.x, camera.position.y, camera.position.z]),
      target: roundVec([c.target.x, c.target.y, c.target.z]),
      fov: (camera as THREE.PerspectiveCamera).fov ?? 35,
    };
  });

  return (
    <>
      {projection === 'perspective' ? (
        <PerspectiveCamera makeDefault fov={35} near={0.02} far={400} position={[2, 2.2, 8]} />
      ) : (
        <OrthographicCamera makeDefault near={-200} far={400} zoom={120} position={[2, 2.2, 8]} />
      )}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={review}
        autoRotateSpeed={1.4}
        mouseButtons={{
          LEFT: panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: panMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
        }}
        onStart={() => {
          anim.current = null;
          userMoved.current = true;
          useStore.getState().mark('explored');
        }}
      />
    </>
  );
}

function HotspotPins() {
  const review = useStore((s) => s.reviewMode);
  const hotspots = useStore((s) => s.project.hotspots);
  const [points, setPoints] = useState<{ id: string; label: string; description: string; at: Vec3 }[]>([]);
  useEffect(() => {
    if (!review) return;
    setPoints(hotspots.flatMap((h) => {
      const obj = live.objects.get(h.partId);
      if (!obj) return [];
      const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
      return [{ id: h.id, label: h.label, description: h.description, at: [round(c.x), round(c.y), round(c.z)] as Vec3 }];
    }));
  }, [review, hotspots]);
  if (!review) return null;
  return (
    <>
      {points.map((p) => (
        <Html key={p.id} position={p.at} center zIndexRange={[20, 0]}>
          <div className="pin" title={p.description}>
            <i />
            <span>{p.label}</span>
          </div>
        </Html>
      ))}
    </>
  );
}

export function Viewport() {
  const select = useStore((s) => s.select);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1 }}
      onPointerMissed={(e) => {
        if (e.button === 0 && !gizmo.busy && performance.now() - gizmo.endedAt > 200) select(null);
      }}
    >
      <CameraRig />
      <Stage />
      <Model />
      <Helpers />
      <SelectionBox />
      <Gizmo />
      <HotspotPins />
    </Canvas>
  );
}
