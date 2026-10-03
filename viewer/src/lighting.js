import * as T from 'three';
import {getPosition} from 'suncalc';
import {Sky} from 'three/addons/objects/Sky.js';

export const LIGHT_DEFAULTS = {
  date: new Date().toISOString().slice(0, 10),
  hour: 15,
  bearing: 0,          // compass bearing of the plan's +z ("down the page") direction
  lat: 25.03,
  lng: 121.56,
  cloud: 0.15,
  curtain: 0,
  sheer: true,
  main: 65,
  task: 80,
  accent: 60,
  kelvin: 3000
};

// Planckian locus approximation. Good enough to make 2700K read warm and 5000K read neutral.
function temperature(kelvin) {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * ((t - 60) ** -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * ((t - 60) ** -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const clamp = v => T.MathUtils.clamp(v, 0, 255) / 255;
  return new T.Color().setRGB(clamp(r), clamp(g), clamp(b), T.SRGBColorSpace);
}

/**
 * Solar position for a wall-clock time, converted into a scene direction vector.
 *
 * `bearing` is the compass bearing that the plan's +z axis points at. With northDeg unknown the
 * UI labels this as an illustrative orientation and lets the user rotate it; nothing here claims
 * the result is a real daylight study.
 */
export function solarPosition(state) {
  const hours = Math.floor(state.hour);
  const minutes = Math.round((state.hour - hours) * 60);
  // The slider is local wall-clock time at the site. Without a tz database the offset is derived
  // from longitude (15 degrees per hour), which is right to the hour for most places and is
  // reported back to the UI as an approximation rather than a claim.
  const offsetHours = Math.round(state.lng / 15);
  const instant = new Date(`${state.date}T00:00:00Z`);
  instant.setTime(instant.getTime() + (hours * 60 + minutes - offsetHours * 60) * 60000);
  const position = getPosition(instant, state.lat, state.lng);
  const altitude = position.altitude;
  // suncalc azimuth is measured from south, clockwise. Convert to a compass bearing, then into
  // plan space by subtracting the bearing that +z points at.
  const compass = position.azimuth + Math.PI;
  const relative = compass - T.MathUtils.degToRad(state.bearing);
  return {
    altitudeDeg: T.MathUtils.radToDeg(altitude),
    azimuthDeg: (T.MathUtils.radToDeg(compass) + 360) % 360,
    instant: instant.toISOString(),
    utcOffsetHours: offsetHours,
    // +z is the plan's "down" direction; a sun on that bearing must sit on -z to shine along +z.
    vector: [
      -Math.sin(relative) * Math.cos(altitude),
      Math.sin(altitude),
      -Math.cos(relative) * Math.cos(altitude)
    ]
  };
}

export function createLighting({scene, renderer, shell, m, plan}) {
  const state = {...LIGHT_DEFAULTS};
  const northKnown = Number.isFinite(plan?.source?.northDeg);
  if (northKnown) state.bearing = plan.source.northDeg;
  let inside = false;

  const bounds = shell.bounds;
  const radius = Math.max(bounds.radius, 3);

  const hemi = new T.HemisphereLight(0xfff7e6, 0x8e9684, 0.65);
  scene.add(hemi);

  const sun = new T.DirectionalLight(0xffeed4, 1.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.018;
  sun.shadow.bias = -0.00006;
  sun.shadow.radius = 3;
  sun.shadow.blurSamples = 12;
  // The shadow frustum is fitted to the plan's own bounding box rather than a fixed number, so a
  // 40 m² flat and a 200 m² house both get their shadow-map texels spent on the model.
  const margin = radius * 0.35 + 1;
  Object.assign(sun.shadow.camera, {
    left: -(radius + margin), right: radius + margin,
    top: radius + margin, bottom: -(radius + margin),
    near: 0.5, far: radius * 6 + 20
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set(bounds.centerX, 0, bounds.centerZ);
  scene.add(sun, sun.target);

  const fill = new T.DirectionalLight(0xe4eeff, 0.38);
  fill.position.set(bounds.centerX + radius, radius * 1.4, bounds.centerZ + radius);
  scene.add(fill);

  // Warm bounce off the floor once the room is lit from inside. Qualitative, not radiosity.
  const lampBounce = new T.AmbientLight(0xffe3b9, 0);
  scene.add(lampBounce);
  const floorBounce = new T.HemisphereLight(0x1a140c, 0xffc98d, 0);
  scene.add(floorBounce);

  const sky = new Sky();
  sky.scale.setScalar(Math.max(450, radius * 60));
  sky.visible = false;
  sky.material.uniforms.turbidity.value = 3.5;
  sky.material.uniforms.rayleigh.value = 1.7;
  scene.add(sky);

  // ---------- interior fixtures, generated from the plan ----------
  const fixtures = new T.Group();
  fixtures.name = 'light-fixtures';
  fixtures.visible = false;
  shell.group.add(fixtures);

  const circuits = {main: [], task: [], accent: []};
  const emissive = {
    main: m.glow.clone(),
    task: m.glow.clone(),
    accent: m.glow.clone()
  };

  function downlight(x, z, circuit, power) {
    const light = new T.SpotLight(0xffe5bc, power, Math.max(6, shell.wallHeight * 2.6), 1.05, 0.92, 2);
    light.position.set(x, shell.wallHeight - 0.16, z);
    light.target.position.set(x, 0, z);
    light.castShadow = circuit === 'main';
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.00008;
    light.shadow.normalBias = 0.022;
    light.shadow.camera.near = 0.35;
    light.shadow.camera.far = shell.wallHeight + 1;
    fixtures.add(light, light.target);
    circuits[circuit].push({light, power});

    const housing = new T.Mesh(new T.CylinderGeometry(0.063, 0.063, 0.035, 20), m.white);
    housing.position.set(x, shell.wallHeight - 0.09, z);
    fixtures.add(housing);
    const disc = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.006, 20), emissive[circuit]);
    disc.position.set(x, shell.wallHeight - 0.115, z);
    fixtures.add(disc);
  }

  // One or more downlights per room, laid out on the room's own bounding box. Outdoor rooms and
  // very small rooms get a single centred fitting.
  for (const room of shell.rooms) {
    if (room.outdoor) continue;
    const xs = room.boundary.map(p => p[0]);
    const zs = room.boundary.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const d = Math.max(...zs) - Math.min(...zs);
    const cols = Math.max(1, Math.min(3, Math.round(w / 2.2)));
    const rowsCount = Math.max(1, Math.min(3, Math.round(d / 2.2)));
    const circuit = room.wet ? 'task' : /kitchen|utility/.test(room.kind) ? 'task' : 'main';
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rowsCount; j++) {
        const x = Math.min(...xs) + w * (i + 0.5) / cols;
        const z = Math.min(...zs) + d * (j + 0.5) / rowsCount;
        // Non-rectangular rooms (an L-shaped hall) can put a grid point outside the polygon.
        if (!room.boundary.length || pointInside(x, z, room.boundary)) downlight(x, z, circuit, 26);
      }
    }
    // A soft accent wash at the room centre keeps night renders from going flat.
    const accent = new T.PointLight(0xffdcab, 1.4, Math.max(2.4, Math.min(w, d)), 2);
    accent.position.set(room.center[0], shell.wallHeight * 0.55, room.center[1]);
    fixtures.add(accent);
    circuits.accent.push({light: accent, power: 1.4});
  }

  function pointInside(x, z, points) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, zi] = points[i];
      const [xj, zj] = points[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi) hit = !hit;
    }
    return hit;
  }

  // ---------- curtains ----------
  const curtains = [];
  for (const part of shell.openingParts) {
    const type = part.userData.type;
    if (type !== 'window' && type !== 'sliding') continue;
    const glass = part.children.find(child => child.name.startsWith('glass-'));
    if (!glass) continue;
    const width = glass.geometry.parameters.width;
    const height = glass.geometry.parameters.height;
    const bottom = glass.position.y - height / 2;
    const group = new T.Group();
    group.position.set(0, 0, 0);
    part.add(group);
    const panels = [];
    for (const side of [-1, 1]) {
      const heavy = new T.Mesh(new T.BoxGeometry(width * 0.55, height + 0.24, 0.035), m.fabric);
      heavy.position.set(side * width * 0.36, bottom + (height + 0.24) / 2, 0.1);
      heavy.castShadow = true;
      group.add(heavy);
      panels.push({mesh: heavy, side, width});
      const voile = new T.Mesh(new T.PlaneGeometry(width * 0.52, height + 0.2), m.voile);
      voile.position.set(side * width * 0.26, bottom + (height + 0.2) / 2, 0.06);
      group.add(voile);
      panels.push({mesh: voile, side, width, sheer: true});
    }
    const rail = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, width + 0.2, 10), m.metal);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, bottom + height + 0.16, 0.1);
    group.add(rail);
    curtains.push({group, panels, width});
  }

  function setCurtains(amount, sheer) {
    for (const curtain of curtains) {
      for (const panel of curtain.panels) {
        if (panel.sheer) {
          panel.mesh.visible = sheer;
          continue;
        }
        // Closed: the two panels meet at the centre. Open: they bunch against the jambs.
        const openX = panel.side * curtain.width * 0.36;
        const closedX = panel.side * curtain.width * 0.14;
        panel.mesh.position.x = T.MathUtils.lerp(openX, closedX, amount);
        panel.mesh.scale.x = T.MathUtils.lerp(0.55, 1.0, amount) / 0.55;
        panel.mesh.visible = true;
      }
    }
  }

  const dayColor = new T.Color('#d9e4e6');
  const nightColor = new T.Color('#111c2c');

  function update(changes = {}) {
    Object.assign(state, changes);
    const solar = solarPosition(state);
    const altitude = solar.altitudeDeg;
    const elevation = Math.max(0, Math.sin(T.MathUtils.degToRad(altitude)));
    const day = T.MathUtils.smoothstep(altitude, -6, 12);

    sun.position.set(
      bounds.centerX + solar.vector[0] * radius * 3,
      solar.vector[1] * radius * 3,
      bounds.centerZ + solar.vector[2] * radius * 3
    );
    sun.intensity = altitude > 0 ? (2.4 * Math.pow(elevation, 0.32) + 0.2) * (1 - state.cloud * 0.96) : 0;
    sun.color.copy(temperature(2800 + 3500 * Math.min(1, elevation * 2)));
    // Sheer curtains scatter and attenuate daylight. Qualitative approximation, not photometry.
    if (state.sheer) sun.intensity *= 0.68;
    sun.intensity *= 1 - state.curtain * 0.85;

    hemi.intensity = inside ? 0.03 + day * 0.3 * (1 - state.curtain * 0.72) : 0.16 + day * 1.05;
    hemi.color.copy(nightColor).lerp(dayColor, day);
    fill.intensity = inside ? 0 : 0.08 + day * 0.5;
    scene.environmentIntensity = inside
      ? 0.01 + day * 0.08 * (1 - state.curtain * 0.8)
      : 0.09 + day * 0.32;
    renderer.toneMappingExposure = inside ? 1.22 : 1.05;

    for (const [name, list] of Object.entries(circuits)) {
      for (const {light, power} of list) {
        light.intensity = power * state[name] / 100;
        light.color.copy(temperature(state.kelvin));
      }
    }
    for (const [name, material] of Object.entries(emissive)) {
      material.emissive.copy(temperature(state.kelvin));
      material.emissiveIntensity = state[name] / 100 * 2.3;
    }
    lampBounce.intensity = inside ? state.main * 0.0035 + state.task * 0.0006 + state.accent * 0.0004 : 0;
    lampBounce.color.copy(temperature(state.kelvin));
    floorBounce.intensity = inside ? (1 - day) * (state.main * 0.0022 + state.accent * 0.0011) : 0;
    floorBounce.groundColor.copy(temperature(Math.min(state.kelvin, 2900)));
    m.glow.emissive.copy(temperature(state.kelvin));
    m.glow.emissiveIntensity = (state.accent + state.task) / 200;

    sky.material.uniforms.sunPosition.value.set(...solar.vector);
    sky.material.uniforms.turbidity.value = 3 + state.cloud * 8;
    sky.visible = inside && day > 0.03;
    scene.background = new T.Color(inside ? (day > 0.03 ? '#bccbd0' : '#101723') : (day > 0.03 ? '#e9e6dd' : '#343e39'));

    setCurtains(state.curtain, state.sheer);
    renderer.shadowMap.needsUpdate = true;
    return {...state, solar, day, night: day < 0.1, inside, northKnown};
  }

  return {
    sun, hemi, fill, fixtures, state, update, northKnown,
    interior(on) {
      inside = on;
      fixtures.visible = on;
      return update();
    },
    getState: () => ({...state, solar: solarPosition(state), inside, northKnown})
  };
}
