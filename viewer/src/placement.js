import * as T from 'three';
import {pointInPolygon, FLOOR_Y} from './shell.js';
import {t} from './i18n.js';

export const GRID = 0.05;          // 5 cm translation grid
export const ROTATION_STEP = 15;   // degrees
const OVERLAP_TOLERANCE = 0.08;

// Only these roles may stand in a wet room. Everything else is rejected there, matching the
// skill's conservative stance about putting soft furniture in a bathroom.
const WET_ALLOWED = new Set(['plant', 'rug', 'lamp', 'shelf', 'generic']);

export const snap = value => Math.round(value / GRID) * GRID;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

export function footprint(x, z, w, d, ry = 0) {
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  const hw = (w * c + d * s) / 2;
  const hd = (w * s + d * c) / 2;
  return {minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd};
}

export const overlaps = (a, b, tol = 0) =>
  a.minX < b.maxX - tol && a.maxX > b.minX + tol && a.minZ < b.maxZ - tol && a.maxZ > b.minZ + tol;

/**
 * Free placement of product proxies on the plan's floor.
 *
 * Everything geometric is derived from plan.json at construction time: the walkable polygons are
 * the room boundaries, the blockers are the wall segment boxes and the fixed-element boxes, and
 * the wall-snap surfaces are the wall faces the shell builder recorded. Nothing here knows about
 * any particular flat.
 */
export function createPlacement({root, camera, canvas, controls, shell, change, blocked, notify, spawn}) {
  const parent = new T.Group();
  parent.name = 'placed-items';
  root.add(parent);

  const ray = new T.Raycaster();
  const pointer = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), -FLOOR_Y);

  const helper = new T.Box3Helper(new T.Box3(), 0xb9834f);
  helper.visible = false;
  helper.userData.walkIgnore = true;
  root.add(helper);

  const ghost = new T.Mesh(
    new T.BoxGeometry(1, 1, 1),
    new T.MeshBasicMaterial({color: 0xc4483a, transparent: true, opacity: 0.3, depthWrite: false})
  );
  ghost.visible = false;
  ghost.userData.walkIgnore = true;
  root.add(ghost);

  let items = [];
  let selected = -1;
  let drag = null;
  let pending = null;
  let undoStack = [];
  let redoStack = [];
  let raf = null;
  let uid = 0;

  const wallBoxes = shell.wallBoxes();
  const fixedBoxes = shell.fixedBoxes();
  const editable = () => !blocked?.();

  // ---------- validity ----------
  function roomFor(x, z) {
    return shell.rooms.find(room => pointInPolygon(x, z, room.boundary)) || null;
  }

  function valid(candidate, others) {
    const {size, ry, x, z, wallMounted, role} = candidate;
    const area = footprint(x, z, size.w, size.d, ry);

    const room = roomFor(x, z);
    if (!room) return {ok: false, reason: 'outside'};
    if (room.wet && !WET_ALLOWED.has(role)) return {ok: false, reason: 'wet'};

    // A wall-mounted piece hangs on the wall face, which sits just outside the clear floor area,
    // so it is exempt from the wall-overlap test.
    if (!wallMounted && wallBoxes.some(box => overlaps(area, box, 0.02))) return {ok: false, reason: 'wall'};
    if (fixedBoxes.some(box => overlaps(area, box, 0.02))) return {ok: false, reason: 'fixed'};

    const low = size.h <= 0.06;   // rugs sit under everything
    for (const other of others) {
      if (other === candidate || other.uid === candidate.uid) continue;
      if (low || other.size.h <= 0.06) continue;
      // A wall shelf above a sideboard is fine as long as it clears its height.
      if (wallMounted !== other.wallMounted) {
        const hung = wallMounted ? candidate : other;
        const standing = wallMounted ? other : candidate;
        if (standing.size.h <= (hung.y || 0)) continue;
      }
      if (overlaps(area, footprint(other.x, other.z, other.size.w, other.size.d, other.ry), OVERLAP_TOLERANCE)) {
        return {ok: false, reason: 'overlap'};
      }
    }
    return {ok: true, room};
  }

  // ---------- wall snapping ----------
  function nearestWallFace(x, z, depth, width) {
    let best = null;
    for (const face of shell.wallFaces) {
      const dx = face.bx - face.ax;
      const dz = face.bz - face.az;
      const length = Math.hypot(dx, dz) || 1e-6;
      const tRaw = ((x - face.ax) * dx + (z - face.az) * dz) / (length * length);
      const tt = clamp(tRaw, 0, 1);
      const px = face.ax + dx * tt;
      const pz = face.az + dz * tt;
      const distance = Math.hypot(x - px, z - pz);
      // Only snap to a face the point is actually in front of.
      if ((x - px) * face.nx + (z - pz) * face.nz < -0.05) continue;
      if (!best || distance < best.distance) best = {distance, face, tt, length, px, pz, dx, dz};
    }
    if (!best) return null;
    const {face, length, dx, dz} = best;
    const half = width / 2 / length;
    const tt = clamp(best.tt, half, Math.max(half, 1 - half));
    const px = face.ax + dx * tt;
    const pz = face.az + dz * tt;
    return {
      x: snap(px + face.nx * depth / 2),
      z: snap(pz + face.nz * depth / 2),
      // The piece must face into the room, i.e. its +z should align with the face normal.
      ry: Math.atan2(face.nx, face.nz)
    };
  }

  // ---------- item lifecycle ----------
  const record = it => ({
    uid: it.uid, productId: it.productId,
    x: +it.x.toFixed(3), z: +it.z.toFixed(3),
    ry: +it.ry.toFixed(4), y: +(it.y || 0).toFixed(3)
  });
  const list = () => items.map(record);

  function apply(it) {
    it.obj.position.set(it.x, FLOOR_Y + (it.wallMounted ? it.y : 0), it.z);
    it.obj.rotation.y = it.ry;
  }

  function create(entry) {
    const built = spawn(entry.productId);
    if (!built) return null;
    const size = built.userData.size || {w: 0.6, d: 0.6, h: 0.6};
    const wallMounted = !!built.userData.wallMounted;
    const it = {
      uid: entry.uid ?? ++uid,
      productId: entry.productId,
      x: +entry.x || 0,
      z: +entry.z || 0,
      ry: Number.isFinite(entry.ry) ? entry.ry : 0,
      y: wallMounted ? (Number.isFinite(entry.y) ? entry.y : 1.3) : 0,
      obj: built,
      size,
      wallMounted,
      role: built.userData.role || 'generic'
    };
    if (entry.uid) uid = Math.max(uid, entry.uid);
    // The invariant the skill cares about: productId travels with the object, always.
    built.userData.productId = entry.productId;
    built.userData.placementUid = it.uid;
    parent.add(built);
    apply(it);
    items.push(it);
    return it;
  }

  function destroy(it) {
    it.obj.removeFromParent();
    it.obj.traverse(node => {
      if (node.isMesh) node.geometry?.dispose();
    });
  }

  function push(before) {
    undoStack.push(before);
    if (undoStack.length > 40) undoStack.shift();
    redoStack.length = 0;
  }

  function refresh(extra = {}) {
    change?.();
    updateGizmo();
    notify?.({items: list(), selected, pending, ...extra});
  }

  // ---------- selection gizmo ----------
  const bar = document.createElement('div');
  bar.className = 'place-bar';
  bar.hidden = true;
  bar.innerHTML = `
    <button type="button" data-place="rotate">${t('placeRotate')}</button>
    <button type="button" data-place="copy">${t('placeDuplicate')}</button>
    <button type="button" data-place="up">${t('placeRaise')}</button>
    <button type="button" data-place="del">${t('placeDelete')}</button>`;
  canvas.parentElement.appendChild(bar);
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const action = e.target.dataset?.place;
    if (!action) return;
    if (action === 'rotate') rotate(ROTATION_STEP);
    else if (action === 'copy') duplicate();
    else if (action === 'up') raise(0.05);
    else if (action === 'del') remove();
  });

  function updateGizmo() {
    const it = items[selected];
    if (it) {
      helper.box.setFromObject(it.obj);
      helper.visible = true;
      bar.hidden = false;
      bar.querySelector('[data-place="up"]').hidden = !it.wallMounted;
      positionBar();
    } else {
      helper.visible = false;
      bar.hidden = true;
    }
  }

  function positionBar() {
    const it = items[selected];
    if (!it) return;
    const v = new T.Vector3();
    helper.box.getCenter(v);
    v.y = helper.box.max.y + 0.08;
    v.project(camera);
    const rect = canvas.getBoundingClientRect();
    bar.style.left = `${(v.x * 0.5 + 0.5) * rect.width}px`;
    bar.style.top = `${(-v.y * 0.5 + 0.5) * rect.height}px`;
    bar.style.visibility = v.z < 1 ? '' : 'hidden';
  }

  function tick() {
    raf = null;
    if (selected < 0) return;
    positionBar();
    raf = requestAnimationFrame(tick);
  }

  function select(index) {
    selected = index >= 0 && items[index] ? index : -1;
    updateGizmo();
    if (selected >= 0 && !raf) raf = requestAnimationFrame(tick);
    notify?.({items: list(), selected, pending});
  }

  // ---------- pointer plumbing ----------
  function cast(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    ray.setFromCamera(pointer, camera);
    return ray;
  }

  function floorPoint(event) {
    cast(event);
    return ray.ray.intersectPlane(plane, new T.Vector3());
  }

  function pickItem(event) {
    cast(event);
    parent.updateMatrixWorld(true);
    const hits = ray.intersectObjects(parent.children, true);
    for (const hit of hits) {
      for (let node = hit.object; node; node = node.parent) {
        const index = items.findIndex(it => it.obj === node);
        if (index >= 0) return index;
      }
    }
    return -1;
  }

  function resolve(it, px, pz) {
    if (it.wallMounted) {
      const snapped = nearestWallFace(px, pz, it.size.d, it.size.w);
      if (snapped) return snapped;
    }
    return {x: snap(px), z: snap(pz), ry: it.ry};
  }

  function showGhost(it, x, z, ry) {
    const area = footprint(x, z, it.size.w, it.size.d, ry);
    ghost.scale.set(area.maxX - area.minX, Math.max(it.size.h, 0.1), area.maxZ - area.minZ);
    ghost.position.set(x, FLOOR_Y + (it.wallMounted ? it.y : 0) + Math.max(it.size.h, 0.1) / 2, z);
    ghost.visible = true;
  }

  // ---------- public operations ----------
  function add(productId, px, pz, options = {}) {
    const before = list();
    const it = create({productId, x: 0, z: 0, ry: options.ry || 0, y: options.y});
    if (!it) return null;
    const target = resolve(it, px, pz);
    Object.assign(it, target);
    apply(it);

    let check = valid(it, items);
    if (!check.ok) {
      // Spiral outwards on the grid for a spot that does fit before giving up.
      let found = false;
      for (let step = GRID * 2; step <= 1.6 && !found; step += GRID * 2) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const probe = resolve(it, px + Math.cos(angle) * step, pz + Math.sin(angle) * step);
          const trial = {...it, ...probe};
          if (valid(trial, items).ok) {
            Object.assign(it, probe);
            found = true;
            break;
          }
        }
      }
      if (!found) {
        items = items.filter(o => o !== it);
        destroy(it);
        ghost.visible = false;
        notify?.({items: list(), selected, pending, rejected: {productId, reason: check.reason}});
        return null;
      }
      apply(it);
    }
    push(before);
    select(items.indexOf(it));
    refresh();
    return it;
  }

  function mutate(fn) {
    const it = items[selected];
    if (!it) return false;
    const before = list();
    if (!fn(it)) { apply(it); return false; }
    push(before);
    apply(it);
    refresh();
    return true;
  }

  const rotate = (degrees = ROTATION_STEP) => mutate(it => {
    const target = it.ry + T.MathUtils.degToRad(degrees);
    if (!valid({...it, ry: target}, items).ok) return false;
    it.ry = target;
    return true;
  });

  const raise = dy => mutate(it => {
    if (!it.wallMounted) return false;
    const y = clamp((it.y || 1.3) + dy, 0.2, shell.wallHeight - it.size.h - 0.05);
    if (Math.abs(y - it.y) < 1e-6) return false;
    it.y = y;
    return true;
  });

  function remove(index = selected) {
    const it = items[index];
    if (!it) return false;
    const before = list();
    items.splice(index, 1);
    destroy(it);
    push(before);
    select(-1);
    refresh();
    return true;
  }

  function duplicate() {
    const source = items[selected];
    if (!source) return null;
    for (let step = 1; step <= 8; step++) {
      for (const [dx, dz] of [[source.size.w + 0.1, 0], [-(source.size.w + 0.1), 0], [0, source.size.d + 0.1], [0, -(source.size.d + 0.1)]]) {
        const x = snap(source.x + dx * step);
        const z = snap(source.z + dz * step);
        if (valid({...source, x, z, uid: -1}, items).ok) {
          const before = list();
          const it = create({productId: source.productId, x, z, ry: source.ry, y: source.y});
          push(before);
          select(items.indexOf(it));
          refresh();
          return it;
        }
      }
    }
    return null;
  }

  function restoreQuiet(next) {
    for (const it of items) destroy(it);
    items = [];
    selected = -1;
    for (const entry of Array.isArray(next) ? next : []) if (entry?.productId) create(entry);
  }

  function restore(next) {
    restoreQuiet(next);
    undoStack = [];
    redoStack = [];
    select(-1);
    refresh();
  }

  function clear() {
    if (!items.length) return false;
    const before = list();
    for (const it of items) destroy(it);
    items = [];
    push(before);
    select(-1);
    refresh();
    return true;
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(list());
    restoreQuiet(undoStack.pop());
    select(-1);
    refresh();
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(list());
    restoreQuiet(redoStack.pop());
    select(-1);
    refresh();
    return true;
  }

  function setPending(productId) {
    pending = productId || null;
    canvas.style.cursor = pending ? 'copy' : '';
    notify?.({items: list(), selected, pending});
    return pending;
  }

  // ---------- input ----------
  function onDown(event) {
    if (!editable() || event.button !== 0 || pending) return;
    const index = pickItem(event);
    if (index < 0) return;
    select(index);
    const point = floorPoint(event);
    if (!point) return;
    const it = items[index];
    drag = {it, gx: point.x - it.x, gz: point.z - it.z, before: list(), moved: false, last: {x: it.x, z: it.z, ry: it.ry}};
    controls.enabled = false;
    try { canvas.setPointerCapture(event.pointerId); } catch { /* not captured: drag still works */ }
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  function onMove(event) {
    if (!drag) return;
    const point = floorPoint(event);
    if (!point) return;
    const target = resolve(drag.it, point.x - drag.gx, point.z - drag.gz);
    Object.assign(drag.it, target);
    apply(drag.it);
    drag.moved = true;
    if (valid(drag.it, items).ok) {
      drag.last = {...target};
      ghost.visible = false;
    } else {
      showGhost(drag.it, target.x, target.z, target.ry);
    }
    helper.box.setFromObject(drag.it.obj);
    change?.();
    event.stopImmediatePropagation();
  }

  function onUp(event) {
    if (drag) {
      const it = drag.it;
      if (!valid(it, items).ok) { Object.assign(it, drag.last); apply(it); }
      ghost.visible = false;
      controls.enabled = true;
      if (drag.moved) push(drag.before);
      const finished = drag;
      drag = null;
      refresh();
      if (finished.moved) event.stopImmediatePropagation();
      return;
    }
    if (pending && editable()) {
      const point = floorPoint(event);
      if (!point) return;
      const productId = pending;
      setPending(null);
      add(productId, point.x, point.z);
      event.stopImmediatePropagation();
      return;
    }
    if (selected >= 0 && pickItem(event) < 0) select(-1);
  }

  function onCancel() {
    if (!drag) return;
    Object.assign(drag.it, drag.last);
    apply(drag.it);
    ghost.visible = false;
    controls.enabled = true;
    drag = null;
    refresh();
  }

  canvas.addEventListener('pointerdown', onDown, true);
  canvas.addEventListener('pointermove', onMove, true);
  canvas.addEventListener('pointerup', onUp, true);
  canvas.addEventListener('pointercancel', onCancel, true);

  canvas.addEventListener('dragover', event => {
    if (event.dataTransfer.types.includes('application/x-idm-product')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  });
  canvas.addEventListener('drop', event => {
    const productId = event.dataTransfer.getData('application/x-idm-product');
    if (!productId) return;
    event.preventDefault();
    const point = floorPoint({clientX: event.clientX, clientY: event.clientY});
    if (point) add(productId, point.x, point.z);
  });

  window.addEventListener('keydown', event => {
    if (!editable() || selected < 0) return;
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target?.tagName || '')) return;
    if (event.code === 'KeyR') { rotate(event.shiftKey ? -ROTATION_STEP : ROTATION_STEP); event.preventDefault(); }
    else if (event.code === 'Delete' || event.code === 'Backspace') { remove(); event.preventDefault(); }
    else if (event.code === 'KeyD' && (event.ctrlKey || event.metaKey)) { duplicate(); event.preventDefault(); }
    else if (event.code === 'Escape') { select(-1); setPending(null); }
  });

  return {
    add, remove, rotate, raise, duplicate, undo, redo, clear, restore, select, setPending,
    get pending() { return pending; },
    getList: list,
    count: () => items.length,
    selectedIndex: () => selected,
    indexOfProduct: productId => items.findIndex(it => it.productId === productId),
    boxOf(index) {
      const it = items[index];
      if (!it) return null;
      return new T.Box3().setFromObject(it.obj);
    },
    collisionBoxes: () => items.map(it => {
      const area = footprint(it.x, it.z, it.size.w, it.size.d, it.ry);
      return {...area, height: it.size.h, y: it.y};
    }),
    summary() {
      const grouped = {};
      for (const it of items) {
        grouped[it.productId] = grouped[it.productId] || {
          productId: it.productId,
          role: it.role,
          sizeCm: `${Math.round(it.size.w * 100)}×${Math.round(it.size.d * 100)}×${Math.round(it.size.h * 100)}`,
          count: 0
        };
        grouped[it.productId].count++;
      }
      return Object.values(grouped);
    },
    getState: () => ({count: items.length, selected, pending, items: list()})
  };
}
