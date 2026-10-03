import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createRenderer} from './render.js';
import {createMaterials, applyPalette, loadSurfaces} from './materials.js';
import {createShell, pointInPolygon, FLOOR_Y} from './shell.js';
import {createLighting, LIGHT_DEFAULTS} from './lighting.js';
import {createViews} from './views.js';
import {createPlacement} from './placement.js';
import {createWalk} from './walk.js';
import {createMeasure} from './measure.js';
import {createCapture} from './capture.js';
import {buildProxy, loadAssetProxy, normaliseRole} from './proxy.js';
import {encodeState, decodeState, exportProducts as buildProductExport, exportText} from './state.js';

/**
 * createViewer(container, caseData) is the whole runtime API. main.js is only a UI shell on top
 * of it, so a different front end (or a test) can drive the same viewer.
 *
 * caseData = {case, plan, style, products, state, concepts}
 */
export function createViewer(container, caseData, options = {}) {
  const plan = caseData.plan || {};
  const styles = caseData.style?.styles || [];
  const labelRoot = options.labelRoot || container;

  const stack = createRenderer(container, {
    onProgress: options.onProgress,
    onFirstFrame: options.onFirstFrame
  });
  const {scene, renderer, camera, canvas, invalidate} = stack;

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.addEventListener('change', invalidate);

  const root = new T.Group();
  root.name = 'case-root';
  scene.add(root);

  const m = createMaterials(renderer);
  const shell = createShell(plan, m, labelRoot, id => options.onRoomSelect?.(id));
  root.add(shell.group);

  // A soft contact plane keeps the model from floating when seen from outside.
  const contact = new T.Mesh(
    new T.PlaneGeometry(shell.bounds.width * 2.4 + 6, shell.bounds.depth * 2.4 + 6),
    new T.ShadowMaterial({opacity: 0.14})
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(shell.bounds.centerX, FLOOR_Y - 0.3, shell.bounds.centerZ);
  contact.receiveShadow = true;
  contact.userData.walkIgnore = true;
  scene.add(contact);

  const lighting = createLighting({scene, renderer, shell, m, plan});
  stack.setShadowLight(lighting.sun);
  stack.registerGlass(shell.glassMaterials);
  stack.registerTransparent(scene);

  const views = createViews({camera, controls, shell, invalidate});

  // ---------- products ----------
  let products = [];
  const proxyCache = new Map();

  function productById(id) {
    return products.find(product => product.id === id) || null;
  }

  function styleTokens() {
    return {wood: m.wood, fabric: m.fabric, accent: m.accentFabric};
  }

  // The placement layer asks for a fresh object per instance; the cache holds a template so the
  // proxy is only built once per product.
  function spawnProxy(productId) {
    const product = productById(productId);
    if (!product) return null;
    if (!proxyCache.has(productId)) proxyCache.set(productId, buildProxy(product, m, styleTokens()));
    const template = proxyCache.get(productId);
    const clone = template.clone(true);
    clone.userData = {...template.userData};
    clone.traverse(node => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    return clone;
  }

  // ---------- placement ----------
  const placement = createPlacement({
    root, camera, canvas, controls, shell,
    spawn: spawnProxy,
    blocked: () => walk.active || measure.active,
    change: () => { stack.markShadowsDirty(); if (walk.active) walk.rebuild(); },
    notify: detail => {
      options.onItems?.(detail);
      invalidate();
    }
  });

  // ---------- walkthrough ----------
  const insideFloor = (x, z) => shell.rooms.some(room => pointInPolygon(x, z, room.boundary));
  const walk = createWalk({
    camera, canvas, root, insideFloor, invalidate,
    onExit: () => setView('inside')
  });

  const measure = createMeasure({container, canvas, camera, root, invalidate});
  const capture = createCapture({container, renderer, composer: stack.composer, ao: stack.ao, quality: () => stack.quality});

  // ---------- view state ----------
  let view = 'orbit';
  let focus = 'all';
  let wallMode = 'cut';
  let labelsVisible = true;
  let activeStyleId = styles[0]?.id || null;

  function isInside() { return view === 'inside' || view === 'walk'; }

  // Default target for placeProduct(productId) with no coordinates: the room the active style
  // assigns that role to (style.json furnitureRoles[]), else the largest indoor non-wet room
  // (the same rule views.js uses for the inside/walk camera). Falls back to the plan's bounding
  // box centre only if the plan has no usable room at all.
  function defaultTargetFor(productId) {
    const product = productById(productId);
    const style = styles.find(entry => entry.id === activeStyleId) || null;
    let room = null;
    let source = 'largest-indoor-room';
    if (product && style?.furnitureRoles?.length) {
      const role = normaliseRole(product.role);
      const match = style.furnitureRoles.find(fr => normaliseRole(fr.role) === role);
      const candidate = match && shell.rooms.find(r => r.id === match.room);
      if (candidate) { room = candidate; source = 'style-role'; }
    }
    if (!room) room = views.defaultRoom();
    if (!room) return {x: shell.bounds.centerX, z: shell.bounds.centerZ, source: 'bbox-fallback', ry: 0};

    // A long, narrow piece (a sofa in particular) dropped at ry=0 into a room that happens to be
    // narrower in x than in z can never fit the spiral search below, no matter where it probes,
    // because its footprint's long side is pinned to the wrong axis. Starting it rotated so its
    // long side matches the room's long side gives the unchanged spiral search a real chance.
    const xs = room.boundary.map(p => p[0]);
    const zs = room.boundary.map(p => p[1]);
    const roomWide = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs);
    const dims = product?.dimensionsMm;
    let ry = 0;
    if (dims?.width && dims?.depth && (dims.width >= dims.depth) !== roomWide) ry = Math.PI / 2;

    return {x: room.center[0], z: room.center[1], source, ry};
  }

  function applyShellVisibility() {
    shell.setCeilingVisible(isInside());
    shell.setWallHeightMode(isInside() || wallMode === 'full' ? 'full' : 'cut');
    stack.markShadowsDirty();
  }

  function setView(next, {focus: nextFocus} = {}) {
    if (nextFocus) focus = nextFocus;
    walk.stop();
    view = next;
    controls.enabled = next !== 'walk';
    lighting.interior(isInside());
    applyShellVisibility();
    if (next === 'walk') {
      const spot = views.walkStart(focus);
      views.cancel();
      walk.start(spot.position, spot.target);
    } else {
      views.apply(next, focus);
    }
    options.onView?.({view, focus});
    invalidate();
    return view;
  }

  function focusRoom(id) {
    focus = id || 'all';
    if (view === 'walk') return setView('walk');
    views.apply(view, focus);
    options.onView?.({view, focus});
    return focus;
  }

  // ---------- style ----------
  function setStyle(styleId) {
    const style = styles.find(entry => entry.id === styleId) || styles[0];
    if (!style) return null;
    activeStyleId = style.id;
    applyPalette(m, style.palette);
    // The camera is deliberately untouched: switching a design layer must not move the viewer.
    stack.markShadowsDirty();
    invalidate();
    options.onStyle?.(style);
    return style;
  }
  if (activeStyleId) setStyle(activeStyleId);

  // ---------- lighting ----------
  function setLight(changes) {
    const result = lighting.update(changes);
    invalidate();
    options.onLight?.(result);
    return result;
  }

  // ---------- frame hooks ----------
  const vec = new T.Vector3();
  stack.onFrame(dt => {
    let dirty = false;
    if (views.step(dt)) dirty = true;
    if (walk.active) { if (walk.update(dt)) dirty = true; }
    else { controls.update(dt); }
    measure.tick();
    // HTML room labels are projected each frame; they are review annotations, not scene geometry.
    for (const label of shell.labels) {
      vec.copy(label.position).project(camera);
      const show = labelsVisible && !isInside() && vec.z < 1
        && Math.abs(vec.x) < 0.95 && Math.abs(vec.y) < 0.9
        && (focus === 'all' || focus === label.id);
      label.el.style.display = show ? '' : 'none';
      if (show) {
        label.el.style.left = `${(vec.x * 0.5 + 0.5) * container.clientWidth}px`;
        label.el.style.top = `${(-vec.y * 0.5 + 0.5) * container.clientHeight}px`;
      }
    }
    return dirty;
  });

  // Textures upgrade the shared materials in place once they exist on disk.
  loadSurfaces(m, {
    invalidate,
    onLoaded: count => { container.dataset.surfaces = String(count); options.onProgress?.('textures', 0.9 + 0.09 * Math.min(count, 26) / 26); }
  });

  stack.compile(root);
  setView('orbit');
  setLight(LIGHT_DEFAULTS);

  // ---------- public API ----------
  const api = {
    // three.js internals, for tests and for a host that wants to extend the scene
    three: {T, scene, renderer, camera, controls, root, shell, lighting, stack},
    plan,
    styles,

    setProducts(next) {
      products = Array.isArray(next) ? next : [];
      proxyCache.clear();
      // Any product declaring a real asset gets it swapped in behind the procedural placeholder.
      for (const product of products) {
        if (!product.geometry?.assetPath) continue;
        loadAssetProxy(product, m, styleTokens()).then(model => {
          proxyCache.set(product.id, model);
          invalidate();
        });
      }
      return products;
    },

    getProducts: () => products,

    setLayout(items) {
      placement.restore(Array.isArray(items) ? items : []);
      if (walk.active) walk.rebuild();
      invalidate();
      return placement.getList();
    },

    getLayout: () => placement.getList(),

    placeProduct(productId, x, z, opts) {
      const explicit = Number.isFinite(x) && Number.isFinite(z);
      const spot = explicit ? {x, z} : defaultTargetFor(productId);
      // A caller-supplied opts.ry still wins; otherwise the default path's room-fit rotation applies.
      const placeOpts = explicit ? (opts || {}) : {ry: spot.ry, ...(opts || {})};
      const it = placement.add(productId, spot.x, spot.z, placeOpts);
      if (it && !explicit) {
        // The spiral search in placement.js may nudge the item within the room; report the room
        // the final spot actually lands in, not just the one the centroid targeted.
        const landed = shell.rooms.find(room => pointInPolygon(it.x, it.z, room.boundary)) || null;
        it.defaultRoom = landed ? {id: landed.id, name: landed.name} : null;
        it.defaultRoomSource = spot.source;
      }
      return it;
    },

    pickProduct: productId => placement.setPending(productId),

    selectItem(index) {
      placement.select(typeof index === 'number' ? index : placement.indexOfProduct(index));
      invalidate();
      return placement.selectedIndex();
    },

    focusItem(productId) {
      const index = typeof productId === 'number' ? productId : placement.indexOfProduct(productId);
      if (index < 0) return false;
      placement.select(index);
      const box = placement.boxOf(index);
      if (!box) return false;
      const centre = box.getCenter(new T.Vector3());
      const size = box.getSize(new T.Vector3()).length();
      views.cancel();
      controls.target.copy(centre);
      camera.position.copy(centre.clone().add(new T.Vector3(size * 1.1 + 1.2, size * 0.9 + 1.1, size * 1.3 + 1.4)));
      controls.update();
      invalidate();
      return true;
    },

    removeSelected: () => placement.remove(),
    rotateSelected: degrees => placement.rotate(degrees),
    duplicateSelected: () => placement.duplicate(),
    raiseSelected: dy => placement.raise(dy),
    undo: () => placement.undo(),
    redo: () => placement.redo(),
    clearLayout: () => placement.clear(),
    summary: () => placement.summary(),

    setView,
    getView: () => ({view, focus}),
    focusRoom,
    rooms: () => shell.rooms.map(({id, name, kind, wet, outdoor, center, status}) => ({id, name, kind, wet, outdoor, center, status})),

    setWallMode(mode) {
      wallMode = mode === 'full' ? 'full' : 'cut';
      applyShellVisibility();
      invalidate();
      return wallMode;
    },

    setLabelsVisible(visible) { labelsVisible = !!visible; invalidate(); return labelsVisible; },

    setStyle,
    getStyle: () => styles.find(entry => entry.id === activeStyleId) || null,

    setLight,
    getLight: () => lighting.getState(),

    setQuality: level => stack.setQuality(level),
    getQuality: () => stack.quality,

    setMeasure(on) { const result = measure.set(on); invalidate(); return result; },
    capture,

    walkAnalog: (x, y) => walk.setAnalog(x, y),
    walkRun: on => walk.setRun(on),
    walkCrouch: on => walk.setCrouch(on),
    walkState: () => walk.getState(),

    // ---------- state, share, export ----------
    getState() {
      return {
        caseId: caseData.case?.caseId ?? null,
        mode: view,
        focus,
        camera: camera.position.toArray().map(v => +v.toFixed(3)),
        target: controls.target.toArray().map(v => +v.toFixed(3)),
        quality: stack.quality,
        style: activeStyleId,
        wallMode,
        layout: placement.getList(),
        products: products.map(product => ({
          id: product.id, role: product.role, name: product.name,
          dimensionsMm: product.dimensionsMm,
          purchaseUrl: product.purchaseUrl ?? null,
          geometrySource: product.geometry?.source ?? null,
          fit: product.fit?.status ?? 'unknown'
        })),
        evidence: products.map(product => ({
          productId: product.id,
          dimensionSourceUrl: product.dimensionSourceUrl,
          sources: (product.evidence || []).map(e => ({url: e.sourceUrl, type: e.sourceType, retrievedAt: e.retrievedAt}))
        })),
        light: lighting.getState(),
        walk: walk.getState(),
        measure: measure.getState(),
        render: {
          hdri: container.dataset.hdri,
          surfaces: Number(container.dataset.surfaces || 0),
          firstFrame: container.dataset.firstFrame === '1'
        }
      };
    },

    encodeShare() {
      const light = lighting.getState();
      return encodeState({
        styleId: activeStyleId,
        quality: stack.quality,
        view, focus,
        layout: placement.getList(),
        light
      });
    },

    applyShare(hash) {
      const decoded = decodeState(hash);
      if (!decoded) return null;
      if (decoded.styleId) setStyle(decoded.styleId);
      if (decoded.quality) stack.setQuality(decoded.quality);
      if (decoded.light) setLight(decoded.light);
      api.setLayout(decoded.layout);
      if (decoded.view) setView(decoded.view, {focus: decoded.focus || 'all'});
      return decoded;
    },

    exportProducts: () => buildProductExport(products, placement.getList()),
    exportText: () => exportText(products, placement.getList()),

    invalidate,
    resize: () => stack.resize()
  };

  return api;
}
