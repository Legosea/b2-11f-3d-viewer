import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

/**
 * Dimension-accurate procedural furniture proxies.
 *
 * The contract from the skill: a product's *published outer dimensions* drive the footprint and
 * height; the shape is a proxy and must be labelled as one. So every builder below takes the real
 * (w, d, h) in metres and derives every internal proportion from them. Nothing is hard-coded to a
 * particular product, and no builder claims to be a manufacturer's mesh.
 *
 * Local frame for every proxy: y = 0 at the floor, xz centred on the footprint, front facing +z.
 * That is what placement.js assumes, so it only ever sets position and rotation.y.
 */

export const ROLES = [
  'sofa', 'armchair', 'bed', 'desk', 'dining table', 'coffee table', 'chair',
  'cabinet', 'wardrobe', 'shelf', 'tv', 'fridge', 'lamp', 'plant', 'rug', 'appliance', 'generic'
];

// Maps a free-text role from furniture-products.json onto a builder. Product records are written
// by humans, so match on substrings rather than an exact enum.
export function normaliseRole(role = '') {
  const key = String(role).toLowerCase();
  if (/sofa|couch|settee|loveseat|sectional/.test(key)) return 'sofa';
  if (/armchair|lounge chair|recliner|easy chair/.test(key)) return 'armchair';
  if (/bed(?!side)|mattress|divan/.test(key)) return 'bed';
  if (/desk|workstation/.test(key)) return 'desk';
  if (/dining table|dining/.test(key)) return 'dining table';
  if (/coffee table|side table|nightstand|bedside|console/.test(key)) return 'coffee table';
  if (/chair|stool|seat|bench/.test(key)) return 'chair';
  if (/wardrobe|closet|armoire/.test(key)) return 'wardrobe';
  if (/cabinet|sideboard|dresser|drawer|chest|tv unit|tv stand/.test(key)) return 'cabinet';
  if (/shelf|shelving|bookcase|bookshelf/.test(key)) return 'shelf';
  if (/\btv\b|television|monitor|screen|display/.test(key)) return 'tv';
  if (/fridge|refrigerator|freezer/.test(key)) return 'fridge';
  if (/lamp|light|luminaire|pendant/.test(key)) return 'lamp';
  if (/plant|tree|planter|greenery/.test(key)) return 'plant';
  if (/rug|carpet|mat/.test(key)) return 'rug';
  if (/oven|washer|dryer|dishwasher|hob|microwave|appliance/.test(key)) return 'appliance';
  return 'generic';
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

function makeKit(m, tokens) {
  // Style tokens let a style.json swap the dominant materials without changing any geometry.
  const soft = tokens?.fabric || m.fabric;
  const wood = tokens?.wood || m.wood;
  const accent = tokens?.accent || m.accentFabric;

  const box = (parent, w, h, d, x, y, z, material, radius = 0) => {
    const geometry = radius > 0
      ? new RoundedBoxGeometry(Math.max(w, 0.004), Math.max(h, 0.004), Math.max(d, 0.004), 2,
          Math.min(radius, w / 3, h / 3, d / 3))
      : new T.BoxGeometry(Math.max(w, 0.004), Math.max(h, 0.004), Math.max(d, 0.004));
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cyl = (parent, rt, rb, h, x, y, z, material, segments = 18) => {
    const mesh = new T.Mesh(new T.CylinderGeometry(rt, rb, h, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const legs = (parent, spanX, spanZ, height, radius, material, inset = 0) => {
    for (const x of [-spanX / 2 + inset, spanX / 2 - inset]) {
      for (const z of [-spanZ / 2 + inset, spanZ / 2 - inset]) {
        cyl(parent, radius, radius * 0.8, height, x, height / 2, z, material, 10);
      }
    }
  };
  return {box, cyl, legs, soft, wood, accent, m};
}

const BUILDERS = {
  sofa(g, w, d, h, k) {
    const legH = clamp(h * 0.14, 0.04, 0.16);
    const armW = clamp(w * 0.11, 0.09, 0.26);
    const backD = clamp(d * 0.22, 0.1, 0.28);
    const seatH = clamp(h * 0.5, 0.3, 0.5) - legH;
    const seatW = w - armW * 2;
    const seatD = d - backD;
    k.box(g, w, seatH * 0.6, d, 0, legH + seatH * 0.3, 0, k.soft, 0.05);
    // Seat cushions: their count follows the width, which is where the real dimension shows.
    const cushions = clamp(Math.round(seatW / 0.68), 1, 4);
    for (let i = 0; i < cushions; i++) {
      k.box(g, seatW / cushions - 0.02, seatH * 0.42, seatD - 0.04,
        -seatW / 2 + seatW * (i + 0.5) / cushions, legH + seatH * 0.8, backD / 2, k.soft, 0.05);
      k.box(g, seatW / cushions - 0.06, h - legH - seatH - 0.02, backD * 0.6,
        -seatW / 2 + seatW * (i + 0.5) / cushions, legH + seatH + (h - legH - seatH) / 2 - 0.02,
        -d / 2 + backD * 0.55, k.soft, 0.05);
    }
    k.box(g, w, (h - legH) * 0.62, backD * 0.8, 0, legH + (h - legH) * 0.69, -d / 2 + backD * 0.4, k.soft, 0.05);
    for (const x of [-1, 1]) {
      k.box(g, armW, h * 0.62 - legH, d - 0.02, x * (w - armW) / 2, legH + (h * 0.62 - legH) / 2, 0, k.soft, 0.05);
    }
    const pillow = k.box(g, 0.34, 0.32, 0.11, -seatW * 0.28, h * 0.63, backD * 0.2, k.accent, 0.05);
    pillow.rotation.z = 0.18;
    const pillow2 = k.box(g, 0.34, 0.32, 0.11, seatW * 0.28, h * 0.63, backD * 0.2, k.m.linen, 0.05);
    pillow2.rotation.z = -0.18;
    k.legs(g, w - armW, d - 0.12, legH, 0.022, k.wood, 0.06);
  },

  armchair(g, w, d, h, k) {
    const legH = clamp(h * 0.16, 0.05, 0.16);
    const armW = clamp(w * 0.14, 0.07, 0.18);
    k.box(g, w, h * 0.34, d, 0, legH + h * 0.17, 0, k.soft, 0.05);
    k.box(g, w - armW * 2, h * 0.14, d - 0.08, 0, legH + h * 0.4, d * 0.06, k.soft, 0.04);
    k.box(g, w, h - legH - h * 0.34, d * 0.24, 0, legH + h * 0.34 + (h - legH - h * 0.34) / 2, -d / 2 + d * 0.14, k.soft, 0.05);
    for (const x of [-1, 1]) k.box(g, armW, h * 0.28, d - 0.06, x * (w - armW) / 2, legH + h * 0.31, 0, k.soft, 0.05);
    k.legs(g, w - armW, d - 0.1, legH, 0.02, k.wood, 0.05);
  },

  bed(g, w, d, h, k) {
    const baseH = clamp(h * 0.42, 0.14, 0.34);
    const mattress = clamp(h * 0.38, 0.14, 0.28);
    k.box(g, w, baseH, d, 0, baseH / 2 + 0.04, 0, k.wood, 0.01);
    k.box(g, w - 0.06, mattress, d - 0.06, 0, baseH + mattress / 2 + 0.04, 0, k.m.linen, 0.05);
    // Duvet and pillows: proportioned from the mattress, no fixed sizes.
    k.box(g, w - 0.02, 0.06, d * 0.62, 0, baseH + mattress + 0.06, d * 0.18, k.soft, 0.04);
    const pillows = w > 1.2 ? 2 : 1;
    for (let i = 0; i < pillows; i++) {
      k.box(g, Math.min(0.62, w / pillows - 0.06), 0.12, 0.36,
        -w / 2 + w * (i + 0.5) / pillows, baseH + mattress + 0.09, -d / 2 + 0.28, k.m.fabric, 0.05);
    }
    k.box(g, w, clamp(h * 0.9, 0.4, 1.0), 0.06, 0, clamp(h * 0.9, 0.4, 1.0) / 2, -d / 2 + 0.03, k.wood, 0.01);
    k.legs(g, w - 0.1, d - 0.1, 0.05, 0.024, k.wood, 0.05);
  },

  desk(g, w, d, h, k) {
    const top = 0.038;
    k.box(g, w, top, d, 0, h - top / 2, 0, k.wood, 0.006);
    k.box(g, w - 0.12, 0.03, d * 0.26, 0, h - 0.11, -d * 0.3, k.wood);
    const drawerW = clamp(w * 0.26, 0.22, 0.4);
    k.box(g, drawerW, h * 0.5, d - 0.08, w / 2 - drawerW / 2 - 0.05, h * 0.5 - 0.06, 0, k.wood, 0.008);
    for (let i = 0; i < 2; i++) {
      k.box(g, drawerW - 0.05, 0.016, 0.014, w / 2 - drawerW / 2 - 0.05, h * 0.36 + i * h * 0.2, d / 2 - 0.03, k.m.metal);
    }
    for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) {
      k.cyl(g, 0.018, 0.018, h - top, -w / 2 + 0.07, (h - top) / 2, z, k.m.metal, 10);
    }
  },

  'dining table'(g, w, d, h, k) {
    k.box(g, w, 0.045, d, 0, h - 0.022, 0, k.wood, 0.008);
    k.box(g, w - 0.16, 0.05, 0.06, 0, h - 0.08, -d / 2 + 0.1, k.wood);
    k.box(g, w - 0.16, 0.05, 0.06, 0, h - 0.08, d / 2 - 0.1, k.wood);
    k.legs(g, w - 0.1, d - 0.1, h - 0.05, 0.026, k.wood, 0.06);
  },

  'coffee table'(g, w, d, h, k) {
    const round = Math.abs(w - d) < 0.06;
    if (round) {
      k.cyl(g, w / 2, w / 2, 0.038, 0, h - 0.019, 0, k.wood, 28);
      for (let i = 0; i < 3; i++) {
        const angle = i * 2.094;
        k.cyl(g, 0.018, 0.014, h - 0.04, Math.cos(angle) * w * 0.32, (h - 0.04) / 2, Math.sin(angle) * w * 0.32, k.wood, 10);
      }
    } else {
      k.box(g, w, 0.04, d, 0, h - 0.02, 0, k.wood, 0.008);
      k.box(g, w - 0.16, 0.022, d - 0.14, 0, h * 0.34, 0, k.m.oak);
      k.legs(g, w - 0.08, d - 0.08, h - 0.04, 0.022, k.wood, 0.05);
    }
  },

  chair(g, w, d, h, k) {
    const seatH = clamp(h * 0.5, 0.36, 0.5);
    k.box(g, w, 0.05, d, 0, seatH, d * 0.02, k.m.linen, 0.02);
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      k.cyl(g, 0.017, 0.014, seatH, x * (w / 2 - 0.04), seatH / 2, z * (d / 2 - 0.04), k.wood, 10);
    }
    const back = new T.Group();
    back.position.set(0, seatH, -d / 2 + 0.04);
    back.rotation.x = 0.1;
    g.add(back);
    for (const x of [-1, 1]) k.cyl(back, 0.016, 0.016, h - seatH, x * (w / 2 - 0.05), (h - seatH) / 2, 0, k.wood, 10);
    for (let i = 0; i < 3; i++) {
      k.box(back, w - 0.09, 0.045, 0.016, 0, (h - seatH) * (0.4 + i * 0.25), 0, k.wood, 0.005);
    }
  },

  cabinet(g, w, d, h, k) {
    const legH = clamp(h * 0.1, 0.03, 0.14);
    k.box(g, w, h - legH, d, 0, legH + (h - legH) / 2, 0, k.wood, 0.012);
    const doors = clamp(Math.round(w / 0.5), 1, 4);
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + w * (i + 0.5) / doors;
      k.box(g, w / doors - 0.02, h - legH - 0.05, 0.02, x, legH + (h - legH) / 2, d / 2 + 0.01, k.m.oak, 0.006);
      k.box(g, w / doors - 0.18, 0.016, 0.014, x, legH + (h - legH) * 0.72, d / 2 + 0.028, k.m.metal);
    }
    k.box(g, w + 0.03, 0.03, d + 0.03, 0, h - 0.015, 0, k.wood, 0.008);
    k.legs(g, w - 0.12, d - 0.1, legH, 0.018, k.m.metal, 0.04);
  },

  wardrobe(g, w, d, h, k) {
    k.box(g, w, h, d, 0, h / 2, 0, k.m.paint, 0.012);
    const doors = clamp(Math.round(w / 0.6), 2, 4);
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + w * (i + 0.5) / doors;
      k.box(g, w / doors - 0.02, h - 0.06, 0.024, x, h / 2, d / 2 + 0.012, k.wood, 0.008);
      k.box(g, 0.022, 0.28, 0.014, x + w / doors * 0.34, h * 0.53, d / 2 + 0.03, k.m.metal);
    }
    k.box(g, w + 0.04, 0.04, d + 0.04, 0, h - 0.02, 0, k.m.paint, 0.01);
  },

  shelf(g, w, d, h, k) {
    const shelves = clamp(Math.round(h / 0.36), 2, 6);
    for (const x of [-1, 1]) k.box(g, 0.022, h, d, x * (w / 2 - 0.011), h / 2, 0, k.wood);
    for (let i = 0; i <= shelves; i++) {
      k.box(g, w, 0.022, d, 0, Math.min(h - 0.011, (h / shelves) * i + 0.011), 0, k.wood);
    }
    k.box(g, w - 0.044, h, 0.012, 0, h / 2, -d / 2 + 0.006, k.m.paint);
    // A few books so the shelf reads as furniture instead of a grid.
    for (let i = 0; i < shelves; i++) {
      if (i % 2) continue;
      const y = (h / shelves) * i + 0.022;
      const rowH = Math.min(h / shelves - 0.06, 0.24);
      let cursor = -w / 2 + 0.05;
      let seed = 17 + i * 31;
      while (cursor < w / 2 - 0.12) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        const bw = 0.022 + (seed / 4294967296) * 0.026;
        k.box(g, bw, rowH * (0.7 + (seed % 100) / 330), d * 0.7, cursor + bw / 2, y + rowH * 0.5, 0,
          [k.m.linen, k.accent, k.m.fabric, k.m.dark][i % 4], 0.003);
        cursor += bw + 0.004;
      }
    }
  },

  tv(g, w, d, h, k) {
    // A TV's published depth is the panel; the stand footprint is derived, not invented as a size.
    const panelD = Math.min(d, 0.07);
    const screenH = h * 0.86;
    k.box(g, w, screenH, panelD, 0, h - screenH / 2, 0, k.m.dark, 0.006);
    const face = k.box(g, w - 0.03, screenH - 0.03, 0.006, 0, h - screenH / 2, panelD / 2 + 0.004, k.m.screen);
    face.castShadow = false;
    k.box(g, w * 0.34, 0.02, Math.max(d, 0.2), 0, 0.01, 0, k.m.dark, 0.004);
    k.box(g, 0.06, h - screenH, 0.05, 0, (h - screenH) / 2, 0, k.m.dark);
  },

  fridge(g, w, d, h, k) {
    k.box(g, w, h, d, 0, h / 2, 0, k.m.chrome, 0.012);
    k.box(g, w - 0.02, 0.014, 0.012, 0, h * 0.63, d / 2 + 0.008, k.m.dark);
    for (const y of [h * 0.8, h * 0.4]) k.box(g, 0.022, h * 0.2, 0.024, w / 2 - 0.08, y, d / 2 + 0.024, k.m.chrome);
  },

  lamp(g, w, d, h, k) {
    const shade = Math.max(w, d);
    k.cyl(g, shade * 0.42, shade * 0.42, 0.03, 0, 0.015, 0, k.m.dark, 20);
    k.cyl(g, 0.016, 0.016, h - 0.16, 0, (h - 0.16) / 2, 0, k.m.metal, 12);
    k.cyl(g, shade * 0.4, shade * 0.5, Math.min(0.3, h * 0.22), 0, h - Math.min(0.3, h * 0.22) / 2, 0, k.m.fabric, 20);
    const bulb = new T.PointLight(0xffcf8c, 1.6, Math.max(2.2, h * 1.8), 2);
    bulb.position.set(0, h - 0.14, 0);
    g.add(bulb);
    g.userData.lamp = bulb;
  },

  plant(g, w, d, h, k) {
    const potR = Math.max(w, d) * 0.4;
    const potH = Math.min(h * 0.3, 0.3);
    k.cyl(g, potR, potR * 0.78, potH, 0, potH / 2, 0, k.m.ceramic, 20);
    k.cyl(g, potR * 0.9, potR * 0.9, 0.015, 0, potH, 0, k.m.soil, 20);
    for (let i = 0; i < 10; i++) {
      const angle = i * 2.4;
      const y = potH + (h - potH) * (i + 1) / 11;
      const x = Math.cos(angle) * potR * 1.1;
      const z = Math.sin(angle) * potR * 1.1;
      const stem = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, y - potH, 6), k.wood);
      stem.position.set(x * 0.5, potH + (y - potH) / 2, z * 0.5);
      stem.lookAt(new T.Vector3(x, y, z));
      stem.rotateX(Math.PI / 2);
      g.add(stem);
      const leaf = new T.Mesh(new T.SphereGeometry(1, 12, 8), k.m.leaf);
      leaf.scale.set(potR * 0.55, potR * 1.0, 0.02);
      leaf.position.set(x, y, z);
      leaf.rotation.set(0.6, angle, 0.5);
      leaf.castShadow = true;
      g.add(leaf);
    }
  },

  rug(g, w, d, h, k) {
    const mesh = k.box(g, w, Math.max(h, 0.012), d, 0, Math.max(h, 0.012) / 2, 0, k.m.rug, 0.004);
    mesh.castShadow = false;
    k.box(g, w - 0.1, Math.max(h, 0.012) + 0.002, d - 0.1, 0, Math.max(h, 0.012) / 2 + 0.001, 0, k.m.linen, 0.004).castShadow = false;
  },

  appliance(g, w, d, h, k) {
    k.box(g, w, h, d, 0, h / 2, 0, k.m.chrome, 0.01);
    const door = k.box(g, w - 0.06, Math.min(h * 0.6, h - 0.1), 0.02, 0, h * 0.45, d / 2 + 0.012, k.m.dark, 0.01);
    door.castShadow = false;
    k.cyl(g, Math.min(w, h) * 0.22, Math.min(w, h) * 0.22, 0.012, 0, h * 0.45, d / 2 + 0.026, k.m.glass, 20).castShadow = false;
    k.box(g, w - 0.08, 0.05, 0.02, 0, h - 0.06, d / 2 + 0.014, k.m.dark);
  },

  generic(g, w, d, h, k) {
    // Honest fallback: a plain rounded volume at the real dimensions, plus a base shadow line.
    k.box(g, w, h, d, 0, h / 2, 0, k.m.oak, Math.min(0.02, h / 6));
    k.box(g, w + 0.02, 0.012, d + 0.02, 0, 0.006, 0, k.m.dark);
  }
};

/**
 * Build a proxy for a product record.
 * @param product a furniture-products.json record (or {id, role, dimensionsMm, geometry})
 * @param m       the shared material set
 * @param tokens  optional {wood, fabric, accent} material overrides from the active style
 */
export function buildProxy(product, m, tokens) {
  const dims = product.dimensionsMm || {};
  const w = Math.max((dims.width || 600) / 1000, 0.05);
  const d = Math.max((dims.depth || 600) / 1000, 0.05);
  const h = Math.max((dims.height || 600) / 1000, 0.05);
  const role = normaliseRole(product.role);

  const group = new T.Group();
  group.name = `proxy-${product.id}`;
  const kit = makeKit(m, tokens);
  (BUILDERS[role] || BUILDERS.generic)(group, w, d, h, kit);

  const dimensionSource = ['width', 'depth', 'height']
    .map(key => dims[`${key}Status`] || 'unknown');
  group.userData = {
    productId: product.id,
    layer: 'furniture',
    collision: true,
    role,
    declaredRole: product.role,
    geometrySource: 'procedural-proxy',
    dimensionSource: dimensionSource.every(s => s === 'confirmed') ? 'confirmed'
      : dimensionSource.includes('unknown') ? 'unknown' : 'estimated',
    fitStatus: product.fit?.status || 'unknown',
    size: {w, d, h}
  };
  return group;
}

/**
 * Loads a real GLB when the product record supplies geometry.assetPath.
 * The mesh is normalised so its bounding box matches the published dimensions: the source of
 * truth stays the product record, not whatever scale the artist exported.
 * Falls back to the procedural proxy if the file cannot be loaded.
 */
export async function loadAssetProxy(product, m, tokens) {
  const path = product.geometry?.assetPath;
  if (!path) return buildProxy(product, m, tokens);
  try {
    const gltf = await new GLTFLoader().loadAsync(path);
    const model = gltf.scene;
    model.traverse(node => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    const dims = product.dimensionsMm || {};
    const target = new T.Vector3((dims.width || 600) / 1000, (dims.height || 600) / 1000, (dims.depth || 600) / 1000);
    const box = new T.Box3().setFromObject(model);
    const size = box.getSize(new T.Vector3());
    // One uniform scale keeps the model's own proportions; the largest-axis ratio is used so the
    // asset never exceeds the published envelope.
    const ratio = Math.min(
      size.x > 1e-6 ? target.x / size.x : 1,
      size.y > 1e-6 ? target.y / size.y : 1,
      size.z > 1e-6 ? target.z / size.z : 1
    );
    model.scale.setScalar(ratio);
    const scaled = new T.Box3().setFromObject(model);
    const centre = scaled.getCenter(new T.Vector3());
    model.position.sub(new T.Vector3(centre.x, scaled.min.y, centre.z));

    const group = new T.Group();
    group.name = `asset-${product.id}`;
    group.add(model);
    group.userData = {
      productId: product.id,
      layer: 'furniture',
      collision: true,
      role: normaliseRole(product.role),
      geometrySource: product.geometry?.source || 'licensed-asset',
      dimensionSource: dims.widthStatus || 'unknown',
      assetPath: path,
      scaleSource: `uniform x${ratio.toFixed(4)} from GLB bbox to published dimensions`,
      fitStatus: product.fit?.status || 'unknown',
      size: {w: target.x, d: target.z, h: target.y}
    };
    console.info(`[proxy] ${product.id}: scaled GLB by ${ratio.toFixed(4)} to match published dimensions`);
    return group;
  } catch (error) {
    console.warn(`[proxy] ${product.id}: GLB load failed (${error.message}); using procedural proxy`);
    return buildProxy(product, m, tokens);
  }
}
