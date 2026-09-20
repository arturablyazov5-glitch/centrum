// Габаритные коробки групп. Нужны выбору детали курсором: покупные модели
// приходят с сотнями тысяч треугольников, и перебирать их на каждое движение мыши
// нельзя. Сначала луч проверяется по коробке — это отсекает почти всё за копейки.

// Коробка по массиву вершин.
export function computeBounds(positions) {
  if (!positions || !positions.length) return null;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  return { lo, hi };
}

// Коробка после преобразования узла: берём восемь углов и охватываем их заново.
// Для поворотов и переносов этого достаточно, а результат заведомо не меньше нужного.
export function transformBounds(bounds, m) {
  if (!bounds || !m) return bounds;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let corner = 0; corner < 8; corner++) {
    const x = corner & 1 ? bounds.hi[0] : bounds.lo[0];
    const y = corner & 2 ? bounds.hi[1] : bounds.lo[1];
    const z = corner & 4 ? bounds.hi[2] : bounds.lo[2];
    const p = [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
    for (let k = 0; k < 3; k++) {
      if (p[k] < lo[k]) lo[k] = p[k];
      if (p[k] > hi[k]) hi[k] = p[k];
    }
  }
  return { lo, hi };
}

// Пересекает ли луч коробку (метод отрезков по каждой оси).
export function rayHitsBounds(origin, direction, bounds) {
  if (!bounds) return true;
  let near = -Infinity, far = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(direction[k]) < 1e-9) {
      if (origin[k] < bounds.lo[k] || origin[k] > bounds.hi[k]) return false;
      continue;
    }
    const inv = 1 / direction[k];
    let t0 = (bounds.lo[k] - origin[k]) * inv;
    let t1 = (bounds.hi[k] - origin[k]) * inv;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0);
    far = Math.min(far, t1);
    if (near > far) return false;
  }
  return far > 0;
}
