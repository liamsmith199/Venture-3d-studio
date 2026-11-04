// A standalone Three.js viewer. It deliberately imports nothing from the studio.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const statusEl = document.getElementById('status')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfe9e4');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.position.set(3, 6, 4);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
camera.position.set(1, 1, 4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let current: THREE.Object3D | null = null;

async function show(buffer: ArrayBuffer, name: string) {
  statusEl.textContent = `Loading ${name}`;
  try {
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    if (current) scene.remove(current);
    current = gltf.scene;
    scene.add(current);
    const box = new THREE.Box3().setFromObject(current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.001);
    controls.target.copy(center);
    camera.near = radius / 100;
    camera.far = radius * 100;
    camera.position.copy(center).add(new THREE.Vector3(0.4, 0.15, 1).normalize().multiplyScalar((radius / Math.sin((35 * Math.PI) / 360)) * 1.1));
    camera.updateProjectionMatrix();
    let meshes = 0;
    current.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
    });
    const result = { name, meshes, width: size.x, height: size.y, depth: size.z };
    (window as unknown as { viewerResult: typeof result }).viewerResult = result;
    statusEl.textContent = `${name}: ${meshes} meshes, ${(size.x * 100).toFixed(1)} x ${(size.y * 100).toFixed(1)} x ${(size.z * 100).toFixed(1)} cm`;
  } catch (err) {
    statusEl.textContent = `This file could not be displayed: ${(err as Error).message}`;
  }
}

document.getElementById('file')!.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) show(await file.arrayBuffer(), file.name);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
