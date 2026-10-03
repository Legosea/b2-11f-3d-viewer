import {i18n, t} from './i18n.js';
import {normaliseRole} from './proxy.js';

// Product panel. Every card shows the whole evidence chain, because the skill's rule is that a
// product only enters the model with traceable dimensions, a source, a purchase URL and a fit
// status. Anything missing is rendered as "unknown", never as a blank or a zero.

const STATUS_LABEL = {
  confirmed: () => t('evidenceConfirmed'),
  estimated: () => t('evidenceEstimated'),
  inferred: () => t('evidenceInferred'),
  unknown: () => t('evidenceUnknown')
};

const FIT_LABEL = {
  pass: () => t('fitPass'),
  warn: () => t('fitWarn'),
  fail: () => t('fitFail'),
  unknown: () => t('fitUnknown')
};

const GEOMETRY_LABEL = {
  'procedural-proxy': () => t('geometryProceduralProxy'),
  'conceptual-proxy': () => t('geometryConceptualProxy'),
  'licensed-asset': () => t('geometryLicensedAsset'),
  'provided-model': () => t('geometryProvidedModel')
};

const escape = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const badge = (status, text) =>
  `<span class="badge badge-${escape(status)}">${escape(text)}</span>`;

function dimensionRow(product) {
  const d = product.dimensionsMm || {};
  const cell = (value, status) => {
    const known = status !== 'unknown' && Number.isFinite(value);
    return `<b>${known ? Math.round(value) : t('evidenceUnknown')}</b>${badge(status || 'unknown', (STATUS_LABEL[status] || STATUS_LABEL.unknown)())}`;
  };
  return `
    <div class="dim-grid">
      <span>W</span>${cell(d.width, d.widthStatus)}
      <span>D</span>${cell(d.depth, d.depthStatus)}
      <span>H</span>${cell(d.height, d.heightStatus)}
    </div>`;
}

function formatDate(value) {
  if (!value) return t('evidenceUnknown');
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? escape(value) : new Date(parsed).toISOString().slice(0, 10);
}

function card(product, placedCount) {
  const fit = product.fit || {status: 'unknown', reasons: [], unknowns: []};
  const geometry = product.geometry || {};
  const evidence = (product.evidence || [])[0] || {};
  const price = product.price;
  const isProxy = geometry.source === 'procedural-proxy' || geometry.source === 'conceptual-proxy';

  return `
  <article class="product-card" data-product="${escape(product.id)}" draggable="true">
    <header>
      <div>
        <h3>${escape(product.name)}</h3>
        <p class="product-meta">${escape(product.brand || '')} ${escape(product.model || '')} · ${escape(product.role)} · ${escape(product.market)}</p>
      </div>
      ${placedCount ? `<span class="placed-pill">×${placedCount}</span>` : ''}
    </header>

    <p class="field-label">${t('productDimensions')}</p>
    ${dimensionRow(product)}

    <dl class="product-facts">
      <dt>${t('productSource')}</dt>
      <dd><a href="${escape(product.dimensionSourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(evidence.sourceType || 'unknown')} ↗</a></dd>
      <dt>${t('productRetrieved')}</dt>
      <dd>${formatDate(evidence.retrievedAt)}</dd>
      <dt>${t('productPrice')}</dt>
      <dd>${price ? `${escape(price.currency || '')} ${escape(price.amount)} <small>as of ${formatDate(price.asOf)}</small>` : t('evidenceUnknown')}</dd>
      <dt>${t('productGeometry')}</dt>
      <dd>${escape((GEOMETRY_LABEL[geometry.source] || (() => geometry.source || 'unknown'))())}</dd>
      <dt>${t('productFit')}</dt>
      <dd>${badge(`fit-${fit.status}`, (FIT_LABEL[fit.status] || FIT_LABEL.unknown)())}</dd>
    </dl>

    ${evidence.dimensionQuote ? `<blockquote class="quote">${escape(evidence.dimensionQuote)}</blockquote>` : ''}

    ${fit.reasons?.length ? `<p class="field-label">${t('productReasons')}</p><ul class="reasons">${fit.reasons.map(r => `<li>${escape(r)}</li>`).join('')}</ul>` : ''}
    ${fit.unknowns?.length ? `<p class="field-label">${t('productUnknowns')}</p><ul class="unknowns">${fit.unknowns.map(r => `<li>${escape(r)}</li>`).join('')}</ul>` : ''}

    ${isProxy ? `<p class="proxy-note">${t('proxyLabel')}</p>` : ''}

    <div class="product-actions">
      <button type="button" class="primary" data-action="place">${t('productPlace')}</button>
      <button type="button" class="secondary" data-action="focus"${placedCount ? '' : ' disabled'}>${t('productFocus')}</button>
      ${product.purchaseUrl
        ? `<a class="secondary link" href="${escape(product.purchaseUrl)}" target="_blank" rel="noopener noreferrer">${t('productOpen')}</a>`
        : `<span class="secondary muted">${t('evidenceUnknown')}</span>`}
    </div>
  </article>`;
}

export function createProductPanel(host, {onPlace, onFocus}) {
  let products = [];
  let counts = new Map();

  host.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const id = button.closest('[data-product]')?.dataset.product;
    if (!id) return;
    if (button.dataset.action === 'place') onPlace?.(id);
    if (button.dataset.action === 'focus') onFocus?.(id);
  });

  // Desktop: drag a card onto the canvas. placement.js listens for the same MIME type.
  host.addEventListener('dragstart', event => {
    const id = event.target.closest?.('[data-product]')?.dataset.product;
    if (!id) return;
    event.dataTransfer.setData('application/x-idm-product', id);
    event.dataTransfer.effectAllowed = 'copy';
  });

  function render() {
    if (!products.length) {
      host.innerHTML = `<p class="empty">${t('productsEmpty')}</p>`;
      return;
    }
    host.innerHTML = products.map(product => card(product, counts.get(product.id) || 0)).join('');
  }

  return {
    setProducts(next) {
      products = Array.isArray(next) ? next : [];
      // Roles are normalised once here so the panel and the proxy builder agree.
      for (const product of products) product.normalisedRole = normaliseRole(product.role);
      render();
      return products;
    },
    setCounts(layout) {
      counts = new Map();
      for (const item of layout || []) counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
      render();
    },
    get products() { return products; },
    byId: id => products.find(product => product.id === id) || null,
    locale: () => i18n.locale
  };
}
