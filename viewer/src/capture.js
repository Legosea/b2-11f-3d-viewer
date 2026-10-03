// PNG capture at a higher pixel ratio. The UI, room labels and review annotations are hidden by a
// body class (see style.css .photo-mode) so the exported image is the model, not the app chrome.
export function createCapture({container, renderer, composer, ao, quality}) {
  return function capture(scale = 2) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    const original = renderer.getPixelRatio();
    const resize = ratio => {
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height);
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      ao.setSize(width, height);
    };
    ao.enabled = quality() !== 'low';
    // The renderer is created with preserveDrawingBuffer, so toDataURL reads the frame we just drew.
    if (scale > 1) resize(Math.min(original * scale, 4));
    composer.render();
    const url = renderer.domElement.toDataURL('image/png');
    if (scale > 1) resize(original);
    return url;
  };
}
