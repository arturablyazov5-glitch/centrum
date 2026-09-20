// Блок ящиков на наружном фасаде: сетка 3 × 3 на участке шириной 1800.
// Сам ящик описан один раз в build-drawer.js — здесь только его размещение.

import { UNDER_1, PLINTH } from './params.js';
import { addQuad, addPrism } from './mesh.js';
import { PALETTE } from './palette.js';
import {
  X_FACE as X, Y0, Y1, COLUMNS, ROWS, GAP, CELL_W, CELL_H, CARCASS_BACK, TOP_SHELF_Z0, CELLS,
} from './drawer-geometry.js';

export { DRAWER_COUNT, DRAWER_TRAVEL, CELLS } from './drawer-geometry.js';

// Каркас блока: задняя стенка, вертикальные перегородки и горизонтальные полки.
// Именно к ним привинчены неподвижные звенья направляющих.
export function buildDrawerCarcass(mesh) {
  // Задняя стенка видна, когда ящик выдвинут: это часть корпуса, поэтому она
  // получает ту же серую облицовку, что боковины, а не цвет технологического зазора.
  addQuad(mesh, [CARCASS_BACK, Y0, PLINTH], [CARCASS_BACK, Y1, PLINTH],
    [CARCASS_BACK, Y1, UNDER_1], [CARCASS_BACK, Y0, UNDER_1], PALETTE.side);

  // Перегородки между колонками: толщина перегородки равна зазору между фасадами.
  for (let c = 1; c < COLUMNS; c++) {
    const y = Y0 + c * (CELL_W + GAP) - GAP;
    addPrism(mesh, [[CARCASS_BACK, y], [X, y], [X, y + GAP], [CARCASS_BACK, y + GAP]], PLINTH, UNDER_1, PALETTE.side, { top: true });
  }
  // Полки между рядами.
  for (let r = 1; r < ROWS; r++) {
    const z = PLINTH + r * (CELL_H + GAP) - GAP;
    addPrism(mesh, [[CARCASS_BACK, Y0], [X, Y0], [X, Y1], [CARCASS_BACK, Y1]], z, z + GAP, PALETTE.side, { top: true, bottom: true });
  }
  // Верхняя полка закрывает снизу деревянную столешницу. Когда верхний ящик
  // открыт, взгляд упирается в её серую конструкционную нижнюю грань, а не в шпон.
  // Верхний фасад подходит к полке без отдельной видимой щели.
  addPrism(mesh, [[CARCASS_BACK, Y0], [X, Y0], [X, Y1], [CARCASS_BACK, Y1]], TOP_SHELF_Z0, UNDER_1, PALETTE.side, { top: true, bottom: true });
  // Боковые стенки блока по краям проёма.
  for (const [y, dir] of [[Y0, -1], [Y1, 1]])
    addQuad(mesh, [CARCASS_BACK, y, PLINTH], [X, y, PLINTH], [X, y, UNDER_1], [CARCASS_BACK, y, UNDER_1], PALETTE.side);
}
