import * as T from 'three';

// Material presets, built the way the reference project builds its `m` object: a small set of
// named MeshStandard / MeshPhysical instances shared across the whole scene so that a palette
// change is one `.color.set()` and one re-render, not a traversal.
//
// Two-stage quality strategy, same as the reference:
//   1. Procedural canvas textures give grain, weave and pile straight away, offline.
//   2. loadSurfaces() upgrades the same material instances with scanned CC0 PBR maps when
//      public/textures has been populated by scripts/fetch-assets.mjs.
// Nothing downstream needs to know which stage it is in.

function noiseTexture(kind, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // Deterministic LCG: the same "grain" every load, so screenshots are comparable.
  let seed = kind === 'wood' ? 731 : kind === 'rug' ? 4409 : 2113;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = kind === 'wood' ? '#ab8664' : kind === 'rug' ? '#c9bb98' : '#e3dccb';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    ctx.strokeStyle = kind === 'wood' ? `rgba(62,33,17,${rand() * 0.13})` : `rgba(79,64,41,${rand() * 0.12})`;
    ctx.lineWidth = rand() * 1.4;
    const x = rand() * 256;
    const y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Wood grain runs long and vertical; weave and pile are short horizontal strokes.
    ctx.lineTo(kind === 'wood' ? x + rand() * 7 : x + 12, kind === 'wood' ? y + 40 + rand() * 90 : y + rand() * 2);
    ctx.stroke();
  }
  if (kind !== 'wood') {
    for (let y = 0; y < 256; y += 3) {
      ctx.strokeStyle = '#ffffff24';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(kind === 'wood' ? 2 : 3, kind === 'wood' ? 2 : 3);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  return texture;
}

export function createMaterials(renderer) {
  const woodTex = noiseTexture('wood', renderer);
  const clothTex = noiseTexture('cloth', renderer);
  const rugTex = noiseTexture('rug', renderer);

  const std = (color, roughness = 0.8, extra = {}) => new T.MeshStandardMaterial({color, roughness, ...extra});
  const phys = (color, roughness = 0.8, extra = {}) => new T.MeshPhysicalMaterial({color, roughness, ...extra});
  const sheen = hex => ({sheen: 0.4, sheenRoughness: 0.85, sheenColor: new T.Color(hex)});

  const m = {
    // Architecture
    wall: std('#efe9dc', 0.9),
    paint: std('#efe9dc', 0.43),
    plaster: std('#e7e2d6', 0.95),
    edge: std('#d7d2c4', 0.85),
    ceiling: std('#f6f3ec', 0.95),
    skirting: std('#e2ddd0', 0.6),
    // Floors
    floor: phys('#e6e2d7', 0.34, {clearcoat: 0.35, clearcoatRoughness: 0.22}),
    stone: phys('#e7e3d8', 0.22, {clearcoat: 0.85, clearcoatRoughness: 0.12}),
    plank: std('#c5aa81', 0.62, {map: woodTex}),
    tile: phys('#f0ece2', 0.24, {clearcoat: 0.55, clearcoatRoughness: 0.2}),
    floorTile: phys('#e8e4d8', 0.3, {clearcoat: 0.4, clearcoatRoughness: 0.25}),
    concrete: std('#cfcbc0', 0.92),
    // Wood
    wood: std('#8a6a4f', 0.57, {map: woodTex}),
    oak: std('#c8ab80', 0.8, {map: woodTex}),
    // Soft goods
    fabric: phys('#d8cdb6', 0.96, {map: clothTex, ...sheen('#fff3e2')}),
    linen: phys('#c9bfa9', 1, {map: clothTex, ...sheen('#f7ecd9')}),
    accentFabric: std('#a9683f', 0.95, {map: clothTex}),
    rug: phys('#c2b18d', 1, {map: rugTex, ...sheen('#f0e6cf')}),
    leather: phys('#63483a', 0.52, {clearcoat: 0.3, clearcoatRoughness: 0.45}),
    // Hard goods
    metal: std('#6d726f', 0.22, {metalness: 0.92}),
    frame: std('#46484b', 0.38, {metalness: 0.55}),
    chrome: std('#c9ccca', 0.16, {metalness: 1}),
    dark: std('#242c29', 0.4),
    white: std('#f2eee3', 0.8),
    ceramic: phys('#eceae4', 0.32, {clearcoat: 0.7, clearcoatRoughness: 0.14}),
    screen: std('#101418', 0.18, {metalness: 0.4}),
    leaf: std('#58684a', 0.85),
    soil: std('#454133', 1),
    glow: std('#ffe8b6', 0.4, {emissive: '#ffd39a', emissiveIntensity: 1.5}),
    // Glazing: transmission is switched on only in the high tier (see render.js).
    glass: new T.MeshPhysicalMaterial({
      color: '#dce9df', roughness: 0.05, metalness: 0, ior: 1.5, thickness: 0.012,
      clearcoat: 1, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide
    }),
    voile: new T.MeshPhysicalMaterial({color: '#f7f3ea', roughness: 1, transparent: true, opacity: 0.42, side: T.DoubleSide})
  };

  // Bump from the procedural maps gives relief before the scanned normals arrive.
  m.wood.bumpMap = woodTex; m.wood.bumpScale = 0.008;
  m.oak.bumpMap = woodTex; m.oak.bumpScale = 0.008;
  m.fabric.bumpMap = clothTex; m.fabric.bumpScale = 0.013;
  m.linen.bumpMap = clothTex; m.linen.bumpScale = 0.01;
  m.rug.bumpMap = rugTex; m.rug.bumpScale = 0.018;

  m.procedural = {woodTex, clothTex, rugTex};
  return m;
}

// Applies a style.json palette to the shared materials. Roles are matched loosely because a
// style spec is written by a human, not generated: 'wall', 'wood', 'fabric', 'floor', 'accent'.
export function applyPalette(m, palette = []) {
  const pick = role => palette.find(entry => (entry.role || '').toLowerCase().includes(role))?.hex;
  const set = (material, hex) => { if (hex && material) material.color.set(hex); };
  const wall = pick('wall');
  set(m.wall, wall); set(m.paint, wall); set(m.plaster, wall); set(m.ceiling, wall);
  set(m.wood, pick('wood')); set(m.oak, pick('wood'));
  set(m.fabric, pick('fabric')); set(m.linen, pick('fabric'));
  set(m.floor, pick('floor')); set(m.stone, pick('floor'));
  set(m.accentFabric, pick('accent'));
  set(m.frame, pick('frame'));
  return palette;
}

// Upgrades the shared materials with scanned CC0 PBR maps if they were fetched.
// Mirrors the reference project's surfaces.js: diffuse is sRGB, normal/roughness stay linear,
// and a scanned diffuse is neutralised in-shader so palette tinting keeps working.
export function loadSurfaces(m, {invalidate, onLoaded} = {}) {
  const loader = new T.TextureLoader();
  const publicBase = import.meta.env.BASE_URL || '/';
  const publicUrl = relative => `${publicBase}${String(relative).replace(/^\\/+/, '')}`;
  let loaded = 0;

  const configure = (texture, isColor, repeat) => {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = 8;
    texture.colorSpace = isColor ? T.SRGBColorSpace : T.NoColorSpace;
    return texture;
  };

  // Keeps grain but drops the scanned wood's own colour, so a palette hex still reads.
  const neutralise = (material, cacheKey) => {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        float grain = clamp(pow(dot(sampledDiffuseColor.rgb, vec3(.2126, .7152, .0722)), .3), .15, 1.0);
        diffuseColor.rgb *= vec3(.55 + grain * .55);
        #endif
      `);
    };
    material.customProgramCacheKey = () => cacheKey;
  };

  const wire = (asset, slots, repeat, normalScale, materials, after) => {
    for (const [slot, target, isColor] of slots) {
      loader.load(publicUrl(`textures/${asset}_${slot}.jpg`), texture => {
        configure(texture, isColor, repeat);
        for (const material of materials) {
          material[target] = texture;
          if (target !== 'map') material.bumpMap = null;
          material.normalScale = new T.Vector2(normalScale, normalScale);
          after?.(material, target, texture);
          material.needsUpdate = true;
        }
        loaded++;
        invalidate?.();
        onLoaded?.(loaded);
      }, undefined, () => { /* absent texture: the procedural fallback simply stays. */ });
    }
  };

  const full = [['diff', 'map', true], ['nor', 'normalMap', false], ['rough', 'roughnessMap', false]];
  const dataOnly = [['nor', 'normalMap', false], ['rough', 'roughnessMap', false]];

  wire('marble_01', full, [2.3, 2.3], 0.16, [m.floor, m.stone]);
  wire('painted_plaster_wall', dataOnly, [6, 6], 0.55, [m.wall, m.paint, m.plaster, m.ceiling, m.white]);
  wire('wood_table_001', full, [1, 1], 0.25, [m.wood, m.oak], (material, target) => {
    if (target === 'map') neutralise(material, 'idm-tinted-wood-v1');
  });
  wire('wood_floor_deck', full, [0.4, 0.2], 0.4, [m.plank], (material, target) => {
    if (target === 'map') neutralise(material, 'idm-tinted-plank-v1');
  });
  // One scanned tile serves the splashback and, at its own repeat, the bathroom floor.
  wire('long_white_tiles', full, [2.6, 1.2], 0.5, [m.tile], (material, target, texture) => {
    const clone = texture.clone();
    clone.needsUpdate = true;
    clone.repeat.set(1.6, 3.4);
    m.floorTile[target] = clone;
    m.floorTile.normalScale = new T.Vector2(0.5, 0.5);
    m.floorTile.needsUpdate = true;
  });
  wire('concrete_floor_02', full, [1, 3], 0.55, [m.concrete], (material, target) => {
    // The scan is a dark outdoor slab; lift it back to a shaded balcony.
    if (target === 'map') material.color.setScalar(1.6);
  });
  wire('fabric_pattern_07', dataOnly, [3, 3], 0.28, [m.fabric, m.accentFabric]);
  wire('rough_linen', dataOnly, [3, 3], 0.45, [m.linen]);
  wire('brown_leather', dataOnly, [2.6, 2.6], 0.6, [m.leather]);
  wire('dirty_carpet', dataOnly, [4, 4], 0.5, [m.rug]);
}
