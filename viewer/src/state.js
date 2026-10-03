// Persistence, sharing and export.
//
// The invariant the skill contract cares about: a placed object never loses its `productId`.
// Every representation below (localStorage record, share hash, JSON export, text list) is keyed
// on productId, and decode drops an entry that has lost it rather than inventing a replacement.

const CURRENT_KEY = 'idm-current';
const SAVED_KEY = 'idm-saved';
export const MAX_SAVED = 6;

const round = (value, factor) => Math.round((+value || 0) * factor) / factor;

const toBase64Url = text =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = text => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
};

/**
 * Compact share encoding. Product ids are hoisted into a dictionary so ten copies of one sofa
 * cost one id plus ten short rows.
 */
export function encodeState({styleId, quality, view, focus, layout = [], light = {}} = {}) {
  const ids = [];
  const indexOf = id => {
    let index = ids.indexOf(id);
    if (index < 0) { ids.push(id); index = ids.length - 1; }
    return index;
  };
  const payload = {
    v: 1,
    s: styleId || null,
    q: quality || null,
    w: view || null,
    f: focus || null,
    p: [],
    i: layout.filter(item => item && item.productId).map(item => [
      indexOf(item.productId),
      round(item.x, 100), round(item.z, 100), round(item.ry, 1000), round(item.y, 100)
    ]),
    l: [light.date || null, round(light.hour, 100), round(light.bearing, 10), round(light.cloud, 100),
      round(light.curtain, 100), light.sheer === false ? 0 : 1, light.kelvin || null]
  };
  payload.p = ids;
  return toBase64Url(JSON.stringify(payload));
}

export function decodeState(hash) {
  if (typeof hash !== 'string') return null;
  const raw = hash.replace(/^#/, '').trim();
  if (!raw) return null;
  try {
    const payload = JSON.parse(fromBase64Url(raw));
    if (!payload || typeof payload !== 'object') return null;
    const ids = Array.isArray(payload.p) ? payload.p : [];
    const layout = (Array.isArray(payload.i) ? payload.i : [])
      .map(([index, x, z, ry, y]) => {
        const productId = ids[index];
        // An entry without a resolvable productId is dropped, never guessed.
        if (typeof productId !== 'string' || !productId) return null;
        return {productId, x: +x || 0, z: +z || 0, ry: +ry || 0, y: +y || 0};
      })
      .filter(Boolean);
    const [date, hour, bearing, cloud, curtain, sheer, kelvin] = Array.isArray(payload.l) ? payload.l : [];
    return {
      styleId: payload.s || null,
      quality: payload.q || null,
      view: payload.w || null,
      focus: payload.f || null,
      layout,
      light: date ? {date, hour: +hour, bearing: +bearing, cloud: +cloud, curtain: +curtain, sheer: sheer !== 0, kelvin: +kelvin || 3000} : null
    };
  } catch {
    return null;
  }
}

export function loadCurrent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCurrent(record) {
  try { localStorage.setItem(CURRENT_KEY, JSON.stringify(record)); return true; }
  catch { return false; }
}

export function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

export function pushSaved(record) {
  const saved = loadSaved();
  saved.unshift({...JSON.parse(JSON.stringify(record)), savedAt: new Date().toISOString()});
  const trimmed = saved.slice(0, MAX_SAVED);
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(trimmed)); return trimmed; }
  catch { return saved; }
}

/**
 * JSON export of the products that are actually in the scene, with their evidence intact.
 * This is what a user hands to a supplier, so nothing is summarised away.
 */
export function exportProducts(products, layout) {
  const counts = new Map();
  for (const item of layout) counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
  return {
    exportedAt: new Date().toISOString(),
    note: 'Dimensions come from each product record. Scene objects are proxies unless geometry.source says otherwise. No purchase has been made or verified.',
    items: products
      .filter(product => counts.has(product.id))
      .map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand ?? null,
        model: product.model ?? null,
        role: product.role,
        market: product.market,
        quantity: counts.get(product.id),
        dimensionsMm: product.dimensionsMm,
        dimensionSourceUrl: product.dimensionSourceUrl,
        purchaseUrl: product.purchaseUrl ?? null,
        price: product.price ?? null,
        evidence: product.evidence,
        geometry: product.geometry,
        fit: product.fit
      })),
    placed: layout.map(item => ({
      productId: item.productId,
      x: item.x, z: item.z, rotationDeg: +(item.ry * 180 / Math.PI).toFixed(1), y: item.y
    }))
  };
}

export function exportText(products, layout) {
  const byId = new Map(products.map(product => [product.id, product]));
  const counts = new Map();
  for (const item of layout) counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
  const lines = [`Placed items (${layout.length})`, ''];
  for (const [id, count] of counts) {
    const product = byId.get(id);
    const dims = product?.dimensionsMm;
    lines.push(
      `- ${product?.name || id} x${count}` +
      (dims ? `  ${dims.width}×${dims.depth}×${dims.height} mm` : '') +
      (product?.purchaseUrl ? `\n  ${product.purchaseUrl}` : '\n  (no purchase URL on record)')
    );
  }
  lines.push('', 'Dimensions are taken from each product record; scene shapes are proxies.');
  return lines.join('\n');
}
