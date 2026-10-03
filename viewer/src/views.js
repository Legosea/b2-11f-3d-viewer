import * as T from 'three';

export const VIEWS = ['orbit', 'top', 'axon', 'inside', 'walk'];

/**
 * Camera presets derived from the plan's bounding box, so a studio and a four-bedroom house both
 * frame correctly without any tuning. `focus` is either 'all' or a room id.
 *
 * A style switch never touches the camera: app.js just does not call anything here.
 */
export function createViews({camera, controls, shell, invalidate}) {
  const bounds = shell.bounds;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const span = Math.max(bounds.width, bounds.depth);
  let transition = null;

  const roomById = id => shell.rooms.find(room => room.id === id) || null;

  function boxOf(room) {
    const xs = room.boundary.map(p => p[0]);
    const zs = room.boundary.map(p => p[1]);
    return {
      cx: (Math.min(...xs) + Math.max(...xs)) / 2,
      cz: (Math.min(...zs) + Math.max(...zs)) / 2,
      width: Math.max(...xs) - Math.min(...xs),
      depth: Math.max(...zs) - Math.min(...zs)
    };
  }

  function extentOf(id) {
    const room = roomById(id);
    if (room) return boxOf(room);
    return {cx: bounds.centerX, cz: bounds.centerZ, width: bounds.width, depth: bounds.depth};
  }

  // An interior camera must stand *in a room*. The bounding-box centre of a whole flat is usually
  // a wall or a corridor, so 'all' resolves to the largest indoor room instead.
  function interiorRoom(id) {
    const named = roomById(id);
    if (named && !named.outdoor) return named;
    const indoor = shell.rooms.filter(room => !room.outdoor && !room.wet);
    const pool = indoor.length ? indoor : shell.rooms;
    return pool.reduce((best, room) => {
      const box = boxOf(room);
      const area = box.width * box.depth;
      return !best || area > best.area ? {room, area} : best;
    }, null)?.room || null;
  }

  function preset(view, focus) {
    const e = extentOf(focus);
    const reach = Math.max(e.width, e.depth);
    const target = new T.Vector3(e.cx, view === 'inside' ? 1.3 : 0.4, e.cz);

    if (view === 'top') {
      // Straight down, with a hair of offset so OrbitControls does not gimbal-lock.
      return {position: target.clone().add(new T.Vector3(0.001, reach * 1.55 + 3, 0.001)), target, fov: 32, rotate: false};
    }
    if (view === 'axon') {
      const distance = reach * 1.35 + 5.5;
      return {
        position: target.clone().add(new T.Vector3(-distance * 0.68, distance * 0.62, -distance * 0.68)),
        target, fov: 24, rotate: true
      };
    }
    if (view === 'inside' || view === 'walk') {
      // Stand inside the room, backed a third of the way toward one end, looking across it. Both
      // the eye and the look-at point stay within the room's own extent, so neither ends up in a
      // wall the way a bounding-box centre would.
      const room = interiorRoom(focus);
      const box = room ? boxOf(room) : e;
      const alongX = box.width >= box.depth;
      const eye = new T.Vector3(
        alongX ? box.cx - box.width * 0.34 : box.cx,
        1.6,
        alongX ? box.cz : box.cz - box.depth * 0.34
      );
      const look = new T.Vector3(
        alongX ? box.cx + box.width * 0.42 : box.cx,
        1.28,
        alongX ? box.cz : box.cz + box.depth * 0.42
      );
      return {position: eye, target: look, fov: window.innerWidth <= 800 ? 76 : 64, rotate: true};
    }
    const distance = reach * 1.25 + 5;
    return {
      position: target.clone().add(new T.Vector3(-distance * 0.55, distance * 0.62, distance * 0.72)),
      target, fov: 38, rotate: true
    };
  }

  function apply(view, focus, {instant = false} = {}) {
    const p = preset(view, focus);
    const inside = view === 'inside' || view === 'walk';
    // Widen the framing when the viewport is narrow, so a phone still sees the whole plan.
    if (!inside && camera.aspect > 0) {
      p.position.sub(p.target).multiplyScalar(Math.max(1, 0.95 / camera.aspect)).add(p.target);
    }
    camera.fov = p.fov;
    camera.updateProjectionMatrix();
    controls.minDistance = inside ? 0.25 : Math.max(1.5, span * 0.12);
    controls.maxDistance = inside ? Math.max(4, span * 0.6) : span * 3.4 + 12;
    controls.maxPolarAngle = inside ? Math.PI * 0.94 : Math.PI * 0.48;
    controls.enableRotate = p.rotate;
    if (instant || reduced || inside) {
      transition = null;
      camera.position.copy(p.position);
      controls.target.copy(p.target);
      controls.update();
    } else {
      transition = {position: p.position, target: p.target};
    }
    invalidate();
    return p;
  }

  function step(dt) {
    if (!transition) return false;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 8);
    camera.position.lerp(transition.position, k);
    controls.target.lerp(transition.target, k);
    if (camera.position.distanceTo(transition.position) < 0.006) {
      camera.position.copy(transition.position);
      controls.target.copy(transition.target);
      transition = null;
    }
    return true;
  }

  return {
    apply,
    step,
    preset,
    cancel() { transition = null; },
    walkStart(focus) {
      const p = preset('walk', focus);
      return {position: p.position.toArray(), target: p.target.toArray()};
    },
    // Same "largest indoor, non-wet room" rule the inside/walk presets use, exposed so a caller
    // (e.g. default product placement) can target a real room instead of the plan's bbox centre.
    defaultRoom: () => interiorRoom(null)
  };
}
