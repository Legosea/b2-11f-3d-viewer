// Thumb-anchored 360 degree analogue stick. It keeps its own pointerId so a simultaneous
// drag-to-look on the right half of the screen keeps working.
export function createJoystick(host, onMove, radius = 52) {
  const zone = document.createElement('div');
  zone.className = 'joy-zone';
  zone.hidden = true;
  zone.innerHTML = '<div class="joy-base"><i class="joy-knob"></i></div>';
  const base = zone.querySelector('.joy-base');
  const knob = zone.querySelector('.joy-knob');
  let id = null;
  let cx = 0;
  let cy = 0;

  const reset = () => {
    id = null;
    base.classList.remove('on');
    knob.style.transform = 'translate(-50%,-50%)';
    onMove(0, 0);
  };

  zone.addEventListener('pointerdown', event => {
    if (id !== null) return;
    const rect = zone.getBoundingClientRect();
    // Anchor the base wherever the thumb landed, but keep the whole ring on screen.
    const limit = (value, max) => Math.max(radius + 10, Math.min(max - radius - 10, value));
    id = event.pointerId;
    cx = limit(event.clientX - rect.left, rect.width);
    cy = limit(event.clientY - rect.top, rect.height);
    base.style.left = `${cx}px`;
    base.style.top = `${cy}px`;
    base.classList.add('on');
    try { zone.setPointerCapture(event.pointerId); } catch { /* capture is best effort */ }
    event.preventDefault();
    event.stopPropagation();
  });

  zone.addEventListener('pointermove', event => {
    if (event.pointerId !== id) return;
    const rect = zone.getBoundingClientRect();
    let dx = event.clientX - rect.left - cx;
    let dy = event.clientY - rect.top - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) { dx *= radius / distance; dy *= radius / distance; }
    knob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px),calc(-50% + ${dy.toFixed(1)}px))`;
    onMove(dx / radius, -dy / radius);
    event.preventDefault();
    event.stopPropagation();
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zone.addEventListener(type, event => { if (event.pointerId === id) reset(); });
  }

  host.appendChild(zone);
  return {zone, show(on) { zone.hidden = !on; if (!on) reset(); }};
}
