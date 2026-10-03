export function luminanceStats(rgba) {
  const linear = byte => {
    const c = byte / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  let sum = 0;
  let highlights = 0;
  let pixels = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const y = 0.2126 * linear(rgba[i]) + 0.7152 * linear(rgba[i + 1]) + 0.0722 * linear(rgba[i + 2]);
    sum += y;
    if (y > 0.95) highlights++;
    pixels++;
  }
  return {
    mean: pixels ? sum / pixels : 0,
    highlightRatio: pixels ? highlights / pixels : 0,
    pixels
  };
}
