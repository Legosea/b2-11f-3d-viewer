// Element fullscreen with an iOS Safari fallback: iPhone has no Element.requestFullscreen, so a
// CSS class fakes it by pinning the element over the viewport.
export function createFullscreen(element, onChange) {
  let fake = false;
  const request = element.requestFullscreen || element.webkitRequestFullscreen;
  const exitCall = document.exitFullscreen || document.webkitExitFullscreen;
  const real = () => (document.fullscreenElement || document.webkitFullscreenElement) === element;
  const active = () => real() || fake;

  function setFake(on) {
    fake = on;
    element.classList.toggle('fake-fullscreen', on);
    document.body.classList.toggle('fullscreen-fallback', on);
    onChange?.(active());
  }

  async function enter(landscape) {
    if (request) {
      try { await request.call(element, {navigationUI: 'hide'}); } catch { setFake(true); }
    } else {
      setFake(true);
    }
    if (landscape) { try { await screen.orientation.lock('landscape'); } catch { /* unsupported */ } }
    onChange?.(active());
  }

  function exit() {
    if (real() && exitCall) { try { exitCall.call(document); } catch { /* ignore */ } }
    if (fake) setFake(false);
    try { screen.orientation.unlock(); } catch { /* unsupported */ }
    onChange?.(active());
  }

  for (const type of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(type, () => onChange?.(active()));
  }

  return {enter, exit, toggle(landscape) { return active() ? exit() : enter(landscape); }, active};
}
