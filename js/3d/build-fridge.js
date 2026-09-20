// Мини-холодильник в угловом модуле наружного фасада: ниша с поддоном и стеклянная
// дверь на петле по дальней кромке. Дверь открывается наружу, как на виде 08.

import { SIZE, PLINTH, FRIDGE_Y, FRIDGE_DEPTH, FRIDGE_HEIGHT } from './params.js';
import { addQuad, addPrism } from './mesh.js';
import { PALETTE } from './palette.js';

const X = SIZE;                 // плоскость наружного фасада
const DEPTH = FRIDGE_DEPTH;
const DOOR_T = 34;              // толщина дверной панели; наружная грань заподлицо с фасадом
const [Y0, Y1] = FRIDGE_Y;
const Z0 = PLINTH;
const Z1 = Z0 + FRIDGE_HEIGHT;

// Ось петли — у дальнего от ящиков края двери, поэтому дверь открывается «от угла».
export const FRIDGE_HINGE = [X - DOOR_T, Y0, 0];
export const FRIDGE_OPEN_DEG = 105;

// Ниша: боковые стенки, дно, потолок, задняя стенка и полки.
export function buildFridgeCavity(mesh) {
  const back = X - DEPTH;
  addQuad(mesh, [back, Y0, Z0], [back, Y1, Z0], [back, Y1, Z1], [back, Y0, Z1], PALETTE.fridge);
  addQuad(mesh, [back, Y0, Z0], [X, Y0, Z0], [X, Y0, Z1], [back, Y0, Z1], PALETTE.fridge);
  addQuad(mesh, [back, Y1, Z0], [X, Y1, Z0], [X, Y1, Z1], [back, Y1, Z1], PALETTE.fridge);
  addQuad(mesh, [back, Y0, Z0], [X, Y0, Z0], [X, Y1, Z0], [back, Y1, Z0], PALETTE.fridge);
  addQuad(mesh, [back, Y0, Z1], [X, Y0, Z1], [X, Y1, Z1], [back, Y1, Z1], PALETTE.fridge);
  // Две полки: без них открытая ниша читается как пустая дыра.
  for (const z of [Z0 + 190, Z0 + 380])
    addQuad(mesh, [back + 20, Y0 + 20, z], [X - 60, Y0 + 20, z], [X - 60, Y1 - 20, z], [back + 20, Y1 - 20, z], PALETTE.drawer);
}

// Дверь: стеклянная панель в раме, с вертикальной ручкой у свободной кромки.
export function buildFridgeDoor(mesh) {
  const inner = X - DOOR_T;
  const frame = 30;
  addPrism(mesh, [[inner, Y0], [X, Y0], [X, Y1], [inner, Y1]], Z0, Z1, PALETTE.glass, { top: true, bottom: true });
  // Рама по периметру: узкие непрозрачные полосы поверх стекла.
  const strip = (y0, y1, z0, z1) => addQuad(mesh, [X + 1, y0, z0], [X + 1, y1, z0], [X + 1, y1, z1], [X + 1, y0, z1], PALETTE.gap);
  strip(Y0, Y0 + frame, Z0, Z1);
  strip(Y1 - frame, Y1, Z0, Z1);
  strip(Y0, Y1, Z0, Z0 + frame);
  strip(Y0, Y1, Z1 - frame, Z1);
  // Вертикальная ручка у кромки, противоположной петле: единственное, что выступает за фасад.
  const handle = (y0, y1, x1) => addPrism(mesh, [[X, y0], [x1, y0], [x1, y1], [X, y1]], 250, 520, PALETTE.gap, { top: true, bottom: true });
  handle(Y1 - 96, Y1 - 58, X + 46);
  // Две стойки, на которых ручка держится: без них она выглядела бы приклеенной.
  for (const z of [268, 502])
    addPrism(mesh, [[X, Y1 - 88], [X + 24, Y1 - 88], [X + 24, Y1 - 66], [X, Y1 - 66]], z, z + 20, PALETTE.gap, { top: true });
}

export function fridgeDoorEdges() {
  return [[[X + 3, Y0, Z0], [X + 3, Y1, Z0], [X + 3, Y1, Z1], [X + 3, Y0, Z1]]];
}
