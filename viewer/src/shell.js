import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Turns plan.json into the fixed architectural layer.
//
// Coordinate system: plan units are metres, x runs right, z runs down (as printed on a floor
// plan), y is up. Floor finish level is y = 0, so every furniture proxy can sit at y = 0 too.
//
// Openings are not cut with CSG. A wall is split into solid segments around its openings and the
// head / sill infill is added as separate boxes. That is enough for a residential plan, it keeps
// every piece a clean box (cheap shadows, cheap collision boxes) and it never produces the
// degenerate geometry that boolean subtraction produces on coincident faces.

export const FLOOR_Y = 0;
const SLAB = 0.14;
export const FLOOR_SURFACE_Y = FLOOR_Y + SLAB;
const EPS = 1e-6;

const WET_KINDS = new Set(['bath', 'bathroom', 'wc', 'toilet', 'shower', 'wetroom']);
export const isWetRoom = room => WET_KINDS.has(String(room?.kind || '').toLowerCase());

export function polygonCentroid(points) {
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[(i + 1) % points.length];
    const cross = x1 * z2 - x2 * z1;
    area += cross;
    cx += (x1 + x2) * cross;
    cz += (z1 + z2) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < EPS) {
    // Degenerate ring: fall back to the average vertex so a label still lands somewhere sane.
    const n = points.length || 1;
    return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (6 * area), cz / (6 * area)];
}

export function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + EPS) + xi) inside = !inside;
  }
  return inside;
}

export function planBounds(plan) {
  const box = {minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, height: 0};
  const eat = (x, z) => {
    box.minX = Math.min(box.minX, x); box.maxX = Math.max(box.maxX, x);
    box.minZ = Math.min(box.minZ, z); box.maxZ = Math.max(box.maxZ, z);
  };
  for (const room of plan.rooms || []) for (const [x, z] of room.boundary || []) eat(x, z);
  for (const wall of plan.walls || []) {
    const half = (wall.thickness || 0.1) / 2;
    for (const [x, z] of [wall.a, wall.b]) { eat(x - half, z - half); eat(x + half, z + half); }
    box.height = Math.max(box.height, wall.height || 0);
  }
  if (!Number.isFinite(box.minX)) Object.assign(box, {minX: -1, maxX: 1, minZ: -1, maxZ: 1});
  if (!box.height) box.height = 2.7;
  box.width = box.maxX - box.minX;
  box.depth = box.maxZ - box.minZ;
  box.centerX = (box.minX + box.maxX) / 2;
  box.centerZ = (box.minZ + box.maxZ) / 2;
  box.radius = Math.hypot(box.width, box.depth) / 2;
  return box;
}

// A plan polygon becomes a flat XZ shape. Negating z keeps the winding (and therefore the face
// normal) pointing up after the -90 degree rotation about X.
function planShape(points) {
  const shape = new T.Shape();
  shape.moveTo(points[0][0], -points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], -points[i][1]);
  shape.closePath();
  return shape;
}

function slabMesh(points, thickness, material) {
  const geometry = new T.ExtrudeGeometry(planShape(points), {depth: thickness, bevelEnabled: false});
  geometry.rotateX(-Math.PI / 2);
  const mesh = new T.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function boxMesh(w, h, d, material, radius = 0) {
  const geometry = radius > 0
    ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3))
    : new T.BoxGeometry(w, h, d);
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Which wall does this opening belong to? An explicit `wall` id wins; otherwise the opening is
// matched to the wall whose centreline its midpoint sits closest to (within half a thickness).
function assignOpenings(walls, openings) {
  const byWall = new Map(walls.map(w => [w.id, []]));
  for (const opening of openings) {
    if (opening.wall && byWall.has(opening.wall)) { byWall.get(opening.wall).push(opening); continue; }
    const mx = (opening.a[0] + opening.b[0]) / 2;
    const mz = (opening.a[1] + opening.b[1]) / 2;
    let best = null;
    for (const wall of walls) {
      const ax = wall.a[0], az = wall.a[1];
      const dx = wall.b[0] - ax, dz = wall.b[1] - az;
      const length = Math.hypot(dx, dz) || EPS;
      const t = Math.max(0, Math.min(1, ((mx - ax) * dx + (mz - az) * dz) / (length * length)));
      const distance = Math.hypot(mx - (ax + dx * t), mz - (az + dz * t));
      if (!best || distance < best.distance) best = {wall, distance};
    }
    if (best && best.distance <= best.wall.thickness / 2 + 0.05) byWall.get(best.wall.id).push(opening);
  }
  return byWall;
}

const FIXED_MATERIAL = (m, kind) => {
  const key = String(kind || '').toLowerCase();
  if (/counter|worktop|island/.test(key)) return m.stone;
  if (/sink|basin|wc|toilet|bath|tub|shower/.test(key)) return m.ceramic;
  if (/wardrobe|closet|cabinet|storage/.test(key)) return m.paint;
  if (/appliance|fridge|oven|washer|hob|dishwasher/.test(key)) return m.chrome;
  if (/stair|column|duct|riser/.test(key)) return m.plaster;
  return m.oak;
};

export function createShell(plan, m, labelRoot, onRoomSelect) {
  const group = new T.Group();
  group.name = 'architecture';

  const bounds = planBounds(plan);
  const wallHeight = Math.max(...(plan.walls || []).map(w => w.height || 0), 2.4);

  const wallMeshes = [];   // solid pieces used for collision and wall snapping
  const wallFaces = [];    // inward-facing surfaces, for wall-mounted items
  const ceilingParts = [];
  const openingParts = [];
  const labels = [];
  const rooms = [];

  // ---------- floors ----------
  const floorGroup = new T.Group();
  floorGroup.name = 'floors';
  group.add(floorGroup);

  for (const room of plan.rooms || []) {
    const boundary = room.boundary || [];
    if (boundary.length < 3) continue;
    const wet = isWetRoom(room);
    const outdoor = /balcony|terrace|patio|deck|yard/.test(String(room.kind || '').toLowerCase());
    const woodFloor = /bedroom|living|dining|open|hall|entry/i.test(String(room.kind || ''));
    const material = outdoor ? m.concrete : wet ? m.floorTile : woodFloor ? m.plank : m.floor;
    const slab = slabMesh(boundary, SLAB, material);
    slab.position.y = FLOOR_Y;
    slab.name = `floor-${room.id}`;
    slab.userData = {id: room.id, layer: 'architecture', collision: false, role: 'floor', room: room.id};
    floorGroup.add(slab);

    const [cx, cz] = polygonCentroid(boundary);
    const entry = {
      id: room.id, name: room.name, kind: room.kind || 'unknown', wet, outdoor,
      boundary, center: [cx, cz], status: room.status || 'unknown', slab
    };
    rooms.push(entry);

    if (labelRoot) {
      const el = document.createElement('button');
      el.className = 'room-label';
      el.type = 'button';
      el.textContent = room.name;
      el.setAttribute('aria-label', room.name);
      el.addEventListener('click', () => onRoomSelect?.(room.id));
      labelRoot.appendChild(el);
      labels.push({id: room.id, el, position: new T.Vector3(cx, 0.9, cz)});
    }

    if (!outdoor) {
      const ceiling = slabMesh(boundary, 0.08, m.ceiling);
      ceiling.position.y = wallHeight + 0.08;
      ceiling.name = `ceiling-${room.id}`;
      ceiling.userData = {id: `${room.id}-ceiling`, layer: 'architecture', collision: false, role: 'ceiling'};
      ceiling.receiveShadow = true;
      group.add(ceiling);
      ceilingParts.push(ceiling);
    }
  }

  // ---------- walls ----------
  const wallGroup = new T.Group();
  wallGroup.name = 'walls';
  group.add(wallGroup);

  const openingsByWall = assignOpenings(plan.walls || [], plan.openings || []);

  for (const wall of plan.walls || []) {
    const ax = wall.a[0], az = wall.a[1];
    const dx = wall.b[0] - ax, dz = wall.b[1] - az;
    const length = Math.hypot(dx, dz);
    if (length < EPS) continue;
    const ux = dx / length, uz = dz / length;
    const thickness = wall.thickness || 0.12;
    const height = wall.height || wallHeight;
    const parapet = wall.kind === 'parapet';

    const wallRoot = new T.Group();
    wallRoot.name = `wall-${wall.id}`;
    wallRoot.position.set(ax + dx / 2, 0, az + dz / 2);
    wallRoot.rotation.y = Math.atan2(-uz, ux);
    wallGroup.add(wallRoot);

    const material = parapet ? m.plaster : m.wall;

    // Openings expressed as [start, end] along the wall's own x axis, centred on the wall.
    const cuts = (openingsByWall.get(wall.id) || []).map(opening => {
      const project = ([px, pz]) => (px - ax) * ux + (pz - az) * uz;
      const t0 = project(opening.a);
      const t1 = project(opening.b);
      return {
        opening,
        from: Math.max(0, Math.min(t0, t1)),
        to: Math.min(length, Math.max(t0, t1)),
        sill: Math.max(0, opening.sill || 0),
        head: Math.min(height, opening.head || height)
      };
    }).filter(c => c.to - c.from > 0.05).sort((a, b) => a.from - b.from);

    const addPiece = (from, to, bottom, top, tag) => {
      const w = to - from;
      const h = top - bottom;
      if (w <= 0.005 || h <= 0.005) return null;
      const mesh = boxMesh(w, h, thickness, material);
      mesh.position.set(from + w / 2 - length / 2, bottom + h / 2, 0);
      mesh.name = `wall-${wall.id}-${tag}`;
      mesh.userData = {
        id: `${wall.id}-${tag}`, layer: 'architecture', collision: true,
        role: 'wall', wall: wall.id, kind: wall.kind || 'solid',
        // The cutaway mode rescales and moves the mesh, so the original extent has to be
        // remembered here; deriving it from the live transform drifts on the second toggle.
        bottom, top, ownHeight: h
      };
      wallRoot.add(mesh);
      wallMeshes.push(mesh);
      return mesh;
    };

    // Solid runs between the openings, then the infill above and below each opening.
    let cursor = 0;
    for (const cut of cuts) {
      addPiece(cursor, cut.from, 0, height, `s${wallMeshes.length}`);
      if (cut.sill > 0.01) addPiece(cut.from, cut.to, 0, cut.sill, `sill${wallMeshes.length}`);
      if (cut.head < height - 0.01) addPiece(cut.from, cut.to, cut.head, height, `head${wallMeshes.length}`);
      cursor = cut.to;
    }
    addPiece(cursor, length, 0, height, `s${wallMeshes.length}`);

    // Skirting reads as a real interior even before textures arrive.
    if (!parapet) {
      for (const side of [-1, 1]) {
        const skirt = boxMesh(length, 0.09, 0.014, m.skirting);
        skirt.position.set(0, 0.045, side * (thickness / 2 + 0.007));
        skirt.userData = {id: `${wall.id}-skirting${side}`, layer: 'architecture', collision: false, role: 'trim'};
        skirt.castShadow = false;
        wallRoot.add(skirt);
      }
    }

    // Inward face records for wall-mounted placement. Both sides are offered; the placement code
    // picks whichever is nearest, so an interior partition works from either room.
    const nx = -uz, nz = ux;   // left-hand normal of the wall direction
    for (const side of [1, -1]) {
      wallFaces.push({
        wall: wall.id,
        ax: ax + nx * side * thickness / 2, az: az + nz * side * thickness / 2,
        bx: wall.b[0] + nx * side * thickness / 2, bz: wall.b[1] + nz * side * thickness / 2,
        nx: -nx * side, nz: -nz * side,     // points away from the wall, into the room
        height
      });
    }

    // ---------- openings ----------
    for (const cut of cuts) {
      const {opening} = cut;
      const w = cut.to - cut.from;
      const h = cut.head - cut.sill;
      const centre = cut.from + w / 2 - length / 2;
      const part = new T.Group();
      part.name = `opening-${opening.id}`;
      part.position.set(centre, 0, 0);
      part.userData = {id: opening.id, layer: 'architecture', collision: false, role: 'opening', type: opening.type};
      wallRoot.add(part);
      openingParts.push(part);

      const frameDepth = thickness + 0.02;
      const jamb = 0.05;
      const frameMaterial = (opening.type === 'window' || opening.type === 'sliding') ? m.frame : m.white;
      // Lining: two jambs and a head, always present, in every opening type.
      for (const side of [-1, 1]) {
        const post = boxMesh(jamb, h, frameDepth, frameMaterial);
        post.position.set(side * (w / 2 - jamb / 2), cut.sill + h / 2, 0);
        post.userData = {id: `${opening.id}-jamb${side}`, layer: 'architecture', collision: false, role: 'frame'};
        part.add(post);
      }
      const lintel = boxMesh(w, jamb, frameDepth, frameMaterial);
      lintel.position.set(0, cut.head - jamb / 2, 0);
      lintel.userData = {id: `${opening.id}-lintel`, layer: 'architecture', collision: false, role: 'frame'};
      part.add(lintel);
      if (cut.sill > 0.02) {
        const board = boxMesh(w + 0.06, 0.03, frameDepth + 0.05, frameMaterial);
        board.position.set(0, cut.sill + 0.015, 0);
        board.userData = {id: `${opening.id}-sill`, layer: 'architecture', collision: false, role: 'frame'};
        part.add(board);
      }

      if (opening.type === 'window' || opening.type === 'sliding') {
        const gridColumns = opening.grid?.columns;
        const gridRows = opening.grid?.rows;
        const validGrid = Array.isArray(gridColumns) && gridColumns.length > 1
          && Array.isArray(gridRows) && gridRows.length > 1
          && Math.abs(gridColumns.reduce((sum, value) => sum + value, 0) - w) < 0.02
          && Math.abs(gridRows.reduce((sum, value) => sum + value, 0) - h) < 0.02;

        if (validGrid) {
          const pane = new T.Mesh(new T.BoxGeometry(w - jamb * 2, h - jamb * 2, 0.012), m.glass);
          pane.position.set(0, cut.sill + h / 2, 0);
          pane.name = `glass-${opening.id}-grid`;
          pane.userData = {id: `${opening.id}-glass-grid`, layer: 'architecture', collision: false, role: 'glazing'};
          pane.castShadow = false;
          part.add(pane);

          let accX = 0;
          for (let i = 0; i < gridColumns.length - 1; i++) {
            accX += gridColumns[i];
            const mullion = boxMesh(0.045, h - jamb * 2, frameDepth * 0.9, m.frame);
            mullion.position.set(-w / 2 + accX, cut.sill + h / 2, 0.006);
            mullion.name = `grid-v-${opening.id}-${i}`;
            mullion.userData = {id: `${opening.id}-grid-v${i}`, layer: 'architecture', collision: false, role: 'frame'};
            part.add(mullion);
          }

          let accY = 0;
          for (let i = 0; i < gridRows.length - 1; i++) {
            accY += gridRows[i];
            const rail = boxMesh(w - jamb * 2, 0.045, frameDepth * 0.9, m.frame);
            rail.position.set(0, cut.sill + accY, 0.006);
            rail.name = `grid-h-${opening.id}-${i}`;
            rail.userData = {id: `${opening.id}-grid-h${i}`, layer: 'architecture', collision: false, role: 'frame'};
            part.add(rail);
          }
        } else {
          const panes = opening.type === 'sliding' ? 2 : 1;
          for (let i = 0; i < panes; i++) {
            const paneWidth = (w - jamb * 2) / panes;
            const pane = new T.Mesh(new T.BoxGeometry(paneWidth - 0.02, h - jamb * 2, 0.012), m.glass);
            pane.position.set(-w / 2 + jamb + paneWidth * (i + 0.5), cut.sill + h / 2, opening.type === 'sliding' ? (i ? 0.03 : -0.03) : 0);
            pane.name = `glass-${opening.id}-${i}`;
            pane.userData = {id: `${opening.id}-glass${i}`, layer: 'architecture', collision: false, role: 'glazing'};
            pane.castShadow = false;
            part.add(pane);
            if (i > 0 || panes > 1) {
              const mullion = boxMesh(0.035, h - jamb * 2, frameDepth * 0.9, m.frame);
              mullion.position.set(-w / 2 + jamb + paneWidth * i, cut.sill + h / 2, 0);
              mullion.userData = {id: `${opening.id}-mullion${i}`, layer: 'architecture', collision: false, role: 'frame'};
              part.add(mullion);
            }
          }
        }
      } else if (opening.type === 'door') {
        // Leaves are drawn open. A closed leaf would block the walkthrough routes the plan
        // declares, and an open leaf also reads correctly in the 2D/top view.
        const swing = Number.isFinite(opening.swing) ? opening.swing : 90;
        const hinge = new T.Group();
        hinge.position.set(Math.sign(swing || 1) * (w / 2 - jamb), 0, 0);
        hinge.rotation.y = T.MathUtils.degToRad(-Math.sign(swing || 1) * 75);
        part.add(hinge);
        const leafWidth = w - jamb * 2;
        const leaf = boxMesh(leafWidth, h - jamb, 0.038, m.oak, 0.004);
        leaf.position.set(-Math.sign(swing || 1) * leafWidth / 2, (h - jamb) / 2, 0);
        leaf.name = `door-leaf-${opening.id}`;
        leaf.userData = {id: `${opening.id}-leaf`, layer: 'architecture', collision: true, role: 'door'};
        hinge.add(leaf);
        const handle = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 0.1, 12), m.metal);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(-Math.sign(swing || 1) * (leafWidth - 0.09), 1.05, 0.035);
        handle.castShadow = true;
        hinge.add(handle);
      }
    }
  }

  // ---------- fixed elements ----------
  const fixedGroup = new T.Group();
  fixedGroup.name = 'fixed-elements';
  group.add(fixedGroup);

  for (const fixed of plan.fixedElements || []) {
    const b = fixed.bounds || {};
    if (!(b.width > 0 && b.depth > 0 && b.height > 0)) continue;
    const kind = String(fixed.kind || '').toLowerCase();
    const node = new T.Group();
    node.name = `fixed-${fixed.id}`;
    node.position.set(b.x, FLOOR_Y, b.z);
    node.userData = {id: fixed.id, layer: 'architecture', collision: true, role: 'fixed', kind: fixed.kind, room: fixed.room};
    fixedGroup.add(node);

    const body = boxMesh(b.width, b.height, b.depth, FIXED_MATERIAL(m, kind), 0.01);
    body.position.y = b.height / 2;
    body.userData = {id: `${fixed.id}-body`, layer: 'architecture', collision: true, role: 'fixed'};
    node.add(body);

    // A few kind-specific details. Everything else stays an honest labelled block.
    if (/counter|worktop|island/.test(kind)) {
      const top = boxMesh(b.width + 0.03, 0.04, b.depth + 0.03, m.stone);
      top.position.y = b.height + 0.02;
      node.add(top);
      const doors = Math.max(1, Math.round(b.width / 0.6));
      for (let i = 0; i < doors; i++) {
        const panel = boxMesh(b.width / doors - 0.02, b.height - 0.16, 0.018, m.oak, 0.004);
        panel.position.set(-b.width / 2 + b.width * (i + 0.5) / doors, b.height / 2 - 0.02, b.depth / 2 + 0.01);
        node.add(panel);
        const pull = boxMesh(b.width / doors - 0.16, 0.014, 0.012, m.metal);
        pull.position.set(panel.position.x, b.height - 0.14, b.depth / 2 + 0.025);
        node.add(pull);
      }
    } else if (/sink|basin/.test(kind)) {
      const basin = new T.Mesh(new T.CylinderGeometry(Math.min(b.width, b.depth) * 0.36, Math.min(b.width, b.depth) * 0.28, 0.12, 24), m.ceramic);
      basin.position.y = b.height - 0.04;
      basin.castShadow = true;
      node.add(basin);
      const tap = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.26, 12), m.chrome);
      tap.position.set(0, b.height + 0.12, -b.depth / 2 + 0.08);
      node.add(tap);
    } else if (/wc|toilet/.test(kind)) {
      const cistern = boxMesh(b.width, 0.4, 0.16, m.ceramic, 0.02);
      cistern.position.set(0, b.height + 0.2, -b.depth / 2 + 0.08);
      node.add(cistern);
      const seat = new T.Mesh(new T.CylinderGeometry(b.width * 0.46, b.width * 0.4, 0.05, 20), m.white);
      seat.position.set(0, b.height + 0.03, 0.05);
      node.add(seat);
    } else if (/shower/.test(kind)) {
      // The enclosure is glazing, so the body underneath becomes a shallow tray instead of a block.
      body.scale.y = 0.05 / b.height;
      body.position.y = 0.025;
      for (const [sx, sz, w, d] of [[0, -b.depth / 2, b.width, 0.012], [-b.width / 2, 0, 0.012, b.depth]]) {
        const panel = new T.Mesh(new T.BoxGeometry(w, b.height - 0.05, d), m.glass);
        panel.position.set(sx, (b.height - 0.05) / 2 + 0.05, sz);
        panel.castShadow = false;
        node.add(panel);
      }
      const head = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.03, 16), m.chrome);
      head.position.set(0, b.height - 0.12, -b.depth / 2 + 0.12);
      node.add(head);
    } else if (/wardrobe|closet|cabinet/.test(kind)) {
      const doors = Math.max(2, Math.round(Math.max(b.width, b.depth) / 0.6));
      const along = b.width >= b.depth;
      for (let i = 0; i < doors; i++) {
        const span = (along ? b.width : b.depth) / doors;
        const panel = along
          ? boxMesh(span - 0.02, b.height - 0.06, 0.02, m.oak, 0.004)
          : boxMesh(0.02, b.height - 0.06, span - 0.02, m.oak, 0.004);
        panel.position.set(
          along ? -b.width / 2 + span * (i + 0.5) : b.width / 2 + 0.01,
          b.height / 2,
          along ? b.depth / 2 + 0.01 : -b.depth / 2 + span * (i + 0.5)
        );
        node.add(panel);
      }
    } else if (/appliance|fridge/.test(kind)) {
      const split = boxMesh(b.width - 0.02, 0.012, 0.012, m.dark);
      split.position.set(0, b.height * 0.62, b.depth / 2 + 0.006);
      node.add(split);
      for (const y of [b.height * 0.78, b.height * 0.42]) {
        const pull = boxMesh(0.02, 0.28, 0.02, m.chrome);
        pull.position.set(b.width / 2 - 0.07, y, b.depth / 2 + 0.02);
        node.add(pull);
      }
    }
  }

  // ---------- helpers exposed to the rest of the app ----------
  const box3 = new T.Box3();
  function wallBoxes() {
    group.updateMatrixWorld(true);
    return wallMeshes.map(mesh => {
      box3.setFromObject(mesh);
      return {minX: box3.min.x, maxX: box3.max.x, minZ: box3.min.z, maxZ: box3.max.z, minY: box3.min.y, maxY: box3.max.y};
    });
  }

  function fixedBoxes() {
    group.updateMatrixWorld(true);
    return (plan.fixedElements || []).map(fixed => {
      const b = fixed.bounds || {};
      return {
        id: fixed.id,
        minX: b.x - b.width / 2, maxX: b.x + b.width / 2,
        minZ: b.z - b.depth / 2, maxZ: b.z + b.depth / 2,
        height: b.height
      };
    });
  }

  function roomAt(x, z) {
    return rooms.find(room => pointInPolygon(x, z, room.boundary)) || null;
  }

  function setCeilingVisible(visible) {
    for (const part of ceilingParts) part.visible = visible;
  }

  // Cutaway: low walls in orbit/top so the interior is legible from outside.
  function setWallHeightMode(mode) {
    const full = mode === 'full';
    for (const mesh of wallMeshes) {
      const {bottom, top, ownHeight} = mesh.userData;
      if (full) {
        mesh.visible = true;
        mesh.scale.y = 1;
        mesh.position.y = bottom + ownHeight / 2;
      } else {
        const cut = Math.min(top, 1.15);
        mesh.visible = bottom < cut - 0.01;
        const wanted = Math.max(0.02, Math.min(ownHeight, cut - bottom));
        mesh.scale.y = wanted / ownHeight;
        mesh.position.y = bottom + wanted / 2;
      }
    }
    for (const part of openingParts) part.visible = full;
  }

  return {
    group, bounds, rooms, labels, wallFaces, wallHeight,
    wallMeshes, ceilingParts, openingParts,
    wallBoxes, fixedBoxes, roomAt, setCeilingVisible, setWallHeightMode,
    glassMaterials: [{material: m.glass, amount: 0.45}]
  };
}
