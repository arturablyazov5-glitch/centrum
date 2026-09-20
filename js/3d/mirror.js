// Отражение модели относительно оси x = 1450.
//
// Все части построены строго по чертежам: фасад с холодильником и ящиками смотрит
// в сторону +X, петля Bridge стоит у кромки x = 1050. В изделии сторона обслуживания
// выбрана зеркальной, поэтому готовая геометрия целиком отражается здесь —
// так builders остаются один в один с листами, а разворот описан в одном месте.

import { SIZE } from './params.js';
import { multiply, translation, scaling } from './mat4.js';

// Само отражение как матрица: x → 2900 − x. Обратное преобразование совпадает с прямым.
export const MIRROR = multiply(translation(SIZE, 0, 0), scaling(-1, 1, 1));

export const mirrorPoint = ([x, y, z]) => [SIZE - x, y, z];

// Отражение вершин и нормалей уже собранного набора буферов.
export function mirrorBuffers(data) {
  for (let i = 0; i < data.position.length; i += 3) data.position[i] = SIZE - data.position[i];
  for (let i = 0; i < data.normal.length; i += 3) data.normal[i] = -data.normal[i];
  return data;
}

// Матрица подвижного узла в отражённой сцене: то же движение, но по другую сторону.
export const mirrorMatrix = (m) => multiply(MIRROR, multiply(m, MIRROR));

// Азимут камеры в отражённой сцене: ракурсы остаются теми же по смыслу.
export const mirrorAzimuth = (azimuth) => Math.PI - azimuth;
