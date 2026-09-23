// Вырез прохода 800: всё, что попадает в коридор x ∈ [1050, 1850] за осью y = 1350,
// из корпуса удаляется. Многоугольник режется полуплоскостями, а не выбрасывается целиком,
// поэтому кромки прохода получаются ровными на любой геометрии.

import { ENTRY_X0, ENTRY_X1, ENTRY_Y } from './params.js';

// Точка пересечения полуплоскости с ребром многоугольника может лечь на доли мм
// от вершины, которая и так уже сохранена (ребро почти касается плоскости среза).
// Без слияния такие вершины дают в mesh.addPolygon почти вырожденный треугольник —
// игольчатый плавник в рендере. 5 мм на порядок меньше любого реального размера
// детали в этой модели, поэтому слияние не меняет видимую форму.
// Порог рассчитан на крупные грани корпуса. Намеренно мелкая геометрия — скруглённая
// кромка отверстия, где полоса вала всего около 3 мм, — этим порогом съедалась целиком,
// поэтому он задаётся аргументом, а 5 мм остаются значением по умолчанию.
const CLIP_MERGE_EPS = 5; // мм

// Отсечение выпуклого многоугольника полуплоскостью по одной координате.
export function clipPolygon(poly, axis, value, keepLess, mergeEps = CLIP_MERGE_EPS) {
  const out = [];
  const inside = (p) => (keepLess ? p[axis] <= value : p[axis] >= value);
  const dist = (p, q) => Math.hypot(...p.map((v, k) => v - q[k]));
  const pushMerged = (p) => {
    const last = out[out.length - 1];
    if (!last || dist(p, last) > mergeEps) out.push(p);
  };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ai = inside(a), bi = inside(b);
    if (ai) pushMerged(a);
    if (ai !== bi) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      pushMerged(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= mergeEps) out.pop();
  return out;
}

// Части многоугольника вне коридора прохода: слева от петли, справа от выступа и перед осью.
export function outsideEntry(poly, mergeEps = CLIP_MERGE_EPS) {
  // Целиком вне прохода: разрез вообще не нужен. Иначе слияние близких
  // вершин на искусственных стыках x=ENTRY_X0/X1 оставляет щели на столешнице.
  if (poly.every((p) => p[1] <= ENTRY_Y)
    || poly.every((p) => p[0] <= ENTRY_X0)
    || poly.every((p) => p[0] >= ENTRY_X1)) return [poly];
  const left = clipPolygon(poly, 0, ENTRY_X0, true, mergeEps);
  const right = clipPolygon(poly, 0, ENTRY_X1, false, mergeEps);
  const middle = clipPolygon(
    clipPolygon(clipPolygon(poly, 0, ENTRY_X0, false, mergeEps), 0, ENTRY_X1, true, mergeEps),
    1, ENTRY_Y, true, mergeEps);
  return [left, right, middle].filter((p) => p.length >= 3);
}

// Целиком ли многоугольник лежит вне коридора (для контурных линий).
export const clearOfEntry = (pts) => pts.every((p) => !(p[0] > ENTRY_X0 && p[0] < ENTRY_X1 && p[1] > ENTRY_Y));
