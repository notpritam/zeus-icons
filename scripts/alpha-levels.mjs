export function alphaLevels(data) {
  const histogram = new Uint32Array(256);
  for (let i = 3; i < data.length; i += 4) histogram[data[i]]++;
  const levels = [];
  // Most references use 40% and 100%; several arrow families use 50%.
  // Require an interior plateau, not one of the many antialiased edge values.
  const minimum = Math.max(8, (data.length / 4) * 0.0001);
  const width = Math.sqrt(data.length / 4),
    interior = new Uint32Array(256);
  if (!Number.isInteger(width))
    throw new Error("Expected a square alpha image");
  for (let y = 1; y < width - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4 + 3,
        value = data[i];
      if (
        value &&
        Math.abs(data[i - 4] - value) <= 1 &&
        Math.abs(data[i + 4] - value) <= 1 &&
        Math.abs(data[i - width * 4] - value) <= 1 &&
        Math.abs(data[i + width * 4] - value) <= 1
      )
        interior[value]++;
    }
  for (let value = 16; value <= 255; value++) {
    if (histogram[value] < minimum || interior[value] < 3) continue;
    let neighbors = 0;
    for (let d = -3; d <= 3; d++)
      if (d && value + d >= 0 && value + d <= 255)
        neighbors += histogram[value + d];
    if (histogram[value] >= Math.max(2, neighbors * 1.5)) levels.push(value);
  }
  if (!levels.length) {
    let peak = 1;
    for (let i = 2; i < 256; i++) if (histogram[i] > histogram[peak]) peak = i;
    if (histogram[peak]) levels.push(peak);
  }
  if (!levels.length) throw new Error("Reference contains no visible pixels");
  return levels;
}
