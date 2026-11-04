import type { Vec2, Vec3 } from '../core/types';
import { conceptMascot } from './conceptMascot';
import { matte, type Blueprint } from './kit';

const TEMPLATE_NOTE = 'Built-in editable template made from simple parts. It is not based on an uploaded image.';

const bottle: Blueprint = {
  key: 'bottle', title: 'Bottle', blurb: 'Cylindrical drink or skincare product.',
  modelName: 'Bottle', modelType: 'physical-product', description: 'A reusable bottle with a wrap-around label and a screw cap.',
  heightCm: 24, heightUnits: 3.1, scene: { bgTop: '#eef4ff', bgBottom: '#cfdcf2' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    const profile: Vec2[] = [[0.0001, 0], [0.52, 0], [0.6, 0.08], [0.62, 0.3], [0.62, 1.75], [0.56, 2.05], [0.36, 2.35], [0.28, 2.45], [0.28, 2.65]];
    k.mesh('Bottle body', { type: 'lathe', points: profile }, matte('#2f6fed', { roughness: 0.28, metalness: 0.35 }));
    k.mesh('Label', { type: 'cylinder', rTop: 0.628, rBottom: 0.628, h: 0.9, open: true }, matte('#f6f7fb', { roughness: 0.5, doubleSided: true }), { p: [0, 1.05, 0] });
    k.group('Cap', { p: [0, 2.85, 0] }, () => {
      k.mesh('Cap body', { type: 'cylinder', rTop: 0.33, rBottom: 0.34, h: 0.42, seg: 28 }, matte('#10192e', { roughness: 0.4 }));
      k.mesh('Cap top', { type: 'sphere', r: 0.33, thetaLength: Math.PI / 2 }, matte('#10192e', { roughness: 0.4 }), { p: [0, 0.21, 0], s: [1, 0.15, 1] });
    });
    k.mesh('Base ring', { type: 'torus', r: 0.56, tube: 0.05 }, matte('#10192e', { roughness: 0.5 }), { p: [0, 0.05, 0], r: [90, 0, 0] });
  },
};

const box: Blueprint = {
  key: 'box', title: 'Product box', blurb: 'Rectangular retail or consumer packaging.',
  modelName: 'Product Box', modelType: 'physical-product', description: 'A retail gift box with a separate lid, a colored band and a seal.',
  heightCm: 18, heightUnits: 2.4, scene: { bgTop: '#fff5ec', bgBottom: '#f4dcc9' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    k.mesh('Box base', { type: 'box', w: 2.2, h: 1.8, d: 1.5, radius: 0.04 }, matte('#f4ede2'), { p: [0, 0.9, 0] });
    k.mesh('Lid', { type: 'box', w: 2.3, h: 0.6, d: 1.6, radius: 0.05 }, matte('#c8553d', { roughness: 0.45 }), { p: [0, 2.1, 0] });
    k.mesh('Front band', { type: 'box', w: 0.5, h: 1.82, d: 1.54 }, matte('#28334a', { roughness: 0.5 }), { p: [0, 0.9, 0] });
    k.mesh('Lid band', { type: 'box', w: 0.5, h: 0.62, d: 1.64 }, matte('#28334a', { roughness: 0.5 }), { p: [0, 2.1, 0] });
    k.mesh('Seal', { type: 'cylinder', rTop: 0.26, rBottom: 0.26, h: 0.03 }, matte('#d9a441', { roughness: 0.25, metalness: 0.85 }), { p: [0, 1.75, 0.82], r: [90, 0, 0] });
  },
};

const bag: Blueprint = {
  key: 'bag', title: 'Bag or organizer', blurb: 'Soft goods with straps, flap and pocket.',
  modelName: 'Everyday Bag', modelType: 'physical-product', description: 'A structured everyday bag with a flap, a front pocket and carry straps.',
  heightCm: 42, heightUnits: 3.2, scene: { bgTop: '#f6f1ff', bgBottom: '#dcd2ee' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    const canvas = matte('#3f6f5e', { roughness: 0.85 });
    const trim = matte('#a8693c', { roughness: 0.5 });
    k.mesh('Main body', { type: 'box', w: 2.4, h: 2, d: 0.9, radius: 0.18 }, canvas, { p: [0, 1, 0] });
    k.mesh('Top flap', { type: 'box', w: 2.42, h: 0.85, d: 0.1, radius: 0.05 }, matte('#2f5649', { roughness: 0.85 }), { p: [0, 1.62, 0.47] });
    k.mesh('Front pocket', { type: 'box', w: 1.7, h: 0.8, d: 0.12, radius: 0.05 }, matte('#4c8270', { roughness: 0.85 }), { p: [0, 0.56, 0.47] });
    k.mesh('Zipper', { type: 'box', w: 1.5, h: 0.035, d: 0.03 }, matte('#d6d9dc', { metalness: 0.9, roughness: 0.3 }), { p: [0, 0.85, 0.54] });
    k.mesh('Buckle', { type: 'box', w: 0.26, h: 0.2, d: 0.06, radius: 0.02 }, matte('#d9a441', { metalness: 0.9, roughness: 0.3 }), { p: [0, 1.28, 0.54] });
    for (const [side, z] of [['Front', 0.32], ['Back', -0.32]] as const) {
      const pts: Vec3[] = [[-0.62, 1.9, z], [-0.55, 2.6, z], [0, 3.05, z], [0.55, 2.6, z], [0.62, 1.9, z]];
      k.mesh(`${side} strap`, { type: 'tube', points: pts, r: 0.05 }, trim);
    }
  },
};

const companion: Blueprint = {
  key: 'mascot', title: 'Mascot character', blurb: 'A friendly round robot to reshape.',
  modelName: 'Sprout Bot', modelType: 'brand-mascot', description: 'A round, friendly robot character with a sprout antenna.',
  heightCm: 60, heightUnits: 3.2, scene: { bgTop: '#eefcff', bgBottom: '#c8e8ef' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    const shell = matte('#ffb627', { roughness: 0.35 });
    const dark = matte('#1e2a38', { roughness: 0.3 });
    k.mesh('Body', { type: 'sphere', r: 0.72 }, shell, { p: [0, 1, 0], s: [1, 0.95, 0.9] });
    k.mesh('Belly', { type: 'sphere', r: 0.42 }, matte('#fff4d6', { roughness: 0.5 }), { p: [0, 0.92, 0.42], s: [1, 1, 0.5] });
    k.group('Head', { p: [0, 2.05, 0] }, () => {
      k.mesh('Head shell', { type: 'box', w: 1.25, h: 0.9, d: 0.95, radius: 0.3 }, shell);
      k.mesh('Face screen', { type: 'box', w: 0.98, h: 0.6, d: 0.1, radius: 0.04 }, dark, { p: [0, 0, 0.45] });
      for (const x of [-0.23, 0.23]) k.mesh(x < 0 ? 'Right eye' : 'Left eye', { type: 'sphere', r: 0.085 }, matte('#6ff2c1', { roughness: 0.2 }), { p: [x, 0.05, 0.5], s: [1, 1, 0.4] });
      k.mesh('Smile', { type: 'torus', r: 0.14, tube: 0.022, arc: Math.PI }, matte('#6ff2c1', { roughness: 0.2 }), { p: [0, -0.04, 0.5], r: [0, 0, 180] });
    });
    k.group('Antenna', { p: [0, 2.5, 0] }, () => {
      k.mesh('Stem', { type: 'cylinder', rTop: 0.025, rBottom: 0.035, h: 0.32 }, matte('#3fa34d'), { p: [0, 0.16, 0] });
      k.mesh('Leaf A', { type: 'sphere', r: 0.14 }, matte('#59c36a', { roughness: 0.5 }), { p: [0.13, 0.36, 0], r: [0, 0, -35], s: [1.2, 0.3, 0.7] });
      k.mesh('Leaf B', { type: 'sphere', r: 0.12 }, matte('#59c36a', { roughness: 0.5 }), { p: [-0.12, 0.33, 0], r: [0, 0, 35], s: [1.2, 0.3, 0.7] });
    });
    for (const [side, m] of [['Left', 1], ['Right', -1]] as const) {
      k.limb(`${side} arm`, [m * 0.65, 1.3, 0], [m * 1.02, 0.85, 0.12], 0.09, 0.08, dark);
      k.mesh(`${side} hand`, { type: 'sphere', r: 0.15 }, shell, { p: [m * 1.05, 0.8, 0.13] });
      k.mesh(`${side} foot`, { type: 'capsule', r: 0.17, h: 0.22 }, dark, { p: [m * 0.33, 0.17, 0.08], r: [90, 0, 0] });
    }
  },
};

const mug: Blueprint = {
  key: 'merch', title: 'Branded merchandise', blurb: 'A mug and coaster ready for your logo.',
  modelName: 'Branded Mug', modelType: 'merchandise', description: 'A ceramic branded mug on a cork coaster with space for a logo.',
  heightCm: 10.5, heightUnits: 2.4, scene: { bgTop: '#fdf3f2', bgBottom: '#f2d3cf' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    const ceramic = matte('#fdfaf5', { roughness: 0.25 });
    k.mesh('Coaster', { type: 'cylinder', rTop: 1.45, rBottom: 1.45, h: 0.12 }, matte('#b58a5c', { roughness: 0.9 }), { p: [0, 0.06, 0] });
    k.mesh('Mug body', {
      type: 'lathe',
      points: [[0.0001, 0.12], [0.86, 0.12], [0.95, 0.2], [0.98, 0.4], [0.98, 2.3], [0.95, 2.36], [0.88, 2.36], [0.86, 2.3], [0.86, 0.3], [0.0001, 0.3]],
    }, ceramic);
    k.mesh('Coffee', { type: 'cylinder', rTop: 0.86, rBottom: 0.86, h: 0.02 }, matte('#3d2314', { roughness: 0.15 }), { p: [0, 2.05, 0] });
    k.mesh('Handle', { type: 'torus', r: 0.56, tube: 0.1, arc: Math.PI }, ceramic, { p: [0.92, 1.25, 0], r: [0, 0, -90], s: [1.1, 0.8, 1] });
    k.mesh('Color band', { type: 'cylinder', rTop: 0.985, rBottom: 0.985, h: 0.28, open: true }, matte('#e0524d', { roughness: 0.3, doubleSided: true }), { p: [0, 2.05, 0] });
    // Curved to follow the mug, centred on the front. Wrap a logo image over it.
    k.mesh('Logo panel', { type: 'lathe', points: [[0.992, 0.72], [0.992, 1.58]], phiStart: -0.6, phiLength: 1.2, seg: 24 }, matte('#e0524d', { roughness: 0.35, doubleSided: true }));
  },
};

const room: Blueprint = {
  key: 'room', title: 'Service space', blurb: 'A small cafe or clinic room setup.',
  modelName: 'Service Space', modelType: 'service-environment', description: 'A welcoming service space with a counter, seating, plants and pendant lights.',
  heightCm: 300, heightUnits: 3.2, scene: { bgTop: '#f3f1ec', bgBottom: '#ddd8cc' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    const wood = matte('#b98a5b', { roughness: 0.6 });
    k.group('Shell', {}, () => {
      k.mesh('Floor', { type: 'box', w: 6, h: 0.1, d: 5 }, matte('#d9c9b0', { roughness: 0.75 }), { p: [0, -0.05, 0] });
      k.mesh('Back wall', { type: 'box', w: 6, h: 3.2, d: 0.1 }, matte('#7fb6a4', { roughness: 0.85 }), { p: [0, 1.6, -2.55] });
      k.mesh('Side wall', { type: 'box', w: 0.1, h: 3.2, d: 5 }, matte('#eae5d8', { roughness: 0.85 }), { p: [-3.05, 1.6, 0] });
    });
    k.group('Service counter', { p: [-0.8, 0, -1.3] }, () => {
      k.mesh('Counter base', { type: 'box', w: 2.8, h: 1, d: 0.8, radius: 0.03 }, matte('#37544c', { roughness: 0.55 }), { p: [0, 0.5, 0] });
      k.mesh('Counter top', { type: 'box', w: 3, h: 0.08, d: 0.95, radius: 0.02 }, wood, { p: [0, 1.04, 0] });
      k.mesh('Sign panel', { type: 'box', w: 1.8, h: 0.6, d: 0.04 }, matte('#f7f3e9'), { p: [0, 2.1, -1.17] });
    });
    k.group('Table set', { p: [1.5, 0, 0.7] }, () => {
      k.mesh('Tabletop', { type: 'cylinder', rTop: 0.6, rBottom: 0.6, h: 0.06 }, wood, { p: [0, 0.76, 0] });
      k.mesh('Table leg', { type: 'cylinder', rTop: 0.04, rBottom: 0.07, h: 0.75 }, matte('#2a2a2a', { metalness: 0.6, roughness: 0.4 }), { p: [0, 0.37, 0] });
      for (const [n, x, z] of [['Stool A', -0.95, 0.1], ['Stool B', 0.95, -0.1], ['Stool C', 0, 0.95]] as const) {
        k.mesh(n, { type: 'cylinder', rTop: 0.24, rBottom: 0.2, h: 0.46 }, matte('#d97b52', { roughness: 0.6 }), { p: [x, 0.23, z] });
      }
    });
    k.group('Plant', { p: [2.4, 0, -2] }, () => {
      k.mesh('Pot', { type: 'cylinder', rTop: 0.3, rBottom: 0.22, h: 0.5 }, matte('#f4efe4', { roughness: 0.5 }), { p: [0, 0.25, 0] });
      for (const [i, p] of ([[0, 0.9, 0], [0.22, 0.75, 0.1], [-0.2, 0.72, 0.12], [0, 0.72, -0.2], [0, 1.15, 0.05]] as Vec3[]).entries()) {
        k.mesh(`Foliage ${i + 1}`, { type: 'sphere', r: 0.28 - i * 0.015 }, matte('#3d8a55', { roughness: 0.8 }), { p });
      }
    });
    k.group('Pendant lights', {}, () => {
      for (const x of [-1.7, -0.8, 0.1]) {
        k.mesh(`Cord ${x}`, { type: 'cylinder', rTop: 0.008, rBottom: 0.008, h: 0.8 }, matte('#222222'), { p: [x, 2.8, -1.3] });
        k.mesh(`Shade ${x}`, { type: 'sphere', r: 0.17, thetaLength: Math.PI / 2 }, matte('#d9a441', { metalness: 0.85, roughness: 0.3, doubleSided: true }), { p: [x, 2.28, -1.3] });
      }
    });
  },
};

const sculpture: Blueprint = {
  key: 'sculpture', title: 'Symbolic sculpture', blurb: 'An abstract form for a brand idea.',
  modelName: 'Symbolic Sculpture', modelType: 'symbolic-object', description: 'An abstract sculpture of a metal knot and orbiting rings on a stone plinth.',
  heightCm: 80, heightUnits: 3.3, scene: { bgTop: '#21283a', bgBottom: '#0f1320', lighting: 'gallery' }, sourceNote: TEMPLATE_NOTE,
  build: (k) => {
    const brass = matte('#e5b567', { metalness: 1, roughness: 0.22 });
    k.mesh('Plinth', { type: 'cylinder', rTop: 0.8, rBottom: 0.95, h: 0.4, seg: 8 }, matte('#59606e', { roughness: 0.85, flatShading: true }), { p: [0, 0.2, 0] });
    k.mesh('Column', { type: 'cylinder', rTop: 0.07, rBottom: 0.13, h: 0.8 }, brass, { p: [0, 0.8, 0] });
    k.mesh('Knot', { type: 'torusKnot', r: 0.56, tube: 0.15, p: 2, q: 3 }, brass, { p: [0, 1.95, 0] });
    k.group('Orbit rings', { p: [0, 1.95, 0] }, () => {
      k.mesh('Ring A', { type: 'torus', r: 1.15, tube: 0.022 }, matte('#7fe7d0', { metalness: 0.7, roughness: 0.25 }), { r: [72, 20, 0] });
      k.mesh('Ring B', { type: 'torus', r: 1.3, tube: 0.018 }, matte('#f27d6b', { metalness: 0.7, roughness: 0.25 }), { r: [105, -28, 0] });
      k.mesh('Moon', { type: 'sphere', r: 0.11 }, matte('#f4f1e8', { roughness: 0.4 }), { p: [1.13, 0.22, 0.2] });
    });
  },
};

export const STARTER = conceptMascot;
export const TEMPLATES: Blueprint[] = [conceptMascot, bottle, box, bag, companion, mug, room, sculpture];
