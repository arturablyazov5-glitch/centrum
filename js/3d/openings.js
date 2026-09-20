// Проёмы в наружной стенке корпуса: за ними стоят ниша холодильника и блок ящиков.
// Без этих вырезов фасадные модули были бы закрыты сплошной стенкой.

import { SIZE, UNDER_1, PLINTH, FRIDGE_Y, DRAWERS_Y } from './params.js';
import { clipPolygon } from './entry-cut.js';
import { addPolygon } from './mesh.js';

// Все проёмы лежат в плоскости наружного фасада x = 2900 и заданы в координатах y и z.
export const FACADE_OPENINGS = [
  { y: FRIDGE_Y, z: [PLINTH, UNDER_1] },
  { y: DRAWERS_Y, z: [PLINTH, UNDER_1] },
];

const ON_FACADE = SIZE - 0.5;

// Вычитание прямоугольника из плоского многоугольника: остаются части ниже, выше и по бокам.
function subtract(poly, { y: [y0, y1], z: [z0, z1] }) {
  const below = clipPolygon(poly, 1, y0, true);
  const above = clipPolygon(poly, 1, y1, false);
  const band = clipPolygon(clipPolygon(poly, 1, y0, false), 1, y1, true);
  return [below, above, clipPolygon(band, 2, z0, true), clipPolygon(band, 2, z1, false)]
    .filter((p) => p.length >= 3);
}

// Грань наружной стенки с вырезанными проёмами. Для стенок вне фасада ничего не меняется.
export function addWallWithOpenings(mesh, poly, color) {
  let parts = [poly];
  if (poly.every((p) => p[0] > ON_FACADE)) {
    for (const opening of FACADE_OPENINGS) parts = parts.flatMap((part) => subtract(part, opening));
  }
  for (const part of parts) addPolygon(mesh, part, color);
}
