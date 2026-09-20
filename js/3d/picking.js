// Выбор детали курсором: луч из камеры через точку на холсте и поиск ближайшего
// треугольника. Проверяются все группы, включая корпус, — иначе можно было бы
// «открыть» ящик, ткнув в стенку, которая стоит перед ним.

import { eyePosition, FOV_Y } from './camera.js';
import { transformBounds, rayHitsBounds } from './bounds.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// Луч из камеры через точку холста, заданную в нормализованных координатах −1…1.
export function cameraRay(camera, aspect, ndcX, ndcY) {
  const origin = eyePosition(camera);
  const forward = norm(sub(camera.target, origin));
  const right = norm(cross(forward, [0, 0, 1]));
  const up = cross(right, forward);
  const tan = Math.tan(FOV_Y / 2);
  const direction = norm([0, 1, 2].map((i) =>
    forward[i] + right[i] * ndcX * tan * aspect + up[i] * ndcY * tan));
  return { origin, direction };
}

// Вершина, приведённая матрицей узла в мировые координаты.
const apply = (m, x, y, z) => (m
  ? [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
  : [x, y, z]);

// Пересечение луча с треугольником по Мёллеру — Трумбору; грани двусторонние.
function hitTriangle(origin, direction, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a);
  const p = cross(direction, e2);
  const det = dot(e1, p);
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const t = sub(origin, a);
  const u = dot(t, p) * inv;
  if (u < 0 || u > 1) return null;
  const q = cross(t, e1);
  const v = dot(direction, q) * inv;
  if (v < 0 || u + v > 1) return null;
  const distance = dot(e2, q) * inv;
  return distance > 1 ? distance : null;
}

// Ближайшая к камере группа под курсором. Грани ближе minDistance пропускаются:
// они растворены дизерингом, и ловить ими курсор было бы странно.
export function pickGroup(groups, ray, { minDistance = 1 } = {}) {
  let best = null;
  for (const group of groups) {
    if (!group.visible || !group.source || !group.source.count) continue;
    const m = group.model;
    // Дешёвая отбраковка по габаритной коробке: без неё покупные модели
    // на сотни тысяч треугольников вешали бы наведение курсора.
    if (!rayHitsBounds(ray.origin, ray.direction, transformBounds(group.bounds, m))) continue;
    const pos = group.source.position;
    for (let i = 0; i < pos.length; i += 9) {
      const a = apply(m, pos[i], pos[i + 1], pos[i + 2]);
      const b = apply(m, pos[i + 3], pos[i + 4], pos[i + 5]);
      const c = apply(m, pos[i + 6], pos[i + 7], pos[i + 8]);
      const distance = hitTriangle(ray.origin, ray.direction, a, b, c);
      if (distance !== null && distance >= minDistance && (!best || distance < best.distance))
        best = { name: group.name, distance, point: ray.origin.map((v, k) => v + ray.direction[k] * distance) };
    }
  }
  return best;
}
