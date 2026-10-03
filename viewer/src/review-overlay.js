import * as T from 'three';

/**
 * Source-plan review layer. It never mutates architecture: the SVG is placed as a transparent
 * XZ plane over the same plan bounds and can be toggled independently.
 */
export function createReviewOverlay({parent, bounds, url, invalidate}) {
  const group = new T.Group();
  group.name = 'review-overlay';
  group.visible = false;
  group.userData.reviewOnly = true;
  parent.add(group);

  let disposed = false;
  let texture = null;
  let material = null;

  if (url) {
    new T.TextureLoader().load(url, loaded => {
      if (disposed) { loaded.dispose(); return; }
      texture = loaded;
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 4;
      material = new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: T.DoubleSide,
        toneMapped: false
      });
      const plane = new T.Mesh(new T.PlaneGeometry(bounds.width, bounds.depth), material);
      plane.name = 'review-plan-overlay';
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(bounds.centerX, 0.018, bounds.centerZ);
      plane.renderOrder = 90;
      plane.userData.reviewOnly = true;
      plane.userData.walkIgnore = true;
      group.add(plane);
      invalidate?.();
    }, undefined, error => {
      group.userData.loadError = String(error?.message || error || 'overlay load failed');
      invalidate?.();
    });
  }

  return {
    group,
    setVisible(visible) {
      group.visible = !!visible;
      invalidate?.();
      return group.visible;
    },
    getVisible() { return group.visible; },
    dispose() {
      disposed = true;
      texture?.dispose();
      material?.dispose();
      group.removeFromParent();
    }
  };
}
