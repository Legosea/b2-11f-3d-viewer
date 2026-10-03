import * as T from 'three';
import {FLOOR_Y} from './shell.js';

// Two floor picks give a straight line and a centimetre label. Deliberately minimal: it measures
// the model, which is only as true as plan.json, so it must never be presented as a site survey.
export function createMeasure({container, canvas, camera, root, invalidate}) {
  const group = new T.Group();
  group.name = 'measure';
  group.userData.walkIgnore = true;
  root.add(group);

  const label = document.createElement('div');
  label.className = 'measure-label';
  label.hidden = true;
  container.appendChild(label);

  const lineMaterial = new T.LineBasicMaterial({color: 0xbb7143});
  const dotMaterial = new T.MeshBasicMaterial({color: 0xbb7143});
  const plane = new T.Plane(new T.Vector3(0, 1, 0), -(FLOOR_Y + 0.005));
  let points = [];
  let down = null;
  let on = false;

  function clear() {
    group.clear();
    points = [];
    label.hidden = true;
    invalidate();
  }

  function draw() {
    group.clear();
    for (const point of points) {
      const dot = new T.Mesh(new T.SphereGeometry(0.035, 12, 8), dotMaterial);
      dot.position.copy(point);
      dot.userData.walkIgnore = true;
      group.add(dot);
    }
    if (points.length === 2) group.add(new T.Line(new T.BufferGeometry().setFromPoints(points), lineMaterial));
    group.userData.walkIgnore = true;
    invalidate();
  }

  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new T.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new T.Raycaster();
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, new T.Vector3());
  }

  canvas.addEventListener('pointerdown', event => { if (on) down = {x: event.clientX, y: event.clientY}; });
  canvas.addEventListener('pointerup', event => {
    if (!on || !down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    // A drag was a camera move, not a measurement pick.
    if (moved > 6) return;
    const point = pick(event);
    if (!point) return;
    if (points.length >= 2) points = [];
    points.push(point);
    draw();
  });
  window.addEventListener('keydown', event => { if (event.code === 'Escape' && on) clear(); });

  const vec = new T.Vector3();
  return {
    set(next) {
      on = !!next;
      clear();
      canvas.style.cursor = on ? 'crosshair' : '';
      return on;
    },
    get active() { return on; },
    // Called every frame while measuring so the label tracks the camera.
    tick() {
      if (on && points.length === 2) {
        const [a, b] = points;
        vec.copy(a).add(b).multiplyScalar(0.5);
        vec.y += 0.06;
        vec.project(camera);
        label.hidden = false;
        label.textContent = `${Math.round(a.distanceTo(b) * 100)} cm`;
        label.style.left = `${(vec.x * 0.5 + 0.5) * container.clientWidth}px`;
        label.style.top = `${(-vec.y * 0.5 + 0.5) * container.clientHeight}px`;
      } else if (!label.hidden) {
        label.hidden = true;
      }
    },
    getState: () => ({
      on,
      points: points.map(p => [+p.x.toFixed(3), +p.z.toFixed(3)]),
      cm: points.length === 2 ? Math.round(points[0].distanceTo(points[1]) * 100) : 0
    })
  };
}
