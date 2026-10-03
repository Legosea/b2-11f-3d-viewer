import * as T from 'three';

/**
 * First-person walkthrough with conservative collision.
 *
 * Collision is a capsule footprint against axis-aligned boxes rebuilt from whatever is currently
 * visible in the scene, so a newly placed sofa blocks the walker without any bookkeeping. The
 * walkable area itself comes from the plan: a position is only legal if it is inside one of the
 * room polygons, which means the walker cannot leave the flat even where no wall was modelled.
 */
export function createWalk({camera, canvas, root, insideFloor, invalidate, onExit}) {
  const RADIUS = 0.16;
  let active = false;
  let yaw = 0;
  let pitch = 0;
  let drag = null;
  let blocks = [];
  let stand = 1.65;
  let eye = stand;
  let vx = 0;
  let vz = 0;
  let bob = 0;
  let bobT = 0;
  let running = false;
  let crouched = false;
  let locked = false;
  const keys = new Set();
  const analog = {x: 0, y: 0};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tmpBox = new T.Box3();

  function addBlock(box) {
    // Only waist-height obstacles matter: a rug underfoot and a ceiling overhead must not block.
    if (box.max.y < 0.2 || box.min.y > 1.3) return;
    // A single merged mesh spanning the whole flat would make everything solid.
    if (box.max.x - box.min.x > 20 || box.max.z - box.min.z > 20) return;
    blocks.push({minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z});
  }

  function rebuild() {
    root.updateMatrixWorld(true);
    blocks = [];
    root.traverse(object => {
      if (!object.isMesh || object.userData.walkIgnore) return;
      const material = object.material;
      if (material && !Array.isArray(material) && material.transparent && material.opacity < 0.5) return;
      for (let node = object; node; node = node.parent) if (!node.visible) return;
      addBlock(tmpBox.setFromObject(object));
    });
    return blocks.length;
  }

  function clearFootprint(x, z) {
    if (insideFloor && !insideFloor(x, z)) return false;
    return !blocks.some(b => x > b.minX - RADIUS && x < b.maxX + RADIUS && z > b.minZ - RADIUS && z < b.maxZ + RADIUS);
  }

  // Axis-separated stepping: sliding along a wall instead of sticking in its corner.
  function slideMove(position, dx, dz) {
    const p = {...position};
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.045));
    for (let i = 0; i < steps; i++) {
      if (clearFootprint(p.x + dx / steps, p.z)) p.x += dx / steps;
      if (clearFootprint(p.x, p.z + dz / steps)) p.z += dz / steps;
    }
    return p;
  }

  function look() {
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);
    camera.position.y = eye + bob;
    invalidate();
  }

  function start(position, target) {
    active = true;
    keys.clear();
    analog.x = analog.y = 0;
    vx = vz = bob = 0;
    running = false;
    crouched = false;
    eye = stand;
    rebuild();
    camera.position.set(position[0], eye, position[2]);
    if (!clearFootprint(camera.position.x, camera.position.z)) {
      // Spawn point is inside something: spiral out to the nearest legal spot.
      let found = false;
      for (let r = 0.2; r <= 2.4 && !found; r += 0.12) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          const x = position[0] + Math.cos(a) * r;
          const z = position[2] + Math.sin(a) * r;
          if (clearFootprint(x, z)) { camera.position.x = x; camera.position.z = z; found = true; break; }
        }
      }
    }
    const direction = new T.Vector3(...target).sub(camera.position).normalize();
    yaw = Math.atan2(-direction.x, -direction.z);
    pitch = Math.asin(T.MathUtils.clamp(direction.y, -1, 1));
    look();
    canvas.focus();
  }

  function unlock() {
    if (locked && document.exitPointerLock) { try { document.exitPointerLock(); } catch { /* ignore */ } }
  }

  function stop() {
    active = false;
    keys.clear();
    drag = null;
    analog.x = analog.y = 0;
    vx = vz = bob = 0;
    running = false;
    crouched = false;
    eye = stand;
    unlock();
  }

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    drag = null;
    if (!locked) keys.clear();
  });
  document.addEventListener('mousemove', event => {
    if (!active || !locked) return;
    yaw -= event.movementX * 0.0022;
    pitch = T.MathUtils.clamp(pitch - event.movementY * 0.0022, -1.25, 1.25);
    look();
  });

  canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', event => {
    if (!active) return;
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    canvas.focus();
    if (event.pointerType !== 'touch' && !locked && canvas.requestPointerLock) {
      try { canvas.requestPointerLock(); } catch { /* ignore */ }
    }
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || !drag || drag.id !== event.pointerId) return;
    yaw -= (event.clientX - drag.x) * 0.004;
    pitch = T.MathUtils.clamp(pitch - (event.clientY - drag.y) * 0.003, -1.25, 1.25);
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
    look();
  });
  for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { drag = null; });

  // A resize while walking (fullscreen, rotation) needs a repaint; the loop is on demand.
  new ResizeObserver(() => { if (active) look(); }).observe(canvas);

  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE'];
  window.addEventListener('keydown', event => {
    if (!active) return;
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target?.tagName || '')) return;
    if (event.code === 'Escape') { stop(); onExit?.(); return; }
    if (event.code === 'Space') { event.preventDefault(); return; }
    if (event.code === 'KeyC') { if (!event.repeat) setCrouch(!crouched); event.preventDefault(); return; }
    if (event.shiftKey) running = true;
    if (MOVE_KEYS.includes(event.code)) { keys.add(event.code); event.preventDefault(); }
  });
  window.addEventListener('keyup', event => {
    keys.delete(event.code);
    if (event.key === 'Shift') running = false;
  });
  const rest = () => { keys.clear(); running = false; analog.x = analog.y = 0; };
  window.addEventListener('blur', rest);
  document.addEventListener('visibilitychange', rest);

  function setCrouch(on) {
    crouched = on;
    eye = on ? stand * 0.7 : stand;
    if (active) look();
  }

  function update(dt) {
    if (!active) return false;
    const has = (a, b) => keys.has(a) || keys.has(b);
    const forward = Number(has('KeyW', 'ArrowUp')) - Number(has('KeyS', 'ArrowDown')) + analog.y;
    const side = Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft')) + analog.x;
    const turn = Number(keys.has('KeyQ')) - Number(keys.has('KeyE'));
    const length = Math.hypot(forward, side);
    const magnitude = Math.min(1, length);
    const wanted = magnitude * (running ? 2.6 : 1.4) * (crouched ? 0.62 : 1);
    const ux = length ? side / length : 0;
    const uz = length ? forward / length : 0;
    const tx = (-Math.sin(yaw) * uz + Math.cos(yaw) * ux) * wanted;
    const tz = (-Math.cos(yaw) * uz - Math.sin(yaw) * ux) * wanted;
    const k = Math.min(1, dt * (length ? 9 : 11));
    vx += (tx - vx) * k;
    vz += (tz - vz) * k;
    if (turn) yaw += turn * dt * 1.6;
    const speed = Math.hypot(vx, vz);
    if (speed < 0.004) {
      if (vx || vz || bob || turn) { vx = vz = bob = 0; look(); }
      return !!turn;
    }
    const before = {x: camera.position.x, z: camera.position.z};
    const after = slideMove(before, vx * dt, vz * dt);
    const mx = after.x - before.x;
    const mz = after.z - before.z;
    if (!mx) vx = 0;
    if (!mz) vz = 0;
    camera.position.x = after.x;
    camera.position.z = after.z;
    const moved = Math.hypot(mx, mz);
    bobT += moved * 7.6;
    bob = reduced || moved < 1e-5 ? 0 : Math.sin(bobT) * Math.min(moved / (dt * 1.4), 1) * 0.0075;
    look();
    return true;
  }

  return {
    start, stop, rebuild, update, setCrouch,
    setEye(value) { stand = value; if (!crouched) eye = value; if (active) look(); },
    setAnalog(x, y) { analog.x = T.MathUtils.clamp(x, -1, 1); analog.y = T.MathUtils.clamp(y, -1, 1); },
    setRun(on) { running = !!on; },
    get active() { return active; },
    get locked() { return locked; },
    getState: () => ({
      active,
      position: camera.position.toArray().map(v => +v.toFixed(3)),
      yaw: +yaw.toFixed(4),
      pitch: +pitch.toFixed(4),
      colliders: blocks.length,
      blocked: !clearFootprint(camera.position.x, camera.position.z),
      running, crouched, locked, eye
    })
  };
}
