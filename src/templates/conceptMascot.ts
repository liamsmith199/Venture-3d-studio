import * as THREE from 'three';
import type { Vec2, Vec3 } from '../core/types';
import { matte, pointAlong, type Blueprint, type Kit } from './kit';

const SKIN = matte('#f2d3b5', { roughness: 0.55 });
const HAIR = matte('#2e2120', { roughness: 0.32 });
const COAT = matte('#f6f6f3', { roughness: 0.62, doubleSided: true });
const SCRUB = matte('#7fdcb4', { roughness: 0.7 });
const JEANS = matte('#1f3a78', { roughness: 0.75 });
const BOOT = matte('#7b4a2c', { roughness: 0.45 });
const SOLE = matte('#f7f7f4', { roughness: 0.6 });
const TUBE = matte('#34383d', { roughness: 0.35 });
const STEEL = matte('#c8ccd0', { roughness: 0.25, metalness: 0.9 });

function buildHair(k: Kit) {
  const c = new THREE.Vector3(0, 2.4, -0.05);
  k.group('Hair', {}, () => {
    // The cap tilts back: a high hairline at the forehead, low at the back of the neck.
    k.mesh('Hair cap', { type: 'sphere', r: 0.552, thetaLength: Math.PI * 0.5 }, HAIR, { p: [0, 2.24, 0], r: [-30, 0, 0] });
    k.mesh('Hairline band', { type: 'torus', r: 0.548, tube: 0.035 }, HAIR, { p: [0, 2.24, 0], r: [60, 0, 0] });

    // Rings of spikes, each pointing outward from the middle of the head.
    const rings: [number, number, number, number][] = [
      // elevation, count, spike length, spike radius
      [20, 13, 0.24, 0.1],
      [42, 12, 0.3, 0.115],
      [64, 8, 0.32, 0.12],
      [86, 3, 0.3, 0.115],
    ];
    rings.forEach(([elev, count, len, rad], ring) => {
      for (let i = 0; i < count; i++) {
        const az = ((i + (ring % 2) * 0.5) / count) * Math.PI * 2;
        const e = (elev * Math.PI) / 180;
        const dir = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e));
        const wobble = 1 + 0.12 * Math.sin(i * 2.4 + ring);
        const base = 0.44;
        const at = c.clone().addScaledVector(dir, base + (len * wobble) / 2);
        k.mesh(`Spike ${ring + 1}-${i + 1}`, { type: 'cone', r: rad, h: len * wobble, seg: 7 }, HAIR, {
          p: [at.x, at.y, at.z], r: pointAlong(dir),
        });
      }
    });

    // The rounded tufts seen on the back of the head in the concept.
    const tufts: Vec3[] = [[-0.27, 2.18, -0.46], [0, 2.12, -0.52], [0.27, 2.18, -0.46], [-0.14, 2.36, -0.49], [0.14, 2.36, -0.49]];
    tufts.forEach((p, i) => k.mesh(`Back tuft ${i + 1}`, { type: 'sphere', r: 0.15 }, HAIR, { p }));
  });
}

function mouthOutline(w: number, h: number): Vec2[] {
  const pts: Vec2[] = [[-w, 0], [w, 0]];
  for (let i = 1; i < 18; i++) {
    const a = (i / 18) * Math.PI;
    pts.push([Math.cos(a) * w, -Math.sin(a) * h]);
  }
  return pts;
}

function buildHead(k: Kit) {
  k.group('Head', {}, () => {
    k.mesh('Face', { type: 'sphere', r: 0.52 }, SKIN, { p: [0, 2.24, 0], s: [1, 0.98, 0.98] });
    k.mesh('Neck', { type: 'cylinder', rTop: 0.13, rBottom: 0.14, h: 0.14 }, SKIN, { p: [0, 1.78, 0] });
    k.mesh('Nose', { type: 'sphere', r: 0.042 }, matte('#eec6a4', { roughness: 0.5 }), { p: [0, 2.23, 0.51] });
    for (const [side, x] of [['Left', 0.51], ['Right', -0.51]] as const) {
      k.mesh(`${side} ear`, { type: 'sphere', r: 0.085 }, SKIN, { p: [x, 2.17, 0.03], s: [0.6, 1, 0.8] });
      const eyeX = Math.sign(x) * 0.185;
      k.mesh(`${side} eye`, { type: 'sphere', r: 0.058 }, matte('#191514', { roughness: 0.15 }), { p: [eyeX, 2.31, 0.465], s: [0.95, 1.12, 0.5] });
      k.mesh(`${side} eye sparkle`, { type: 'sphere', r: 0.017 }, matte('#ffffff', { roughness: 0.2 }), { p: [eyeX + 0.018, 2.335, 0.492] });
      k.mesh(`${side} eyebrow`, { type: 'capsule', r: 0.016, h: 0.085 }, HAIR, { p: [eyeX, 2.42, 0.45], r: [0, 0, 90 + Math.sign(x) * 6] });
      k.mesh(`${side} cheek`, { type: 'sphere', r: 0.082 }, matte('#f2a39a', { opacity: 0.5 }), { p: [Math.sign(x) * 0.31, 2.17, 0.4], r: [0, Math.sign(x) * 38, 0], s: [1, 0.72, 0.16] });
    }
    k.group('Smile', { p: [0, 2.13, 0.462], r: [-8, 0, 0] }, () => {
      k.mesh('Mouth', { type: 'extrude', outline: mouthOutline(0.125, 0.105), depth: 0.05 }, matte('#7d1f22', { roughness: 0.5 }));
      k.mesh('Teeth', { type: 'box', w: 0.19, h: 0.03, d: 0.03, radius: 0.01 }, matte('#ffffff', { roughness: 0.3 }), { p: [0, -0.02, 0.043] });
      k.mesh('Tongue', { type: 'sphere', r: 0.055 }, matte('#e8585b', { roughness: 0.45 }), { p: [0, -0.075, 0.03], s: [1.05, 0.55, 0.45] });
    });
  });
  buildHair(k);
}

function buildCoat(k: Kit) {
  const gap = (42 * Math.PI) / 180;
  k.group('Scrubs', {}, () => {
    k.mesh('Scrub top', { type: 'lathe', points: [[0.32, 0.72], [0.325, 1.2], [0.31, 1.6], [0.22, 1.78], [0.12, 1.84]] }, SCRUB);
  });
  k.group('Lab coat', {}, () => {
    k.mesh('Coat body', {
      type: 'lathe',
      points: [[0.49, 0.6], [0.44, 0.9], [0.385, 1.2], [0.37, 1.5], [0.345, 1.67], [0.25, 1.79], [0.145, 1.85]],
      phiStart: gap / 2, phiLength: Math.PI * 2 - gap,
    }, COAT);
    k.mesh('Coat hem', { type: 'torus', r: 0.488, tube: 0.012, arc: Math.PI * 2 - gap }, COAT, { p: [0, 0.6, 0], r: [90, 0, 90 + 21 - 0] });

    for (const [side, m] of [['Left', 1], ['Right', -1]] as const) {
      // Lapels form the V at the chest.
      k.mesh(`${side} lapel`, {
        type: 'extrude',
        outline: [[0.035, 0], [0.135, 0.04], [0.19, 0.42], [0.1, 0.46]].map(([x, y]) => [m * x, y] as Vec2),
        depth: 0.02, bevel: 0.006,
      }, COAT, { p: [0, 1.36, 0.325], r: [-13, 0, 0] });
      k.mesh(`${side} collar`, { type: 'capsule', r: 0.032, h: 0.2 }, COAT, {
        p: [m * 0.13, 1.82, 0.075], r: [-18, 0, -m * 62],
      });
      // The arm hangs out from the shoulder to the hand holding the food.
      const shoulder: Vec3 = [m * 0.36, 1.63, 0];
      const elbow: Vec3 = [m * 0.5, 1.26, 0.03];
      const wrist: Vec3 = [m * 0.57, 1.0, 0.1];
      k.group(`${side} sleeve`, {}, () => {
        k.mesh('Shoulder', { type: 'sphere', r: 0.118 }, COAT, { p: shoulder });
        k.limb('Upper sleeve', shoulder, elbow, 0.118, 0.112, COAT);
        k.mesh('Elbow', { type: 'sphere', r: 0.112 }, COAT, { p: elbow });
        k.limb('Lower sleeve', elbow, wrist, 0.112, 0.105, COAT);
        k.limb('Cuff', wrist, [m * 0.58, 0.965, 0.11], 0.108, 0.108, COAT);
      });
      k.group(`${side} hand`, { p: [m * 0.59, 0.9, 0.125] }, () => {
        k.mesh('Palm', { type: 'sphere', r: 0.092 }, SKIN);
        k.mesh('Thumb', { type: 'capsule', r: 0.027, h: 0.055 }, SKIN, { p: [-m * 0.07, 0.03, 0.05], r: [20, 0, m * 30] });
      });
      k.mesh(`${side} pocket`, { type: 'box', w: 0.23, h: 0.2, d: 0.012, radius: 0.005 }, matte('#ecece8', { roughness: 0.65 }), {
        p: [m * 0.27, 0.8, 0.42], r: [-11, m * 33, 0],
      });
    }

    k.mesh('Chest pocket', { type: 'box', w: 0.15, h: 0.13, d: 0.012, radius: 0.005 }, matte('#ecece8', { roughness: 0.65 }), { p: [0.255, 1.38, 0.3], r: [0, 40, 0] });
    k.mesh('Pen', { type: 'capsule', r: 0.012, h: 0.11 }, matte('#3b82f6', { roughness: 0.3 }), { p: [0.255, 1.46, 0.31], r: [0, 40, 0] });
    k.mesh('Badge', { type: 'cylinder', rTop: 0.042, rBottom: 0.042, h: 0.012 }, matte('#22a06b', { roughness: 0.4 }), { p: [-0.255, 1.4, 0.3], r: [90, 0, -40] });

    k.group('Back belt', { p: [0, 1.08, -0.385] }, () => {
      k.mesh('Belt', { type: 'box', w: 0.3, h: 0.045, d: 0.015, radius: 0.005 }, matte('#ecece8', { roughness: 0.65 }));
      for (const x of [-0.1, 0.1]) {
        k.mesh(`Button ${x < 0 ? 'A' : 'B'}`, { type: 'cylinder', rTop: 0.014, rBottom: 0.014, h: 0.012 }, matte('#9aa0a6', { roughness: 0.35 }), { p: [x, 0, -0.012], r: [90, 0, 0] });
      }
    });
  });
}

function buildStethoscope(k: Kit) {
  k.group('Stethoscope', {}, () => {
    k.mesh('Neck loop', {
      type: 'tube', r: 0.019,
      points: [[0.19, 1.28, 0.38], [0.2, 1.5, 0.35], [0.17, 1.72, 0.26], [0.1, 1.84, 0.1], [0, 1.88, -0.05], [-0.1, 1.84, 0.1], [-0.17, 1.72, 0.26], [-0.2, 1.5, 0.35], [-0.17, 1.38, 0.375]],
    }, TUBE);
    k.mesh('Chest piece', { type: 'cylinder', rTop: 0.052, rBottom: 0.052, h: 0.026 }, TUBE, { p: [0.19, 1.25, 0.385], r: [90, 0, 0] });
    k.mesh('Chest piece rim', { type: 'torus', r: 0.05, tube: 0.008 }, STEEL, { p: [0.19, 1.25, 0.4] });
    k.mesh('Ear fitting', { type: 'torus', r: 0.03, tube: 0.009 }, STEEL, { p: [-0.17, 1.345, 0.378] });
  });
}

function buildLegs(k: Kit) {
  k.group('Legs and boots', {}, () => {
    k.mesh('Hips', { type: 'cylinder', rTop: 0.3, rBottom: 0.31, h: 0.2 }, JEANS, { p: [0, 0.74, 0] });
    for (const [side, m] of [['Left', 1], ['Right', -1]] as const) {
      const x = m * 0.165;
      k.mesh(`${side} jeans leg`, { type: 'cylinder', rTop: 0.135, rBottom: 0.12, h: 0.42 }, JEANS, { p: [x, 0.53, 0] });
      k.mesh(`${side} boot shaft`, { type: 'cylinder', rTop: 0.135, rBottom: 0.125, h: 0.22 }, BOOT, { p: [x, 0.25, 0] });
      k.mesh(`${side} boot cuff`, { type: 'torus', r: 0.128, tube: 0.018 }, matte('#6b3f25', { roughness: 0.5 }), { p: [x, 0.36, 0], r: [90, 0, 0] });
      k.mesh(`${side} boot toe`, { type: 'sphere', r: 0.135 }, matte('#8a5733', { roughness: 0.38 }), { p: [x, 0.16, 0.075], s: [0.98, 0.72, 1.28] });
      k.mesh(`${side} sole`, { type: 'box', w: 0.27, h: 0.07, d: 0.42, radius: 0.03 }, SOLE, { p: [x, 0.035, 0.05] });
    }
  });
}

function appleProfile(): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * Math.PI;
    // Heart-shaped section gives the dimples at the stem and base.
    const r = 0.15 * Math.sin(t) * (1 + 0.14 * Math.cos(t));
    const y = -0.15 * Math.cos(t) * (1 - 0.18 * Math.sin(t) * Math.sin(t));
    pts.push([Math.max(r, 0.0001), y]);
  }
  return pts;
}

function buildFood(k: Kit) {
  const GREEN = matte('#2fa34a', { roughness: 0.8 });
  k.group('Apple', { p: [-0.62, 1.09, 0.15] }, () => {
    k.mesh('Apple body', { type: 'lathe', points: appleProfile() }, matte('#d9191f', { roughness: 0.25 }));
    k.mesh('Stem', { type: 'cylinder', rTop: 0.01, rBottom: 0.008, h: 0.09 }, matte('#6b4226'), { p: [0.008, 0.16, 0], r: [0, 0, -10] });
    k.mesh('Leaf', { type: 'sphere', r: 0.05 }, matte('#3fa34d', { roughness: 0.5 }), { p: [0.055, 0.175, 0], r: [0, 0, -30], s: [1.1, 0.25, 0.6] });
  });
  k.group('Broccoli', { p: [0.625, 1.09, 0.15] }, () => {
    k.mesh('Stalk', { type: 'cylinder', rTop: 0.06, rBottom: 0.042, h: 0.24 }, matte('#a9d98a', { roughness: 0.7 }), { p: [0, -0.04, 0] });
    const buds: [Vec3, number][] = [
      [[0, 0.17, 0], 0.095], [[-0.1, 0.13, 0.02], 0.075], [[0.1, 0.13, 0.02], 0.075], [[0, 0.13, 0.095], 0.075],
      [[0, 0.13, -0.09], 0.07], [[-0.07, 0.2, 0.06], 0.06], [[0.07, 0.2, 0.06], 0.06], [[-0.07, 0.2, -0.05], 0.058],
      [[0.07, 0.2, -0.05], 0.058], [[-0.14, 0.08, 0.05], 0.05], [[0.14, 0.08, 0.05], 0.05],
    ];
    buds.forEach(([p, r], i) => k.mesh(`Floret ${i + 1}`, { type: 'sphere', r }, GREEN, { p }));
  });
}

export const conceptMascot: Blueprint = {
  key: 'concept',
  title: 'Concept starter: doctor mascot',
  blurb: 'Your Mission 1 concept, already built from editable parts.',
  modelName: 'Doctor Mascot',
  modelType: 'brand-mascot',
  description: 'A friendly doctor mascot with spiky dark hair, a white lab coat, mint scrubs and a stethoscope, holding an apple and broccoli.',
  heightCm: 120,
  heightUnits: 3.19,
  scene: { bgTop: '#f4fcf8', bgBottom: '#d5ebe0' },
  sourceNote:
    'Stylized approximation, hand-built as editable parts during development by looking at the Mission 1 concept image. It is not an automatic image-to-3D reconstruction, and proportions and details are interpreted.',
  build: (k) => {
    buildLegs(k);
    buildCoat(k);
    buildStethoscope(k);
    buildHead(k);
    buildFood(k);
  },
};
